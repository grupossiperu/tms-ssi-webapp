/**
 * forms/selServicioContabilidad.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmSelServicioContabilidad.frm (VBA). Primera
 * pantalla del botón "Consolidado de Servicios": lista los servicios de
 * SERVICIOS, permite cambiar su ESTADO (Culminado / En Ruta / Falso Flete
 * / Viaje Cancelado) y, al continuar, valida el estado antes de abrir el
 * detalle (frmConsolidadoServicio).
 *
 * Columnas mostradas (a pedido del usuario): Fecha, Cliente, Conductor,
 * Placa, Destino, Fecha/Hora de retiro, Fecha/Hora de posicionamiento,
 * Galones y total de combustible del tracto, Monto a depositar, Tarifa,
 * y una columna "Depositado" con checkbox que se guarda de inmediato en la
 * hoja (columna DEPOSITADO). El filtro de Empresa fue eliminado.
 * -------------------------------------------------------------------------
 */
const FormSelServicioContabilidad = {

  _filaSeleccionada: null,

  abrir: async function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Estado</label>
          <select id="filtroEstado">
            <option value="">Todos</option>
            <option>PROGRAMADO</option><option>EN RUTA</option>
            <option>CULMINADO</option><option>FALSO FLETE</option>
            <option>CANCELADO</option>
          </select>
        </div>
        <div class="campo"><label>Desde</label><input type="text" id="filtroDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Datos</label>
          <select id="filtroDatos">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Datos incompletos</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltro">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaServicios">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Conductor</th><th>Placa</th><th>Booking</th>
            <th>Reefer o Seco</th><th>Ciudad de retiro</th><th>Depósito de retiro</th><th>Retiro</th>
            <th>Destino 1</th><th>Packing</th><th>Posicionamiento</th><th>Destino 2</th><th>Posicionamiento 2</th>
            <th>Depósito de devolución</th><th>Fecha y hora de devolución</th>
            <th>Datos</th><th>Imprimir</th><th>Estado</th>
          </tr></thead>
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

    abrirPanel('Consolidado de Servicios - Selección', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _wire: function (raiz) {
    const self = this;
    self._filaSeleccionada = null;

    function numero(v) {
      if (v === null || v === undefined) return 0;
      const n = parseFloat(String(v).replace(/S\//g, '').replace(/\$/g, '').replace(/\s/g, '').replace(',', '.'));
      return isNaN(n) ? 0 : n;
    }

    function formatoFecha(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    function formatoHora(v) {
      // Google Sheets guarda celdas de solo-hora como fecha/hora completa
      // (epoch 1899-12-30) al leerlas via API; hay que extraer solo HH:mm
      // en vez de mostrar el objeto Date/ISO string tal cual.
      if (v === null || v === undefined || v === '' || v === '-') return '';
      if (v instanceof Date) {
        return String(v.getUTCHours()).padStart(2, '0') + ':' + String(v.getUTCMinutes()).padStart(2, '0');
      }
      const texto = String(v).trim();
      if (/^\d{1,2}:\d{2}/.test(texto)) return texto.slice(0, 5);
      const d = new Date(texto);
      if (!isNaN(d.getTime()) && /T\d{2}:\d{2}/.test(texto)) {
        return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
      }
      return texto;
    }

    function formatoFechaHora(fecha, hora) {
      const f = formatoFecha(fecha);
      const h = formatoHora(hora);
      if (f === '' && h === '') return '';
      if (h === '') return f;
      return (f + ' ' + h).trim();
    }

    function esVerdadero(v) {
      return v === true || String(v).trim().toUpperCase() === 'TRUE' || String(v).trim().toUpperCase() === 'SI';
    }

    function simboloMoneda(m) {
      return String(m || '').trim().toUpperCase() === 'D' ? '$ ' : 'S/ ';
    }

    // Un registro se considera "completo" cuando NINGUNA casilla del
    // formulario de Registrar Servicio quedó vacía. En esta base de datos,
    // "-" significa "no aplica" (usado a propósito para Destino 2, Fecha y
    // Hora de devolución cuando no corresponden); en cambio "" (celda
    // realmente vacía) significa que el campo simplemente no se llenó, y
    // eso SÍ debe marcarse como incompleto (p. ej. N° Contenedor, Booking).
    function vacio(v) {
      return v === null || v === undefined || String(v).trim() === '';
    }

    function esServicioCompleto(f) {
      const esConsolidado = String(f['TIPO DE CARGA'] || '').trim().toUpperCase() === 'CARGA CONSOLIDADO';

      const campos = [
        'FECHA DE PROGRAMACION', 'CLIENTE PARA FACTURACIÓN', 'EMPRESA QUE DIO EL SERVICIO', 'CONDUCTOR',
        'PLACA TRACTO', 'PLACA CARRETA', 'BOOKING', 'N° CONTENEDOR', 'TIPO DE CARGA', 'TIPO DE PRODUCTO',
        'TIPO DE TRATAMIENTO', 'PACKING', 'DEPOSITO DE RETIRO',
        'CIUDAD DE RETIRO', 'CIUDAD DE DEVOLUCION',
        'FECHA DE RETIRO', 'HORA DE RETIRO', 'DESTINO 1',
        'LUGAR DE POSICIONAMIENTO 1', 'FECHA DE POSICIONAMIENTO 1', 'HORA DE POSICIONAMIENTO 1',
        'DEPOSITO DE DEVOLUCION',
        'COSTO DEL PETRÓLEO X GALÓN', 'GL TRACTO', 'GL GENERADOR', 'TIPO DE ABASTECIMIENTO',
        'VIATICO', 'PEAJE', 'COCHERA', 'TOTAL POR VIAJE', 'MONTO DEPOSITADO', 'TARIFA 1'
      ];
      for (let i = 0; i < campos.length; i++) {
        if (vacio(f[campos[i]])) return false;
      }

      // El bloque de posicionamiento 2 solo es obligatorio en consolidado.
      if (esConsolidado) {
        if (vacio(f['DESTINO 2']) || String(f['DESTINO 2']).trim() === '-') return false;
        if (vacio(f['LUGAR DE POSICIONAMIENTO 2'])) return false;
        if (vacio(f['FECHA DE POSICIONAMIENTO 2'])) return false;
        if (vacio(f['HORA DE POSICIONAMIENTO 2'])) return false;
      }
      return true;
    }

    async function cargar() {
      const filtros = {
        estado: raiz.querySelector('#filtroEstado').value.trim(),
        fechaDesde: raiz.querySelector('#filtroDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroHasta').value.trim()
      };
      let filas = await llamarBackend('listarServiciosPendientes', filtros);

      const datos = raiz.querySelector('#filtroDatos').value;
      if (datos === 'completo') filas = filas.filter(f => esServicioCompleto(f));
      if (datos === 'incompleto') filas = filas.filter(f => !esServicioCompleto(f));

      function prioridadEstado(estado) {
        const e = String(estado || '').trim().toUpperCase();
        if (e === '') return 0;
        if (e === 'EN RUTA') return 1;
        if (e === 'FF COMPLET.' || e === 'CANCELADO') return 2;
        return 3;
      }
      function distanciaHoy(f) {
        const d = new Date(f['FECHA DE PROGRAMACION']);
        if (isNaN(d.getTime())) return Infinity;
        return Math.abs(d.getTime() - Date.now());
      }
      filas = filas.slice().sort(function (a, b) {
        const pa = prioridadEstado(a['ESTADO']);
        const pb = prioridadEstado(b['ESTADO']);
        if (pa !== pb) return pa - pb;
        const ca = esServicioCompleto(a) ? 1 : 0;
        const cb = esServicioCompleto(b) ? 1 : 0;
        if (ca !== cb) return ca - cb;
        return distanciaHoy(a) - distanciaHoy(b);
      });

      const tbody = raiz.querySelector('#tablaServicios tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const completo = esServicioCompleto(f);
        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        const reeferSeco = String(f['REEFER O DRY'] || '').trim().toUpperCase() === 'DRY' ? 'SECO' : (f['REEFER O DRY'] || '');
        tr.innerHTML = `
          <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
          <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
          <td>${f['CONDUCTOR'] || ''}</td>
          <td>${f['PLACA TRACTO'] || ''}</td>
          <td>${f['BOOKING'] || ''}</td>
          <td>${reeferSeco}</td>
          <td>${f['CIUDAD DE RETIRO'] || ''}</td>
          <td>${f['DEPOSITO DE RETIRO'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE RETIRO'], f['HORA DE RETIRO'])}</td>
          <td>${f['DESTINO 1'] || ''}</td>
          <td>${f['PACKING'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1'])}</td>
          <td>${f['DESTINO 2'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE POSICIONAMIENTO 2'], f['HORA DE POSICIONAMIENTO 2'])}</td>
          <td>${f['DEPOSITO DE DEVOLUCION'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE DEVOLUCION'], f['HORA DE DEVOLUCION'])}</td>
          <td style="text-align:center;">
            ${completo
              ? '<span class="badge-datos completo" title="Clic para revisar o modificar">Completo</span>'
              : '<span class="badge-datos incompleto" title="Clic para completar los datos">Datos incompletos</span>'}
          </td>
          <td style="text-align:center;"><button type="button" class="btn-imprimir-fila" title="Imprimir este servicio" style="cursor:pointer; font-size:16px; border:none; background:transparent;">🖨️</button></td>
          <td>${f['ESTADO'] || ''}</td>`;

        tr.querySelector('.badge-datos').addEventListener('click', function (ev) {
          ev.stopPropagation();
          FormServicio.abrir(f._fila);
        });

        tr.querySelector('.btn-imprimir-fila').addEventListener('click', function (ev) {
          ev.stopPropagation();
          FormServicio.imprimirDesdeFila(f._fila);
        });

        tr.addEventListener('click', function () {
          tbody.querySelectorAll('tr').forEach(x => x.classList.remove('seleccionada'));
          tr.classList.add('seleccionada');
          self._filaSeleccionada = Number(tr.dataset.fila);
        });
        tbody.appendChild(tr);
      });
    }

    ['filtroEstado', 'filtroDesde', 'filtroHasta', 'filtroDatos'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    raiz.querySelector('#btnBorrarFiltro').addEventListener('click', function () {
      raiz.querySelector('#filtroEstado').value = '';
      raiz.querySelector('#filtroDesde').value = '';
      raiz.querySelector('#filtroHasta').value = '';
      raiz.querySelector('#filtroDatos').value = '';
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
    raiz.querySelector('#btnCulminado').addEventListener('click', function () { cambiarEstado('CULMINADO'); });
    raiz.querySelector('#btnFalsoFlete').addEventListener('click', function () { cambiarEstado('FALSO FLETE'); });
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
