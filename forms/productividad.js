/**
 * forms/productividad.js  (17/11/2026)
 * -------------------------------------------------------------------------
 * Resultados → pestaña "Productividad de conductores".
 * Une, por conductor y período (fecha del servicio):
 *  - liqDatos: viajes del consolidado (incluye tramos -T<n>), km, bono, galones.
 *  - listarConSeguimiento {origen:'controlTiempos'}: horas de viaje (inicio→fin de
 *    ruta), planta, ida/retorno, tiempos muertos (FormControlTiempos._calc).
 *  - cobranzaDatos: lo facturado por código (valor de venta, por moneda).
 *  - descuentosListar: descuentos aplicados (S/) por quincena del período.
 *  - cierreListar: km/gal con lectura de sonda (si existe).
 * Índice de tiempo = promedio de (horas del viaje ÷ promedio de la flota al mismo
 * destino) − 1 → negativo = más rápido que la flota.
 * -------------------------------------------------------------------------
 */
const FormProductividad = {
  _f: function (v) { if (!v) return null; if (v instanceof Date) return v; const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); const d = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (d) return new Date(+d[3], +d[2] - 1, +d[1]); const x = new Date(v); return isNaN(x.getTime()) ? null : x; },
  _iso: function (d) { return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : ''; },
  _m: function (n, d) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }); },
  _h: function (h) { return h === null || h === undefined || isNaN(h) ? '—' : h.toFixed(1) + ' h'; },
  _pct: function (p) { if (p === null || p === undefined || isNaN(p)) return '—'; const v = Math.round(p * 100); return '<span style="color:' + (v > 5 ? '#b91c1c' : v < -5 ? '#15803d' : '#475569') + ';font-weight:700">' + (v > 0 ? '+' : '') + v + '%</span>'; },
  _U: s => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase(),

  mostrar: async function (cont) {
    const self = this;
    self._cont = cont;
    const hoy = new Date(), ini = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    cont.innerHTML = `
      <style>
        .pr-barra{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:end;margin-bottom:10px}.pr-barra .campo{margin:0}
        .pr-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px}
        .pr-kpi{border-radius:10px;padding:8px 11px;background:#f1f5f9;border-left:5px solid #1c3a5e}.pr-kpi span{display:block;font-size:.66rem;text-transform:uppercase;color:#64748b;font-weight:700}
        .pr-kpi b{font-size:1.15rem;color:#1c3a5e}.pr-kpi small{display:block;font-size:.68rem;color:#64748b}
        .pr-card{background:#fff;border:1px solid #dbe2ea;border-radius:10px;padding:10px 12px;margin-bottom:12px}
        .pr-card h3{margin:0 0 8px;font-size:.86rem;color:#1c3a5e;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
        .pr-t{width:100%;table-layout:fixed;border-collapse:collapse;font-size:.74rem}
        .pr-t th,.pr-t td{padding:5px 4px;border-bottom:1px solid #eef2f7;text-align:right;overflow-wrap:anywhere}
        .pr-t th{color:#1c3a5e;font-size:.66rem;background:#f8fafc;cursor:pointer}.pr-t th:first-child,.pr-t td:first-child{text-align:left}
        .pr-t tr.tot td{font-weight:700;background:#eef4fb}.pr-t td small{display:block;color:#94a3b8;font-size:.66rem}
        .pr-t tr.clic{cursor:pointer}.pr-t tr.clic:hover td{background:#f8fafc}
        .pr-nota{font-size:.74rem;color:#64748b;margin-top:6px}
        @media (max-width:1100px){.pr-barra,.pr-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style>
      <div class="pr-barra">
        <div class="campo"><label>Desde (fecha del servicio)</label><input type="date" id="prDesde" value="${self._iso(ini)}"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="prHasta" value="${self._iso(hoy)}"></div>
        <div class="campo"><label>Conductor</label><div id="prCond"></div></div>
        <div class="campo"><label>Destino</label><div id="prDest"></div></div>
        <div class="campo"><button type="button" class="boton-secundario" id="prExcel" style="width:100%">⬇ Exportar Excel</button></div>
      </div>
      <div id="prAviso" style="font-size:.8rem;color:#64748b;margin:-2px 0 10px">Cargando viajes, tiempos, facturación y descuentos…</div>
      <div class="pr-kpis" id="prKpis"></div>
      <div class="pr-card"><h3><span>Productividad por conductor <small style="font-weight:400;color:#64748b">· clic en un encabezado para ordenar · clic en un conductor para ver sus destinos</small></span></h3><div id="prTabla"></div>
        <div class="pr-nota"><b>Índice de tiempo</b>: compara las horas de cada viaje con el promedio de la flota al mismo destino (− = más rápido, + = más lento). <b>Horas de viaje</b> = inicio → fin de ruta del seguimiento (solo viajes con seguimiento completo). <b>Km/h</b> = km ÷ horas en esos mismos viajes.</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="pr-card"><h3><span>Viajes y km por conductor</span></h3><div style="position:relative;height:300px"><canvas id="prG1"></canvas></div></div>
        <div class="pr-card"><h3><span>Índice de tiempo vs la flota (%)</span></h3><div style="position:relative;height:300px"><canvas id="prG2"></canvas></div></div>
      </div>
      <div class="pr-card"><h3><span id="prDestTit">Tiempo promedio por destino (horas de viaje completo)</span></h3><div id="prDestinos"></div></div>`;
    const $ = id => cont.querySelector('#' + id);
    const rep = () => self._pintar();
    self._ms = { cond: crearMultiSelect($('prCond'), { textoTodos: 'Todos', onChange: rep }), dest: crearMultiSelect($('prDest'), { textoTodos: 'Todos', onChange: rep }) };
    ['prDesde', 'prHasta'].forEach(id => $(id).addEventListener('change', rep));
    $('prExcel').addEventListener('click', () => self._exportar());
    $('prTabla').addEventListener('click', function (ev) {
      const th = ev.target.closest('th[data-s]');
      if (th) { const k = th.dataset.s; if (self._sk === k) self._sd = -self._sd; else { self._sk = k; self._sd = -1; } self._pintar(); return; }
      const tr = ev.target.closest('tr[data-c]'); if (tr) { self._sel = self._sel === tr.dataset.c ? '' : tr.dataset.c; self._pintar(); }
    });
    self._sk = 'viajes'; self._sd = -1; self._sel = '';
    await self._cargar();
  },

  _cargar: async function () {
    const self = this, $ = id => self._cont.querySelector('#' + id);
    const pedir = (a, d) => llamarBackend(a, d || {}).catch(() => null);
    const [liq, seg, cob, des, cie] = await Promise.all([pedir('liqDatos'), pedir('listarConSeguimiento', { origen: 'controlTiempos' }), pedir('cobranzaDatos'), pedir('descuentosListar'), pedir('cierreListar')]);
    if (!liq || !liq.filas) { $('prAviso').innerHTML = '<span style="color:#b91c1c">No se pudo cargar la liquidación de viajes.</span>'; return; }
    const U = self._U;
    // Tiempos por código de servicio
    const tiempos = {};
    const segL = seg ? Object.values(seg).filter(x => x && typeof x === 'object' && x['CODIGO SERVICIO']) : [];
    segL.forEach(function (x) {
      if (x._seguimientoCompleto !== true || typeof FormControlTiempos === 'undefined') return;
      const c = FormControlTiempos._calc(x);
      const libres = Number(x._horasLibres) || 0;
      tiempos[U(x['CODIGO SERVICIO'])] = { v: c.valores, libres: libres };
    });
    // Facturado por código (valor de venta, por moneda)
    const fact = {};
    ((cob && cob.facturas) || []).forEach(function (x) {
      if (x.tipo && x.tipo !== 'VIAJE') return;
      const sv = x.servicios || []; if (!sv.length) return;
      const val = (Number(x.valor) || 0) / sv.length;
      sv.forEach(s => { const c = U(s.codigo).replace(/-(HEP|HEU|PER|GAS|REP)$/, ''); const o = fact[c] = fact[c] || { USD: 0, PEN: 0 }; o[x.moneda === 'PEN' ? 'PEN' : 'USD'] += val; });
    });
    // Rendimiento con sonda por código
    const kmgal = {};
    const cl = (cie && (cie.items || cie.cierres || cie.resumen)) || (Array.isArray(cie) ? cie : []);
    (Array.isArray(cl) ? cl : []).forEach(function (x) { const c = U(x.codigo || x.codigoServicio); const k = Number(x.kmGal || x.kmgal || x.rendimiento); if (c && k > 0 && k < 30) kmgal[c] = { kmGal: k, km: Number(x.km) || 0, gal: Number(x.consumo || x.consumoReal) || 0 }; });
    self._desc = (des && des.ok) ? des.items || [] : [];
    self._viajes = liq.filas.map(function (f) {
      const cod = U(f.clave), base = cod.replace(/-T\d+$/, '');
      const t = tiempos[cod] || (cod === base ? null : null);
      return { cond: U(f.conductor), cod: cod, fecha: self._f(f.fecha), quincena: f.quincena, dest: U(f.destino) || 'SIN DESTINO', placa: f.placa, cliente: f.cliente,
        km: Number(f.km) || 0, bono: Number(f.totalBono) || 0, t: t, fact: fact[cod] || null, kg: kmgal[cod] || null, tramo: cod !== base };
    });
    self._nSeg = Object.keys(tiempos).length;
    const op = k => Array.from(new Set(self._viajes.map(v => v[k]).filter(Boolean))).sort();
    self._ms.cond.setOpciones(op('cond'));
    self._ms.dest.setOpciones(op('dest'));
    self._pintar();
  },

  _vis: function () {
    const self = this, $ = id => self._cont.querySelector('#' + id);
    const de = self._f($('prDesde').value), ha = self._f($('prHasta').value);
    if (ha) ha.setHours(23, 59, 59);
    return (self._viajes || []).filter(v => v.fecha && (!de || v.fecha >= de) && (!ha || v.fecha <= ha) && self._ms.cond.cumple(v.cond) && self._ms.dest.cumple(v.dest));
  },

  /** Resumen por conductor. */
  _resumen: function (vis) {
    const self = this;
    // Promedio de la flota por destino (viaje completo) con los viajes del período (sin filtro de conductor)
    const $ = id => self._cont.querySelector('#' + id);
    const de = self._f($('prDesde').value), ha = self._f($('prHasta').value); if (ha) ha.setHours(23, 59, 59);
    const flota = {};
    (self._viajes || []).filter(v => v.fecha && (!de || v.fecha >= de) && (!ha || v.fecha <= ha) && v.t && v.t.v.total !== undefined)
      .forEach(v => { const o = flota[v.dest] = flota[v.dest] || { s: 0, n: 0 }; o.s += v.t.v.total; o.n++; });
    Object.keys(flota).forEach(k => { flota[k].prom = flota[k].s / flota[k].n; });
    self._flota = flota;
    const qs = new Set(vis.map(v => v.quincena));
    const g = {};
    vis.forEach(function (v) {
      const o = g[v.cond] = g[v.cond] || { cond: v.cond, viajes: 0, tramos: 0, km: 0, dias: new Set(), hN: 0, hS: 0, kmH: 0, hKm: 0, plN: 0, plS: 0, exc: 0, idaS: 0, idaN: 0, retS: 0, retN: 0, tmS: 0, tmN: 0, idx: [], factUSD: 0, factPEN: 0, bono: 0, kgS: 0, kgN: 0, dest: {} };
      o.viajes++; if (v.tramo) o.tramos++;
      o.km += v.km; o.bono += v.bono; o.dias.add(self._iso(v.fecha));
      if (v.fact) { o.factUSD += v.fact.USD; o.factPEN += v.fact.PEN; }
      if (v.kg) { o.kgS += v.kg.kmGal; o.kgN++; }
      const d = o.dest[v.dest] = o.dest[v.dest] || { n: 0, hS: 0, hN: 0, km: 0 }; d.n++; d.km += v.km;
      if (v.t) {
        const T = v.t.v;
        if (T.total !== undefined) {
          o.hS += T.total; o.hN++; d.hS += T.total; d.hN++;
          if (v.km > 0 && v.km < 5000) { o.kmH += v.km; o.hKm += T.total; }
          const f = flota[v.dest]; if (f && f.n >= 2 && f.prom > 0) o.idx.push(T.total / f.prom - 1);
        }
        if (T.planta !== undefined) { o.plS += T.planta; o.plN++; if (v.t.libres > 0 && T.planta > v.t.libres) o.exc++; }
        if (T.idaSin !== undefined) { o.idaS += T.idaSin; o.idaN++; }
        if (T.retSin !== undefined) { o.retS += T.retSin; o.retN++; }
        if (T.tm1 !== undefined || T.tm2 !== undefined) { o.tmS += (T.tm1 || 0) + (T.tm2 || 0); o.tmN++; }
      }
    });
    // Descuentos aplicados (S/) en las quincenas del período
    (self._desc || []).filter(x => x.estado !== 'ANULADO').forEach(x => (x.cuotas || []).forEach(q => {
      const c = self._U(x.conductor); if (!g[c] || !qs.has(q.quincena)) return;
      g[c].desc = (g[c].desc || 0) + (Number(q.soles !== undefined ? q.soles : q.monto) || 0);
    }));
    return Object.values(g).map(o => ({
      cond: o.cond, viajes: o.viajes, tramos: o.tramos, km: o.km, kmViaje: o.viajes ? o.km / o.viajes : 0, dias: o.dias.size, viajesDia: o.dias.size ? o.viajes / o.dias.size : 0,
      horas: o.hS, hN: o.hN, hViaje: o.hN ? o.hS / o.hN : null, kmH: o.hKm ? o.kmH / o.hKm : null,
      planta: o.plN ? o.plS / o.plN : null, pExc: o.plN ? o.exc / o.plN : null, ida: o.idaN ? o.idaS / o.idaN : null, ret: o.retN ? o.retS / o.retN : null, tm: o.tmN ? o.tmS / o.tmN : null,
      idx: o.idx.length ? o.idx.reduce((a, b) => a + b, 0) / o.idx.length : null, nIdx: o.idx.length,
      factUSD: o.factUSD, factPEN: o.factPEN, bono: o.bono, desc: o.desc || 0, kmGal: o.kgN ? o.kgS / o.kgN : null, dest: o.dest
    }));
  },

  _pintar: function () {
    const self = this, $ = id => self._cont.querySelector('#' + id);
    if (!self._viajes) return;
    if (typeof _refrescarSnapshotFormulario === 'function') setTimeout(_refrescarSnapshotFormulario, 0);
    const vis = self._vis();
    const R = self._resumen(vis);
    const sk = self._sk, sd = self._sd;
    R.sort((a, b) => { const x = a[sk], y = b[sk]; if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sd; });
    self._R = R;
    const tot = R.reduce((a, r) => { a.viajes += r.viajes; a.km += r.km; a.horas += r.horas; a.hN += r.hN; a.factUSD += r.factUSD; a.factPEN += r.factPEN; a.bono += r.bono; a.desc += r.desc; return a; }, { viajes: 0, km: 0, horas: 0, hN: 0, factUSD: 0, factPEN: 0, bono: 0, desc: 0 });
    const conT = vis.filter(v => v.t && v.t.v.total !== undefined).length;
    $('prAviso').innerHTML = vis.length + ' viajes en el período · ' + conT + ' con seguimiento completo (horas) · ' + R.length + ' conductores.' + (vis.length - conT ? ' <span style="color:#b45309">Los viajes sin seguimiento completo cuentan en viajes y km, pero no en horas.</span>' : '');
    const k = (t, v, s, c) => '<div class="pr-kpi" style="border-left-color:' + (c || '#1c3a5e') + '"><span>' + t + '</span><b>' + v + '</b><small>' + (s || '') + '</small></div>';
    $('prKpis').innerHTML = k('Viajes', tot.viajes, R.length + ' conductores') + k('Km recorridos', self._m(tot.km, 0), tot.viajes ? self._m(tot.km / tot.viajes, 0) + ' km por viaje' : '', '#0ea5e9') +
      k('Horas de viaje', self._m(tot.horas, 0) + ' h', tot.hN ? self._h(tot.horas / tot.hN) + ' por viaje' : 'sin seguimiento', '#7c3aed') +
      k('Facturado', 'US$ ' + self._m(tot.factUSD, 0), tot.factPEN ? '+ S/ ' + self._m(tot.factPEN, 0) : 'valor de venta', '#16a34a') +
      k('Bono pagado', 'S/ ' + self._m(tot.bono, 0), 'total bono de los viajes', '#f59e0b') + k('Descuentos', 'S/ ' + self._m(tot.desc, 0), 'aplicados en el período', '#dc2626');
    const cols = [['cond', 'Conductor', '17%'], ['viajes', 'Viajes'], ['km', 'Km'], ['kmViaje', 'Km / viaje'], ['dias', 'Días con viaje'], ['hViaje', 'Horas / viaje'], ['kmH', 'Km / h'], ['idx', 'Índice de tiempo'],
      ['planta', 'Planta (h)'], ['pExc', '% excede h. libres'], ['tm', 'T. muertos (h)'], ['kmGal', 'Km / gal'], ['factUSD', 'Facturado US$'], ['bono', 'Bono S/'], ['desc', 'Descuentos S/']];
    const fl = s => s === sk ? (sd > 0 ? ' ▲' : ' ▼') : '';
    const fila = r => '<tr class="clic" data-c="' + esc(r.cond) + '"' + (self._sel === r.cond ? ' style="background:#eff6ff"' : '') + '><td><b>' + esc(r.cond) + '</b>' + (r.tramos ? '<small>' + r.tramos + ' tramo(s)</small>' : '') + '</td><td>' + r.viajes + '</td><td>' + self._m(r.km, 0) + '</td><td>' + self._m(r.kmViaje, 0) + '</td><td>' + r.dias + '<small>' + self._m(r.viajesDia, 1) + ' viajes/día</small></td>' +
      '<td>' + self._h(r.hViaje) + '<small>' + r.hN + ' con horas</small></td><td>' + (r.kmH ? self._m(r.kmH, 1) : '—') + '</td><td>' + self._pct(r.idx) + (r.nIdx ? '<small>' + r.nIdx + ' viajes</small>' : '') + '</td>' +
      '<td>' + self._h(r.planta) + '</td><td>' + (r.pExc === null ? '—' : Math.round(r.pExc * 100) + '%') + '</td><td>' + self._h(r.tm) + '</td><td>' + (r.kmGal ? self._m(r.kmGal, 2) : '—') + '</td>' +
      '<td>' + self._m(r.factUSD, 0) + (r.factPEN ? '<small>+ S/ ' + self._m(r.factPEN, 0) + '</small>' : '') + '</td><td>' + self._m(r.bono, 0) + '</td><td>' + (r.desc ? self._m(r.desc, 0) : '—') + '</td></tr>';
    $('prTabla').innerHTML = R.length ? '<table class="pr-t"><thead><tr>' + cols.map(c => '<th data-s="' + c[0] + '"' + (c[2] ? ' style="width:' + c[2] + '"' : '') + '>' + c[1] + fl(c[0]) + '</th>').join('') + '</tr></thead><tbody>' + R.map(fila).join('') +
      '<tr class="tot"><td>TOTAL</td><td>' + tot.viajes + '</td><td>' + self._m(tot.km, 0) + '</td><td>' + (tot.viajes ? self._m(tot.km / tot.viajes, 0) : '—') + '</td><td></td><td>' + (tot.hN ? self._h(tot.horas / tot.hN) : '—') + '</td><td colspan="6"></td><td>' + self._m(tot.factUSD, 0) + '</td><td>' + self._m(tot.bono, 0) + '</td><td>' + self._m(tot.desc, 0) + '</td></tr></tbody></table>'
      : '<div style="color:#94a3b8;padding:10px">Sin viajes con estos filtros.</div>';
    self._pintarDestinos(R);
    self._graficos(R);
  },

  _pintarDestinos: function (R) {
    const self = this, $ = id => self._cont.querySelector('#' + id);
    const fl = self._flota || {};
    if (self._sel) {
      const r = R.filter(x => x.cond === self._sel)[0];
      $('prDestTit').textContent = 'Destinos de ' + self._sel + ' vs el promedio de la flota (clic de nuevo en el conductor para volver)';
      if (!r) { $('prDestinos').innerHTML = '<div style="color:#94a3b8">Sin viajes.</div>'; return; }
      const L = Object.keys(r.dest).map(d => ({ d: d, n: r.dest[d].n, km: r.dest[d].km, h: r.dest[d].hN ? r.dest[d].hS / r.dest[d].hN : null, f: fl[d] ? fl[d].prom : null })).sort((a, b) => b.n - a.n);
      $('prDestinos').innerHTML = '<table class="pr-t"><thead><tr><th style="width:30%">Destino</th><th>Viajes</th><th>Km</th><th>Horas promedio (conductor)</th><th>Horas promedio (flota)</th><th>Diferencia</th></tr></thead><tbody>' +
        L.map(x => '<tr><td>' + esc(x.d) + '</td><td>' + x.n + '</td><td>' + self._m(x.km, 0) + '</td><td>' + self._h(x.h) + '</td><td>' + self._h(x.f) + '</td><td>' + (x.h !== null && x.f ? self._pct(x.h / x.f - 1) : '—') + '</td></tr>').join('') + '</tbody></table>';
      return;
    }
    $('prDestTit').textContent = 'Tiempo promedio por destino (viaje completo: inicio → fin de ruta)';
    const D = {};
    R.forEach(r => Object.keys(r.dest).forEach(d => { const x = r.dest[d]; const o = D[d] = D[d] || { n: 0, km: 0, conds: [] }; o.n += x.n; o.km += x.km; if (x.hN) o.conds.push({ c: r.cond, h: x.hS / x.hN, n: x.hN }); }));
    const L = Object.keys(D).map(d => { const o = D[d], cs = o.conds.filter(c => c.n >= 1).sort((a, b) => a.h - b.h); return { d: d, n: o.n, km: o.km, f: fl[d] ? fl[d].prom : null, fn: fl[d] ? fl[d].n : 0, mejor: cs[0], peor: cs.length > 1 ? cs[cs.length - 1] : null }; }).sort((a, b) => b.n - a.n);
    $('prDestinos').innerHTML = L.length ? '<table class="pr-t"><thead><tr><th style="width:22%">Destino</th><th>Viajes</th><th>Km promedio</th><th>Horas promedio</th><th style="width:22%">Más rápido</th><th style="width:22%">Más lento</th></tr></thead><tbody>' +
      L.map(x => '<tr><td>' + esc(x.d) + '</td><td>' + x.n + '</td><td>' + (x.n ? self._m(x.km / x.n, 0) : '—') + '</td><td>' + self._h(x.f) + (x.fn ? '<small>' + x.fn + ' con horas</small>' : '') + '</td>' +
        '<td>' + (x.mejor ? esc(x.mejor.c) + '<small>' + self._h(x.mejor.h) + ' · ' + x.mejor.n + ' viaje(s)</small>' : '—') + '</td><td>' + (x.peor ? esc(x.peor.c) + '<small>' + self._h(x.peor.h) + ' · ' + x.peor.n + ' viaje(s)</small>' : '—') + '</td></tr>').join('') + '</tbody></table>'
      : '<div style="color:#94a3b8">Sin datos.</div>';
  },

  _graficos: async function (R) {
    const self = this, $ = id => self._cont.querySelector('#' + id);
    try { await FormResultados._cargarChartJs(); } catch (e) { return; }
    if (!window.Chart) return;
    (self._charts || []).forEach(c => { try { c.destroy(); } catch (e) { } });
    const L = R.slice().sort((a, b) => b.viajes - a.viajes);
    const corto = s => s.split(' ').slice(0, 2).join(' ');
    const c1 = new Chart($('prG1'), { type: 'bar', data: { labels: L.map(r => corto(r.cond)), datasets: [{ label: 'Viajes', data: L.map(r => r.viajes), backgroundColor: '#6366f1', yAxisID: 'y' }, { label: 'Km', data: L.map(r => Math.round(r.km)), backgroundColor: '#0ea5e9', yAxisID: 'y1' }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { position: 'left', title: { display: true, text: 'Viajes' } }, y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Km' } } } } });
    const I = R.filter(r => r.idx !== null).sort((a, b) => a.idx - b.idx);
    const c2 = new Chart($('prG2'), { type: 'bar', data: { labels: I.map(r => corto(r.cond)), datasets: [{ label: '% vs flota', data: I.map(r => Math.round(r.idx * 100)), backgroundColor: I.map(r => r.idx > 0.05 ? '#ef4444' : r.idx < -0.05 ? '#22c55e' : '#94a3b8') }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: '% (− = más rápido)' } } } } });
    self._charts = [c1, c2];
  },

  _exportar: async function () {
    const self = this;
    if (!window.XLSX) {
      try { await new Promise(function (ok, no) { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
      catch (e) { mostrarMensaje('No se pudo cargar el exportador de Excel.', 'error'); return; }
    }
    const R = self._R || []; if (!R.length) { mostrarMensaje('No hay datos con estos filtros.', 'error'); return; }
    const r2 = v => v === null || v === undefined ? '' : Math.round(v * 100) / 100;
    const $ = id => self._cont.querySelector('#' + id);
    const wb = XLSX.utils.book_new();
    const h1 = [['PRODUCTIVIDAD DE CONDUCTORES · ' + $('prDesde').value + ' a ' + $('prHasta').value], [],
      ['Conductor', 'Viajes', 'Tramos', 'Km', 'Km por viaje', 'Días con viaje', 'Viajes por día', 'Viajes con horas', 'Horas de viaje', 'Horas por viaje', 'Km por hora', 'Índice de tiempo vs flota (%)', 'Planta prom (h)', '% excede horas libres', 'Ida sin TM (h)', 'Retorno sin TM (h)', 'T. muertos (h)', 'Km/gal (sonda)', 'Facturado US$', 'Facturado S/', 'Bono S/', 'Descuentos S/']];
    R.forEach(r => h1.push([r.cond, r.viajes, r.tramos, r2(r.km), r2(r.kmViaje), r.dias, r2(r.viajesDia), r.hN, r2(r.horas), r2(r.hViaje), r2(r.kmH), r.idx === null ? '' : Math.round(r.idx * 100), r2(r.planta), r.pExc === null ? '' : Math.round(r.pExc * 100), r2(r.ida), r2(r.ret), r2(r.tm), r2(r.kmGal), r2(r.factUSD), r2(r.factPEN), r2(r.bono), r2(r.desc)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h1), 'Por conductor');
    const h2 = [['Conductor', 'Destino', 'Viajes', 'Km', 'Horas promedio (conductor)', 'Horas promedio (flota)', 'Diferencia %']];
    R.forEach(r => Object.keys(r.dest).sort().forEach(d => { const x = r.dest[d], h = x.hN ? x.hS / x.hN : null, f = (self._flota[d] || {}).prom || null; h2.push([r.cond, d, x.n, r2(x.km), r2(h), r2(f), h !== null && f ? Math.round((h / f - 1) * 100) : '']); }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h2), 'Por conductor y destino');
    const h3 = [['Fecha', 'Código', 'Conductor', 'Destino', 'Placa', 'Cliente', 'Km', 'Horas viaje', 'Planta (h)', 'Facturado US$', 'Facturado S/', 'Total bono S/']];
    self._vis().sort((a, b) => a.cond.localeCompare(b.cond) || a.fecha - b.fecha).forEach(v => h3.push([self._iso(v.fecha), v.cod, v.cond, v.dest, v.placa || '', v.cliente || '', r2(v.km), v.t ? r2(v.t.v.total) : '', v.t ? r2(v.t.v.planta) : '', v.fact ? r2(v.fact.USD) : '', v.fact ? r2(v.fact.PEN) : '', r2(v.bono)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h3), 'Viajes');
    XLSX.writeFile(wb, 'Productividad_conductores_' + $('prDesde').value + '_a_' + $('prHasta').value + '.xlsx');
  }
};
