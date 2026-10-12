/**
 * forms/cierreCombustible.js  (v76)
 * -------------------------------------------------------------------------
 * "Cierre de combustible del viaje" (reemplaza a Control de combustible).
 * Modelo de 3 datos y 3 lecturas:
 *   1. Estimado: galones establecidos por destino (del servicio).
 *   2. Abastecido real: notas de venta (inicial + recargas) con galones y
 *      monto del comprobante.
 *   3. Consumo real: lectura antes de abastecer + abastecido − lectura final.
 *   La lectura después de abastecer contrasta el comprobante con la sonda
 *   (tolerancia ±1 %; si se pasa, justificación obligatoria).
 * Se graba el mismo día; el Consolidado toma estos datos.
 * Backend: cierreListar, cierreDatos, cierreGrabar (+ listarServiciosPendientes).
 * -------------------------------------------------------------------------
 */
const FormCierreCombustible = {

  ESTADOS_CIERRE: ['EN RUTA RETORNO', 'COLA PUERTO', 'CULMINADO', 'FALSO FLETE'],
  _servicios: [],
  _cierres: {},

  css: `
    <style>
      .cc-filtros { display:grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap:8px 10px; align-items:end; margin-bottom:8px; }
      .cc-filtros .campo { margin:0; } .cc-filtros input, .cc-filtros select { width:100%; }
      @media (max-width: 1000px) { .cc-filtros { grid-template-columns: repeat(3, minmax(0,1fr)); } }
      .cc-tabla { width:100%; table-layout:fixed; font-size:.78rem; }
      .cc-tabla th, .cc-tabla td { overflow-wrap:anywhere; padding:6px 5px; vertical-align:middle; }
      .cc-tabla td small { display:block; color:#64748b; font-size:.72rem; }
      .cc-tabla td.num { text-align:right; white-space:nowrap; }
      .cc-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:.7rem; font-weight:800; white-space:nowrap; }
      .cc-ok { background:#dcfce7; color:#166534; } .cc-pend { background:#fef3c7; color:#92400e; } .cc-mal { background:#fee2e2; color:#991b1b; } .cc-gris { background:#e2e8f0; color:#475569; }
      .cc-scroll { max-height:calc(74vh - 240px); min-height:220px; overflow-y:auto; overflow-x:hidden; }
      .cc-cab { display:flex; flex-wrap:wrap; gap:6px 20px; background:#fff; border:1px solid #dbe2ea; border-left:4px solid #1c3a5e; border-radius:10px; padding:9px 14px; margin-bottom:12px; font-size:.84rem; color:#475569; }
      .cc-cab b { color:#1c3a5e; }
      .cc-seg { border:1px solid #dbe2ea; border-radius:10px; margin:0 0 12px; background:#fff; overflow:hidden; }
      .cc-seg-tit { background:#eef3f8; color:#1c3a5e; font-weight:700; font-size:.76rem; letter-spacing:.4px; text-transform:uppercase; padding:7px 12px; border-bottom:1px solid #dbe2ea; display:flex; gap:8px; align-items:center; }
      .cc-seg-tit .nota { margin-left:auto; text-transform:none; letter-spacing:0; font-weight:500; color:#64748b; }
      .cc-g { display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap:0 12px; padding:10px 12px 2px; }
      .cc-g .campo { margin-bottom:10px; } .cc-g .span2 { grid-column: span 2; }
      .cc-g .campo.calc input { background:#f1f5f9; color:#1c3a5e; font-weight:700; border-color:#e2e8f0; }
      .cc-ab { width:100%; border-collapse:collapse; table-layout:fixed; font-size:.8rem; margin:8px 0; }
      .cc-ab th { text-align:left; font-size:.7rem; color:#1c3a5e; padding:0 5px 4px 0; }
      .cc-ab td { padding:0 5px 6px 0; vertical-align:middle; }
      .cc-ab input, .cc-ab select { width:100%; padding:6px 7px; border:1.5px solid #c7ced8; border-radius:7px; font-size:.8rem; font-family:inherit; }
      .cc-ab input:disabled { background:#f1f5f9; color:#1c3a5e; font-weight:700; }
      .cc-ab .quitar { border:none; background:transparent; color:#b91c1c; font-size:1.05rem; cursor:pointer; }
      .cc-mas { border:1.5px dashed #94a3b8; background:#f8fafc; color:#1c3a5e; border-radius:8px; font-size:.78rem; font-weight:700; padding:5px 11px; cursor:pointer; margin:0 12px 10px; }
      .cc-res { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap:8px; padding:10px 12px; }
      .cc-res div { background:#f1f5f9; border-radius:8px; padding:6px 10px; }
      .cc-res span { display:block; font-size:.66rem; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:.3px; }
      .cc-res b { font-size:1rem; color:#1c3a5e; }
      .cc-res div.verde { background:#dcfce7; } .cc-res div.ambar { background:#fef3c7; } .cc-res div.rojo { background:#fee2e2; }
      .cc-pie { display:flex; gap:10px; align-items:center; padding-top:8px; }
    </style>`,

  abrir: function () {
    const self = this;
    const html = self.css + `
      <div class="cc-filtros">
        <div class="campo"><label>Desde</label><input type="date" id="ccDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="ccHasta"></div>
        <div class="campo"><label>Placa</label><div id="msCcPlaca"></div></div>
        <div class="campo"><label>Conductor</label><div id="msCcConductor"></div></div>
        <div class="campo"><label>Estado del viaje</label><div id="msCcEstado"></div></div>
        <div class="campo"><label>Mostrar</label>
          <select id="ccMostrar"><option value="P">Pendientes de cierre</option><option value="C">Cerrados</option><option value="">Todos</option></select></div>
        <div class="campo"><label>Buscar (booking, contenedor…)</label><input type="text" id="ccBuscar" autocomplete="off"></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin:0 0 6px;"><div id="ccResumen" style="font-size:.8rem;color:#475569;flex:1">Cargando…</div>
        <button type="button" class="boton-primario" id="ccGrafico" style="padding:6px 12px;font-size:.8rem">📊 Gráfico: estimado vs abastecido vs real</button></div>
      <div class="cc-scroll">
        <table class="tabla-lista cc-tabla">
          <colgroup><col style="width:8%"><col style="width:8%"><col style="width:15%"><col style="width:15%"><col style="width:11%"><col style="width:10%"><col style="width:7%"><col style="width:16%"><col style="width:10%"></colgroup>
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Booking / contenedor</th><th>Placa / conductor</th><th>Destino</th><th>Estado del viaje</th><th>GL estimado</th><th>Cierre de combustible</th><th></th></tr></thead>
          <tbody id="ccCuerpo"><tr><td colspan="9">Cargando…</td></tr></tbody>
        </table>
      </div>`;
    abrirPanel('Cierre de combustible del viaje', html, function (raiz) { self._wireLista(raiz); }, { ancho: true });
  },

  _iso: function (v) {
    const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})(?!T)/);
    if (m) return m[1];
    const d = _aFecha(v);
    return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : '';
  },

  _wireLista: function (raiz) {
    const self = this;
    const $ = function (id) { return raiz.querySelector('#' + id); };
    const mayus = v => String(v || '').trim().toUpperCase();
    const pintar = function () {
      const desde = $('ccDesde').value, hasta = $('ccHasta').value, mostrar = $('ccMostrar').value, q = mayus($('ccBuscar').value);
      const vis = self._servicios.filter(function (s) {
        const iso = self._iso(s['FECHA DE PROGRAMACION']);
        if (desde && (!iso || iso < desde)) return false;
        if (hasta && (!iso || iso > hasta)) return false;
        if (!msPlaca.cumple(mayus(s['PLACA TRACTO'])) || !msCond.cumple(mayus(s['CONDUCTOR'])) || !msEstado.cumple(mayus(s['ESTADO']) || 'PROGRAMADO')) return false;
        const c = self._cierres[s._fila];
        if (mostrar === 'C' && !c) return false;
        if (mostrar === 'P' && (c || self.ESTADOS_CIERRE.indexOf(mayus(s['ESTADO'])) === -1)) return false;
        if (q && [s['BOOKING'], s['N° CONTENEDOR'], s['DESTINO 1'], s['CLIENTE PARA FACTURACIÓN']].join(' ').toUpperCase().indexOf(q) === -1) return false;
        return true;
      }).sort((a, b) => self._iso(b['FECHA DE PROGRAMACION']).localeCompare(self._iso(a['FECHA DE PROGRAMACION'])));
      const nCerr = vis.filter(s => self._cierres[s._fila]).length;
      $('ccResumen').textContent = vis.length + ' viaje(s) · ' + nCerr + ' cerrado(s) · ' + (vis.length - nCerr) + ' sin cierre.';
      $('ccCuerpo').innerHTML = vis.length ? vis.map(function (s) {
        const c = self._cierres[s._fila];
        let est = '<span class="cc-badge cc-pend">Sin cierre</span>';
        if (c) {
          const malDif = c.difPct !== null && Math.abs(c.difPct) > 1;
          est = '<span class="cc-badge ' + (malDif || c.exceso > 0 ? 'cc-mal' : 'cc-ok') + '">Cerrado</span>' +
            '<small>' + (c.consumo !== null ? c.consumo.toFixed(1) + ' gal' + (c.rendimiento ? ' · ' + c.rendimiento.toFixed(2) + ' km/gal' : '') : 'Sin lectura (lleno a lleno)') +
            (c.exceso > 0 ? ' · exceso ' + c.exceso.toFixed(1) + ' gal' : '') + (malDif ? ' · comprobante vs sonda ' + c.difPct.toFixed(1) + ' %' : '') + '</small>';
        }
        return '<tr><td>' + esc(formatoFecha(s['FECHA DE PROGRAMACION'])) + '</td><td>' + esc(s['CLIENTE PARA FACTURACIÓN']) + '</td>' +
          '<td>' + esc(s['BOOKING']) + '<small>' + esc(s['N° CONTENEDOR']) + (s['CODIGO SERVICIO'] ? ' · ' + esc(s['CODIGO SERVICIO']) : '') + '</small></td>' +
          '<td>' + esc(s['PLACA TRACTO']) + '<small>' + esc(s['CONDUCTOR']) + '</small></td>' +
          '<td>' + esc(s['DESTINO 1']) + '</td><td>' + esc(s['ESTADO'] || 'PROGRAMADO') + '</td>' +
          '<td class="num">' + (Number(s['GL TRACTO']) || 0).toFixed(1) + '</td><td>' + est + '</td>' +
          '<td><button type="button" class="boton-primario cc-abrir" data-fila="' + s._fila + '" style="padding:5px 10px;font-size:.76rem">' + (c ? 'Ver / editar' : 'Cerrar') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="9" style="color:#64748b">No hay viajes con estos filtros.</td></tr>';
      $('ccCuerpo').querySelectorAll('.cc-abrir').forEach(function (b) {
        b.addEventListener('click', function () { self._abrirCierre(Number(b.dataset.fila)); });
      });
      _refrescarSnapshotFormulario();
    };
    const msPlaca = crearMultiSelect($('msCcPlaca'), { onChange: pintar });
    const msCond = crearMultiSelect($('msCcConductor'), { onChange: pintar });
    const msEstado = crearMultiSelect($('msCcEstado'), { onChange: pintar });
    ['ccDesde', 'ccHasta', 'ccMostrar'].forEach(id => $(id).addEventListener('change', pintar));
    $('ccBuscar').addEventListener('input', pintar);
    $('ccGrafico').addEventListener('click', function () { FormGraficoCombustible.abrir(); });
    self._pintarLista = pintar;
    (async function () {
      const r = await Promise.all([llamarBackend('listarServiciosPendientes', {}), llamarBackend('cierreListar', {})]);
      self._servicios = Array.isArray(r[0]) ? r[0] : [];
      self._cierres = (r[1] && r[1].cierres) || {};
      const unicos = k => Array.from(new Set(self._servicios.map(s => mayus(s[k])).filter(Boolean))).sort();
      msPlaca.setOpciones(unicos('PLACA TRACTO'));
      msCond.setOpciones(unicos('CONDUCTOR'));
      msEstado.setOpciones(Array.from(new Set(self._servicios.map(s => mayus(s['ESTADO']) || 'PROGRAMADO'))).sort());
      pintar();
    })();
  },

  _abrirCierre: async function (fila) {
    const self = this;
    const s = self._servicios.filter(x => x._fila === fila)[0];
    if (!s) return;
    const r = await llamarBackend('cierreDatos', { fila: fila, placa: s['PLACA TRACTO'], fecha: formatoFecha(s['FECHA DE PROGRAMACION'], '') });
    if (!respuestaValida(r)) { mostrarMensaje((r && r.mensaje) || 'No se pudo abrir el cierre.', 'error'); return; }
    const c = r.cierre || {};
    const glT = Number(s['GL TRACTO']) || 0, glG = Number(s['GL GENERADOR']) || 0;
    const precio = Number(String(s['COSTO DEL PETRÓLEO X GALÓN'] || '').replace(',', '.')) || 0;
    const dest = esc(s['DESTINO 1']) + (s['DESTINO 2'] && s['DESTINO 2'] !== '-' ? ' / ' + esc(s['DESTINO 2']) : '');
    const val = v => (v === undefined || v === null) ? '' : esc(v);
    const dtl = v => { const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/); return m ? m[1] + 'T' + m[2] : ''; };
    const html = self.css + `
      <div style="margin-bottom:8px"><button type="button" class="boton-secundario" id="ccVolver">← Volver a la lista</button></div>
      <div class="cc-cab">
        <span>Fecha: <b>${esc(formatoFecha(s['FECHA DE PROGRAMACION']))}</b></span><span>Cliente: <b>${esc(s['CLIENTE PARA FACTURACIÓN'])}</b></span>
        <span>Booking: <b>${esc(s['BOOKING'])}</b></span><span>Contenedor: <b>${esc(s['N° CONTENEDOR'])}</b></span>
        <span>Placa: <b>${esc(s['PLACA TRACTO'])}</b></span><span>Conductor: <b>${esc(s['CONDUCTOR'])}</b></span><span>Destino: <b>${dest}</b></span>
        <span>Estado: <b>${esc(s['ESTADO'] || 'PROGRAMADO')}</b></span>
        ${c['CERRADO POR'] ? '<span>Cerrado por: <b>' + esc(c['CERRADO POR']) + '</b> · ' + esc(c['FECHA CIERRE']) + '</span>' : ''}
      </div>

      <div class="cc-seg">
        <div class="cc-seg-tit">1. Estimado <span class="nota">Lo que el conductor debe abastecer (galones establecidos para el destino)</span></div>
        <div class="cc-g">
          <div class="campo calc"><label>GL estimados tracto</label><input id="ccEstT" value="${glT}" disabled></div>
          <div class="campo calc"><label>GL estimados generador</label><input id="ccEstG" value="${glG}" disabled></div>
          <div class="campo calc"><label>Precio de referencia (S/ x gl)</label><input value="${precio || ''}" disabled></div>
        </div>
      </div>

      <div class="cc-seg">
        <div class="cc-seg-tit">2. Abastecido real <span class="nota">Notas de venta: galones y monto del comprobante</span></div>
        <table class="cc-ab" id="ccAb" style="padding:0 12px">
          <colgroup><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:13%"><col style="width:12%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:7%"><col style="width:26px"></colgroup>
          <thead><tr><th>Tipo</th><th>Equipo</th><th>Fecha</th><th>Grifo</th><th>N° nota de venta</th><th>Pagó</th><th>Galones comprob.</th><th>Monto S/</th><th>Galones sonda</th><th>Dif. %</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
        <button type="button" class="cc-mas" id="ccMasRecarga">+ Agregar recarga en ruta</button>
        <div style="font-size:.74rem;color:#64748b;margin:0 12px 10px">Galones sonda del abastecimiento inicial del tracto = lectura después − lectura antes (se calcula solo). En recargas, escríbalo desde la plataforma si lo tiene.</div>
      </div>

      <div class="cc-seg">
        <div class="cc-seg-tit">3. Lecturas del tanque del tracto y KM <span class="nota">Copiar de la plataforma de la sonda</span></div>
        <div class="cc-g">
          <div class="campo"><label>Fuente de la lectura</label><select id="ccFuente"><option value="SONDA">Sonda</option><option value="VARILLA">Varilla</option><option value="SIN LECTURA">Sin lectura (lleno a lleno)</option></select></div>
          <div class="campo"><label>Lectura antes de abastecer (gal)</label><input id="ccLAntes" inputmode="decimal" value="${val(c['LECTURA ANTES'])}"></div>
          <div class="campo"><label>Fecha y hora</label><input type="datetime-local" id="ccFAntes" value="${dtl(c['FECHA LECTURA ANTES'])}"></div>
          <div class="campo" id="ccCampoDesp"><label>Lectura después de abastecer (gal)</label><input id="ccLDesp" inputmode="decimal" value="${val(c['LECTURA DESPUES'])}"></div>
          <div class="campo"><label>Lectura al final del viaje (gal)</label><input id="ccLFin" inputmode="decimal" value="${val(c['LECTURA FINAL'])}"></div>
          <div class="campo"><label>Fecha y hora</label><input type="datetime-local" id="ccFFin" value="${dtl(c['FECHA LECTURA FINAL'])}"></div>
          <div class="campo"><label>KM inicial</label><input id="ccKmI" inputmode="decimal" value="${val(c['KM INICIAL'] !== undefined && c['KM INICIAL'] !== '' ? c['KM INICIAL'] : (r.kmAnterior || ''))}"></div>
          <div class="campo"><label>KM final</label><input id="ccKmF" inputmode="decimal" value="${val(c['KM FINAL'])}"></div>
          <div class="campo calc"><label>KM recorrido</label><input id="ccKm" disabled></div>
          <div class="campo"><label>Consumo según Navisat (gal)</label><input id="ccNavisat" inputmode="decimal" placeholder="Opcional" value="${val(c['CONSUMO NAVISAT'])}"></div>
          <div class="campo" style="display:flex;align-items:end;gap:8px;padding-bottom:8px"><label style="display:flex;gap:6px;align-items:center;font-weight:600"><input type="checkbox" id="ccLleno" ${c['TANQUE LLENO'] === 'SI' ? 'checked' : ''}> Se abasteció a tanque lleno</label></div>
          <div class="campo"><label>&nbsp;</label><div style="font-size:.72rem;color:#64748b">${r.kmAnterior ? 'KM final del viaje anterior: ' + Number(r.kmAnterior).toLocaleString('es-PE') + (r.fechaKmAnterior ? ' (' + esc(r.fechaKmAnterior) + ')' : '') : 'Sin viaje anterior registrado'}</div></div>
        </div>
      </div>

      <div class="cc-seg">
        <div class="cc-seg-tit">4. Resultado del viaje</div>
        <div class="cc-res" id="ccRes"></div>
        <div style="padding:0 12px 10px"><label style="font-size:.76rem;font-weight:700;color:#1c3a5e">Justificación <span id="ccJustReq" style="color:#b91c1c;display:none">(obligatoria: la diferencia comprobante vs. sonda pasa de ±${r.tolerancia || 1} %)</span></label>
          <textarea id="ccJust" rows="2" style="width:100%;padding:7px 9px;border:1.5px solid #c7ced8;border-radius:8px;font-family:inherit;font-size:.84rem">${val(c['JUSTIFICACION'])}</textarea></div>
      </div>

      <div class="cc-pie"><span style="flex:1"></span>
        <button class="boton-secundario" id="ccCancelar" type="button">Cancelar</button>
        <button class="boton-primario" id="ccGrabar" type="button">Grabar cierre de combustible</button>
      </div>`;
    actualizarPanel('Cierre de combustible · ' + esc(s['BOOKING'] || ''), html, function (raiz) { self._wireCierre(raiz, s, c, r.tolerancia || 1, precio); });
  },

  _wireCierre: function (raiz, s, c, tol, precio) {
    const self = this;
    const $ = id => raiz.querySelector('#' + id);
    const n = v => { const x = parseFloat(String(v === null || v === undefined ? '' : v).replace(',', '.')); return isNaN(x) ? null : x; };
    const tb = $('ccAb').querySelector('tbody');
    const glT = n($('ccEstT').value) || 0, glG = n($('ccEstG').value) || 0;
    if (c['FUENTE LECTURA']) $('ccFuente').value = c['FUENTE LECTURA'];

    const fila = function (a) {
      a = a || {};
      const tr = document.createElement('tr');
      const ini = a.tipo === 'INICIAL';
      tr.dataset.tipo = ini ? 'INICIAL' : 'RECARGA';
      tr.innerHTML =
        '<td><b style="font-size:.78rem;color:#1c3a5e">' + (ini ? 'Inicial' : 'Recarga') + '</b></td>' +
        '<td>' + (ini ? '<input class="eq" value="' + (a.equipo === 'GENERADOR' ? 'Generador' : 'Tracto') + '" data-v="' + (a.equipo || 'TRACTO') + '" disabled>'
          : '<select class="eq"><option value="TRACTO">Tracto</option><option value="GENERADOR">Generador</option></select>') + '</td>' +
        '<td><input type="date" class="fe" value="' + esc(self._iso(a.fecha) || '') + '"></td>' +
        '<td><input class="gr" value="' + esc(a.grifo || (ini ? 'PROVEEDOR' : '')) + '" style="text-transform:uppercase"' + (ini ? '' : ' placeholder="Grifo"') + '></td>' +
        '<td><input class="nv" value="' + esc(a.nv || '') + '" placeholder="N501-…" style="text-transform:uppercase"></td>' +
        '<td>' + (ini ? '<input value="Repsol" disabled>' : '<select class="pg"><option value="CONDUCTOR">Conductor</option><option value="REPSOL">Repsol</option></select>') + '</td>' +
        '<td><input class="ga" inputmode="decimal" value="' + (a.galones || '') + '"></td>' +
        '<td><input class="mo" inputmode="decimal" value="' + (a.monto || '') + '"></td>' +
        '<td><input class="gs" inputmode="decimal" value="' + (a.galSonda === null || a.galSonda === undefined ? '' : a.galSonda) + '"' + (ini && a.equipo !== 'GENERADOR' ? ' disabled title="Se calcula con las lecturas"' : '') + '></td>' +
        '<td class="df" style="font-weight:700;font-size:.76rem"></td>' +
        '<td>' + (ini ? '' : '<button type="button" class="quitar" title="Quitar">×</button>') + '</td>';
      if (!ini) {
        tr.querySelector('.eq').value = a.equipo === 'GENERADOR' ? 'GENERADOR' : 'TRACTO';
        tr.querySelector('.pg').value = a.pago === 'REPSOL' ? 'REPSOL' : 'CONDUCTOR';
        tr.querySelector('.quitar').addEventListener('click', function () { tr.remove(); calcular(); });
        tr.querySelector('.gr').addEventListener('input', function () { if (/REPSOL/i.test(this.value)) tr.querySelector('.pg').value = 'REPSOL'; });
      }
      // Monto propuesto = galones × precio de referencia (se corrige con el comprobante).
      tr.querySelector('.ga').addEventListener('change', function () { const g = n(this.value); const m = tr.querySelector('.mo'); if (g && !m.value && precio) m.value = (g * precio).toFixed(2); });
      tr.querySelectorAll('input, select').forEach(el => { el.addEventListener('input', () => calcular()); el.addEventListener('change', () => calcular()); });
      tb.appendChild(tr);
      return tr;
    };
    const guardados = Array.isArray(c.abastecimientos) ? c.abastecimientos : [];
    const iniT = guardados.filter(a => a.tipo === 'INICIAL' && a.equipo === 'TRACTO')[0];
    const iniG = guardados.filter(a => a.tipo === 'INICIAL' && a.equipo === 'GENERADOR')[0];
    fila(iniT || { tipo: 'INICIAL', equipo: 'TRACTO', galones: glT || '' });
    if (glG > 0 || iniG) fila(iniG || { tipo: 'INICIAL', equipo: 'GENERADOR', galones: glG || '' });
    guardados.filter(a => a.tipo === 'RECARGA').forEach(fila);
    $('ccMasRecarga').addEventListener('click', function () { fila({ tipo: 'RECARGA' }).querySelector('.fe').focus(); calcular(); });

    const leer = function () {
      return Array.from(tb.querySelectorAll('tr')).map(function (tr) {
        const ini = tr.dataset.tipo === 'INICIAL';
        const eq = ini ? tr.querySelector('.eq').dataset.v : tr.querySelector('.eq').value;
        return {
          tipo: tr.dataset.tipo, equipo: eq, fecha: tr.querySelector('.fe').value, grifo: tr.querySelector('.gr').value.trim().toUpperCase(),
          nv: tr.querySelector('.nv').value.trim().toUpperCase(), pago: ini ? 'REPSOL' : tr.querySelector('.pg').value,
          galones: n(tr.querySelector('.ga').value), monto: n(tr.querySelector('.mo').value), galSonda: n(tr.querySelector('.gs').value), tr: tr
        };
      });
    };
    const caja = (t, v, cls) => '<div class="' + (cls || '') + '"><span>' + t + '</span><b>' + v + '</b></div>';
    let fuera = false;
    const calcular = function () {
      const fuente = $('ccFuente').value;
      $('ccCampoDesp').style.display = fuente === 'SONDA' ? '' : 'none';
      const lA = n($('ccLAntes').value), lD = n($('ccLDesp').value), lF = n($('ccLFin').value);
      const kmI = n($('ccKmI').value), kmF = n($('ccKmF').value);
      const km = kmI !== null && kmF !== null ? kmF - kmI : null;
      $('ccKm').value = km === null ? '' : km.toLocaleString('es-PE');
      const ab = leer();
      const abT = ab.filter(a => a.equipo === 'TRACTO').reduce((x, a) => x + (a.galones || 0), 0);
      const abG = ab.filter(a => a.equipo === 'GENERADOR').reduce((x, a) => x + (a.galones || 0), 0);
      const monto = ab.reduce((x, a) => x + (a.monto || 0), 0);
      fuera = false;
      ab.forEach(function (a) {
        let gs = a.galSonda;
        if (a.tipo === 'INICIAL' && a.equipo === 'TRACTO') {
          gs = fuente === 'SONDA' && lA !== null && lD !== null ? Math.round((lD - lA) * 100) / 100 : null;
          a.tr.querySelector('.gs').value = gs === null ? '' : gs;
        }
        const td = a.tr.querySelector('.df');
        if (gs !== null && a.galones > 0) {
          const d = (a.galones - gs) / a.galones * 100;
          const mal = Math.abs(d) > tol;
          if (mal) fuera = true;
          td.textContent = d.toFixed(1) + ' %';
          td.style.color = mal ? '#b91c1c' : '#166534';
        } else td.textContent = '';
      });
      $('ccJustReq').style.display = fuera ? '' : 'none';
      const consumo = fuente !== 'SIN LECTURA' && lA !== null && lF !== null ? lA + abT - lF : null;
      const nav = n($('ccNavisat').value);
      const rend = consumo && km ? km / consumo : null;
      const exceso = consumo !== null ? Math.max(0, consumo - glT) : null;
      const difAb = abT - glT;
      const semaf = consumo === null ? '' : exceso > 0 ? 'rojo' : 'verde';
      $('ccRes').innerHTML =
        caja('Estimado tracto', glT.toFixed(2) + ' gal') +
        caja('Abastecido real tracto', abT.toFixed(2) + ' gal', Math.abs(difAb) > 0.5 ? 'ambar' : 'verde') +
        caja('Abastecido vs. estimado', (difAb >= 0 ? '+' : '') + difAb.toFixed(2) + ' gal', Math.abs(difAb) > 0.5 ? 'ambar' : '') +
        caja('Monto abastecido', 'S/ ' + monto.toFixed(2)) +
        caja('Consumo real (sonda)', consumo === null ? '—' : consumo.toFixed(2) + ' gal', consumo !== null && consumo < 0 ? 'rojo' : '') +
        caja('Rendimiento', rend ? rend.toFixed(2) + ' km/gal' : '—', rend ? (rend >= 10 ? 'verde' : rend >= 9.66 ? 'ambar' : 'rojo') : '') +
        caja('Exceso sobre lo establecido', exceso === null ? '—' : exceso.toFixed(2) + ' gal', semaf) +
        caja('Generador: abastecido / estimado', abG.toFixed(2) + ' / ' + glG.toFixed(2) + ' gal') +
        (nav !== null && consumo ? caja('Navisat vs. sonda', nav.toFixed(2) + ' gal · ' + ((nav - consumo) / consumo * 100 >= 0 ? '+' : '') + ((nav - consumo) / consumo * 100).toFixed(1) + ' %', Math.abs((nav - consumo) / consumo * 100) <= 5 ? 'verde' : Math.abs((nav - consumo) / consumo * 100) <= 10 ? 'ambar' : 'rojo') : '');
    };
    ['ccFuente', 'ccLAntes', 'ccLDesp', 'ccLFin', 'ccKmI', 'ccKmF', 'ccNavisat'].forEach(id => { $(id).addEventListener('input', calcular); $(id).addEventListener('change', calcular); });
    calcular();
    _refrescarSnapshotFormulario();

    const volver = function () { self.abrir(); };
    $('ccVolver').addEventListener('click', function () { if (confirmar('¿Volver a la lista? Lo que no hayas grabado se pierde.')) volver(); });
    $('ccCancelar').addEventListener('click', function () { if (confirmar('¿Cancelar? Lo que no hayas grabado se pierde.')) volver(); });
    protegerClic($('ccGrabar'), async function () {
      calcular();
      const ab = leer().map(a => ({ tipo: a.tipo, equipo: a.equipo, fecha: a.fecha, grifo: a.grifo, nv: a.nv, pago: a.pago, galones: a.galones, monto: a.monto, galSonda: a.galSonda }))
        .filter(a => !(a.tipo === 'INICIAL' && a.equipo === 'GENERADOR' && !a.nv && !a.galones));
      for (let i = 0; i < ab.length; i++) {
        const a = ab[i], t = (a.tipo === 'INICIAL' ? 'Inicial ' : 'Recarga ') + (a.equipo === 'GENERADOR' ? 'generador' : 'tracto');
        if (!a.fecha || !a.nv || !(a.galones > 0) || !(a.monto > 0) || (a.tipo === 'RECARGA' && !a.grifo)) {
          mostrarMensaje('Complete fecha, ' + (a.tipo === 'RECARGA' ? 'grifo, ' : '') + 'N° de nota de venta, galones y monto (' + t + ').', 'error'); return;
        }
      }
      if (fuera && !$('ccJust').value.trim()) { mostrarMensaje('La diferencia entre comprobante y sonda pasa de ±' + tol + ' %. Escriba la justificación.', 'error'); $('ccJust').focus(); return; }
      const r = await llamarBackend('cierreGrabar', {
        fila: s._fila, booking: s['BOOKING'], contenedor: s['N° CONTENEDOR'], fechaServicio: formatoFecha(s['FECHA DE PROGRAMACION'], ''),
        cliente: s['CLIENTE PARA FACTURACIÓN'], placa: s['PLACA TRACTO'], conductor: s['CONDUCTOR'], destino: s['DESTINO 1'], estadoServicio: s['ESTADO'],
        glEstTracto: glT, glEstGenerador: glG, fuente: $('ccFuente').value,
        lecturaAntes: $('ccLAntes').value, fechaLecturaAntes: $('ccFAntes').value, lecturaDespues: $('ccFuente').value === 'SONDA' ? $('ccLDesp').value : '',
        lecturaFinal: $('ccLFin').value, fechaLecturaFinal: $('ccFFin').value, tanqueLleno: $('ccLleno').checked,
        kmInicial: $('ccKmI').value, kmFinal: $('ccKmF').value, justificacion: $('ccJust').value, consumoNavisat: $('ccNavisat').value, abastecimientos: ab
      });
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo grabar el cierre.', 'error'); return; }
      mostrarMensaje(r.mensaje, 'exito');
      volver();
    });
  }
};
