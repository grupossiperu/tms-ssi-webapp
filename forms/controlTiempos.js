/**
 * forms/controlTiempos.js  (v112)
 * -------------------------------------------------------------------------
 * Resultados → pestaña "Control de tiempos".
 * Solo servicios con el seguimiento COMPLETO (_seguimientoCompleto).
 * Tiempos (horas):
 *  - Planta: llegada planta → salida planta.
 *  - Ida con TM: salida depósito (SALIDA VACIO) → llegada planta; sin TM = − T MUERTOS 1.
 *  - Retorno con TM: salida planta → llegada cola puerto; sin TM = − T MUERTOS 2.
 *  - Tiempos muertos ida / retorno: T MUERTOS 1 / 2 del seguimiento.
 *  - Gasificado: inicio → fin gasificado (aparte, no se suma a nada).
 *  - Viaje completo: inicio de ruta → fin de ruta.
 * Tiempos negativos o > 200 h no entran al promedio ("fechas a revisar").
 * Datos: listarConSeguimiento (backend v112 agrega _inicioRuta, _finRuta, _tm1, _tm2).
 * -------------------------------------------------------------------------
 */
const FormControlTiempos = {
  _datos: null,
  IND: [
    { k: 'planta', t: 'Tiempo en planta', d: 'llegada → salida de planta' },
    { k: 'idaCon', t: 'Ida (con t. muertos)', d: 'salida depósito → llegada planta' },
    { k: 'idaSin', t: 'Ida (sin t. muertos)', d: 'ida − tiempos muertos de ida' },
    { k: 'tm1', t: 'T. muertos de ida', d: 'registrados en el seguimiento' },
    { k: 'retCon', t: 'Retorno (con t. muertos)', d: 'salida planta → llegada cola puerto' },
    { k: 'retSin', t: 'Retorno (sin t. muertos)', d: 'retorno − tiempos muertos de retorno' },
    { k: 'tm2', t: 'T. muertos de retorno', d: 'registrados en el seguimiento' },
    { k: 'gas', t: 'Gasificado', d: 'inicio → fin del gasificado' },
    { k: 'total', t: 'Viaje completo', d: 'inicio de ruta → fin de ruta' }
  ],

  _f: function (v) { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? null : d; },
  _h: function (a, b) { a = this._f(a); b = this._f(b); return (a && b) ? (b - a) / 3600000 : null; },
  _n: function (v) { const s = String(v == null ? '' : v).replace(',', '.').trim(); if (s === '' || s === '-') return null; const n = Number(s); return isNaN(n) ? null : n; },
  _ok: function (h) { return h !== null && h >= 0 && h <= 200; },
  _txt: function (h) {
    if (h === null || h === undefined || isNaN(h)) return '—';
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return '<span title="' + hh + ' h ' + String(mm).padStart(2, '0') + ' min">' + h.toFixed(1) + ' h</span>';
  },

  /** Calcula los tiempos de un viaje. Devuelve {valores:{k:h}, revisar:[k...]} */
  _calc: function (x) {
    const self = this, v = {}, rev = [];
    const put = function (k, h) { if (h === null) return; if (self._ok(h)) v[k] = h; else rev.push(k); };
    const tm1 = this._n(x._tm1), tm2 = this._n(x._tm2);
    put('planta', this._h(x._llegadaPlanta, x._salidaPlanta));
    const ida = this._h(x._salidaVacio, x._llegadaPlanta);
    put('idaCon', ida);
    if (ida !== null) put('idaSin', ida - (tm1 || 0));
    if (tm1 !== null) put('tm1', tm1);
    const ret = this._h(x._salidaPlanta, x._llegadaPuerto);
    put('retCon', ret);
    if (ret !== null) put('retSin', ret - (tm2 || 0));
    if (tm2 !== null) put('tm2', tm2);
    put('gas', this._h(x._gasIni, x._gasFin));
    put('total', this._h(x._inicioRuta, x._finRuta));
    return { valores: v, revisar: rev };
  },

  mostrar: async function (cont) {
    const self = this;
    self._cont = cont;
    cont.innerHTML = `
      <style>
        .ct-barra { display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap:10px; align-items:end; margin-bottom:10px; }
        .ct-barra .campo { margin:0; }
        .ct-kpis { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap:10px; margin-bottom:12px; }
        .ct-kpi { border-radius:10px; padding:8px 11px; background:#f1f5f9; border-left:5px solid #1c3a5e; }
        .ct-kpi.gas { border-left-color:#7c3aed; background:#f5f3ff; } .ct-kpi.tot { border-left-color:#16a34a; background:#f0fdf4; } .ct-kpi.tm { border-left-color:#d97706; background:#fffbeb; }
        .ct-kpi span { display:block; font-size:.66rem; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:.3px; }
        .ct-kpi b { font-size:1.2rem; color:#1c3a5e; } .ct-kpi small { display:block; font-size:.68rem; color:#64748b; }
        .ct-card { background:#fff; border:1px solid #dbe2ea; border-radius:10px; padding:10px 12px; margin-bottom:12px; }
        .ct-card h3 { margin:0 0 8px; font-size:.86rem; color:#1c3a5e; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
        .ct-t { width:100%; table-layout:fixed; border-collapse:collapse; font-size:.76rem; }
        .ct-t th, .ct-t td { padding:5px 5px; border-bottom:1px solid #eef2f7; text-align:right; overflow-wrap:anywhere; }
        .ct-t th:first-child, .ct-t td:first-child { text-align:left; width:22%; }
        .ct-t th { color:#1c3a5e; font-size:.69rem; background:#f8fafc; }
        .ct-t tr.tot td { font-weight:700; background:#eef4fb; }
        .ct-t td small { color:#94a3b8; }
        .ct-seg { display:inline-flex; border:1px solid #cbd5e1; border-radius:9px; overflow:hidden; }
        .ct-seg button { border:0; background:#fff; padding:5px 11px; font-size:.78rem; cursor:pointer; color:#334155; }
        .ct-seg button.act { background:#1c3a5e; color:#fff; }
        @media (max-width: 1100px) { .ct-barra, .ct-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } }
      </style>
      <div class="ct-barra">
        <div class="campo"><label>Impo / Expo</label><div id="ctTipo"></div></div>
        <div class="campo"><label>Conductor</label><div id="ctCond"></div></div>
        <div class="campo"><label>Planta</label><div id="ctPlanta"></div></div>
        <div class="campo"><label>Destino</label><div id="ctDest"></div></div>
        <div class="campo"><label>Desde (fecha del servicio)</label><input type="date" id="ctDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="ctHasta"></div>
      </div>
      <div id="ctAviso" style="font-size:.8rem;color:#64748b;margin:-2px 0 10px">Cargando…</div>
      <div class="ct-kpis" id="ctKpis"></div>
      <div class="ct-card">
        <h3><span>Promedios por grupo (horas)</span>
          <span class="ct-seg" id="ctPor"><button data-p="PLANTA" class="act">Por planta</button><button data-p="DESTINO">Por destino</button><button data-p="CONDUCTOR">Por conductor</button><button data-p="TIPO">Por Impo/Expo</button><button data-p="VIAJE">Viaje por viaje</button></span></h3>
        <div id="ctTabla"></div>
      </div>
      <div class="ct-card" id="ctRevCard"><h3><span>Viajes con fechas a revisar (no entran al promedio)</span></h3><div id="ctRev"></div></div>`;
    const $ = id => cont.querySelector('#' + id);
    const repintar = () => self._pintar();
    self._ms = {
      tipo: crearMultiSelect($('ctTipo'), { textoTodos: 'Todos', onChange: repintar }),
      cond: crearMultiSelect($('ctCond'), { textoTodos: 'Todos', onChange: repintar }),
      planta: crearMultiSelect($('ctPlanta'), { textoTodos: 'Todas', onChange: repintar }),
      dest: crearMultiSelect($('ctDest'), { textoTodos: 'Todos', onChange: repintar })
    };
    ['ctDesde', 'ctHasta'].forEach(id => $(id).addEventListener('change', repintar));
    self._por = 'PLANTA';
    $('ctPor').addEventListener('click', function (ev) {
      const b = ev.target.closest('button[data-p]'); if (!b) return;
      self._por = b.dataset.p;
      $('ctPor').querySelectorAll('button').forEach(x => x.classList.toggle('act', x === b));
      self._pintar();
    });
    let r = null;
    try { r = await llamarBackend('listarConSeguimiento', { origen: 'controlTiempos' }); } catch (e) { r = null; }
    const lista = r ? Object.values(r).filter(x => x && typeof x === 'object' && x['CODIGO SERVICIO']) : [];
    if (!lista.length) { $('ctAviso').innerHTML = '<span style="color:#b91c1c">No se pudo cargar la información del seguimiento.</span>'; return; }
    const U = s => String(s || '').trim().toUpperCase();
    self._datos = lista.filter(x => x._seguimientoCompleto === true).map(function (x) {
      const c = self._calc(x);
      return { x: x, v: c.valores, rev: c.revisar, tipo: U(x['TIPO DE CARGA']) || 'SIN TIPO', cond: U(x['CONDUCTOR']) || 'SIN CONDUCTOR',
        planta: U(x['PACKING']) || 'SIN PLANTA', dest: U(x['DESTINO 1']) || 'SIN DESTINO', fecha: self._f(x['FECHA DE PROGRAMACION']) };
    });
    self._totalServicios = lista.length;
    const op = k => Array.from(new Set(self._datos.map(d => d[k]))).sort();
    self._ms.tipo.setOpciones(op('tipo'));
    self._ms.cond.setOpciones(op('cond'));
    self._ms.planta.setOpciones(op('planta'));
    self._ms.dest.setOpciones(op('dest'));
    self._pintar();
  },

  _vis: function () {
    const self = this, $ = id => self._cont.querySelector('#' + id);
    const de = $('ctDesde').value, ha = $('ctHasta').value;
    const dDe = de ? new Date(de + 'T00:00:00') : null, dHa = ha ? new Date(ha + 'T23:59:59') : null;
    return (self._datos || []).filter(d => self._ms.tipo.cumple(d.tipo) && self._ms.cond.cumple(d.cond) && self._ms.planta.cumple(d.planta) && self._ms.dest.cumple(d.dest) &&
      (!dDe || (d.fecha && d.fecha >= dDe)) && (!dHa || (d.fecha && d.fecha <= dHa)));
  },

  _est: function (arr, k) {
    const xs = arr.map(d => d.v[k]).filter(h => h !== undefined);
    if (!xs.length) return null;
    const s = xs.reduce((a, b) => a + b, 0);
    return { n: xs.length, prom: s / xs.length, min: Math.min.apply(null, xs), max: Math.max.apply(null, xs) };
  },

  _pintar: function () {
    const self = this, $ = id => self._cont.querySelector('#' + id);
    if (!self._datos) return;
    if (typeof _refrescarSnapshotFormulario === 'function') setTimeout(_refrescarSnapshotFormulario, 0);
    const vis = self._vis();
    $('ctAviso').innerHTML = '<b>' + vis.length + '</b> viajes con seguimiento completo en el filtro (de ' + self._datos.length + ' completos y ' + self._totalServicios + ' servicios). Pasa el mouse sobre una hora para verla en h:min.';
    // KPIs
    $('ctKpis').innerHTML = self.IND.map(function (i) {
      const e = self._est(vis, i.k);
      const cls = i.k === 'gas' ? ' gas' : i.k === 'total' ? ' tot' : (i.k === 'tm1' || i.k === 'tm2') ? ' tm' : '';
      return '<div class="ct-kpi' + cls + '" title="' + esc(i.d) + '"><span>' + i.t + '</span><b>' + (e ? self._txt(e.prom) : '—') + '</b>' +
        '<small>' + (e ? e.n + ' viajes · mín ' + e.min.toFixed(1) + ' · máx ' + e.max.toFixed(1) : 'sin datos') + '</small><small>' + esc(i.d) + '</small></div>';
    }).join('');
    // Tabla por grupo o viaje por viaje
    const cab = '<tr><th>' + ({ PLANTA: 'Planta', DESTINO: 'Destino', CONDUCTOR: 'Conductor', TIPO: 'Impo / Expo', VIAJE: 'Viaje' })[self._por] + '</th><th>Viajes</th>' +
      self.IND.map(i => '<th title="' + esc(i.d) + '">' + i.t.replace(' (con t. muertos)', ' c/TM').replace(' (sin t. muertos)', ' s/TM').replace('Tiempo en ', '') + '</th>').join('') + '</tr>';
    let filas = '';
    if (self._por === 'VIAJE') {
      const ord = vis.slice().sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
      filas = ord.map(d => '<tr><td><b>' + esc(d.x['CODIGO SERVICIO']) + '</b><br><small>' + esc(d.planta) + ' · ' + esc(d.dest) + '<br>' + esc(d.cond) + '</small></td><td>1</td>' +
        self.IND.map(i => '<td>' + (d.v[i.k] !== undefined ? self._txt(d.v[i.k]) : (d.rev.indexOf(i.k) >= 0 ? '<span style="color:#b45309" title="Fechas a revisar">⚠</span>' : '—')) + '</td>').join('') + '</tr>').join('');
    } else {
      const key = { PLANTA: 'planta', DESTINO: 'dest', CONDUCTOR: 'cond', TIPO: 'tipo' }[self._por];
      const g = {};
      vis.forEach(d => { (g[d[key]] = g[d[key]] || []).push(d); });
      filas = Object.keys(g).sort((a, b) => g[b].length - g[a].length || a.localeCompare(b)).map(function (n) {
        return '<tr><td>' + esc(n) + '</td><td>' + g[n].length + '</td>' + self.IND.map(function (i) {
          const e = self._est(g[n], i.k);
          return '<td>' + (e ? self._txt(e.prom) + (e.n < g[n].length ? '<br><small>' + e.n + ' v.</small>' : '') : '—') + '</td>';
        }).join('') + '</tr>';
      }).join('');
      filas += '<tr class="tot"><td>TOTAL</td><td>' + vis.length + '</td>' + self.IND.map(function (i) { const e = self._est(vis, i.k); return '<td>' + (e ? self._txt(e.prom) : '—') + '</td>'; }).join('') + '</tr>';
    }
    $('ctTabla').innerHTML = vis.length ? '<table class="ct-t"><thead>' + cab + '</thead><tbody>' + filas + '</tbody></table>' : '<p style="color:#64748b">No hay viajes con estos filtros.</p>';
    // Fechas a revisar
    const rev = vis.filter(d => d.rev.length);
    const nom = {}; self.IND.forEach(i => { nom[i.k] = i.t; });
    $('ctRevCard').style.display = rev.length ? '' : 'none';
    $('ctRev').innerHTML = rev.length ? '<table class="ct-t"><thead><tr><th>Código</th><th style="text-align:left">Conductor</th><th style="text-align:left">Planta / destino</th><th style="text-align:left;width:40%">Tiempo con fechas a revisar</th></tr></thead><tbody>' +
      rev.map(d => '<tr><td><b>' + esc(d.x['CODIGO SERVICIO']) + '</b></td><td style="text-align:left">' + esc(d.cond) + '</td><td style="text-align:left">' + esc(d.planta) + ' · ' + esc(d.dest) + '</td><td style="text-align:left">' + d.rev.map(k => nom[k]).join(', ') + '</td></tr>').join('') +
      '</tbody></table><p style="font-size:.76rem;color:#64748b;margin:6px 0 0">Corrige las fechas en Datos del viaje → Seguimiento y estos viajes entrarán al promedio.</p>' : '';
  }
};
