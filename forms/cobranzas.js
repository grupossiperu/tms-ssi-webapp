/**
 * forms/cobranzas.js  (v79)
 * -------------------------------------------------------------------------
 * Finanzas > "Cobranzas" (cuentas por cobrar).
 *  - Resumen por cliente: por cobrar, vencido, por vencer y detracción pendiente.
 *  - Detalle del cliente: sus facturas con 2 saldos (neto a SSI y detracción).
 *  - Registrar abono / nota de crédito: el monto se reparte a mano entre las
 *    facturas; solo graba si el reparto cuadra con el monto.
 *  - Forma de pago por factura (con/sin detracción, con/sin IGV) y estado de
 *    la detracción (pendiente / depositada con fecha y constancia).
 *  - Historial de abonos (anular) y "Copiar estado de cuenta" para el correo.
 *  - v80: vista "Todas las facturas" con filtros (cliente, estado, vencimiento,
 *    fechas, tipo, detracción, moneda, búsqueda) y copiar tabla para correo.
 * Backend: cobranzaDatos, cobranzaGrabarCobro, cobranzaAnularCobro,
 *          cobranzaGuardarFactura.
 * -------------------------------------------------------------------------
 */
const FormCobranzas = {
  _d: null,

  abrir: async function () {
    const self = this;
    const html = `
      <style>
        .cb-kpis { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; margin-bottom:10px; }
        .cb-kpi { background:#f1f5f9; border-radius:9px; padding:7px 11px; border-left:4px solid #94a3b8; }
        .cb-kpi span { display:block; font-size:.66rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.3px; }
        .cb-kpi b { font-size:1.05rem; color:#1c3a5e; }
        .cb-kpi.rojo { border-left-color:#dc2626; background:#fef2f2; } .cb-kpi.rojo b { color:#b91c1c; }
        .cb-kpi.ambar { border-left-color:#d97706; background:#fffbeb; }
        .cb-barra { display:flex; flex-wrap:wrap; gap:8px 10px; align-items:end; margin-bottom:8px; }
        .cb-barra .campo { margin:0; min-width:130px; }
        .cb-wrap { max-height:calc(74vh - 230px); min-height:180px; overflow:auto; border:1px solid #e1e6ec; border-radius:10px; }
        .cb-t { width:100%; table-layout:fixed; border-collapse:collapse; font-size:.76rem; }
        .cb-t th { background:#1c3a5e; color:#fff; font-size:.68rem; padding:6px 5px; position:sticky; top:0; z-index:1; text-align:center; }
        .cb-t td { padding:5px; border-bottom:1px solid #eef2f7; text-align:right; overflow-wrap:anywhere; vertical-align:middle; }
        .cb-t td.i { text-align:left; } .cb-t td.c { text-align:center; }
        .cb-t tbody tr:hover td { background:#f5f9fd; }
        .cb-t tfoot td { font-weight:800; background:#eef3f8; position:sticky; bottom:0; }
        #cbTablaT tfoot td { position:static; }
        .cb-b { display:inline-block; padding:2px 7px; border-radius:10px; font-size:.66rem; font-weight:800; white-space:nowrap; }
        .cb-b.FACTURADO { background:#e0e7ff; color:#3730a3; } .cb-b.PAGO { background:#fef3c7; color:#92400e; }
        .cb-b.PAGADO { background:#dcfce7; color:#166534; } .cb-b.VENCIDO { background:#fee2e2; color:#b91c1c; }
        .cb-b.SIN { background:#f1f5f9; color:#64748b; } .cb-b.DEP { background:#dcfce7; color:#166534; } .cb-b.PEND { background:#ffedd5; color:#9a3412; }
        .cb-rojo { color:#b91c1c; font-weight:700; } .cb-gris { color:#94a3b8; }
        .cb-mini { padding:3px 8px; font-size:.7rem; border-radius:6px; border:1px solid #cbd5e1; background:#fff; cursor:pointer; }
        .cb-mini:hover { background:#eef4fb; }
        .cb-caja { background:#f8fafc; border:1px solid #dbe2ea; border-radius:10px; padding:10px 12px; margin-bottom:10px; }
        .cb-caja h3 { margin:0 0 8px; font-size:.86rem; color:#1c3a5e; }
        .cb-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:6px 10px; align-items:end; }
        .cb-grid .campo { margin:0; } .cb-grid input, .cb-grid select { width:100%; }
        .cb-cuadre { margin-top:8px; font-size:.8rem; font-weight:700; }
        .cb-cuadre.ok { color:#166534; } .cb-cuadre.mal { color:#b91c1c; }
        .cb-aplicar { width:100%; text-align:right; padding:3px 5px; }
        .cb-tit { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; }
        .cb-tit h3 { margin:0; color:#1c3a5e; font-size:.95rem; } .cb-tit small { color:#64748b; }
        .cb-hist { font-size:.76rem; }
        @media (max-width:1000px){ .cb-kpis{grid-template-columns:repeat(2,minmax(0,1fr));} .cb-grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
      </style>
      <div id="cbVista">Cargando…</div>`;
    abrirPanel('Cobranzas', html, function (raiz) { self._raiz = raiz; self._cargar(); }, { ancho: true });
  },

  _cargar: async function (clienteAbierto) {
    const r = await llamarBackend('cobranzaDatos', {});
    if (!respuestaValida(r)) { this._raiz.querySelector('#cbVista').textContent = (r && r.mensaje) || 'No se pudieron cargar las cobranzas.'; return; }
    this._d = r;
    if (clienteAbierto) this._detalle(clienteAbierto); else this._resumen();
  },

  /* ---------- utilidades ---------- */
  _m: function (n, mon) { return (mon === 'PEN' ? 'S/ ' : '$ ') + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  _f: function (iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; },
  _badge: function (f) {
    if (f.estado === 'SIN MONTO') return '<span class="cb-b SIN">SIN MONTO</span>';
    if (f.estado === 'PAGADO') return '<span class="cb-b PAGADO">PAGADO</span>';
    const b = f.estado === 'PAGO PARCIAL' ? '<span class="cb-b PAGO">PAGO PARCIAL</span>' : '<span class="cb-b FACTURADO">FACTURADO</span>';
    return b + (f.vencido ? ' <span class="cb-b VENCIDO">VENCIDO ' + f.diasVencido + ' d</span>' : '');
  },
  _vence: function (f) {
    if (!f.vencimiento) return '—';
    if (f.estado === 'PAGADO' || f.estado === 'SIN MONTO') return this._f(f.vencimiento);
    const d = -f.diasVencido;
    return this._f(f.vencimiento) + '<br><small class="' + (d < 0 ? 'cb-rojo' : d <= 5 ? '' : 'cb-gris') + '">' +
      (d < 0 ? 'hace ' + (-d) + ' d' : d === 0 ? 'vence hoy' : 'en ' + d + ' d') + '</small>';
  },
  _detrBadge: function (f) {
    if (f.detrEstado === 'NO APLICA') return '<span class="cb-gris">No aplica</span>';
    return f.detrEstado === 'DEPOSITADA' ? '<span class="cb-b DEP" title="' + esc(this._f(f.detrFecha) + ' · ' + f.detrConstancia) + '">DEPOSITADA</span>' : '<span class="cb-b PEND">PENDIENTE</span>';
  },
  _pendiente: function (f) { return f.estado === 'FACTURADO' || f.estado === 'PAGO PARCIAL'; },

  /* ---------- copiar tabla de cobranza (formato del correo) ---------- */
  _copiar: async function (lista) {
    const self = this;
    const vis = (lista || []).filter(f => f.estado !== 'SIN MONTO');
    if (!vis.length) { mostrarMensaje('No hay facturas para copiar con estos filtros.', 'error'); return; }
    const monTxt = m => m === 'PEN' ? 'SOLES (S/)' : 'DÓLARES AMERICANOS (USD)';
    const num = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const filas = [];
    vis.forEach(function (f) {
      const canc = f.estado === 'PAGADO' ? 'PAGADO ' + self._f(f.ultimoPago) : f.vencido ? 'VENCIDO' : 'POR VENCER';
      filas.push({ razon: f.razon, emision: self._f(f.fecha), numero: f.numero, moneda: monTxt(f.moneda), importe: num(f.conIgv ? f.total : f.valor),
        detr: num(f.detr ? f.detraccion : 0), saldo: num(f.saldo), venc: self._f(f.vencimiento), canc: canc, rojo: f.vencido });
      f.pagos.filter(p => p.tipo === 'NOTA CREDITO').forEach(function (p) {
        filas.push({ razon: f.razon, emision: self._f(p.fecha), numero: p.operacion, moneda: monTxt(f.moneda), importe: '-' + num(p.monto), detr: num(0), saldo: '-' + num(p.monto), venc: '', canc: f.numero, rojo: false });
      });
    });
    const cab = ['Razón Social', 'Fecha Emisión', 'Número de la Factura', 'Moneda', 'Importe', 'Monto de Detracción', 'Saldo a Pagar', 'Fecha de Vencimiento', 'Estado de Pago'];
    const th = 'style="background:#d9d9d9;border:1px solid #808080;padding:4px 8px;font-family:Calibri,Arial;font-size:11pt;font-weight:bold;text-align:center"';
    const td = (al, rojo) => 'style="border:1px solid #bfbfbf;padding:3px 8px;font-family:Calibri,Arial;font-size:11pt;text-align:' + al + ';color:' + (rojo ? '#c00000' : '#000') + '"';
    const tot = vis.reduce((a, f) => a + f.saldo, 0);
    let h = '<table style="border-collapse:collapse"><tr>' + cab.map(c => '<th ' + th + '>' + c + '</th>').join('') + '</tr>';
    filas.forEach(function (x) {
      h += '<tr><td ' + td('left', x.rojo) + '>' + esc(x.razon) + '</td><td ' + td('center', x.rojo) + '>' + x.emision + '</td><td ' + td('center', x.rojo) + '>' + esc(x.numero) +
        '</td><td ' + td('left', x.rojo) + '>' + x.moneda + '</td><td ' + td('right', x.rojo) + '>' + x.importe + '</td><td ' + td('right', x.rojo) + '>' + x.detr +
        '</td><td ' + td('right', x.rojo) + '>' + x.saldo + '</td><td ' + td('center', x.rojo) + '><b>' + x.venc + '</b></td><td ' + td('center', x.rojo) + '><b>' + esc(x.canc) + '</b></td></tr>';
    });
    h += '<tr><td colspan="6" ' + td('right', false) + '><b>TOTAL SALDO A PAGAR</b></td><td ' + td('right', false) + '><b>' + num(tot) + '</b></td><td colspan="2" ' + td('center', false) + '></td></tr></table>';
    const txt = cab.join('\t') + '\n' + filas.map(x => [x.razon, x.emision, x.numero, x.moneda, x.importe, x.detr, x.saldo, x.venc, x.canc].join('\t')).join('\n');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([h], { type: 'text/html' }), 'text/plain': new Blob([txt], { type: 'text/plain' }) })]);
      mostrarMensaje('Estado de cuenta copiado (' + vis.length + ' factura(s)). Pégalo en el correo con Ctrl+V.', 'exito');
    } catch (e) { mostrarMensaje('No se pudo copiar automáticamente.', 'error'); }
  },

  /* ---------- vista 1: resumen por cliente ---------- */
  _resumen: function () {
    const self = this, d = self._d, raiz = self._raiz;
    const grupos = {};
    d.facturas.forEach(function (f) {
      const k = f.cliente + '|' + f.moneda;
      const g = grupos[k] = grupos[k] || { cliente: f.cliente, razon: f.razon, moneda: f.moneda, dias: f.diasCredito, n: 0, porCobrar: 0, vencido: 0, porVencer: 0, detr: 0, nDetr: 0, masAntigua: '' };
      if (self._pendiente(f)) {
        g.n++; g.porCobrar += f.saldo;
        if (f.vencido) { g.vencido += f.saldo; if (!g.masAntigua || f.vencimiento < g.masAntigua) g.masAntigua = f.vencimiento; } else g.porVencer += f.saldo;
      }
      if (f.detrEstado === 'PENDIENTE') { g.detr += f.detraccion; g.nDetr++; }
    });
    const lista = Object.keys(grupos).map(k => grupos[k]).sort((a, b) => b.vencido - a.vencido || b.porCobrar - a.porCobrar);
    const usd = lista.filter(g => g.moneda === 'USD');
    const tot = usd.reduce((a, g) => { a.pc += g.porCobrar; a.v += g.vencido; a.pv += g.porVencer; a.dt += g.detr; return a; }, { pc: 0, v: 0, pv: 0, dt: 0 });
    const nVenc = d.facturas.filter(f => f.vencido).length;
    const kpi = (t, v, c) => '<div class="cb-kpi ' + (c || '') + '"><span>' + t + '</span><b>' + v + '</b></div>';
    raiz.querySelector('#cbVista').innerHTML =
      '<div class="cb-kpis">' + kpi('Por cobrar (USD)', self._m(tot.pc)) + kpi('Vencido', self._m(tot.v), 'rojo') + kpi('Por vencer', self._m(tot.pv)) +
      kpi('Facturas vencidas', nVenc, nVenc ? 'rojo' : '') + kpi('Detracción pendiente', self._m(tot.dt), 'ambar') + '</div>' +
      '<div class="cb-barra"><div class="campo"><label>Buscar cliente</label><input id="cbBuscar" placeholder="Código o razón social" autocomplete="off"></div>' +
      '<div class="campo"><label>Mostrar</label><select id="cbMostrarCli"><option value="deuda">Con deuda o detracción pendiente</option><option value="todos">Todos</option></select></div>' +
      '<button class="boton-primario" id="cbTodas">Todas las facturas (filtros y copiar)</button>' +
      '<span style="font-size:.76rem;color:#64748b">Haz clic en un cliente para ver sus facturas, registrar abonos o copiar su estado de cuenta.</span></div>' +
      '<div class="cb-wrap"><table class="cb-t"><colgroup><col style="width:11%"><col style="width:25%"><col style="width:7%"><col style="width:6%"><col><col><col><col><col style="width:9%"></colgroup>' +
      '<thead><tr><th>Cliente</th><th>Razón social</th><th>Crédito</th><th>Fact. pend.</th><th>Por cobrar</th><th>Vencido</th><th>Por vencer</th><th>Detracción pend.</th><th></th></tr></thead>' +
      '<tbody id="cbCuerpoCli"></tbody></table></div>' +
      '<div class="panel-footer" style="padding-top:10px;"><button class="boton-secundario" id="cbCerrar">Cerrar</button><button class="boton-secundario" id="cbActualizar">Actualizar</button></div>';
    const pintar = function () {
      const q = raiz.querySelector('#cbBuscar').value.trim().toUpperCase();
      const todos = raiz.querySelector('#cbMostrarCli').value === 'todos';
      const vis = lista.filter(g => (todos || g.porCobrar > 0.009 || g.detr > 0.009) && (!q || (g.cliente + ' ' + g.razon).toUpperCase().indexOf(q) !== -1));
      raiz.querySelector('#cbCuerpoCli').innerHTML = vis.length ? vis.map(g => '<tr data-cli="' + esc(g.cliente) + '" style="cursor:pointer"><td class="i"><b>' + esc(g.cliente) + '</b>' +
        (g.moneda === 'PEN' ? ' <small>(S/)</small>' : '') + '</td><td class="i">' + esc(g.razon) + '</td><td class="c">' + g.dias + ' d</td><td class="c">' + g.n + '</td><td>' + self._m(g.porCobrar, g.moneda) +
        '</td><td class="' + (g.vencido > 0.009 ? 'cb-rojo' : '') + '">' + self._m(g.vencido, g.moneda) + (g.masAntigua ? '<br><small>desde ' + self._f(g.masAntigua) + '</small>' : '') +
        '</td><td>' + self._m(g.porVencer, g.moneda) + '</td><td>' + self._m(g.detr, g.moneda) + (g.nDetr ? '<br><small>' + g.nDetr + ' fact.</small>' : '') +
        '</td><td class="c"><button class="cb-mini">Ver ›</button></td></tr>').join('')
        : '<tr><td colspan="9" class="c" style="color:#8b95a1;padding:16px">Sin clientes con estos filtros.</td></tr>';
      _refrescarSnapshotFormulario();
    };
    raiz.querySelector('#cbBuscar').addEventListener('input', pintar);
    raiz.querySelector('#cbMostrarCli').addEventListener('change', pintar);
    raiz.querySelector('#cbCuerpoCli').addEventListener('click', function (ev) { const tr = ev.target.closest('tr[data-cli]'); if (tr) self._detalle(tr.dataset.cli); });
    raiz.querySelector('#cbCerrar').addEventListener('click', solicitarCierrePanel);
    raiz.querySelector('#cbActualizar').addEventListener('click', function () { self._cargar(); });
    raiz.querySelector('#cbTodas').addEventListener('click', function () { self._facturas(); });
    pintar();
  },

  /* ---------- vista 3: todas las facturas con filtros ---------- */
  _facturas: function () {
    const self = this, d = self._d, raiz = self._raiz;
    const todas = d.facturas.slice().sort((a, b) => String(a.cliente).localeCompare(String(b.cliente)) || String(a.fecha).localeCompare(String(b.fecha)) || String(a.numero).localeCompare(String(b.numero)));
    raiz.querySelector('#cbVista').innerHTML =
      '<div class="cb-tit"><div><h3>Todas las facturas</h3><small>Filtra y copia la tabla para enviar la cobranza por correo.</small></div><div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="boton-secundario" id="cbFVolver">‹ Por cliente</button><button class="boton-secundario" id="cbFLimpiar">Borrar filtros</button><button class="boton-primario" id="cbFCopiar">Copiar tabla para correo</button></div></div>' +
      '<div class="cb-barra">' +
      '<div class="campo"><label>Cliente</label><div id="msCbCli"></div></div>' +
      '<div class="campo"><label>Estado</label><div id="msCbEst"></div></div>' +
      '<div class="campo"><label>Vencimiento</label><select id="cbFVen"><option value="">Todos</option><option value="venc">Vencidas</option><option value="7">Vencen en 7 días</option><option value="pv">Por vencer</option></select></div>' +
      '<div class="campo"><label>Emitida desde</label><input type="date" id="cbFDesde"></div><div class="campo"><label>Hasta</label><input type="date" id="cbFHasta"></div>' +
      '<div class="campo"><label>Vence desde</label><input type="date" id="cbFVDesde"></div><div class="campo"><label>Hasta</label><input type="date" id="cbFVHasta"></div>' +
      '<div class="campo"><label>Tipo</label><div id="msCbTipo"></div></div>' +
      '<div class="campo"><label>Detracción</label><select id="cbFDetr"><option value="">Todas</option><option value="PENDIENTE">Pendiente</option><option value="DEPOSITADA">Depositada</option><option value="NO APLICA">No aplica</option></select></div>' +
      '<div class="campo"><label>Moneda</label><select id="cbFMon"><option value="">Todas</option><option value="USD">USD</option><option value="PEN">S/</option></select></div>' +
      '<div class="campo"><label>Buscar</label><input id="cbFBuscar" placeholder="Factura, booking, contenedor o código" autocomplete="off"></div></div>' +
      '<div class="cb-wrap"><table class="cb-t" id="cbTablaT"><colgroup><col style="width:9%"><col style="width:8%"><col style="width:6%"><col style="width:7%"><col style="width:8%"><col><col><col><col><col style="width:13%"><col style="width:8%"><col style="width:5%"></colgroup>' +
      '<thead><tr><th>Cliente</th><th>Factura</th><th>Tipo</th><th>Emisión</th><th>Vence</th><th>Importe</th><th>Detracción</th><th>A cobrar</th><th>Saldo</th><th>Estado</th><th>Detracción</th><th></th></tr></thead>' +
      '<tbody></tbody><tfoot></tfoot></table></div>' +
      '<div class="panel-footer" style="padding-top:10px;"><button class="boton-secundario" id="cbFCerrar">Cerrar</button></div>';
    const $ = id => raiz.querySelector('#' + id);
    let vis = [];
    const hoy = d.hoy;
    const en7 = (function () { const m = hoy.match(/^(\d{4})-(\d{2})-(\d{2})/); const f = new Date(+m[1], +m[2] - 1, +m[3] + 7); return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0'); })();
    const pintar = function () {
      const ven = $('cbFVen').value, de = $('cbFDesde').value, ha = $('cbFHasta').value, vde = $('cbFVDesde').value, vha = $('cbFVHasta').value;
      const detr = $('cbFDetr').value, mon = $('cbFMon').value, q = $('cbFBuscar').value.trim().toUpperCase();
      vis = todas.filter(function (f) {
        const estTxt = f.vencido ? 'VENCIDO' : f.estado;
        if (!msCli.cumple(f.cliente) || !msTipo.cumple(f.tipo)) return false;
        if (!msEst.cumple(f.estado) && !(f.vencido && msEst.cumple('VENCIDO'))) return false;
        if (ven === 'venc' && !f.vencido) return false;
        if (ven === 'pv' && !(self._pendiente(f) && !f.vencido)) return false;
        if (ven === '7' && !(self._pendiente(f) && f.vencimiento >= hoy && f.vencimiento <= en7)) return false;
        if (de && f.fecha < de) return false; if (ha && f.fecha > ha) return false;
        if (vde && f.vencimiento < vde) return false; if (vha && f.vencimiento > vha) return false;
        if (detr && f.detrEstado !== detr) return false;
        if (mon && f.moneda !== mon) return false;
        if (q && (f.numero + ' ' + f.servicios.map(s => s.booking + ' ' + s.contenedor + ' ' + s.codigo).join(' ')).toUpperCase().indexOf(q) === -1) return false;
        return estTxt !== undefined;
      });
      $('cbTablaT').querySelector('tbody').innerHTML = vis.length ? vis.slice(0, 600).map(f => '<tr><td class="i"><b>' + esc(f.cliente) + '</b></td><td class="i"><b>' + esc(f.numero) +
        '</b><br><small class="cb-gris">' + esc(f.servicios[0] ? f.servicios[0].booking : '') + '</small></td><td class="c">' + esc(f.tipo.slice(0, 5)) + '</td><td class="c">' + self._f(f.fecha) +
        '</td><td class="c">' + self._vence(f) + '</td><td>' + self._m(f.conIgv ? f.total : f.valor, f.moneda) + '</td><td>' + (f.detr ? self._m(f.detraccion, f.moneda) : '<span class="cb-gris">sin detr.</span>') +
        '</td><td>' + self._m(f.aCobrar, f.moneda) + '</td><td class="' + (f.vencido ? 'cb-rojo' : '') + '"><b>' + self._m(f.saldo, f.moneda) + '</b></td><td class="c">' + self._badge(f) +
        '</td><td class="c">' + self._detrBadge(f) + '</td><td class="c"><button class="cb-mini" data-cli="' + esc(f.cliente) + '" title="Abrir cliente">›</button></td></tr>').join('') +
        (vis.length > 600 ? '<tr><td colspan="12" class="c cb-gris">Se muestran 600 de ' + vis.length + '. Usa los filtros (la copia incluye todas).</td></tr>' : '')
        : '<tr><td colspan="12" class="c" style="color:#8b95a1;padding:16px">No hay facturas con estos filtros.</td></tr>';
      const tot = {};
      vis.forEach(f => { const t = tot[f.moneda] = tot[f.moneda] || { ac: 0, s: 0, n: 0 }; t.ac += f.aCobrar; t.s += f.saldo; t.n++; });
      $('cbTablaT').querySelector('tfoot').innerHTML = Object.keys(tot).map(m => '<tr><td colspan="7" class="i">TOTAL ' + (m === 'PEN' ? 'S/' : 'USD') + ' · ' + tot[m].n + ' factura(s)</td><td>' +
        self._m(tot[m].ac, m) + '</td><td>' + self._m(tot[m].s, m) + '</td><td colspan="3"></td></tr>').join('');
      _refrescarSnapshotFormulario();
    };
    const msCli = crearMultiSelect($('msCbCli'), { onChange: pintar });
    const msEst = crearMultiSelect($('msCbEst'), { onChange: pintar });
    const msTipo = crearMultiSelect($('msCbTipo'), { onChange: pintar });
    msCli.setOpciones(Array.from(new Set(todas.map(f => f.cliente))).sort());
    msEst.setOpciones(['FACTURADO', 'PAGO PARCIAL', 'PAGADO', 'VENCIDO', 'SIN MONTO']);
    msTipo.setOpciones(['VIAJE', 'SOBRECOSTO', 'BALANZA']);
    ['cbFVen', 'cbFDesde', 'cbFHasta', 'cbFVDesde', 'cbFVHasta', 'cbFDetr', 'cbFMon'].forEach(id => $(id).addEventListener('change', pintar));
    $('cbFBuscar').addEventListener('input', pintar);
    $('cbFLimpiar').addEventListener('click', function () {
      [msCli, msEst, msTipo].forEach(m => m.limpiar());
      ['cbFVen', 'cbFDesde', 'cbFHasta', 'cbFVDesde', 'cbFVHasta', 'cbFDetr', 'cbFMon', 'cbFBuscar'].forEach(id => { $(id).value = ''; });
      pintar();
    });
    $('cbFVolver').addEventListener('click', function () { self._resumen(); });
    $('cbFCerrar').addEventListener('click', solicitarCierrePanel);
    $('cbFCopiar').addEventListener('click', function () { self._copiar(vis); });
    $('cbTablaT').addEventListener('click', function (ev) { const b = ev.target.closest('[data-cli]'); if (b) self._detalle(b.dataset.cli); });
    pintar();
  },

  /* ---------- vista 2: detalle del cliente ---------- */
  _detalle: function (cliente) {
    const self = this, d = self._d, raiz = self._raiz;
    const facts = d.facturas.filter(f => f.cliente === cliente)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.numero).localeCompare(String(b.numero)));
    const info = facts[0] || { razon: '', ruc: '', diasCredito: 30 };
    const cobros = d.cobros.filter(c => c.cliente === cliente);
    const monedas = Array.from(new Set(facts.map(f => f.moneda)));
    let modo = null;   // null | {tipo:'ABONO'|'NOTA CREDITO'}
    const aplicar = {}; // key -> monto
    raiz.querySelector('#cbVista').innerHTML =
      '<div class="cb-tit"><div><h3>' + esc(cliente) + ' · ' + esc(info.razon) + '</h3><small>RUC ' + esc(info.ruc || '—') + ' · crédito ' + info.diasCredito +
      ' días · ' + facts.length + ' factura(s)</small></div><div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="boton-secundario" id="cbVolver">‹ Volver</button><button class="boton-primario" id="cbAbono">Registrar abono</button>' +
      '<button class="boton-secundario" id="cbNC">Nota de crédito</button><button class="boton-secundario" id="cbHist">Historial (' + cobros.length + ')</button>' +
      '<button class="boton-secundario" id="cbCopiar">Copiar estado de cuenta</button></div></div>' +
      '<div id="cbForm"></div><div id="cbHistBox"></div>' +
      '<div class="cb-barra"><div class="campo"><label>Mostrar</label><select id="cbMostrar"><option value="pend">Pendientes</option><option value="venc">Solo vencidas</option><option value="detr">Detracción pendiente</option><option value="todas">Todas</option></select></div>' +
      (monedas.length > 1 ? '<div class="campo"><label>Moneda</label><select id="cbMon">' + monedas.map(m => '<option>' + m + '</option>').join('') + '</select></div>' : '') +
      '<div class="campo"><label>Emitida desde</label><input type="date" id="cbDDesde"></div><div class="campo"><label>Hasta</label><input type="date" id="cbDHasta"></div>' +
      '<div class="campo"><label>Buscar</label><input id="cbBuscarF" placeholder="Factura, booking o contenedor" autocomplete="off"></div></div>' +
      '<div class="cb-wrap"><table class="cb-t" id="cbTablaF"><colgroup><col style="width:8%"><col style="width:6%"><col style="width:7%"><col style="width:8%"><col><col><col><col><col style="width:13%"><col style="width:8%"><col style="width:9%"></colgroup>' +
      '<thead><tr><th>Factura</th><th>Tipo</th><th>Emisión</th><th>Vence</th><th>Importe</th><th>Detracción</th><th>A cobrar</th><th>Saldo</th><th>Estado</th><th>Detracción</th><th id="cbThAcc"></th></tr></thead>' +
      '<tbody></tbody><tfoot></tfoot></table></div>';
    const $ = id => raiz.querySelector('#' + id);
    const monedaSel = () => ($('cbMon') ? $('cbMon').value : (monedas[0] || 'USD'));

    const visibles = function () {
      const m = $('cbMostrar').value, q = $('cbBuscarF').value.trim().toUpperCase(), mon = monedaSel(), de = $('cbDDesde').value, ha = $('cbDHasta').value;
      return facts.filter(f => f.moneda === mon && (!de || f.fecha >= de) && (!ha || f.fecha <= ha) &&
        (m === 'todas' || (m === 'pend' && self._pendiente(f)) || (m === 'venc' && f.vencido) || (m === 'detr' && f.detrEstado === 'PENDIENTE') || (modo && aplicar[f.key])) &&
        (!q || (f.numero + ' ' + f.servicios.map(s => s.booking + ' ' + s.contenedor + ' ' + s.codigo).join(' ')).toUpperCase().indexOf(q) !== -1));
    };
    const pintar = function () {
      const vis = visibles(), mon = monedaSel();
      $('cbThAcc').textContent = modo ? 'Aplicar' : '';
      $('cbTablaF').querySelector('tbody').innerHTML = vis.length ? vis.map(function (f) {
        const imp = f.conIgv ? f.total : f.valor;
        const srv = f.servicios.map(s => s.booking + ' / ' + s.contenedor).join(' · ');
        let acc;
        if (modo) {
          acc = self._pendiente(f) ? '<input class="cb-aplicar" data-k="' + esc(f.key) + '" type="number" step="0.01" min="0" value="' + (aplicar[f.key] || '') + '" placeholder="0.00">' +
            '<button class="cb-mini" data-llenar="' + esc(f.key) + '" style="margin-top:2px;width:100%">Saldo</button>' : '';
        } else {
          acc = (self._pendiente(f) ? '<button class="cb-mini" data-pagar="' + esc(f.key) + '">Pagar</button> ' : '') + '<button class="cb-mini" data-editar="' + esc(f.key) + '">Editar</button>';
        }
        return '<tr><td class="i" title="' + esc(srv) + '"><b>' + esc(f.numero) + '</b><br><small class="cb-gris">' + esc(f.servicios[0] ? f.servicios[0].booking : '') +
          (f.servicios.length > 1 ? ' +' + (f.servicios.length - 1) : '') + '</small></td><td class="c">' + esc(f.tipo.slice(0, 5)) + '</td><td class="c">' + self._f(f.fecha) +
          '</td><td class="c">' + self._vence(f) + '</td><td>' + self._m(imp, f.moneda) + (f.conIgv ? '' : '<br><small class="cb-gris">sin IGV</small>') +
          '</td><td>' + (f.detr ? self._m(f.detraccion, f.moneda) : '<span class="cb-gris">sin detr.</span>') + '</td><td>' + self._m(f.aCobrar, f.moneda) +
          '</td><td class="' + (f.vencido ? 'cb-rojo' : '') + '"><b>' + self._m(f.saldo, f.moneda) + '</b>' +
          (f.cobrado || f.notasCredito ? '<br><small class="cb-gris">cobrado ' + self._m(f.cobrado + f.notasCredito, f.moneda) + '</small>' : '') +
          '</td><td class="c">' + self._badge(f) + '</td><td class="c">' + self._detrBadge(f) + '</td><td class="c">' + acc + '</td></tr>';
      }).join('') : '<tr><td colspan="11" class="c" style="color:#8b95a1;padding:16px">No hay facturas con estos filtros.</td></tr>';
      const t = vis.reduce((a, f) => { a.ac += f.aCobrar; a.s += f.saldo; a.dt += f.detrEstado === 'PENDIENTE' ? f.detraccion : 0; return a; }, { ac: 0, s: 0, dt: 0 });
      $('cbTablaF').querySelector('tfoot').innerHTML = vis.length ? '<tr><td colspan="6" class="i">TOTAL ' + vis.length + ' factura(s) · detracción pendiente ' + self._m(t.dt, mon) +
        '</td><td>' + self._m(t.ac, mon) + '</td><td>' + self._m(t.s, mon) + '</td><td colspan="3"></td></tr>' : '';
      cuadre();
      _refrescarSnapshotFormulario();
    };

    /* --- formulario de abono / nota de crédito --- */
    const cuadre = function () {
      if (!modo || !$('cbFMonto')) return;
      const monto = Number($('cbFMonto').value) || 0;
      const suma = Object.keys(aplicar).reduce((a, k) => a + (Number(aplicar[k]) || 0), 0);
      const dif = Math.round((monto - suma) * 100) / 100;
      const el = $('cbCuadre');
      el.className = 'cb-cuadre ' + (monto > 0 && Math.abs(dif) < 0.005 ? 'ok' : 'mal');
      el.textContent = 'Monto ' + self._m(monto, monedaSel()) + ' · repartido ' + self._m(suma, monedaSel()) + ' · ' +
        (Math.abs(dif) < 0.005 ? (monto > 0 ? '✔ cuadra' : 'escribe el monto') : (dif > 0 ? 'falta repartir ' : 'te pasaste por ') + self._m(Math.abs(dif), monedaSel()));
      $('cbFGrabar').disabled = !(monto > 0 && Math.abs(dif) < 0.005);
    };
    const abrirForm = function (tipo, key) {
      modo = { tipo: tipo };
      Object.keys(aplicar).forEach(k => delete aplicar[k]);
      $('cbHistBox').innerHTML = '';
      const hoy = d.hoy;
      $('cbForm').innerHTML = '<div class="cb-caja"><h3>' + (tipo === 'ABONO' ? 'Registrar abono del cliente' : 'Registrar nota de crédito') + '</h3><div class="cb-grid">' +
        '<div class="campo"><label>Fecha</label><input type="date" id="cbFFecha" value="' + hoy + '"></div>' +
        '<div class="campo"><label>Moneda</label><input id="cbFMon" value="' + monedaSel() + '" disabled></div>' +
        '<div class="campo"><label>Monto ' + (tipo === 'ABONO' ? 'abonado' : 'de la NC') + '</label><input type="number" step="0.01" min="0" id="cbFMonto"></div>' +
        (tipo === 'ABONO' ? '<div class="campo"><label>Banco</label><select id="cbFBanco"><option>BCP</option><option>BBVA</option><option>INTERBANK</option><option>SCOTIABANK</option><option>BANBIF</option><option>OTRO</option></select></div>' : '') +
        '<div class="campo"><label>' + (tipo === 'ABONO' ? 'N° operación' : 'N° nota de crédito') + '</label><input id="cbFOper" autocomplete="off" style="text-transform:uppercase"></div>' +
        '<div class="campo" style="grid-column:span ' + (tipo === 'ABONO' ? 2 : 3) + '"><label>Observación</label><input id="cbFObs" autocomplete="off"></div></div>' +
        '<div style="font-size:.76rem;color:#64748b;margin-top:6px">Escribe en la columna <b>Aplicar</b> cuánto va a cada factura (el botón "Saldo" pone el saldo completo). Solo se graba cuando el reparto cuadra con el monto.</div>' +
        '<div class="cb-cuadre" id="cbCuadre"></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px"><button class="boton-secundario" id="cbFCancelar">Cancelar</button><button class="boton-primario" id="cbFGrabar" disabled>Grabar</button></div></div>';
      if (key) { const f = facts.find(x => x.key === key); if (f) { aplicar[key] = f.saldo.toFixed(2); $('cbFMonto').value = f.saldo.toFixed(2); } }
      $('cbFMonto').addEventListener('input', cuadre);
      $('cbFCancelar').addEventListener('click', cerrarForm);
      protegerClic($('cbFGrabar'), async function () {
        const det = Object.keys(aplicar).filter(k => Number(aplicar[k]) > 0).map(k => ({ factura: k, monto: Number(aplicar[k]) }));
        const r = await llamarBackend('cobranzaGrabarCobro', { tipo: modo.tipo, fecha: $('cbFFecha').value, moneda: monedaSel(), monto: $('cbFMonto').value,
          banco: $('cbFBanco') ? $('cbFBanco').value : '', operacion: $('cbFOper').value, observacion: $('cbFObs').value, detalle: det });
        if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo grabar.', 'error'); return; }
        modo = null;
        _refrescarSnapshotFormulario();
        mostrarMensaje(r.mensaje, 'exito');
        self._cargar(cliente);
      });
      pintar();
      $('cbFMonto').focus();
    };
    const cerrarForm = function () { modo = null; Object.keys(aplicar).forEach(k => delete aplicar[k]); $('cbForm').innerHTML = ''; pintar(); };

    /* --- editar forma de pago / detracción de una factura --- */
    const editar = function (key) {
      const f = facts.find(x => x.key === key); if (!f) return;
      modo = null; $('cbHistBox').innerHTML = '';
      $('cbForm').innerHTML = '<div class="cb-caja"><h3>Factura ' + esc(f.numero) + ' · ' + esc(f.tipo) + ' · ' + self._m(f.total, f.moneda) + ' (detracción ' + self._m(f.detraccion, f.moneda) +
        (f.detraccionSoles ? ' = S/ ' + f.detraccionSoles.toFixed(2) : '') + ')</h3><div class="cb-grid">' +
        '<div class="campo"><label>Detracción</label><select id="cbEDetr"><option value="SI">Con detracción</option><option value="NO">Sin detracción</option></select></div>' +
        '<div class="campo"><label>IGV</label><select id="cbEIgv"><option value="SI">Con IGV</option><option value="NO">Sin IGV</option></select></div>' +
        '<div class="campo"><label>Estado detracción</label><select id="cbEDEst"><option value="PENDIENTE">Pendiente</option><option value="DEPOSITADA">Depositada</option></select></div>' +
        '<div class="campo"><label>Fecha depósito detr.</label><input type="date" id="cbEDFecha" value="' + esc(f.detrFecha) + '"></div>' +
        '<div class="campo"><label>N° constancia</label><input id="cbEDConst" value="' + esc(f.detrConstancia) + '" autocomplete="off"></div>' +
        '<div class="campo" style="grid-column:span 2"><label>Observación</label><input id="cbEObs" value="' + esc(f.observacion) + '" autocomplete="off"></div></div>' +
        '<div style="font-size:.76rem;color:#64748b;margin-top:6px">Por defecto se usa la forma de pago del cliente (Maestros > Clientes). Cambia aquí solo si esta factura se paga distinto.</div>' +
        (f.pagos.length ? '<div class="cb-hist" style="margin-top:6px"><b>Pagos aplicados:</b> ' + f.pagos.map(p => (p.tipo === 'NOTA CREDITO' ? 'NC ' : '') + self._f(p.fecha) + ' ' + self._m(p.monto, f.moneda) + ' (' + esc(p.operacion) + ')').join(' · ') + '</div>' : '') +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px"><button class="boton-secundario" id="cbECancelar">Cancelar</button><button class="boton-primario" id="cbEGrabar">Guardar</button></div></div>';
      $('cbEDetr').value = f.detr ? 'SI' : 'NO'; $('cbEIgv').value = f.conIgv ? 'SI' : 'NO'; $('cbEDEst').value = f.detrEstado === 'DEPOSITADA' ? 'DEPOSITADA' : 'PENDIENTE';
      $('cbECancelar').addEventListener('click', function () { $('cbForm').innerHTML = ''; _refrescarSnapshotFormulario(); });
      protegerClic($('cbEGrabar'), async function () {
        const r = await llamarBackend('cobranzaGuardarFactura', { factura: f.key, detr: $('cbEDetr').value, igv: $('cbEIgv').value, detrEstado: $('cbEDEst').value,
          detrFecha: $('cbEDFecha').value, detrConstancia: $('cbEDConst').value, observacion: $('cbEObs').value });
        if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo guardar.', 'error'); return; }
        _refrescarSnapshotFormulario();
        mostrarMensaje(r.mensaje, 'exito');
        self._cargar(cliente);
      });
      _refrescarSnapshotFormulario();
      $('cbForm').scrollIntoView({ block: 'nearest' });
    };

    /* --- historial de abonos --- */
    const historial = function () {
      if ($('cbHistBox').innerHTML) { $('cbHistBox').innerHTML = ''; return; }
      const porKey = {}; facts.forEach(f => { porKey[f.key] = f.numero; });
      $('cbHistBox').innerHTML = '<div class="cb-caja"><h3>Historial de abonos y notas de crédito</h3>' + (cobros.length ? '<table class="cb-t cb-hist"><colgroup><col style="width:9%"><col style="width:9%"><col style="width:8%"><col style="width:10%"><col style="width:12%"><col><col style="width:16%"></colgroup>' +
        '<thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Banco</th><th>N° operación / NC</th><th>Aplicado a</th><th></th></tr></thead><tbody>' +
        cobros.map(c => '<tr' + (c.estado === 'ANULADO' ? ' style="opacity:.55;text-decoration:line-through"' : '') + '><td class="c">' + self._f(c.fecha) + '</td><td class="c">' + (c.tipo === 'ABONO' ? 'Abono' : 'Nota crédito') +
          '</td><td>' + self._m(c.monto, c.moneda) + '</td><td class="c">' + esc(c.banco) + '</td><td class="c">' + esc(c.operacion) + '</td><td class="i">' +
          c.detalle.map(x => esc(porKey[x.factura] || x.factura) + ': ' + self._m(x.monto, c.moneda)).join(' · ') + (c.observacion ? '<br><small class="cb-gris">' + esc(c.observacion) + '</small>' : '') +
          (c.estado === 'ANULADO' ? '<br><small>ANULADO: ' + esc(c.motivoAnulacion) + '</small>' : '') + '</td><td class="c">' +
          (c.estado === 'ANULADO' ? '' : '<input placeholder="Motivo" data-motivo="' + esc(c.id) + '" style="width:100%;margin-bottom:2px"><button class="cb-mini" data-anular="' + esc(c.id) + '">Anular</button>') + '</td></tr>').join('') +
        '</tbody></table>' : '<div class="cb-gris">Sin abonos registrados.</div>') + '</div>';
      _refrescarSnapshotFormulario();
    };
    $('cbHistBox').addEventListener('click', async function (ev) {
      const b = ev.target.closest('[data-anular]'); if (!b) return;
      const id = b.dataset.anular;
      const motivo = (raiz.querySelector('[data-motivo="' + id + '"]') || {}).value || '';
      if (!motivo.trim()) { mostrarMensaje('Escribe el motivo de la anulación al lado del botón.', 'error'); return; }
      if (!confirm('¿Anular este cobro? Las facturas recuperan su saldo.')) return;
      b.disabled = true;
      const r = await llamarBackend('cobranzaAnularCobro', { id: id, motivo: motivo });
      if (!r || !r.ok) { b.disabled = false; mostrarMensaje((r && r.mensaje) || 'No se pudo anular.', 'error'); return; }
      _refrescarSnapshotFormulario();
      mostrarMensaje(r.mensaje, 'exito');
      self._cargar(cliente);
    });

    /* --- estado de cuenta para correo --- */
    const copiar = function () { self._copiar(visibles()); };

    /* --- eventos --- */
    $('cbVolver').addEventListener('click', function () { modo = null; _refrescarSnapshotFormulario(); self._resumen(); });
    $('cbAbono').addEventListener('click', function () { abrirForm('ABONO'); });
    $('cbNC').addEventListener('click', function () { abrirForm('NOTA CREDITO'); });
    $('cbHist').addEventListener('click', function () { modo = null; $('cbForm').innerHTML = ''; historial(); pintar(); });
    $('cbCopiar').addEventListener('click', copiar);
    ['cbMostrar', 'cbMon', 'cbDDesde', 'cbDHasta'].forEach(id => { if ($(id)) $(id).addEventListener('change', pintar); });
    $('cbBuscarF').addEventListener('input', pintar);
    $('cbTablaF').addEventListener('input', function (ev) {
      const i = ev.target.closest('.cb-aplicar'); if (!i) return;
      if (Number(i.value) > 0) aplicar[i.dataset.k] = i.value; else delete aplicar[i.dataset.k];
      cuadre();
    });
    $('cbTablaF').addEventListener('click', function (ev) {
      const p = ev.target.closest('[data-pagar]'); if (p) { abrirForm('ABONO', p.dataset.pagar); return; }
      const e = ev.target.closest('[data-editar]'); if (e) { editar(e.dataset.editar); return; }
      const l = ev.target.closest('[data-llenar]');
      if (l) { const f = facts.find(x => x.key === l.dataset.llenar); if (f) { aplicar[f.key] = f.saldo.toFixed(2); const inp = raiz.querySelector('.cb-aplicar[data-k="' + CSS.escape(f.key) + '"]'); if (inp) inp.value = f.saldo.toFixed(2); cuadre(); } }
    });
    pintar();
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-cobranzas');
  if (b) b.addEventListener('click', function () { FormCobranzas.abrir(); });
});
