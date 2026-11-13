/**
 * forms/tramos.js (v120, 13/11/2026)
 * - FormTramos.abrirCambio(servicio, lista, alTerminar): robo/falla/accidente → el viaje sigue con otro
 *   conductor y/o tracto (acción servicioCambioConductor). El viaje mantiene código, BK y una sola factura.
 * - FormTramos.abrir(servicio): tramos del viaje; el tramo interrumpido se liquida aparte (acción tramoGrabar
 *   → fila propia en CONSOLIDADO "<código>-T<n>", aparece en Liquidación de conductores).
 * - FormDescuentos: descuentos al conductor (robo, multa, daño…) en una o varias quincenas.
 */
const UI120 = {
  m: n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  n: v => { const x = parseFloat(String(v === null || v === undefined ? '' : v).replace(',', '.')); return isNaN(x) ? 0 : x; },
  /** Ventana superpuesta. Devuelve {velo, q, cerrar}. */
  ventana: function (titulo, cuerpo, ancho) {
    const velo = document.createElement('div');
    velo.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px';
    velo.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:' + (ancho || 640) + 'px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.25)">' +
      '<div style="background:#1c3a5e;color:#fff;padding:12px 16px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1">' +
      '<b>' + titulo + '</b><button type="button" data-x style="background:none;border:0;color:#fff;font-size:20px;cursor:pointer">×</button></div>' +
      '<div style="padding:14px 16px">' + cuerpo + '</div></div>' +
      '<style>.t120 .campo{margin:0}.t120 .g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px 12px}.t120 .g2{display:grid;grid-template-columns:1fr 1fr;gap:9px 12px}' +
      '.t120 label{font-size:.72rem;font-weight:700;color:#475569;display:block;margin-bottom:2px}.t120 input,.t120 select,.t120 textarea{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #cbd5e1;border-radius:7px;font-size:.84rem;font-family:inherit}' +
      '.t120 .info{background:#f1f5f9;border-radius:9px;padding:8px 10px;font-size:.8rem;color:#334155;display:flex;flex-wrap:wrap;gap:4px 14px}' +
      '.t120 .sub{font-weight:800;color:#1c3a5e;font-size:.82rem;margin:12px 0 6px;text-transform:uppercase;letter-spacing:.03em}' +
      '.t120 .pie{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.t120 .nota{font-size:.75rem;color:#64748b;margin-top:6px}' +
      '.t120 .res{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.t120 .res div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:7px 10px}' +
      '.t120 .res span{display:block;font-size:.66rem;color:#64748b;font-weight:700;text-transform:uppercase}.t120 .res b{font-size:1rem}' +
      '.t120 table{width:100%;border-collapse:collapse;font-size:.8rem}.t120 th{background:#f1f5f9;text-align:left;padding:5px 6px;font-size:.7rem;color:#475569}.t120 td{border-bottom:1px solid #eef2f7;padding:5px 6px;vertical-align:top}' +
      '.t120 .chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:.68rem;font-weight:700}</style>';
    velo.firstElementChild.classList.add('t120');
    document.body.appendChild(velo);
    const cerrar = () => velo.remove();
    velo.querySelector('[data-x]').addEventListener('click', cerrar);
    return { velo: velo, q: s => velo.querySelector(s), cerrar: cerrar };
  },
  hoyIso: function () { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  isoADmy: s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; },
  quincenaDe: function (d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + (d.getDate() <= 15 ? 'Q1' : 'Q2'); },
  qSig: function (q) { const m = String(q).match(/^(\d{4})-(\d{2})-(Q[12])$/); if (!m) return q; if (m[3] === 'Q1') return m[1] + '-' + m[2] + '-Q2'; const d = new Date(Number(m[1]), Number(m[2]), 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-Q1'; },
  qTxt: function (q) {
    const m = String(q || '').match(/^(\d{4})-(\d{2})-(Q[12])$/); if (!m) return q || '';
    const mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'][Number(m[2]) - 1];
    return (m[3] === 'Q1' ? '01-15 ' : '16-' + new Date(Number(m[1]), Number(m[2]), 0).getDate() + ' ') + mes + ' ' + m[1];
  }
};

const FormTramos = {
  MOTIVOS: ['ROBO', 'ASALTO', 'FALLA MECANICA', 'ACCIDENTE', 'SALUD DEL CONDUCTOR', 'OTRO'],

  abrirCambio: function (f, lista, alTerminar) {
    const uniq = k => Array.from(new Set((lista || []).map(x => String(x[k] || '').trim().toUpperCase()).filter(v => v && v !== '-'))).sort();
    const opts = arr => arr.map(v => '<option value="' + esc(v) + '">').join('');
    let tramos = []; try { tramos = JSON.parse(String(f['TRAMOS'] || '[]')) || []; } catch (e) { tramos = []; }
    const w = UI120.ventana('🔁 Cambio de conductor / tracto', `
      <div class="info"><span>Cliente: <b>${esc(f['CLIENTE PARA FACTURACIÓN'] || '')}</b></span><span>BK: <b>${esc(f['BOOKING'] || '')}</b></span>
        <span>Código: <b>${esc(f['CODIGO SERVICIO'] || '')}</b></span><span>Destino: <b>${esc(f['DESTINO 1'] || '')}</b></span></div>
      <div class="info" style="margin-top:8px;background:#fef2f2"><span>Tramo actual${tramos.length ? ' (' + tramos.length + ')' : ''}: <b>${esc(f['CONDUCTOR'] || '')}</b> · tracto <b>${esc(f['PLACA TRACTO'] || '')}</b> · carreta <b>${esc(f['PLACA CARRETA'] || '')}</b></span></div>
      <div class="sub">Qué pasó</div>
      <div class="g">
        <div class="campo"><label>Motivo</label><select id="tcMot">${this.MOTIVOS.map(m => '<option>' + m + '</option>').join('')}</select></div>
        <div class="campo"><label>Fecha del cambio</label><input type="date" id="tcFecha" value="${UI120.hoyIso()}"></div>
        <div class="campo"><label>Hora</label><input type="time" id="tcHora"></div>
        <div class="campo"><label>KM del tracto al momento</label><input id="tcKm" inputmode="decimal" placeholder="Opcional"></div>
        <div class="campo"><label>N° de denuncia / referencia</label><input id="tcDen" placeholder="Opcional" style="text-transform:uppercase"></div>
        <div class="campo"><label>Detalle</label><input id="tcDet" placeholder="Qué ocurrió (obligatorio si es Otro)"></div>
      </div>
      <div class="sub">Sigue el viaje con</div>
      <div class="g">
        <div class="campo"><label>Nuevo conductor</label><input id="tcCond" list="tcLCond" autocomplete="off" style="text-transform:uppercase"><datalist id="tcLCond">${opts(uniq('CONDUCTOR'))}</datalist></div>
        <div class="campo"><label>Tracto</label><input id="tcTra" list="tcLTra" autocomplete="off" value="${esc(f['PLACA TRACTO'] || '')}" style="text-transform:uppercase"><datalist id="tcLTra">${opts(uniq('PLACA TRACTO'))}</datalist></div>
        <div class="campo"><label>Carreta</label><input id="tcCar" list="tcLCar" autocomplete="off" value="${esc(f['PLACA CARRETA'] || '')}" style="text-transform:uppercase"><datalist id="tcLCar">${opts(uniq('PLACA CARRETA'))}</datalist></div>
      </div>
      <div class="nota">El viaje mantiene su código, BK y una sola factura al cliente. Los depósitos que recibió hasta ahora el conductor actual quedan en su tramo; los nuevos depósitos serán del nuevo conductor.
        Luego use <b>🧾 Tramos</b> para liquidar el tramo interrumpido y, si corresponde, registrar el descuento al conductor.</div>
      <div class="pie"><button class="boton-secundario" data-c>Cancelar</button><button class="boton-primario" data-ok>Registrar cambio</button></div>`, 680);
    w.q('[data-c]').addEventListener('click', w.cerrar);
    w.q('[data-ok]').addEventListener('click', async function () {
      const datos = {
        fila: f._fila, codigo: f['CODIGO SERVICIO'] || '', motivo: w.q('#tcMot').value, fecha: UI120.isoADmy(w.q('#tcFecha').value), hora: w.q('#tcHora').value,
        km: w.q('#tcKm').value.trim(), denuncia: w.q('#tcDen').value.trim().toUpperCase(), detalle: w.q('#tcDet').value.trim(),
        conductor: w.q('#tcCond').value.trim().toUpperCase(), tracto: w.q('#tcTra').value.trim().toUpperCase(), carreta: w.q('#tcCar').value.trim().toUpperCase()
      };
      if (!datos.conductor) { mostrarMensaje('Escriba o elija el nuevo conductor.', 'error'); return; }
      if (!confirm('¿Registrar el cambio?\n\nTramo que se cierra: ' + (f['CONDUCTOR'] || '') + ' (' + (f['PLACA TRACTO'] || '') + ')\nSigue con: ' + datos.conductor + ' (' + datos.tracto + ')\nMotivo: ' + datos.motivo)) return;
      const b = this; b.disabled = true; b.textContent = 'Guardando…';
      try {
        const r = await llamarBackend('servicioCambioConductor', datos);
        if (!r || !r.ok) throw new Error((r && r.mensaje) || 'No se pudo registrar.');
        w.cerrar(); mostrarMensaje(r.mensaje, 'exito');
        if (alTerminar) alTerminar();
      } catch (e) { mostrarMensaje(e.message || String(e), 'error'); b.disabled = false; b.textContent = 'Registrar cambio'; }
    });
  },

  abrir: async function (f) {
    const w = UI120.ventana('🧾 Tramos del viaje · ' + esc(f['CODIGO SERVICIO'] || ''), '<div id="trCuerpo" style="color:#64748b">Cargando…</div>', 860);
    let r;
    try { r = await llamarBackend('tramosDatos', { fila: f._fila, codigo: f['CODIGO SERVICIO'] || '' }); } catch (e) { r = null; }
    const c = w.q('#trCuerpo');
    if (!r || !r.ok) { c.textContent = (r && r.mensaje) || 'No se pudo cargar.'; return; }
    if (!r.tramos.length) { c.innerHTML = 'Este viaje no tiene cambio de conductor ni de tracto. Para registrarlo use <b>🔁 Cambio de conductor / tracto</b>.'; return; }
    const self = this;
    c.innerHTML = '<div class="info"><span>Cliente: <b>' + esc(r.cliente) + '</b></span><span>BK: <b>' + esc(r.booking) + '</b></span><span>Destino: <b>' + esc(r.destino) + '</b></span><span>Fecha: <b>' + esc(r.fechaServicio) + '</b></span><span>Estado: <b>' + esc(r.estado) + '</b></span></div>' +
      '<table style="margin-top:10px"><thead><tr><th>Tramo</th><th>Conductor</th><th>Tracto / carreta</th><th>Desde → hasta</th><th>Motivo del cambio</th><th>Liquidación</th></tr></thead><tbody>' +
      r.tramos.map(t => '<tr><td><b>' + t.n + '</b></td><td>' + esc(t.conductor) + '</td><td>' + esc(t.tracto) + '<div style="color:#64748b">' + esc(t.carreta || '') + '</div></td>' +
        '<td>' + esc(t.inicio || 'inicio del viaje') + ' → ' + esc(t.fin || 'en curso') + '</td><td>' + (t.fin ? '<b>' + esc(t.motivo) + '</b>' + (t.denuncia ? '<div style="color:#64748b">Denuncia ' + esc(t.denuncia) + '</div>' : '') + (t.detalle ? '<div style="color:#64748b">' + esc(t.detalle) + '</div>' : '') : '') + '</td>' +
        '<td>' + (t.fin ? (t.consolidado ? '<span class="chip" style="background:#dcfce7;color:#166534">Liquidado</span> ' : '<span class="chip" style="background:#fef3c7;color:#92400e">Por liquidar</span> ') +
          '<button class="boton-secundario" style="padding:3px 8px;font-size:.74rem" data-liq="' + t.n + '">' + (t.consolidado ? 'Revisar' : 'Liquidar') + '</button> ' +
          '<button class="boton-secundario" style="padding:3px 8px;font-size:.74rem" data-desc="' + t.n + '">Descuento</button>'
          : '<span style="color:#64748b">Se liquida con el Consolidado del viaje</span>') + '</td></tr>').join('') + '</tbody></table>' +
      '<div class="nota">El tramo interrumpido se liquida aquí (gastos hasta el cambio vs. lo que se le depositó) y aparece en <b>Liquidación de conductores</b>. El último tramo se cierra con el Consolidado del viaje, que ya no cuenta los depósitos del tramo anterior.</div>';
    c.querySelectorAll('[data-liq]').forEach(b => b.addEventListener('click', () => self._liquidar(f, r, r.tramos.filter(t => String(t.n) === b.dataset.liq)[0], w)));
    c.querySelectorAll('[data-desc]').forEach(b => b.addEventListener('click', function () {
      const t = r.tramos.filter(x => String(x.n) === b.dataset.desc)[0];
      FormDescuentos.nuevo({ conductor: t.conductor, motivo: t.motivo === 'ROBO' || t.motivo === 'ASALTO' ? 'ROBO' : 'OTRO', codigo: r.codigo, referencia: t.denuncia ? 'DENUNCIA ' + t.denuncia : '', detalle: 'Tramo ' + t.n + ' del viaje ' + r.codigo + ' (' + t.motivo + ')' });
    }));
  },

  _liquidar: function (f, r, t, wPadre) {
    const d = (t.consolidado && t.consolidado.datos) || {};
    const v = (k, def) => d[k] !== undefined && d[k] !== '' ? d[k] : (def === undefined ? '' : def);
    const campos = [['viatico', 'Viático', 'VIATICO'], ['peaje', 'Peaje', 'PEAJE'], ['peajeSdcf', 'Peaje S.D.C.F.', 'PEAJE S.D.C.F.'], ['peajeAdicional', 'Peaje adicional', 'PEAJE ADICIONAL'],
      ['llanta', 'Llanta', 'LLANTA'], ['cochera', 'Cochera', 'COCHERA'], ['lavado', 'Lavado', 'LAVADO'], ['otros', 'Otros', 'OTROS'], ['bono', 'Bono', 'BONO']];
    const deps = (r.depositos || []).filter(x => (t.depIds || []).indexOf(x.id) >= 0);
    const w = UI120.ventana('Liquidar tramo ' + t.n + ' · ' + esc(t.conductor), `
      <div class="info"><span>Conductor: <b>${esc(t.conductor)}</b></span><span>Tracto: <b>${esc(t.tracto)}</b></span><span>Hasta: <b>${esc(t.fin)}</b></span><span>Motivo: <b>${esc(t.motivo)}</b>${t.denuncia ? ' · denuncia ' + esc(t.denuncia) : ''}</span></div>
      <div class="sub">Lo que se le depositó</div>
      <div class="g">
        <div class="campo"><label>Monto depositado (viaje)</label><input id="lt_depositado" inputmode="decimal" value="${esc(v('MONTO DEPOSITADO', t.depositado || 0))}"></div>
        <div class="campo"><label>Depósitos adicionales</label><input id="lt_extras" inputmode="decimal" value="${esc(v('DEPOSITOS ADICIONALES', t.extras || 0))}"></div>
        <div class="campo"><label>N° de viático</label><input id="lt_nv" value="${esc(v('N° DE VIÁTICO'))}"></div>
      </div>
      ${deps.length ? '<div class="nota">Adicionales de este tramo: ' + deps.map(x => esc(x.motivo) + ' S/ ' + UI120.m(x.monto)).join(' · ') + '</div>' : ''}
      <div class="sub">Gastos sustentados hasta el cambio</div>
      <div class="g">${campos.map(c => '<div class="campo"><label>' + c[1] + '</label><input id="lt_' + c[0] + '" inputmode="decimal" value="' + esc(v(c[2], '')) + '"></div>').join('')}</div>
      <div class="g2" style="margin-top:9px">
        <div class="campo"><label>Motivo de "Otros"</label><input id="lt_motivoOtros" value="${esc(v('MOTIVO OTROS'))}"></div>
        <div class="campo"><label>Observación</label><input id="lt_obs" placeholder="Opcional"></div>
        <div class="campo"><label>KM inicial</label><input id="lt_kmI" inputmode="decimal" value="${esc(v('KM INICIAL', t.kmInicio || ''))}"></div>
        <div class="campo"><label>KM final (al cambio)</label><input id="lt_kmF" inputmode="decimal" value="${esc(v('KM FINAL', t.kmFin || ''))}"></div>
      </div>
      <div class="res" id="lt_res"></div>
      <div class="nota">Si el conductor debe devolver dinero o se le descontará lo robado, regístrelo con <b>Descuento</b> (una sola vez o en cuotas por quincena).</div>
      <div class="pie"><button class="boton-secundario" data-c>Cancelar</button><button class="boton-primario" data-ok>Guardar liquidación del tramo</button></div>`, 760);
    const calc = function () {
      const g = campos.reduce((a, c) => a + UI120.n(w.q('#lt_' + c[0]).value), 0);
      const dep = UI120.n(w.q('#lt_depositado').value) + UI120.n(w.q('#lt_extras').value);
      const s = Math.round((g - dep) * 100) / 100;
      w.q('#lt_res').innerHTML = '<div><span>Gastos</span><b>S/ ' + UI120.m(g) + '</b></div><div><span>Depositado</span><b>S/ ' + UI120.m(dep) + '</b></div>' +
        '<div style="background:' + (s < 0 ? '#fef2f2' : s > 0 ? '#fff7ed' : '#f0fdf4') + '"><span>' + (s < 0 ? 'Conductor devuelve' : s > 0 ? 'Reintegrar al conductor' : 'Cuadrado') + '</span><b>S/ ' + UI120.m(Math.abs(s)) + '</b></div>';
    };
    w.velo.querySelectorAll('input').forEach(i => i.addEventListener('input', calc)); calc();
    w.q('[data-c]').addEventListener('click', w.cerrar);
    w.q('[data-ok]').addEventListener('click', async function () {
      const datos = { fila: f._fila, codigo: r.codigo, n: t.n, depositado: w.q('#lt_depositado').value, extras: w.q('#lt_extras').value, nViatico: w.q('#lt_nv').value,
        motivoOtros: w.q('#lt_motivoOtros').value, observacion: w.q('#lt_obs').value, kmInicial: w.q('#lt_kmI').value.trim(), kmFinal: w.q('#lt_kmF').value.trim() };
      campos.forEach(c => { datos[c[0]] = w.q('#lt_' + c[0]).value; });
      const b = this; b.disabled = true; b.textContent = 'Guardando…';
      try {
        const res = await llamarBackend('tramoGrabar', datos);
        if (!res || !res.ok) throw new Error((res && res.mensaje) || 'No se pudo guardar.');
        w.cerrar(); wPadre.cerrar(); mostrarMensaje(res.mensaje, 'exito'); FormTramos.abrir(f);
      } catch (e) { mostrarMensaje(e.message || String(e), 'error'); b.disabled = false; b.textContent = 'Guardar liquidación del tramo'; }
    });
  }
};

const FormDescuentos = {
  MOTIVOS: ['ROBO', 'MULTA', 'DAÑO A LA UNIDAD', 'FALTANTE DE DINERO', 'COMBUSTIBLE', 'OTRO'],
  _conductores: null,

  _listaConductores: async function () {
    if (this._conductores) return this._conductores;
    let l = [];
    try { const r = await llamarBackend('liqDatos', {}); l = Array.from(new Set(((r && r.filas) || []).map(f => f.conductor).filter(Boolean))).sort(); } catch (e) { l = []; }
    this._conductores = l; return l;
  },

  /** Cuotas pendientes (no anuladas) por conductor|quincena → [{id, monto, motivo}] (lo usa Liquidación). */
  porQuincena: function (items) {
    const m = {};
    (items || []).filter(x => x.estado !== 'ANULADO').forEach(x => (x.cuotas || []).forEach(q => {
      const k = x.conductor + '|' + q.quincena; (m[k] = m[k] || []).push({ id: x.id, monto: Number(q.monto) || 0, motivo: x.motivo, detalle: x.detalle, liq: q.liq });
    }));
    return m;
  },

  abrir: async function () {
    const self = this;
    const html = `
      <style>
        .ds-barra{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:end;margin-bottom:10px}.ds-barra .campo{margin:0;min-width:160px}
        .ds-k{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:10px}.ds-k div{background:#f1f5f9;border-radius:10px;padding:8px 12px;border-left:4px solid #94a3b8}
        .ds-k span{display:block;font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase}.ds-k b{font-size:1.15rem;color:#1c3a5e}
        .ds-t{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.78rem}.ds-t th{background:#e2e8f0;padding:6px;text-align:left;font-size:.7rem;position:sticky;top:0}
        .ds-t td{padding:6px;border-bottom:1px solid #eef2f7;vertical-align:top;overflow-wrap:anywhere}.ds-t tr.anul td{color:#94a3b8;text-decoration:line-through}
        .ds-chip{display:inline-block;border-radius:999px;padding:1px 7px;font-size:.66rem;font-weight:700;margin:1px;background:#fef3c7;color:#92400e}
        .ds-chip.ok{background:#dcfce7;color:#166534}.ds-chip.lq{background:#dbeafe;color:#1e40af}
        .ds-wrap{max-height:calc(74vh - 230px);overflow:auto;border:1px solid #e2e8f0;border-radius:10px}
      </style>
      <div class="ds-barra">
        <div class="campo"><label>Conductor</label><select id="dsCond"><option value="">Todos</option></select></div>
        <div class="campo"><label>Estado</label><select id="dsEst"><option value="PEND">Con cuotas pendientes</option><option value="">Todos</option><option value="ANULADO">Anulados</option></select></div>
        <button class="boton-primario" id="dsNuevo">+ Nuevo descuento</button>
      </div>
      <div class="ds-k" id="dsK"></div>
      <div class="ds-wrap"><table class="ds-t"><colgroup><col style="width:11%"><col style="width:19%"><col style="width:11%"><col><col style="width:9%"><col style="width:22%"><col style="width:9%"></colgroup>
        <thead><tr><th>Fecha</th><th>Conductor</th><th>Motivo</th><th>Detalle</th><th>Monto</th><th>Cuotas por quincena</th><th></th></tr></thead><tbody id="dsTb"><tr><td colspan="7">Cargando…</td></tr></tbody></table></div>
      <div class="nota" style="font-size:.75rem;color:#64748b;margin-top:8px">Cada cuota se resta en la <b>Liquidación de conductores</b> de su quincena (columna Descuentos → A pagar). Azul = la quincena ya fue liquidada; verde = depositada.</div>
      <div class="panel-footer" style="padding-top:10px"><button class="boton-secundario" id="dsCerrar">Cerrar</button></div>`;
    abrirPanel('Descuentos al conductor', html, async function (raiz) {
      self._raiz = raiz;
      raiz.querySelector('#dsCerrar').addEventListener('click', cerrarPanel);
      raiz.querySelector('#dsNuevo').addEventListener('click', () => self.nuevo({}));
      ['dsCond', 'dsEst'].forEach(id => raiz.querySelector('#' + id).addEventListener('change', () => self._pintar()));
      await self._cargar();
    }, { ancho: true });
  },

  _cargar: async function () {
    const r = await llamarBackend('descuentosListar', {});
    if (!r || !r.ok) { if (this._raiz) this._raiz.querySelector('#dsTb').innerHTML = '<tr><td colspan="7">' + esc((r && r.mensaje) || 'No se pudo cargar.') + '</td></tr>'; return; }
    this._items = r.items; this._puede = r.puedeEditar;
    if (!this._raiz || !document.body.contains(this._raiz)) return;
    const sel = this._raiz.querySelector('#dsCond'), v = sel.value;
    sel.innerHTML = '<option value="">Todos</option>' + Array.from(new Set(r.items.map(x => x.conductor))).sort().map(c => '<option>' + esc(c) + '</option>').join('');
    sel.value = v; this._raiz.querySelector('#dsNuevo').style.display = r.puedeEditar ? '' : 'none';
    this._pintar();
  },

  _pintar: function () {
    const self = this, raiz = self._raiz, c = raiz.querySelector('#dsCond').value, e = raiz.querySelector('#dsEst').value;
    const pend = x => x.estado !== 'ANULADO' && (x.cuotas || []).some(q => q.liq !== 'DEPOSITADO');
    const L = (self._items || []).filter(x => (!c || x.conductor === c) && (e === 'PEND' ? pend(x) : e === 'ANULADO' ? x.estado === 'ANULADO' : true))
      .sort((a, b) => String(b.fecha).split(' ')[0].split('/').reverse().join('').localeCompare(String(a.fecha).split(' ')[0].split('/').reverse().join('')));
    const act = (self._items || []).filter(x => x.estado !== 'ANULADO' && (!c || x.conductor === c));
    const saldo = act.reduce((a, x) => a + (x.cuotas || []).filter(q => q.liq !== 'DEPOSITADO').reduce((s, q) => s + (Number(q.monto) || 0), 0), 0);
    raiz.querySelector('#dsK').innerHTML = '<div><span>Descuentos activos</span><b>' + act.length + '</b></div><div><span>Total registrado</span><b>S/ ' + UI120.m(act.reduce((a, x) => a + x.monto, 0)) + '</b></div>' +
      '<div style="border-left-color:#dc2626"><span>Saldo por descontar</span><b>S/ ' + UI120.m(saldo) + '</b></div>';
    raiz.querySelector('#dsTb').innerHTML = L.length ? L.map(x => '<tr class="' + (x.estado === 'ANULADO' ? 'anul' : '') + '"><td>' + esc(x.fecha) + '</td><td><b>' + esc(x.conductor) + '</b></td><td>' + esc(x.motivo) + '</td>' +
      '<td>' + esc(x.detalle) + (x.referencia ? '<div style="color:#64748b">' + esc(x.referencia) + '</div>' : '') + (x.codigo ? '<div style="color:#64748b">Viaje ' + esc(x.codigo) + '</div>' : '') +
      (x.estado === 'ANULADO' ? '<div style="color:#b91c1c;text-decoration:none">Anulado: ' + esc(x.motivoAnulacion) + '</div>' : '') + '<div style="color:#94a3b8;font-size:.68rem">' + esc(x.por) + '</div></td>' +
      '<td><b>S/ ' + UI120.m(x.monto) + '</b></td><td>' + (x.cuotas || []).map(q => '<span class="ds-chip ' + (q.liq === 'DEPOSITADO' ? 'ok' : q.liq === 'LIQUIDADO' ? 'lq' : '') + '">' + UI120.qTxt(q.quincena) + ' · S/ ' + UI120.m(q.monto) + '</span>').join('') + '</td>' +
      '<td>' + (self._puede && x.estado !== 'ANULADO' ? '<button class="boton-secundario" style="padding:3px 8px;font-size:.72rem" data-anular="' + x.id + '">Anular</button>' : '') + '</td></tr>').join('')
      : '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:14px">Sin descuentos con estos filtros.</td></tr>';
    raiz.querySelectorAll('[data-anular]').forEach(b => b.addEventListener('click', async function () {
      const motivo = prompt('Motivo de la anulación:'); if (!motivo || !motivo.trim()) return;
      const r = await llamarBackend('descuentosAnular', { id: b.dataset.anular, motivo: motivo.trim() });
      mostrarMensaje((r && r.mensaje) || 'Error', r && r.ok ? 'exito' : 'error'); if (r && r.ok) self._cargar();
    }));
  },

  nuevo: async function (pre) {
    pre = pre || {};
    const self = this;
    const conds = await self._listaConductores();
    const q0 = UI120.quincenaDe(new Date());
    const qs = []; let q = q0; for (let i = 0; i < 12; i++) { qs.push(q); q = UI120.qSig(q); }
    const w = UI120.ventana('Nuevo descuento al conductor', `
      <div class="g">
        <div class="campo" style="grid-column:span 2"><label>Conductor</label><input id="dnCond" list="dnLC" autocomplete="off" value="${esc(pre.conductor || '')}" style="text-transform:uppercase"><datalist id="dnLC">${conds.map(c => '<option value="' + esc(c) + '">').join('')}</datalist></div>
        <div class="campo"><label>Motivo</label><select id="dnMot">${self.MOTIVOS.map(m => '<option' + (m === pre.motivo ? ' selected' : '') + '>' + m + '</option>').join('')}</select></div>
        <div class="campo" style="grid-column:1/-1"><label>Detalle (qué se descuenta)</label><input id="dnDet" value="${esc(pre.detalle || '')}" placeholder="Ej. Dinero del viático robado, multa de tránsito…"></div>
        <div class="campo"><label>Referencia</label><input id="dnRef" value="${esc(pre.referencia || '')}" placeholder="N° de denuncia, papeleta…"></div>
        <div class="campo"><label>Código del viaje</label><input id="dnCod" value="${esc(pre.codigo || '')}" placeholder="Opcional" style="text-transform:uppercase"></div>
        <div class="campo"><label>Monto total (S/)</label><input id="dnMonto" inputmode="decimal"></div>
      </div>
      <div class="sub">Cómo se descuenta</div>
      <div class="g">
        <div class="campo"><label>Modalidad</label><select id="dnMod"><option value="1">Una sola vez</option><option value="C">En cuotas</option></select></div>
        <div class="campo"><label>Desde la quincena</label><select id="dnQ">${qs.map(x => '<option value="' + x + '">' + UI120.qTxt(x) + '</option>').join('')}</select></div>
        <div class="campo"><label>N° de cuotas</label><input id="dnN" type="number" min="1" max="24" value="1" disabled></div>
      </div>
      <table style="margin-top:10px"><thead><tr><th>Quincena</th><th style="width:40%">Monto de la cuota (S/)</th></tr></thead><tbody id="dnCuotas"></tbody></table>
      <div class="nota" id="dnSuma"></div>
      <div class="pie"><button class="boton-secundario" data-c>Cancelar</button><button class="boton-primario" data-ok>Registrar descuento</button></div>`, 680);
    const armar = function () {
      const cuo = w.q('#dnMod').value === 'C';
      w.q('#dnN').disabled = !cuo; if (!cuo) w.q('#dnN').value = 1;
      const n = Math.max(1, Math.min(24, parseInt(w.q('#dnN').value, 10) || 1)), total = UI120.n(w.q('#dnMonto').value);
      const base = Math.floor(total / n * 100) / 100; let qq = w.q('#dnQ').value, filas = '';
      for (let i = 0; i < n; i++) { const monto = i === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base; filas += '<tr><td data-q="' + qq + '">' + UI120.qTxt(qq) + '</td><td><input class="dnM" inputmode="decimal" value="' + (total ? monto.toFixed(2) : '') + '"></td></tr>'; qq = UI120.qSig(qq); }
      w.q('#dnCuotas').innerHTML = filas;
      w.velo.querySelectorAll('.dnM').forEach(i => i.addEventListener('input', suma)); suma();
    };
    const suma = function () {
      const s = Array.from(w.velo.querySelectorAll('.dnM')).reduce((a, i) => a + UI120.n(i.value), 0), t = UI120.n(w.q('#dnMonto').value);
      w.q('#dnSuma').innerHTML = 'Suma de cuotas: <b>S/ ' + UI120.m(s) + '</b>' + (Math.abs(s - t) > 0.01 ? ' <span style="color:#b91c1c">(no cuadra con el monto S/ ' + UI120.m(t) + ')</span>' : ' ✓');
    };
    ['#dnMod', '#dnQ', '#dnN', '#dnMonto'].forEach(s => { w.q(s).addEventListener('input', armar); w.q(s).addEventListener('change', armar); });
    armar();
    w.q('[data-c]').addEventListener('click', w.cerrar);
    w.q('[data-ok]').addEventListener('click', async function () {
      const cuotas = Array.from(w.q('#dnCuotas').querySelectorAll('tr')).map(tr => ({ quincena: tr.querySelector('[data-q]').dataset.q, monto: UI120.n(tr.querySelector('.dnM').value) }));
      const datos = { conductor: w.q('#dnCond').value.trim().toUpperCase(), motivo: w.q('#dnMot').value, detalle: w.q('#dnDet').value.trim(), referencia: w.q('#dnRef').value.trim(),
        codigo: w.q('#dnCod').value.trim().toUpperCase(), monto: UI120.n(w.q('#dnMonto').value), cuotas: cuotas };
      const b = this; b.disabled = true; b.textContent = 'Guardando…';
      try {
        const r = await llamarBackend('descuentosGrabar', datos);
        if (!r || !r.ok) throw new Error((r && r.mensaje) || 'No se pudo registrar.');
        w.cerrar(); mostrarMensaje(r.mensaje, 'exito');
        if (self._raiz && document.body.contains(self._raiz)) self._cargar();
      } catch (e) { mostrarMensaje(e.message || String(e), 'error'); b.disabled = false; b.textContent = 'Registrar descuento'; }
    });
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-descuentos');
  if (b) b.addEventListener('click', function () { FormDescuentos.abrir(); });
});
