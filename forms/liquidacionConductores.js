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
      $('lqExcel').addEventListener('click', () => self._dlgExportar());
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
      ['peajes', 'viatico', 'llanta', 'cochera', 'lavado', 'otros', 'bono', 'feriado', 'dominical', 'gastos', 'depositado', 'extras', 'totalDep', 'totalBono', 'km'].forEach(k => { a[k] = (a[k] || 0) + (f[k] || 0); });
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

/* =========================================================================
 * v85 — Exportar liquidaciones a Excel (hoja Liquidaciones + hoja Dashboard
 * con indicadores, cuadros y gráficos). Usa ExcelJS (cdnjs); si no carga,
 * se exporta con SheetJS sin gráficos.
 * ========================================================================= */
Object.assign(FormLiquidacionConductores, {
  _EST_TXT: { PENDIENTE: 'Pendiente de liquidar', LIQUIDADO: 'Por depositar', DEPOSITADO: 'Depositado' },

  _cargarExcelJS: function () {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    return new Promise(function (ok, mal) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
      s.onload = () => window.ExcelJS ? ok(window.ExcelJS) : mal(new Error('ExcelJS'));
      s.onerror = mal; document.head.appendChild(s);
    });
  },

  _dlgExportar: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    if (!self._filas.length) { mostrarMensaje('No hay viajes cargados.', 'error'); return; }
    const quins = Array.from(new Set(self._filas.map(f => f.quincena).filter(Boolean))).sort().reverse();
    const qAct = $('lqQuin').value || quins[0] || '';
    const opQ = sel => quins.map(q => '<option value="' + q + '"' + (q === sel ? ' selected' : '') + '>' + self._qTxt(q) + '</option>').join('');
    const conds = Array.from(new Set(self._filas.map(f => f.conductor))).sort();
    const cAct = $('lqCond').value;
    const ov = self._dlg('Exportar liquidaciones a Excel',
      '<div class="g">' +
      '<div><label>Quincena desde</label><select data-qd>' + opQ(qAct) + '</select></div>' +
      '<div><label>Quincena hasta</label><select data-qh>' + opQ(qAct) + '</select></div>' +
      '<div><label>Estado</label><select data-e><option value="">Todos</option><option value="PENDIENTE">Pendientes de liquidar</option><option value="LIQUIDADO">Por depositar</option><option value="DEPOSITADO">Depositados</option></select></div>' +
      '</div>' +
      '<label style="margin-top:10px">Conductores <a href="#" data-todos style="font-weight:400;margin-left:8px">Todos</a> · <a href="#" data-ninguno style="font-weight:400">Ninguno</a></label>' +
      '<div data-conds style="max-height:190px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 10px;font-size:.74rem">' +
      conds.map(c => '<label style="font-weight:400;color:#1e293b;display:flex;gap:6px;align-items:center"><input type="checkbox" value="' + esc(c) + '"' + (!cAct || cAct === c ? ' checked' : '') + ' style="width:auto"> ' + esc(c) + '</label>').join('') + '</div>' +
      '<div class="nota" data-prev style="font-size:.78rem;color:#1c3a5e;font-weight:700"></div>' +
      '<p class="nota">El Excel trae 2 hojas: <b>Liquidaciones</b> (todas las liquidaciones, una por conductor, lista para imprimir) y <b>Dashboard</b> (indicadores, cuadros y gráficos).</p>',
      'Descargar Excel', async function (o) {
        const sel = self._selExport(o);
        if (!sel.vis.length) return 'No hay viajes con esos filtros.';
        o.querySelector('[data-ok]').textContent = 'Generando…';
        try { await self._generarExcel(sel); } catch (e) { o.querySelector('[data-ok]').textContent = 'Descargar Excel'; return 'No se pudo generar el Excel: ' + e.message; }
        return '';
      });
    ov.querySelector('.lq-dlg').style.width = 'min(720px,96vw)';
    const prev = () => { const s = self._selExport(ov); const t = self._suma(s.vis);
      ov.querySelector('[data-prev]').textContent = s.vis.length + ' viaje(s) · ' + s.conds.length + ' conductor(es) · Total bono S/ ' + self._m(t.totalBono || 0); };
    ov.querySelectorAll('select, input').forEach(i => i.addEventListener('change', prev));
    ov.querySelector('[data-todos]').addEventListener('click', e => { e.preventDefault(); ov.querySelectorAll('[data-conds] input').forEach(i => { i.checked = true; }); prev(); });
    ov.querySelector('[data-ninguno]').addEventListener('click', e => { e.preventDefault(); ov.querySelectorAll('[data-conds] input').forEach(i => { i.checked = false; }); prev(); });
    prev();
  },

  _selExport: function (ov) {
    let qd = ov.querySelector('[data-qd]').value, qh = ov.querySelector('[data-qh]').value;
    if (qd > qh) { const x = qd; qd = qh; qh = x; }
    const est = ov.querySelector('[data-e]').value;
    const marc = {}; ov.querySelectorAll('[data-conds] input:checked').forEach(i => { marc[i.value] = 1; });
    const vis = this._filas.filter(f => f.quincena >= qd && f.quincena <= qh && (!est || f.liqEstado === est) && marc[f.conductor])
      .sort((a, b) => String(a.conductor).localeCompare(String(b.conductor)) || String(a.fecha).localeCompare(String(b.fecha)));
    return { vis: vis, qd: qd, qh: qh, est: est, conds: Array.from(new Set(vis.map(f => f.conductor))).sort() };
  },

  _periodoTxt: function (s) {
    return (s.qd === s.qh ? 'Quincena ' + this._qTxt(s.qd) : 'Del ' + this._qTxt(s.qd) + ' al ' + this._qTxt(s.qh)) + ' · ' + (s.est ? this._EST_TXT[s.est] : 'Todos los estados');
  },

  /* ------------------------- gráficos (canvas → PNG) ------------------------- */
  _canvas: function (titulo, alto) {
    const W = 1200, H = alto || 640;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#d6dee8'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
    g.fillStyle = '#1c3a5e'; g.font = 'bold 30px Calibri, Arial'; g.textBaseline = 'middle'; g.fillText(titulo, 24, 34);
    return { cv: cv, g: g, W: W, H: H };
  },
  _corto: function (t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; },
  /** Barras horizontales. series: [{nombre, color, datos[]}] */
  _grafBarras: function (titulo, etiquetas, series, fmt) {
    const self = this;
    const n = etiquetas.length, ns = series.length;
    const alto = Math.max(360, Math.min(1500, 110 + n * (ns * 26 + 16)));
    const c = self._canvas(titulo, alto), g = c.g;
    const x0 = 330, x1 = c.W - 150, y0 = ns > 1 ? 104 : 74, h = c.H - y0 - 20;
    const max = Math.max(1, ...series.map(s => Math.max(0, ...s.datos)));
    const fila = h / Math.max(1, n), bh = Math.min(30, (fila - 12) / ns);
    if (ns > 1) series.forEach((s, i) => { g.fillStyle = s.color; g.fillRect(24 + i * 260, 64, 22, 22); g.fillStyle = '#334155'; g.font = '22px Calibri, Arial'; g.fillText(s.nombre, 54 + i * 260, 76); });
    etiquetas.forEach((e, i) => {
      const yc = y0 + fila * i + fila / 2;
      g.fillStyle = '#334155'; g.font = '21px Calibri, Arial'; g.textAlign = 'right'; g.fillText(self._corto(e, 30), x0 - 12, yc); g.textAlign = 'left';
      series.forEach((s, j) => {
        const v = s.datos[i] || 0, w = Math.max(0, v) / max * (x1 - x0);
        const y = yc - (ns * bh) / 2 + j * bh;
        g.fillStyle = s.color; g.fillRect(x0, y + 2, Math.max(2, w), bh - 4);
        g.fillStyle = '#0f172a'; g.font = 'bold 19px Calibri, Arial'; g.fillText(fmt(v), x0 + w + 8, y + bh / 2);
      });
    });
    g.strokeStyle = '#94a3b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0 - 6); g.lineTo(x0, c.H - 16); g.stroke();
    return { url: c.cv.toDataURL('image/png'), alto: c.H };
  },
  _grafDona: function (titulo, etiquetas, datos, colores, fmt) {
    const c = this._canvas(titulo, 520), g = c.g;
    const tot = datos.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const cx = 270, cy = 290, R = 190, r = 105;
    let a = -Math.PI / 2;
    datos.forEach((v, i) => {
      const d = Math.max(0, v) / tot * Math.PI * 2; if (!d) return;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a, a + d); g.closePath(); g.fillStyle = colores[i]; g.fill(); a += d;
    });
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = '#1c3a5e'; g.font = 'bold 28px Calibri, Arial'; g.textAlign = 'center'; g.fillText(fmt(tot), cx, cy); g.textAlign = 'left';
    etiquetas.forEach((e, i) => {
      const y = 140 + i * 74;
      g.fillStyle = colores[i]; g.fillRect(540, y - 16, 32, 32);
      g.fillStyle = '#334155'; g.font = '26px Calibri, Arial'; g.fillText(e, 586, y - 6);
      g.fillStyle = '#0f172a'; g.font = 'bold 24px Calibri, Arial'; g.fillText(fmt(datos[i]) + '  (' + Math.round(Math.max(0, datos[i]) / tot * 100) + '%)', 586, y + 22);
    });
    return { url: c.cv.toDataURL('image/png'), alto: c.H };
  },

  /* ------------------------------ cálculos ------------------------------ */
  _agrupar: function (lista, clave) {
    const g = {};
    lista.forEach(f => { const k = clave(f) || '(SIN DATO)'; (g[k] = g[k] || []).push(f); });
    return g;
  },

  _generarExcel: async function (sel) {
    const self = this;
    let X;
    try { X = await self._cargarExcelJS(); } catch (e) { return self._excelSimple(sel); }
    const vis = sel.vis, t = self._suma(vis);
    const n2 = x => Math.round((Number(x) || 0) * 100) / 100;
    const AZ = 'FF1C3A5E', CEL = 'FFBCD3EE', VER = 'FFD7E8C9', NAR = 'FFFFD8A8', GRIS = 'FFF1F5F9';
    const borde = { top: { style: 'thin', color: { argb: 'FFC9D3DF' } }, left: { style: 'thin', color: { argb: 'FFC9D3DF' } }, bottom: { style: 'thin', color: { argb: 'FFC9D3DF' } }, right: { style: 'thin', color: { argb: 'FFC9D3DF' } } };
    const relleno = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
    const wb = new X.Workbook(); wb.creator = 'TMS SSI'; wb.created = new Date();

    /* ---------------- Hoja 1: Liquidaciones ---------------- */
    const ws = wb.addWorksheet('Liquidaciones', { views: [{ showGridLines: false }] });
    ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
    const cols = [['QUINCENA', 15], ['FECHA', 11], ['PLACA', 9], ['CLIENTE', 11], ['DESTINO', 20], ['CÓDIGO', 15], ['N° VIÁTICO', 10], ['KM', 8], ['PEAJES', 10], ['VIÁTICO', 10], ['LLANTA', 9], ['COCHERA', 9],
      ['LAVADO', 9], ['OTROS', 9], ['MOTIVO OTROS', 22], ['BONO', 9], ['FERIADO', 9], ['DOMINICAL', 10], ['TOTAL GASTOS', 12], ['MONTO DEPOSITADO', 12], ['EXTRAS', 9], ['TOTAL DEPÓSITO', 12], ['TOTAL BONO', 12], ['ESTADO', 15]];
    const NC = cols.length;
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c[1]; });
    const numCols = [8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23];
    let r = 1;
    ws.mergeCells(r, 1, r, NC); ws.getCell(r, 1).value = 'TRANSPORTES SSI S.A.C. — LIQUIDACIÓN DE CONDUCTORES';
    ws.getCell(r, 1).font = { bold: true, size: 15, color: { argb: AZ } }; r++;
    ws.mergeCells(r, 1, r, NC); ws.getCell(r, 1).value = self._periodoTxt(sel) + ' · ' + vis.length + ' viajes · ' + sel.conds.length + ' conductores · generado ' + new Date().toLocaleString('es-PE');
    ws.getCell(r, 1).font = { size: 10, color: { argb: 'FF475569' } }; r += 2;
    const grupos = self._agrupar(vis, f => f.conductor);
    const nombres = Object.keys(grupos).sort();
    nombres.forEach(function (cond, gi) {
      const lista = grupos[cond], s = self._suma(lista);
      const ests = Array.from(new Set(lista.map(f => self._EST_TXT[f.liqEstado] || f.liqEstado))).join(' / ');
      ws.mergeCells(r, 1, r, NC);
      const ch = ws.getCell(r, 1);
      ch.value = 'CONDUCTOR: ' + cond + '   ·   ' + lista.length + ' viaje(s)   ·   Total bono S/ ' + self._m(s.totalBono) + '   ·   ' + ests;
      ch.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }; ch.fill = relleno(AZ); ch.alignment = { vertical: 'middle' };
      ws.getRow(r).height = 22; r++;
      const hr = ws.getRow(r);
      cols.forEach((c, i) => {
        const cel = hr.getCell(i + 1); cel.value = c[0];
        cel.font = { bold: true, size: 9, color: { argb: AZ } }; cel.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cel.border = borde;
        cel.fill = relleno(i >= 19 && i <= 21 ? VER : i === 22 ? NAR : CEL);
      });
      hr.height = 28; r++;
      lista.forEach(function (f) {
        const v = [self._qTxt(f.quincena), self._f(f.fecha), f.placa, f.cliente, f.destino, f.clave, f.nroViatico, n2(f.km), n2(f.peajes), n2(f.viatico), n2(f.llanta), n2(f.cochera), n2(f.lavado), n2(f.otros), f.motivoOtros || '',
          n2(f.bono), n2(f.feriado), n2(f.dominical), n2(f.gastos), n2(f.depositado), n2(f.extras), n2(f.totalDep), n2(f.totalBono), (self._EST_TXT[f.liqEstado] || f.liqEstado) + (f.modPor ? ' · ✎ ' + f.modPor : '')];
        const row = ws.getRow(r);
        v.forEach((x, i) => {
          const cel = row.getCell(i + 1); cel.value = x; cel.border = borde; cel.font = { size: 9 };
          if (numCols.indexOf(i + 1) >= 0) { cel.numFmt = i === 7 ? '#,##0' : '#,##0.00;[Red]-#,##0.00;""'; }
          if (i === 18) { cel.font = { size: 9, bold: true }; cel.fill = relleno(GRIS); }
          if (i === 21) { cel.font = { size: 9, bold: true }; cel.fill = relleno('FFE6F2DC'); }
          if (i === 22) { cel.font = { size: 9, bold: true, color: { argb: 'FFB45309' } }; cel.fill = relleno('FFFFF3E0'); }
          if (i === 4 || i === 14 || i === 23) cel.alignment = { wrapText: true, vertical: 'middle' };
        });
        r++;
      });
      const tr = ws.getRow(r);
      tr.getCell(1).value = 'TOTAL ' + cond; ws.mergeCells(r, 1, r, 7);
      const tv = { 8: s.km, 9: s.peajes, 10: s.viatico, 11: s.llanta, 12: s.cochera, 13: s.lavado, 14: s.otros, 16: s.bono, 17: s.feriado, 18: s.dominical, 19: s.gastos, 20: s.depositado, 21: s.extras, 22: s.totalDep, 23: s.totalBono };
      for (let i = 1; i <= NC; i++) {
        const cel = tr.getCell(i); cel.border = borde; cel.font = { bold: true, size: 10 }; cel.fill = relleno('FFE9EEF5');
        if (tv[i] !== undefined) { cel.value = n2(tv[i]); cel.numFmt = i === 8 ? '#,##0' : '#,##0.00;[Red]-#,##0.00'; }
      }
      tr.getCell(23).font = { bold: true, size: 11, color: { argb: 'FFB45309' } };
      r += 2;
      ws.getCell(r, 2).value = '______________________________'; ws.getCell(r, 16).value = '______________________________';
      ws.getCell(r + 1, 2).value = 'Firma del conductor: ' + cond; ws.getCell(r + 1, 16).value = 'Transportes SSI S.A.C.';
      ws.getCell(r + 1, 2).font = { size: 9 }; ws.getCell(r + 1, 16).font = { size: 9 };
      r += 2;
      if (gi < nombres.length - 1) ws.getRow(r - 1).addPageBreak();
      r += 2;
    });
    // Total general
    ws.mergeCells(r, 1, r, 7);
    const gr = ws.getRow(r); gr.getCell(1).value = 'TOTAL GENERAL (' + vis.length + ' viajes · ' + nombres.length + ' conductores)';
    const gv = { 8: t.km, 9: t.peajes, 10: t.viatico, 11: t.llanta, 12: t.cochera, 13: t.lavado, 14: t.otros, 16: t.bono, 17: t.feriado, 18: t.dominical, 19: t.gastos, 20: t.depositado, 21: t.extras, 22: t.totalDep, 23: t.totalBono };
    for (let i = 1; i <= NC; i++) {
      const cel = gr.getCell(i); cel.border = borde; cel.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }; cel.fill = relleno(AZ);
      if (gv[i] !== undefined) { cel.value = n2(gv[i]); cel.numFmt = i === 8 ? '#,##0' : '#,##0.00;[Red]-#,##0.00'; }
    }
    gr.height = 22;

    /* ---------------- Hoja 2: Dashboard ---------------- */
    const d = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false }] });
    d.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    d.getColumn(1).width = 36; for (let i = 2; i <= 8; i++) d.getColumn(i).width = 14; d.getColumn(9).width = 3;
    for (let i = 10; i <= 27; i++) d.getColumn(i).width = 10;
    d.mergeCells('A1:H1'); d.getCell('A1').value = 'DASHBOARD — LIQUIDACIÓN DE CONDUCTORES'; d.getCell('A1').font = { bold: true, size: 16, color: { argb: AZ } };
    d.mergeCells('A2:H2'); d.getCell('A2').value = self._periodoTxt(sel) + ' · ' + (sel.conds.length === new Set(self._filas.map(f => f.conductor)).size ? 'todos los conductores' : sel.conds.length + ' conductor(es)');
    d.getCell('A2').font = { size: 10, color: { argb: 'FF475569' } };
    const porEst = { PENDIENTE: 0, LIQUIDADO: 0, DEPOSITADO: 0 }, viajesEst = { PENDIENTE: 0, LIQUIDADO: 0, DEPOSITADO: 0 };
    vis.forEach(f => { porEst[f.liqEstado] = (porEst[f.liqEstado] || 0) + f.totalBono; viajesEst[f.liqEstado] = (viajesEst[f.liqEstado] || 0) + 1; });
    const kpis = [['Conductores', nombres.length, '0'], ['Viajes', vis.length, '0'], ['Km recorridos', t.km || 0, '#,##0'], ['Total gastos (S/)', t.gastos, '#,##0.00'],
      ['Total depósito (S/)', t.totalDep, '#,##0.00'], ['Total bono (S/)', t.totalBono, '#,##0.00'], ['Por depositar (S/)', porEst.LIQUIDADO, '#,##0.00'], ['Depositado (S/)', porEst.DEPOSITADO, '#,##0.00']];
    kpis.forEach((k, i) => {
      const a = d.getCell(4, i + 1), b = d.getCell(5, i + 1);
      a.value = k[0]; a.font = { bold: true, size: 9, color: { argb: 'FF64748B' } }; a.fill = relleno(GRIS); a.alignment = { horizontal: 'center', wrapText: true };
      b.value = n2(k[1]); b.numFmt = k[2]; b.font = { bold: true, size: 15, color: { argb: i === 5 ? 'FFB45309' : AZ } }; b.fill = relleno(i === 5 ? 'FFFFF3E0' : GRIS); b.alignment = { horizontal: 'center' };
      a.border = { top: { style: 'medium', color: { argb: i === 5 ? 'FFF59E0B' : 'FF94A3B8' } } };
    });
    d.getRow(4).height = 26; d.getRow(5).height = 28;
    let fr = 7;
    const tabla = function (titulo, enc, filas, fmts, colorEnc) {
      d.mergeCells(fr, 1, fr, enc.length); d.getCell(fr, 1).value = titulo; d.getCell(fr, 1).font = { bold: true, size: 12, color: { argb: AZ } }; fr++;
      enc.forEach((e, i) => { const c = d.getCell(fr, i + 1); c.value = e; c.font = { bold: true, size: 9, color: { argb: AZ } }; c.fill = relleno(colorEnc || CEL); c.border = borde; c.alignment = { horizontal: 'center', wrapText: true }; });
      fr++;
      filas.forEach((f, j) => {
        f.forEach((v, i) => { const c = d.getCell(fr, i + 1); c.value = v; c.border = borde; c.font = { size: 9, bold: !!f._tot }; if (fmts[i]) c.numFmt = fmts[i]; if (f._tot) c.fill = relleno('FFE9EEF5'); });
        fr++;
      });
      fr++;
    };
    // Resumen por conductor
    const resumen = nombres.map(c => { const l = grupos[c], s = self._suma(l); return [c, l.length, n2(s.km), n2(s.gastos), n2(s.totalDep), n2(s.totalBono), Array.from(new Set(l.map(f => self._EST_TXT[f.liqEstado]))).join(' / '), l.length ? n2((s.km || 0) / l.length) : 0]; })
      .sort((a, b) => b[5] - a[5]);
    const totR = ['TOTAL', vis.length, n2(t.km), n2(t.gastos), n2(t.totalDep), n2(t.totalBono), '', vis.length ? n2((t.km || 0) / vis.length) : 0]; totR._tot = true;
    tabla('Resumen por conductor', ['Conductor', 'Viajes', 'Km', 'Total gastos', 'Total depósito', 'Total bono', 'Estado', 'Km por viaje'], resumen.concat([totR]), [null, '0', '#,##0', '#,##0.00', '#,##0.00', '#,##0.00', null, '#,##0']);
    // Gastos por concepto
    const conceptos = [['Peajes', t.peajes], ['Viático', t.viatico], ['Llanta', t.llanta], ['Cochera', t.cochera], ['Lavado', t.lavado], ['Otros', t.otros], ['Bono', t.bono], ['Feriado', t.feriado], ['Dominical', t.dominical]];
    const tg = t.gastos || 1;
    const cf = conceptos.map(c => [c[0], n2(c[1] || 0), (c[1] || 0) / tg]); const cft = ['TOTAL GASTOS', n2(t.gastos), 1]; cft._tot = true;
    tabla('Gastos por concepto', ['Concepto', 'Monto (S/)', '% del total'], cf.concat([cft]), [null, '#,##0.00', '0.0%']);
    // Estado de pago
    const ef = ['PENDIENTE', 'LIQUIDADO', 'DEPOSITADO'].map(e => [self._EST_TXT[e], viajesEst[e] || 0, n2(porEst[e] || 0)]);
    tabla('Estado de pago', ['Estado', 'Viajes', 'Total bono (S/)'], ef, [null, '0', '#,##0.00'], NAR);
    // Destinos más frecuentes
    const gd = self._agrupar(vis, f => f.destino);
    const dest = Object.keys(gd).map(k => [k, gd[k].length, n2(self._suma(gd[k]).km), n2(self._suma(gd[k]).gastos)]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 15);
    tabla('Viajes más frecuentes (destino)', ['Destino', 'Viajes', 'Km', 'Gastos (S/)'], dest, [null, '0', '#,##0', '#,##0.00'], VER);
    // Clientes con mayor frecuencia
    const gc = self._agrupar(vis, f => f.cliente);
    const cli = Object.keys(gc).map(k => [k, gc[k].length, gc[k].length / (vis.length || 1), n2(self._suma(gc[k]).km)]).sort((a, b) => b[1] - a[1]).slice(0, 15);
    tabla('Clientes con mayor frecuencia', ['Cliente', 'Viajes', '% de viajes', 'Km'], cli, [null, '0', '0.0%', '#,##0'], VER);

    // Gráficos
    const S = v => 'S/ ' + self._m(v), N = v => Math.round(v).toLocaleString('en-US');
    const porBono = resumen.slice().sort((a, b) => b[5] - a[5]);
    const graf = [
      self._grafBarras('Total bono por conductor (S/)', porBono.map(x => x[0]), [{ nombre: 'Total bono', color: '#f59e0b', datos: porBono.map(x => x[5]) }], S),
      self._grafBarras('Gastos por concepto (S/)', conceptos.map(c => c[0]), [{ nombre: 'Monto', color: '#3b82f6', datos: conceptos.map(c => c[1] || 0) }], S),
      self._grafBarras('Depositado vs gastos por conductor (S/)', porBono.map(x => x[0]), [{ nombre: 'Total depósito', color: '#16a34a', datos: porBono.map(x => x[4]) }, { nombre: 'Total gastos', color: '#1c3a5e', datos: porBono.map(x => x[3]) }], S),
      self._grafDona('Estado de pago (total bono S/)', ef.map(e => e[0] + ' · ' + e[1] + ' viajes'), ef.map(e => e[2]), ['#f59e0b', '#3b82f6', '#16a34a'], S),
      self._grafBarras('Viajes por conductor', resumen.slice().sort((a, b) => b[1] - a[1]).map(x => x[0]), [{ nombre: 'Viajes', color: '#6366f1', datos: resumen.slice().sort((a, b) => b[1] - a[1]).map(x => x[1]) }], N),
      self._grafBarras('Kilómetros recorridos por conductor', resumen.slice().sort((a, b) => b[2] - a[2]).map(x => x[0]), [{ nombre: 'Km', color: '#0ea5e9', datos: resumen.slice().sort((a, b) => b[2] - a[2]).map(x => x[2]) }], N),
      self._grafBarras('Viajes más frecuentes (destino)', dest.slice(0, 10).map(x => x[0]), [{ nombre: 'Viajes', color: '#16a34a', datos: dest.slice(0, 10).map(x => x[1]) }], N),
      self._grafBarras('Clientes con mayor frecuencia (viajes)', cli.slice(0, 10).map(x => x[0]), [{ nombre: 'Viajes', color: '#a855f7', datos: cli.slice(0, 10).map(x => x[1]) }], N)
    ];
    // 2 columnas de gráficos a la derecha de los cuadros (columna J en adelante)
    const ANCHO = 600, PX_FILA = 20;
    let filaIzq = 3, filaDer = 3;
    graf.forEach((gx, i) => {
      const alto = Math.round(gx.alto * ANCHO / 1200);
      const izq = filaIzq <= filaDer;
      const img = wb.addImage({ base64: gx.url, extension: 'png' });
      d.addImage(img, { tl: { col: izq ? 9.2 : 17.6, row: izq ? filaIzq : filaDer }, ext: { width: ANCHO, height: alto } });
      const filas = Math.ceil(alto / PX_FILA) + 1;
      if (izq) filaIzq += filas; else filaDer += filas;
    });

    wb.views = [{ activeTab: 1 }];
    const buf = await wb.xlsx.writeBuffer();
    const nombre = 'Liquidaciones_' + sel.qd + (sel.qh !== sel.qd ? '_a_' + sel.qh : '') + (sel.conds.length === 1 ? '_' + sel.conds[0].replace(/\s+/g, '_') : '') + '.xlsx';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    mostrarMensaje('Excel generado: ' + nombre, 'exito');
  },

  /** Respaldo sin gráficos (si ExcelJS no carga). */
  _excelSimple: async function (sel) {
    const self = this, X = await self._cargarXlsx(), n2 = x => Math.round((Number(x) || 0) * 100) / 100;
    const enc = ['CONDUCTOR', 'QUINCENA', 'FECHA', 'PLACA', 'CLIENTE', 'DESTINO', 'CÓDIGO', 'N° VIÁTICO', 'KM', 'PEAJES', 'VIÁTICO', 'LLANTA', 'COCHERA', 'LAVADO', 'OTROS', 'MOTIVO OTROS', 'BONO', 'FERIADO', 'DOMINICAL', 'TOTAL GASTOS', 'MONTO DEPOSITADO', 'EXTRAS', 'TOTAL DEPÓSITO', 'TOTAL BONO', 'ESTADO'];
    const filas = sel.vis.map(f => [f.conductor, self._qTxt(f.quincena), self._f(f.fecha), f.placa, f.cliente, f.destino, f.clave, f.nroViatico, n2(f.km), n2(f.peajes), n2(f.viatico), n2(f.llanta), n2(f.cochera), n2(f.lavado), n2(f.otros), f.motivoOtros || '',
      n2(f.bono), n2(f.feriado), n2(f.dominical), n2(f.gastos), n2(f.depositado), n2(f.extras), n2(f.totalDep), n2(f.totalBono), self._EST_TXT[f.liqEstado] || f.liqEstado]);
    const g = self._agrupar(sel.vis, f => f.conductor);
    const res = Object.keys(g).sort().map(c => { const s = self._suma(g[c]); return [c, g[c].length, n2(s.km), n2(s.gastos), n2(s.totalDep), n2(s.totalBono)]; });
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([[self._periodoTxt(sel)], [], enc].concat(filas)), 'Liquidaciones');
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Resumen por conductor'], [], ['Conductor', 'Viajes', 'Km', 'Total gastos', 'Total depósito', 'Total bono']].concat(res)), 'Dashboard');
    X.writeFile(wb, 'Liquidaciones_' + sel.qd + '.xlsx');
    mostrarMensaje('Excel generado sin gráficos (no cargó el componente de gráficos).', 'exito');
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-liquidacion-conductores');
  if (b) b.addEventListener('click', function () { FormLiquidacionConductores.abrir(); });
});
