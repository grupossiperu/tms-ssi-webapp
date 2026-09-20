/**
 * forms/controlCombustible.js
 * -------------------------------------------------------------------------
 * Módulo "Control de Combustible" (botón de la pantalla principal).
 *
 * Lista TODOS los servicios (sin importar el estado) con filtros por Placa,
 * Estado, Cliente y Conductor (además del rango de fechas Desde/Hasta).
 *
 * Por cada servicio se muestra: Fecha, Cliente, Conductor, Placa, Booking,
 * Reefer o Seco, Retiro, Fecha y Hora de Posicionamiento, Galones Tracto
 * (lo que debió abastecer) y el detalle de combustible a completar:
 *   - Fecha y Hora de Abastecimiento
 *   - Cantidad Abastecida Real
 *   - Fecha y Hora de Tanque Inicial
 *   - Cantidad de Galones Iniciales
 *   - Fecha y Hora de Final de Viaje
 *   - Cantidad de Galones Finales
 * junto con un botón "Guardar" que graba todo de una sola vez, atado a la
 * fila del servicio (columna SERVICIOS['COMBUSTIBLE REGISTRADO'] = true).
 * Una vez grabado, las casillas quedan sombreadas y bloqueadas para no
 * poder volver a completarlas.
 * -------------------------------------------------------------------------
 */
const FormControlCombustible = {

  ESTADOS: ['PROGRAMADO', 'EN RUTA', 'CULMINADO', 'FALSO FLETE', 'CANCELADO'],

  abrir: async function () {
    const opcionesEstado = this.ESTADOS.map(function (e) {
      const etiqueta = e.charAt(0) + e.slice(1).toLowerCase();
      return `<option value="${e}">${etiqueta}</option>`;
    }).join('');

    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Desde</label><input type="text" id="filtroComDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroComHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Placa</label><select id="filtroComPlaca"><option value="">Todas</option></select></div>
        <div class="campo"><label>Estado</label><select id="filtroComEstado"><option value="">Todos</option>${opcionesEstado}</select></div>
        <div class="campo"><label>Cliente</label><select id="filtroComCliente"><option value="">Todos</option></select></div>
        <div class="campo"><label>Conductor</label><select id="filtroComConductor"><option value="">Todos</option></select></div>
        <button class="boton-secundario" id="btnBorrarFiltroCom">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaControlCombustible">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Conductor</th><th>Placa</th><th>Booking</th>
            <th>Reefer o Seco</th><th>Retiro</th><th>Fecha y Hora de Posicionamiento</th>
            <th>Galones Tracto</th>
            <th>Fecha y Hora de Abastecimiento</th><th>Cantidad Abastecida Real</th>
            <th>Fecha y Hora de Tanque Inicial</th><th>Cantidad Galones Iniciales</th>
            <th>Fecha y Hora de Final de Viaje</th><th>Cantidad Galones Finales</th>
            <th></th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarControlCombustible">Cerrar</button>
      </div>`;

    abrirPanel('Control de Combustible', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _wire: function (raiz) {
    const ESTADOS = this.ESTADOS;
    let datosCompletos = [];

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
      return texto;
    }

    function formatoFechaHora(fecha, hora) {
      const f = formatoFecha(fecha);
      const h = formatoHora(hora);
      if (!f && !h) return '';
      if (!h) return f;
      return (f + ' ' + h).trim();
    }

    function esVerdadero(v) {
      return v === true || String(v).trim().toUpperCase() === 'TRUE' || String(v).trim().toUpperCase() === 'SI';
    }

    function aFechaISO(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function aHoraISO(v) {
      if (v === null || v === undefined || v === '') return '';
      const texto = String(v).trim();
      if (/^\d{1,2}:\d{2}/.test(texto)) return texto.slice(0, 5).padStart(5, '0');
      return '';
    }

    function aDatetimeLocalValue(fecha, hora) {
      const f = aFechaISO(fecha);
      if (!f) return '';
      const h = aHoraISO(hora) || '00:00';
      return f + 'T' + h;
    }

    function splitDatetimeLocal(valor) {
      if (!valor) return { fecha: '', hora: '' };
      const partes = String(valor).split('T');
      return { fecha: partes[0] || '', hora: (partes[1] || '').slice(0, 5) };
    }

    function poblarSelect(select, valores) {
      const actual = select.value;
      const opciones = valores.map(function (v) {
        return `<option value="${v}">${v}</option>`;
      }).join('');
      select.innerHTML = '<option value="">' + (select.dataset.todos || 'Todos') + '</option>' + opciones;
      if (valores.indexOf(actual) !== -1) select.value = actual;
    }

    function actualizarOpcionesFiltro() {
      const placas = Array.from(new Set(datosCompletos.map((f) => f['PLACA TRACTO']).filter(Boolean))).sort();
      const clientes = Array.from(new Set(datosCompletos.map((f) => f['CLIENTE PARA FACTURACIÓN']).filter(Boolean))).sort();
      const conductores = Array.from(new Set(datosCompletos.map((f) => f['CONDUCTOR']).filter(Boolean))).sort();
      poblarSelect(raiz.querySelector('#filtroComPlaca'), placas);
      poblarSelect(raiz.querySelector('#filtroComCliente'), clientes);
      poblarSelect(raiz.querySelector('#filtroComConductor'), conductores);
    }

    function crearFila(f) {
      const registrado = esVerdadero(f['COMBUSTIBLE REGISTRADO']);
      const tr = document.createElement('tr');
      tr.dataset.fila = f._fila;

      const valAbast = aDatetimeLocalValue(f['FECHA ABASTECIMIENTO'], f['HORA ABASTECIMIENTO']);
      const valTanque = aDatetimeLocalValue(f['FECHA TANQUE INICIAL'], f['HORA TANQUE INICIAL']);
      const valFinal = aDatetimeLocalValue(f['FECHA FINAL VIAJE'], f['HORA FINAL VIAJE']);
      const cantAbast = f['CANTIDAD ABASTECIDA REAL'] || '';
      const cantInicial = f['CANTIDAD GALONES INICIALES'] || '';
      const cantFinal = f['CANTIDAD GALONES FINALES'] || '';

      const dis = registrado ? 'disabled' : '';
      const estiloBloqueado = registrado ? 'background:#eceff1;color:#78838f;cursor:not-allowed;' : '';

      tr.innerHTML = `
        <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
        <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
        <td>${f['CONDUCTOR'] || ''}</td>
        <td>${f['PLACA TRACTO'] || ''}</td>
        <td>${f['BOOKING'] || ''}</td>
        <td>${f['REEFER O DRY'] || ''}</td>
        <td>${f['DEPOSITO DE RETIRO'] || ''}</td>
        <td>${formatoFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1'])}</td>
        <td style="text-align:right;">${f['GL TRACTO'] || ''}</td>
        <td><input type="datetime-local" style="${estiloBloqueado}" data-campo="abastecimiento" value="${valAbast}" ${dis}></td>
        <td><input type="number" step="0.01" min="0" style="width:90px;${estiloBloqueado}" data-campo="cantAbastecida" value="${cantAbast}" ${dis}></td>
        <td><input type="datetime-local" style="${estiloBloqueado}" data-campo="tanqueInicial" value="${valTanque}" ${dis}></td>
        <td><input type="number" step="0.01" min="0" style="width:90px;${estiloBloqueado}" data-campo="cantInicial" value="${cantInicial}" ${dis}></td>
        <td><input type="datetime-local" style="${estiloBloqueado}" data-campo="finalViaje" value="${valFinal}" ${dis}></td>
        <td><input type="number" step="0.01" min="0" style="width:90px;${estiloBloqueado}" data-campo="cantFinal" value="${cantFinal}" ${dis}></td>
        <td style="text-align:center;">
          ${registrado
            ? '<span class="badge-datos completo">Guardado</span>'
            : '<button type="button" class="boton-primario boton-chico btn-guardar-combustible">Guardar</button>'}
        </td>`;

      if (!registrado) {
        const btn = tr.querySelector('.btn-guardar-combustible');
        btn.addEventListener('click', async function () {
          const inputAbast = tr.querySelector('[data-campo="abastecimiento"]');
          const inputCantAbast = tr.querySelector('[data-campo="cantAbastecida"]');
          const inputTanque = tr.querySelector('[data-campo="tanqueInicial"]');
          const inputCantInicial = tr.querySelector('[data-campo="cantInicial"]');
          const inputFinal = tr.querySelector('[data-campo="finalViaje"]');
          const inputCantFinal = tr.querySelector('[data-campo="cantFinal"]');

          const abast = splitDatetimeLocal(inputAbast.value);
          const tanque = splitDatetimeLocal(inputTanque.value);
          const final = splitDatetimeLocal(inputFinal.value);

          const datos = {
            'FECHA ABASTECIMIENTO': abast.fecha,
            'HORA ABASTECIMIENTO': abast.hora,
            'CANTIDAD ABASTECIDA REAL': inputCantAbast.value,
            'FECHA TANQUE INICIAL': tanque.fecha,
            'HORA TANQUE INICIAL': tanque.hora,
            'CANTIDAD GALONES INICIALES': inputCantInicial.value,
            'FECHA FINAL VIAJE': final.fecha,
            'HORA FINAL VIAJE': final.hora,
            'CANTIDAD GALONES FINALES': inputCantFinal.value
          };

          btn.disabled = true;
          btn.textContent = 'Guardando...';
          const resp = await llamarBackend('grabarCombustible', { fila: f._fila, datos: datos });
          if (!resp || !resp.ok) {
            btn.disabled = false;
            btn.textContent = 'Guardar';
            mostrarMensaje((resp && resp.mensaje) || 'No se pudo grabar el combustible.', 'error');
            return;
          }
          Object.assign(f, datos);
          f['COMBUSTIBLE REGISTRADO'] = true;
          mostrarMensaje('Datos de combustible grabados.', 'exito');
          renderizar();
        });
      }

      return tr;
    }

    function renderizar() {
      const placa = raiz.querySelector('#filtroComPlaca').value;
      const estado = raiz.querySelector('#filtroComEstado').value;
      const cliente = raiz.querySelector('#filtroComCliente').value;
      const conductor = raiz.querySelector('#filtroComConductor').value;

      let filas = datosCompletos.slice();
      if (placa) filas = filas.filter((f) => (f['PLACA TRACTO'] || '') === placa);
      if (estado) filas = filas.filter((f) => String(f['ESTADO'] || '').trim().toUpperCase() === estado);
      if (cliente) filas = filas.filter((f) => (f['CLIENTE PARA FACTURACIÓN'] || '') === cliente);
      if (conductor) filas = filas.filter((f) => (f['CONDUCTOR'] || '') === conductor);

      filas.sort(function (a, b) {
        const da = new Date(a['FECHA DE PROGRAMACION']);
        const db = new Date(b['FECHA DE PROGRAMACION']);
        const ta = isNaN(da.getTime()) ? -Infinity : da.getTime();
        const tb = isNaN(db.getTime()) ? -Infinity : db.getTime();
        return tb - ta;
      });

      const tbody = raiz.querySelector('#tablaControlCombustible tbody');
      tbody.innerHTML = '';

      if (!filas.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="16" style="text-align:center; color:#8b95a1; padding:18px;">No hay servicios con estos filtros.</td>';
        tbody.appendChild(tr);
        return;
      }

      filas.forEach(function (f) {
        tbody.appendChild(crearFila(f));
      });
    }

    async function cargar() {
      const filtros = {
        fechaDesde: raiz.querySelector('#filtroComDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroComHasta').value.trim()
      };
      datosCompletos = await llamarBackend('listarServiciosPendientes', filtros);
      actualizarOpcionesFiltro();
      renderizar();
    }

    ['filtroComDesde', 'filtroComHasta'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    ['filtroComPlaca', 'filtroComEstado', 'filtroComCliente', 'filtroComConductor'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', renderizar);
    });

    raiz.querySelector('#btnBorrarFiltroCom').addEventListener('click', function () {
      raiz.querySelector('#filtroComDesde').value = '';
      raiz.querySelector('#filtroComHasta').value = '';
      raiz.querySelector('#filtroComPlaca').value = '';
      raiz.querySelector('#filtroComEstado').value = '';
      raiz.querySelector('#filtroComCliente').value = '';
      raiz.querySelector('#filtroComConductor').value = '';
      cargar();
    });

    raiz.querySelector('#btnCerrarControlCombustible').addEventListener('click', cerrarPanel);

    cargar();
  }
};
