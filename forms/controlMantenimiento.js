/**
 * forms/controlMantenimiento.js  (v113)
 * -------------------------------------------------------------------------
 * Mantenimiento → "Control de mantenimiento" (preventivo).
 *  - Camiones cada 20 000 km (km = KM FINAL del último consolidado).
 *  - Gensets cada 1 000 h (horómetro final del último consolidado; 116 = UG0116).
 *  - Base = último reinicio manual o último mantenimiento con cambio de aceite / filtro de aceite.
 *  - Semáforo: AL DÍA / POR VENCER (≤ 2 000 km · ≤ 100 h) / VENCIDO / SIN BASE / REVISAR.
 *  - "↺ Reiniciar contador" (fecha + km/horómetro + observación) e historial con anular.
 *  - Franja de aviso en el inicio (como documentos) si hay vencidos o por vencer.
 * Backend: mtControlMant, mtControlReiniciar, mtControlAnular.
 * -------------------------------------------------------------------------
 */
const FormControlMant = {
  _datos: null,
  _tab: 'TRACTO',
  EST: {
    'VENCIDO': ['Vencido', '#fee2e2', '#b91c1c', 0],
    'POR VENCER': ['Por vencer', '#fef3c7', '#92400e', 1],
    'REVISAR': ['Revisar lecturas', '#ffedd5', '#9a3412', 2],
    'SIN BASE': ['Sin último mantenimiento', '#e2e8f0', '#475569', 3],
    'SIN LECTURA': ['Sin lectura', '#e2e8f0', '#475569', 4],
    'AL DIA': ['Al día', '#dcfce7', '#166534', 5]
  },
  _n: function (v, tipo) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toLocaleString('es-PE', { maximumFractionDigits: 1 }) + (tipo === 'TRACTO' ? ' km' : ' h');
  },
  _esMaestro: function () { try { return typeof Sesion !== 'undefined' && Sesion.datos && String((Sesion.datos() || {}).rol || '').toUpperCase() === 'MAESTRO'; } catch (e) { return false; } },
  _placa: function (x) { return x.tipo === 'GENSET' ? 'UG' + String(x.unidad).padStart(4, '0') : x.unidad; },
  _corregir: async function (x) {
    if (typeof FormAlmacenCorregir === 'undefined') { mostrarMensaje('No está disponible la corrección de mantenimientos.', 'error'); return; }
    await FormAlmacenCorregir.abrir('mantenimientos');
    const q = x.tipo === 'GENSET' ? String(x.unidad) : x.unidad;
    for (let i = 0; i < 40; i++) {
      const b = document.getElementById('crBuscar'), tb = document.getElementById('crTb');
      if (b && tb) { b.value = q; b.dispatchEvent(new Event('input', { bubbles: true })); return; }
      await new Promise(r => setTimeout(r, 250));
    }
  },
  _mants: null,
  _mantsDe: async function (x) {
    if (!this._mants) {
      let r = null; try { r = await llamarBackend('mtHistorialReparaciones', {}); } catch (e) { r = null; }
      this._mants = (r && r.items) ? r.items.filter(i => i.origen === 'MANTENIMIENTO') : [];
    }
    const norm = p => { const s = String(p || '').toUpperCase().replace(/[\s-]/g, ''); return (/^UG/.test(s) || /^\d+$/.test(s)) ? String(parseInt(s.replace(/\D/g, ''), 10) || '') : s; };
    const u = String(x.unidad).toUpperCase();
    const g = {};
    this._mants.filter(i => norm(i.placa) === u).forEach(i => {
      const k = i.iso + '|' + i.titulo + '|' + i.km;
      if (!g[k]) g[k] = { iso: i.iso, fecha: i.fin || i.fecha, inicio: i.fecha, titulo: i.titulo, km: i.km, tipo: i.tipo, rep: [] };
      if (i.repuesto && i.repuesto !== 'NO APLICA') g[k].rep.push(i.repuesto);
    });
    return Object.values(g).sort((a, b) => String(b.iso).localeCompare(String(a.iso))).slice(0, 15);
  },
  _tag: function (e) { const x = this.EST[e] || [e, '#e2e8f0', '#475569']; return '<span class="cm-tag" style="background:' + x[1] + ';color:' + x[2] + '">' + x[0] + '</span>'; },

  abrir: async function () {
    const self = this;
    const html = `
      <style>
        .cm-tabs { display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; align-items:center; }
        .cm-tabs button.t { border:1px solid #cbd5e1; background:#fff; border-radius:9px; padding:6px 14px; font-weight:700; cursor:pointer; color:#334155; }
        .cm-tabs button.t.act { background:#1c3a5e; color:#fff; border-color:#1c3a5e; }
        .cm-kpis { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap:10px; margin-bottom:10px; }
        .cm-kpi { border-radius:10px; padding:8px 12px; background:#f1f5f9; border-left:5px solid #94a3b8; }
        .cm-kpi span { display:block; font-size:.68rem; text-transform:uppercase; color:#64748b; font-weight:700; }
        .cm-kpi b { font-size:1.3rem; color:#1c3a5e; }
        .cm-t { width:100%; table-layout:fixed; border-collapse:collapse; font-size:.8rem; }
        .cm-t th, .cm-t td { padding:6px 6px; border-bottom:1px solid #eef2f7; text-align:left; overflow-wrap:anywhere; vertical-align:top; }
        .cm-t th { background:#f8fafc; color:#1c3a5e; font-size:.72rem; }
        .cm-t td.r, .cm-t th.r { text-align:right; }
        .cm-t small { color:#94a3b8; display:block; }
        .cm-tag { display:inline-block; padding:2px 8px; border-radius:9px; font-size:.72rem; font-weight:800; }
        .cm-bar { height:7px; background:#e2e8f0; border-radius:5px; overflow:hidden; margin-top:4px; }
        .cm-bar i { display:block; height:100%; }
        .cm-b { border:1px solid #cbd5e1; background:#fff; border-radius:8px; padding:4px 8px; font-size:.75rem; cursor:pointer; margin:0 2px 3px 0; }
        .cm-b.p { background:#1c3a5e; color:#fff; border-color:#1c3a5e; }
        .cm-form { border:1px dashed #94a3b8; border-radius:10px; background:#f8fafc; padding:10px 12px; margin:6px 0; }
        @media (max-width: 900px) { .cm-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } }
      </style>
      <div class="cm-tabs">
        <button type="button" class="t act" data-t="TRACTO">🚚 Camiones (cada 20 000 km)</button>
        <button type="button" class="t" data-t="GENSET">⚡ Gensets (cada 1 000 h)</button>
        <span style="margin-left:auto;font-size:.78rem;color:#64748b">El contador se reinicia solo al registrar en Mantenimiento un cambio de aceite / filtro de aceite, o con "↺ Reiniciar contador".</span>
      </div>
      <div class="cm-kpis" id="cmKpis"></div>
      <div id="cmForm"></div>
      <div id="cmTabla"><p style="color:#64748b">Cargando…</p></div>
      <div class="panel-footer" style="padding-top:10px"><button class="boton-secundario" id="cmCerrar">Cerrar</button><button class="boton-secundario" id="cmRecargar">⟳ Actualizar</button></div>`;
    abrirPanel('Control de mantenimiento', html, function (raiz) {
      self._raiz = raiz;
      raiz.querySelectorAll('.cm-tabs button.t').forEach(b => b.addEventListener('click', function () {
        self._tab = b.dataset.t;
        raiz.querySelectorAll('.cm-tabs button.t').forEach(x => x.classList.toggle('act', x === b));
        raiz.querySelector('#cmForm').innerHTML = '';
        self._pintar();
      }));
      raiz.querySelector('#cmCerrar').addEventListener('click', cerrarPanel);
      raiz.querySelector('#cmRecargar').addEventListener('click', () => self._cargar());
      raiz.querySelector('#cmTabla').addEventListener('click', function (ev) {
        const b = ev.target.closest('button[data-acc]'); if (!b) return;
        const x = (self._datos || []).find(u => u.tipo === b.dataset.tipo && u.unidad === b.dataset.u); if (!x) return;
        if (b.dataset.acc === 'reiniciar') self._formReinicio(x);
        if (b.dataset.acc === 'hist') self._historial(x);
        if (b.dataset.acc === 'registrar') { if (typeof FormMantenimiento !== 'undefined') FormMantenimiento.abrirRegistrar({ placa: self._placa(x) }); }
        if (b.dataset.acc === 'corregir') self._corregir(x);
      });
      self._cargar();
    }, { ancho: true });
  },

  _cargar: async function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    $('cmTabla').innerHTML = '<p style="color:#64748b">Cargando…</p>';
    let r = null;
    try { r = await llamarBackend('mtControlMant', {}); } catch (e) { r = null; }
    if (!r || !r.ok) { $('cmTabla').innerHTML = '<p style="color:#b91c1c">' + esc((r && r.mensaje) || 'No se pudo cargar el control.') + '</p>'; return; }
    self._datos = r.unidades || [];
    self._pintar();
    FormControlMant.aviso(self._datos);
  },

  _pintar: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    if (!self._datos) return;
    if (typeof _refrescarSnapshotFormulario === 'function') setTimeout(_refrescarSnapshotFormulario, 0);
    const tipo = self._tab;
    const L = self._datos.filter(x => x.tipo === tipo).sort((a, b) => ((self.EST[a.estado] || [])[3] - (self.EST[b.estado] || [])[3]) || ((a.falta === null ? 9e9 : a.falta) - (b.falta === null ? 9e9 : b.falta)) || a.unidad.localeCompare(b.unidad, 'es', { numeric: true }));
    const c = e => L.filter(x => x.estado === e).length;
    $('cmKpis').innerHTML = [['Unidades', L.length, '#94a3b8'], ['Vencidos', c('VENCIDO'), '#dc2626'], ['Por vencer', c('POR VENCER'), '#d97706'], ['Al día', c('AL DIA'), '#16a34a'], ['Sin último mant.', c('SIN BASE') + c('SIN LECTURA') + c('REVISAR'), '#64748b']]
      .map(k => '<div class="cm-kpi" style="border-left-color:' + k[2] + '"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>').join('');
    const u = tipo === 'TRACTO' ? 'km' : 'h';
    $('cmTabla').innerHTML = '<table class="cm-t"><thead><tr><th style="width:12%">' + (tipo === 'TRACTO' ? 'Placa' : 'Genset') + '</th><th style="width:13%">Estado</th>' +
      '<th style="width:16%">Último mantenimiento</th><th style="width:15%">Lectura actual</th><th class="r" style="width:16%">Recorrido desde el mant.</th><th class="r" style="width:12%">Falta</th><th style="width:16%"></th></tr></thead><tbody>' +
      L.map(function (x) {
        const pct = x.recorrido !== null ? Math.max(0, Math.min(100, x.recorrido / x.intervalo * 100)) : 0;
        const col = x.estado === 'VENCIDO' ? '#dc2626' : x.estado === 'POR VENCER' ? '#d97706' : '#16a34a';
        const base = x.base ? self._n(x.base.lectura, tipo) + '<small>' + esc(x.base.fecha) + ' · ' + (/^MANTENIMIENTO/.test(x.base.origen) ? 'registro de mantenimiento' : 'reinicio manual') + '</small>' : '<span style="color:#94a3b8">sin registro</span>';
        const act = x.actual !== null ? self._n(x.actual, tipo) + '<small>' + esc(x.fechaActual) + (x.codigo ? ' · ' + esc(x.codigo) : '') + (x.carreta ? ' · carreta ' + esc(x.carreta) : '') + '</small>' : '—';
        const falta = x.falta === null ? '—' : (x.falta <= 0 ? '<b style="color:#b91c1c">+' + self._n(-x.falta, tipo) + '<small>de exceso</small></b>' : '<b>' + self._n(x.falta, tipo) + '</b>');
        return '<tr><td><b style="font-size:.9rem">' + esc(tipo === 'GENSET' ? 'UG' + String(x.unidad).padStart(4, '0') : x.unidad) + '</b>' + (tipo === 'GENSET' ? '<small>N° ' + esc(x.unidad) + '</small>' : '') + '</td>' +
          '<td>' + self._tag(x.estado) + '</td><td>' + base + '</td><td>' + act + '</td>' +
          '<td class="r">' + (x.recorrido === null ? '—' : self._n(x.recorrido, tipo) + '<div class="cm-bar"><i style="width:' + pct + '%;background:' + col + '"></i></div><small>de ' + self._n(x.intervalo, tipo) + '</small>') + '</td>' +
          '<td class="r">' + falta + '</td>' +
          '<td><button type="button" class="cm-b p" data-acc="registrar" data-tipo="' + tipo + '" data-u="' + esc(x.unidad) + '">➕ Registrar mantenimiento</button>' +
          '<button type="button" class="cm-b" data-acc="reiniciar" data-tipo="' + tipo + '" data-u="' + esc(x.unidad) + '">↺ Reiniciar contador</button>' +
          '<button type="button" class="cm-b" data-acc="hist" data-tipo="' + tipo + '" data-u="' + esc(x.unidad) + '">Historial</button>' +
          (self._esMaestro() ? '<button type="button" class="cm-b" data-acc="corregir" data-tipo="' + tipo + '" data-u="' + esc(x.unidad) + '">✎ Corregir</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (L.some(x => x.estado === 'REVISAR') ? '<p style="font-size:.76rem;color:#9a3412;margin:6px 0 0">"Revisar lecturas": la lectura actual del consolidado es menor que la del último mantenimiento. Revisa el ' + u + ' digitado en el consolidado o en el mantenimiento.</p>' : '');
  },

  _formReinicio: function (x) {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const hoy = new Date(), iso = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    const nom = x.tipo === 'GENSET' ? 'genset UG' + String(x.unidad).padStart(4, '0') : x.unidad;
    $('cmForm').innerHTML = '<div class="cm-form"><b style="color:#1c3a5e">↺ Reiniciar contador de ' + esc(nom) + '</b>' +
      '<div class="fila-campos" style="margin-top:6px"><div class="campo"><label>Fecha del mantenimiento</label><input type="date" id="cmFecha" value="' + iso + '"></div>' +
      '<div class="campo"><label>' + (x.tipo === 'TRACTO' ? 'Kilometraje en el mantenimiento' : 'Horómetro en el mantenimiento') + '</label><input type="number" id="cmLect" min="0" step="0.1" value="' + (x.actual !== null ? x.actual : '') + '"></div>' +
      '<div class="campo" style="grid-column:span 2"><label>Observación</label><input type="text" id="cmObs" autocomplete="off" placeholder="Ej. cambio de aceite y filtros en taller X"></div></div>' +
      '<div style="text-align:right"><button class="boton-secundario" id="cmCancelar">Cancelar</button> <button class="boton-primario" id="cmGrabar">Guardar reinicio</button></div>' +
      '<div style="margin-top:8px"><b style="font-size:.82rem;color:#1c3a5e">Tomar los datos de un mantenimiento registrado</b><div id="cmMantLista" style="font-size:.78rem;color:#64748b">Buscando mantenimientos de esta unidad…</div></div></div>';
    $('cmCancelar').addEventListener('click', () => { $('cmForm').innerHTML = ''; });
    self._mantsDe(x).then(function (L) {
      const cont = $('cmMantLista'); if (!cont) return;
      if (!L.length) { cont.innerHTML = 'No hay mantenimientos registrados para esta unidad. Escribe la fecha y el ' + (x.tipo === 'TRACTO' ? 'km' : 'horómetro') + ' a mano, o usa "➕ Registrar mantenimiento".'; return; }
      cont.innerHTML = '<table class="cm-t" style="margin-top:4px"><thead><tr><th style="width:14%">Fecha</th><th>Trabajo</th><th class="r" style="width:16%">' + (x.tipo === 'TRACTO' ? 'Km' : 'Horómetro') + '</th><th style="width:16%"></th></tr></thead><tbody>' +
        L.map((m, i) => '<tr><td>' + esc(m.fecha) + '</td><td><b>' + esc(m.titulo) + '</b>' + (m.tipo ? ' · ' + esc(m.tipo) : '') + (m.rep.length ? '<small>' + esc(m.rep.join(' · ').slice(0, 160)) + '</small>' : '') + '</td><td class="r">' + esc(m.km || '—') + '</td>' +
          '<td><button type="button" class="cm-b p" data-usar="' + i + '">Usar este</button></td></tr>').join('') + '</tbody></table>';
      cont.querySelectorAll('button[data-usar]').forEach(b => b.addEventListener('click', function () {
        const m = L[Number(b.dataset.usar)];
        const mm = String(m.fecha || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (mm) $('cmFecha').value = mm[3] + '-' + mm[2] + '-' + mm[1];
        const km = Number(String(m.km || '').replace(/,/g, ''));
        if (km > 0) $('cmLect').value = km;
        $('cmObs').value = 'Desde mantenimiento registrado: ' + m.titulo + ' (' + m.fecha + ')';
        $('cmGrabar').focus();
      }));
    });
    protegerClic($('cmGrabar'), async function () {
      const f = $('cmFecha').value, l = $('cmLect').value;
      if (!f) { mostrarMensaje('Indique la fecha.', 'error'); return; }
      if (l === '' || Number(l) < 0) { mostrarMensaje('Indique el ' + (x.tipo === 'TRACTO' ? 'kilometraje' : 'horómetro') + '.', 'error'); return; }
      const p = f.split('-');
      const r = await llamarBackend('mtControlReiniciar', { tipo: x.tipo, unidad: x.unidad, fecha: p[2] + '/' + p[1] + '/' + p[0], lectura: Number(l), observacion: $('cmObs').value.trim() });
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo guardar.', 'error'); return; }
      $('cmForm').innerHTML = '';
      mostrarMensaje(r.mensaje, 'exito');
      self._cargar();
    });
    $('cmForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  _historial: function (x) {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const tipo = x.tipo, nom = tipo === 'GENSET' ? 'genset UG' + String(x.unidad).padStart(4, '0') : x.unidad;
    $('cmForm').innerHTML = '<div class="cm-form"><b style="color:#1c3a5e">Historial de mantenimientos preventivos · ' + esc(nom) + '</b>' +
      (x.historial.length ? '<table class="cm-t" style="margin-top:6px"><thead><tr><th style="width:14%">Fecha</th><th class="r" style="width:14%">Lectura</th><th style="width:16%">Origen</th><th>Detalle</th><th style="width:14%">Usuario</th><th style="width:12%"></th></tr></thead><tbody>' +
        x.historial.map(h => '<tr' + (h.anulado ? ' style="opacity:.5;text-decoration:line-through"' : '') + '><td>' + esc(h.fecha) + '</td><td class="r">' + self._n(h.lectura, tipo) + '</td><td>' + (/^MANTENIMIENTO/.test(h.origen) ? 'Registro de mantenimiento' : 'Reinicio manual') + (h.anulado ? ' (anulado)' : '') + '</td><td>' + esc(h.detalle || '') + '</td><td>' + esc(h.usuario || '') + '</td><td>' +
          (h.fila && !h.anulado ? '<button type="button" class="cm-b" data-anular="' + h.fila + '">Anular</button>' : '') + '</td></tr>').join('') + '</tbody></table>'
        : '<p style="color:#64748b;margin:6px 0">Sin mantenimientos registrados.</p>') +
      '<div style="display:flex;gap:8px;justify-content:flex-end;align-items:end;margin-top:6px;flex-wrap:wrap">' +
      (x.historial.some(h => h.fila && !h.anulado) ? '<div class="campo" style="margin:0;min-width:260px"><label>Motivo para anular un reinicio</label><input type="text" id="cmMotAnular" autocomplete="off" placeholder="Escribe el motivo y pulsa Anular en la fila"></div>' : '') +
      '<button class="boton-secundario" id="cmCerrarHist">Cerrar historial</button></div></div>';
    $('cmCerrarHist').addEventListener('click', () => { $('cmForm').innerHTML = ''; });
    $('cmForm').querySelectorAll('button[data-anular]').forEach(b => protegerClic(b, async function () {
      const motivo = ($('cmMotAnular') && $('cmMotAnular').value) || '';
      if (!motivo.trim()) { mostrarMensaje('Escribe primero el motivo para anular.', 'error'); if ($('cmMotAnular')) $('cmMotAnular').focus(); return; }
      const r = await llamarBackend('mtControlAnular', { fila: Number(b.dataset.anular), motivo: motivo.trim() });
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo anular.', 'error'); return; }
      $('cmForm').innerHTML = '';
      mostrarMensaje(r.mensaje, 'exito');
      self._cargar();
    }));
    $('cmForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  /** Franja de aviso en el inicio (debajo de la de documentos) + contador en el tile. */
  aviso: function (unidades) {
    const L = (unidades || []).filter(x => x.estado === 'VENCIDO' || x.estado === 'POR VENCER')
      .sort((a, b) => (a.falta || 0) - (b.falta || 0));
    const badge = document.getElementById('cmBadge');
    if (badge) { badge.textContent = L.length; badge.style.display = L.length ? '' : 'none'; }
    let fr = document.getElementById('franjaAvisosMant');
    if (!L.length) { if (fr) fr.classList.remove('visible'); return; }
    if (!fr) {
      fr = document.createElement('div');
      fr.id = 'franjaAvisosMant';
      fr.className = 'franja-avisos-vencimiento';
      fr.style.background = 'linear-gradient(135deg, #b45309, #d97706)';
      fr.style.cursor = 'pointer';
      fr.innerHTML = '<div class="contenido-avisos"><span id="textoAvisosMant"></span><button type="button" id="btnCerrarAvisosMant">Cerrar</button></div>';
      const doc = document.getElementById('franjaAvisosVencimiento');
      if (doc && doc.parentNode) doc.parentNode.insertBefore(fr, doc.nextSibling); else document.body.insertBefore(fr, document.body.firstChild);
      fr.addEventListener('click', function (ev) {
        if (ev.target && ev.target.id === 'btnCerrarAvisosMant') { fr.classList.remove('visible'); return; }
        FormControlMant.abrir();
      });
    }
    const v = L.filter(x => x.estado === 'VENCIDO').length, p = L.length - v;
    const nom = x => x.tipo === 'GENSET' ? 'Genset UG' + String(x.unidad).padStart(4, '0') : x.unidad;
    const det = x => x.estado === 'VENCIDO' ? '+' + Math.round(-x.falta).toLocaleString('es-PE') + (x.tipo === 'TRACTO' ? ' km' : ' h')
      : 'faltan ' + Math.round(x.falta).toLocaleString('es-PE') + (x.tipo === 'TRACTO' ? ' km' : ' h');
    let t = '<strong>Mantenimiento preventivo:</strong> ' + [v ? v + ' vencido(s)' : '', p ? p + ' por vencer' : ''].filter(Boolean).join(' y ') + '. ';
    t += L.slice(0, 6).map(x => nom(x) + ' (' + det(x) + ')').join(' · ') + (L.length > 6 ? ' · y ' + (L.length - 6) + ' más...' : '');
    document.getElementById('textoAvisosMant').innerHTML = t;
    fr.classList.add('visible');
  },

  verificarAviso: async function () {
    try {
      const r = await llamarBackend('mtControlMant', {});
      if (r && r.ok) FormControlMant.aviso(r.unidades || []);
    } catch (e) { /* no bloquea */ }
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-control-mant');
  if (b) b.addEventListener('click', function () { FormControlMant.abrir(); });
  if (typeof Sesion !== 'undefined' && Sesion.alListo) Sesion.alListo(function () { if (Sesion.puede('MANT')) FormControlMant.verificarAviso(); });
});
