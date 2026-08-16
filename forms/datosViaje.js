/**
 * forms/datosViaje.js
 * -------------------------------------------------------------------------
 * Módulo "Datos del Viaje" (botón de la pantalla principal). Lista los
 * servicios con: Fecha, Cliente, Booking, Tipo de carga, Conductor, Tracto,
 * Depósito de retiro, Fecha de retiro, Destino, Fecha de posicionamiento,
 * Fecha de devolución y un estado "Seguimiento" (Completo / Incompleto).
 *
 * Al hacer doble clic sobre el estado de seguimiento se abre un
 * sub-formulario (dentro del mismo panel, sin cerrar la lista) con 10
 * campos de fecha/hora del recorrido del viaje. Se puede grabar aunque no
 * estén todos completos; el estado de "Seguimiento" solo pasa a Completo
 * cuando los 10 campos están llenos (validado en el backend).
 * -------------------------------------------------------------------------
 */
const FormDatosViaje = {

  abrir: async function () {
    this._mostrarLista();
  },

  _mostrarLista: function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Desde</label><input type="text" id="filtroViajeDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroViajeHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Seguimiento</label>
          <select id="filtroViajeSeguimiento">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Incompleto</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltroViaje">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaDatosViaje">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Booking</th><th>Tipo de carga</th><th>Conductor</th>
            <th>Tracto</th><th>Depósito de retiro</th><th>Fecha de retiro</th><th>Destino</th>
            <th>Fecha de posicionamiento</th><th>Fecha de devolución</th><th>Seguimiento</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarDatosViaje">Cerrar</button>
      </div>`;

    abrirPanel('Datos del Viaje', html, (raiz) => this._wireLista(raiz), { ancho: true });
  },

  _wireLista: function (raiz) {
    const self = this;

    function formatoFecha(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    function formatoHora(v) {
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

    async function cargar() {
      const filtros = {
        fechaDesde: raiz.querySelector('#filtroViajeDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroViajeHasta').value.trim()
      };
      let filas = await llamarBackend('listarConSeguimiento', filtros);

      const seg = raiz.querySelector('#filtroViajeSeguimiento').value;
      if (seg === 'completo') filas = filas.filter(f => f._seguimientoCompleto);
      if (seg === 'incompleto') filas = filas.filter(f => !f._seguimientoCompleto);

      filas = filas.slice().sort(function (a, b) {
        const da = new Date(a['FECHA DE PROGRAMACION']);
        const db = new Date(b['FECHA DE PROGRAMACION']);
        const ta = isNaN(da.getTime()) ? -Infinity : da.getTime();
        const tb = isNaN(db.getTime()) ? -Infinity : db.getTime();
        return tb - ta;
      });

      const tbody = raiz.querySelector('#tablaDatosViaje tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const completo = !!f._seguimientoCompleto;
        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        tr.innerHTML = `
          <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
          <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
          <td>${f['BOOKING'] || ''}</td>
          <td>${f['TIPO DE CARGA'] || ''}</td>
          <td>${f['CONDUCTOR'] || ''}</td>
          <td>${f['PLACA TRACTO'] || ''}</td>
          <td>${f['DEPOSITO DE RETIRO'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE RETIRO'], f['HORA DE RETIRO'])}</td>
          <td>${f['DESTINO 1'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1'])}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE DEVOLUCION'], f['HORA DE DEVOLUCION'])}</td>
          <td style="text-align:center;">
            ${completo
              ? '<span class="badge-datos completo" title="Doble clic para revisar el seguimiento">Completo</span>'
              : '<span class="badge-datos incompleto" title="Doble clic para completar el seguimiento">Incompleto</span>'}
          </td>`;

        tr.addEventListener('dblclick', function () {
          self._abrirSeguimiento(f._fila);
        });

        tbody.appendChild(tr);
      });
    }

    ['filtroViajeDesde', 'filtroViajeHasta', 'filtroViajeSeguimiento'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    raiz.querySelector('#btnBorrarFiltroViaje').addEventListener('click', function () {
      raiz.querySelector('#filtroViajeDesde').value = '';
      raiz.querySelector('#filtroViajeHasta').value = '';
      raiz.querySelector('#filtroViajeSeguimiento').value = '';
      cargar();
    });

    raiz.querySelector('#btnCerrarDatosViaje').addEventListener('click', cerrarPanel);

    cargar();
  },

  _abrirSeguimiento: async function (filaServicio) {
    const self = this;
    const seguimiento = await llamarBackend('obtenerSeguimiento', { fila: filaServicio });

    function aDatetimeLocal(v) {
      if (!v) return '';
      let d;
      if (v instanceof Date) d = v;
      else {
        const texto = String(v).trim();
        if (texto === '') return '';
        d = new Date(texto);
      }
      if (isNaN(d.getTime())) return '';
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    const campos = [
      { id: 'txtInicioRuta', col: 'INICIO RUTA', label: 'Inicio Ruta', tipo: 'datetime-local' },
      { id: 'txtRetiroVacio', col: 'RETIRO VACIO', label: 'Retiro Vacío', tipo: 'datetime-local' },
      { id: 'txtSalidaVacio', col: 'SALIDA VACIO', label: 'Salida Vacío', tipo: 'datetime-local' },
      { id: 'txtMuertos1', col: 'T MUERTOS 1', label: 'T. Muertos 1 (horas)', tipo: 'number' },
      { id: 'txtLlegadaPlanta', col: 'LLEGADA PLANTA', label: 'Llegada Planta', tipo: 'datetime-local' },
      { id: 'txtSalidaPlanta', col: 'SALIDA PLANTA', label: 'Salida Planta', tipo: 'datetime-local' },
      { id: 'txtMuertos2', col: 'T MUERTOS 2', label: 'T. Muertos 2 (horas)', tipo: 'number' },
      { id: 'txtLlegadaColaPuerto', col: 'LLEGADA COLA PUERTO', label: 'Llegada Cola Puerto', tipo: 'datetime-local' },
      { id: 'txtSalidaPuerto', col: 'SALIDA DE PUERTO', label: 'Salida de Puerto', tipo: 'datetime-local' },
      { id: 'txtFinRuta', col: 'FIN DE RUTA', label: 'Fin de Ruta', tipo: 'datetime-local' }
    ];

    const html = `
      <div class="fila-campos">
        ${campos.map(function (c) {
          const valor = c.tipo === 'datetime-local' ? aDatetimeLocal(seguimiento[c.col]) : (seguimiento[c.col] || '');
          return `<div class="campo"><label>${c.label}</label><input type="${c.tipo}" id="${c.id}" value="${valor}"${c.tipo === 'number' ? ' step="0.5" min="0"' : ''}></div>`;
        }).join('')}
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:space-between;">
        <button class="boton-secundario" id="btnVolverSeguimiento">Volver a la lista</button>
        <button class="boton-primario" id="btnGrabarSeguimiento">Grabar</button>
      </div>`;

    actualizarPanel('Seguimiento del Viaje', html, function (raiz) {
      raiz.querySelector('#btnVolverSeguimiento').addEventListener('click', function () {
        self._mostrarListaEnPanel();
      });

      raiz.querySelector('#btnGrabarSeguimiento').addEventListener('click', async function () {
        const datos = {};
        campos.forEach(function (c) {
          datos[c.col] = raiz.querySelector('#' + c.id).value;
        });

        const resp = await llamarBackend('grabarSeguimiento', { fila: filaServicio, datos: datos });
        if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
        mostrarMensaje(resp.mensaje, resp.completo ? 'exito' : 'info');
        self._mostrarListaEnPanel();
      });
    });
  },

  _mostrarListaEnPanel: function () {
    const self = this;
    const html = document.getElementById('cuerpo-panel');
    // Reutiliza el mismo flujo que abrir(): reconstruye la lista dentro
    // del panel ya abierto en vez de cerrar y volver a abrir el modal.
    const contenido = `
      <div class="barra-filtros">
        <div class="campo"><label>Desde</label><input type="text" id="filtroViajeDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroViajeHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Seguimiento</label>
          <select id="filtroViajeSeguimiento">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Incompleto</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltroViaje">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaDatosViaje">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Booking</th><th>Tipo de carga</th><th>Conductor</th>
            <th>Tracto</th><th>Depósito de retiro</th><th>Fecha de retiro</th><th>Destino</th>
            <th>Fecha de posicionamiento</th><th>Fecha de devolución</th><th>Seguimiento</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarDatosViaje">Cerrar</button>
      </div>`;

    actualizarPanel('Datos del Viaje', contenido, (raiz) => self._wireLista(raiz));
  }
};
