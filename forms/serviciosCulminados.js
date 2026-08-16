/**
 * forms/serviciosCulminados.js
 * -------------------------------------------------------------------------
 * Módulo "Servicios Culminados" (botón de la pantalla principal, debajo de
 * "Acarreo"). Lista los servicios de SERVICIOS cuyo ESTADO es 'CULMINADO'
 * con: Fecha, Cliente, Booking, Conductor, Tracto, Tipo de carga,
 * Posicionamiento 1, Destino 1, Estado y Datos finales (Completo /
 * Incompleto).
 *
 * "Datos finales" refleja si ya se grabó el detalle del Consolidado para
 * ese servicio (columna SERVICIOS['CONSOLIDADO REGISTRADO']). Doble clic
 * sobre esa columna abre el mismo formulario de detalle que existía en
 * Acarreo bajo el botón "Continuar" (FormConsolidadoServicio), que
 * autorellena lo que ya existe en SERVICIOS y deja en blanco lo que falta.
 * Al grabar con éxito (lo cual exige, dentro de ese formulario, que todos
 * los campos obligatorios estén completos cuando el estado es CULMINADO),
 * el backend marca CONSOLIDADO REGISTRADO = true y esta lista pasa a
 * mostrar "Completo".
 * -------------------------------------------------------------------------
 */
const FormServiciosCulminados = {

  abrir: async function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Desde</label><input type="text" id="filtroCulmDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroCulmHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Datos finales</label>
          <select id="filtroCulmDatos">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Datos incompletos</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltroCulm">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaServiciosCulminados">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Booking</th><th>Conductor</th><th>Tracto</th>
            <th>Tipo de carga</th><th>Posicionamiento 1</th><th>Destino 1</th>
            <th>Estado</th><th>Datos finales</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarServiciosCulminados">Cerrar</button>
      </div>`;

    abrirPanel('Servicios Culminados', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _wire: function (raiz) {

    function formatoFecha(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    function esVerdadero(v) {
      return v === true || String(v).trim().toUpperCase() === 'TRUE' || String(v).trim().toUpperCase() === 'SI';
    }

    function datosFinalesCompletos(f) {
      return esVerdadero(f['CONSOLIDADO REGISTRADO']);
    }

    async function cargar() {
      const filtros = {
        estado: 'CULMINADO',
        fechaDesde: raiz.querySelector('#filtroCulmDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroCulmHasta').value.trim()
      };
      let filas = await llamarBackend('listarServiciosPendientes', filtros);

      const datos = raiz.querySelector('#filtroCulmDatos').value;
      if (datos === 'completo') filas = filas.filter(f => datosFinalesCompletos(f));
      if (datos === 'incompleto') filas = filas.filter(f => !datosFinalesCompletos(f));

      filas = filas.slice().sort(function (a, b) {
        const da = new Date(a['FECHA DE PROGRAMACION']);
        const db = new Date(b['FECHA DE PROGRAMACION']);
        const ta = isNaN(da.getTime()) ? -Infinity : da.getTime();
        const tb = isNaN(db.getTime()) ? -Infinity : db.getTime();
        return tb - ta;
      });

      const tbody = raiz.querySelector('#tablaServiciosCulminados tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const completo = datosFinalesCompletos(f);
        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        tr.innerHTML = `
          <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
          <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
          <td>${f['BOOKING'] || ''}</td>
          <td>${f['CONDUCTOR'] || ''}</td>
          <td>${f['PLACA TRACTO'] || ''}</td>
          <td>${f['TIPO DE CARGA'] || ''}</td>
          <td>${f['LUGAR DE POSICIONAMIENTO 1'] || ''}</td>
          <td>${f['DESTINO 1'] || ''}</td>
          <td>${f['ESTADO'] || ''}</td>
          <td style="text-align:center;">
            ${completo
              ? '<span class="badge-datos completo" title="Doble clic para revisar el detalle">Completo</span>'
              : '<span class="badge-datos incompleto" title="Doble clic para completar el detalle">Datos incompletos</span>'}
          </td>`;

        tr.querySelector('.badge-datos').addEventListener('dblclick', function (ev) {
          ev.stopPropagation();
          FormConsolidadoServicio.abrir(f._fila, 'CULMINADO');
        });
        tr.addEventListener('dblclick', function () {
          FormConsolidadoServicio.abrir(f._fila, 'CULMINADO');
        });

        tbody.appendChild(tr);
      });
    }

    ['filtroCulmDesde', 'filtroCulmHasta', 'filtroCulmDatos'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    raiz.querySelector('#btnBorrarFiltroCulm').addEventListener('click', function () {
      raiz.querySelector('#filtroCulmDesde').value = '';
      raiz.querySelector('#filtroCulmHasta').value = '';
      raiz.querySelector('#filtroCulmDatos').value = '';
      cargar();
    });

    raiz.querySelector('#btnCerrarServiciosCulminados').addEventListener('click', cerrarPanel);

    cargar();
  }
};
