/**
 * forms/selServicioContabilidad.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmSelServicioContabilidad.frm (VBA). Primera
 * pantalla del botón "Consolidado de Servicios": lista los servicios de
 * SERVICIOS, permite cambiar su ESTADO (Culminado / En Ruta / Falso Flete
 * / Viaje Cancelado) y, al continuar, valida el estado antes de abrir el
 * detalle (frmConsolidadoServicio).
 * -------------------------------------------------------------------------
 */
const FormSelServicioContabilidad = {

  _filaSeleccionada: null,

  abrir: async function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Empresa</label><input type="text" id="filtroEmpresa"></div>
        <div class="campo"><label>Estado</label>
          <select id="filtroEstado">
            <option value="">Todos</option>
            <option>EN RUTA</option><option>COMPLETADO</option>
            <option>FF COMPLET.</option><option>CANCELADO</option>
          </select>
        </div>
        <div class="campo"><label>Desde</label><input type="text" id="filtroDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroHasta" placeholder="dd/mm/yyyy"></div>
        <button class="boton-secundario" id="btnBorrarFiltro">Borrar filtro</button>
      </div>
      <div style="max-height:340px; overflow:auto;">
        <table class="tabla-lista" id="tablaServicios">
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Conductor</th><th>Placa</th><th>Destino 1</th><th>Estado</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:space-between;">
        <div style="display:flex; gap:8px;">
          <button class="boton-secundario" id="btnEnRuta">En Ruta</button>
          <button class="boton-secundario" id="btnCulminado">Culminado</button>
          <button class="boton-secundario" id="btnFalsoFlete">Falso Flete</button>
          <button class="boton-peligro" id="btnViajeCancelado">Cancelar viaje</button>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="boton-secundario" id="btnCancelarSelServicio">Cerrar</button>
          <button class="boton-primario" id="btnContinuarConsolidado">Continuar</button>
        </div>
      </div>`;

    abrirPanel('Consolidado de Servicios - Selección', html, (raiz) => this._wire(raiz));
  },

  _wire: function (raiz) {
    const self = this;
    self._filaSeleccionada = null;

    async function cargar() {
      const filtros = {
        empresa: raiz.querySelector('#filtroEmpresa').value.trim(),
        estado: raiz.querySelector('#filtroEstado').value.trim(),
        fechaDesde: raiz.querySelector('#filtroDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroHasta').value.trim()
      };
      const filas = await llamarBackend('listarServiciosPendientes', filtros);
      const tbody = raiz.querySelector('#tablaServicios tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        tr.innerHTML = `<td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td><td>${f['CLIENTE PARA FACTURACIÓN']||''}</td>
          <td>${f['CONDUCTOR']||''}</td><td>${f['PLACA TRACTO']||''}</td><td>${f['DESTINO 1']||''}</td><td>${f['ESTADO']||''}</td>`;
        tr.addEventListener('click', function () {
          tbody.querySelectorAll('tr').forEach(x => x.classList.remove('seleccionada'));
          tr.classList.add('seleccionada');
          self._filaSeleccionada = Number(tr.dataset.fila);
        });
        tbody.appendChild(tr);
      });
    }

    function formatoFecha(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    }

    ['filtroEmpresa', 'filtroEstado', 'filtroDesde', 'filtroHasta'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    raiz.querySelector('#btnBorrarFiltro').addEventListener('click', function () {
      raiz.querySelector('#filtroEmpresa').value = '';
      raiz.querySelector('#filtroEstado').value = '';
      raiz.querySelector('#filtroDesde').value = '';
      raiz.querySelector('#filtroHasta').value = '';
      cargar();
    });

    async function cambiarEstado(nuevoEstado) {
      if (self._filaSeleccionada === null) {
        mostrarMensaje('Seleccione un servicio para continuar.', 'error');
        return;
      }
      await llamarBackend('cambiarEstadoServicio', { fila: self._filaSeleccionada, nuevoEstado: nuevoEstado });
      cargar();
    }
    raiz.querySelector('#btnEnRuta').addEventListener('click', function () { cambiarEstado('EN RUTA'); });
    raiz.querySelector('#btnCulminado').addEventListener('click', function () { cambiarEstado('COMPLETADO'); });
    raiz.querySelector('#btnFalsoFlete').addEventListener('click', function () { cambiarEstado('FF COMPLET.'); });
    raiz.querySelector('#btnViajeCancelado').addEventListener('click', function () { cambiarEstado('CANCELADO'); });

    raiz.querySelector('#btnCancelarSelServicio').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnContinuarConsolidado').addEventListener('click', async function () {
      if (self._filaSeleccionada === null) {
        mostrarMensaje('Seleccione un servicio para continuar.', 'error');
        return;
      }
      const resp = await llamarBackend('validarContinuarConsolidado', { fila: self._filaSeleccionada });
      if (!resp.ok) {
        mostrarMensaje(resp.mensaje, 'error');
        return;
      }
      FormConsolidadoServicio.abrir(self._filaSeleccionada, resp.servicio['ESTADO']);
    });

    cargar();
  }
};
