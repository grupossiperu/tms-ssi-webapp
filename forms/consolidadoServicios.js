/**
 * forms/consolidadoServicios.js
 * -------------------------------------------------------------------------
 * Módulo "Consolidado de Servicios": lista los servicios CULMINADOS con su
 * estado de "Datos finales" (Completo / Datos incompletos) y un botón
 * "Completar" / "Revisar" que abre el detalle (FormConsolidadoServicio).
 * Mientras "Datos finales" no diga Completo, el servicio no aparece como
 * pendiente de facturar.
 *
 * Filtros (los mismos de Acarreo): Conductor, Cliente y Planta con
 * selección múltiple, Booking, Desde / Hasta y Datos. Las fechas se
 * consultan al servidor; el resto se filtra en el navegador.
 * -------------------------------------------------------------------------
 */
const FormConsolidadoServicios = {

  _xlsx: function () {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (ok, mal) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => ok(window.XLSX); s.onerror = () => mal(new Error('No se pudo cargar el componente de Excel.'));
      document.head.appendChild(s);
    });
  },

  abrir: async function () {
    const html = `
      <style>
        .cons-filtros select, .cons-filtros input { max-width: 210px; }
        .cons-filtros #filtroConsDesde, .cons-filtros #filtroConsHasta, .cons-filtros #filtroConsDatos { max-width: 130px; }
        .cons-wrap { max-height: calc(74vh - 230px); min-height: 220px; overflow-y: auto; overflow-x: hidden; }
        #tablaConsolidadoServicios { width: 100%; table-layout: fixed; font-size: .76rem; }
        #tablaConsolidadoServicios th, #tablaConsolidadoServicios td { padding: 5px 6px; white-space: normal; overflow-wrap: anywhere; vertical-align: top; }
        #tablaConsolidadoServicios th { font-size: .72rem; position: sticky; top: 0; z-index: 1; }
        #tablaConsolidadoServicios .badge-datos { font-size: .66rem; padding: 2px 6px; display: inline-block; overflow-wrap: normal; }
        #tablaConsolidadoServicios td .sub { color: #64748b; font-size: .68rem; margin-top: 2px; }
        .cons-cuenta { font-size: .8rem; color: #64748b; margin: 0 0 6px; }
      </style>
      <div class="barra-filtros cons-filtros">
        <div class="campo"><label>Conductor</label><div id="msConsConductor"></div></div>
        <div class="campo"><label>Cliente</label><div id="msConsCliente"></div></div>
        <div class="campo"><label>Planta (packing)</label><div id="msConsPacking"></div></div>
        <div class="campo"><label>Booking</label>
          <input type="text" id="filtroConsBooking" placeholder="Escriba el booking" autocomplete="off">
        </div>
        <div class="campo"><label>Desde</label><input type="text" id="filtroConsDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroConsHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Datos</label>
          <select id="filtroConsDatos">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Datos incompletos</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltroCons">Borrar filtro</button>
      </div>
      <div class="cons-cuenta" id="consCuenta"></div>
      <div class="cons-wrap">
        <table class="tabla-lista" id="tablaConsolidadoServicios">
          <colgroup>
            <col style="width:8%"><col style="width:7%"><col style="width:11%"><col style="width:15%"><col style="width:7%">
            <col style="width:10%"><col style="width:12%"><col style="width:10%"><col style="width:10%"><col style="width:10%">
          </colgroup>
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Booking</th><th>Conductor</th><th>Tracto</th>
            <th>Tipo de carga</th><th>Destino</th><th>Planta</th><th>Datos finales</th><th></th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end; gap:8px;">
        <button class="boton-primario" id="btnExcelConsolidado" title="Descarga en Excel todos los datos del consolidado de los servicios que se ven en la lista">⬇ Descargar Excel</button>
        <button class="boton-secundario" id="btnCerrarConsolidadoServicios">Cerrar</button>
      </div>`;

    abrirPanel('Consolidado de Servicios', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _wire: function (raiz) {
    let filasCache = [];
    const mayus = function (v) { return String(v === null || v === undefined ? '' : v).trim().toUpperCase(); };
    const esVerdadero = function (v) { return v === true || mayus(v) === 'TRUE' || mayus(v) === 'SI'; };
    const completo = function (f) { return esVerdadero(f['CONSOLIDADO REGISTRADO']); };
    const unicos = function (campo) {
      return Array.from(new Set(filasCache.map(f => mayus(f[campo])).filter(v => v !== '' && v !== '-')))
        .sort((a, b) => a.localeCompare(b, 'es'));
    };
    const refrescarSnapshot = function () {
      if (typeof _refrescarSnapshotFormulario === 'function') _refrescarSnapshotFormulario();
    };

    const msConductor = crearMultiSelect(raiz.querySelector('#msConsConductor'), { onChange: pintar });
    const msCliente = crearMultiSelect(raiz.querySelector('#msConsCliente'), { onChange: pintar });
    const msPacking = crearMultiSelect(raiz.querySelector('#msConsPacking'), { textoTodos: 'Todas', onChange: pintar });

    async function cargar() {
      const pedir = estado => llamarBackend('listarServiciosPendientes', {
        estado: estado,
        fechaDesde: raiz.querySelector('#filtroConsDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroConsHasta').value.trim()
      });
      // Culminados + falsos fletes (también tienen gastos, combustible, bono y a veces se facturan).
      const [filas, falsos] = await Promise.all([pedir('CULMINADO'), pedir('FALSO FLETE')]);
      if (!Array.isArray(filas)) {
        mostrarMensaje((filas && filas.mensaje) || 'No se pudo cargar la lista de servicios.', 'error');
        return;
      }
      filas.forEach(f => { f._estadoServ = 'CULMINADO'; });
      (Array.isArray(falsos) ? falsos : []).forEach(f => { f._estadoServ = 'FALSO FLETE'; filas.push(f); });
      filasCache = filas;
      msConductor.setOpciones(unicos('CONDUCTOR'));
      msCliente.setOpciones(unicos('CLIENTE PARA FACTURACIÓN'));
      msPacking.setOpciones(unicos('PACKING'));
      pintar();
    }

    let visibles = [];
    function pintar() {
      const booking = mayus(raiz.querySelector('#filtroConsBooking').value);
      const datos = raiz.querySelector('#filtroConsDatos').value;

      const filas = filasCache.filter(function (f) {
        if (!msConductor.cumple(mayus(f['CONDUCTOR']))) return false;
        if (!msCliente.cumple(mayus(f['CLIENTE PARA FACTURACIÓN']))) return false;
        if (!msPacking.cumple(mayus(f['PACKING']))) return false;
        if (booking && mayus(f['BOOKING']).indexOf(booking) === -1) return false;
        if (datos === 'completo' && !completo(f)) return false;
        if (datos === 'incompleto' && completo(f)) return false;
        return true;
      }).sort(function (a, b) {
        // Pendientes de completar primero; dentro de cada grupo, la fecha más reciente arriba.
        const ca = completo(a) ? 1 : 0, cb = completo(b) ? 1 : 0;
        if (ca !== cb) return ca - cb;
        const da = _aFecha(a['FECHA DE PROGRAMACION']), db = _aFecha(b['FECHA DE PROGRAMACION']);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });

      visibles = filas;
      const pendientes = filas.filter(f => !completo(f)).length;
      raiz.querySelector('#consCuenta').textContent = filas.length + ' servicio' + (filas.length === 1 ? '' : 's') +
        ' (culminados y falsos fletes) · ' + pendientes + ' por completar';

      const tbody = raiz.querySelector('#tablaConsolidadoServicios tbody');
      tbody.innerHTML = '';
      if (!filas.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#8b95a1; padding:18px;">No hay servicios culminados ni falsos fletes con estos filtros.</td></tr>';
      }
      filas.forEach(function (f) {
        const ok = completo(f);
        const d2 = (f['DESTINO 2'] && String(f['DESTINO 2']).trim() !== '-') ? String(f['DESTINO 2']) : '';
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + esc(formatoFecha(f['FECHA DE PROGRAMACION'], '')) + '</td>' +
          '<td>' + esc(f['CLIENTE PARA FACTURACIÓN']) + '</td>' +
          '<td>' + esc(f['BOOKING']) + (f._estadoServ === 'FALSO FLETE' ? '<div><span class="badge-datos incompleto" style="background:#fee2e2;color:#b91c1c">FALSO FLETE</span></div>' : '') + '</td>' +
          '<td>' + esc(f['CONDUCTOR']) + '</td>' +
          '<td>' + esc(f['PLACA TRACTO']) + '</td>' +
          '<td>' + esc(f['TIPO DE CARGA']) + '</td>' +
          '<td>' + esc(f['DESTINO 1']) + (d2 ? '<div class="sub">+ ' + esc(d2) + '</div>' : '') + '</td>' +
          '<td>' + esc(f['PACKING']) + '</td>' +
          '<td style="text-align:center;">' + (ok
            ? '<span class="badge-datos completo">Completo</span>'
            : '<span class="badge-datos incompleto">Datos incompletos</span>') + '</td>' +
          '<td style="text-align:center;"><button type="button" class="boton-primario boton-chico btn-completar-consolidado">' +
            (ok ? 'Revisar' : 'Completar') + '</button></td>';
        tr.querySelector('.btn-completar-consolidado').addEventListener('click', function (ev) {
          ev.stopPropagation();
          FormConsolidadoServicio.abrir(f._fila, f._estadoServ || 'CULMINADO');
        });
        tbody.appendChild(tr);
      });
      refrescarSnapshot();
    }

    ['filtroConsDesde', 'filtroConsHasta'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });
    raiz.querySelector('#filtroConsDatos').addEventListener('change', pintar);
    let espera = null;
    raiz.querySelector('#filtroConsBooking').addEventListener('input', function () {
      clearTimeout(espera);
      espera = setTimeout(pintar, 250);
    });
    raiz.querySelector('#btnBorrarFiltroCons').addEventListener('click', function () {
      msConductor.limpiar(); msCliente.limpiar(); msPacking.limpiar();
      ['filtroConsDesde', 'filtroConsHasta', 'filtroConsBooking', 'filtroConsDatos'].forEach(function (id) {
        raiz.querySelector('#' + id).value = '';
      });
      cargar();
    });
    raiz.querySelector('#btnCerrarConsolidadoServicios').addEventListener('click', cerrarPanel);
    raiz.querySelector('#btnExcelConsolidado').addEventListener('click', async function () {
      const btn = this;
      if (!visibles.length) { mostrarMensaje('No hay servicios en la lista para descargar.', 'error'); return; }
      btn.disabled = true; const txt = btn.textContent; btn.textContent = 'Preparando…';
      try {
        const [r, X] = await Promise.all([llamarBackend('consolidadoExportar', {}), FormConsolidadoServicios._xlsx()]);
        if (!r || !r.ok) throw new Error((r && r.mensaje) || 'No se pudo leer el consolidado.');
        const cols = r.columnas || [];
        const iFila = cols.indexOf('FILA SERVICIO'), iCod = cols.findIndex(c => /^CODIGO (DEL )?SERVICIO$/i.test(c));
        const porFila = {}, porCod = {};
        (r.filas || []).forEach(function (row) {
          if (iFila >= 0 && row[iFila] !== '' && row[iFila] !== null) porFila[String(row[iFila]).trim()] = row;
          if (iCod >= 0 && row[iCod]) porCod[mayus(row[iCod])] = row;
        });
        const conCons = [], sinCons = [];
        visibles.forEach(function (f) {
          const row = porCod[mayus(f['CODIGO SERVICIO'])] || porFila[String(f._fila)];
          if (row) conCons.push(row);
          else sinCons.push([formatoFecha(f['FECHA DE PROGRAMACION'], ''), f['CODIGO SERVICIO'] || '', f['CLIENTE PARA FACTURACIÓN'] || '', f['BOOKING'] || '', f['N° CONTENEDOR'] || '',
            f['CONDUCTOR'] || '', f['PLACA TRACTO'] || '', f['DESTINO 1'] || '', f['PACKING'] || '', f._estadoServ || '']);
        });
        const wb = X.utils.book_new();
        const ws = X.utils.aoa_to_sheet([cols].concat(conCons));
        ws['!cols'] = cols.map(c => ({ wch: Math.min(40, Math.max(10, String(c).length + 2)) }));
        ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: conCons.length, c: Math.max(0, cols.length - 1) } }) };
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
        X.utils.book_append_sheet(wb, ws, 'Consolidado');
        if (sinCons.length) {
          const enc = ['FECHA', 'CODIGO SERVICIO', 'CLIENTE', 'BOOKING', 'CONTENEDOR', 'CONDUCTOR', 'TRACTO', 'DESTINO', 'PLANTA', 'ESTADO SERVICIO'];
          const ws2 = X.utils.aoa_to_sheet([enc].concat(sinCons));
          ws2['!cols'] = enc.map(() => ({ wch: 18 }));
          X.utils.book_append_sheet(wb, ws2, 'Sin consolidado');
        }
        const hoy = new Date(); const p2 = n => String(n).padStart(2, '0');
        X.writeFile(wb, 'Consolidado_servicios_' + hoy.getFullYear() + p2(hoy.getMonth() + 1) + p2(hoy.getDate()) + '.xlsx');
        mostrarMensaje('Excel descargado: ' + conCons.length + ' viaje(s) con consolidado' + (sinCons.length ? ' y ' + sinCons.length + ' sin consolidado (hoja aparte)' : '') + '.', 'exito');
      } catch (e) {
        mostrarMensaje(e.message || String(e), 'error');
      } finally { btn.disabled = false; btn.textContent = txt; }
    });

    cargar();
  }
};
