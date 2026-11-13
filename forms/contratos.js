/**
 * forms/contratos.js
 * -------------------------------------------------------------------------
 * Maestro de CONTRATOS del personal de transporte (conductores, operativos y
 * administrativos). No se sube documento: solo fecha de inicio y vencimiento.
 * Los contratos activos vencidos o por vencer salen en la franja de avisos.
 * Backend (v118): contratosListar, contratosGrabar, contratosBaja. Hoja CONTRATOS.
 * -------------------------------------------------------------------------
 */
const FormContratos = {
  AREAS: ['CONDUCTOR', 'OPERATIVO', 'ADMINISTRATIVO'],

  abrir: async function () {
    const self = this;
    const r = await llamarBackend('contratosListar', {});
    if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo cargar la lista de contratos.', 'error'); return; }
    self._items = r.items || [];
    self._diasAviso = r.diasAviso || 10;
    const html = `
      <style>
        .ct-barra{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:end;margin-bottom:8px}
        .ct-barra .campo{margin:0;min-width:130px}
        .ct-kpi{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px}
        .ct-kpi div{background:#f1f5f9;border-radius:9px;padding:6px 12px;font-size:.75rem;color:#475569}
        .ct-kpi b{display:block;font-size:1.05rem;color:#1c3a5e}
        .ct-t{width:100%;table-layout:fixed;border-collapse:collapse;font-size:.8rem}
        .ct-t th{background:#eef2f7;color:#1c3a5e;font-size:.7rem;padding:6px;text-align:left;position:sticky;top:0}
        .ct-t td{padding:6px;border-bottom:1px solid #eef2f7;vertical-align:top;overflow-wrap:anywhere}
        .ct-t tbody tr{cursor:pointer}.ct-t tbody tr:hover td{background:#f8fafc}
        .ct-tag{display:inline-block;padding:1px 8px;border-radius:8px;font-size:.7rem;font-weight:700}
        .ct-wrap{max-height:58vh;overflow:auto;border:1px solid #e1e6ec;border-radius:10px}
      </style>
      <div class="ct-barra">
        <div class="campo"><label>Área</label><select id="ctArea"><option value="">Todas</option>${self.AREAS.map(a => '<option>' + a + '</option>').join('')}</select></div>
        <div class="campo"><label>Situación</label><select id="ctSit"><option value="">Todas (activos)</option><option value="venc">Vencidos</option><option value="por">Por vencer (${self._diasAviso} días)</option><option value="vig">Vigentes</option><option value="sin">Sin fechas</option><option value="baja">Dados de baja</option></select></div>
        <div class="campo" style="flex:1;min-width:200px"><label>Buscar</label><input id="ctBuscar" autocomplete="off" placeholder="Nombre, DNI o cargo" style="text-transform:uppercase"></div>
        <button class="boton-primario" id="ctNuevo">+ Agregar persona</button>
      </div>
      <div class="ct-kpi" id="ctKpi"></div>
      <div class="ct-wrap"><table class="ct-t">
        <colgroup><col style="width:24%"><col style="width:10%"><col style="width:12%"><col style="width:14%"><col style="width:10%"><col style="width:10%"><col style="width:20%"></colgroup>
        <thead><tr><th>Nombre</th><th>DNI</th><th>Área</th><th>Cargo</th><th>Inicio</th><th>Vencimiento</th><th>Situación</th></tr></thead>
        <tbody id="ctCuerpo"></tbody></table></div>
      <div class="panel-footer" style="padding-top:10px;justify-content:flex-end"><button class="boton-secundario" id="ctCerrar">Cerrar</button></div>`;
    abrirPanel('Contratos del personal', html, function (raiz) {
      self._raiz = raiz;
      const $ = id => raiz.querySelector('#' + id);
      ['ctArea', 'ctSit'].forEach(id => $(id).addEventListener('change', () => self._pintar()));
      $('ctBuscar').addEventListener('input', () => self._pintar());
      $('ctNuevo').addEventListener('click', () => self._ficha(null));
      $('ctCerrar').addEventListener('click', cerrarPanel);
      $('ctCuerpo').addEventListener('click', function (ev) {
        const tr = ev.target.closest('tr[data-id]'); if (!tr) return;
        self._ficha(self._items.find(x => x.id === tr.dataset.id));
      });
      self._pintar();
    }, { ancho: true });
  },

  _sit: function (x) {
    if (String(x.estado).toUpperCase() === 'BAJA') return 'baja';
    if (x.dias === null || x.dias === undefined || !x.vencimiento) return 'sin';
    if (x.dias < 0) return 'venc';
    if (x.dias < this._diasAviso) return 'por';
    return 'vig';
  },
  _tag: function (x) {
    const s = this._sit(x);
    if (s === 'baja') return '<span class="ct-tag" style="background:#e2e8f0;color:#475569">Dado de baja</span>' + (x.motivoBaja ? '<div style="font-size:.7rem;color:#64748b">' + esc(x.motivoBaja) + '</div>' : '');
    if (s === 'sin') return '<span class="ct-tag" style="background:#fef3c7;color:#92400e">Sin fechas</span>';
    if (s === 'venc') return '<span class="ct-tag" style="background:#fee2e2;color:#991b1b">Vencido hace ' + Math.abs(x.dias) + ' día(s)</span>';
    if (s === 'por') return '<span class="ct-tag" style="background:#ffedd5;color:#9a3412">Vence en ' + x.dias + ' día(s)</span>';
    return '<span class="ct-tag" style="background:#dcfce7;color:#166534">Vigente · ' + x.dias + ' días</span>';
  },

  _pintar: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const area = $('ctArea').value, sit = $('ctSit').value, q = $('ctBuscar').value.trim().toUpperCase();
    const activos = self._items.filter(x => self._sit(x) !== 'baja');
    $('ctKpi').innerHTML = [['Personas activas', activos.length], ['Vencidos', activos.filter(x => self._sit(x) === 'venc').length],
      ['Por vencer', activos.filter(x => self._sit(x) === 'por').length], ['Sin fechas', activos.filter(x => self._sit(x) === 'sin').length]]
      .map(k => '<div>' + k[0] + '<b>' + k[1] + '</b></div>').join('');
    const orden = { venc: 0, por: 1, sin: 2, vig: 3, baja: 4 };
    const vis = self._items.filter(x => {
      const s = self._sit(x);
      if (sit ? s !== sit : s === 'baja') return false;
      if (area && x.area !== area) return false;
      if (q && [x.nombre, x.dni, x.cargo].join(' ').toUpperCase().indexOf(q) < 0) return false;
      return true;
    }).sort((a, b) => (orden[self._sit(a)] - orden[self._sit(b)]) || ((a.dias === null ? 1e9 : a.dias) - (b.dias === null ? 1e9 : b.dias)) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    $('ctCuerpo').innerHTML = vis.length ? vis.map(x => '<tr data-id="' + esc(x.id) + '"><td><b>' + esc(x.nombre) + '</b></td><td>' + esc(x.dni) + '</td><td>' + esc(x.area) + '</td><td>' + esc(x.cargo) +
      '</td><td>' + esc(x.inicio || '—') + '</td><td>' + esc(x.vencimiento || '—') + '</td><td>' + self._tag(x) + '</td></tr>').join('')
      : '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:16px">No hay personas con estos filtros.</td></tr>';
    if (typeof _refrescarSnapshotFormulario === 'function') setTimeout(_refrescarSnapshotFormulario, 0);
  },

  /** Ficha para agregar o editar (y dar de baja / reactivar). */
  _ficha: function (x) {
    const self = this, iso = t => { const m = String(t || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
    const capa = document.createElement('div');
    capa.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px';
    const baja = x && String(x.estado).toUpperCase() === 'BAJA';
    capa.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.25)">' +
      '<div style="background:#1c3a5e;color:#fff;padding:12px 16px;border-radius:14px 14px 0 0"><b>' + (x ? '✎ ' + esc(x.nombre) : '+ Agregar persona') + '</b></div>' +
      '<div style="padding:14px 16px;display:grid;grid-template-columns:2fr 1fr;gap:10px;font-size:.85rem">' +
      '<div class="campo"><label>Nombre completo *</label><input id="cfNom" style="text-transform:uppercase"></div>' +
      '<div class="campo"><label>DNI</label><input id="cfDni" inputmode="numeric" maxlength="12"></div>' +
      '<div class="campo"><label>Área *</label><select id="cfArea"><option value=""></option>' + self.AREAS.map(a => '<option>' + a + '</option>').join('') + '</select></div>' +
      '<div class="campo"><label>Cargo</label><input id="cfCargo" style="text-transform:uppercase" placeholder="Ej. CONDUCTOR, MECÁNICO, ASISTENTE"></div>' +
      '<div class="campo"><label>Inicio del contrato</label><input id="cfIni" type="date"></div>' +
      '<div class="campo"><label>Vencimiento del contrato</label><input id="cfVen" type="date"></div>' +
      '<div class="campo" style="grid-column:1/-1"><label>Observación</label><input id="cfObs"></div>' +
      (x && x.historial && x.historial.length ? '<div style="grid-column:1/-1;font-size:.78rem;color:#475569"><b>Contratos anteriores:</b> ' + x.historial.map(h => esc((h.inicio || '?') + ' → ' + (h.vencimiento || '?'))).join(' · ') + '</div>' : '') +
      (x ? '<div style="grid-column:1/-1;font-size:.72rem;color:#94a3b8">Última actualización: ' + esc(x.actualizadoPor || '') + ' · ' + esc(x.fechaAct || '') + '</div>' : '') +
      '</div><div style="display:flex;justify-content:space-between;gap:8px;padding:0 16px 14px;flex-wrap:wrap">' +
      '<span>' + (x ? (baja ? '<button class="boton-secundario" id="cfReact">↺ Reactivar</button>' : '<button class="boton-peligro" id="cfBaja">Dar de baja</button>') : '') + '</span>' +
      '<span style="display:flex;gap:8px"><button class="boton-secundario" id="cfNo">Cancelar</button><button class="boton-primario" id="cfSi">Guardar</button></span></div></div>';
    document.body.appendChild(capa);
    const q = id => capa.querySelector('#' + id);
    if (x) { q('cfNom').value = x.nombre || ''; q('cfDni').value = x.dni || ''; q('cfArea').value = x.area || ''; q('cfCargo').value = x.cargo || ''; q('cfIni').value = iso(x.inicio); q('cfVen').value = iso(x.vencimiento); q('cfObs').value = x.observacion || ''; }
    const cerrar = () => capa.remove();
    q('cfNo').addEventListener('click', cerrar);
    const recargar = async function () {
      const r = await llamarBackend('contratosListar', { t: Date.now() });
      if (r && r.ok) { self._items = r.items || []; self._pintar(); }
    };
    protegerClic(q('cfSi'), async function () {
      const d = { id: x ? x.id : '', nombre: q('cfNom').value.trim(), dni: q('cfDni').value.trim(), area: q('cfArea').value, cargo: q('cfCargo').value.trim(), inicio: q('cfIni').value, vencimiento: q('cfVen').value, observacion: q('cfObs').value.trim() };
      if (!d.nombre) { mostrarMensaje('Escribe el nombre.', 'error'); return; }
      if (!d.area) { mostrarMensaje('Elige el área.', 'error'); return; }
      if (d.inicio && d.vencimiento && d.vencimiento < d.inicio) { mostrarMensaje('El vencimiento no puede ser antes del inicio.', 'error'); return; }
      const r = await llamarBackend('contratosGrabar', d);
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo guardar.', 'error'); return; }
      cerrar(); mostrarMensaje(r.mensaje, 'exito'); recargar();
    });
    if (q('cfBaja')) protegerClic(q('cfBaja'), async function () {
      const motivo = window.prompt('Motivo de la baja (ej. renunció, fin de contrato):', '');
      if (motivo === null) return;
      if (motivo.trim().length < 3) { mostrarMensaje('Escribe el motivo de la baja.', 'error'); return; }
      const r = await llamarBackend('contratosBaja', { id: x.id, baja: true, motivo: motivo.trim() });
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo grabar.', 'error'); return; }
      cerrar(); mostrarMensaje(r.mensaje, 'exito'); recargar();
    });
    if (q('cfReact')) protegerClic(q('cfReact'), async function () {
      const r = await llamarBackend('contratosBaja', { id: x.id, baja: false });
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo grabar.', 'error'); return; }
      cerrar(); mostrarMensaje(r.mensaje, 'exito'); recargar();
    });
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-contratos');
  if (b) b.addEventListener('click', function () { FormContratos.abrir(); });
});
