/**
 * forms/incidencias.js  (v88)
 * -------------------------------------------------------------------------
 * Incidencias de conductores:
 *  - Conductor (rol CONDUCTOR): pantalla completa para el celular. Reporta
 *    una falla en 4 toques (unidad + km → sistema → qué falla → urgencia,
 *    foto y comentario) y ve "Mis reportes".
 *  - Tablero (Mantenimiento, módulos INCV/INCA): incidencias ordenadas por
 *    prioridad (urgencia + repeticiones + días sin atender), programar,
 *    resolver (quién, cuándo, km, trabajo), descartar, reabrir, fotos e
 *    historial; indicadores.
 * Backend: incConfig, incReportar, incMisReportes, incTablero, incFoto,
 * incActualizar.
 * -------------------------------------------------------------------------
 */
const INC_CATALOGO = {
  TRACTO: [
    ['LLANTAS', '🛞', ['LLANTA BAJA / PINCHADA', 'LLANTA GASTADA (CAMBIO)', 'LLANTA REVENTADA', 'PRESIÓN DE AIRE', 'TUERCAS / AROS', 'LLANTA DE REPUESTO']],
    ['FRENOS', '🛑', ['FRENA MAL / REGULACIÓN', 'FUGA DE AIRE', 'COMPRESOR / LÍNEAS DE AIRE', 'RUIDO AL FRENAR', 'SECADOR DE AIRE']],
    ['LUCES / ELÉCTRICO', '💡', ['LUCES QUEMADAS', 'FAROS DELANTEROS', 'BATERÍA / NO ARRANCA', 'TESTIGO CHECK ENGINE', 'TESTIGO ABS', 'CLAXON / ALARMA DE RETROCESO', 'PLUMILLAS / TRICO', 'AIRE ACONDICIONADO']],
    ['MOTOR', '⚙️', ['PIERDE FUERZA', 'FUGA DE ACEITE O FLUIDOS', 'NIVEL DE ACEITE', 'HUMO / ESCAPE', 'FAJAS / POLEAS', 'TURBO', 'COMBUSTIBLE', 'RUIDO RARO']],
    ['TEMPERATURA / AGUA', '🌡️', ['SE CALIENTA', 'FUGA DE AGUA / REFRIGERANTE', 'RADIADOR', 'BOMBA DE AGUA / VENTILADOR']],
    ['CAJA / EMBRAGUE', '🔧', ['EMBRAGUE', 'CAMBIOS DUROS / PALANCA', 'RUIDO EN LA CAJA', 'RUIDO EN CORONAS', 'CARDÁN / CRUCETAS']],
    ['SUSPENSIÓN', '🪜', ['BOLSAS DE AIRE', 'AMORTIGUADORES', 'MUELLES', 'BUJES / ABRAZADERAS']],
    ['DIRECCIÓN', '🎯', ['SE JALA A UN LADO', 'TIMÓN DURO', 'BARRAS / TERMINALES']],
    ['CABINA', '🪑', ['PUERTAS / MANIJAS', 'LUNAS / PARABRISAS', 'ASIENTO', 'CINTURÓN', 'TABLERO / INSTRUMENTOS', 'ESPEJOS', 'LITERA']],
    ['QUINTA RUEDA', '🔗', ['QUINTA RUEDA', 'MANGUERAS Y CONEXIONES (AIRE / LUZ)']],
    ['GPS / RADIO', '📡', ['GPS NO FUNCIONA', 'RADIO']],
    ['OTRO', '❓', ['OTRO']]
  ],
  CARRETA: [
    ['LLANTAS', '🛞', ['LLANTA BAJA / PINCHADA', 'LLANTA GASTADA (CAMBIO)', 'LLANTA REVENTADA', 'PRESIÓN DE AIRE', 'TUERCAS / AROS', 'LLANTA DE REPUESTO']],
    ['EQUIPO DE FRÍO / GENERADOR', '❄️', ['GENERADOR NO ENCIENDE', 'NO ENFRÍA / TEMPERATURA', 'ALARMA DEL EQUIPO', 'FUGA DE COMBUSTIBLE DEL GENERADOR', 'RUIDO DEL GENERADOR', 'BATERÍA DEL GENERADOR']],
    ['FRENOS', '🛑', ['FRENA MAL / REGULACIÓN', 'FUGA DE AIRE', 'LÍNEAS DE AIRE']],
    ['LUCES', '💡', ['LUCES QUEMADAS', 'CABLEADO / CONEXIÓN']],
    ['SUSPENSIÓN', '🪜', ['BOLSAS DE AIRE', 'AMORTIGUADORES', 'MUELLES', 'BUJES / ABRAZADERAS']],
    ['PATAS', '🦵', ['PATAS (TREN DE APOYO)', 'MANIVELA']],
    ['KING PIN', '🔗', ['KING PIN']],
    ['CHASIS / ESTRUCTURA', '🧱', ['CHASIS', 'PARACHOQUES / BARRA', 'TAPABARROS / ESCARPINES', 'PLACAS / SEÑALÉTICA', 'PORTA LLANTAS / PORTA EXTINTOR', 'CAJA DE HERRAMIENTAS']],
    ['OTRO', '❓', ['OTRO']]
  ]
};
const INC_URGENCIAS = [
  ['URGENTE', '🔴', 'No puedo viajar o es peligroso', '#dc2626'],
  ['PRONTO', '🟠', 'Puedo viajar, pero hay que revisarlo pronto', '#ea580c'],
  ['AVISO', '🟢', 'Que lo revisen cuando se pueda', '#16a34a']
];
const INC_COLOR = { URGENTE: '#dc2626', PRONTO: '#ea580c', AVISO: '#16a34a' };
const INC_EST = { ABIERTA: ['Pendiente', '#b45309', '#fef3c7'], PROGRAMADA: ['Programada', '#1d4ed8', '#dbeafe'], RESUELTA: ['Resuelta', '#166534', '#dcfce7'], DESCARTADA: ['Descartada', '#475569', '#e2e8f0'] };

/* Reduce la foto para que suba rápido con datos móviles (máx. 1280 px, JPEG 70%). */
function _incComprimir(file) {
  return new Promise(function (ok, mal) {
    const fr = new FileReader();
    fr.onload = function () {
      const img = new Image();
      img.onload = function () {
        const max = 1280, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = mal; img.src = fr.result;
    };
    fr.onerror = mal; fr.readAsDataURL(file);
  });
}

/* =========================== APP DEL CONDUCTOR =========================== */
const FormIncConductor = {
  _cfg: null, _r: {},

  abrir: async function (opts) {
    this._modoPanel = !!(opts && opts.panel);
    this._volverA = (opts && opts.volver) || 'tablero';
    let app = document.getElementById('incApp');
    if (!app) {
      app = document.createElement('div'); app.id = 'incApp';
      document.body.appendChild(app);
      const st = document.createElement('style');
      st.textContent = `
        #incApp { position:fixed; inset:0; z-index:900; background:#f1f5f9; overflow-y:auto; font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:#0f172a; }
        #incApp .top { background:#1c3a5e; color:#fff; padding:14px 16px; display:flex; align-items:center; gap:10px; position:sticky; top:0; z-index:2; }
        #incApp .top b { font-size:1.1rem; flex:1; }
        #incApp .top button { background:transparent; border:1px solid rgba(255,255,255,.5); color:#fff; border-radius:10px; padding:8px 12px; font-size:.95rem; }
        #incApp .cont { max-width:560px; margin:0 auto; padding:16px; }
        #incApp h2 { font-size:1.35rem; margin:6px 0 14px; }
        #incApp .paso { font-size:.9rem; color:#64748b; font-weight:700; margin-bottom:4px; }
        #incApp .grande { display:block; width:100%; border:none; border-radius:18px; padding:22px 16px; font-size:1.35rem; font-weight:800; margin:0 0 14px; color:#fff; text-align:center; box-shadow:0 3px 10px rgba(0,0,0,.12); }
        #incApp .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        #incApp .op { background:#fff; border:2px solid #cbd5e1; border-radius:16px; padding:16px 8px; text-align:center; font-size:1.02rem; font-weight:800; color:#1c3a5e; min-height:96px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; }
        #incApp .op .ic { font-size:2.2rem; line-height:1; }
        #incApp .op.sel { border-color:#1c3a5e; background:#e0ecfb; }
        #incApp .lista .op { min-height:0; flex-direction:row; justify-content:flex-start; text-align:left; padding:16px; margin-bottom:10px; font-size:1.05rem; }
        #incApp label.l { display:block; font-weight:800; margin:14px 0 6px; font-size:1.05rem; }
        #incApp input.t, #incApp select.t, #incApp textarea.t { width:100%; box-sizing:border-box; font-size:1.25rem; padding:14px; border:2px solid #cbd5e1; border-radius:14px; background:#fff; }
        #incApp .ayuda { font-size:.9rem; color:#64748b; margin-top:4px; }
        #incApp .urg { display:flex; align-items:center; gap:12px; width:100%; text-align:left; border:3px solid transparent; border-radius:16px; padding:16px; margin-bottom:10px; background:#fff; font-size:1.15rem; font-weight:800; }
        #incApp .urg small { display:block; font-weight:500; font-size:.92rem; color:#475569; }
        #incApp .urg .ic { font-size:2rem; }
        #incApp .atras { background:transparent; border:none; color:#1c3a5e; font-size:1.05rem; font-weight:700; padding:8px 0; margin-bottom:6px; }
        #incApp .err { color:#b91c1c; font-weight:700; margin:8px 0; min-height:1.2em; }
        #incApp .card { background:#fff; border-radius:14px; padding:12px 14px; margin-bottom:10px; border-left:6px solid #94a3b8; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        #incApp .chip { display:inline-block; border-radius:999px; padding:3px 10px; font-size:.82rem; font-weight:800; margin:2px 4px 2px 0; }
        #incApp .foto-prev img { max-width:100%; border-radius:12px; margin-top:8px; }
      `;
      document.head.appendChild(st);
    }
    app.style.display = '';
    document.body.style.overflow = 'hidden';
    this._inicio();
    try { const r = await llamarBackend('incConfig', {}); if (r && r.ok) this._cfg = r; } catch (e) { /* se reintenta al reportar */ }
  },
  cerrar: function () { const a = document.getElementById('incApp'); if (a) a.style.display = 'none'; document.body.style.overflow = ''; },
  _pintar: function (html) {
    const d = Sesion.datos() || {};
    const self = this;
    document.getElementById('incApp').innerHTML = '<div class="top"><b>🚛 ' + esc(String(d.nombre || d.usuario || '').split(' ')[0]) + '</b>' +
      (self._modoPanel ? '<button type="button" id="incCerrar">✕ ' + (self._volverA === 'inicio' ? 'Volver al inicio' : 'Volver al tablero') + '</button>' : '<button type="button" id="incClave">🔑 Clave</button><button type="button" id="incSalir">Salir</button>') +
      '</div><div class="cont">' + html + '</div>';
    const app = document.getElementById('incApp'); app.scrollTop = 0;
    if (self._modoPanel) {
      app.querySelector('#incCerrar').addEventListener('click', function () { self.cerrar(); if (self._volverA !== 'inicio') FormIncTablero.abrir(); });
      return app;
    }
    app.querySelector('#incSalir').addEventListener('click', function () { document.getElementById('btn-cerrar-sesion') ? document.getElementById('btn-cerrar-sesion').click() : location.reload(); });
    app.querySelector('#incClave').addEventListener('click', function () { FormIncConductor.cerrar(); FormUsuarios.cambiarMiClave(); const t = setInterval(function () { if (!document.querySelector('#overlay-panel')) { clearInterval(t); FormIncConductor.abrir(); } }, 700); });
    return app;
  },

  _inicio: function () {
    const self = this;
    const d = Sesion.datos() || {};
    const app = self._pintar('<h2>Hola, ' + esc(String(d.nombre || '').split(' ')[0] || '') + ' 👋</h2>' +
      '<button class="grande" id="incRep" style="background:#dc2626">🚨 REPORTAR UNA FALLA</button>' +
      '<button class="grande" id="incMis" style="background:#1c3a5e">📋 MIS REPORTES</button>' +
      '<p class="ayuda" style="text-align:center">Si algo falla en tu tracto o carreta, repórtalo aquí. El mecánico lo verá al instante.</p>');
    app.querySelector('#incRep').addEventListener('click', function () { self._r = {}; self._paso1(); });
    app.querySelector('#incMis').addEventListener('click', function () { self._mis(); });
  },

  _paso1: function () {
    const self = this, r = self._r, cfg = self._cfg || {};
    const placasDe = t => (t === 'CARRETA' ? cfg.carretas : cfg.tractos) || [];
    const sug = t => (t === 'CARRETA' ? cfg.carreta : cfg.tracto) || '';
    const app = self._pintar('<button class="atras" id="a">◀ Inicio</button><div class="paso">PASO 1 DE 4</div><h2>¿En qué unidad es la falla?</h2>' +
      '<div class="grid"><button class="op' + (r.tipoUnidad === 'TRACTO' ? ' sel' : '') + '" data-t="TRACTO"><span class="ic">🚛</span>TRACTO<small style="font-weight:600;color:#64748b">' + esc(sug('TRACTO')) + '</small></button>' +
      '<button class="op' + (r.tipoUnidad === 'CARRETA' ? ' sel' : '') + '" data-t="CARRETA"><span class="ic">🧊</span>CARRETA<small style="font-weight:600;color:#64748b">' + esc(sug('CARRETA')) + '</small></button></div>' +
      '<div id="p1det" style="display:' + (r.tipoUnidad ? '' : 'none') + '">' +
      '<label class="l">Placa</label><select class="t" id="pl"></select>' +
      '<label class="l">Kilometraje del tracto <span id="kmOpc" style="font-weight:500;color:#64748b"></span></label><input class="t" id="km" type="number" inputmode="numeric" placeholder="Ej. 631500">' +
      '<div class="ayuda" id="kmAy"></div><div class="err" id="e"></div>' +
      '<button class="grande" id="sig" style="background:#1c3a5e">SIGUIENTE ▶</button></div>');
    app.querySelector('#a').addEventListener('click', () => self._inicio());
    const elegir = function (t) {
      r.tipoUnidad = t;
      app.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('sel', b.dataset.t === t));
      const lista = placasDe(t), s = r.placa && lista.indexOf(r.placa) >= 0 ? r.placa : sug(t);
      app.querySelector('#pl').innerHTML = '<option value="">— Elige la placa —</option>' + lista.map(p => '<option' + (p === s ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
      app.querySelector('#kmOpc').textContent = t === 'CARRETA' ? '(si lo sabes)' : '';
      app.querySelector('#p1det').style.display = '';
      ayudaKm();
    };
    const ayudaKm = function () {
      const p = app.querySelector('#pl').value, tr = r.tipoUnidad === 'CARRETA' ? (cfg.tracto || '') : p;
      const k = (cfg.km || {})[tr];
      app.querySelector('#kmAy').textContent = k ? 'Último registrado del tracto ' + tr + ': ' + Number(k).toLocaleString('en-US') + ' km' : '';
    };
    app.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => elegir(b.dataset.t)));
    app.querySelector('#pl').addEventListener('change', ayudaKm);
    if (r.tipoUnidad) { elegir(r.tipoUnidad); if (r.km) app.querySelector('#km').value = r.km; }
    app.querySelector('#sig').addEventListener('click', function () {
      const p = app.querySelector('#pl').value, km = Number(app.querySelector('#km').value) || 0, e = app.querySelector('#e');
      if (!p) { e.textContent = 'Elige la placa.'; return; }
      if (r.tipoUnidad === 'TRACTO' && !(km > 0)) { e.textContent = 'Escribe el kilometraje que marca el tablero.'; app.querySelector('#km').focus(); return; }
      r.placa = p; r.km = km || '';
      self._paso2();
    });
  },

  _paso2: function () {
    const self = this, r = self._r;
    const sist = INC_CATALOGO[r.tipoUnidad];
    const app = self._pintar('<button class="atras" id="a">◀ Atrás</button><div class="paso">PASO 2 DE 4 · ' + esc(r.tipoUnidad + ' ' + r.placa) + '</div><h2>¿Qué parte está fallando?</h2>' +
      '<div class="grid">' + sist.map((s, i) => '<button class="op" data-i="' + i + '"><span class="ic">' + s[1] + '</span>' + esc(s[0]) + '</button>').join('') + '</div>');
    app.querySelector('#a').addEventListener('click', () => self._paso1());
    app.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', function () {
      const s = sist[Number(b.dataset.i)]; r.sistema = s[0]; r.icono = s[1];
      if (s[2].length === 1) { r.componente = s[2][0]; self._paso4(); } else self._paso3(s);
    }));
  },

  _paso3: function (s) {
    const self = this, r = self._r;
    const app = self._pintar('<button class="atras" id="a">◀ Atrás</button><div class="paso">PASO 3 DE 4 · ' + s[1] + ' ' + esc(s[0]) + '</div><h2>¿Qué le pasa?</h2>' +
      '<div class="lista">' + s[2].map((c, i) => '<button class="op" data-i="' + i + '" style="width:100%">' + esc(c) + '</button>').join('') +
      '<button class="op" data-i="-1" style="width:100%">❓ OTRO (lo escribo)</button></div>');
    app.querySelector('#a').addEventListener('click', () => self._paso2());
    app.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', function () {
      const i = Number(b.dataset.i); r.componente = i < 0 ? 'OTRO' : s[2][i]; self._paso4();
    }));
  },

  _paso4: function () {
    const self = this, r = self._r;
    const app = self._pintar('<button class="atras" id="a">◀ Atrás</button><div class="paso">PASO 4 DE 4 · ' + esc(r.placa) + ' · ' + esc(r.sistema) + ' › ' + esc(r.componente) + '</div>' +
      '<h2>¿Qué tan urgente es?</h2>' +
      INC_URGENCIAS.map(u => '<button class="urg" data-u="' + u[0] + '" style="' + (r.urgencia === u[0] ? 'border-color:' + u[3] + ';background:#fff7ed' : '') + '"><span class="ic">' + u[1] + '</span><span>' + u[0] + '<small>' + u[2] + '</small></span></button>').join('') +
      '<label class="l">📷 Foto de la falla (opcional)</label>' +
      '<label class="grande" style="background:#475569;cursor:pointer;margin:0" for="foto">📷 TOMAR FOTO</label><input type="file" id="foto" accept="image/*" capture="environment" style="display:none">' +
      '<div class="foto-prev" id="fp"></div>' +
      '<label class="l">✍️ Cuéntanos qué pasa ' + (r.componente === 'OTRO' ? '(obligatorio)' : '(opcional)') + '</label>' +
      '<textarea class="t" id="com" rows="3" placeholder="Puedes usar el micrófono 🎤 del teclado para dictar">' + esc(r.comentario || '') + '</textarea>' +
      '<div class="err" id="e"></div>' +
      '<button class="grande" id="env" style="background:#16a34a">✅ ENVIAR REPORTE</button>');
    app.querySelector('#a').addEventListener('click', () => self._paso2());
    app.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', function () {
      r.urgencia = b.dataset.u;
      app.querySelectorAll('[data-u]').forEach(x => { const u = INC_URGENCIAS.filter(z => z[0] === x.dataset.u)[0]; x.style.borderColor = x === b ? u[3] : 'transparent'; x.style.background = x === b ? '#fff7ed' : '#fff'; });
    }));
    if (r.foto) app.querySelector('#fp').innerHTML = '<img src="' + r.foto + '">';
    app.querySelector('#foto').addEventListener('change', async function () {
      const f = this.files && this.files[0]; if (!f) return;
      app.querySelector('#fp').textContent = 'Preparando foto…';
      try { r.foto = await _incComprimir(f); app.querySelector('#fp').innerHTML = '<img src="' + r.foto + '"><div class="ayuda">Foto lista ✔ (puedes tomar otra para cambiarla)</div>'; }
      catch (e) { r.foto = ''; app.querySelector('#fp').textContent = 'No se pudo leer la foto. Intenta otra vez.'; }
    });
    app.querySelector('#env').addEventListener('click', async function () {
      const e = app.querySelector('#e'), btn = this;
      r.comentario = app.querySelector('#com').value.trim();
      if (!r.urgencia) { e.textContent = 'Toca qué tan urgente es (rojo, naranja o verde).'; return; }
      if (r.componente === 'OTRO' && r.comentario.length < 3) { e.textContent = 'Escribe qué está fallando.'; app.querySelector('#com').focus(); return; }
      e.textContent = ''; btn.disabled = true; btn.textContent = 'Enviando… (no cierres)';
      try {
        const resp = await llamarBackend('incReportar', { tipoUnidad: r.tipoUnidad, placa: r.placa, km: r.km, sistema: r.sistema, componente: r.componente, urgencia: r.urgencia, comentario: r.comentario, foto: r.foto || '' });
        if (!resp || !resp.ok) { e.textContent = (resp && resp.mensaje) || 'No se pudo enviar. Intenta de nuevo.'; btn.disabled = false; btn.textContent = '✅ ENVIAR REPORTE'; return; }
        self._listo(resp);
      } catch (x) { e.textContent = 'Sin conexión. Revisa tu señal e intenta de nuevo.'; btn.disabled = false; btn.textContent = '✅ ENVIAR REPORTE'; }
    });
  },

  _listo: function (resp) {
    const self = this;
    const app = self._pintar('<div style="text-align:center;font-size:4.5rem;margin-top:20px">✅</div><h2 style="text-align:center">¡Reporte enviado!</h2>' +
      '<p style="text-align:center;font-size:1.05rem">' + esc(resp.mensaje || '') + '</p>' +
      (resp.reincidencia ? '<p style="text-align:center;font-weight:800;color:#b91c1c">⚠️ Falla REPETIDA: ya estaba reportada y aún no se arregla. Se le dio más prioridad.</p>' : '') +
      '<button class="grande" id="otra" style="background:#dc2626">🚨 REPORTAR OTRA FALLA</button><button class="grande" id="ini" style="background:#1c3a5e">🏠 INICIO</button>');
    app.querySelector('#otra').addEventListener('click', function () { const r = self._r; self._r = { tipoUnidad: r.tipoUnidad, placa: r.placa, km: r.km }; self._paso2(); });
    app.querySelector('#ini').addEventListener('click', () => self._inicio());
  },

  _mis: async function () {
    const self = this;
    let app = self._pintar('<button class="atras" id="a">◀ Inicio</button><h2>📋 Mis reportes</h2><div id="l">Cargando…</div>');
    app.querySelector('#a').addEventListener('click', () => self._inicio());
    let r = null;
    try { r = await llamarBackend('incMisReportes', {}); } catch (e) { r = null; }
    const l = app.querySelector('#l');
    if (!r || !r.ok) { l.textContent = 'No se pudo cargar. Revisa tu señal.'; return; }
    if (!r.filas.length) { l.innerHTML = '<p>Aún no tienes reportes.</p>'; return; }
    l.innerHTML = r.filas.map(function (f) {
      const es = INC_EST[f.estado] || INC_EST.ABIERTA;
      return '<div class="card" style="border-left-color:' + (INC_COLOR[f.prioridad] || '#94a3b8') + '">' +
        '<div style="font-weight:800;font-size:1.05rem">' + esc(f.sistema) + ' › ' + esc(f.componente) + '</div>' +
        '<div style="color:#475569">' + esc(f.tipoUnidad) + ' ' + esc(f.placa) + ' · ' + esc(f.fecha) + '</div>' +
        '<span class="chip" style="background:' + es[2] + ';color:' + es[1] + '">' + es[0] + (f.estado === 'PROGRAMADA' && f.fechaProgramada ? ' para ' + esc(f.fechaProgramada) : '') + '</span>' +
        (f.reincidencias ? '<span class="chip" style="background:#fee2e2;color:#b91c1c">Repetida ×' + (f.reincidencias + 1) + '</span>' : '') +
        (f.estado === 'RESUELTA' ? '<div style="margin-top:4px;color:#166534">✔ ' + esc(f.trabajo) + '</div>' : '') +
        (f.puedeEliminar ? '<button type="button" data-del="' + esc(f.id) + '" style="margin-top:8px;background:#fff;border:2px solid #fca5a5;color:#b91c1c;border-radius:12px;padding:8px 14px;font-size:1rem;font-weight:800">🗑 Eliminar este reporte</button>' : '') + '</div>';
    }).join('');
    l.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { self._eliminar(b.dataset.del); }); });
  },

  /** Confirmación grande para eliminar un reporte (el maestro escribe el motivo). */
  _eliminar: function (id) {
    const self = this;
    const maestro = (Sesion.datos() || {}).rol === 'MAESTRO';
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:950;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<div style="background:#fff;border-radius:18px;padding:20px;width:min(440px,100%);text-align:center">' +
      '<div style="font-size:3rem">🗑</div><h3 style="margin:6px 0 10px;font-size:1.25rem">¿Eliminar este reporte?</h3>' +
      '<p style="color:#475569;margin:0 0 12px">Úsalo solo si te equivocaste al registrarlo.</p>' +
      (maestro ? '<textarea data-m rows="2" placeholder="Motivo (obligatorio)" style="width:100%;box-sizing:border-box;font-size:1rem;padding:10px;border:2px solid #cbd5e1;border-radius:12px"></textarea>' : '') +
      '<div data-e style="color:#b91c1c;font-weight:700;min-height:1.2em;margin:6px 0"></div>' +
      '<button data-si style="display:block;width:100%;border:none;border-radius:14px;padding:16px;font-size:1.15rem;font-weight:800;background:#dc2626;color:#fff;margin-bottom:10px">SÍ, ELIMINAR</button>' +
      '<button data-no style="display:block;width:100%;border:2px solid #cbd5e1;border-radius:14px;padding:14px;font-size:1.1rem;font-weight:800;background:#fff;color:#1c3a5e">NO, VOLVER</button></div>';
    document.body.appendChild(ov);
    ov.querySelector('[data-no]').addEventListener('click', () => ov.remove());
    ov.querySelector('[data-si]').addEventListener('click', async function () {
      const m = ov.querySelector('[data-m]') ? ov.querySelector('[data-m]').value.trim() : '';
      if (maestro && m.length < 3) { ov.querySelector('[data-e]').textContent = 'Escribe el motivo.'; return; }
      this.disabled = true; this.textContent = 'Eliminando…';
      let r = null;
      try { r = await llamarBackend('incEliminar', { id: id, motivo: m }); } catch (e) { r = null; }
      if (!r || !r.ok) { this.disabled = false; this.textContent = 'SÍ, ELIMINAR'; ov.querySelector('[data-e]').textContent = (r && r.mensaje) || 'No se pudo eliminar. Revisa tu señal.'; return; }
      ov.remove();
      self._mis();
    });
  }
};

/* ============================ TABLERO (taller) ============================ */
const FormIncTablero = {
  _filas: [], _puede: false,

  abrir: async function () {
    const self = this;
    const html = `
      <style>
        .it-kpi { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; margin-bottom:10px; }
        .it-kpi div { background:#f1f5f9; border-radius:10px; padding:8px 10px; border-left:4px solid #94a3b8; }
        .it-kpi span { display:block; font-size:.66rem; font-weight:700; color:#64748b; text-transform:uppercase; }
        .it-kpi b { font-size:1.15rem; color:#1c3a5e; }
        .it-fil { display:flex; flex-wrap:wrap; gap:8px 10px; align-items:end; margin-bottom:8px; }
        .it-fil .campo { margin:0; min-width:130px; }
        .it-lista { max-height:calc(74vh - 300px); min-height:200px; overflow:auto; }
        .it-card { border:1px solid #e2e8f0; border-left:6px solid #94a3b8; border-radius:10px; padding:9px 12px; margin-bottom:8px; background:#fff; display:grid; grid-template-columns:1fr auto; gap:6px 12px; }
        .it-card.cerr { opacity:.7; }
        .it-chip { display:inline-block; border-radius:999px; padding:2px 8px; font-size:.68rem; font-weight:800; margin-right:4px; }
        .it-t { font-weight:800; color:#0f172a; font-size:.92rem; }
        .it-s { font-size:.76rem; color:#475569; }
        .it-acc { display:flex; flex-direction:column; gap:4px; align-items:stretch; min-width:120px; }
        .it-acc button { font-size:.72rem; padding:4px 8px; }
        .it-hist { grid-column:1 / -1; font-size:.72rem; color:#334155; background:#f8fafc; border-radius:8px; padding:6px 8px; display:none; }
        .it-top { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:8px; font-size:.75rem; }
        .it-top div { background:#f8fafc; border-radius:8px; padding:6px 8px; }
        @media (max-width: 800px) { .it-kpi { grid-template-columns:repeat(3,1fr); } .it-top { grid-template-columns:1fr; } }
      </style>
      <div class="it-kpi" id="itKpi"></div>
      <div class="it-fil">
        <div class="campo"><label>Estado</label><select id="itEst"><option value="ABIERTAS">Por atender (pendientes + programadas)</option><option value="ABIERTA">Pendientes</option><option value="PROGRAMADA">Programadas</option><option value="RESUELTA">Resueltas</option><option value="DESCARTADA">Descartadas</option><option value="">Todas</option></select></div>
        <div class="campo"><label>Prioridad</label><select id="itPri"><option value="">Todas</option><option>URGENTE</option><option>PRONTO</option><option>AVISO</option></select></div>
        <div class="campo"><label>Placa</label><div id="msItPlaca"></div></div>
        <div class="campo"><label>Conductor</label><div id="msItCond"></div></div>
        <div class="campo"><label>Sistema</label><div id="msItSis"></div></div>
        <div class="campo"><label>Desde</label><input type="date" id="itDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="itHasta"></div>
        <button class="boton-secundario" id="itRec" type="button">↻ Actualizar</button>
        <button class="boton-primario" id="itNueva" type="button" style="display:none;background:#dc2626;border-color:#dc2626">🚨 Registrar falla</button>
        <button class="boton-secundario" id="itMias" type="button" style="display:none">📋 Mis reportes</button>
      </div>
      <div class="it-lista" id="itLista">Cargando…</div>
      <div class="it-top" id="itTop"></div>
      <div class="panel-footer" style="padding-top:10px;"><button class="boton-secundario" id="itCerrar">Cerrar</button></div>`;
    abrirPanel('Incidencias de conductores', html, async function (raiz) {
      self._raiz = raiz;
      const $ = id => raiz.querySelector('#' + id);
      self._ms = { placa: crearMultiSelect($('msItPlaca'), { onChange: () => self._pintar() }), cond: crearMultiSelect($('msItCond'), { onChange: () => self._pintar() }), sis: crearMultiSelect($('msItSis'), { onChange: () => self._pintar() }) };
      ['itEst', 'itPri', 'itDesde', 'itHasta'].forEach(id => $(id).addEventListener('change', () => self._pintar()));
      $('itRec').addEventListener('click', () => self._cargar());
      $('itNueva').addEventListener('click', () => { cerrarPanel(); FormIncConductor.abrir({ panel: true }).then(() => { FormIncConductor._r = {}; FormIncConductor._paso1(); }); });
      $('itMias').addEventListener('click', () => { cerrarPanel(); FormIncConductor.abrir({ panel: true }).then(() => FormIncConductor._mis()); });
      $('itCerrar').addEventListener('click', cerrarPanel);
      await self._cargar();
    }, { ancho: true });
  },

  _cargar: async function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const r = await llamarBackend('incTablero', {});
    if (!respuestaValida(r)) { $('itLista').textContent = (r && r.mensaje) || 'No se pudo cargar.'; return; }
    self._filas = r.filas || []; self._puede = !!r.puedeAtender; self._yo = r.usuario; self._maestro = !!r.esMaestro;
    $('itNueva').style.display = self._puede ? '' : 'none';
    $('itMias').style.display = self._puede ? '' : 'none';
    const u = k => Array.from(new Set(self._filas.map(f => f[k]).filter(Boolean))).sort();
    self._ms.placa.setOpciones(u('placa')); self._ms.cond.setOpciones(u('conductor')); self._ms.sis.setOpciones(u('sistema'));
    self._pintar();
  },

  _iso: function (t) { const m = String(t || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; },

  _pintar: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    const est = $('itEst').value, pri = $('itPri').value, de = $('itDesde').value, ha = $('itHasta').value;
    const todas = self._filas;
    const vis = todas.filter(f => (est === 'ABIERTAS' ? (f.estado === 'ABIERTA' || f.estado === 'PROGRAMADA') : (!est || f.estado === est)) && (!pri || f.prioridad === pri) &&
      self._ms.placa.cumple(f.placa) && self._ms.cond.cumple(f.conductor) && self._ms.sis.cumple(f.sistema) &&
      (!de || self._iso(f.fecha) >= de) && (!ha || self._iso(f.fecha) <= ha)).sort((a, b) => b.puntaje - a.puntaje);
    // KPIs (sobre todas)
    const ab = todas.filter(f => f.estado === 'ABIERTA' || f.estado === 'PROGRAMADA');
    const mes = new Date(); const mIso = mes.getFullYear() + '-' + String(mes.getMonth() + 1).padStart(2, '0');
    const res = todas.filter(f => f.estado === 'RESUELTA');
    const resMes = res.filter(f => self._iso(f.fechaResolucion).slice(0, 7) === mIso);
    const dur = res.map(f => { const a = self._iso(f.fecha), b = self._iso(f.fechaResolucion); return a && b ? (new Date(b) - new Date(a)) / 86400000 : null; }).filter(x => x !== null);
    const prom = dur.length ? (dur.reduce((a, b) => a + b, 0) / dur.length) : 0;
    $('itKpi').innerHTML = [['Por atender', ab.length, '#1c3a5e'], ['🔴 Urgentes', ab.filter(f => f.prioridad === 'URGENTE').length, '#dc2626'], ['Repetidas abiertas', ab.filter(f => f.reincidencias > 0).length, '#b91c1c'],
      ['Programadas', ab.filter(f => f.estado === 'PROGRAMADA').length, '#1d4ed8'], ['Resueltas este mes', resMes.length, '#16a34a'], ['Días promedio en resolver', prom.toFixed(1), '#475569']]
      .map(k => '<div style="border-left-color:' + k[2] + '"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>').join('');
    $('itLista').innerHTML = vis.length ? vis.map((f, i) => self._card(f, i)).join('') : '<p style="color:#64748b;padding:12px">No hay incidencias con estos filtros. 👍</p>';
    $('itLista').querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => self._accion(vis[Number(b.dataset.i)], b.dataset.acc)));
    $('itLista').querySelectorAll('[data-foto]').forEach(b => b.addEventListener('click', () => self._foto(b.dataset.foto)));
    $('itLista').querySelectorAll('[data-hist]').forEach(b => b.addEventListener('click', () => { const h = self._raiz.querySelector('#ith' + b.dataset.hist); h.style.display = h.style.display === 'block' ? 'none' : 'block'; }));
    // Tops
    const top = (k, lista) => { const c = {}; lista.forEach(f => { c[f[k]] = (c[f[k]] || 0) + 1 + (f.reincidencias || 0); }); return Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, 5).map(x => esc(x) + ': <b>' + c[x] + '</b>').join(' · ') || '—'; };
    $('itTop').innerHTML = '<div><b>Placas con más fallas</b><br>' + top('placa', vis) + '</div><div><b>Sistemas con más fallas</b><br>' + top('sistema', vis) + '</div><div><b>Reportes por conductor</b><br>' + top('conductor', vis) + '</div>';
    _refrescarSnapshotFormulario();
  },

  _card: function (f, i) {
    const self = this;
    const es = INC_EST[f.estado] || INC_EST.ABIERTA;
    const abierta = f.estado === 'ABIERTA' || f.estado === 'PROGRAMADA';
    const ult = (f.historial || []).filter(h => h.comentario).slice(-1)[0];
    const hist = (f.historial || []).map(h => '<div>• <b>' + esc(h.fecha) + '</b> · ' + esc(h.tipo || '') + ' · ' + esc(h.conductor || h.usuario || '') + (h.km ? ' · ' + Number(h.km).toLocaleString('en-US') + ' km' : '') +
      (h.urgencia ? ' · ' + esc(h.urgencia) : '') + (h.comentario ? ' · ' + esc(h.comentario) : '') + '</div>').join('');
    const acc = !self._puede ? '' : abierta
      ? '<button class="boton-secundario" data-acc="PROGRAMAR" data-i="' + i + '">📅 Programar</button><button class="boton-primario" data-acc="RESOLVER" data-i="' + i + '" style="background:#16a34a;border-color:#16a34a">✔ Resuelta</button><button class="boton-secundario" data-acc="DESCARTAR" data-i="' + i + '">Descartar</button>'
      : '<button class="boton-secundario" data-acc="REABRIR" data-i="' + i + '">↺ Reabrir</button>';
    const extra = '<button class="boton-secundario" data-acc="OBSERVAR" data-i="' + i + '">💬 Observación</button>' +
      (self._maestro ? '<button class="boton-secundario" data-acc="ELIMINAR" data-i="' + i + '" style="color:#b91c1c;border-color:#fca5a5">🗑 Eliminar</button>' : '');
    return '<div class="it-card' + (abierta ? '' : ' cerr') + '" style="border-left-color:' + (abierta ? INC_COLOR[f.prioridad] : '#94a3b8') + '"><div>' +
      (abierta ? '<span class="it-chip" style="background:' + INC_COLOR[f.prioridad] + ';color:#fff">' + esc(f.prioridad) + '</span>' : '') +
      (f.reincidencias ? '<span class="it-chip" style="background:#fee2e2;color:#b91c1c">⚠ REPETIDA ×' + (f.reincidencias + 1) + '</span>' : '') +
      '<span class="it-chip" style="background:' + es[2] + ';color:' + es[1] + '">' + es[0] + (f.estado === 'PROGRAMADA' ? ' ' + esc(f.fechaProgramada) + ' · ' + esc(f.responsable) : '') + '</span>' +
      (abierta ? '<span class="it-chip" style="background:#f1f5f9;color:#475569">' + f.dias + ' día(s)</span>' : '') +
      '<div class="it-t">' + esc(f.tipoUnidad) + ' ' + esc(f.placa) + ' — ' + esc(f.sistema) + ' › ' + esc(f.componente) + '</div>' +
      '<div class="it-s">👤 ' + esc(f.conductor) + ' · 🕒 ' + esc(f.fecha) + (f.km ? ' · 📍 ' + Number(f.km).toLocaleString('en-US') + ' km' : '') + ' · urgencia reportada: ' + esc(f.urgencia) + '</div>' +
      (f.detalle ? '<div class="it-s">💬 ' + esc(f.detalle) + '</div>' : '') +
      (ult && f.reincidencias ? '<div class="it-s" style="color:#b91c1c">Último aviso: ' + esc(ult.fecha) + ' — ' + esc(ult.comentario) + '</div>' : '') +
      (f.estado === 'RESUELTA' || f.estado === 'DESCARTADA' ? '<div class="it-s" style="color:#166534">✔ ' + esc(f.trabajo) + ' · ' + esc(f.resueltoPor) + ' · ' + esc(f.fechaResolucion) + (f.kmResolucion ? ' · ' + Number(f.kmResolucion).toLocaleString('en-US') + ' km' : '') + '</div>' : '') +
      '<div style="margin-top:4px">' + (f.fotos || []).map((x, j) => '<button class="boton-secundario" style="font-size:.7rem;padding:2px 8px" data-foto="' + esc(x.id) + '">📷 Foto ' + (j + 1) + '</button> ').join('') +
      '<button class="boton-secundario" style="font-size:.7rem;padding:2px 8px" data-hist="' + i + '">Historial (' + (f.historial || []).length + ')</button></div>' +
      '</div><div class="it-acc">' + acc + extra + '</div><div class="it-hist" id="ith' + i + '">' + hist + '</div></div>';
  },

  _dlg: function (titulo, cuerpo, ok, alOk) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10050;display:flex;align-items:center;justify-content:center';
    ov.innerHTML = '<div style="background:#fff;border-radius:12px;padding:16px 18px;width:min(520px,94vw);max-height:90vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.25)"><h4 style="margin:0 0 10px;color:#1c3a5e">' + titulo + '</h4>' + cuerpo +
      '<div data-err style="color:#b91c1c;font-size:.8rem;margin-top:6px"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="boton-secundario" data-x>Cancelar</button>' + (ok ? '<button class="boton-primario" data-ok>' + ok + '</button>' : '') + '</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('[data-x]').addEventListener('click', () => ov.remove());
    const b = ov.querySelector('[data-ok]');
    if (b) b.addEventListener('click', async function () { b.disabled = true; const e = await alOk(ov); if (e) { ov.querySelector('[data-err]').textContent = e; b.disabled = false; } else ov.remove(); });
    return ov;
  },

  _accion: function (f, acc) {
    const self = this;
    const hoy = new Date(); const iso = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    const inp = 'style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:8px"';
    const titulo = esc(f.placa) + ' — ' + esc(f.sistema) + ' › ' + esc(f.componente);
    let cuerpo = '';
    if (acc === 'PROGRAMAR') cuerpo = '<label>Fecha del trabajo</label><input type="date" data-f value="' + iso + '" ' + inp + '><label>Quién lo hará</label><input data-r value="' + esc(self._yo || '') + '" ' + inp + '><label>Nota (opcional)</label><input data-n ' + inp + '>';
    if (acc === 'RESOLVER') cuerpo = '<label>¿Qué trabajo se hizo?</label><textarea data-t rows="3" ' + inp + '></textarea><label>Kilometraje al resolver' + (f.tipoUnidad === 'CARRETA' ? ' (opcional)' : '') + '</label><input type="number" data-k ' + inp + ' placeholder="' + (f.km || '') + '"><label>Resuelto por</label><input data-r value="' + esc(self._yo || '') + '" ' + inp + '><p style="font-size:.75rem;color:#64748b">Las fotos de esta incidencia se borrarán de Drive.</p>';
    if (acc === 'DESCARTAR') cuerpo = '<label>Motivo (ej. no es falla, duplicado)</label><textarea data-t rows="2" ' + inp + '></textarea>';
    if (acc === 'REABRIR') cuerpo = '<label>Motivo para reabrir</label><textarea data-t rows="2" ' + inp + '></textarea>';
    if (acc === 'OBSERVAR') cuerpo = '<label>Observación (queda en el historial con tu nombre)</label><textarea data-t rows="3" ' + inp + '></textarea>';
    if (acc === 'ELIMINAR') cuerpo = '<p style="font-size:.82rem;color:#475569;margin:0 0 8px">Se quita de la lista (queda registrado quién y por qué) y se borran sus fotos.</p><label>Motivo</label><textarea data-t rows="2" ' + inp + '></textarea>';
    const txt = { PROGRAMAR: 'Programar', RESOLVER: 'Marcar resuelta', DESCARTAR: 'Descartar', REABRIR: 'Reabrir', OBSERVAR: 'Agregar observación', ELIMINAR: 'Eliminar' }[acc];
    self._dlg(txt + ': ' + titulo, cuerpo, txt, async function (ov) {
      const q = s => { const x = ov.querySelector(s); return x ? x.value.trim() : ''; };
      if (acc === 'OBSERVAR' || acc === 'ELIMINAR') {
        const r0 = await llamarBackend(acc === 'OBSERVAR' ? 'incObservar' : 'incEliminar', { id: f.id, texto: q('[data-t]'), motivo: q('[data-t]') });
        if (!r0 || !r0.ok) return (r0 && r0.mensaje) || 'No se pudo guardar.';
        mostrarMensaje(r0.mensaje, 'exito');
        await self._cargar();
        return '';
      }
      const fp = q('[data-f]');
      const datos = { id: f.id, accion: acc, fechaProgramada: fp ? fp.split('-').reverse().join('/') : '', responsable: q('[data-r]'), resueltoPor: q('[data-r]'), nota: q('[data-n]'), trabajo: q('[data-t]'), km: q('[data-k]') };
      const r = await llamarBackend('incActualizar', datos);
      if (!r || !r.ok) return (r && r.mensaje) || 'No se pudo guardar.';
      mostrarMensaje(r.mensaje, 'exito');
      await self._cargar();
      return '';
    });
  },

  _foto: async function (id) {
    const ov = this._dlg('Foto de la falla', '<div data-c style="text-align:center">Cargando…</div>', '', null);
    const r = await llamarBackend('incFoto', { id: id });
    ov.querySelector('[data-c]').innerHTML = r && r.ok ? '<img src="' + r.dataUrl + '" style="max-width:100%;max-height:70vh;border-radius:8px">' : esc((r && r.mensaje) || 'No disponible.');
  }
};

/* Al entrar: si es conductor, se abre su pantalla; si no, se oculta. */
(function () {
  const orig = Sesion._entrar;
  Sesion._entrar = function (r) {
    orig.call(this, r);
    const d = this.datos() || {};
    if (d.rol === 'CONDUCTOR' && !r.debeCambiar) FormIncConductor.abrir(); else FormIncConductor.cerrar();
  };
  ['vencida', 'mostrarLogin', 'pedirCambio'].forEach(function (k) {
    const o = Sesion[k];
    Sesion[k] = function () { FormIncConductor.cerrar(); return o.apply(this, arguments); };
  });
})();

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-incidencias');
  if (b) b.addEventListener('click', function () { FormIncTablero.abrir(); });
  const rf = document.getElementById('btn-reportar-falla');
  if (rf) rf.addEventListener('click', function () {
    FormIncConductor.abrir({ panel: true, volver: 'inicio' }).then(function () { FormIncConductor._r = {}; FormIncConductor._paso1(); });
  });
});
