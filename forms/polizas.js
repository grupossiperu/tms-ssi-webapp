/**
 * forms/polizas.js (v121, 13/11/2026) — Pólizas de seguro.
 * Finanzas → "Pólizas de seguro" (Facturación y Maestro editan) y Documentos → pestaña "Pólizas y seguros"
 * (los demás solo ven nombre, aseguradora, fin y adjunto). Cuotas con N° de liquidación, vencimiento y pago;
 * adjunto en Drive; endoso por venta de unidad (devolución = pagado − prima/365 × días usados; anula cuotas posteriores).
 * Exportar Excel (SheetJS) y "Copiar para Excel" (misma tabla con formato).
 * Usa UI120 (forms/tramos.js) para las ventanas.
 * v139 (27/11/2026): devolución del endoso por depósito o nota de crédito; la NC queda como saldo a favor con la
 * aseguradora y se usa en cuotas de otra póliza de la misma aseguradora y moneda (monto libre por cuota).
 */
const FormPolizas = {
  _datos: null,
  _cont: null,

  abrir: function () {
    const self = this;
    abrirPanel('Pólizas de seguro', '<div id="pzRaiz">Cargando…</div><div class="panel-footer" style="padding-top:10px"><button class="boton-secundario" id="pzCerrar">Cerrar</button></div>',
      function (raiz) { raiz.querySelector('#pzCerrar').addEventListener('click', cerrarPanel); self.render(raiz.querySelector('#pzRaiz')); }, { ancho: true });
  },

  _mon: m => m === 'PEN' ? 'S/' : 'US$',
  _iso: s => { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0') : ''; },
  _dmy: s => UI120.isoADmy(s),
  _f: function (s) { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; },

  render: async function (cont) {
    const self = this; self._cont = cont;
    cont.innerHTML = 'Cargando…';
    let r; try { r = await llamarBackend('polizasListar', { t: self._forzar ? Date.now() : undefined }); } catch (e) { r = null; }
    self._forzar = false;
    if (!r || !r.ok) { cont.textContent = (r && r.mensaje) || 'No se pudieron cargar las pólizas.'; return; }
    self._datos = r;
    const ed = r.editor;
    cont.innerHTML = `
      <style>
        .pz-barra{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:end;margin-bottom:10px}.pz-barra .campo{margin:0;min-width:150px}
        .pz-k{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:10px}.pz-k div{background:#f1f5f9;border-radius:10px;padding:8px 12px;border-left:4px solid #94a3b8}
        .pz-k span{display:block;font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase}.pz-k b{font-size:1.1rem;color:#1c3a5e}
        .pz-t{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.78rem}.pz-t th{background:#e2e8f0;padding:6px;text-align:left;font-size:.7rem;position:sticky;top:0}
        .pz-t td{padding:6px;border-bottom:1px solid #eef2f7;vertical-align:top;overflow-wrap:anywhere}.pz-t tbody tr{cursor:pointer}.pz-t tbody tr:hover td{background:#f8fafc}
        .pz-t tr.baja td{color:#94a3b8;text-decoration:line-through}
        .pz-chip{display:inline-block;border-radius:999px;padding:1px 8px;font-size:.68rem;font-weight:700}
        .pz-wrap{max-height:calc(74vh - 250px);overflow:auto;border:1px solid #e2e8f0;border-radius:10px}
      </style>
      <div class="pz-barra">
        <div class="campo"><label>Tipo</label><select id="pzTipo"><option value="">Todos</option>${r.tipos.map(t => '<option>' + t + '</option>').join('')}</select></div>
        <div class="campo"><label>Estado</label><select id="pzEst"><option value="ACTIVA">Activas</option><option value="">Todas</option><option value="RENOVADA">Renovadas</option><option value="ANULADA">Dadas de baja</option></select></div>
        <div class="campo" style="min-width:220px"><label>Buscar</label><input id="pzQ" placeholder="Nombre, aseguradora, N° póliza, placa"></div>
        ${ed ? '<button class="boton-primario" id="pzNuevo">+ Nueva póliza</button>' : ''}
        <button class="boton-secundario" id="pzExcel">⬇ Exportar Excel</button>
        <button class="boton-secundario" id="pzCopiar">📋 Copiar para Excel</button>
      </div>
      ${ed ? '<div class="pz-k" id="pzK"></div>' : ''}
      <div class="pz-wrap"><table class="pz-t" id="pzTabla"></table></div>
      <div style="font-size:.74rem;color:#64748b;margin-top:6px">${ed ? 'Clic en una póliza para ver o editar sus datos, cuotas, adjunto y endosos.' : 'Solo lectura. Las pólizas las registra Facturación.'} El sistema avisa ${r.diasAviso} días antes de la fecha de fin.</div>`;
    const q = s => cont.querySelector(s);
    ['#pzTipo', '#pzEst'].forEach(s => q(s).addEventListener('change', () => self._pintar()));
    q('#pzQ').addEventListener('input', () => self._pintar());
    if (ed) q('#pzNuevo').addEventListener('click', () => self.ficha(null));
    q('#pzExcel').addEventListener('click', () => self._excel());
    q('#pzCopiar').addEventListener('click', () => self._copiar());
    self._pintar();
  },

  _vis: function () {
    const c = this._cont, q = s => c.querySelector(s);
    const t = q('#pzTipo').value, e = q('#pzEst').value, b = sinTildesPz(q('#pzQ').value);
    return (this._datos.items || []).filter(x => (!t || x.tipo === t) && (!e || x.estado === e) &&
      (!b || sinTildesPz([x.nombre, x.aseguradora, x.numero, x.placas, x.tipo].join(' ')).indexOf(b) >= 0))
      .sort((a, b2) => (a.diasFin === null ? 99999 : a.diasFin) - (b2.diasFin === null ? 99999 : b2.diasFin));
  },

  _chipFin: function (x) {
    if (x.estado === 'RENOVADA') return '<span class="pz-chip" style="background:#e0e7ff;color:#3730a3" title="' + esc(x.motivoBaja || '') + '">Renovada</span>';
    if (x.estado !== 'ACTIVA') return '<span class="pz-chip" style="background:#f1f5f9;color:#64748b">De baja</span>';
    if (x.diasFin === null) return '<span class="pz-chip" style="background:#f1f5f9;color:#64748b">Sin fecha</span>';
    if (x.diasFin < 0) return '<span class="pz-chip" style="background:#fee2e2;color:#991b1b">Vencida</span>';
    if (x.diasFin <= this._datos.diasAviso) return '<span class="pz-chip" style="background:#fef3c7;color:#92400e">Vence en ' + x.diasFin + ' d</span>';
    return '<span class="pz-chip" style="background:#dcfce7;color:#166534">Vigente · ' + x.diasFin + ' d</span>';
  },

  _pintar: function () {
    const self = this, ed = self._datos.editor, L = self._vis(), c = self._cont;
    const m = (n) => UI120.m(n);
    if (ed) {
      const act = self._datos.items.filter(x => x.estado === 'ACTIVA');
      const porMon = k => { const o = {}; act.forEach(x => { o[x.moneda] = (o[x.moneda] || 0) + (x[k] || 0); }); return Object.keys(o).map(mm => self._mon(mm) + ' ' + m(o[mm])).join(' · ') || '—'; };
      c.querySelector('#pzK').innerHTML = '<div><span>Pólizas activas</span><b>' + act.length + '</b></div>' +
        '<div style="border-left-color:#d97706"><span>Vencen en ' + self._datos.diasAviso + ' días</span><b>' + act.filter(x => x.diasFin !== null && x.diasFin <= self._datos.diasAviso).length + '</b></div>' +
        '<div style="border-left-color:#dc2626"><span>Cuotas vencidas sin pagar</span><b>' + act.reduce((a, x) => a + (x.vencidas || 0), 0) + '</b></div>' +
        '<div style="border-left-color:#2563eb"><span>Saldo por pagar</span><b style="font-size:.95rem">' + porMon('saldo') + '</b></div>' +
        '<div id="pzFav" style="border-left-color:#16a34a;cursor:pointer" title="Ver notas de crédito"><span>Saldo a favor (notas de crédito)</span>' +
        ((self._datos.saldoFavor || []).length ? (self._datos.saldoFavor || []).map(f => '<b style="font-size:.85rem;display:block">' + esc(f.aseguradora || 'SIN ASEGURADORA') + ': ' + self._mon(f.moneda) + ' ' + m(f.saldo) + '</b>').join('') : '<b style="font-size:.95rem">—</b>') +
        '<span style="text-transform:none;font-weight:600;color:#16a34a">Ver detalle ›</span></div>';
      c.querySelector('#pzFav').addEventListener('click', () => self._verNotas());
    }
    const cab = ed ? '<colgroup><col style="width:17%"><col style="width:9%"><col style="width:13%"><col style="width:9%"><col style="width:12%"><col style="width:12%"><col style="width:10%"><col style="width:12%"><col style="width:6%"></colgroup>' +
      '<thead><tr><th>Póliza</th><th>Tipo</th><th>Aseguradora / N°</th><th>Prima anual</th><th>Vigencia</th><th>Estado</th><th>Cuotas</th><th>Próxima cuota</th><th>Adjunto</th></tr></thead>'
      : '<colgroup><col style="width:28%"><col style="width:12%"><col style="width:24%"><col style="width:12%"><col style="width:14%"><col style="width:10%"></colgroup><thead><tr><th>Póliza</th><th>Tipo</th><th>Aseguradora / N°</th><th>Fin</th><th>Estado</th><th>Adjunto</th></tr></thead>';
    const adj = x => x.archivoUrl ? '<a href="' + esc(x.archivoUrl) + '" target="_blank" rel="noopener" data-noclic>📎 Ver</a>' : '<span style="color:#94a3b8">—</span>';
    c.querySelector('#pzTabla').innerHTML = cab + '<tbody>' + (L.length ? L.map((x, i) => '<tr data-i="' + i + '" class="' + (x.estado !== 'ACTIVA' ? 'baja' : '') + '"><td><b>' + esc(x.nombre) + '</b>' + (x.placas ? '<div style="color:#64748b;font-size:.7rem">' + esc(x.placas) + '</div>' : '') + '</td><td>' + esc(x.tipo) + '</td>' +
      '<td>' + esc(x.aseguradora || '—') + '<div style="color:#64748b">' + esc(x.numero || '') + '</div></td>' +
      (ed ? '<td>' + (x.prima ? self._mon(x.moneda) + ' ' + m(x.prima) : '—') + '</td><td>' + esc(x.inicio || '¿?') + '<div>' + esc(x.fin || '') + '</div></td>' : '<td>' + esc(x.fin || '') + '</td>') +
      '<td>' + self._chipFin(x) + '</td>' +
      (ed ? '<td>' + (x.cuotas.length ? x.cuotas.filter(q => q.estado === 'PAGADA').length + '/' + x.cuotas.filter(q => q.estado !== 'ANULADA').length + ' pagadas' + (x.vencidas ? '<div style="color:#b91c1c;font-weight:700">' + x.vencidas + ' vencida(s)</div>' : '') : '<span style="color:#94a3b8">Sin cuotas</span>') + '</td>' +
        '<td>' + (x.proxima ? esc(x.proxima.vence) + '<div>' + self._mon(x.moneda) + ' ' + m(x.proxima.monto) + (x.proxima.liquidacion ? ' · ' + esc(x.proxima.liquidacion) : '') + '</div>' : '—') + '</td>' : '') +
      '<td>' + adj(x) + '</td></tr>').join('') : '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:14px">Sin pólizas con estos filtros.</td></tr>') + '</tbody>';
    c.querySelectorAll('#pzTabla tbody tr[data-i]').forEach(tr => tr.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-noclic]')) return;
      self.ficha(L[+tr.dataset.i]);
    }));
  },

  /* ---------------- Ficha (nueva / editar / ver) ---------------- */
  ficha: function (x) {
    const self = this, ed = self._datos.editor;
    if (!ed) {
      UI120.ventana('Póliza · ' + esc(x.nombre), '<div class="info"><span>Tipo: <b>' + esc(x.tipo) + '</b></span><span>Aseguradora: <b>' + esc(x.aseguradora || '—') + '</b></span><span>N°: <b>' + esc(x.numero || '—') + '</b></span>' +
        '<span>Fin: <b>' + esc(x.fin) + '</b></span></div><div style="margin-top:12px">' + self._chipFin(x) + '</div>' +
        (x.archivoUrl ? '<p><a class="boton-primario" style="display:inline-block;text-decoration:none;padding:8px 14px" href="' + esc(x.archivoUrl) + '" target="_blank" rel="noopener">📎 Abrir la póliza</a></p>' : '<p style="color:#64748b">Sin archivo adjunto.</p>'), 560);
      return;
    }
    x = x || { nombre: '', tipo: '', aseguradora: '', numero: '', moneda: 'USD', prima: '', inicio: '', fin: '', placas: '', observacion: '', cuotas: [], endosos: [], estado: 'ACTIVA' };
    const w = UI120.ventana(x.id ? 'Póliza · ' + esc(x.nombre) : x._renuevaDe ? '🔄 Renovar póliza · ' + esc(x.nombre) : 'Nueva póliza', `
      ${x._renuevaDe ? '<div class="info" style="background:#eef2ff;margin-bottom:10px"><span>Renovación: revise fechas, prima y cuotas, suba la póliza nueva y guarde. La póliza anterior quedará como <b>Renovada</b> y dejará de avisar.</span></div>' : ''}
      <div class="g">
        <div class="campo" style="grid-column:span 2"><label>Nombre de la póliza</label><input id="pfNom" value="${esc(x.nombre)}" style="text-transform:uppercase"></div>
        <div class="campo"><label>Tipo</label><input id="pfTipo" list="pfTipos" value="${esc(x.tipo)}" style="text-transform:uppercase" placeholder="Elija o escriba"><datalist id="pfTipos">${self._datos.tipos.map(t => '<option value="' + t + '">').join('')}</datalist></div>
        <div class="campo"><label>Aseguradora</label><input id="pfAseg" value="${esc(x.aseguradora)}" style="text-transform:uppercase"></div>
        <div class="campo"><label>N° de póliza</label><input id="pfNum" value="${esc(x.numero)}" style="text-transform:uppercase"></div>
        <div class="campo"><label>Moneda</label><select id="pfMon"><option value="USD">Dólares (US$)</option><option value="PEN">Soles (S/)</option></select></div>
        <div class="campo"><label>Prima anual (total)</label><input id="pfPrima" inputmode="decimal" value="${esc(x.prima || '')}"></div>
        <div class="campo"><label>Fecha de inicio</label><input type="date" id="pfIni" value="${self._iso(x.inicio)}"></div>
        <div class="campo"><label>Fecha de fin</label><input type="date" id="pfFin" value="${self._iso(x.fin)}"></div>
        <div class="campo" style="grid-column:span 2"><label>Placas / unidades cubiertas (opcional)</label><input id="pfPlacas" value="${esc(x.placas)}" placeholder="Ej. AYN941, A5O859" style="text-transform:uppercase"></div>
        <div class="campo"><label>Observación</label><input id="pfObs" value="${esc(x.observacion || '')}"></div>
      </div>
      <div id="pfFav" style="display:none;margin-top:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;font-size:.8rem"></div>
      <div class="sub">Adjunto</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        ${x.archivoUrl ? '<a href="' + esc(x.archivoUrl) + '" target="_blank" rel="noopener">📎 ' + esc(x.archivoNombre || 'Ver póliza actual') + '</a>' : '<span style="color:#64748b;font-size:.8rem">Sin archivo</span>'}
        <input type="file" id="pfArch" accept=".pdf,image/*" style="width:auto">
        <span style="font-size:.72rem;color:#64748b">PDF o foto, máx. 10 MB. Se sube al guardar.</span>
      </div>
      <div class="sub">Cuotas de pago</div>
      <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:6px">
        <div class="campo" style="width:110px"><label>N° de cuotas</label><input id="pfN" type="number" min="1" max="24" value="${x.cuotas.length || ''}"></div>
        <div class="campo" style="width:160px"><label>1.ª cuota vence</label><input type="date" id="pfV1" value="${self._iso((x.cuotas[0] || {}).vence) || self._iso(x.inicio)}"></div>
        <button type="button" class="boton-secundario" id="pfGen">Generar cuotas iguales (mensuales)</button>
        <button type="button" class="boton-secundario" id="pfMas">+ Agregar cuota</button>
      </div>
      <table><thead><tr><th style="width:30px">N°</th><th>N° liquidación</th><th style="width:96px">Monto</th><th style="width:132px">Vence</th><th style="width:132px">Fecha de pago</th><th style="width:110px">Estado</th><th style="width:240px">Pagar con nota de crédito</th><th style="width:26px"></th></tr></thead><tbody id="pfCuotas"></tbody></table>
      <div class="res" id="pfRes"></div>
      ${x.id ? '<div class="sub">Endosos (venta / baja de unidad)</div>' + (x.endosos.length ? '<table><thead><tr><th>Fecha baja</th><th>Placa</th><th>Días usados</th><th>Usado</th><th>Pagado</th><th>Devolución</th><th>Cómo se devolvió</th><th>Cuotas anuladas</th><th>Registró</th></tr></thead><tbody>' +
        x.endosos.map((e, i) => '<tr><td>' + esc(e.fechaBaja) + '</td><td>' + esc(e.placa) + '</td><td>' + e.dias + '</td><td>' + UI120.m(e.usado) + '</td><td>' + UI120.m(e.pagado) + '</td><td><b>' + self._mon(x.moneda) + ' ' + UI120.m(e.devolucion) + '</b>' + (e.manual ? ' (manual)' : '') + '</td><td>' + self._txtDev(x, e) +
          ' <button type="button" class="boton-secundario pf-nc" data-i="' + i + '" style="padding:2px 8px;font-size:.72rem;margin-top:2px">' + (e.nc || e.deposito ? '✎ Editar' : '+ Registrar') + '</button></td><td>' + (e.anuladas || []).join(', ') + '</td><td>' + esc(e.por) + '<div style="color:#94a3b8">' + esc(e.registrado) + '</div></td></tr>').join('') + '</tbody></table>' : '<div style="color:#64748b;font-size:.8rem">Sin endosos.</div>') +
        '<button type="button" class="boton-secundario" id="pfEndoso" style="margin-top:6px">Registrar endoso (venta / baja de una unidad)</button>' : ''}
      <div class="pie">
        ${x.id ? '<button class="boton-secundario" id="pfBaja" style="margin-right:auto">' + (x.estado === 'ACTIVA' ? 'Dar de baja la póliza' : 'Reactivar') + '</button>' : ''}
        ${x.id && x.estado === 'ACTIVA' ? '<button class="boton-secundario" id="pfRenovar" style="background:#eef2ff;border-color:#c7d2fe;color:#3730a3">🔄 Renovar póliza</button>' : ''}
        <button class="boton-secundario" data-c>Cancelar</button><button class="boton-primario" data-ok>Guardar</button></div>`, 1080);
    w.q('#pfMon').value = x.moneda || 'USD';
    const tb = w.q('#pfCuotas');
    const fila = function (c) {
      c = c || {};
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="n"></td><td><input class="cl" value="' + esc(c.liquidacion || '') + '" style="text-transform:uppercase"></td><td><input class="cm" inputmode="decimal" value="' + (c.monto || '') + '"></td>' +
        '<td><input type="date" class="cv" value="' + self._iso(c.vence) + '"></td><td><input type="date" class="cp" value="' + self._iso(c.pago) + '"></td>' +
        '<td><select class="ce" style="font-size:.74rem;padding:5px 3px"><option>PENDIENTE</option><option>PAGADA</option><option>ANULADA</option></select>' + (c.nota ? '<div style="font-size:.66rem;color:#64748b">' + esc(c.nota) + '</div>' : '') + '</td>' +
        '<td><div style="display:flex;gap:4px"><select class="cn" style="font-size:.72rem;padding:5px 3px;flex:1;min-width:0"></select><input class="cnm" inputmode="decimal" placeholder="Monto" style="width:76px" value="' + (Number(c.ncMonto) > 0 ? c.ncMonto : '') + '"></div><div class="cap" style="font-size:.66rem;color:#166534"></div></td><td><button type="button" class="qx"style="border:0;background:none;color:#b91c1c;cursor:pointer;font-size:16px">×</button></td>';
      tr.querySelector('.ce').value = c.estado || 'PENDIENTE';
      tr.dataset.ncRef = c.ncRef || '';
      tr.querySelector('.cn').addEventListener('input', function () {
        tr.dataset.ncRef = this.value;
        if (!this.value) tr.querySelector('.cnm').value = '';
        else if (!tr.querySelector('.cnm').value) tr.querySelector('.cnm').value = Math.max(0, Math.min(UI120.n(tr.querySelector('.cm').value), disponible(this.value, tr))).toFixed(2);
        cubrir(tr); resumen();
      });
      tr.querySelector('.cnm').addEventListener('change', function () { cubrir(tr); resumen(); });
      tr.querySelector('.cp').addEventListener('change', function () { if (this.value && tr.querySelector('.ce').value === 'PENDIENTE') tr.querySelector('.ce').value = 'PAGADA'; resumen(); });
      tr.querySelector('.qx').addEventListener('click', () => { tr.remove(); numerar(); resumen(); });
      tr.querySelectorAll('input,select').forEach(i => i.addEventListener('input', resumen));
      tb.appendChild(tr); numerar(); return tr;
    };
    const numerar = () => tb.querySelectorAll('tr').forEach((tr, i) => { tr.querySelector('.n').textContent = i + 1; });
    const leer = () => Array.from(tb.querySelectorAll('tr')).map(tr => ({ liquidacion: tr.querySelector('.cl').value.trim(), monto: UI120.n(tr.querySelector('.cm').value),
      vence: self._dmy(tr.querySelector('.cv').value), pago: self._dmy(tr.querySelector('.cp').value), estado: tr.querySelector('.ce').value,
      ncRef: tr.dataset.ncRef || '', ncMonto: tr.dataset.ncRef ? UI120.n(tr.querySelector('.cnm').value) : 0 }));
    // ---- Notas de crédito disponibles (misma aseguradora y moneda, de otra póliza) ----
    const notas = self._datos.notasCredito || [];
    const usoOrig = {};
    (x.cuotas || []).forEach(c => { if (c.ncRef && c.estado !== 'ANULADA' && Number(c.ncMonto) > 0) usoOrig[c.ncRef] = (usoOrig[c.ncRef] || 0) + Number(c.ncMonto); });
    const aseg = () => String(w.q('#pfAseg').value || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const aptas = () => notas.filter(n => n.aseguradora === aseg() && n.moneda === w.q('#pfMon').value && n.polizaId !== x.id);
    const disponible = function (ref, trExcl) {
      const n = notas.find(k => k.key === ref); if (!n) return 0;
      let usoForm = 0;
      tb.querySelectorAll('tr').forEach(tr => { if (tr !== trExcl && tr.dataset.ncRef === ref && tr.querySelector('.ce').value !== 'ANULADA') usoForm += UI120.n(tr.querySelector('.cnm').value); });
      return Math.round((n.saldo + (usoOrig[ref] || 0) - usoForm) * 100) / 100;
    };
    const cubrir = function (tr) {
      const m = UI120.n(tr.querySelector('.cm').value), nc = tr.dataset.ncRef ? UI120.n(tr.querySelector('.cnm').value) : 0;
      if (nc > 0 && m > 0 && nc >= m - 0.001 && tr.querySelector('.ce').value === 'PENDIENTE') {
        tr.querySelector('.ce').value = 'PAGADA';
        if (!tr.querySelector('.cp').value) { const h = new Date(); tr.querySelector('.cp').value = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0'); }
      }
    };
    const pintarNC = function () {
      const ap = aptas(), mo = self._mon(w.q('#pfMon').value);
      tb.querySelectorAll('tr').forEach(tr => {
        const sel = tr.querySelector('.cn'), ref = tr.dataset.ncRef || '';
        const lista = ap.slice();
        if (ref && !lista.some(n => n.key === ref)) { const n0 = notas.find(n => n.key === ref); if (n0) lista.push(n0); }
        sel.innerHTML = '<option value="">' + (lista.length ? '— No usar —' : '— Sin notas de crédito —') + '</option>' +
          lista.map(n => '<option value="' + esc(n.key) + '">NC ' + esc(n.numero) + ' · disp. ' + mo + ' ' + UI120.m(disponible(n.key, tr)) + '</option>').join('');
        sel.value = ref; sel.disabled = !lista.length && !ref;
        tr.querySelector('.cnm').disabled = !ref;
        const nc = ref ? UI120.n(tr.querySelector('.cnm').value) : 0, m = UI120.n(tr.querySelector('.cm').value);
        tr.querySelector('.cap').textContent = nc > 0 ? 'Con NC ' + mo + ' ' + UI120.m(nc) + ' · a pagar: ' + mo + ' ' + UI120.m(Math.max(0, m - nc)) : '';
      });
      const box = w.q('#pfFav');
      if (ap.length) {
        const fav = ap.reduce((a, n) => a + Math.max(0, disponible(n.key, null)), 0);
        box.style.display = '';
        box.innerHTML = '💳 <b>Saldo a favor con ' + esc(aseg()) + ': ' + mo + ' ' + UI120.m(fav) + '</b> · ' +
          ap.map(n => 'NC ' + esc(n.numero) + ' (de ' + esc(n.poliza) + (n.placa ? ' / ' + esc(n.placa) : '') + ')').join(' · ') +
          '. Úselo en cada cuota, columna <b>"Pagar con nota de crédito"</b>, con el monto que quiera.';
      } else { box.style.display = 'none'; box.innerHTML = ''; }
    };
    const resumen = function () {
      pintarNC();
      const cs = leer(), mo = self._mon(w.q('#pfMon').value), prima = UI120.n(w.q('#pfPrima').value);
      const tot = cs.filter(c => c.estado !== 'ANULADA').reduce((a, c) => a + c.monto, 0), pag = cs.filter(c => c.estado === 'PAGADA').reduce((a, c) => a + c.monto, 0);
      const ncTot = cs.filter(c => c.estado !== 'ANULADA').reduce((a, c) => a + (c.ncMonto || 0), 0);
      const saldo = cs.filter(c => c.estado !== 'ANULADA' && c.estado !== 'PAGADA').reduce((a, c) => a + Math.max(0, c.monto - (c.ncMonto || 0)), 0);
      w.q('#pfRes').innerHTML = '<div><span>Total cuotas</span><b>' + mo + ' ' + UI120.m(tot) + '</b>' + (prima && Math.abs(tot - prima) > 0.01 && cs.length ? '<div style="font-size:.68rem;color:#b45309">Prima anual: ' + mo + ' ' + UI120.m(prima) + '</div>' : '') + '</div>' +
        '<div><span>Pagado</span><b>' + mo + ' ' + UI120.m(pag) + '</b></div>' +
        (ncTot ? '<div style="background:#f0fdf4"><span>Cubierto con nota de crédito</span><b>' + mo + ' ' + UI120.m(ncTot) + '</b></div>' : '') +
        '<div><span>Saldo</span><b>' + mo + ' ' + UI120.m(Math.max(0, Math.round(saldo * 100) / 100)) + '</b>' + (ncTot ? '<div style="font-size:.68rem;color:#64748b">cuotas pendientes − lo que cubre la NC</div>' : '') + '</div>';
    };
    (x.cuotas || []).forEach(fila); resumen();
    ['#pfPrima', '#pfMon', '#pfAseg'].forEach(s => w.q(s).addEventListener('input', resumen));
    w.q('#pfMas').addEventListener('click', () => fila({}));
    w.q('#pfGen').addEventListener('click', function () {
      const n = Math.max(1, Math.min(24, parseInt(w.q('#pfN').value, 10) || 0)), prima = UI120.n(w.q('#pfPrima').value), v1 = w.q('#pfV1').value;
      if (!n) { mostrarMensaje('Indique el N° de cuotas.', 'error'); return; }
      if (!prima) { mostrarMensaje('Escriba primero la prima anual.', 'error'); return; }
      if (!v1) { mostrarMensaje('Indique cuándo vence la primera cuota.', 'error'); return; }
      if (tb.children.length && !confirm('¿Reemplazar las cuotas actuales?')) return;
      tb.innerHTML = '';
      const base = Math.floor(prima / n * 100) / 100; const p = v1.split('-').map(Number);
      for (let i = 0; i < n; i++) {
        const d = new Date(p[0], p[1] - 1 + i, 1); const ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(p[2], ult));
        fila({ monto: i === n - 1 ? Math.round((prima - base * (n - 1)) * 100) / 100 : base, vence: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() });
      }
      resumen();
    });
    w.q('[data-c]').addEventListener('click', w.cerrar);
    if (x.id && w.q('#pfRenovar')) w.q('#pfRenovar').addEventListener('click', function () { w.cerrar(); self.renovar(x); });
    if (x.id) {
      w.q('#pfEndoso').addEventListener('click', () => self.endoso(x, w));
      w.velo.querySelectorAll('.pf-nc').forEach(b => b.addEventListener('click', () => self.devolucion(x, Number(b.dataset.i), w)));
      w.q('#pfBaja').addEventListener('click', async function () {
        const baja = x.estado === 'ACTIVA'; let motivo = '';
        if (baja) { motivo = prompt('Motivo de la baja de la póliza:'); if (!motivo || !motivo.trim()) return; }
        const r = await llamarBackend('polizasBaja', { id: x.id, baja: baja, motivo: motivo });
        mostrarMensaje((r && r.mensaje) || 'Error', r && r.ok ? 'exito' : 'error');
        if (r && r.ok) { w.cerrar(); self._recargar(); }
      });
    }
    w.q('[data-ok]').addEventListener('click', async function () {
      const arch = w.q('#pfArch').files[0];
      if (arch && arch.size > 10 * 1024 * 1024) { mostrarMensaje('El archivo pasa de 10 MB.', 'error'); return; }
      const csNc = leer(), iMal = csNc.findIndex(c => c.ncRef && !(c.ncMonto > 0));
      if (iMal >= 0) { mostrarMensaje('Escriba el monto de la nota de crédito en la cuota ' + (iMal + 1) + ' o quite la nota.', 'error'); return; }
      const sobra = Array.from(tb.querySelectorAll('tr')).find(tr => tr.dataset.ncRef && disponible(tr.dataset.ncRef, null) < -0.001);
      if (sobra) { mostrarMensaje('Se está usando más de lo disponible de una nota de crédito (cuota ' + sobra.querySelector('.n').textContent + ').', 'error'); return; }
      const datos = { id: x.id || '', nombre: w.q('#pfNom').value, tipo: w.q('#pfTipo').value, aseguradora: w.q('#pfAseg').value, numero: w.q('#pfNum').value,
        moneda: w.q('#pfMon').value, prima: w.q('#pfPrima').value, inicio: self._dmy(w.q('#pfIni').value), fin: self._dmy(w.q('#pfFin').value),
        placas: w.q('#pfPlacas').value, observacion: w.q('#pfObs').value, cuotas: leer(), renuevaDe: x._renuevaDe || '' };
      const b = this; b.disabled = true; b.textContent = 'Guardando…';
      try {
        const r = await llamarBackend('polizasGrabar', datos);
        if (!r || !r.ok) throw new Error((r && r.mensaje) || 'No se pudo guardar.');
        if (arch) {
          b.textContent = 'Subiendo archivo…';
          const dataUrl = await new Promise((ok, mal) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = mal; fr.readAsDataURL(arch); });
          const s = await llamarBackend('polizasSubir', { id: r.id, nombre: arch.name, dataUrl: dataUrl });
          if (!s || !s.ok) mostrarMensaje('La póliza se guardó, pero el archivo no: ' + ((s && s.mensaje) || 'error'), 'error');
        }
        w.cerrar(); mostrarMensaje(r.mensaje, 'exito'); self._recargar();
      } catch (e) { mostrarMensaje(e.message || String(e), 'error'); b.disabled = false; b.textContent = 'Guardar'; }
    });
  },

  /** Renovar: abre una póliza nueva con los mismos datos, un año después (cuotas corridas un año). */
  renovar: function (x) {
    const self = this;
    const masAnio = s => { const d = self._f(s); if (!d) return ''; d.setFullYear(d.getFullYear() + 1); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };
    self.ficha({ nombre: x.nombre, tipo: x.tipo, aseguradora: x.aseguradora, numero: '', moneda: x.moneda, prima: x.prima, inicio: x.fin, fin: masAnio(x.fin),
      placas: x.placas, observacion: '', endosos: [], estado: 'ACTIVA', _renuevaDe: x.id,
      cuotas: (x.cuotas || []).filter(c => c.estado !== 'ANULADA').map(c => ({ monto: c.monto, vence: masAnio(c.vence), estado: 'PENDIENTE' })) });
  },

  /* ---------------- Endoso por venta / baja de unidad ---------------- */
  endoso: function (x, wFicha) {
    const self = this, mo = self._mon(x.moneda);
    const ini = self._f(x.inicio);
    if (!ini) { mostrarMensaje('Primero complete y guarde la fecha de inicio de la póliza.', 'error'); return; }
    const pagado = (x.cuotas || []).filter(c => c.estado === 'PAGADA').reduce((a, c) => a + (Number(c.monto) || 0), 0);
    const w = UI120.ventana('Endoso · ' + esc(x.nombre), `
      <div class="info"><span>Inicio: <b>${esc(x.inicio)}</b></span><span>Fin: <b>${esc(x.fin)}</b></span><span>Prima anual: <b>${mo} ${UI120.m(x.prima)}</b></span><span>Pagado: <b>${mo} ${UI120.m(pagado)}</b></span></div>
      <div class="g" style="margin-top:10px">
        <div class="campo"><label>Placa / unidad que sale</label><input id="enPla" list="enPlas" style="text-transform:uppercase"><datalist id="enPlas">${String(x.placas || '').split(/[,;\s]+/).filter(Boolean).map(p => '<option value="' + esc(p) + '">').join('')}</datalist></div>
        <div class="campo"><label>Fecha de venta / baja</label><input type="date" id="enFec"></div>
        <div class="campo"><label>Prima anual base</label><input id="enPri" inputmode="decimal" value="${x.prima || ''}" title="Si la póliza cubre varias unidades, ponga la prima de esta unidad"></div>
        <div class="campo"><label>Pagado (base)</label><input id="enPag" inputmode="decimal" value="${pagado.toFixed(2)}"></div>
        <div class="campo"><label>Devolución (escribir para fijarla)</label><input id="enMan" inputmode="decimal" placeholder="Automática"></div>
        <div class="campo"><label>Observación</label><input id="enObs" placeholder="N° de endoso, comprador…"></div>
        <div class="campo"><label>¿Cómo se devuelve?</label><select id="enTipo"><option value="">Pendiente (aún no se sabe)</option><option value="DEPOSITO">Depósito en nuestra cuenta</option><option value="NC">Nota de crédito (saldo a favor)</option></select></div>
      </div>
      <div class="g" id="enDep" style="display:none;margin-top:6px">
        <div class="campo"><label>Fecha del depósito</label><input type="date" id="enDepF"></div>
        <div class="campo"><label>Banco</label><input id="enDepB" style="text-transform:uppercase"></div>
        <div class="campo"><label>N° de operación</label><input id="enDepO" style="text-transform:uppercase"></div>
        <div class="campo"><label>Monto depositado</label><input id="enDepM" inputmode="decimal" placeholder="Igual a la devolución"></div>
      </div>
      <div class="g" id="enNc" style="display:none;margin-top:6px">
        <div class="campo"><label>N° nota de crédito</label><input id="enNcN" style="text-transform:uppercase"></div>
        <div class="campo"><label>Fecha de la nota de crédito</label><input type="date" id="enNcF"></div>
        <div class="campo"><label>Monto de la nota de crédito</label><input id="enNcM" inputmode="decimal" placeholder="Igual a la devolución"></div>
      </div>
      <label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:.8rem"><input type="checkbox" id="enAnu" checked style="width:auto"> Anular las cuotas pendientes que vencen después de la fecha de baja</label>
      <div class="res" id="enRes"></div>
      <div class="nota" id="enAnuTxt"></div>
      <div class="nota">Usado = prima anual ÷ 365 × días desde el inicio hasta la baja. Devolución = pagado − usado (si sale negativo, no hay devolución).</div>
      <div class="nota">La devolución se puede registrar después desde la ficha. La nota de crédito queda como saldo a favor con la aseguradora y se usa en cuotas de otra póliza de la misma aseguradora.</div>
      <div class="pie"><button class="boton-secundario" data-c>Cancelar</button><button class="boton-primario" data-ok>Registrar endoso</button></div>`, 760);
    const calc = function () {
      const fb = w.q('#enFec').value ? new Date(w.q('#enFec').value + 'T00:00:00') : null;
      const dias = fb ? Math.round((fb - ini) / 86400000) : 0, prima = UI120.n(w.q('#enPri').value), pag = UI120.n(w.q('#enPag').value);
      const usado = Math.round(prima / 365 * dias * 100) / 100, auto = Math.max(0, Math.round((pag - usado) * 100) / 100);
      const man = w.q('#enMan').value.trim();
      w.q('#enRes').innerHTML = '<div><span>Días usados</span><b>' + (fb ? dias : '—') + '</b></div><div><span>Usado</span><b>' + mo + ' ' + UI120.m(usado) + '</b></div>' +
        '<div style="background:#f0fdf4"><span>Devolución a solicitar</span><b>' + mo + ' ' + UI120.m(man ? UI120.n(man) : auto) + '</b>' + (man ? '<div style="font-size:.68rem">manual · cálculo: ' + UI120.m(auto) + '</div>' : '') + '</div>';
      const anul = fb && w.q('#enAnu').checked ? (x.cuotas || []).filter(c => c.estado === 'PENDIENTE' && self._f(c.vence) && self._f(c.vence) > fb) : [];
      w.q('#enAnuTxt').innerHTML = anul.length ? 'Se anularán ' + anul.length + ' cuota(s): ' + anul.map(c => 'N° ' + c.n + ' (' + esc(c.vence) + ', ' + mo + ' ' + UI120.m(c.monto) + ')').join(' · ') : '';
    };
    w.velo.querySelectorAll('input').forEach(i => { i.addEventListener('input', calc); i.addEventListener('change', calc); }); calc();
    w.q('#enTipo').addEventListener('change', function () { w.q('#enDep').style.display = this.value === 'DEPOSITO' ? '' : 'none'; w.q('#enNc').style.display = this.value === 'NC' ? '' : 'none'; });
    w.q('[data-c]').addEventListener('click', w.cerrar);
    w.q('[data-ok]').addEventListener('click', async function () {
      const datos = { id: x.id, placa: w.q('#enPla').value, fechaBaja: self._dmy(w.q('#enFec').value), primaBase: w.q('#enPri').value, pagadoBase: w.q('#enPag').value,
        devolucionManual: w.q('#enMan').value.trim(), anularPosteriores: w.q('#enAnu').checked, observacion: w.q('#enObs').value,
        devTipo: w.q('#enTipo').value,
        ncNumero: w.q('#enNcN').value.trim().toUpperCase(), ncFecha: self._dmy(w.q('#enNcF').value), ncMonto: w.q('#enNcM').value.trim(),
        depFecha: self._dmy(w.q('#enDepF').value), depBanco: w.q('#enDepB').value.trim(), depOperacion: w.q('#enDepO').value.trim(), depMonto: w.q('#enDepM').value.trim() };
      if (datos.devTipo === 'NC' && !datos.ncNumero) { mostrarMensaje('Escriba el N° de la nota de crédito.', 'error'); return; }
      if (datos.devTipo === 'DEPOSITO' && !datos.depFecha) { mostrarMensaje('Escriba la fecha del depósito.', 'error'); return; }
      if (!confirm('¿Registrar el endoso de ' + (datos.placa || '?') + ' al ' + (datos.fechaBaja || '?') + '?')) return;
      const b = this; b.disabled = true;
      const r = await llamarBackend('polizasEndoso', datos);
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo registrar.', 'error'); b.disabled = false; return; }
      w.cerrar(); if (wFicha) wFicha.cerrar(); mostrarMensaje(r.mensaje, 'exito'); self._recargar();
    });
  },

  /* ---------------- Devolución de un endoso: depósito o nota de crédito ---------------- */
  _txtDev: function (x, e) {
    const mo = this._mon(x.moneda);
    if (e.deposito && e.tipoDev === 'DEPOSITO') return '<b>Depósito</b><div style="color:#64748b">' + esc(e.deposito.fecha || '') + (e.deposito.banco ? ' · ' + esc(e.deposito.banco) : '') + (e.deposito.operacion ? ' · op. ' + esc(e.deposito.operacion) : '') + ' · ' + mo + ' ' + UI120.m(e.deposito.monto) + '</div>';
    if (e.nc) return '<b>NC ' + esc(e.nc.numero) + '</b><div style="color:#64748b">' + esc(e.nc.fecha || '') + ' · ' + mo + ' ' + UI120.m(e.nc.monto) + '</div>' +
      (e.ncUsado > 0 ? '<div style="color:#166534">Usado ' + mo + ' ' + UI120.m(e.ncUsado) + ' · saldo ' + mo + ' ' + UI120.m(e.ncSaldo) + '</div>' : '<div style="color:#166534">Saldo a favor: ' + mo + ' ' + UI120.m(e.nc.monto) + '</div>');
    return '<span style="color:#b45309">Pendiente</span>';
  },

  devolucion: function (x, i, wFicha) {
    const self = this, e = (x.endosos || [])[i]; if (!e) return;
    const mo = self._mon(x.moneda), nc = e.nc || {}, dep = e.deposito || {};
    const tipo0 = e.deposito && e.tipoDev === 'DEPOSITO' ? 'DEPOSITO' : e.nc ? 'NC' : '';
    const usos = (e.ncUsos || []).map(u => 'cuota ' + u.cuota + ' de ' + esc(u.poliza) + ': ' + mo + ' ' + UI120.m(u.monto)).join(' · ');
    const w = UI120.ventana('Devolución del endoso · ' + esc(e.placa), `
      <div class="info"><span>Póliza: <b>${esc(x.nombre)}</b></span><span>Aseguradora: <b>${esc(x.aseguradora || '—')}</b></span><span>Baja: <b>${esc(e.fechaBaja)}</b></span><span>Devolución: <b>${mo} ${UI120.m(e.devolucion)}</b></span></div>
      <div class="g" style="margin-top:10px"><div class="campo" style="grid-column:span 2"><label>¿Cómo se devolvió?</label><select id="dvT"><option value="">Pendiente</option><option value="DEPOSITO">Depósito en nuestra cuenta</option><option value="NC">Nota de crédito (saldo a favor con la aseguradora)</option></select></div></div>
      <div class="g" id="dvDep" style="margin-top:6px">
        <div class="campo"><label>Fecha del depósito</label><input type="date" id="dvDF" value="${self._iso(dep.fecha)}"></div>
        <div class="campo"><label>Banco</label><input id="dvDB" style="text-transform:uppercase" value="${esc(dep.banco || '')}"></div>
        <div class="campo"><label>N° de operación</label><input id="dvDO" style="text-transform:uppercase" value="${esc(dep.operacion || '')}"></div>
        <div class="campo"><label>Monto depositado (${mo})</label><input id="dvDM" inputmode="decimal" value="${dep.monto || e.devolucion || ''}"></div>
      </div>
      <div class="g" id="dvNc" style="margin-top:6px">
        <div class="campo"><label>N° nota de crédito</label><input id="ncN" style="text-transform:uppercase" value="${esc(nc.numero || '')}"></div>
        <div class="campo"><label>Fecha</label><input type="date" id="ncF" value="${self._iso(nc.fecha)}"></div>
        <div class="campo"><label>Monto (${mo})</label><input id="ncM" inputmode="decimal" value="${nc.numero ? nc.monto : e.devolucion}"></div>
      </div>
      ${usos ? '<div class="nota" style="color:#166534">Ya usada en: ' + usos + '</div>' : ''}
      <div class="nota">La nota de crédito no se resta de esta póliza: queda como saldo a favor con ${esc(x.aseguradora || 'la aseguradora')} y se usa en las cuotas de otra póliza de la misma aseguradora y moneda.</div>
      <div class="pie"><button class="boton-secundario" data-c>Cancelar</button><button class="boton-primario" data-ok>Guardar</button></div>`, 700);
    const ver = () => { const t = w.q('#dvT').value; w.q('#dvDep').style.display = t === 'DEPOSITO' ? '' : 'none'; w.q('#dvNc').style.display = t === 'NC' ? '' : 'none'; };
    w.q('#dvT').value = tipo0; ver(); w.q('#dvT').addEventListener('change', ver);
    w.q('[data-c]').addEventListener('click', w.cerrar);
    w.q('[data-ok]').addEventListener('click', async function () {
      const t = w.q('#dvT').value, datos = { id: x.id, idx: i, tipo: t || 'PENDIENTE' };
      if (t === 'NC') {
        datos.numero = w.q('#ncN').value.trim().toUpperCase(); datos.fecha = self._dmy(w.q('#ncF').value); datos.monto = UI120.n(w.q('#ncM').value);
        if (!datos.numero) { mostrarMensaje('Escriba el N° de la nota de crédito.', 'error'); return; }
        if (!(datos.monto > 0)) { mostrarMensaje('El monto debe ser mayor que 0.', 'error'); return; }
      } else if (t === 'DEPOSITO') {
        datos.fecha = self._dmy(w.q('#dvDF').value); datos.banco = w.q('#dvDB').value.trim(); datos.operacion = w.q('#dvDO').value.trim(); datos.monto = UI120.n(w.q('#dvDM').value);
        if (!datos.fecha) { mostrarMensaje('Escriba la fecha del depósito.', 'error'); return; }
        if (!(datos.monto > 0)) { mostrarMensaje('Escriba el monto depositado.', 'error'); return; }
      } else if (tipo0 && !confirm('¿Dejar la devolución como pendiente?')) return;
      const b = this; b.disabled = true;
      const r = await llamarBackend('polizasEndosoNC', datos);
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo guardar.', 'error'); b.disabled = false; return; }
      w.cerrar(); if (wFicha) wFicha.cerrar(); mostrarMensaje(r.mensaje, 'exito'); self._recargar();
    });
  },

  /** Saldo a favor: todas las notas de crédito con lo usado y lo que queda. */
  _verNotas: function () {
    const self = this;
    const L = (self._datos.notasCredito || []).slice().sort((a, b) => (b.saldo > 0) - (a.saldo > 0) || a.aseguradora.localeCompare(b.aseguradora));
    const fav = self._datos.saldoFavor || [];
    const w = UI120.ventana('Saldo a favor · notas de crédito',
      (fav.length ? '<div class="info" style="background:#f0fdf4">' + fav.map(f => '<span>' + esc(f.aseguradora || 'SIN ASEGURADORA') + ': <b>' + self._mon(f.moneda) + ' ' + UI120.m(f.saldo) + '</b> (' + f.notas + ' nota' + (f.notas > 1 ? 's' : '') + ')</span>').join('') + '</div>'
        : '<div class="info"><span>No hay saldo a favor.</span></div>') +
      (L.length ? '<table style="margin-top:10px"><thead><tr><th>Aseguradora</th><th>Nota de crédito</th><th>Sale de</th><th>Monto</th><th>Usado</th><th>Saldo</th><th>Usada en</th></tr></thead><tbody>' +
        L.map(n => '<tr><td>' + esc(n.aseguradora) + '</td><td><b>' + esc(n.numero) + '</b><div style="color:#64748b">' + esc(n.fecha || '') + '</div></td><td>' + esc(n.poliza) + (n.placa ? '<div style="color:#64748b">' + esc(n.placa) + '</div>' : '') + '</td>' +
          '<td>' + self._mon(n.moneda) + ' ' + UI120.m(n.monto) + '</td><td>' + UI120.m(n.usado) + '</td><td><b style="color:' + (n.saldo > 0 ? '#166534' : '#94a3b8') + '">' + UI120.m(n.saldo) + '</b></td>' +
          '<td style="font-size:.72rem">' + (n.usos.length ? n.usos.map(u => esc(u.poliza) + ' · cuota ' + u.cuota + ': ' + UI120.m(u.monto)).join('<br>') : '<span style="color:#94a3b8">Sin usar</span>') + '</td></tr>').join('') + '</tbody></table>'
        : '<p style="color:#64748b">Aún no hay notas de crédito. Se registran en el endoso de una póliza (columna "Cómo se devolvió").</p>') +
      '<div class="nota">Para usar el saldo: abra (o cree) una póliza de la misma aseguradora y moneda y, en cada cuota, elija la nota en "Pagar con nota de crédito" con el monto que quiera.</div>' +
      '<div class="pie"><button class="boton-secundario" data-c>Cerrar</button></div>', 980);
    w.q('[data-c]').addEventListener('click', w.cerrar);
  },

  _recargar: function () { this._forzar = true; if (this._cont && document.body.contains(this._cont)) this.render(this._cont); },

  /* ---------------- Exportar / copiar ---------------- */
  _filasExport: function () {
    const ed = this._datos.editor, L = this._vis(), self = this, out = [];
    const enc = ed ? ['PÓLIZA', 'TIPO', 'ASEGURADORA', 'N° PÓLIZA', 'MONEDA', 'PRIMA ANUAL', 'INICIO', 'FIN', 'ESTADO', 'PLACAS', 'CUOTA', 'N° LIQUIDACIÓN', 'MONTO', 'VENCE', 'FECHA DE PAGO', 'ESTADO CUOTA', 'PAGADO CON NC', 'N° NC']
      : ['PÓLIZA', 'TIPO', 'ASEGURADORA', 'N° PÓLIZA', 'FIN', 'ESTADO', 'ADJUNTO'];
    L.forEach(x => {
      const est = x.estado !== 'ACTIVA' ? 'DE BAJA' : x.diasFin === null ? 'SIN FECHA' : x.diasFin < 0 ? 'VENCIDA' : x.diasFin <= self._datos.diasAviso ? 'POR VENCER' : 'VIGENTE';
      if (!ed) { out.push([x.nombre, x.tipo, x.aseguradora, x.numero, x.fin, est, x.archivoUrl]); return; }
      const base = [x.nombre, x.tipo, x.aseguradora, x.numero, x.moneda === 'PEN' ? 'S/' : 'US$', x.prima || '', x.inicio, x.fin, est, x.placas];
      if (!x.cuotas.length) out.push(base.concat(['', '', '', '', '', '', '', '']));
      else x.cuotas.forEach(c => out.push(base.concat([c.n, c.liquidacion, Number(c.monto) || 0, c.vence, c.pago, c.estado, Number(c.ncMonto) > 0 ? Number(c.ncMonto) : '', c.ncNumero || ''])));
    });
    return { enc: enc, filas: out };
  },

  _excel: async function () {
    const d = this._filasExport();
    if (!window.XLSX) {
      await new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = mal; document.head.appendChild(s); })
        .catch(() => null);
    }
    if (!window.XLSX) { mostrarMensaje('No se pudo cargar el generador de Excel. Use "Copiar para Excel".', 'error'); return; }
    const ws = XLSX.utils.aoa_to_sheet([d.enc].concat(d.filas));
    ws['!cols'] = d.enc.map((h, i) => ({ wch: [26, 12, 20, 16].indexOf(i) >= 0 ? [26, 12, 20, 16][i] : Math.max(10, h.length + 2) }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: d.filas.length, c: d.enc.length - 1 } }) };
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Pólizas y cuotas');
    const hoy = new Date();
    XLSX.writeFile(wb, 'POLIZAS ' + String(hoy.getDate()).padStart(2, '0') + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + hoy.getFullYear() + '.xlsx');
  },

  _copiar: async function () {
    const d = this._filasExport();
    const th = 'style="background:#bcd3ee;border:1px solid #7f9cc0;padding:4px 6px;font-family:Calibri,Arial;font-size:10pt;font-weight:bold;text-align:center"';
    const td = (v, n) => '<td style="border:1px solid #c9d3df;padding:3px 6px;font-family:Calibri,Arial;font-size:10pt;text-align:' + (n ? 'right' : 'left') + '">' + esc(v === null || v === undefined ? '' : (n && v !== '' ? Number(v).toFixed(2) : v)) + '</td>';
    const numCols = this._datos.editor ? [5, 12, 16] : [];
    const html = '<table style="border-collapse:collapse"><thead><tr>' + d.enc.map(h => '<th ' + th + '>' + h + '</th>').join('') + '</tr></thead><tbody>' +
      d.filas.map(f => '<tr>' + f.map((v, i) => td(v, numCols.indexOf(i) >= 0)).join('') + '</tr>').join('') + '</tbody></table>';
    const tsv = [d.enc].concat(d.filas).map(f => f.map(v => String(v === null || v === undefined ? '' : v).replace(/\t|\n/g, ' ')).join('\t')).join('\n');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([tsv], { type: 'text/plain' }) })]);
      mostrarMensaje('Tabla copiada (' + d.filas.length + ' filas). Péguela en Excel o en el correo.', 'exito');
    } catch (e) {
      const div = document.createElement('div'); div.style.cssText = 'position:fixed;left:-9999px'; div.innerHTML = html; document.body.appendChild(div);
      const rg = document.createRange(); rg.selectNodeContents(div); const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg);
      document.execCommand('copy'); s.removeAllRanges(); div.remove(); mostrarMensaje('Tabla copiada.', 'exito');
    }
  }
};
function sinTildesPz(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-polizas');
  if (b) b.addEventListener('click', function () { FormPolizas.abrir(); });
});
