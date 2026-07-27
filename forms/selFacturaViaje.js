/**
 * forms/selFacturaViaje.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmSelFacturaViaje.frm (VBA): lista todo lo
 * pendiente de facturar (viajes, falsos fletes, balanza, sobrecostos),
 * con filtro por tipo y texto libre, y al elegir "Facturar" enruta al
 * formulario correspondiente (frmFacturaViaje / frmFacturaSobrecosto /
 * frmFacturaBalanza), igual que btnFacturar_Click.
 * -------------------------------------------------------------------------
 */
const FormSelFacturaViaje = {

  abrir: async function () {
    // Equivalente a la verificación de HOME.AbrirSeleccionFacturacion.
    const validacion = await llamarBackend('validarTipoCambioRegistrado', {});
    if (!validacion.ok) { mostrarMensaje(validacion.mensaje, 'error'); return; }

    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Buscar</label><input type="text" id="txtBuscarFact"></div>
        <div class="campo"><label>Tipo</label>
          <select id="cboFiltroTipoFact">
            <option>TODOS</option><option>VIAJE NORMAL</option><option>FALSO FLETE</option>
            <option>BALANZA</option><option>SOBREESTADIA</option><option>PERNOCTE</option>
            <option>BALANZA F.</option><option>SERV. FACT.</option><option>F.F. FACT.</option>
            <option>SOBREEST. F.</option><option>PERNOCTE F.</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltro">Borrar filtro</button>
      </div>
      <div style="max-height:340px; overflow:auto;">
        <table class="tabla-lista" id="tablaFact">
          <thead><tr><th>Booking</th><th>Contenedor</th><th>Destino 1</th><th>Cliente</th><th>Destino 2</th>
          <th>Fecha</th><th>Código</th><th>Placa</th><th>Tipo</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnInicio">Inicio</button>
        <button class="boton-primario" id="btnFacturar">Facturar</button>
      </div>`;

    abrirPanel('Facturar', html, (raiz) => this._wire(raiz));
  },

  _wire: function (raiz) {
    let seleccionado = null;

    function formatoFecha(v) {
      if (!v || v === '-') return '-';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    }

    async function cargar() {
      const filas = await llamarBackend('filtrarFacturacionPendiente', {
        tipo: raiz.querySelector('#cboFiltroTipoFact').value,
        texto: raiz.querySelector('#txtBuscarFact').value
      });
      const tbody = raiz.querySelector('#tablaFact tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.booking||''}</td><td>${f.contenedor||''}</td><td>${f.destino1||''}</td><td>${f.cliente1||''}</td>
          <td>${f.destino2||''}</td><td>${formatoFecha(f.fechaServicio)}</td><td>${f.codigo||''}</td><td>${f.placa||''}</td><td>${f.tipoFact||''}</td>`;
        tr.addEventListener('click', function () {
          tbody.querySelectorAll('tr').forEach(x => x.classList.remove('seleccionada'));
          tr.classList.add('seleccionada');
          seleccionado = f;
        });
        tbody.appendChild(tr);
      });
    }

    raiz.querySelector('#cboFiltroTipoFact').addEventListener('change', cargar);
    raiz.querySelector('#txtBuscarFact').addEventListener('input', cargar);
    raiz.querySelector('#btnBorrarFiltro').addEventListener('click', function () {
      raiz.querySelector('#txtBuscarFact').value = '';
      raiz.querySelector('#cboFiltroTipoFact').value = 'TODOS';
      cargar();
    });
    raiz.querySelector('#btnInicio').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnFacturar').addEventListener('click', async function () {
      if (!seleccionado) { mostrarMensaje('Seleccione un servicio para facturar.', 'error'); return; }

      const resp = await llamarBackend('resolverDestinoFacturacion', seleccionado);
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }

      if (resp.destino === 'frmFacturaSobrecosto') FormFacturaSobrecosto.abrir(resp.fila);
      else if (resp.destino === 'frmFacturaBalanza') FormFacturaBalanza.abrir(resp.fila);
      else FormFacturaViaje.abrir(resp.fila, resp.tipoFacturacionActual);
    });

    cargar();
  }
};
