/**
 * forms/acarreoDocs.js  (v102, 06/11/2026)
 * -------------------------------------------------------------------------
 * Cierre del acarreo: N° de contenedor, cita de devolución (fecha y hora)
 * y 3 documentos.
 *   EXPORTACIÓN: EIR de salida, Guía de Remisión Remitente, Guía de Remisión Transportista.
 *   IMPORTACIÓN: Ticket de salida, Guía de Remisión Remitente, Guía de Remisión Transportista.
 * Con todo eso el acarreo queda COMPLETO (solo indicador, no bloquea nada).
 * Backend: acarreoListar, acarreoGrabar (hoja ACARREO_DOCS, archivos en Drive
 * "ACARREO - DOCUMENTOS/<código>").
 * -------------------------------------------------------------------------
 */
const FormAcarreoDocs = {
  _items: null,

  /** Mapa código → resumen (completo, n, urls). */
  cargar: async function (forzar) {
    if (this._items && !forzar) return this._items;
    try {
      const r = await llamarBackend('acarreoListar', forzar ? { _t: Date.now() } : {});
      this._items = (r && r.ok && r.items) ? r.items : {};
    } catch (e) { this._items = this._items || {}; }
    return this._items;
  },
  de: function (codigo) { return (this._items || {})[String(codigo || '').trim().toUpperCase()] || null; },
  esImpo: function (f) { return String(f['TIPO DE CARGA'] || '').toUpperCase().indexOf('IMPO') >= 0; },

  /** Botón para la fila de Acarreo. */
  boton: function (f) {
    const it = this.de(f['CODIGO SERVICIO']);
    if (it && it.completo) return '<button type="button" class="btn-acarreo ac-ok" title="Acarreo completo · clic para ver o cambiar">✓ Completo</button>';
    const n = it ? it.n : 0;
    return '<button type="button" class="btn-acarreo ac-pend" title="Registrar contenedor, cita de devolución y documentos">📎 ' + n + '/3</button>';
  },

  _fechaLocal: function (f) {
    const fv = f['FECHA DE DEVOLUCION'];
    if (!fv || String(fv).trim() === '-') return '';
    const d = new Date(fv); if (isNaN(d.getTime())) return '';
    const m = String(f['HORA DE DEVOLUCION'] || '').match(/(\d{1,2}):(\d{2})/);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + (m ? p(m[1]) + ':' + m[2] : '00:00');
  },
  _leer: function (input) {
    return new Promise(function (ok, mal) {
      const file = input.files && input.files[0];
      if (!file) { ok(null); return; }
      if (file.size > 10 * 1024 * 1024) { mal(new Error('"' + file.name + '" pesa más de 10 MB.')); return; }
      const fr = new FileReader();
      fr.onload = () => ok({ nombre: file.name, dataUrl: fr.result });
      fr.onerror = () => mal(new Error('No se pudo leer ' + file.name));
      fr.readAsDataURL(file);
    });
  },

  /** Abre la ventana (superpuesta a Acarreo) para el servicio f. alGuardar() refresca la lista. */
  abrir: async function (f, alGuardar) {
    const self = this;
    const cod = String(f['CODIGO SERVICIO'] || '').trim();
    if (!cod) { mostrarMensaje('Este servicio no tiene código de servicio.', 'error'); return; }
    await self.cargar();
    const it = self.de(cod) || {};
    const impo = self.esImpo(f);
    const doc1 = impo ? 'Ticket de salida' : 'EIR de salida';
    const link = (u, t) => u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">Ver ' + t + '</a>' : '<span style="color:#b91c1c">Falta</span>';
    const fila = (id, titulo, url) => `
      <div class="ac-doc">
        <div><b>${titulo}</b><div class="ac-est">${link(url, 'actual')}</div></div>
        <input type="file" id="${id}" accept=".pdf,image/*">
      </div>`;
    const cont = document.createElement('div');
    cont.className = 'ac-velo';
    cont.innerHTML = `
      <style>
        .ac-velo{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px}
        .ac-caja{background:#fff;border-radius:14px;max-width:620px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.25)}
        .ac-cab{background:#1c3a5e;color:#fff;padding:12px 16px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center}
        .ac-cuerpo{padding:14px 16px}
        .ac-info{background:#f1f5f9;border-radius:9px;padding:8px 10px;font-size:.82rem;color:#334155;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:4px 14px}
        .ac-g{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .ac-doc{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:9px;padding:8px 10px;margin-top:8px}
        .ac-est{font-size:.78rem;margin-top:2px}
        .ac-tipo{display:inline-block;padding:2px 9px;border-radius:9px;font-weight:700;font-size:.75rem;background:#dbeafe;color:#1e40af}
      </style>
      <div class="ac-caja">
        <div class="ac-cab"><b>Cierre del acarreo</b><button type="button" id="acX" style="background:none;border:0;color:#fff;font-size:20px;cursor:pointer">×</button></div>
        <div class="ac-cuerpo">
          <div class="ac-info">
            <span>Código: <b>${esc(cod)}</b></span><span>Booking: <b>${esc(f['BOOKING'] || '')}</b></span>
            <span>Cliente: <b>${esc(f['CLIENTE PARA FACTURACIÓN'] || '')}</b></span><span>Conductor: <b>${esc(f['CONDUCTOR'] || '')}</b></span>
            <span class="ac-tipo">${impo ? 'IMPORTACIÓN' : 'EXPORTACIÓN'}</span>
          </div>
          <div class="ac-g">
            <div class="campo"><label>N° de contenedor</label><input id="acCont" value="${esc(f['N° CONTENEDOR'] || it.contenedor || '')}" style="text-transform:uppercase" autocomplete="off" placeholder="ABCD1234567"></div>
            <div class="campo"><label>Cita de devolución (fecha y hora)</label><input type="datetime-local" id="acDev" value="${self._fechaLocal(f)}"></div>
          </div>
          <div style="margin-top:6px;font-size:.85rem;color:#1c3a5e"><b>Documentos</b> (PDF o foto, máx. 10 MB c/u). Si ya hay uno, subir otro lo reemplaza.</div>
          ${fila('acD1', doc1, (it.doc1 || {}).url)}
          ${fila('acGrr', 'Guía de Remisión Remitente', (it.grr || {}).url)}
          ${fila('acGrt', 'Guía de Remisión Transportista', (it.grt || {}).url)}
          <div id="acEstado" style="margin-top:10px;font-size:.85rem"></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
            <button type="button" class="boton-secundario" id="acCancelar">Cancelar</button>
            <button type="button" class="boton-primario" id="acGrabar">Guardar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(cont);
    const $ = id => cont.querySelector('#' + id);
    const cerrar = () => cont.remove();
    $('acX').addEventListener('click', cerrar); $('acCancelar').addEventListener('click', cerrar);
    $('acEstado').innerHTML = it.completo ? '<span style="color:#166534;font-weight:700">✓ Acarreo completo' + (it.por ? ' · ' + esc(it.por) + ' ' + esc(it.fecha) : '') + '</span>'
      : '<span style="color:#92400e">Para que el acarreo quede completo se necesitan: contenedor, cita de devolución y los 3 documentos.</span>';
    $('acGrabar').addEventListener('click', async function () {
      const btn = this; btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const dev = $('acDev').value;
        const docs = {};
        const d1 = await self._leer($('acD1')), grr = await self._leer($('acGrr')), grt = await self._leer($('acGrt'));
        if (d1) docs.doc1 = d1; if (grr) docs.grr = grr; if (grt) docs.grt = grt;
        const p = dev ? dev.split('T') : null;
        const datos = {
          codigo: cod, tipo: impo ? 'IMPORTACION' : 'EXPORTACION', contenedor: $('acCont').value.trim().toUpperCase(),
          fechaDev: p ? p[0].split('-').reverse().join('/') : '', horaDev: p ? (p[1] || '').slice(0, 5) : '', docs: docs
        };
        const r = await llamarBackend('acarreoGrabar', datos);
        if (!r || !r.ok) throw new Error((r && r.mensaje) || 'No se pudo guardar.');
        self._items = self._items || {}; self._items[cod.toUpperCase()] = r.item;
        cerrar();
        mostrarMensaje(r.mensaje, r.completo ? 'exito' : 'info');
        if (typeof alGuardar === 'function') alGuardar();
      } catch (e) {
        mostrarMensaje(e.message || String(e), 'error');
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    });
  },

  /** Enlaces a los 3 documentos (para Facturar). */
  enlacesHtml: function (codigo) {
    const it = this.de(codigo);
    if (!it || !it.n) return '<span style="color:#94a3b8">Documentos del acarreo: aún no se subieron.</span>';
    const a = (u, t) => u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">📄 ' + t + '</a>' : '<span style="color:#b91c1c">✗ ' + t + '</span>';
    const impo = String(it.tipo).toUpperCase().indexOf('IMPO') >= 0;
    return '<b>Documentos del acarreo (' + (impo ? 'importación' : 'exportación') + '):</b> ' +
      a((it.doc1 || {}).url, impo ? 'Ticket de salida' : 'EIR de salida') + ' · ' +
      a((it.grr || {}).url, 'GR Remitente') + ' · ' + a((it.grt || {}).url, 'GR Transportista') +
      (it.completo ? ' <span style="color:#166534;font-weight:700">✓ completo</span>' : '');
  }
};
