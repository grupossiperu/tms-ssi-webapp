/**
 * forms/liquidacionConductores.js  (v84)
 * -------------------------------------------------------------------------
 * Finanzas > "Liquidación de conductores". Sale del CONSOLIDADO.
 * Por viaje: peajes (peaje + S.D.C.F. + adicional), viático, llanta, cochera,
 * lavado, otros (con motivo), feriado y dominical = COSTO DEL VIAJE (sin bono);
 * depositado + depósitos adicionales = TOTAL DEPÓSITO; TOTAL BONO = costo + bono − depósito.
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
        .lq-wrap { max-height:calc(74vh - 250px); min-height:160px; overflow-y:auto; overflow-x:hidden; border:1px solid #e1e6ec; border-radius:10px; }
        .lq-t th.gl { background:#dbeafe; border-color:#a5c4ea; } .lq-t td.gl { background:#f5f9ff; color:#1e3a8a; }
        .lq-t { width:100%; table-layout:fixed; border-collapse:collapse; font-size:.62rem; }
        .lq-t th { background:#bcd3ee; color:#1c3a5e; font-size:.56rem; padding:4px 2px; position:sticky; top:0; z-index:1; text-align:center; border:1px solid #9fb9d9; }
        .lq-t th.dep { background:#d7e8c9; border-color:#b6cfa1; } .lq-t th.res { background:#ffd8a8; border-color:#f5b76b; }
        .lq-t td { padding:3px 2px; border-bottom:1px solid #eef2f7; text-align:right; overflow-wrap:anywhere; }
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
        .lq-pto { color:#d97706; font-size:.7rem; margin-left:2px; cursor:help; }
        .lq-ncorr { display:inline-block; margin-top:2px; background:#fef3c7; color:#92400e; border-radius:6px; padding:0 6px; font-size:.62rem; font-weight:700; text-decoration:none; white-space:nowrap; }
        .lq-corrbox { margin:10px 0; border:1px solid #fcd34d; border-radius:10px; background:#fffdf5; padding:6px 10px; }
        .lq-corrbox summary { cursor:pointer; font-weight:700; color:#92400e; font-size:.8rem; }
        .lq-corrbox table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:.72rem; margin-top:6px; }
        .lq-corrbox th { text-align:left; color:#64748b; font-size:.66rem; padding:3px 4px; border-bottom:1px solid #fde68a; }
        .lq-corrbox td { padding:4px; border-bottom:1px solid #fef3c7; vertical-align:top; overflow-wrap:anywhere; }
        .lq-corrbox td .s { color:#94a3b8; }
        .lq-corrbox tr.resalta td { background:#fde68a; }
        .lq-est { display:inline-block; padding:2px 7px; border-radius:10px; font-size:.6rem; font-weight:800; }
        .lq-est.PENDIENTE { background:#fef3c7; color:#92400e; } .lq-est.LIQUIDADO { background:#dbeafe; color:#1e40af; } .lq-est.DEPOSITADO { background:#dcfce7; color:#166534; }
        .lq-est.REABIERTO { background:#f1f5f9; color:#64748b; }
        .lq-btn { border:1px solid #cbd5e1; background:#fff; border-radius:6px; padding:2px 6px; font-size:.62rem; cursor:pointer; margin:1px; }
        .lq-btn:hover { background:#eef4fb; } .lq-btn.pri { background:#1c3a5e; color:#fff; border-color:#1c3a5e; }
        .lq-acc { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:10px; }
        .lq-liqs { margin-top:10px; font-size:.72rem; }
        .lq-liqs table { width:100%; border-collapse:collapse; } .lq-liqs td, .lq-liqs th { border-bottom:1px solid #eef2f7; padding:4px; text-align:left; }
        .lq-liqs th { background:#f1f5f9; font-size:.64rem; }
        .lq-t tr.lq-arr-h td { background:#ffedd5; color:#9a3412; font-weight:800; text-align:left; font-size:.62rem; padding:5px 6px; }
        .lq-t tr.lq-arr td { background:#fff7ed; }
        .lq-tag { display:inline-block; margin-left:4px; padding:1px 5px; border-radius:8px; background:#fdba74; color:#7c2d12; font-size:.55rem; font-weight:800; }
        .lq-t tfoot tr.sub td { background:#f8fafc; font-weight:700; }
        .lq-arrbox { margin-top:10px; border:1px solid #fdba74; background:#fff7ed; border-radius:10px; padding:8px 10px; font-size:.72rem; }
        .lq-arrbox b.t { color:#9a3412; } .lq-arrbox table { width:100%; border-collapse:collapse; margin-top:4px; }
        .lq-arrbox td, .lq-arrbox th { border-bottom:1px solid #fed7aa; padding:3px 4px; text-align:left; } .lq-arrbox th { font-size:.64rem; color:#9a3412; }
        .lq-ov { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:10050; display:flex; align-items:center; justify-content:center; }
        .lq-dlg { background:#fff; border-radius:12px; padding:16px 18px; width:min(620px,94vw); max-height:88vh; overflow:auto; box-shadow:0 10px 40px rgba(0,0,0,.25); }
        .lq-dsc { margin:10px 0; padding:8px 10px; border:1px solid #fecaca; background:#fff7f7; border-radius:10px; }
        .lq-dsc .t { display:block; font-size:.78rem; color:#991b1b; margin-bottom:6px; }
        .lq-dsc table { width:100%; border-collapse:collapse; font-size:.74rem; }
        .lq-dsc th { text-align:left; font-size:.66rem; color:#64748b; padding:3px 4px; border-bottom:1px solid #fecaca; }
        .lq-dsc td { padding:4px; border-bottom:1px solid #fde2e2; vertical-align:top; }
        .lq-dsc input { width:100%; padding:4px 6px; font-weight:700; text-align:right; }
        .lq-dsc .s { font-size:.64rem; color:#64748b; margin-top:2px; }
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
        <div class="campo" title="Las liquidaciones sin depositar y los viajes sin liquidar de quincenas anteriores (desde esta) se arrastran a la quincena que estés viendo"><label>Arrastrar pendientes desde</label><select id="lqDesde"></select></div>
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
      $('lqDesde').addEventListener('change', function () { self._desdeQ = this.value; try { localStorage.setItem('tms_lq_desde', this.value); } catch (e) { /* sin almacenamiento */ } self._pintar(); });
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
    const resp = await Promise.all([llamarBackend('liqDatos', {}), llamarBackend('descuentosListar', {}).catch(() => null), llamarBackend('liqHistorial', {}).catch(() => null)]);
    const r = resp[0];
    if (!respuestaValida(r)) { $('lqCuerpo').textContent = (r && r.mensaje) || 'No se pudo cargar.'; return; }
    // v120: descuentos al conductor por quincena (conductor|quincena → cuotas)
    self._desc = (resp[1] && resp[1].ok && typeof FormDescuentos !== 'undefined') ? FormDescuentos.porQuincena(resp[1].items) : {};
    // 16/11: descuentos completos (saldo por descuento) y correcciones por viaje (antes → después)
    self._descItems = (resp[1] && resp[1].ok) ? resp[1].items || [] : [];
    self._tcHoy = (resp[1] && resp[1].ok) ? resp[1].tcHoy || null : null;
    self._corr = self._armarCorr(resp[2] && resp[2].ok ? resp[2].filas || [] : []);
    self._puede = !!r.puedeEditar;
    self._liqs = r.liquidaciones || [];
    self._filas = (r.filas || []).map(function (f) {
      f.costo = f.peajes + f.viatico + f.llanta + f.cochera + f.lavado + f.otros + f.feriado + f.dominical;
      f.gastos = f.costo + f.bono;
      f.totalDep = f.depositado + f.extras;
      f.totalBono = Math.round((f.gastos - f.totalDep) * 100) / 100;
      return f;
    });
    const selC = $('lqCond').value, selQ = $('lqQuin').value;
    const conds = Array.from(new Set(self._filas.map(f => f.conductor))).sort();
    $('lqCond').innerHTML = '<option value="">Todos (resumen)</option>' + conds.map(c => '<option>' + esc(c) + '</option>').join('');
    if (selC && conds.indexOf(selC) >= 0) $('lqCond').value = selC;
    const quins = Array.from(new Set(self._filas.map(f => f.quincena).filter(Boolean).concat([self._qActual()]))).sort().reverse();
    $('lqQuin').innerHTML = '<option value="">Todas</option>' + quins.map(q => '<option value="' + q + '">' + self._qTxt(q) + (q === self._qActual() ? ' (actual)' : '') + '</option>').join('');
    // Arrastre: desde qué quincena se revisan pendientes anteriores (por defecto 1ra de octubre 2026; se recuerda)
    if (!self._desdeQ) { let d = ''; try { d = localStorage.getItem('tms_lq_desde') || ''; } catch (e) { d = ''; } self._desdeQ = d || self.DESDE_DEFECTO; }
    $('lqDesde').innerHTML = quins.slice().reverse().map(q => '<option value="' + q + '">' + self._qTxt(q) + '</option>').join('');
    if (quins.indexOf(self._desdeQ) < 0) $('lqDesde').insertAdjacentHTML('afterbegin', '<option value="' + self._desdeQ + '">' + self._qTxt(self._desdeQ) + '</option>');
    $('lqDesde').value = self._desdeQ;
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

  DESDE_DEFECTO: '2026-10-Q1',
  _qActual: function () { const h = new Date(); return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + (h.getDate() <= 15 ? 'Q1' : 'Q2'); },
  /**
   * Pendientes de quincenas ANTERIORES a qSel (desde _desdeQ): viajes sin liquidar y liquidaciones por depositar.
   * Respeta los filtros de conductor y placa. Una fila por conductor + quincena + liquidación.
   */
  _arrastre: function (qSel) {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    if (!qSel || $('lqEst').value === 'DEPOSITADO') return [];
    const desde = self._desdeQ || self.DESDE_DEFECTO;
    return self._porPagar(q => q >= desde && q < qSel, true);
  },
  /** Grupos sin depositar (sin liquidar o por depositar) cuyas quincenas cumplen enQ. Respeta conductor y placa. */
  _porPagar: function (enQ, arrastre) {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const c = $('lqCond').value, g = {};
    self._filas.filter(f => f.quincena && enQ(f.quincena) && (f.liqEstado === 'PENDIENTE' || f.liqEstado === 'LIQUIDADO') &&
      (!c || f.conductor === c) && self._msPlaca.cumple(f.placa))
      .forEach(f => { const k = f.conductor + '|' + f.quincena + '|' + (f.liqId || 'P'); (g[k] = g[k] || []).push(f); });
    const visto = {};
    return Object.keys(g).map(k => {
      const l = g[k], s = self._suma(l), f0 = l[0], liq = f0.liqId ? self._liq(f0.liqId) : null;
      const r = { conductor: f0.conductor, quincena: f0.quincena, estado: f0.liqEstado, liq: liq, n: s.n, arrastre: !!arrastre,
        costo: liq ? (liq.gastos || 0) - (s.bono || 0) : s.costo, totalDep: liq ? liq.totalDep : s.totalDep, totalBono: liq ? liq.totalBono : s.totalBono };
      const kd = r.conductor + '|' + r.quincena; r.desc = visto[kd] ? 0 : self._descDe(r.conductor, r.quincena).total; visto[kd] = 1;
      r.aPagar = Math.round((r.totalBono - r.desc) * 100) / 100;
      return r;
    }).sort((a, b) => a.conductor.localeCompare(b.conductor) || String(a.quincena).localeCompare(String(b.quincena)));
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
      ['peajes', 'viatico', 'llanta', 'cochera', 'lavado', 'otros', 'bono', 'feriado', 'dominical', 'costo', 'gastos', 'depositado', 'extras', 'totalDep', 'totalBono', 'km', 'glTracto', 'glGenset'].forEach(k => { a[k] = (a[k] || 0) + (f[k] || 0); });
      a.n = (a.n || 0) + 1; return a;
    }, {});
  },
  _liq: function (id) { return this._liqs.filter(l => l.id === id)[0]; },
  /** v120: total de descuentos del conductor en la quincena (y el detalle). */
  /* ---------- 16/11: correcciones visibles (de LIQ_AUDITORIA, acción CORREGIR) ---------- */
  _CORR_NOMBRE: { peajes: 'Peajes', viatico: 'Viático', llanta: 'Llanta', cochera: 'Cochera', lavado: 'Lavado', otros: 'Otros', feriado: 'Feriado', dominical: 'Dominical', bono: 'Bono', depositado: 'Monto depositado', nroViatico: 'N° de viático', motivoOtros: 'Motivo de otros' },
  /** Campo de la auditoría → columna de la tabla. */
  _corrKey: function (campo) {
    const c = String(campo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, '').trim();
    if (/MOTIVO/.test(c)) return 'motivoOtros';
    if (/^N ?VIATICO|NRO|NUMERO/.test(c)) return 'nroViatico';
    if (/PEAJE|SDCF|ADICIONAL/.test(c)) return 'peajes';
    if (/DEPOSIT/.test(c)) return 'depositado';
    const k = { VIATICO: 'viatico', LLANTA: 'llanta', COCHERA: 'cochera', LAVADO: 'lavado', OTROS: 'otros', FERIADO: 'feriado', DOMINICAL: 'dominical', BONO: 'bono' }[c];
    return k || '';
  },
  /** clave del viaje → { lista:[{key, campo, antes, despues, motivo, usuario, fecha}], porKey:{key:{delta, antes, despues}} } */
  _armarCorr: function (filas) {
    const self = this, out = {};
    // El historial llega del más nuevo al más antiguo: se recorre al revés para quedarse con el primer "antes" y el último "después".
    filas.filter(h => String(h['ACCION']).toUpperCase() === 'CORREGIR').slice().reverse().forEach(function (h) {
      const clave = String(h['CLAVE'] || ''); if (!clave) return;
      const o = out[clave] = out[clave] || { lista: [], porCampo: {} };
      const campo = String(h['CAMPO'] || ''), key = self._corrKey(campo);
      let c = o.porCampo[campo];
      if (!c) { c = o.porCampo[campo] = { key: key, campo: campo, antes: h['ANTES'], despues: h['DESPUES'], motivo: '', usuario: '', fecha: '' }; o.lista.push(c); }
      c.despues = h['DESPUES']; c.motivo = String(h['MOTIVO'] || ''); c.usuario = String(h['USUARIO'] || ''); c.fecha = String(h['FECHA'] || '');
    });
    Object.keys(out).forEach(function (k) {
      const o = out[k]; o.porKey = {};
      o.lista = o.lista.filter(c => String(c.antes) !== String(c.despues));
      o.lista.forEach(function (c) {
        if (!c.key) return;
        const p = o.porKey[c.key] = o.porKey[c.key] || { delta: 0, texto: false };
        const a = Number(c.antes), d = Number(c.despues);
        if (c.key === 'nroViatico' || c.key === 'motivoOtros' || isNaN(a) || isNaN(d)) { p.texto = true; p.antesTxt = c.antes; } else p.delta += d - (a || 0);
      });
    });
    return out;
  },
  _corrDe: function (clave) { return (this._corr || {})[clave] || null; },
  /** Valor anterior de una columna numérica del viaje (null si no se corrigió). */
  _antesDe: function (f, key) {
    const c = this._corrDe(f.clave); if (!c) return null;
    const G = ['peajes', 'viatico', 'llanta', 'cochera', 'lavado', 'otros', 'feriado', 'dominical'];
    const d = k => (c.porKey[k] && !c.porKey[k].texto) ? c.porKey[k].delta : 0;
    let delta;
    if (key === 'costo') delta = G.reduce((a, k) => a + d(k), 0);
    else if (key === 'totalDep') delta = d('depositado');
    else if (key === 'totalBono') delta = G.reduce((a, k) => a + d(k), 0) + d('bono') - d('depositado');
    else { if (!c.porKey[key]) return null; if (c.porKey[key].texto) return c.porKey[key].antesTxt; delta = c.porKey[key].delta; }
    if (Math.abs(delta) < 0.005) return null;
    return Math.round(((Number(f[key]) || 0) - delta) * 100) / 100;
  },
  _fmtCorr: function (v) { const n = Number(v); return v === '' || v === null || v === undefined ? '(vacío)' : isNaN(n) ? String(v) : this._m(n); },
  /** Cuadro "Correcciones" para copiar/imprimir (lo que el conductor necesita para que le cuadre). */
  _tablaCorr: function (vis, paraCorreo) {
    const self = this, filas = [];
    vis.forEach(f => { const c = self._corrDe(f.clave); if (c) c.lista.forEach(x => filas.push({ f: f, c: x })); });
    if (!filas.length) return '';
    const th = 'style="background:#fde68a;border:1px solid #c9a227;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:left"';
    const td = 'style="border:1px solid #e5d48a;padding:3px 6px;font-family:Calibri,Arial;font-size:10pt;vertical-align:top"';
    return '<p style="font-family:Calibri,Arial;font-size:11pt;margin:12px 0 4px"><b>CORRECCIONES REALIZADAS (' + filas.length + ')</b></p><table style="border-collapse:collapse">' +
      '<tr><th ' + th + '>Fecha del servicio</th><th ' + th + '>Código</th><th ' + th + '>Destino</th><th ' + th + '>Concepto</th><th ' + th + '>Antes</th><th ' + th + '>Después</th><th ' + th + '>Motivo</th><th ' + th + '>Corregido por</th></tr>' +
      filas.map(x => '<tr><td ' + td + '>' + self._f(x.f.fecha) + '</td><td ' + td + '>' + esc(x.f.clave) + '</td><td ' + td + '>' + esc(x.f.destino) + '</td><td ' + td + '><b>' + esc(self._CORR_NOMBRE[x.c.key] || x.c.campo) + (x.c.key === 'peajes' ? ' (' + esc(x.c.campo) + ')' : '') + '</b></td>' +
        '<td ' + td + '>' + esc(self._fmtCorr(x.c.antes)) + '</td><td ' + td + '><b>' + esc(self._fmtCorr(x.c.despues)) + '</b></td><td ' + td + '>' + esc(x.c.motivo) + '</td><td ' + td + '>' + esc(x.c.usuario) + ' · ' + esc(x.c.fecha) + '</td></tr>').join('') + '</table>';
  },

  /** Cuadro plegable "Correcciones de esta quincena" (pantalla). */
  _cajaCorr: function (vis) {
    const self = this, filas = [];
    vis.forEach(f => { const c = self._corrDe(f.clave); if (c) c.lista.forEach(x => filas.push({ f: f, c: x })); });
    if (!filas.length) return '';
    let abierto = true; try { abierto = localStorage.getItem('tms_lq_corr_oculto') !== '1'; } catch (e) { }
    return '<details class="lq-corrbox" id="lqCorrBox"' + (abierto ? ' open' : '') + '><summary>Correcciones de esta selección (' + filas.length + ')</summary>' +
      '<table><colgroup><col style="width:13%"><col style="width:13%"><col style="width:11%"><col style="width:13%"><col><col style="width:16%"></colgroup>' +
      '<thead><tr><th>Servicio</th><th>Código</th><th>Concepto</th><th>Antes → después</th><th>Motivo</th><th>Corregido por</th></tr></thead><tbody>' +
      filas.map(x => '<tr data-corrde="' + esc(x.f.clave) + '"><td>' + self._f(x.f.fecha) + ' · ' + esc(x.f.destino) + '</td><td>' + esc(x.f.clave) + '</td><td><b>' + esc(self._CORR_NOMBRE[x.c.key] || x.c.campo) + '</b>' + (x.c.key === 'peajes' ? ' <span class="s">(' + esc(x.c.campo) + ')</span>' : '') + '</td>' +
        '<td>' + esc(self._fmtCorr(x.c.antes)) + ' → <b>' + esc(self._fmtCorr(x.c.despues)) + '</b></td><td>' + esc(x.c.motivo) + '</td><td>' + esc(x.c.usuario) + '<span class="s"> · ' + esc(x.c.fecha) + '</span></td></tr>').join('') +
      '</tbody></table></details>';
  },

  _descDe: function (cond, q) { const l = (this._desc || {})[cond + '|' + q] || []; return { total: Math.round(l.reduce((a, x) => a + x.monto, 0) * 100) / 100, lista: l }; },
  _bonoTd: function (v) { return Math.abs(v) < 0.005 ? '<td class="c">—</td>' : '<td class="' + (v > 0 ? 'bono' : 'neg') + '">S/ ' + this._m(v) + '</td>'; },

  _pintar: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const vis = self._vis(), cond = $('lqCond').value;
    if (!cond) { self._pintarResumen(vis); _refrescarSnapshotFormulario(); return; }
    const t = self._suma(vis);
    let h = '<div class="lq-wrap">' + self._tablaHtml(vis, false) + '</div>' + self._cajaCorr(vis) +
      '<div class="lq-res"><div><span>Costo de los viajes</span><b>S/ ' + self._m(t.costo) + '</b></div><div><span>Total depósito (depositado + depósitos adicionales)</span><b>S/ ' + self._m(t.totalDep) + '</b></div>' +
      '<div><span>Viajes</span><b>' + (t.n || 0) + '</b></div><div class="bono"><span>Total bono</span><b>S/ ' + self._m(t.totalBono) + '</b></div></div>';
    // v120: descuentos del conductor en las quincenas visibles
    const qsVis = $('lqQuin').value ? [$('lqQuin').value] : Array.from(new Set(vis.map(f => f.quincena)));
    const dsc = qsVis.map(q => ({ q: q, d: self._descDe(cond, q) })).filter(x => x.d.total);
    if (dsc.length) {
      const totD = dsc.reduce((a, x) => a + x.d.total, 0);
      h += '<div class="lq-res" style="grid-template-columns:2fr 1fr 1fr"><div style="border-left-color:#dc2626;background:#fef2f2"><span>Descuentos al conductor</span>' +
        dsc.map(x => x.d.lista.map(c => '<div style="font-size:.72rem">' + self._qTxt(x.q) + ' · ' + esc(c.motivo) + ' · ' + esc(c.detalle || '') + ' · <b>S/ ' + self._m(c.monto) + '</b>' + (c.moneda === 'USD' ? ' (US$ ' + self._m(c.montoOrig) + ' × TC ' + c.tc + ')' : '') + '</div>').join('')).join('') + '</div>' +
        '<div style="border-left-color:#dc2626"><span>Total descuentos</span><b>S/ ' + self._m(totD) + '</b></div>' +
        '<div class="bono"><span>' + (t.totalBono - totD >= 0 ? 'A pagar (bono − descuentos)' : 'El conductor debe') + '</span><b>S/ ' + self._m(Math.abs(t.totalBono - totD)) + '</b></div></div>';
    }
    // 16/11: descuentos con saldo pendiente (se descuentan al liquidar, en partes o de una vez)
    const conSaldo = (self._descItems || []).filter(x => x.conductor === cond && x.estado !== 'ANULADO' && (x.saldo || 0) > 0.005);
    if (conSaldo.length || self._puede) {
      const sm = x => x.moneda === 'USD' ? 'US$ ' : 'S/ ';
      h += '<div class="lq-dsc"><b class="t">Descuentos con saldo pendiente' + (conSaldo.length ? '' : ': ninguno') + '</b>' +
        (conSaldo.length ? '<table><thead><tr><th>Incidente</th><th>Descuento</th><th>Total</th><th>Ya descontado</th><th>Saldo</th></tr></thead><tbody>' +
          conSaldo.map(x => '<tr><td>' + esc(x.fechaIncidente || String(x.fecha).split(' ')[0]) + '</td><td><b>' + esc(x.motivo) + '</b> · ' + esc(x.detalle || '') +
            (typeof FormDescuentos !== 'undefined' && FormDescuentos.planTxt(x) ? '<div class="s">' + esc(FormDescuentos.planTxt(x)) + '</div>' : '') +
            (x.cuotas && x.cuotas.length ? '<div class="s">' + x.cuotas.map(c => self._qTxt(c.quincena) + ': ' + sm(x) + self._m(c.monto) + (c.tc ? ' (S/ ' + self._m(c.soles) + ')' : '')).join(' · ') + '</div>' : '') + '</td>' +
            '<td>' + sm(x) + self._m(x.monto) + '</td><td>' + sm(x) + self._m(x.aplicado || 0) + '</td><td><b>' + sm(x) + self._m(x.saldo) + '</b></td></tr>').join('') + '</tbody></table>' : '') +
        '<div class="s">Se aplican <b>después de liquidar</b> la quincena, con el botón <b>Aplicar descuento</b> (trae la cuota pendiente; puedes cambiarla, poner todo o nada).' + (self._puede ? ' <a href="#" data-nuevodesc>+ Registrar un descuento a este conductor</a>' : '') + '</div></div>';
    }
    // Arrastre: pendientes de quincenas anteriores de este conductor
    const arr = self._arrastre($('lqQuin').value);
    if (arr.length) {
      const qa = $('lqQuin').value;
      const estaQ = Math.round(self._porPagar(x => x === qa, false).reduce((a, r) => a + r.aPagar, 0) * 100) / 100;
      const totA = Math.round(arr.reduce((a, r) => a + r.aPagar, 0) * 100) / 100;
      h += '<div class="lq-arrbox"><b class="t">⚠ Pendientes de quincenas anteriores de ' + esc(cond) + ' (desde ' + self._qTxt(self._desdeQ) + ')</b>' +
        '<table><thead><tr><th>Quincena</th><th>Estado</th><th>Viajes</th><th>Total bono</th><th>Descuentos</th><th>A pagar</th><th></th></tr></thead><tbody>' +
        arr.map(r => '<tr><td>' + self._qTxt(r.quincena) + '</td><td><span class="lq-est ' + r.estado + '">' + (r.estado === 'LIQUIDADO' ? 'POR DEPOSITAR' : 'SIN LIQUIDAR') + '</span></td><td>' + r.n +
          '</td><td>S/ ' + self._m(r.totalBono) + '</td><td>' + (r.desc ? '− S/ ' + self._m(r.desc) : '') + '</td><td><b>S/ ' + self._m(r.aPagar) + '</b></td><td>' +
          (self._puede && r.liq && r.estado === 'LIQUIDADO' ? '<button class="lq-btn pri" data-dep="' + r.liq.id + '">Marcar depositado</button>' + self._btnDesc(r.conductor, r.quincena) : '') +
          '<button class="lq-btn" data-irq="' + r.quincena + '">Ver ›</button></td></tr>').join('') +
        '</tbody></table>' +
        '<div class="lq-res" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><span>Esta quincena (sin depositar)</span><b>S/ ' + self._m(estaQ) + '</b></div>' +
        '<div style="border-left-color:#f97316"><span>Quincenas anteriores (a pagar)</span><b>S/ ' + self._m(totA) + '</b></div>' +
        '<div class="bono"><span>Total a pagar ahora</span><b>S/ ' + self._m(estaQ + totA) + '</b></div></div></div>';
    }
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
          '<td>' + (self._puede && l.estado === 'LIQUIDADO' ? '<button class="lq-btn pri" data-dep="' + l.id + '">Marcar depositado</button>' + self._btnDesc(l.conductor, l.quincena) : '') +
          (self._puede && (l.estado === 'LIQUIDADO' || l.estado === 'DEPOSITADO') ? '<button class="lq-btn" data-reab="' + l.id + '">Reabrir</button>' : '') + '</td></tr>').join('') +
        '</tbody></table></div>';
    }
    $('lqCuerpo').innerHTML = h;
    $('lqCuerpo').querySelectorAll('[data-liq]').forEach(b => b.addEventListener('click', () => self._dlgLiquidar(cond, b.dataset.liq)));
    $('lqCuerpo').querySelectorAll('[data-vercorr]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const box = $('lqCorrBox'); if (!box) return;
      box.open = true;
      box.querySelectorAll('tr.resalta').forEach(tr => tr.classList.remove('resalta'));
      const trs = box.querySelectorAll('tr[data-corrde="' + a.dataset.vercorr + '"]');
      trs.forEach(tr => tr.classList.add('resalta'));
      (trs[0] || box).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    const cb = $('lqCorrBox');
    if (cb) cb.addEventListener('toggle', () => { try { localStorage.setItem('tms_lq_corr_oculto', cb.open ? '0' : '1'); } catch (e) { } });
    $('lqCuerpo').querySelectorAll('[data-nuevodesc]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      if (typeof FormDescuentos === 'undefined') return;
      FormDescuentos.nuevo({ conductor: cond }, () => self._cargar(false));
    }));
    $('lqCuerpo').querySelectorAll('[data-dep]').forEach(b => b.addEventListener('click', () => self._dlgDepositar(b.dataset.dep)));
    $('lqCuerpo').querySelectorAll('[data-adesc]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.adesc.split('||'); self._dlgAplicarDesc(p[0], p[1]); }));
    $('lqCuerpo').querySelectorAll('[data-reab]').forEach(b => b.addEventListener('click', () => self._dlgReabrir(b.dataset.reab)));
    $('lqCuerpo').querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => self._dlgCorregir(b.dataset.edit)));
    $('lqCuerpo').querySelectorAll('[data-irq]').forEach(b => b.addEventListener('click', () => { $('lqQuin').value = b.dataset.irq; $('lqEst').value = ''; self._pintar(); }));
    _refrescarSnapshotFormulario();
  },

  _pintarResumen: function (vis) {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    // Grupo = conductor + quincena + (liquidación o pendiente)
    const g = {};
    vis.forEach(f => { const k = f.conductor + '|' + f.quincena + '|' + (f.liqId || 'P'); (g[k] = g[k] || []).push(f); });
    const filas = Object.keys(g).map(k => {
      const l = g[k]; const s = self._suma(l); const f0 = l[0]; const liq = f0.liqId ? self._liq(f0.liqId) : null;
      return { conductor: f0.conductor, quincena: f0.quincena, estado: f0.liqEstado, liq: liq, n: s.n, costo: liq ? (liq.gastos || 0) - (s.bono || 0) : s.costo, totalDep: liq ? liq.totalDep : s.totalDep, totalBono: liq ? liq.totalBono : s.totalBono };
    }).sort((a, b) => a.conductor.localeCompare(b.conductor) || String(b.quincena).localeCompare(String(a.quincena)));
    // v120: descuentos por conductor+quincena (una sola vez por grupo conductor|quincena)
    const vistoD = {};
    filas.forEach(r => { const k = r.conductor + '|' + r.quincena; r.desc = vistoD[k] ? 0 : self._descDe(r.conductor, r.quincena).total; vistoD[k] = 1; r.aPagar = Math.round((r.totalBono - r.desc) * 100) / 100; });
    const t = filas.reduce((a, r) => { a.n += r.n; a.g += r.costo; a.d += r.totalDep; a.b += r.totalBono; a.ds += r.desc; a.p += r.aPagar; return a; }, { n: 0, g: 0, d: 0, b: 0, ds: 0, p: 0 });
    // Arrastre: pendientes de quincenas anteriores (se pagan junto con la quincena elegida)
    const arr = self._arrastre($('lqQuin').value);
    const tA = arr.reduce((a, r) => { a.n += r.n; a.p += r.aPagar; return a; }, { n: 0, p: 0 });
    const filaHtml = r => '<tr class="clic' + (r.arrastre ? ' lq-arr' : '') + '" data-c="' + esc(r.conductor) + '" data-q="' + r.quincena + '"><td class="i"><b>' + esc(r.conductor) + '</b></td><td class="c">' + self._qTxt(r.quincena) + (r.arrastre ? '<span class="lq-tag">de quincena anterior</span>' : '') + '</td><td class="c">' + r.n +
      '</td><td>S/ ' + self._m(r.costo) + '</td><td class="depT">S/ ' + self._m(r.totalDep) + '</td>' + self._bonoTd(r.totalBono) +
      '<td style="color:#b91c1c">' + (r.desc ? '− S/ ' + self._m(r.desc) : '') + '</td>' + self._bonoTd(r.aPagar) +
      '<td class="c"><span class="lq-est ' + r.estado + '">' + (r.estado === 'LIQUIDADO' ? 'POR DEPOSITAR' : r.estado) + '</span>' + (r.liq && r.estado === 'DEPOSITADO' ? '<span class="lq-mot">' + esc(r.liq.fechaDep || '') + ' · op. ' + esc(r.liq.operacion || '') + '</span>' : '') + '</td>' +
      '<td class="c">' + (self._puede && r.liq && r.estado === 'LIQUIDADO' ? '<button class="lq-btn pri" data-dep="' + r.liq.id + '">Depositar</button>' + self._btnDesc(r.conductor, r.quincena) : '') + '<button class="lq-btn">Ver ›</button></td></tr>';
    const pieArr = arr.length ? '<tr class="sub"><td class="i" colspan="2">+ Pendientes de quincenas anteriores</td><td class="c">' + tA.n + '</td><td colspan="4"></td><td>S/ ' + self._m(tA.p) + '</td><td colspan="2"></td></tr>' +
      '<tr><td class="i" colspan="2">TOTAL (QUINCENA + ANTERIORES)</td><td class="c">' + (t.n + tA.n) + '</td><td colspan="4"></td><td>S/ ' + self._m(t.p + tA.p) + '</td><td colspan="2"></td></tr>' : '';
    $('lqCuerpo').innerHTML = '<div class="lq-wrap"><table class="lq-t"><colgroup><col style="width:21%"><col style="width:11%"><col style="width:5%"><col><col><col><col><col><col style="width:10%"><col style="width:12%"></colgroup>' +
      '<thead><tr><th>Conductor</th><th>Quincena</th><th>Viajes</th><th>Costo del viaje</th><th class="dep">Total depósito</th><th class="res">Total bono</th><th>Descuentos</th><th class="res">A pagar</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (filas.length ? filas.map(filaHtml).join('') : '<tr><td colspan="10" class="c" style="color:#8b95a1;padding:14px">Sin viajes con estos filtros.</td></tr>') +
      (arr.length ? '<tr class="lq-arr-h"><td colspan="10">⚠ Pendientes de quincenas anteriores (desde ' + self._qTxt(self._desdeQ) + ') — también se pagan ahora</td></tr>' + arr.map(filaHtml).join('') : '') +
      '</tbody><tfoot>' + (arr.length ? '<tr class="sub"><td class="i" colspan="2">TOTAL DE LA QUINCENA</td>' : '<tr><td class="i" colspan="2">TOTAL</td>') + '<td class="c">' + t.n + '</td><td>S/ ' + self._m(t.g) + '</td><td>S/ ' + self._m(t.d) + '</td><td>S/ ' + self._m(t.b) + '</td><td>' + (t.ds ? '− S/ ' + self._m(t.ds) : '') + '</td><td>S/ ' + self._m(t.p) + '</td><td colspan="2"></td></tr>' + pieArr + '</tfoot></table></div>';
    $('lqCuerpo').querySelectorAll('tr[data-c]').forEach(tr => tr.addEventListener('click', function (ev) {
      const dep = ev.target.closest('[data-dep]');
      if (dep) { ev.stopPropagation(); self._dlgDepositar(dep.dataset.dep); return; }
      const ad = ev.target.closest('[data-adesc]');
      if (ad) { ev.stopPropagation(); const p = ad.dataset.adesc.split('||'); self._dlgAplicarDesc(p[0], p[1]); return; }
      $('lqCond').value = tr.dataset.c; $('lqQuin').value = tr.dataset.q; self._pintar();
    }));
  },

  /** Tabla de detalle. paraCorreo = estilos en línea (correo, impresión, Excel). */
  _tablaHtml: function (vis, paraCorreo) {
    const self = this, t = self._suma(vis);
    const conAcc = !paraCorreo;
    const cols = ['CONDUCTOR', 'PLACA', 'DESTINO', 'PRODUCTO', 'FECHA DEL SERVICIO', 'N° DE VIÁTICO', 'GL TRACTO', 'GL GENSET', 'PEAJES', 'VIÁTICO', 'LLANTA', 'COCHERA', 'LAVADO', 'OTROS', 'FERIADO', 'DOMINICAL', 'BONO', 'COSTO DEL VIAJE',
      'MONTO DEPOSITADO', 'DEPÓSITOS ADICIONALES', 'TOTAL DEPÓSITO', 'TOTAL BONO'].concat(conAcc ? ['ESTADO'] : []);
    const st = paraCorreo ? {
      th: 'style="background:#bcd3ee;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      thd: 'style="background:#d7e8c9;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      thg: 'style="background:#dbeafe;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      thr: 'style="background:#ffd8a8;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"',
      td: function (al, extra) { return 'style="border:1px solid #c9d3df;padding:3px 6px;font-family:Calibri,Arial;font-size:10pt;text-align:' + al + ';' + (extra || '') + '"'; }
    } : null;
    const th = function (c, i) { const cls = i >= 18 && i <= 20 ? 'dep' : i === 21 ? 'res' : i === 6 || i === 7 ? 'gl' : ''; return paraCorreo ? '<th ' + (cls === 'dep' ? st.thd : cls === 'res' ? st.thr : cls === 'gl' ? st.thg : st.th) + '>' + c + '</th>' : '<th class="' + cls + '">' + c + '</th>'; };
    const td = function (v, al, cls, extra) { return paraCorreo ? '<td ' + st.td(al, extra) + '>' + v + '</td>' : '<td class="' + (al === 'left' ? 'i ' : al === 'center' ? 'c ' : '') + (cls || '') + '">' + v + '</td>'; };
    const m = n => n ? self._m(n) : '';
    const g = n => n ? self._m(n) : '';
    let h = paraCorreo ? '<table style="border-collapse:collapse">' : '<table class="lq-t"><colgroup><col style="width:8.5%"><col style="width:4.5%"><col style="width:6.5%"><col style="width:5.5%"><col style="width:5%"><col style="width:4%"><col style="width:3.8%"><col style="width:3.8%"><col><col><col><col><col><col style="width:5.5%"><col><col><col><col><col><col><col><col><col style="width:6.5%"></colgroup>';
    h += '<thead><tr>' + cols.map(th).join('') + '</tr></thead><tbody>';
    // Celda corregida: solo un punto ● con el detalle al pasar el mouse (en copiar/imprimir la celda va normal; el detalle va en el cuadro de correcciones)
    const tdc = function (f, key, txt, al, cls, extra) {
      if (paraCorreo) return td(txt, al, cls, extra);
      const c = self._corrDe(f.clave);
      const lst = c ? c.lista.filter(x => x.key === key) : [];
      const a = self._antesDe(f, key);
      if (!lst.length && a === null) return td(txt, al, cls, extra);
      const tip = lst.length ? lst.map(x => (self._CORR_NOMBRE[x.key] || x.campo) + ': ' + self._fmtCorr(x.antes) + ' → ' + self._fmtCorr(x.despues) + (x.motivo ? ' · ' + x.motivo : '')).join('\n')
        : 'Antes de las correcciones: ' + self._fmtCorr(a);
      return td(txt + '<sup class="lq-pto" title="' + esc(tip) + '">●</sup>', al, cls, extra);
    };
    vis.forEach(function (f) {
      const b = f.totalBono;
      const cr = self._corrDe(f.clave);
      const nC = cr ? cr.lista.length : 0;
      const condCel = esc(f.conductor) + (!paraCorreo && nC ? ' <a href="#" class="lq-ncorr" data-vercorr="' + esc(f.clave) + '" title="Ver las correcciones de este viaje">✎ ' + nC + (nC === 1 ? ' cambio' : ' cambios') + '</a>' : '');
      h += '<tr>' + td(condCel, 'left') + td(esc(f.placa), 'center') + td(esc(f.destino), 'left') + td(esc(f.producto || ''), 'left') + td(self._f(f.fecha), 'center') + tdc(f, 'nroViatico', esc(f.nroViatico), 'center') +
        td(g(f.glTracto), 'right', 'gl') + td(g(f.glGenset), 'right', 'gl') +
        tdc(f, 'peajes', m(f.peajes), 'right') + tdc(f, 'viatico', m(f.viatico), 'right') + tdc(f, 'llanta', m(f.llanta), 'right') + tdc(f, 'cochera', m(f.cochera), 'right') + tdc(f, 'lavado', m(f.lavado), 'right') +
        tdc(f, 'otros', m(f.otros) + (f.otros && f.motivoOtros ? (paraCorreo ? '<br><span style="font-size:8pt;color:#555">' + esc(f.motivoOtros) + '</span>' : '<span class="lq-mot">' + esc(f.motivoOtros) + '</span>') : ''), 'right') +
        tdc(f, 'feriado', m(f.feriado), 'right') + tdc(f, 'dominical', m(f.dominical), 'right') + tdc(f, 'bono', m(f.bono), 'right') + tdc(f, 'costo', self._m(f.costo), 'right', 'tot', 'font-weight:bold;background:#f1f5f9') +
        tdc(f, 'depositado', m(f.depositado), 'right', 'dep') + td(m(f.extras), 'right', 'dep') + tdc(f, 'totalDep', self._m(f.totalDep), 'right', 'depT', 'font-weight:bold;background:#e6f2dc') +
        tdc(f, 'totalBono', 'S/ ' + self._m(b), 'right', b > 0 ? 'bono' : 'neg', 'color:#b45309;font-weight:bold;background:#fff3e0') +
        (conAcc ? '<td class="c"><span class="lq-est ' + f.liqEstado + '">' + (f.liqEstado === 'LIQUIDADO' ? 'POR DEPOSITAR' : f.liqEstado) + '</span>' +
          (self._puede && f.liqEstado === 'PENDIENTE' ? '<br><button class="lq-btn" data-edit="' + esc(f.clave) + '">✎ Corregir</button>' : '') + '</td>' : '') + '</tr>';
    });
    if (!vis.length) h += '<tr><td colspan="' + cols.length + '" style="text-align:center;color:#8b95a1;padding:14px">Sin viajes con estos filtros.</td></tr>';
    const tf = function (v, al) { return paraCorreo ? '<td ' + st.td(al || 'right', 'font-weight:bold;background:#e9eef5') + '>' + v + '</td>' : '<td>' + v + '</td>'; };
    h += '</tbody><tfoot><tr>' + (paraCorreo ? '<td colspan="6" ' + st.td('right', 'font-weight:bold;background:#e9eef5') + '>TOTAL (' + (t.n || 0) + ' viajes)</td>' : '<td colspan="6" class="i">TOTAL (' + (t.n || 0) + ' viajes)</td>') +
      tf(self._m(t.glTracto || 0)) + tf(self._m(t.glGenset || 0)) +
      ['peajes', 'viatico', 'llanta', 'cochera', 'lavado', 'otros', 'feriado', 'dominical', 'bono', 'costo', 'depositado', 'extras', 'totalDep'].map(k => tf(self._m(t[k]))).join('') +
      tf('S/ ' + self._m(t.totalBono)) + (conAcc ? '<td></td>' : '') + '</tr></tfoot></table>';
    if (paraCorreo) h += self._tablaCorr(vis, true);
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
    const txt = vis.map(f => [f.conductor, f.placa, f.destino, f.producto || '', self._f(f.fecha), f.nroViatico, f.glTracto || 0, f.glGenset || 0, f.peajes, f.viatico, f.llanta, f.cochera, f.lavado, f.otros, f.feriado, f.dominical, f.bono,
      f.costo.toFixed(2), f.depositado, f.extras, f.totalDep.toFixed(2), f.totalBono.toFixed(2)].join('\t')).join('\n');
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
    const enc = ['CONDUCTOR', 'PLACA', 'CLIENTE', 'DESTINO', 'PRODUCTO', 'FECHA DEL SERVICIO', 'QUINCENA', 'CÓDIGO', 'N° DE VIÁTICO', 'GL TRACTO', 'GL GENSET', 'PEAJES', 'VIÁTICO', 'LLANTA', 'COCHERA', 'LAVADO', 'OTROS', 'MOTIVO OTROS',
      'FERIADO', 'DOMINICAL', 'BONO', 'COSTO DEL VIAJE', 'MONTO DEPOSITADO', 'DEPÓSITOS ADICIONALES', 'TOTAL DEPÓSITO', 'TOTAL BONO', 'ESTADO', 'MODIFICADO POR'];
    const n = x => Math.round((Number(x) || 0) * 100) / 100;
    const filas = vis.map(f => [f.conductor, f.placa, f.cliente, f.destino, f.producto || '', self._f(f.fecha), self._qTxt(f.quincena), f.clave, f.nroViatico, n(f.glTracto), n(f.glGenset), n(f.peajes), n(f.viatico), n(f.llanta), n(f.cochera), n(f.lavado), n(f.otros), f.motivoOtros || '',
      n(f.feriado), n(f.dominical), n(f.bono), n(f.costo), n(f.depositado), n(f.extras), n(f.totalDep), n(f.totalBono), f.liqEstado === 'LIQUIDADO' ? 'POR DEPOSITAR' : f.liqEstado, f.modPor ? f.modPor + ' ' + (f.modFecha || '') : '']);
    const t = self._suma(vis);
    filas.push(['TOTAL (' + vis.length + ' viajes)', '', '', '', '', '', '', '', '', n(t.glTracto), n(t.glGenset), n(t.peajes), n(t.viatico), n(t.llanta), n(t.cochera), n(t.lavado), n(t.otros), '', n(t.feriado), n(t.dominical), n(t.bono), n(t.costo), n(t.depositado), n(t.extras), n(t.totalDep), n(t.totalBono), '', '']);
    const nombre = 'Liquidacion_' + (self._raiz.querySelector('#lqCond').value || 'conductores').replace(/\s+/g, '_') + '_' + (self._raiz.querySelector('#lqQuin').value || 'todas') + '.xlsx';
    try {
      const X = await self._cargarXlsx();
      const ws = X.utils.aoa_to_sheet([[self._titulo()], []].concat([enc], filas));
      ws['!cols'] = enc.map((c, i) => ({ wch: i === 0 ? 34 : i === 3 || i === 17 ? 24 : 12 }));
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
      '<p style="font-size:11pt;margin-top:10px"><b>Costo de los viajes:</b> S/ ' + self._m(t.costo) + ' &nbsp; · &nbsp; <b>Bono:</b> S/ ' + self._m(t.bono) + ' &nbsp; · &nbsp; <b>Total depósito:</b> S/ ' + self._m(t.totalDep) +
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

  /** 16/11: descuentos del conductor con saldo (o con monto ya puesto en la quincena q). */
  _descPend: function (cond, q) {
    return (this._descItems || []).filter(x => x.conductor === cond && x.estado !== 'ANULADO').map(function (x) {
      const enQ = (x.cuotas || []).filter(c => c.quincena === q).reduce((a, c) => a + (Number(c.monto) || 0), 0);
      const aplic = (x.cuotas || []).reduce((a, c) => a + (Number(c.monto) || 0), 0);
      return { x: x, enQ: Math.round(enQ * 100) / 100, saldoSinQ: Math.max(0, Math.round((x.monto - aplic + enQ) * 100) / 100) };
    }).filter(d => d.saldoSinQ > 0.005 || d.enQ > 0);
  },

  /** Botón "Aplicar descuento" (solo si el conductor tiene descuentos con saldo o ya aplicados en esa quincena). */
  _btnDesc: function (cond, q) {
    if (!this._puede || !this._descPend(cond, q).length) return '';
    const ya = this._descDe(cond, q).total;
    return '<button class="lq-btn" style="border-color:#dc2626;color:#b91c1c" data-adesc="' + esc(cond) + '||' + q + '">' + (ya ? '✎ Descuento (S/ ' + this._m(ya) + ')' : 'Aplicar descuento') + '</button>';
  },
  _qAnt: function (q) { const m = String(q).match(/^(\d{4})-(\d{2})-(Q[12])$/); if (!m) return q; if (m[3] === 'Q2') return m[1] + '-' + m[2] + '-Q1'; const d = new Date(Number(m[1]), Number(m[2]) - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-Q2'; },

  _dlgLiquidar: function (cond, q) {
    const self = this;
    const vs = self._filas.filter(f => f.conductor === cond && f.quincena === q && f.liqEstado === 'PENDIENTE');
    const t = self._suma(vs);
    const dp = self._descPend(cond, q);
    const bono = Math.round(t.totalBono * 100) / 100;
    self._dlg('Liquidar quincena ' + self._qTxt(q),
      '<p style="margin:0 0 8px"><b>' + esc(cond) + '</b> · ' + vs.length + ' viaje(s)</p>' +
      '<div class="lq-res" style="grid-template-columns:repeat(3,1fr)"><div><span>Costo de los viajes</span><b>S/ ' + self._m(t.costo) + '</b></div><div><span>Total depósito</span><b>S/ ' + self._m(t.totalDep) + '</b></div>' +
      '<div class="bono"><span>Total bono</span><b>S/ ' + self._m(t.totalBono) + '</b></div></div>' +
      (dp.length ? '<div class="lq-dsc"><b class="t">Este conductor tiene ' + dp.length + ' descuento(s) con saldo.</b><div class="s">Después de liquidar podrás aplicarlo con <b>Aplicar descuento</b> (se abrirá solo; si no quieres descontar en esta quincena, pulsa Cancelar).</div></div>' : '') +
      '<label style="margin-top:10px">Observación (opcional)</label><input data-obs maxlength="300">' +
      '<p class="nota">Al liquidar, estos viajes quedan revisados y pasan a "Por depositar". Ya no se pueden corregir salvo que se reabra la quincena.</p>',
      'Liquidar', async function (ov) {
        const err = await self._enviar('liqLiquidar', { conductor: cond, quincena: q, claves: vs.map(f => f.clave), totalBono: bono, observacion: ov.querySelector('[data-obs]').value }, ov);
        if (!err && dp.length) setTimeout(() => self._dlgAplicarDesc(cond, q), 50);
        return err;
      });
  },

  /** Aplicar descuentos a una quincena ya liquidada (por depositar). Trae la cuota pendiente de cada descuento. */
  _dlgAplicarDesc: async function (cond, q) {
    const self = this;
    const l = self._liqs.filter(x => x.conductor === cond && x.quincena === q && x.estado === 'LIQUIDADO')[0];
    if (!l) { mostrarMensaje('Primero liquida la quincena; el descuento se aplica después de liquidar.', 'error'); return; }
    const dp = self._descPend(cond, q);
    if (!dp.length) { mostrarMensaje('Este conductor no tiene descuentos con saldo.', 'info'); return; }
    // 17/11: descuentos "al finalizar el contrato" → se proponen completos en la quincena en que vence el contrato
    if (dp.some(d => d.x.frecuencia === 'CONTRATO') && !self._contratos) {
      try { const rc = await llamarBackend('contratosListar', {}); self._contratos = rc && rc.ok ? rc.items || [] : []; } catch (e) { self._contratos = []; }
    }
    const pal = t => String(t || '').toUpperCase().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const vencCont = function () {
      const pc = pal(cond);
      const c = (self._contratos || []).filter(x => x.estado !== 'BAJA' && x.vencimiento).filter(x => { const p = pal(x.nombre); return pc.filter(w => p.indexOf(w) >= 0).length >= Math.min(3, pc.length, p.length); })[0];
      if (!c) return null;
      const m = String(c.vencimiento).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return null;
      return { txt: c.vencimiento, q: m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + (Number(m[1]) <= 15 ? 'Q1' : 'Q2') };
    }();
    const bono = Math.round((l.totalBono || 0) * 100) / 100;
    const tc = self._tcHoy;
    const sm = x => x.moneda === 'USD' ? 'US$ ' : 'S/ ';
    const qAnt = self._qAnt(q);
    // Propuesta: lo ya puesto en esta quincena; si no, la cuota sugerida (mensual: solo si no se descontó la quincena anterior), sin pasar del saldo ni del bono
    let disp = Math.max(0, bono);
    const notas = [];
    const prop = dp.map(function (d) {
      const x = d.x, usd = x.moneda === 'USD', f = usd ? (tc ? tc.tc : 0) : 1;
      if (d.enQ > 0) { disp -= d.enQ * (f || 1); return d.enQ; }
      let v;
      if (x.frecuencia === 'CONTRATO') {
        const toca = vencCont && String(q) >= vencCont.q;
        v = toca ? d.saldoSinQ : 0;
        notas.push(x.motivo + ': al finalizar el contrato — ' + (!vencCont ? 'no se encontró la fecha de fin de contrato en el maestro Contratos (propuesto 0).' : toca ? 'el contrato vence el ' + vencCont.txt + ': se propone todo el saldo.' : 'el contrato vence el ' + vencCont.txt + ' (propuesto 0 hasta esa quincena).'));
      } else {
        const mensualToca = !(x.frecuencia === 'MES' && (x.cuotas || []).some(c => c.quincena === qAnt && Number(c.monto) > 0));
        v = mensualToca ? Math.min(x.cuotaSugerida > 0 ? x.cuotaSugerida : d.saldoSinQ, d.saldoSinQ) : 0;
        if (!mensualToca) notas.push(x.motivo + ': cuota mensual, ya se descontó en ' + self._qTxt(qAnt) + ' (propuesto 0).');
      }
      if (f > 0 && v * f > disp) { v = Math.floor(disp / f * 100) / 100; }
      v = Math.max(0, Math.round(v * 100) / 100); disp -= v * (f || 1);
      return v;
    });
    const hayUsd = dp.some(d => d.x.moneda === 'USD');
    const ov = self._dlg('Aplicar descuento · ' + self._qTxt(q),
      '<p style="margin:0 0 8px"><b>' + esc(cond) + '</b> · liquidación por depositar · Total bono <b>S/ ' + self._m(bono) + '</b></p>' +
      '<div class="lq-dsc"><table><thead><tr><th>Descuento</th><th>Total</th><th>Saldo</th><th style="width:140px">Descontar ahora</th></tr></thead><tbody>' +
      dp.map((d, i) => '<tr><td><b>' + esc(d.x.motivo) + '</b> · ' + esc(d.x.detalle || '') + '<div class="s">' + esc(d.x.fechaIncidente ? 'Incidente ' + d.x.fechaIncidente + ' · ' : '') + esc(typeof FormDescuentos !== 'undefined' ? FormDescuentos.planTxt(d.x) : '') + '</div></td>' +
        '<td>' + sm(d.x) + self._m(d.x.monto) + '</td><td>' + sm(d.x) + self._m(d.saldoSinQ) + '</td>' +
        '<td><div style="display:flex;align-items:center;gap:4px"><span style="font-size:.72rem">' + sm(d.x).trim() + '</span><input data-dsc="' + i + '" inputmode="decimal" value="' + (prop[i] ? prop[i].toFixed(2) : '0') + '"></div>' +
        (d.x.moneda === 'USD' ? '<div class="s" data-eq="' + i + '"></div>' : '') +
        '<div class="s"><a href="#" data-todo="' + i + '">todo</a> · <a href="#" data-nada="' + i + '">nada</a></div></td></tr>').join('') +
      '</tbody></table>' + (notas.length ? '<div class="s" style="color:#92400e">' + notas.map(esc).join('<br>') + '</div>' : '') +
      (hayUsd ? '<div class="s">' + (tc ? 'Dólares a soles con TC <b>' + tc.tc.toFixed(3) + '</b> del ' + esc(tc.fecha) + (tc.esHoy ? ' (hoy)' : ' — <b style="color:#b91c1c">no hay TC de hoy, se usa el último registrado</b>') : '<b style="color:#b91c1c">No hay tipo de cambio registrado: regístralo antes de aplicar descuentos en dólares.</b>') + '</div>' : '') +
      '<div class="s">Lo que no se descuente ahora sigue como saldo para las próximas quincenas.</div></div>' +
      '<div class="lq-res" style="grid-template-columns:repeat(3,1fr)"><div class="bono"><span>Total bono</span><b>S/ ' + self._m(bono) + '</b></div><div style="border-left-color:#dc2626;background:#fef2f2"><span>Descuentos</span><b data-tdesc></b></div>' +
      '<div class="bono"><span data-tpag-t>A pagar</span><b data-tpag></b></div></div>',
      'Aplicar descuento', async function (ov) {
        const montos = dp.map((d, i) => Math.round((parseFloat(String(ov.querySelector('[data-dsc="' + i + '"]').value).replace(',', '.')) || 0) * 100) / 100);
        for (let i = 0; i < dp.length; i++) {
          if (montos[i] < 0) return 'El descuento no puede ser negativo.';
          if (montos[i] > dp[i].saldoSinQ + 0.005) return 'El descuento "' + dp[i].x.motivo + '" tiene saldo ' + sm(dp[i].x) + self._m(dp[i].saldoSinQ) + '.';
          if (montos[i] > 0 && dp[i].x.moneda === 'USD' && !tc) return 'No hay tipo de cambio registrado para el descuento en dólares.';
        }
        const cambia = dp.map((d, i) => ({ id: d.x.id, monto: montos[i] })).filter((it, i) => Math.abs(it.monto - dp[i].enQ) > 0.005);
        if (!cambia.length) return 'No cambiaste ningún monto.';
        return self._enviar('descuentosAplicar', { conductor: cond, quincena: q, items: cambia }, ov);
      });
    const calc = function () {
      let tot = 0;
      dp.forEach((d, i) => {
        const v = parseFloat(String(ov.querySelector('[data-dsc="' + i + '"]').value).replace(',', '.')) || 0;
        if (d.x.moneda === 'USD') {
          const soles = tc ? v * tc.tc : 0; tot += soles;
          const eq = ov.querySelector('[data-eq="' + i + '"]'); if (eq) eq.textContent = v ? '= S/ ' + self._m(soles) : '';
        } else tot += v;
      });
      const pag = Math.round((bono - tot) * 100) / 100;
      ov.querySelector('[data-tdesc]').textContent = '− S/ ' + self._m(tot);
      ov.querySelector('[data-tpag-t]').textContent = pag >= 0 ? 'A pagar (bono − descuentos)' : 'El conductor debe';
      ov.querySelector('[data-tpag]').textContent = 'S/ ' + self._m(Math.abs(pag));
    };
    ov.querySelectorAll('[data-dsc]').forEach(inp => inp.addEventListener('input', calc));
    ov.querySelectorAll('[data-todo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const i = +a.dataset.todo; ov.querySelector('[data-dsc="' + i + '"]').value = dp[i].saldoSinQ.toFixed(2); calc(); }));
    ov.querySelectorAll('[data-nada]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); ov.querySelector('[data-dsc="' + a.dataset.nada + '"]').value = '0'; calc(); }));
    calc();
  },

  _dlgDepositar: function (id) {
    const self = this, l = self._liq(id); if (!l) return;
    const hoy = new Date(); const iso = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    self._dlg('Marcar depositado',
      '<p style="margin:0 0 8px"><b>' + esc(l.conductor) + '</b> · ' + self._qTxt(l.quincena) + ' · Total bono <b>S/ ' + self._m(l.totalBono) + '</b>' +
        (self._descDe(l.conductor, l.quincena).total ? ' − descuentos S/ ' + self._m(self._descDe(l.conductor, l.quincena).total) + ' = <b style="color:#166534">A pagar S/ ' + self._m(l.totalBono - self._descDe(l.conductor, l.quincena).total) + '</b>' : '') + '</p>' +
        (!self._descDe(l.conductor, l.quincena).total && self._descPend(l.conductor, l.quincena).length ? '<p class="nota" style="color:#b91c1c">Este conductor tiene descuentos con saldo y no se aplicó ninguno en esta quincena. Si corresponde, cancela y usa <b>Aplicar descuento</b> antes de depositar.</p>' : '') +
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
      '<label style="margin-top:8px;font-weight:400;display:flex;gap:6px;align-items:center"><input type="checkbox" data-arr checked style="width:auto"> Incluir pendientes de quincenas anteriores (sin depositar, desde ' + self._qTxt(self._desdeQ || self.DESDE_DEFECTO) + '), con descuentos y A pagar</label>' +
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
      ov.querySelector('[data-prev]').textContent = s.vis.length + ' viaje(s)' + (s.nArr ? ' (incluye ' + s.nArr + ' de quincenas anteriores)' : '') + ' · ' + s.conds.length + ' conductor(es) · Total bono S/ ' + self._m(t.totalBono || 0) + (s.desc ? ' · Descuentos S/ ' + self._m(s.desc) + ' · A pagar S/ ' + self._m((t.totalBono || 0) - s.desc) : ''); };
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
    const self = this;
    let vis = this._filas.filter(f => f.quincena >= qd && f.quincena <= qh && (!est || f.liqEstado === est) && marc[f.conductor]);
    // 17/11: pendientes de quincenas anteriores (sin liquidar o por depositar) desde "Arrastrar pendientes desde"
    const conArr = ov.querySelector('[data-arr]') ? ov.querySelector('[data-arr]').checked : false;
    const desde = self._desdeQ || self.DESDE_DEFECTO;
    const arr = conArr && est !== 'DEPOSITADO' ? this._filas.filter(f => f.quincena >= desde && f.quincena < qd && (f.liqEstado === 'PENDIENTE' || f.liqEstado === 'LIQUIDADO') && marc[f.conductor]) : [];
    const arrSet = new Set(arr);
    vis = vis.concat(arr).sort((a, b) => String(a.conductor).localeCompare(String(b.conductor)) || (arrSet.has(a) ? 0 : 1) - (arrSet.has(b) ? 0 : 1) || String(a.quincena).localeCompare(String(b.quincena)) || String(a.fecha).localeCompare(String(b.fecha)));
    // Descuentos por conductor (una vez por conductor+quincena incluida)
    const descCond = {};
    Array.from(new Set(vis.map(f => f.conductor + '|' + f.quincena))).forEach(k => { const p = k.split('|'); descCond[p[0]] = (descCond[p[0]] || 0) + self._descDe(p[0], p[1]).total; });
    const desc = Object.keys(descCond).reduce((a, c) => a + descCond[c], 0);
    return { vis: vis, qd: qd, qh: qh, est: est, conds: Array.from(new Set(vis.map(f => f.conductor))).sort(), arrSet: arrSet, nArr: arr.length, descCond: descCond, desc: Math.round(desc * 100) / 100 };
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
    const x0 = 450, x1 = c.W - 150, y0 = ns > 1 ? 104 : 74, h = c.H - y0 - 20;
    const max = Math.max(1, ...series.map(s => Math.max(0, ...s.datos)));
    const fila = h / Math.max(1, n), bh = Math.min(30, (fila - 12) / ns);
    if (ns > 1) series.forEach((s, i) => { g.fillStyle = s.color; g.fillRect(24 + i * 260, 64, 22, 22); g.fillStyle = '#334155'; g.font = '22px Calibri, Arial'; g.fillText(s.nombre, 54 + i * 260, 76); });
    etiquetas.forEach((e, i) => {
      const yc = y0 + fila * i + fila / 2;
      g.fillStyle = '#334155'; g.font = '20px Calibri, Arial'; g.textAlign = 'right'; g.fillText(self._corto(e, 38), x0 - 12, yc); g.textAlign = 'left';
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
      ['LAVADO', 9], ['OTROS', 9], ['MOTIVO OTROS', 22], ['FERIADO', 9], ['DOMINICAL', 10], ['BONO', 9], ['COSTO DEL VIAJE', 12], ['MONTO DEPOSITADO', 12], ['DEPÓSITOS ADICIONALES', 12], ['TOTAL DEPÓSITO', 12], ['TOTAL BONO', 12], ['PRODUCTO', 14], ['GL TRACTO', 10], ['GL GENSET', 10], ['ESTADO', 15]];
    const NC = cols.length;
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c[1]; });
    const numCols = [8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26];
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
        const esArr = sel.arrSet && sel.arrSet.has(f);
        const v = [self._qTxt(f.quincena) + (esArr ? ' (ANTERIOR)' : ''), self._f(f.fecha), f.placa, f.cliente, f.destino, f.clave, f.nroViatico, n2(f.km), n2(f.peajes), n2(f.viatico), n2(f.llanta), n2(f.cochera), n2(f.lavado), n2(f.otros), f.motivoOtros || '',
          n2(f.feriado), n2(f.dominical), n2(f.bono), n2(f.costo), n2(f.depositado), n2(f.extras), n2(f.totalDep), n2(f.totalBono), f.producto || '', n2(f.glTracto), n2(f.glGenset), (self._EST_TXT[f.liqEstado] || f.liqEstado) + (f.modPor ? ' · ✎ ' + f.modPor : '')];
        const row = ws.getRow(r);
        v.forEach((x, i) => {
          const cel = row.getCell(i + 1); cel.value = x; cel.border = borde; cel.font = { size: 9 };
          if (numCols.indexOf(i + 1) >= 0) { cel.numFmt = i === 7 ? '#,##0' : '#,##0.00;[Red]-#,##0.00;""'; }
          if (i === 18) { cel.font = { size: 9, bold: true }; cel.fill = relleno(GRIS); }
          if (i === 21) { cel.font = { size: 9, bold: true }; cel.fill = relleno('FFE6F2DC'); }
          if (i === 22) { cel.font = { size: 9, bold: true, color: { argb: 'FFB45309' } }; cel.fill = relleno('FFFFF3E0'); }
          if (i === 4 || i === 14 || i === 23 || i === 26) cel.alignment = { wrapText: true, vertical: 'middle' };
          if (esArr && i !== 18 && i !== 21 && i !== 22) cel.fill = relleno('FFFFEDD5');
        });
        r++;
      });
      const tr = ws.getRow(r);
      tr.getCell(1).value = 'TOTAL ' + cond; ws.mergeCells(r, 1, r, 7);
      const tv = { 8: s.km, 9: s.peajes, 10: s.viatico, 11: s.llanta, 12: s.cochera, 13: s.lavado, 14: s.otros, 16: s.feriado, 17: s.dominical, 18: s.bono, 19: s.costo, 20: s.depositado, 21: s.extras, 22: s.totalDep, 23: s.totalBono, 25: s.glTracto || 0, 26: s.glGenset || 0 };
      for (let i = 1; i <= NC; i++) {
        const cel = tr.getCell(i); cel.border = borde; cel.font = { bold: true, size: 10 }; cel.fill = relleno('FFE9EEF5');
        if (tv[i] !== undefined) { cel.value = n2(tv[i]); cel.numFmt = i === 8 ? '#,##0' : '#,##0.00;[Red]-#,##0.00'; }
      }
      tr.getCell(23).font = { bold: true, size: 11, color: { argb: 'FFB45309' } };
      const dC = Math.round(((sel.descCond || {})[cond] || 0) * 100) / 100;
      const nA = lista.filter(f => sel.arrSet && sel.arrSet.has(f)).length;
      if (dC || nA) {
        r++;
        if (nA) { const sa = self._suma(lista.filter(f => sel.arrSet.has(f))); ws.mergeCells(r, 1, r, 22); ws.getCell(r, 1).value = 'Incluye ' + nA + ' viaje(s) de quincenas anteriores sin depositar (filas naranjas): total bono S/ ' + self._m(sa.totalBono); ws.getCell(r, 1).font = { size: 9, italic: true, color: { argb: 'FFB45309' } }; r++; }
        ws.mergeCells(r, 1, r, 22); ws.getCell(r, 1).value = 'DESCUENTOS AL CONDUCTOR'; ws.getCell(r, 1).font = { bold: true, size: 10, color: { argb: 'FFB91C1C' } }; ws.getCell(r, 1).alignment = { horizontal: 'right' };
        ws.getCell(r, 23).value = -dC; ws.getCell(r, 23).numFmt = '#,##0.00;[Red]-#,##0.00'; ws.getCell(r, 23).font = { bold: true, color: { argb: 'FFB91C1C' } }; ws.getCell(r, 23).border = borde; r++;
        ws.mergeCells(r, 1, r, 22); ws.getCell(r, 1).value = 'A PAGAR (TOTAL BONO − DESCUENTOS)'; ws.getCell(r, 1).font = { bold: true, size: 11, color: { argb: AZ } }; ws.getCell(r, 1).alignment = { horizontal: 'right' };
        ws.getCell(r, 23).value = n2(s.totalBono - dC); ws.getCell(r, 23).numFmt = '#,##0.00;[Red]-#,##0.00'; ws.getCell(r, 23).font = { bold: true, size: 12, color: { argb: 'FF166534' } }; ws.getCell(r, 23).fill = relleno('FFDCFCE7'); ws.getCell(r, 23).border = borde;
      }
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
    const gv = { 8: t.km, 9: t.peajes, 10: t.viatico, 11: t.llanta, 12: t.cochera, 13: t.lavado, 14: t.otros, 16: t.feriado, 17: t.dominical, 18: t.bono, 19: t.costo, 20: t.depositado, 21: t.extras, 22: t.totalDep, 23: t.totalBono, 25: t.glTracto || 0, 26: t.glGenset || 0 };
    for (let i = 1; i <= NC; i++) {
      const cel = gr.getCell(i); cel.border = borde; cel.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }; cel.fill = relleno(AZ);
      if (gv[i] !== undefined) { cel.value = n2(gv[i]); cel.numFmt = i === 8 ? '#,##0' : '#,##0.00;[Red]-#,##0.00'; }
    }
    gr.height = 22;
    if (sel.desc || sel.nArr) {
      r++; ws.mergeCells(r, 1, r, 22); ws.getCell(r, 1).value = 'DESCUENTOS (todos los conductores)'; ws.getCell(r, 1).alignment = { horizontal: 'right' }; ws.getCell(r, 1).font = { bold: true, color: { argb: 'FFB91C1C' } };
      ws.getCell(r, 23).value = -n2(sel.desc); ws.getCell(r, 23).numFmt = '#,##0.00;[Red]-#,##0.00'; ws.getCell(r, 23).font = { bold: true, color: { argb: 'FFB91C1C' } };
      r++; ws.mergeCells(r, 1, r, 22); ws.getCell(r, 1).value = 'TOTAL A PAGAR' + (sel.nArr ? ' (QUINCENA + ANTERIORES)' : ''); ws.getCell(r, 1).alignment = { horizontal: 'right' }; ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: AZ } };
      ws.getCell(r, 23).value = n2(t.totalBono - sel.desc); ws.getCell(r, 23).numFmt = '#,##0.00'; ws.getCell(r, 23).font = { bold: true, size: 12, color: { argb: 'FF166534' } }; ws.getCell(r, 23).fill = relleno('FFDCFCE7');
    }

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
    const kpis = [['Conductores', nombres.length, '0'], ['Viajes', vis.length, '0'], ['Km recorridos', t.km || 0, '#,##0'], ['Costo de los viajes (S/)', t.costo, '#,##0.00'],
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
    const resumen = nombres.map(c => { const l = grupos[c], s = self._suma(l), dC = n2((sel.descCond || {})[c] || 0); return [c, l.length, n2(s.km), n2(s.costo), n2(s.totalDep), n2(s.totalBono), Array.from(new Set(l.map(f => self._EST_TXT[f.liqEstado]))).join(' / '), l.length ? n2((s.km || 0) / l.length) : 0, dC, n2(s.totalBono - dC)]; })
      .sort((a, b) => b[5] - a[5]);
    const totR = ['TOTAL', vis.length, n2(t.km), n2(t.costo), n2(t.totalDep), n2(t.totalBono), '', vis.length ? n2((t.km || 0) / vis.length) : 0, n2(sel.desc || 0), n2(t.totalBono - (sel.desc || 0))]; totR._tot = true;
    tabla('Resumen por conductor' + (sel.nArr ? ' (incluye pendientes de quincenas anteriores)' : ''), ['Conductor', 'Viajes', 'Km', 'Costo del viaje', 'Total depósito', 'Total bono', 'Estado', 'Km por viaje', 'Descuentos', 'A pagar'], resumen.concat([totR]), [null, '0', '#,##0', '#,##0.00', '#,##0.00', '#,##0.00', null, '#,##0', '#,##0.00', '#,##0.00']);
    // Gastos por concepto
    const conceptos = [['Peajes', t.peajes], ['Viático', t.viatico], ['Llanta', t.llanta], ['Cochera', t.cochera], ['Lavado', t.lavado], ['Otros', t.otros], ['Bono', t.bono], ['Feriado', t.feriado], ['Dominical', t.dominical]];
    const tg = t.gastos || 1;
    const cf = conceptos.map(c => [c[0], n2(c[1] || 0), (c[1] || 0) / tg]); const cft = ['TOTAL (costo + bono)', n2(t.gastos), 1]; cft._tot = true;
    tabla('Gastos por concepto', ['Concepto', 'Monto (S/)', '% del total'], cf.concat([cft]), [null, '#,##0.00', '0.0%']);
    // Estado de pago
    const ef = ['PENDIENTE', 'LIQUIDADO', 'DEPOSITADO'].map(e => [self._EST_TXT[e], viajesEst[e] || 0, n2(porEst[e] || 0)]);
    tabla('Estado de pago', ['Estado', 'Viajes', 'Total bono (S/)'], ef, [null, '0', '#,##0.00'], NAR);
    // Destinos más frecuentes
    const gd = self._agrupar(vis, f => f.destino);
    const dest = Object.keys(gd).map(k => [k, gd[k].length, n2(self._suma(gd[k]).km), n2(self._suma(gd[k]).costo)]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 15);
    tabla('Viajes más frecuentes (destino)', ['Destino', 'Viajes', 'Km', 'Costo (S/)'], dest, [null, '0', '#,##0', '#,##0.00'], VER);
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
      self._grafBarras('Depositado vs costo del viaje por conductor (S/)', porBono.map(x => x[0]), [{ nombre: 'Total depósito', color: '#16a34a', datos: porBono.map(x => x[4]) }, { nombre: 'Costo del viaje', color: '#1c3a5e', datos: porBono.map(x => x[3]) }], S),
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
    const enc = ['CONDUCTOR', 'QUINCENA', 'FECHA', 'PLACA', 'CLIENTE', 'DESTINO', 'CÓDIGO', 'N° VIÁTICO', 'KM', 'PEAJES', 'VIÁTICO', 'LLANTA', 'COCHERA', 'LAVADO', 'OTROS', 'MOTIVO OTROS', 'FERIADO', 'DOMINICAL', 'BONO', 'COSTO DEL VIAJE', 'MONTO DEPOSITADO', 'DEPÓSITOS ADICIONALES', 'TOTAL DEPÓSITO', 'TOTAL BONO', 'PRODUCTO', 'GL TRACTO', 'GL GENSET', 'ESTADO'];
    const filas = sel.vis.map(f => [f.conductor, self._qTxt(f.quincena) + (sel.arrSet && sel.arrSet.has(f) ? ' (ANTERIOR)' : ''), self._f(f.fecha), f.placa, f.cliente, f.destino, f.clave, f.nroViatico, n2(f.km), n2(f.peajes), n2(f.viatico), n2(f.llanta), n2(f.cochera), n2(f.lavado), n2(f.otros), f.motivoOtros || '',
      n2(f.feriado), n2(f.dominical), n2(f.bono), n2(f.costo), n2(f.depositado), n2(f.extras), n2(f.totalDep), n2(f.totalBono), f.producto || '', n2(f.glTracto), n2(f.glGenset), self._EST_TXT[f.liqEstado] || f.liqEstado]);
    const g = self._agrupar(sel.vis, f => f.conductor);
    const res = Object.keys(g).sort().map(c => { const s = self._suma(g[c]), dC = n2((sel.descCond || {})[c] || 0); return [c, g[c].length, n2(s.km), n2(s.costo), n2(s.totalDep), n2(s.totalBono), dC, n2(s.totalBono - dC)]; });
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([[self._periodoTxt(sel)], [], enc].concat(filas)), 'Liquidaciones');
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Resumen por conductor'], [], ['Conductor', 'Viajes', 'Km', 'Costo del viaje', 'Total depósito', 'Total bono', 'Descuentos', 'A pagar']].concat(res)), 'Dashboard');
    X.writeFile(wb, 'Liquidaciones_' + sel.qd + '.xlsx');
    mostrarMensaje('Excel generado sin gráficos (no cargó el componente de gráficos).', 'exito');
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-liquidacion-conductores');
  if (b) b.addEventListener('click', function () { FormLiquidacionConductores.abrir(); });
});
