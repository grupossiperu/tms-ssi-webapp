/**
 * forms/liquidacionConductores.js  (v83)
 * -------------------------------------------------------------------------
 * Finanzas > "Liquidación de conductores". Sale del CONSOLIDADO (lo
 * realmente liquidado). Por viaje: peajes (peaje + S.D.C.F. + adicional),
 * viático, llanta, cochera, lavado, otros (con motivo), bono, feriado y
 * dominical = TOTAL GASTOS; depositado + extras (adicionales) = TOTAL
 * DEPÓSITO; SALDO = total depósito − total gastos
 *   (positivo = SALDO A FAVOR, negativo = SALDO EN CONTRA).
 * Vista por conductor y rango de fechas; resumen de todos los conductores.
 * Backend: liquidacionConductores().
 * -------------------------------------------------------------------------
 */
const FormLiquidacionConductores = {
  _filas: [],

  abrir: async function () {
    const self = this;
    const html = `
      <style>
        .lq-barra { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:end; margin-bottom:8px; }
        .lq-barra .campo { margin:0; min-width:150px; }
        .lq-wrap { max-height:calc(74vh - 230px); min-height:160px; overflow:auto; border:1px solid #e1e6ec; border-radius:10px; }
        .lq-t { width:100%; table-layout:fixed; border-collapse:collapse; font-size:.7rem; }
        .lq-t th { background:#bcd3ee; color:#1c3a5e; font-size:.64rem; padding:5px 3px; position:sticky; top:0; z-index:1; text-align:center; border:1px solid #9fb9d9; }
        .lq-t th.dep { background:#d7e8c9; border-color:#b6cfa1; } .lq-t th.res { background:#ffd8a8; border-color:#f5b76b; }
        .lq-t td { padding:4px 3px; border-bottom:1px solid #eef2f7; text-align:right; overflow-wrap:anywhere; }
        .lq-t td.i { text-align:left; } .lq-t td.c { text-align:center; }
        .lq-t td.tot { font-weight:800; background:#f1f5f9; } .lq-t td.dep { background:#f3f9ee; } .lq-t td.depT { font-weight:800; background:#e6f2dc; }
        .lq-t td.fav { color:#166534; font-weight:800; } .lq-t td.con { color:#b45309; font-weight:800; background:#fff3e0; }
        .lq-t tfoot td { font-weight:800; background:#e9eef5; position:sticky; bottom:0; }
        .lq-t tbody tr.clic { cursor:pointer; } .lq-t tbody tr.clic:hover td { background:#eef4fb; }
        .lq-res { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:10px 0 0; }
        .lq-res div { background:#f1f5f9; border-radius:9px; padding:7px 11px; border-left:4px solid #94a3b8; }
        .lq-res span { display:block; font-size:.66rem; font-weight:700; color:#64748b; text-transform:uppercase; }
        .lq-res b { font-size:1.05rem; color:#1c3a5e; } .lq-res .fav { border-left-color:#16a34a; } .lq-res .fav b { color:#166534; }
        .lq-res .con { border-left-color:#f59e0b; background:#fff7ed; } .lq-res .con b { color:#b45309; }
        .lq-mot { display:block; font-size:.6rem; color:#64748b; }
      </style>
      <div class="lq-barra">
        <div class="campo" style="min-width:240px"><label>Conductor</label><select id="lqCond"><option value="">Todos (resumen)</option></select></div>
        <div class="campo"><label>Servicio desde</label><input type="date" id="lqDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="lqHasta"></div>
        <div class="campo"><label>Placa</label><div id="msLqPlaca"></div></div>
        <button class="boton-secundario" id="lqBorrar" type="button">Borrar filtros</button>
      </div>
      <div id="lqCuerpo">Cargando…</div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="lqCerrar">Cerrar</button>
        <button class="boton-secundario" id="lqImprimir">Imprimir</button>
        <button class="boton-primario" id="lqCopiar">Copiar tabla</button>
      </div>`;
    abrirPanel('Liquidación de conductores', html, async function (raiz) {
      self._raiz = raiz;
      const $ = id => raiz.querySelector('#' + id);
      const msPlaca = crearMultiSelect($('msLqPlaca'), { onChange: () => self._pintar() });
      self._msPlaca = msPlaca;
      ['lqCond', 'lqDesde', 'lqHasta'].forEach(id => $(id).addEventListener('change', () => self._pintar()));
      $('lqBorrar').addEventListener('click', function () { ['lqCond', 'lqDesde', 'lqHasta'].forEach(id => { $(id).value = ''; }); msPlaca.limpiar(); self._pintar(); });
      $('lqCerrar').addEventListener('click', cerrarPanel);
      $('lqCopiar').addEventListener('click', () => self._copiar());
      $('lqImprimir').addEventListener('click', () => self._imprimir());
      const r = await llamarBackend('liquidacionConductores', {});
      if (!respuestaValida(r)) { $('lqCuerpo').textContent = (r && r.mensaje) || 'No se pudo cargar.'; return; }
      self._filas = (r.filas || []).map(function (f) {
        f.gastos = f.peajes + f.viatico + f.llanta + f.cochera + f.lavado + f.otros + f.bono + f.feriado + f.dominical;
        f.totalDep = f.depositado + f.extras;
        f.saldo = Math.round((f.totalDep - f.gastos) * 100) / 100;
        return f;
      });
      const conds = Array.from(new Set(self._filas.map(f => f.conductor))).sort();
      $('lqCond').innerHTML = '<option value="">Todos (resumen)</option>' + conds.map(c => '<option>' + esc(c) + '</option>').join('');
      msPlaca.setOpciones(Array.from(new Set(self._filas.map(f => f.placa).filter(Boolean))).sort());
      // Por defecto: mes actual
      const h = new Date(); $('lqDesde').value = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-01';
      self._pintar();
    }, { ancho: true });
  },

  _m: function (n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  _f: function (iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; },
  _vis: function () {
    const $ = id => this._raiz.querySelector('#' + id);
    const c = $('lqCond').value, de = $('lqDesde').value, ha = $('lqHasta').value;
    return this._filas.filter(f => (!c || f.conductor === c) && (!de || f.fecha >= de) && (!ha || f.fecha <= ha) && this._msPlaca.cumple(f.placa))
      .sort((a, b) => String(a.conductor).localeCompare(String(b.conductor)) || String(a.fecha).localeCompare(String(b.fecha)));
  },
  _suma: function (lista) {
    return lista.reduce(function (a, f) {
      ['peajes', 'viatico', 'llanta', 'cochera', 'lavado', 'otros', 'bono', 'feriado', 'dominical', 'gastos', 'depositado', 'extras', 'totalDep'].forEach(k => { a[k] = (a[k] || 0) + f[k]; });
      a.n = (a.n || 0) + 1; return a;
    }, {});
  },
  _saldoCelda: function (s) {
    if (Math.abs(s) < 0.005) return '<td class="c">—</td><td class="c">—</td>';
    return s > 0 ? '<td class="fav">S/ ' + this._m(s) + '</td><td></td>' : '<td></td><td class="con">S/ ' + this._m(-s) + '</td>';
  },

  _pintar: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const vis = self._vis(), cond = $('lqCond').value;
    if (!cond) {
      // Resumen por conductor
      const g = {};
      vis.forEach(f => { (g[f.conductor] = g[f.conductor] || []).push(f); });
      const filas = Object.keys(g).sort().map(k => Object.assign({ conductor: k }, self._suma(g[k])));
      const t = self._suma(vis);
      $('lqCuerpo').innerHTML = '<div class="lq-wrap"><table class="lq-t"><colgroup><col style="width:28%"><col><col><col><col><col><col></colgroup>' +
        '<thead><tr><th>Conductor</th><th>Viajes</th><th>Total gastos</th><th class="dep">Total depósito</th><th class="res">Saldo a favor</th><th class="res">Saldo en contra</th><th></th></tr></thead><tbody>' +
        (filas.length ? filas.map(r => '<tr class="clic" data-c="' + esc(r.conductor) + '"><td class="i"><b>' + esc(r.conductor) + '</b></td><td class="c">' + r.n + '</td><td>S/ ' + self._m(r.gastos) +
          '</td><td class="depT">S/ ' + self._m(r.totalDep) + '</td>' + self._saldoCelda(r.totalDep - r.gastos) + '<td class="c">Ver ›</td></tr>').join('')
          : '<tr><td colspan="7" class="c" style="color:#8b95a1;padding:14px">Sin viajes en el período.</td></tr>') +
        '</tbody><tfoot><tr><td class="i">TOTAL</td><td class="c">' + (t.n || 0) + '</td><td>S/ ' + self._m(t.gastos) + '</td><td>S/ ' + self._m(t.totalDep) + '</td>' + self._saldoCelda((t.totalDep || 0) - (t.gastos || 0)) + '<td></td></tr></tfoot></table></div>';
      $('lqCuerpo').querySelectorAll('tr[data-c]').forEach(tr => tr.addEventListener('click', () => { $('lqCond').value = tr.dataset.c; self._pintar(); }));
      _refrescarSnapshotFormulario();
      return;
    }
    const t = self._suma(vis);
    const saldo = (t.totalDep || 0) - (t.gastos || 0);
    $('lqCuerpo').innerHTML = '<div class="lq-wrap">' + self._tablaHtml(vis, false) + '</div>' +
      '<div class="lq-res"><div><span>Total gastos</span><b>S/ ' + self._m(t.gastos) + '</b></div><div><span>Total depósito (depositado + extras)</span><b>S/ ' + self._m(t.totalDep) + '</b></div>' +
      '<div><span>Viajes</span><b>' + (t.n || 0) + '</b></div><div class="' + (saldo >= 0 ? 'fav' : 'con') + '"><span>' + (saldo >= 0 ? 'Saldo a favor' : 'Saldo en contra') + '</span><b>S/ ' + self._m(Math.abs(saldo)) + '</b></div></div>';
    _refrescarSnapshotFormulario();
  },

  /** Tabla de detalle. paraCorreo = estilos en línea. */
  _tablaHtml: function (vis, paraCorreo) {
    const self = this, t = self._suma(vis);
    const cols = ['CONDUCTOR', 'PLACA', 'DESTINO', 'FECHA DEL SERVICIO', 'N° DE VIÁTICO', 'PEAJES', 'VIÁTICO', 'LLANTA', 'COCHERA', 'LAVADO', 'OTROS', 'BONO', 'FERIADO', 'DOMINICAL', 'TOTAL GASTOS',
      'MONTO DEPOSITADO', 'EXTRAS', 'TOTAL DEPÓSITO', 'SALDO A FAVOR', 'SALDO EN CONTRA'];
    const st = paraCorreo ? {
      th: 'style="background:#bcd3ee;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      thd: 'style="background:#d7e8c9;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      thr: 'style="background:#ffd8a8;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      td: function (al, extra) { return 'style="border:1px solid #c9d3df;padding:3px 6px;font-family:Calibri,Arial;font-size:10pt;text-align:' + al + ';' + (extra || '') + '"'; }
    } : null;
    const th = function (c, i) { const cls = i >= 15 && i <= 17 ? 'dep' : i >= 18 ? 'res' : ''; return paraCorreo ? '<th ' + (cls === 'dep' ? st.thd : cls === 'res' ? st.thr : st.th) + '>' + c + '</th>' : '<th class="' + cls + '">' + c + '</th>'; };
    const td = function (v, al, cls, extra) { return paraCorreo ? '<td ' + st.td(al, extra) + '>' + v + '</td>' : '<td class="' + (al === 'left' ? 'i ' : al === 'center' ? 'c ' : '') + (cls || '') + '">' + v + '</td>'; };
    const m = n => n ? self._m(n) : '';
    let h = paraCorreo ? '<table style="border-collapse:collapse">' : '<table class="lq-t"><colgroup><col style="width:9%"><col style="width:5%"><col style="width:7%"><col style="width:5.5%"><col style="width:4.5%"><col><col><col><col><col><col style="width:6%"><col><col><col><col><col><col><col><col><col><col></colgroup>';
    h += '<thead><tr>' + cols.map(th).join('') + '</tr></thead><tbody>';
    vis.forEach(function (f) {
      const s = f.saldo;
      h += '<tr>' + td(esc(f.conductor), 'left') + td(esc(f.placa), 'center') + td(esc(f.destino), 'left') + td(self._f(f.fecha), 'center') + td(esc(f.nroViatico), 'center') +
        td(m(f.peajes), 'right') + td(m(f.viatico), 'right') + td(m(f.llanta), 'right') + td(m(f.cochera), 'right') + td(m(f.lavado), 'right') +
        td(m(f.otros) + (f.otros && f.motivoOtros ? (paraCorreo ? '<br><span style="font-size:8pt;color:#555">' + esc(f.motivoOtros) + '</span>' : '<span class="lq-mot">' + esc(f.motivoOtros) + '</span>') : ''), 'right') +
        td(m(f.bono), 'right') + td(m(f.feriado), 'right') + td(m(f.dominical), 'right') + td(self._m(f.gastos), 'right', 'tot', 'font-weight:bold;background:#f1f5f9') +
        td(m(f.depositado), 'right', 'dep') + td(m(f.extras), 'right', 'dep') + td(self._m(f.totalDep), 'right', 'depT', 'font-weight:bold;background:#e6f2dc') +
        (s > 0.005 ? td('S/ ' + self._m(s), 'right', 'fav', 'color:#166534;font-weight:bold') : td('', 'right')) +
        (s < -0.005 ? td('S/ ' + self._m(-s), 'right', 'con', 'color:#b45309;font-weight:bold;background:#fff3e0') : td('', 'right')) + '</tr>';
    });
    if (!vis.length) h += '<tr><td colspan="20" style="text-align:center;color:#8b95a1;padding:14px">Sin viajes con estos filtros.</td></tr>';
    const sa = (t.totalDep || 0) - (t.gastos || 0);
    const tf = function (v, al) { return paraCorreo ? '<td ' + st.td(al || 'right', 'font-weight:bold;background:#e9eef5') + '>' + v + '</td>' : '<td>' + v + '</td>'; };
    h += '</tbody><tfoot><tr>' + (paraCorreo ? '<td colspan="5" ' + st.td('right', 'font-weight:bold;background:#e9eef5') + '>TOTAL (' + (t.n || 0) + ' viajes)</td>' : '<td colspan="5" class="i">TOTAL (' + (t.n || 0) + ' viajes)</td>') +
      ['peajes', 'viatico', 'llanta', 'cochera', 'lavado', 'otros', 'bono', 'feriado', 'dominical', 'gastos', 'depositado', 'extras', 'totalDep'].map(k => tf(self._m(t[k]))).join('') +
      tf(sa > 0.005 ? 'S/ ' + self._m(sa) : '') + tf(sa < -0.005 ? 'S/ ' + self._m(-sa) : '') + '</tr></tfoot></table>';
    return h;
  },

  _copiar: async function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    let vis = self._vis();
    if (!vis.length) { mostrarMensaje('No hay viajes para copiar.', 'error'); return; }
    const titulo = '<p style="font-family:Calibri,Arial;font-size:11pt"><b>LIQUIDACIÓN' + ($('lqCond').value ? ' — ' + esc($('lqCond').value) : '') + '</b>' +
      ($('lqDesde').value || $('lqHasta').value ? ' · del ' + (self._f($('lqDesde').value) || '…') + ' al ' + (self._f($('lqHasta').value) || '…') : '') + '</p>';
    const html = titulo + self._tablaHtml(vis, true);
    const txt = vis.map(f => [f.conductor, f.placa, f.destino, self._f(f.fecha), f.nroViatico, f.peajes, f.viatico, f.llanta, f.cochera, f.lavado, f.otros, f.bono, f.feriado, f.dominical,
      f.gastos.toFixed(2), f.depositado, f.extras, f.totalDep.toFixed(2), f.saldo > 0 ? f.saldo.toFixed(2) : '', f.saldo < 0 ? (-f.saldo).toFixed(2) : ''].join('\t')).join('\n');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([txt], { type: 'text/plain' }) })]);
      mostrarMensaje('Liquidación copiada (' + vis.length + ' viaje(s)). Pégala en el correo o en Excel con Ctrl+V.', 'exito');
    } catch (e) { mostrarMensaje('No se pudo copiar automáticamente.', 'error'); }
  },

  _imprimir: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const vis = self._vis();
    if (!vis.length) { mostrarMensaje('No hay viajes para imprimir.', 'error'); return; }
    const t = self._suma(vis), sa = (t.totalDep || 0) - (t.gastos || 0);
    const w = window.open('', '_blank');
    if (!w) { mostrarMensaje('El navegador bloqueó la ventana de impresión.', 'error'); return; }
    w.document.write('<html><head><title>Liquidación</title><style>@page{size:A4 landscape;margin:10mm} body{font-family:Calibri,Arial}</style></head><body>' +
      '<h3 style="margin:0 0 4px">TRANSPORTES SSI S.A.C. — LIQUIDACIÓN DE CONDUCTOR' + ($('lqCond').value ? ': ' + esc($('lqCond').value) : 'ES') + '</h3>' +
      '<div style="font-size:10pt;margin-bottom:8px">Período: ' + (self._f($('lqDesde').value) || 'inicio') + ' al ' + (self._f($('lqHasta').value) || 'hoy') + '</div>' +
      self._tablaHtml(vis, true) +
      '<p style="font-size:11pt;margin-top:10px"><b>Total gastos:</b> S/ ' + self._m(t.gastos) + ' &nbsp; · &nbsp; <b>Total depósito:</b> S/ ' + self._m(t.totalDep) +
      ' &nbsp; · &nbsp; <b>' + (sa >= 0 ? 'SALDO A FAVOR' : 'SALDO EN CONTRA') + ':</b> S/ ' + self._m(Math.abs(sa)) + '</p>' +
      '<table style="margin-top:40px;width:100%;font-size:10pt"><tr><td style="text-align:center">______________________<br>Conductor</td><td style="text-align:center">______________________<br>Transportes SSI</td></tr></table>' +
      '<script>window.onload=function(){window.print();}<\/script></body></html>');
    w.document.close();
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-liquidacion-conductores');
  if (b) b.addEventListener('click', function () { FormLiquidacionConductores.abrir(); });
});
