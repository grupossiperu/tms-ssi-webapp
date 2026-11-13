/**
 * forms/polizas.js (v121, 13/11/2026) — Pólizas de seguro.
 * Finanzas → "Pólizas de seguro" (Facturación y Maestro editan) y Documentos → pestaña "Pólizas y seguros"
 * (los demás solo ven nombre, aseguradora, fin y adjunto). Cuotas con N° de liquidación, vencimiento y pago;
 * adjunto en Drive; endoso por venta de unidad (devolución = pagado − prima/365 × días usados; anula cuotas posteriores).
 * Exportar Excel (SheetJS) y "Copiar para Excel" (misma tabla con formato).
 * Usa UI120 (forms/tramos.js) para las ventanas.
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
        .pz-k{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:10px}.pz-k div{background:#f1f5f9;border-radius:10px;padding:8px 12px;border-left:4px solid #94a3b8}
        .pz-k span{display:block;font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase}.pz-k b{font-size:1.1rem;color:#1c3a5e}
        .pz-t{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.78rem}.pz-t th{background:#e2e8f0;padding:6px;text-align:left;font-size:.7rem;position:sticky;top:0}
        .pz-t td{padding:6px;border-bottom:1px solid #eef2f7;vertical-align:top;overflow-wrap:anywhere}.pz-t tbody tr{cursor:pointer}.pz-t tbody tr:hover td{background:#f8fafc}
        .pz-t tr.baja td{color:#94a3b8;text-decoration:line-through}
        .pz-chip{display:inline-block;border-radius:999px;padding:1px 8px;font-size:.68rem;font-weight:700}
        .pz-wrap{max-height:calc(74vh - 250px);overflow:auto;border:1px solid #e2e8f0;border-radius:10px}
      </style>
      <div class="pz-barra">
        <div class="campo"><label>Tipo</label><select id="pzTipo"><option value="">Todos</option>${r.tipos.map(t => '<option>' + t + '</option>').join('')}</select></div>
        <div class="campo"><label>Estado</label><select id="pzEst"><option value="ACTIVA">Activas</option><option value="">Todas</option><option value="ANULADA">Dadas de baja</option></select></div>
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
        '<div style="border-left-color:#2563eb"><span>Saldo por pagar</span><b style="font-size:.95rem">' + porMon('saldo') + '</b></div>';
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
    const w = UI120.ventana(x.id ? 'Póliza · ' + esc(x.nombre) : 'Nueva póliza', `
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
      <table><thead><tr><th style="width:34px">N°</th><th>N° liquidación</th><th style="width:110px">Monto</th><th style="width:140px">Vence</th><th style="width:140px">Fecha de pago</th><th style="width:118px">Estado</th><th style="width:30px"></th></tr></thead><tbody id="pfCuotas"></tbody></table>
      <div class="res" id="pfRes"></div>
      ${x.id ? '<div class="sub">Endosos (venta / baja de unidad)</div>' + (x.endosos.length ? '<table><thead><tr><th>Fecha baja</th><th>Placa</th><th>Días usados</th><th>Usado</th><th>Pagado</th><th>Devolución</th><th>Cuotas anuladas</th><th>Registró</th></tr></thead><tbody>' +
        x.endosos.map(e => '<tr><td>' + esc(e.fechaBaja) + '</td><td>' + esc(e.placa) + '</td><td>' + e.dias + '</td><td>' + UI120.m(e.usado) + '</td><td>' + UI120.m(e.pagado) + '</td><td><b>' + self._mon(x.moneda) + ' ' + UI120.m(e.devolucion) + '</b>' + (e.manual ? ' (manual)' : '') + '</td><td>' + (e.anuladas || []).join(', ') + '</td><td>' + esc(e.por) + '<div style="color:#94a3b8">' + esc(e.registrado) + '</div></td></tr>').join('') + '</tbody></table>' : '<div style="color:#64748b;font-size:.8rem">Sin endosos.</div>') +
        '<button type="button" class="boton-secundario" id="pfEndoso" style="margin-top:6px">Registrar endoso (venta / baja de una unidad)</button>' : ''}
      <div class="pie">
        ${x.id ? '<button class="boton-secundario" id="pfBaja" style="margin-right:auto">' + (x.estado === 'ACTIVA' ? 'Dar de baja la póliza' : 'Reactivar') + '</button>' : ''}
        <button class="boton-secundario" data-c>Cancelar</button><button class="boton-primario" data-ok>Guardar</button></div>`, 920);
    w.q('#pfMon').value = x.moneda || 'USD';
    const tb = w.q('#pfCuotas');
    const fila = function (c) {
      c = c || {};
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="n"></td><td><input class="cl" value="' + esc(c.liquidacion || '') + '" style="text-transform:uppercase"></td><td><input class="cm" inputmode="decimal" value="' + (c.monto || '') + '"></td>' +
        '<td><input type="date" class="cv" value="' + self._iso(c.vence) + '"></td><td><input type="date" class="cp" value="' + self._iso(c.pago) + '"></td>' +
        '<td><select class="ce" style="font-size:.74rem;padding:5px 3px"><option>PENDIENTE</option><option>PAGADA</option><option>ANULADA</option></select>' + (c.nota ? '<div style="font-size:.66rem;color:#64748b">' + esc(c.nota) + '</div>' : '') + '</td><td><button type="button" class="qx" style="border:0;background:none;color:#b91c1c;cursor:pointer;font-size:16px">×</button></td>';
      tr.querySelector('.ce').value = c.estado || 'PENDIENTE';
      tr.querySelector('.cp').addEventListener('change', function () { if (this.value && tr.querySelector('.ce').value === 'PENDIENTE') tr.querySelector('.ce').value = 'PAGADA'; resumen(); });
      tr.querySelector('.qx').addEventListener('click', () => { tr.remove(); numerar(); resumen(); });
      tr.querySelectorAll('input,select').forEach(i => i.addEventListener('input', resumen));
      tb.appendChild(tr); numerar(); return tr;
    };
    const numerar = () => tb.querySelectorAll('tr').forEach((tr, i) => { tr.querySelector('.n').textContent = i + 1; });
    const leer = () => Array.from(tb.querySelectorAll('tr')).map(tr => ({ liquidacion: tr.querySelector('.cl').value.trim(), monto: UI120.n(tr.querySelector('.cm').value),
      vence: self._dmy(tr.querySelector('.cv').value), pago: self._dmy(tr.querySelector('.cp').value), estado: tr.querySelector('.ce').value }));
    const resumen = function () {
      const cs = leer(), mo = self._mon(w.q('#pfMon').value), prima = UI120.n(w.q('#pfPrima').value);
      const tot = cs.filter(c => c.estado !== 'ANULADA').reduce((a, c) => a + c.monto, 0), pag = cs.filter(c => c.estado === 'PAGADA').reduce((a, c) => a + c.monto, 0);
      w.q('#pfRes').innerHTML = '<div><span>Total cuotas</span><b>' + mo + ' ' + UI120.m(tot) + '</b>' + (prima && Math.abs(tot - prima) > 0.01 && cs.length ? '<div style="font-size:.68rem;color:#b45309">Prima anual: ' + mo + ' ' + UI120.m(prima) + '</div>' : '') + '</div>' +
        '<div><span>Pagado</span><b>' + mo + ' ' + UI120.m(pag) + '</b></div><div><span>Saldo</span><b>' + mo + ' ' + UI120.m(tot - pag) + '</b></div>';
    };
    (x.cuotas || []).forEach(fila); resumen();
    ['#pfPrima', '#pfMon'].forEach(s => w.q(s).addEventListener('input', resumen));
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
    if (x.id) {
      w.q('#pfEndoso').addEventListener('click', () => self.endoso(x, w));
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
      const datos = { id: x.id || '', nombre: w.q('#pfNom').value, tipo: w.q('#pfTipo').value, aseguradora: w.q('#pfAseg').value, numero: w.q('#pfNum').value,
        moneda: w.q('#pfMon').value, prima: w.q('#pfPrima').value, inicio: self._dmy(w.q('#pfIni').value), fin: self._dmy(w.q('#pfFin').value),
        placas: w.q('#pfPlacas').value, observacion: w.q('#pfObs').value, cuotas: leer() };
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
      </div>
      <label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:.8rem"><input type="checkbox" id="enAnu" checked style="width:auto"> Anular las cuotas pendientes que vencen después de la fecha de baja</label>
      <div class="res" id="enRes"></div>
      <div class="nota" id="enAnuTxt"></div>
      <div class="nota">Usado = prima anual ÷ 365 × días desde el inicio hasta la baja. Devolución = pagado − usado (si sale negativo, no hay devolución).</div>
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
    w.q('[data-c]').addEventListener('click', w.cerrar);
    w.q('[data-ok]').addEventListener('click', async function () {
      const datos = { id: x.id, placa: w.q('#enPla').value, fechaBaja: self._dmy(w.q('#enFec').value), primaBase: w.q('#enPri').value, pagadoBase: w.q('#enPag').value,
        devolucionManual: w.q('#enMan').value.trim(), anularPosteriores: w.q('#enAnu').checked, observacion: w.q('#enObs').value };
      if (!confirm('¿Registrar el endoso de ' + (datos.placa || '?') + ' al ' + (datos.fechaBaja || '?') + '?')) return;
      const b = this; b.disabled = true;
      const r = await llamarBackend('polizasEndoso', datos);
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo registrar.', 'error'); b.disabled = false; return; }
      w.cerrar(); if (wFicha) wFicha.cerrar(); mostrarMensaje(r.mensaje, 'exito'); self._recargar();
    });
  },

  _recargar: function () { this._forzar = true; if (this._cont && document.body.contains(this._cont)) this.render(this._cont); },

  /* ---------------- Exportar / copiar ---------------- */
  _filasExport: function () {
    const ed = this._datos.editor, L = this._vis(), self = this, out = [];
    const enc = ed ? ['PÓLIZA', 'TIPO', 'ASEGURADORA', 'N° PÓLIZA', 'MONEDA', 'PRIMA ANUAL', 'INICIO', 'FIN', 'ESTADO', 'PLACAS', 'CUOTA', 'N° LIQUIDACIÓN', 'MONTO', 'VENCE', 'FECHA DE PAGO', 'ESTADO CUOTA']
      : ['PÓLIZA', 'TIPO', 'ASEGURADORA', 'N° PÓLIZA', 'FIN', 'ESTADO', 'ADJUNTO'];
    L.forEach(x => {
      const est = x.estado !== 'ACTIVA' ? 'DE BAJA' : x.diasFin === null ? 'SIN FECHA' : x.diasFin < 0 ? 'VENCIDA' : x.diasFin <= self._datos.diasAviso ? 'POR VENCER' : 'VIGENTE';
      if (!ed) { out.push([x.nombre, x.tipo, x.aseguradora, x.numero, x.fin, est, x.archivoUrl]); return; }
      const base = [x.nombre, x.tipo, x.aseguradora, x.numero, x.moneda === 'PEN' ? 'S/' : 'US$', x.prima || '', x.inicio, x.fin, est, x.placas];
      if (!x.cuotas.length) out.push(base.concat(['', '', '', '', '', '']));
      else x.cuotas.forEach(c => out.push(base.concat([c.n, c.liquidacion, Number(c.monto) || 0, c.vence, c.pago, c.estado])));
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
    const numCols = this._datos.editor ? [5, 12] : [];
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
