/**
 * forms/liquidacionConductores.js  (v84)
 * -------------------------------------------------------------------------
 * Finanzas > "Liquidación de conductores". Sale del CONSOLIDADO.
 * Por viaje: peajes (peaje + S.D.C.F. + adicional), viático, llanta, cochera,
 * lavado, otros (con motivo), bono, feriado y dominical = TOTAL GASTOS;
 * depositado + extras = TOTAL DEPÓSITO; TOTAL BONO = gastos − depósito.
 * Por quincena (01-15 / 16-fin de mes): PENDIENTE → LIQUIDADO → DEPOSITADO.
 * Maestros y facturación pueden corregir montos (se graban en el consolidado
 * con huella), liquidar, marcar depositado y reabrir.
 * Backend: liqDatos, liqLiquidar, liqDepositar, liqReabrir, liqCorregir, liqHistorial.
 * -------------------------------------------------------------------------
 */
const FormLiquidacionConductores = {
  _filas: [], _liqs: [], _puede: false,
  _CAMPOS: [
    ['N° DE VIÁTICO', 'N° de viático', 'nroViatico', 'txt'], ['PEAJE', 'Peaje', 'p1'], ['PEAJE S.D.C.F.', 'Peaje S.D.C.F.', 'p2'], ['PEAJE ADICIONAL', 'Peaje adicional', 'p3'],
    ['VIATICO', 'Viático', 'viatico'], ['LLANTA', 'Llanta', 'llanta'], ['COCHERA', 'Cochera', 'cochera'], ['LAVADO', 'Lavado', 'lavado'],
    ['OTROS', 'Otros', 'otros'], ['MOTIVO OTROS', 'Motivo de otros', 'motivoOtros', 'txt'], ['BONO', 'Bono', 'bono'], ['FERIADO', 'Feriado', 'feriado'],
    ['DOMINICAL', 'Dominical', 'dominical'], ['MONTO DEPOSITADO', 'Monto depositado', 'depositado']
  ],

  abrir: async function () {
    const self = this;
    const html = `
      <style>
        .lq-barra { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:end; margin-bottom:8px; }
        .lq-barra .campo { margin:0; min-width:140px; }
        .lq-wrap { max-height:calc(74vh - 250px); min-height:160px; overflow:auto; border:1px solid #e1e6ec; border-radius:10px; }
        .lq-t { width:100%; table-layout:fixed; border-collapse:collapse; font-size:.68rem; }
        .lq-t th { background:#bcd3ee; color:#1c3a5e; font-size:.62rem; padding:5px 3px; position:sticky; top:0; z-index:1; text-align:center; border:1px solid #9fb9d9; }
        .lq-t th.dep { background:#d7e8c9; border-color:#b6cfa1; } .lq-t th.res { background:#ffd8a8; border-color:#f5b76b; }
        .lq-t td { padding:4px 3px; border-bottom:1px solid #eef2f7; text-align:right; overflow-wrap:anywhere; }
        .lq-t td.i { text-align:left; } .lq-t td.c { text-align:center; }
        .lq-t td.tot { font-weight:800; background:#f1f5f9; } .lq-t td.dep { background:#f3f9ee; } .lq-t td.depT { font-weight:800; background:#e6f2dc; }
        .lq-t td.bono { color:#b45309; font-weight:800; background:#fff3e0; } .lq-t td.neg { color:#166534; font-weight:800; }
        .lq-t tfoot td { font-weight:800; background:#e9eef5; position:sticky; bottom:0; }
        .lq-t tbody tr.clic { cursor:pointer; } .lq-t tbody tr.clic:hover td { background:#eef4fb; }
        .lq-res { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:10px 0 0; }
        .lq-res div { background:#f1f5f9; border-radius:9px; padding:7px 11px; border-left:4px solid #94a3b8; }
        .lq-res span { display:block; font-size:.66rem; font-weight:700; color:#64748b; text-transform:uppercase; }
        .lq-res b { font-size:1.05rem; color:#1c3a5e; } .lq-res .bono { border-left-color:#f59e0b; background:#fff7ed; } .lq-res .bono b { color:#b45309; }
        .lq-mot { display:block; font-size:.6rem; color:#64748b; }
        .lq-mod { display:block; font-size:.58rem; color:#7c3aed; font-weight:700; }
        .lq-est { display:inline-block; padding:2px 7px; border-radius:10px; font-size:.6rem; font-weight:800; }
        .lq-est.PENDIENTE { background:#fef3c7; color:#92400e; } .lq-est.LIQUIDADO { background:#dbeafe; color:#1e40af; } .lq-est.DEPOSITADO { background:#dcfce7; color:#166534; }
        .lq-est.REABIERTO { background:#f1f5f9; color:#64748b; }
        .lq-btn { border:1px solid #cbd5e1; background:#fff; border-radius:6px; padding:2px 6px; font-size:.62rem; cursor:pointer; margin:1px; }
        .lq-btn:hover { background:#eef4fb; } .lq-btn.pri { background:#1c3a5e; color:#fff; border-color:#1c3a5e; }
        .lq-acc { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:10px; }
        .lq-liqs { margin-top:10px; font-size:.72rem; }
        .lq-liqs table { width:100%; border-collapse:collapse; } .lq-liqs td, .lq-liqs th { border-bottom:1px solid #eef2f7; padding:4px; text-align:left; }
        .lq-liqs th { background:#f1f5f9; font-size:.64rem; }
        .lq-ov { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:10050; display:flex; align-items:center; justify-content:center; }
        .lq-dlg { background:#fff; border-radius:12px; padding:16px 18px; width:min(620px,94vw); max-height:88vh; overflow:auto; box-shadow:0 10px 40px rgba(0,0,0,.25); }
        .lq-dlg h4 { margin:0 0 10px; color:#1c3a5e; }
        .lq-dlg .g { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px 10px; }
        .lq-dlg label { font-size:.68rem; font-weight:700; color:#475569; display:block; }
        .lq-dlg input, .lq-dlg select, .lq-dlg textarea { width:100%; box-sizing:border-box; padding:5px 7px; border:1px solid #cbd5e1; border-radius:6px; font-size:.8rem; }
        .lq-dlg input.cambio { background:#fef9c3; border-color:#eab308; }
        .lq-dlg .pie { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
        .lq-dlg .nota { font-size:.7rem; color:#64748b; margin:8px 0 0; }
      </style>
      <div class="lq-barra">
        <div class="campo"><label>Quincena</label><select id="lqQuin"></select></div>
        <div class="campo"><label>Estado</label><select id="lqEst">
          <option value="PENDIENTE">Pendientes de liquidar</option><option value="LIQUIDADO">Por depositar (liquidados)</option>
          <option value="DEPOSITADO">Depositados</option><option value="">Todos</option></select></div>
        <div class="campo" style="min-width:230px"><label>Conductor</label><select id="lqCond"><option value="">Todos (resumen)</option></select></div>
        <div class="campo"><label>Placa</label><div id="msLqPlaca"></div></div>
        <button class="boton-secundario" id="lqBorrar" type="button">Borrar filtros</button>
        <button class="boton-secundario" id="lqHist" type="button">Historial de cambios</button>
      </div>
      <div id="lqCuerpo">Cargando…</div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="lqCerrar">Cerrar</button>
        <button class="boton-secundario" id="lqImprimir">Imprimir</button>
        <button class="boton-secundario" id="lqExcel">Exportar Excel</button>
        <button class="boton-primario" id="lqCopiar">Copiar tabla</button>
      </div>`;
    abrirPanel('Liquidación de conductores', html, async function (raiz) {
      self._raiz = raiz;
      const $ = id => raiz.querySelector('#' + id);
      self._msPlaca = crearMultiSelect($('msLqPlaca'), { onChange: () => self._pintar() });
      ['lqCond', 'lqQuin', 'lqEst'].forEach(id => $(id).addEventListener('change', () => self._pintar()));
      $('lqBorrar').addEventListener('click', function () { $('lqCond').value = ''; $('lqEst').value = 'PENDIENTE'; $('lqQuin').value = ''; self._msPlaca.limpiar(); self._pintar(); });
      $('lqCerrar').addEventListener('click', cerrarPanel);
      $('lqCopiar').addEventListener('click', () => self._copiar());
      $('lqImprimir').addEventListener('click', () => self._imprimir());
      $('lqExcel').addEventListener('click', () => self._excel());
      $('lqHist').addEventListener('click', () => self._historial());
      await self._cargar(true);
    }, { ancho: true });
  },

  _cargar: async function (primera) {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    if (primera) $('lqCuerpo').textContent = 'Cargando…';
    const r = await llamarBackend('liqDatos', {});
    if (!respuestaValida(r)) { $('lqCuerpo').textContent = (r && r.mensaje) || 'No se pudo cargar.'; return; }
    self._puede = !!r.puedeEditar;
    self._liqs = r.liquidaciones || [];
    self._filas = (r.filas || []).map(function (f) {
      f.gastos = f.peajes + f.viatico + f.llanta + f.cochera + f.lavado + f.otros + f.bono + f.feriado + f.dominical;
      f.totalDep = f.depositado + f.extras;
      f.totalBono = Math.round((f.gastos - f.totalDep) * 100) / 100;
      return f;
    });
    const selC = $('lqCond').value, selQ = $('lqQuin').value;
    const conds = Array.from(new Set(self._filas.map(f => f.conductor))).sort();
    $('lqCond').innerHTML = '<option value="">Todos (resumen)</option>' + conds.map(c => '<option>' + esc(c) + '</option>').join('');
    if (selC && conds.indexOf(selC) >= 0) $('lqCond').value = selC;
    const quins = Array.from(new Set(self._filas.map(f => f.quincena).filter(Boolean))).sort().reverse();
    $('lqQuin').innerHTML = '<option value="">Todas</option>' + quins.map(q => '<option value="' + q + '">' + self._qTxt(q) + '</option>').join('');
    if (primera) {
      // Por defecto: la última quincena ya cerrada con viajes pendientes (si no, la más reciente)
      const hoy = new Date(); const hIso = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
      const fin = q => { const m = q.match(/^(\d{4})-(\d{2})-(Q[12])$/); return m ? (m[3] === 'Q1' ? m[1] + '-' + m[2] + '-15' : m[1] + '-' + m[2] + '-' + new Date(Number(m[1]), Number(m[2]), 0).getDate()) : ''; };
      const pq = Array.from(new Set(self._filas.filter(f => f.liqEstado === 'PENDIENTE').map(f => f.quincena).filter(Boolean))).sort().reverse();
      const p = pq.filter(q => fin(q) < hIso)[0] || pq[0];
      $('lqQuin').value = p || '';
      self._msPlaca.setOpciones(Array.from(new Set(self._filas.map(f => f.placa).filter(Boolean))).sort());
    } else if (selQ && quins.indexOf(selQ) >= 0) $('lqQuin').value = selQ;
    self._pintar();
  },

  _m: function (n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  _f: function (iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || ''); },
  _qTxt: function (q) {
    const m = String(q || '').match(/^(\d{4})-(\d{2})-(Q[12])$/); if (!m) return q || '';
    const mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'][Number(m[2]) - 1];
    const fin = new Date(Number(m[1]), Number(m[2]), 0).getDate();
    return (m[3] === 'Q1' ? '01 al 15' : '16 al ' + fin) + ' ' + mes + ' ' + m[1];
  },
  _vis: function () {
    const $ = id => this._raiz.querySelector('#' + id);
    const c = $('lqCond').value, q = $('lqQuin').value, e = $('lqEst').value;
    return this._filas.filter(f => (!c || f.conductor === c) && (!q || f.quincena === q) && (!e || f.liqEstado === e) && this._msPlaca.cumple(f.placa))
      .sort((a, b) => String(a.conductor).localeCompare(String(b.conductor)) || String(a.fecha).localeCompare(String(b.fecha)));
  },
  _suma: function (lista) {
    return lista.reduce(function (a, f) {
      ['peajes', 'viatico', 'llanta', 'cochera', 'lavado', 'otros', 'bono', 'feriado', 'dominical', 'gastos', 'depositado', 'extras', 'totalDep', 'totalBono'].forEach(k => { a[k] = (a[k] || 0) + (f[k] || 0); });
      a.n = (a.n || 0) + 1; return a;
    }, {});
  },
  _liq: function (id) { return this._liqs.filter(l => l.id === id)[0]; },
  _bonoTd: function (v) { return Math.abs(v) < 0.005 ? '<td class="c">—</td>' : '<td class="' + (v > 0 ? 'bono' : 'neg') + '">S/ ' + this._m(v) + '</td>'; },

  _pintar: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const vis = self._vis(), cond = $('lqCond').value;
    if (!cond) { self._pintarResumen(vis); _refrescarSnapshotFormulario(); return; }
    const t = self._suma(vis);
    let h = '<div class="lq-wrap">' + self._tablaHtml(vis, false) + '</div>' +
      '<div class="lq-res"><div><span>Total gastos</span><b>S/ ' + self._m(t.gastos) + '</b></div><div><span>Total depósito (depositado + extras)</span><b>S/ ' + self._m(t.totalDep) + '</b></div>' +
      '<div><span>Viajes</span><b>' + (t.n || 0) + '</b></div><div class="bono"><span>Total bono</span><b>S/ ' + self._m(t.totalBono) + '</b></div></div>';
    // Acciones: liquidar la quincena (pendientes)
    const pend = vis.filter(f => f.liqEstado === 'PENDIENTE');
    if (self._puede && pend.length) {
      const qs = Array.from(new Set(pend.map(f => f.quincena))).sort();
      h += '<div class="lq-acc">' + qs.map(q => '<button class="boton-primario" data-liq="' + q + '">Liquidar quincena ' + self._qTxt(q) + ' (' + pend.filter(f => f.quincena === q).length + ' viajes)</button>').join('') + '</div>';
    }
    // Liquidaciones del conductor
    const q = $('lqQuin').value;
    const ls = self._liqs.filter(l => l.conductor === cond && (!q || l.quincena === q)).sort((a, b) => String(b.quincena).localeCompare(String(a.quincena)));
    if (ls.length) {
      h += '<div class="lq-liqs"><b>Liquidaciones de ' + esc(cond) + '</b><table><thead><tr><th>Quincena</th><th>Viajes</th><th>Total bono</th><th>Estado</th><th>Liquidó</th><th>Depósito</th><th></th></tr></thead><tbody>' +
        ls.map(l => '<tr><td>' + self._qTxt(l.quincena) + '</td><td>' + l.viajes + '</td><td><b>S/ ' + self._m(l.totalBono) + '</b></td><td><span class="lq-est ' + l.estado + '">' + l.estado + '</span>' +
          (l.estado === 'REABIERTO' ? '<span class="lq-mot">' + esc(l.reabiertoPor || '') + ' ' + esc(l.fechaReap || '') + ': ' + esc(l.motivoReap || '') + '</span>' : '') + '</td>' +
          '<td>' + esc(l.liquidadoPor || '') + '<span class="lq-mot">' + esc(l.fechaLiq || '') + '</span></td>' +
          '<td>' + (l.estado === 'DEPOSITADO' ? esc(l.fechaDep || '') + ' · ' + esc(l.medio || '') + ' · op. ' + esc(l.operacion || '') + '<span class="lq-mot">' + esc(l.depositadoPor || '') + '</span>' : '') + '</td>' +
          '<td>' + (self._puede && l.estado === 'LIQUIDADO' ? '<button class="lq-btn pri" data-dep="' + l.id + '">Marcar depositado</button>' : '') +
          (self._puede && (l.estado === 'LIQUIDADO' || l.estado === 'DEPOSITADO') ? '<button class="lq-btn" data-reab="' + l.id + '">Reabrir</button>' : '') + '</td></tr>').join('') +
        '</tbody></table></div>';
    }
    $('lqCuerpo').innerHTML = h;
    $('lqCuerpo').querySelectorAll('[data-liq]').forEach(b => b.addEventListener('click', () => self._dlgLiquidar(cond, b.dataset.liq)));
    $('lqCuerpo').querySelectorAll('[data-dep]').forEach(b => b.addEventListener('click', () => self._dlgDepositar(b.dataset.dep)));
    $('lqCuerpo').querySelectorAll('[data-reab]').forEach(b => b.addEventListener('click', () => self._dlgReabrir(b.dataset.reab)));
    $('lqCuerpo').querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => self._dlgCorregir(b.dataset.edit)));
    _refrescarSnapshotFormulario();
  },

  _pintarResumen: function (vis) {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    // Grupo = conductor + quincena + (liquidación o pendiente)
    const g = {};
    vis.forEach(f => { const k = f.conductor + '|' + f.quincena + '|' + (f.liqId || 'P'); (g[k] = g[k] || []).push(f); });
    const filas = Object.keys(g).map(k => {
      const l = g[k]; const s = self._suma(l); const f0 = l[0]; const liq = f0.liqId ? self._liq(f0.liqId) : null;
      return { conductor: f0.conductor, quincena: f0.quincena, estado: f0.liqEstado, liq: liq, n: s.n, gastos: liq ? liq.gastos : s.gastos, totalDep: liq ? liq.totalDep : s.totalDep, totalBono: liq ? liq.totalBono : s.totalBono };
    }).sort((a, b) => a.conductor.localeCompare(b.conductor) || String(b.quincena).localeCompare(String(a.quincena)));
    const t = filas.reduce((a, r) => { a.n += r.n; a.g += r.gastos; a.d += r.totalDep; a.b += r.totalBono; return a; }, { n: 0, g: 0, d: 0, b: 0 });
    $('lqCuerpo').innerHTML = '<div class="lq-wrap"><table class="lq-t"><colgroup><col style="width:24%"><col style="width:12%"><col style="width:6%"><col><col><col><col style="width:11%"><col style="width:15%"></colgroup>' +
      '<thead><tr><th>Conductor</th><th>Quincena</th><th>Viajes</th><th>Total gastos</th><th class="dep">Total depósito</th><th class="res">Total bono</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (filas.length ? filas.map(r => '<tr class="clic" data-c="' + esc(r.conductor) + '" data-q="' + r.quincena + '"><td class="i"><b>' + esc(r.conductor) + '</b></td><td class="c">' + self._qTxt(r.quincena) + '</td><td class="c">' + r.n +
        '</td><td>S/ ' + self._m(r.gastos) + '</td><td class="depT">S/ ' + self._m(r.totalDep) + '</td>' + self._bonoTd(r.totalBono) +
        '<td class="c"><span class="lq-est ' + r.estado + '">' + (r.estado === 'LIQUIDADO' ? 'POR DEPOSITAR' : r.estado) + '</span>' + (r.liq && r.estado === 'DEPOSITADO' ? '<span class="lq-mot">' + esc(r.liq.fechaDep || '') + ' · op. ' + esc(r.liq.operacion || '') + '</span>' : '') + '</td>' +
        '<td class="c">' + (self._puede && r.liq && r.estado === 'LIQUIDADO' ? '<button class="lq-btn pri" data-dep="' + r.liq.id + '">Depositar</button>' : '') + '<button class="lq-btn">Ver ›</button></td></tr>').join('')
        : '<tr><td colspan="8" class="c" style="color:#8b95a1;padding:14px">Sin viajes con estos filtros.</td></tr>') +
      '</tbody><tfoot><tr><td class="i" colspan="2">TOTAL</td><td class="c">' + t.n + '</td><td>S/ ' + self._m(t.g) + '</td><td>S/ ' + self._m(t.d) + '</td><td>S/ ' + self._m(t.b) + '</td><td colspan="2"></td></tr></tfoot></table></div>';
    $('lqCuerpo').querySelectorAll('tr[data-c]').forEach(tr => tr.addEventListener('click', function (ev) {
      const dep = ev.target.closest('[data-dep]');
      if (dep) { ev.stopPropagation(); self._dlgDepositar(dep.dataset.dep); return; }
      $('lqCond').value = tr.dataset.c; $('lqQuin').value = tr.dataset.q; self._pintar();
    }));
  },

  /** Tabla de detalle. paraCorreo = estilos en línea (correo, impresión, Excel). */
  _tablaHtml: function (vis, paraCorreo) {
    const self = this, t = self._suma(vis);
    const conAcc = !paraCorreo;
    const cols = ['CONDUCTOR', 'PLACA', 'DESTINO', 'FECHA DEL SERVICIO', 'N° DE VIÁTICO', 'PEAJES', 'VIÁTICO', 'LLANTA', 'COCHERA', 'LAVADO', 'OTROS', 'BONO', 'FERIADO', 'DOMINICAL', 'TOTAL GASTOS',
      'MONTO DEPOSITADO', 'EXTRAS', 'TOTAL DEPÓSITO', 'TOTAL BONO'].concat(conAcc ? ['ESTADO'] : []);
    const st = paraCorreo ? {
      th: 'style="background:#bcd3ee;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      thd: 'style="background:#d7e8c9;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      thr: 'style="background:#ffd8a8;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      td: function (al, extra) { return 'style="border:1px solid #c9d3df;padding:3px 6px;font-family:Calibri,Arial;font-size:10pt;text-align:' + al + ';' + (extra || '') + '"'; }
    } : null;
    const th = function (c, i) { const cls = i >= 15 && i <= 17 ? 'dep' : i === 18 ? 'res' : ''; return paraCorreo ? '<th ' + (cls === 'dep' ? st.thd : cls === 'res' ? st.thr : st.th) + '>' + c + '</th>' : '<th class="' + cls + '">' + c + '</th>'; };
    const td = function (v, al, cls, extra) { return paraCorreo ? '<td ' + st.td(al, extra) + '>' + v + '</td>' : '<td class="' + (al === 'left' ? 'i ' : al === 'center' ? 'c ' : '') + (cls || '') + '">' + v + '</td>'; };
    const m = n => n ? self._m(n) : '';
    let h = paraCorreo ? '<table style="border-collapse:collapse">' : '<table class="lq-t"><colgroup><col style="width:9%"><col style="width:5%"><col style="width:7%"><col style="width:5.5%"><col style="width:4.5%"><col><col><col><col><col><col style="width:6%"><col><col><col><col><col><col><col><col><col style="width:7%"></colgroup>';
    h += '<thead><tr>' + cols.map(th).join('') + '</tr></thead><tbody>';
    vis.forEach(function (f) {
      const b = f.totalBono;
      const condCel = esc(f.conductor) + (!paraCorreo && f.modPor ? '<span class="lq-mod" title="Última corrección">✎ ' + esc(f.modPor) + ' · ' + esc(f.modFecha || '') + '</span>' : '');
      h += '<tr>' + td(condCel, 'left') + td(esc(f.placa), 'center') + td(esc(f.destino), 'left') + td(self._f(f.fecha), 'center') + td(esc(f.nroViatico), 'center') +
        td(m(f.peajes), 'right') + td(m(f.viatico), 'right') + td(m(f.llanta), 'right') + td(m(f.cochera), 'right') + td(m(f.lavado), 'right') +
        td(m(f.otros) + (f.otros && f.motivoOtros ? (paraCorreo ? '<br><span style="font-size:8pt;color:#555">' + esc(f.motivoOtros) + '</span>' : '<span class="lq-mot">' + esc(f.motivoOtros) + '</span>') : ''), 'right') +
        td(m(f.bono), 'right') + td(m(f.feriado), 'right') + td(m(f.dominical), 'right') + td(self._m(f.gastos), 'right', 'tot', 'font-weight:bold;background:#f1f5f9') +
        td(m(f.depositado), 'right', 'dep') + td(m(f.extras), 'right', 'dep') + td(self._m(f.totalDep), 'right', 'depT', 'font-weight:bold;background:#e6f2dc') +
        td('S/ ' + self._m(b), 'right', b > 0 ? 'bono' : 'neg', 'color:#b45309;font-weight:bold;background:#fff3e0') +
        (conAcc ? '<td class="c"><span class="lq-est ' + f.liqEstado + '">' + (f.liqEstado === 'LIQUIDADO' ? 'POR DEPOSITAR' : f.liqEstado) + '</span>' +
          (self._puede && f.liqEstado === 'PENDIENTE' ? '<br><button class="lq-btn" data-edit="' + esc(f.clave) + '">✎ Corregir</button>' : '') + '</td>' : '') + '</tr>';
    });
    if (!vis.length) h += '<tr><td colspan="' + cols.length + '" style="text-align:center;color:#8b95a1;padding:14px">Sin viajes con estos filtros.</td></tr>';
    const tf = function (v, al) { return paraCorreo ? '<td ' + st.td(al || 'right', 'font-weight:bold;background:#e9eef5') + '>' + v + '</td>' : '<td>' + v + '</td>'; };
    h += '</tbody><tfoot><tr>' + (paraCorreo ? '<td colspan="5" ' + st.td('right', 'font-weight:bold;background:#e9eef5') + '>TOTAL (' + (t.n || 0) + ' viajes)</td>' : '<td colspan="5" class="i">TOTAL (' + (t.n || 0) + ' viajes)</td>') +
      ['peajes', 'viatico', 'llanta', 'cochera', 'lavado', 'otros', 'bono', 'feriado', 'dominical', 'gastos', 'depositado', 'extras', 'totalDep'].map(k => tf(self._m(t[k]))).join('') +
      tf('S/ ' + self._m(t.totalBono)) + (conAcc ? '<td></td>' : '') + '</tr></tfoot></table>';
    return h;
  },

  _titulo: function () {
    const $ = id => this._raiz.querySelector('#' + id);
    const e = $('lqEst').options[$('lqEst').selectedIndex].text;
    return 'LIQUIDACIÓN' + ($('lqCond').value ? ' — ' + $('lqCond').value : ' DE CONDUCTORES') + ' · Quincena: ' + ($('lqQuin').value ? this._qTxt($('lqQuin').value) : 'todas') + ' · ' + e;
  },

  _copiar: async function () {
    const self = this;
    const vis = self._vis();
    if (!vis.length) { mostrarMensaje('No hay viajes para copiar.', 'error'); return; }
    const html = '<p style="font-family:Calibri,Arial;font-size:11pt"><b>' + esc(self._titulo()) + '</b></p>' + self._tablaHtml(vis, true);
    const txt = vis.map(f => [f.conductor, f.placa, f.destino, self._f(f.fecha), f.nroViatico, f.peajes, f.viatico, f.llanta, f.cochera, f.lavado, f.otros, f.bono, f.feriado, f.dominical,
      f.gastos.toFixed(2), f.depositado, f.extras, f.totalDep.toFixed(2), f.totalBono.toFixed(2)].join('\t')).join('\n');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([txt], { type: 'text/plain' }) })]);
      mostrarMensaje('Liquidación copiada (' + vis.length + ' viaje(s)). Pégala en el correo o en Excel con Ctrl+V.', 'exito');
    } catch (e) { mostrarMensaje('No se pudo copiar automáticamente.', 'error'); }
  },

  _cargarXlsx: function () {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (ok, mal) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => ok(window.XLSX); s.onerror = mal; document.head.appendChild(s);
    });
  },
  _excel: async function () {
    const self = this, vis = self._vis();
    if (!vis.length) { mostrarMensaje('No hay viajes para exportar.', 'error'); return; }
    const enc = ['CONDUCTOR', 'PLACA', 'CLIENTE', 'DESTINO', 'FECHA DEL SERVICIO', 'QUINCENA', 'CÓDIGO', 'N° DE VIÁTICO', 'PEAJES', 'VIÁTICO', 'LLANTA', 'COCHERA', 'LAVADO', 'OTROS', 'MOTIVO OTROS',
      'BONO', 'FERIADO', 'DOMINICAL', 'TOTAL GASTOS', 'MONTO DEPOSITADO', 'EXTRAS', 'TOTAL DEPÓSITO', 'TOTAL BONO', 'ESTADO', 'MODIFICADO POR'];
    const n = x => Math.round((Number(x) || 0) * 100) / 100;
    const filas = vis.map(f => [f.conductor, f.placa, f.cliente, f.destino, self._f(f.fecha), self._qTxt(f.quincena), f.clave, f.nroViatico, n(f.peajes), n(f.viatico), n(f.llanta), n(f.cochera), n(f.lavado), n(f.otros), f.motivoOtros || '',
      n(f.bono), n(f.feriado), n(f.dominical), n(f.gastos), n(f.depositado), n(f.extras), n(f.totalDep), n(f.totalBono), f.liqEstado === 'LIQUIDADO' ? 'POR DEPOSITAR' : f.liqEstado, f.modPor ? f.modPor + ' ' + (f.modFecha || '') : '']);
    const t = self._suma(vis);
    filas.push(['TOTAL (' + vis.length + ' viajes)', '', '', '', '', '', '', '', n(t.peajes), n(t.viatico), n(t.llanta), n(t.cochera), n(t.lavado), n(t.otros), '', n(t.bono), n(t.feriado), n(t.dominical), n(t.gastos), n(t.depositado), n(t.extras), n(t.totalDep), n(t.totalBono), '', '']);
    const nombre = 'Liquidacion_' + (self._raiz.querySelector('#lqCond').value || 'conductores').replace(/\s+/g, '_') + '_' + (self._raiz.querySelector('#lqQuin').value || 'todas') + '.xlsx';
    try {
      const X = await self._cargarXlsx();
      const ws = X.utils.aoa_to_sheet([[self._titulo()], []].concat([enc], filas));
      ws['!cols'] = enc.map((c, i) => ({ wch: i === 0 ? 34 : i === 3 || i === 14 ? 24 : 12 }));
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Liquidación');
      X.writeFile(wb, nombre);
    } catch (e) {
      // Respaldo: CSV que Excel abre
      const csv = '﻿' + [enc].concat(filas).map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = nombre.replace('.xlsx', '.csv'); a.click();
    }
  },

  _imprimir: function () {
    const self = this;
    const vis = self._vis();
    if (!vis.length) { mostrarMensaje('No hay viajes para imprimir.', 'error'); return; }
    const t = self._suma(vis);
    const w = window.open('', '_blank');
    if (!w) { mostrarMensaje('El navegador bloqueó la ventana de impresión.', 'error'); return; }
    w.document.write('<html><head><title>Liquidación</title><style>@page{size:A4 landscape;margin:10mm} body{font-family:Calibri,Arial}</style></head><body>' +
      '<h3 style="margin:0 0 4px">TRANSPORTES SSI S.A.C. — ' + esc(self._titulo()) + '</h3>' +
      self._tablaHtml(vis, true) +
      '<p style="font-size:11pt;margin-top:10px"><b>Total gastos:</b> S/ ' + self._m(t.gastos) + ' &nbsp; · &nbsp; <b>Total depósito:</b> S/ ' + self._m(t.totalDep) +
      ' &nbsp; · &nbsp; <b>TOTAL BONO:</b> S/ ' + self._m(t.totalBono) + '</p>' +
      '<table style="margin-top:40px;width:100%;font-size:10pt"><tr><td style="text-align:center">______________________<br>Conductor</td><td style="text-align:center">______________________<br>Transportes SSI</td></tr></table>' +
      '<script>window.onload=function(){window.print();}<\/script></body></html>');
    w.document.close();
  },

  /* ----------------------------- ventanas ----------------------------- */
  _dlg: function (titulo, cuerpo, textoOk, alOk) {
    const ov = document.createElement('div'); ov.className = 'lq-ov';
    ov.innerHTML = '<div class="lq-dlg"><h4>' + titulo + '</h4>' + cuerpo + '<div class="lq-err" style="color:#b91c1c;font-size:.75rem;margin-top:6px"></div>' +
      '<div class="pie"><button class="boton-secundario" data-x>Cancelar</button>' + (textoOk ? '<button class="boton-primario" data-ok>' + textoOk + '</button>' : '') + '</div></div>';
    this._raiz.appendChild(ov);
    const cerrar = () => ov.remove();
    ov.querySelector('[data-x]').addEventListener('click', cerrar);
    const ok = ov.querySelector('[data-ok]');
    if (ok) ok.addEventListener('click', async () => {
      ok.disabled = true; ov.querySelector('.lq-err').textContent = '';
      try {
        const err = await alOk(ov);
        if (err) { ov.querySelector('.lq-err').textContent = err; ok.disabled = false; } else cerrar();
      } catch (e) { ov.querySelector('.lq-err').textContent = 'Error: ' + e.message; ok.disabled = false; }
    });
    return ov;
  },
  _enviar: async function (accion, datos, ov) {
    const r = await llamarBackend(accion, datos);
    if (!r || !r.ok) return (r && r.mensaje) || 'No se pudo grabar.';
    mostrarMensaje(r.mensaje || 'Listo.', 'exito');
    await this._cargar(false);
    return '';
  },

  _dlgLiquidar: function (cond, q) {
    const self = this;
    const vs = self._filas.filter(f => f.conductor === cond && f.quincena === q && f.liqEstado === 'PENDIENTE');
    const t = self._suma(vs);
    self._dlg('Liquidar quincena ' + self._qTxt(q),
      '<p style="margin:0 0 8px"><b>' + esc(cond) + '</b> · ' + vs.length + ' viaje(s)</p>' +
      '<div class="lq-res" style="grid-template-columns:repeat(3,1fr)"><div><span>Total gastos</span><b>S/ ' + self._m(t.gastos) + '</b></div><div><span>Total depósito</span><b>S/ ' + self._m(t.totalDep) + '</b></div>' +
      '<div class="bono"><span>Total bono</span><b>S/ ' + self._m(t.totalBono) + '</b></div></div>' +
      '<label style="margin-top:10px">Observación (opcional)</label><input data-obs maxlength="200">' +
      '<p class="nota">Al liquidar, estos viajes quedan revisados y pasan a "Por depositar". Ya no se pueden corregir salvo que se reabra la quincena.</p>',
      'Liquidar', ov => self._enviar('liqLiquidar', { conductor: cond, quincena: q, claves: vs.map(f => f.clave), totalBono: Math.round(t.totalBono * 100) / 100, observacion: ov.querySelector('[data-obs]').value }, ov));
  },

  _dlgDepositar: function (id) {
    const self = this, l = self._liq(id); if (!l) return;
    const hoy = new Date(); const iso = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    self._dlg('Marcar depositado',
      '<p style="margin:0 0 8px"><b>' + esc(l.conductor) + '</b> · ' + self._qTxt(l.quincena) + ' · Total bono <b>S/ ' + self._m(l.totalBono) + '</b></p>' +
      '<div class="g"><div><label>Fecha del depósito</label><input type="date" data-f value="' + iso + '"></div>' +
      '<div><label>Medio</label><select data-m><option>TRANSFERENCIA</option><option>YAPE</option><option>EFECTIVO</option></select></div>' +
      '<div><label>N° de operación</label><input data-op maxlength="40"></div></div>' +
      '<label style="margin-top:8px">Observación (opcional)</label><input data-obs maxlength="200">',
      'Marcar depositado', ov => {
        const op = ov.querySelector('[data-op]').value.trim();
        if (!op) return 'Escribe el N° de operación.';
        return self._enviar('liqDepositar', { id: id, fecha: ov.querySelector('[data-f]').value, medio: ov.querySelector('[data-m]').value, operacion: op, observacion: ov.querySelector('[data-obs]').value }, ov);
      });
  },

  _dlgReabrir: function (id) {
    const self = this, l = self._liq(id); if (!l) return;
    self._dlg('Reabrir quincena',
      '<p style="margin:0 0 8px"><b>' + esc(l.conductor) + '</b> · ' + self._qTxt(l.quincena) + ' · estado ' + l.estado + '</p>' +
      '<label>Motivo (obligatorio)</label><input data-mot maxlength="200">' +
      '<p class="nota">Los viajes vuelven a "Pendiente" para corregirlos y liquidar de nuevo. Queda registrado quién reabrió y por qué.' + (l.estado === 'DEPOSITADO' ? ' Ojo: esta quincena ya figura como depositada.' : '') + '</p>',
      'Reabrir', ov => {
        const mot = ov.querySelector('[data-mot]').value.trim();
        if (!mot) return 'Escribe el motivo.';
        return self._enviar('liqReabrir', { id: id, motivo: mot }, ov);
      });
  },

  _dlgCorregir: function (clave) {
    const self = this, f = self._filas.filter(x => x.clave === clave)[0]; if (!f) return;
    const val = c => c[2] === 'p1' || c[2] === 'p2' || c[2] === 'p3' ? (f[c[2]] !== undefined ? f[c[2]] : '') : f[c[2]];
    const campos = self._CAMPOS.map(c => '<div' + (c[0] === 'MOTIVO OTROS' ? ' style="grid-column:span 2"' : '') + '><label>' + c[1] + '</label><input data-c="' + c[0] + '" data-o="' + esc(val(c) === undefined || val(c) === null ? '' : String(val(c))) + '" value="' + esc(val(c) === undefined || val(c) === null ? '' : String(val(c))) + '"' + (c[3] ? '' : ' inputmode="decimal"') + '></div>').join('');
    const ov = self._dlg('Corregir viaje',
      '<p style="margin:0 0 8px"><b>' + esc(f.conductor) + '</b> · ' + esc(f.placa) + ' · ' + esc(f.destino) + ' · ' + self._f(f.fecha) + ' · ' + esc(f.clave) + '</p>' +
      '<div class="g">' + campos + '</div>' +
      '<label style="margin-top:10px">Motivo de la corrección (obligatorio)</label><input data-mot maxlength="200">' +
      '<p class="nota">Se corrige también en el consolidado del viaje (y sus totales). Queda registrado tu usuario, la fecha, el valor anterior y el nuevo.</p>',
      'Guardar corrección', ov2 => {
        const mot = ov2.querySelector('[data-mot]').value.trim();
        if (!mot) return 'Escribe el motivo de la corrección.';
        const cambios = {};
        ov2.querySelectorAll('input[data-c]').forEach(i => {
          const a = i.dataset.o, b = i.value.trim();
          const esTxt = i.dataset.c === 'N° DE VIÁTICO' || i.dataset.c === 'MOTIVO OTROS';
          if (esTxt ? a.toUpperCase() !== b.toUpperCase() : Math.abs((Number(a) || 0) - (Number(b.replace(/,/g, '')) || 0)) > 0.004) cambios[i.dataset.c] = esTxt ? b : (Number(b.replace(/,/g, '')) || 0);
        });
        if (!Object.keys(cambios).length) return 'No cambiaste ningún valor.';
        const bad = Object.keys(cambios).filter(k => typeof cambios[k] === 'number' && cambios[k] < 0);
        if (bad.length) return 'Los montos no pueden ser negativos.';
        return self._enviar('liqCorregir', { fila: f.fila, clave: f.clave, cambios: cambios, motivo: mot }, ov2);
      });
    ov.querySelectorAll('input[data-c]').forEach(i => i.addEventListener('input', () => i.classList.toggle('cambio', i.value.trim() !== i.dataset.o)));
  },

  _historial: async function () {
    const self = this, cond = self._raiz.querySelector('#lqCond').value;
    const ov = self._dlg('Historial de cambios' + (cond ? ' — ' + esc(cond) : ''), '<div data-h>Cargando…</div>', '', null);
    ov.querySelector('.lq-dlg').style.width = 'min(1000px,96vw)';
    const r = await llamarBackend('liqHistorial', cond ? { conductor: cond } : {});
    const box = ov.querySelector('[data-h]');
    if (!r || !r.ok) { box.textContent = (r && r.mensaje) || 'No se pudo cargar.'; return; }
    const fm = v => typeof v === 'number' ? self._m(v) : esc(String(v === null || v === undefined ? '' : v));
    box.innerHTML = (r.filas || []).length ? '<div class="lq-liqs" style="margin:0"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Conductor</th><th>Viaje / liquidación</th><th>Campo</th><th>Antes</th><th>Después</th><th>Motivo</th></tr></thead><tbody>' +
      r.filas.map(h => '<tr><td>' + fm(h['FECHA']) + '</td><td><b>' + fm(h['USUARIO']) + '</b></td><td>' + fm(h['ACCION']) + '</td><td>' + fm(h['CONDUCTOR']) + '</td><td>' + fm(h['CLAVE']) + '</td><td>' + fm(h['CAMPO']) +
        '</td><td>' + fm(h['ANTES']) + '</td><td>' + fm(h['DESPUES']) + '</td><td>' + fm(h['MOTIVO']) + '</td></tr>').join('') + '</tbody></table></div>'
      : '<p style="color:#64748b">Aún no hay cambios registrados.</p>';
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-liquidacion-conductores');
  if (b) b.addEventListener('click', function () { FormLiquidacionConductores.abrir(); });
});
