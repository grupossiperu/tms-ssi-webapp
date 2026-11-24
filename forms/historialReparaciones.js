/**
 * forms/historialReparaciones.js  (v103 → v135, 24/11/2026)
 * -------------------------------------------------------------------------
 * Historial de reparaciones (lo ven Mantenimiento y Maestro).
 * - Una fila por REPARACIÓN (fecha + placa + trabajo + km + técnico): los
 *   repuestos que se grabaron como varias líneas se juntan; clic = detalle
 *   con la lista de materiales (cantidad, costo unitario sin IGV, subtotal,
 *   salida del almacén) y los datos del trabajo.
 * - Vista "Por unidad": resumen por placa (reparaciones, última, km, costos).
 * - Fallas resueltas (incidencias) y reparaciones de piezas siguen como filas.
 * - Exportar Excel (hoja Reparaciones y hoja Materiales).
 * Backend: mtHistorialReparaciones (v135 agrega x.mat a cada repuesto).
 * -------------------------------------------------------------------------
 */
const FormHistorialReparaciones = {
  _items: [], _grupos: [], _vista: 'rep', _abiertos: {},
  _TIPOS: { MANTENIMIENTO: ['Mantenimiento', '#dbeafe', '#1e40af'], FALLA: ['Falla resuelta', '#fee2e2', '#b91c1c'], PIEZA: ['Reparación de pieza', '#ede9fe', '#5b21b6'] },

  abrir: async function () {
    const self = this;
    const html = `
      <style>
        .hr-barra{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:end;margin-bottom:8px}
        .hr-barra .campo{margin:0;min-width:130px}
        .hr-vistas{display:flex;gap:6px;margin:0 0 8px}
        .hr-vistas button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:5px 14px;font-weight:700;color:#1c3a5e;cursor:pointer}
        .hr-vistas button.on{background:#1c3a5e;color:#fff;border-color:#1c3a5e}
        .hr-kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:8px}
        .hr-kpi div{background:#f1f5f9;border-radius:9px;padding:6px 10px;border-left:4px solid #94a3b8}
        .hr-kpi span{display:block;font-size:.66rem;font-weight:700;color:#64748b;text-transform:uppercase}.hr-kpi b{font-size:1.02rem;color:#1c3a5e}
        .hr-wrap{max-height:calc(74vh - 250px);min-height:160px;overflow-y:auto;overflow-x:hidden;border:1px solid #e1e6ec;border-radius:10px}
        .hr-t{width:100%;table-layout:fixed;border-collapse:collapse;font-size:.78rem}
        .hr-t th{background:#eef2f7;color:#1c3a5e;font-size:.7rem;padding:6px;position:sticky;top:0;text-align:left;z-index:1}
        .hr-t td{padding:6px;border-bottom:1px solid #eef2f7;vertical-align:top;overflow-wrap:anywhere}
        .hr-t tr.fila{cursor:pointer}.hr-t tr.fila:hover td{background:#f8fafc}
        .hr-t tr.fila.abierta td{background:#eef6ff}
        .hr-t .num{text-align:right;white-space:nowrap}
        .hr-tag{display:inline-block;padding:1px 7px;border-radius:8px;font-size:.68rem;font-weight:700}
        .hr-chip{display:inline-block;padding:1px 8px;border-radius:999px;font-size:.7rem;font-weight:700;background:#fef3c7;color:#92400e}
        .hr-sub{display:block;font-size:.7rem;color:#64748b;margin-top:2px}
        .hr-flecha{display:inline-block;width:14px;color:#64748b}
        .hr-det td{background:#fbfdff;font-size:.76rem;color:#334155;padding:10px 12px}
        .hr-info{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px 14px;margin-bottom:8px}
        .hr-info div span{display:block;font-size:.64rem;font-weight:700;color:#64748b;text-transform:uppercase}
        .hr-mat{width:100%;border-collapse:collapse;font-size:.75rem;table-layout:fixed}
        .hr-mat th{background:#f1f5f9;color:#475569;font-size:.66rem;padding:4px 6px;text-align:left}
        .hr-mat td{padding:4px 6px;border-bottom:1px solid #eef2f7;overflow-wrap:anywhere}
        .hr-mat tfoot td{font-weight:800;color:#1c3a5e;border-top:2px solid #cbd5e1}
        .hr-nota{font-size:.7rem;color:#64748b;margin-top:6px}
        @media (max-width:800px){.hr-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.hr-info{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style>
      <div class="hr-barra">
        <div class="campo"><label>Tipo</label><select id="hrTipo"><option value="">Todos</option><option value="MANTENIMIENTO">Mantenimientos</option><option value="FALLA">Fallas resueltas</option><option value="PIEZA">Reparaciones de piezas</option></select></div>
        <div class="campo"><label>Mantenimiento</label><select id="hrTipoMant"><option value="">Todos</option><option>PREVENTIVO</option><option>CORRECTIVO</option><option>PREDICTIVO</option></select></div>
        <div class="campo"><label>Placa</label><div id="hrPlaca"></div></div>
        <div class="campo"><label>Desde</label><input type="date" id="hrDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="hrHasta"></div>
        <div class="campo" style="flex:1;min-width:180px"><label>Buscar</label><input id="hrBuscar" placeholder="Trabajo, repuesto, código, sistema, técnico, observación…" autocomplete="off"></div>
        <button class="boton-secundario" id="hrLimpiar">Borrar filtros</button>
        <button class="boton-secundario" id="hrExcel">⬇ Excel</button>
      </div>
      <div class="hr-vistas"><button type="button" data-v="rep" class="on">Por reparación</button><button type="button" data-v="uni">Por unidad</button></div>
      <div class="hr-kpi" id="hrKpi"></div>
      <div class="hr-wrap" id="hrWrap"><div style="text-align:center;color:#64748b;padding:16px">Cargando…</div></div>
      <div class="panel-footer" style="padding-top:10px"><button class="boton-secundario" id="hrCerrar">Cerrar</button></div>`;
    abrirPanel('Historial de reparaciones', html, async function (raiz) {
      self._raiz = raiz; self._vista = 'rep'; self._abiertos = {};
      const $ = id => raiz.querySelector('#' + id);
      self._msPlaca = crearMultiSelect($('hrPlaca'), { textoTodos: 'Todas', onChange: () => self._pintar() });
      ['hrTipo', 'hrTipoMant', 'hrDesde', 'hrHasta'].forEach(id => $(id).addEventListener('change', () => self._pintar()));
      $('hrBuscar').addEventListener('input', () => self._pintar());
      $('hrLimpiar').addEventListener('click', function () { ['hrTipo', 'hrTipoMant', 'hrDesde', 'hrHasta', 'hrBuscar'].forEach(id => { $(id).value = ''; }); self._msPlaca.limpiar(); self._pintar(); });
      $('hrCerrar').addEventListener('click', solicitarCierrePanel);
      $('hrExcel').addEventListener('click', () => self._excel());
      raiz.querySelectorAll('.hr-vistas button').forEach(b => b.addEventListener('click', function () {
        self._vista = b.dataset.v; raiz.querySelectorAll('.hr-vistas button').forEach(x => x.classList.toggle('on', x === b)); self._pintar();
      }));
      $('hrWrap').addEventListener('click', function (ev) {
        const u = ev.target.closest('tr.unidad');
        if (u) { self._msPlaca.setValores ? self._msPlaca.setValores([u.dataset.placa]) : null; self._vista = 'rep'; raiz.querySelectorAll('.hr-vistas button').forEach(x => x.classList.toggle('on', x.dataset.v === 'rep')); self._pintar(); return; }
        const tr = ev.target.closest('tr.fila'); if (!tr) return;
        const k = tr.dataset.k; self._abiertos[k] = !self._abiertos[k];
        tr.classList.toggle('abierta', !!self._abiertos[k]);
        const det = tr.nextElementSibling;
        if (det && det.classList.contains('hr-det')) det.style.display = self._abiertos[k] ? '' : 'none';
        const fl = tr.querySelector('.hr-flecha'); if (fl) fl.textContent = self._abiertos[k] ? '▾' : '▸';
      });
      let r = null;
      try { r = await llamarBackend('mtHistorialReparaciones', {}); } catch (e) { r = null; }
      if (!r || !r.ok) { $('hrWrap').innerHTML = '<div style="text-align:center;color:#b91c1c;padding:16px">' + esc((r && r.mensaje) || 'No se pudo cargar el historial.') + '</div>'; return; }
      self._items = r.items || [];
      self._grupos = self._agrupar(self._items);
      self._msPlaca.setOpciones(Array.from(new Set(self._items.map(x => x.placa).filter(Boolean))).sort());
      self._pintar();
    }, { ancho: true });
  },

  _esUsd: m => /\$|USD|D[OÓ]L/i.test(String(m || '')),
  _num: function (v) { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; },
  _din: function (s, d) {
    const p = []; if (s) p.push('S/ ' + s.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    if (d) p.push('$ ' + d.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    return p.join(' · ');
  },

  /* Junta las líneas de un mismo trabajo (una por repuesto) en una reparación. */
  _agrupar: function (items) {
    const self = this, mapa = {}, lista = [];
    items.forEach(function (x) {
      const k = x.origen === 'MANTENIMIENTO'
        ? ['M', x.iso, x.placa, String(x.titulo || '').toUpperCase(), x.km, String(x.quien || '').toUpperCase(), x.fin].join('|')
        : x.origen + '|' + (x.id || '') + '|' + x.iso + '|' + x.placa + '|' + x.titulo + '|' + lista.length;
      let g = mapa[k];
      if (!g) {
        g = mapa[k] = { k: k, origen: x.origen, fecha: x.fecha, iso: x.iso, placa: x.placa, titulo: x.titulo, km: x.km, quien: x.quien, lugar: x.lugar,
          fin: x.fin, duracion: x.duracion, tipos: [], sistemas: [], metodos: [], obs: [], lineas: [], srvS: 0, srvD: 0, matS: 0, matD: 0, base: x };
        lista.push(g);
      }
      const add = (arr, v) => { v = String(v || '').trim(); if (v && arr.indexOf(v) < 0) arr.push(v); };
      add(g.tipos, x.tipo); add(g.sistemas, x.sistema); add(g.metodos, x.metodo); add(g.obs, x.obs);
      if (x.costo > 0) { if (self._esUsd(x.moneda)) g.srvD += x.costo; else g.srvS += x.costo; }
      if (x.origen === 'MANTENIMIENTO' && x.repuesto && String(x.repuesto).toUpperCase() !== 'NO APLICA') {
        g.lineas.push(x);
        if (x.mat && x.mat.costo > 0) { if (self._esUsd(x.mat.moneda)) g.matD += x.mat.costo; else g.matS += x.mat.costo; }
      }
    });
    lista.forEach(g => { g.texto = JSON.stringify([g.titulo, g.placa, g.quien, g.lugar, g.tipos, g.sistemas, g.metodos, g.obs, g.lineas.map(l => [l.repuesto, l.mat && l.mat.codigo]), g.base.detalle, g.base.trabajo, g.base.taller]).toUpperCase(); });
    return lista;
  },

  _vis: function () {
    const $ = id => this._raiz.querySelector('#' + id);
    const tipo = $('hrTipo').value, tm = $('hrTipoMant').value, de = $('hrDesde').value, ha = $('hrHasta').value, q = $('hrBuscar').value.trim().toUpperCase();
    return this._grupos.filter(g => (!tipo || g.origen === tipo) && (!tm || g.tipos.some(t => String(t).toUpperCase() === tm)) && this._msPlaca.cumple(g.placa) &&
      (!de || (g.iso && g.iso >= de)) && (!ha || (g.iso && g.iso <= ha)) && (!q || g.texto.indexOf(q) >= 0));
  },

  _kpis: function (vis) {
    const sum = c => vis.reduce((a, g) => a + g[c], 0);
    const nMat = vis.reduce((a, g) => a + g.lineas.length, 0);
    const uni = new Set(vis.map(g => g.placa)).size;
    const srv = this._din(sum('srvS'), sum('srvD')) || '—', mat = this._din(sum('matS'), sum('matD')) || '—';
    this._raiz.querySelector('#hrKpi').innerHTML = [['Reparaciones', vis.length, '#1c3a5e'], ['Unidades atendidas', uni, '#0e7490'], ['Materiales usados', nMat, '#b45309'],
      ['Servicio / mano de obra', srv, '#16a34a'], ['Materiales del almacén (sin IGV)', mat, '#7c3aed']]
      .map(k => '<div style="border-left-color:' + k[2] + '"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>').join('');
  },

  _pintar: function () {
    const self = this;
    if (typeof _refrescarSnapshotFormulario === 'function') setTimeout(_refrescarSnapshotFormulario, 0);
    const vis = self._vis();
    self._kpis(vis);
    const wrap = self._raiz.querySelector('#hrWrap');
    if (self._vista === 'uni') { wrap.innerHTML = self._htmlUnidades(vis); return; }
    if (!vis.length) { wrap.innerHTML = '<div style="text-align:center;color:#64748b;padding:16px">No hay reparaciones con estos filtros.</div>'; return; }
    wrap.innerHTML = '<table class="hr-t"><colgroup><col style="width:8.5%"><col style="width:8%"><col><col style="width:8%"><col style="width:14%"><col style="width:8%"><col style="width:9.5%"><col style="width:9.5%"><col style="width:10%"></colgroup>' +
      '<thead><tr><th>Fecha</th><th>Placa</th><th>Reparación</th><th>Km / h</th><th>Taller · técnico</th><th>Materiales</th><th class="num">Servicio</th><th class="num">Materiales</th><th class="num">Total</th></tr></thead><tbody>' +
      vis.map(g => self._htmlFila(g)).join('') + '</tbody></table>';
  },

  _htmlFila: function (g) {
    const self = this, ab = !!self._abiertos[g.k];
    const t = self._TIPOS[g.origen] || [g.origen, '#f1f5f9', '#334155'];
    let sub = '';
    if (g.origen === 'MANTENIMIENTO') sub = [g.tipos.join('/'), g.sistemas.join(', ')].filter(Boolean).join(' · ');
    else if (g.origen === 'FALLA') sub = g.base.trabajo ? 'Trabajo: ' + g.base.trabajo : g.base.detalle;
    else sub = [g.base.estado, g.base.taller].filter(Boolean).join(' · ');
    const tag = g.origen === 'MANTENIMIENTO' ? '' : '<span class="hr-tag" style="background:' + t[1] + ';color:' + t[2] + ';margin-right:4px">' + t[0] + '</span>';
    const taller = [g.lugar, g.quien].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
    const tS = g.srvS + g.matS, tD = g.srvD + g.matD;
    const gris = '<span style="color:#94a3b8">—</span>';
    return '<tr class="fila' + (ab ? ' abierta' : '') + '" data-k="' + esc(g.k) + '"><td><span class="hr-flecha">' + (ab ? '▾' : '▸') + '</span>' + esc(g.fecha) + '</td><td><b>' + esc(g.placa) + '</b></td>' +
      '<td>' + tag + esc(g.titulo) + (sub ? '<span class="hr-sub">' + esc(sub) + '</span>' : '') + '</td><td>' + esc(g.km || '') + '</td><td>' + esc(taller) + '</td>' +
      '<td>' + (g.lineas.length ? '<span class="hr-chip">' + g.lineas.length + ' ítem' + (g.lineas.length > 1 ? 's' : '') + '</span>' : gris) + '</td>' +
      '<td class="num">' + (self._din(g.srvS, g.srvD) || gris) + '</td><td class="num">' + (self._din(g.matS, g.matD) || gris) + '</td><td class="num"><b>' + (self._din(tS, tD) || gris) + '</b></td></tr>' +
      '<tr class="hr-det" style="' + (ab ? '' : 'display:none') + '"><td colspan="9">' + self._htmlDetalle(g) + '</td></tr>';
  },

  _htmlDetalle: function (g) {
    const self = this, x = g.base;
    const c = (k, v) => v ? '<div><span>' + k + '</span>' + esc(v) + '</div>' : '';
    if (g.origen === 'FALLA') return '<div class="hr-info">' + c('Reportada', (x.reportada || '') + (x.reporto ? ' por ' + x.reporto : '')) + c('Unidad', x.tipo) + c('Urgencia', x.urgencia) + c('Resuelta por', x.quien) +
      c('Detalle del conductor', x.detalle) + c('Trabajo realizado', x.trabajo) + (x.reincidencias ? c('Repeticiones', String(x.reincidencias)) : '') + c('ID', x.id) + '</div>';
    if (g.origen === 'PIEZA') return '<div class="hr-info">' + c('Código', x.codigo) + c('Cantidad', x.cantidad) + c('Origen', x.tipo) + c('Taller', x.taller) + c('Guía', x.guia) +
      c('Enviada', x.envio) + c('Retornó', x.retorno) + c('Estado', x.estado) + c('Observación', x.obs) + '</div>';
    const info = '<div class="hr-info">' + c('Tipo', g.tipos.join(' / ')) + c('Sistemas', g.sistemas.join(', ')) + c('Método', g.metodos.join(', ')) + c('Lugar', g.lugar) +
      c('Técnico / taller', g.quien) + c('Inicio → fin', g.fecha + (g.fin && g.fin !== g.fecha ? ' → ' + g.fin : '')) + c('Duración', g.duracion) + c('Km / horómetro', g.km) +
      (g.srvS || g.srvD ? c('Servicio / mano de obra', self._din(g.srvS, g.srvD)) : '') + '</div>' +
      (g.obs.length ? '<div style="margin-bottom:8px"><b>Observación:</b> ' + esc(g.obs.join(' · ')) + '</div>' : '');
    if (!g.lineas.length) return info + '<div class="hr-nota">Sin materiales del almacén (trabajo sin repuesto).</div>';
    const fmt = (v, m) => v > 0 ? (self._esUsd(m) ? '$ ' : 'S/ ') + v.toFixed(2) : '—';
    const filas = g.lineas.map(l => {
      const m = l.mat || {};
      const cant = m.cantidad ? (Math.round(m.cantidad * 100) / 100) + (m.unidad ? ' ' + m.unidad.toLowerCase() : '') : '—';
      const pu = m.pu > 0 ? (self._esUsd(m.moneda) ? '$ ' : 'S/ ') + m.pu.toFixed(2) : '—';
      return '<tr><td>' + esc(l.repuesto) + (m.codigo ? '<span class="hr-sub">' + esc(m.codigo) + '</span>' : '') + '</td><td>' + esc(cant) + '</td><td class="num">' + pu + '</td><td class="num">' + fmt(m.costo, m.moneda) + '</td>' +
        '<td>' + esc([l.sistema, l.metodo].filter(Boolean).join(' · ')) + '</td><td>' + esc([m.fechaSalida, m.entregadoA].filter(Boolean).join(' · ') || 'No se encontró la salida') + '</td></tr>';
    }).join('');
    return info + '<table class="hr-mat"><colgroup><col><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:18%"><col style="width:18%"></colgroup>' +
      '<thead><tr><th>Material</th><th>Cantidad</th><th style="text-align:right">C. unit. (sin IGV)</th><th style="text-align:right">Subtotal</th><th>Sistema · método</th><th>Salida del almacén</th></tr></thead><tbody>' + filas + '</tbody>' +
      '<tfoot><tr><td colspan="3">Total materiales (' + g.lineas.length + ')</td><td class="num">' + (self._din(g.matS, g.matD) || '—') + '</td><td colspan="2"></td></tr></tfoot></table>' +
      '<div class="hr-nota">Costo de materiales = precio sin IGV del último ingreso del producto × cantidad entregada.</div>';
  },

  _htmlUnidades: function (vis) {
    const self = this, u = {};
    vis.forEach(g => {
      const x = u[g.placa] = u[g.placa] || { placa: g.placa, n: 0, prev: 0, corr: 0, ult: '', ultIso: '', km: '', mat: 0, sS: 0, sD: 0, mS: 0, mD: 0 };
      x.n++; if (g.tipos.some(t => /PREVENT/i.test(t))) x.prev++; if (g.tipos.some(t => /CORRECT/i.test(t))) x.corr++;
      if (!x.ultIso || g.iso > x.ultIso) { x.ultIso = g.iso; x.ult = g.fecha; x.km = g.km; }
      x.mat += g.lineas.length; x.sS += g.srvS; x.sD += g.srvD; x.mS += g.matS; x.mD += g.matD;
    });
    const L = Object.values(u).sort((a, b) => (b.sS + b.mS + (b.sD + b.mD) * 3.8) - (a.sS + a.mS + (a.sD + a.mD) * 3.8));
    if (!L.length) return '<div style="text-align:center;color:#64748b;padding:16px">No hay reparaciones con estos filtros.</div>';
    return '<table class="hr-t"><colgroup><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:10%"><col style="width:8%"><col><col><col></colgroup>' +
      '<thead><tr><th>Placa</th><th class="num">Reparaciones</th><th class="num">Preventivos</th><th class="num">Correctivos</th><th>Última</th><th>Km / h última</th><th class="num">Materiales</th><th class="num">Servicio</th><th class="num">Materiales</th><th class="num">Total</th></tr></thead><tbody>' +
      L.map(x => '<tr class="unidad fila" data-placa="' + esc(x.placa) + '" title="Ver sus reparaciones"><td><b>' + esc(x.placa) + '</b></td><td class="num">' + x.n + '</td><td class="num">' + x.prev + '</td><td class="num">' + x.corr + '</td>' +
        '<td>' + esc(x.ult) + '</td><td>' + esc(x.km || '') + '</td><td class="num">' + x.mat + '</td><td class="num">' + (self._din(x.sS, x.sD) || '—') + '</td><td class="num">' + (self._din(x.mS, x.mD) || '—') + '</td>' +
        '<td class="num"><b>' + (self._din(x.sS + x.mS, x.sD + x.mD) || '—') + '</b></td></tr>').join('') + '</tbody></table>' +
      '<div class="hr-nota" style="padding:6px 8px">Clic en una placa para ver sus reparaciones.</div>';
  },

  _excel: async function () {
    const self = this;
    if (typeof XLSX === 'undefined') {
      try { await new Promise(function (ok, no) { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
      catch (e) { mostrarMensaje('No se pudo cargar el exportador de Excel.', 'error'); return; }
    }
    const vis = self._vis(); if (!vis.length) { mostrarMensaje('No hay reparaciones con estos filtros.', 'error'); return; }
    const r2 = v => Math.round((v || 0) * 100) / 100;
    const h1 = [['Fecha', 'Placa', 'Tipo registro', 'Reparación', 'Tipo', 'Sistemas', 'Métodos', 'Km / h', 'Lugar', 'Técnico', 'Duración', 'N° materiales', 'Servicio S/', 'Servicio $', 'Materiales S/', 'Materiales $', 'Total S/', 'Total $', 'Observación']];
    vis.forEach(g => h1.push([g.fecha, g.placa, (self._TIPOS[g.origen] || [g.origen])[0], g.titulo, g.tipos.join(' / '), g.sistemas.join(', '), g.metodos.join(', '), g.km || '', g.lugar || '', g.quien || '', g.duracion || '',
      g.lineas.length, r2(g.srvS), r2(g.srvD), r2(g.matS), r2(g.matD), r2(g.srvS + g.matS), r2(g.srvD + g.matD), g.obs.join(' · ')]));
    const h2 = [['Fecha', 'Placa', 'Reparación', 'Material', 'Código', 'Cantidad', 'Unidad', 'Costo unit. sin IGV', 'Moneda', 'Subtotal', 'Sistema', 'Método', 'Fecha salida', 'Entregado a']];
    vis.forEach(g => g.lineas.forEach(l => { const m = l.mat || {}; h2.push([g.fecha, g.placa, g.titulo, l.repuesto, m.codigo || '', m.cantidad || '', m.unidad || '', m.pu || '', m.moneda || '', m.costo || '', l.sistema || '', l.metodo || '', m.fechaSalida || '', m.entregadoA || '']); }));
    const wb = XLSX.utils.book_new();
    const w1 = XLSX.utils.aoa_to_sheet(h1); w1['!cols'] = h1[0].map((c, i) => ({ wch: [11, 9, 14, 40, 12, 22, 18, 10, 16, 18, 9, 8, 10, 10, 11, 11, 10, 10, 40][i] || 12 }));
    const w2 = XLSX.utils.aoa_to_sheet(h2); w2['!cols'] = h2[0].map((c, i) => ({ wch: [11, 9, 36, 40, 13, 9, 9, 12, 8, 10, 14, 14, 11, 18][i] || 12 }));
    XLSX.utils.book_append_sheet(wb, w1, 'Reparaciones'); XLSX.utils.book_append_sheet(wb, w2, 'Materiales');
    XLSX.writeFile(wb, 'Historial de reparaciones ' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-historial-reparaciones');
  if (b) b.addEventListener('click', function () { FormHistorialReparaciones.abrir(); });
});
