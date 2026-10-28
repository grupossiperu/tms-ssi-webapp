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
      (self._modoPanel ? '<button type="button" id="incCerrar">✕ ' + (self._volverA === 'inicio' ? 'Volver al inicio' : 'Volver al tablero') + '</button>' : '<button type="button" id="incSalir">Salir</button>') +
      '</div><div class="cont">' + html + '</div>';
    const app = document.getElementById('incApp'); app.scrollTop = 0;
    if (self._modoPanel) {
      app.querySelector('#incCerrar').addEventListener('click', function () { self.cerrar(); if (self._volverA !== 'inicio') FormIncTablero.abrir(); });
      return app;
    }
    app.querySelector('#incSalir').addEventListener('click', function () { document.getElementById('btn-cerrar-sesion') ? document.getElementById('btn-cerrar-sesion').click() : location.reload(); });
    return app;
  },

  _inicio: function () {
    const self = this;
    const d = Sesion.datos() || {};
    const app = self._pintar('<h2>Hola, ' + esc(String(d.nombre || '').split(' ')[0] || '') + ' 👋</h2>' +
      '<button class="grande" id="incRep" style="background:#dc2626">🚨 REPORTAR UNA FALLA</button>' +
      '<button class="grande" id="incMis" style="background:#1c3a5e">📋 MIS REPORTES</button>' +
      '<p class="ayuda" style="text-align:center">Si algo falla en tu tracto o carreta, repórtalo aquí. El mecánico lo verá al instante.</p>');
    app.querySelector('#incRep').addEventListener('click', function () { if (self._r && self._r.lista && self._r.lista.length && self._r.km) self._lista(); else { self._r = {}; self._paso1(); } });
    app.querySelector('#incMis').addEventListener('click', function () { self._mis(); });
  },

  /* Paso 1: unidades del día (tracto + km y carreta). Se piden UNA sola vez. */
  _paso1: function () {
    const self = this, r = self._r, cfg = self._cfg || {};
    const opts = (lista, sel) => lista.map(p => '<option' + (p === sel ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
    const tr = r.tracto || cfg.tracto || '', ca = r.carreta !== undefined ? r.carreta : (cfg.carreta || '');
    const app = self._pintar('<button class="atras" id="a">◀ Inicio</button><div class="paso">PASO 1 · TUS UNIDADES</div><h2>¿Con qué unidades estás?</h2>' +
      '<label class="l">🚛 Placa del TRACTO</label><select class="t" id="pt"><option value="">— Elige —</option>' + opts(cfg.tractos || [], tr) + '</select>' +
      '<label class="l">📍 Kilometraje del tracto</label><input class="t" id="km" type="number" inputmode="numeric" placeholder="Ej. 631500" value="' + esc(r.km || '') + '">' +
      '<div class="ayuda" id="kmAy"></div>' +
      '<label class="l">🧊 Placa de la CARRETA</label><select class="t" id="pc"><option value="">— Sin carreta —</option>' + opts(cfg.carretas || [], ca) + '</select>' +
      '<div class="err" id="e"></div><button class="grande" id="sig" style="background:#1c3a5e">SIGUIENTE ▶</button>');
    app.querySelector('#a').addEventListener('click', () => self._inicio());
    const ayuda = function () { const p = app.querySelector('#pt').value, k = (cfg.km || {})[p]; app.querySelector('#kmAy').textContent = k ? 'Último registrado de ' + p + ': ' + Number(k).toLocaleString('en-US') + ' km' : ''; };
    app.querySelector('#pt').addEventListener('change', ayuda); ayuda();
    app.querySelector('#sig').addEventListener('click', function () {
      const pt = app.querySelector('#pt').value, km = Number(app.querySelector('#km').value) || 0, e = app.querySelector('#e');
      if (!pt) { e.textContent = 'Elige la placa del tracto.'; return; }
      if (!(km > 0)) { e.textContent = 'Escribe el kilometraje que marca el tablero.'; app.querySelector('#km').focus(); return; }
      r.tracto = pt; r.km = km; r.carreta = app.querySelector('#pc').value; r.lista = r.lista || [];
      self._lista();
    });
  },

  /* Lista de fallas de este reporte: se agregan varias y se envían juntas. */
  _lista: function (errores) {
    const self = this, r = self._r;
    r.lista = r.lista || [];
    const fila = function (f, i) {
      const u = INC_URGENCIAS.filter(z => z[0] === f.urgencia)[0] || INC_URGENCIAS[2];
      return '<div class="card" style="border-left-color:' + u[3] + '">' +
        '<div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1"><div style="font-weight:800;font-size:1.05rem">' + f.icono + ' ' + esc(f.sistema) + ' › ' + esc(f.componente) + '</div>' +
        '<div style="color:#475569">' + (f.tipoUnidad === 'CARRETA' ? '🧊 Carreta ' : '🚛 Tracto ') + esc(f.placa) + ' · ' + u[1] + ' ' + u[0] + (f.foto ? ' · 📷 con foto' : '') + '</div>' +
        (f.comentario ? '<div style="color:#334155">💬 ' + esc(f.comentario) + '</div>' : '') +
        (errores && errores[i] ? '<div style="color:#b91c1c;font-weight:700">⚠ No se envió: ' + esc(errores[i]) + '</div>' : '') + '</div>' +
        '<button type="button" data-q="' + i + '" style="border:2px solid #fca5a5;background:#fff;color:#b91c1c;border-radius:12px;padding:8px 12px;font-weight:800">✕ Quitar</button></div></div>';
    };
    const n = r.lista.length;
    const app = self._pintar('<button class="atras" id="a">◀ Inicio</button>' +
      '<div class="card" style="border-left-color:#1c3a5e;display:flex;align-items:center;gap:8px"><div style="flex:1"><b>🚛 ' + esc(r.tracto) + '</b> · ' + Number(r.km).toLocaleString('en-US') + ' km' +
      (r.carreta ? '<br><b>🧊 ' + esc(r.carreta) + '</b>' : '<br><span style="color:#64748b">Sin carreta</span>') + '</div><button type="button" id="cu" style="border:2px solid #cbd5e1;background:#fff;border-radius:12px;padding:8px 12px;font-weight:700">✏️ Cambiar</button></div>' +
      '<h2>' + (n ? 'Fallas a reportar (' + n + ')' : '¿Qué fallas tiene tu unidad?') + '</h2>' +
      (n ? r.lista.map(fila).join('') : '<p class="ayuda" style="font-size:1rem">Agrega una por una todas las fallas. Al final tocas ENVIAR y se mandan todas juntas.</p>') +
      '<button class="grande" id="add" style="background:#dc2626">➕ AGREGAR ' + (n ? 'OTRA ' : 'UNA ') + 'FALLA</button>' +
      (n ? '<div class="err" id="e"></div><button class="grande" id="env" style="background:#16a34a">✅ ENVIAR ' + (n === 1 ? 'LA FALLA' : 'LAS ' + n + ' FALLAS') + '</button>' : ''));
    app.querySelector('#a').addEventListener('click', () => self._inicio());
    app.querySelector('#cu').addEventListener('click', () => self._paso1());
    app.querySelector('#add').addEventListener('click', function () { r.f = { tipoUnidad: 'TRACTO' }; self._paso2(); });
    app.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', function () { r.lista.splice(Number(b.dataset.q), 1); self._lista(); }));
    const env = app.querySelector('#env');
    if (env) env.addEventListener('click', async function () {
      env.disabled = true; app.querySelector('#add').disabled = true;
      const pendientes = r.lista.slice(), quedan = [], errs = [], hechos = [];
      for (let i = 0; i < pendientes.length; i++) {
        const f = pendientes[i];
        env.textContent = 'Enviando ' + (i + 1) + ' de ' + pendientes.length + '… (no cierres)';
        let resp = null;
        try { resp = await llamarBackend('incReportar', { tipoUnidad: f.tipoUnidad, placa: f.placa, km: r.km, sistema: f.sistema, componente: f.componente, urgencia: f.urgencia, comentario: f.comentario, foto: f.foto || '' }); }
        catch (x) { resp = { ok: false, mensaje: 'Sin conexión' }; }
        if (resp && resp.ok) hechos.push(Object.assign({ reincidencia: resp.reincidencia }, f));
        else { quedan.push(f); errs.push((resp && resp.mensaje) || 'Error'); }
      }
      r.lista = quedan;
      if (quedan.length) { self._lista(errs); const e = document.querySelector('#incApp #e'); if (e) e.textContent = hechos.length + ' enviada(s). ' + quedan.length + ' no se pudo(ieron) enviar: revisa tu señal y toca ENVIAR otra vez.'; return; }
      self._listo(hechos);
    });
  },

  /* Agregar falla: unidad (tracto/carreta) y sistema. */
  _paso2: function () {
    const self = this, r = self._r, f = r.f;
    const sist = INC_CATALOGO[f.tipoUnidad];
    const pill = (t, ic, placa) => '<button class="op' + (f.tipoUnidad === t ? ' sel' : '') + '" data-t="' + t + '" style="min-height:64px;flex-direction:row"><span class="ic" style="font-size:1.6rem">' + ic + '</span>' + t + '<small style="color:#64748b">' + esc(placa) + '</small></button>';
    const app = self._pintar('<button class="atras" id="a">◀ Volver a la lista</button><div class="paso">AGREGAR FALLA · 1 DE 3</div>' +
      (r.carreta ? '<div class="grid" style="margin-bottom:12px">' + pill('TRACTO', '🚛', r.tracto) + pill('CARRETA', '🧊', r.carreta) + '</div>' : '') +
      '<h2>¿Qué parte del ' + (f.tipoUnidad === 'CARRETA' ? 'la carreta' : 'tracto') + ' falla?</h2>' +
      '<div class="grid">' + sist.map((s, i) => '<button class="op" data-i="' + i + '"><span class="ic">' + s[1] + '</span>' + esc(s[0]) + '</button>').join('') + '</div>');
    app.querySelector('#a').addEventListener('click', () => self._lista());
    app.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', function () { f.tipoUnidad = b.dataset.t; self._paso2(); }));
    app.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', function () {
      const s = sist[Number(b.dataset.i)]; f.sistema = s[0]; f.icono = s[1];
      if (s[2].length === 1) { f.componente = s[2][0]; self._paso4(); } else self._paso3(s);
    }));
  },

  _paso3: function (s) {
    const self = this, f = self._r.f;
    const app = self._pintar('<button class="atras" id="a">◀ Atrás</button><div class="paso">AGREGAR FALLA · 2 DE 3 · ' + s[1] + ' ' + esc(s[0]) + '</div><h2>¿Qué le pasa?</h2>' +
      '<div class="lista">' + s[2].map((c, i) => '<button class="op" data-i="' + i + '" style="width:100%">' + esc(c) + '</button>').join('') +
      '<button class="op" data-i="-1" style="width:100%">❓ OTRO (lo escribo)</button></div>');
    app.querySelector('#a').addEventListener('click', () => self._paso2());
    app.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', function () {
      const i = Number(b.dataset.i); f.componente = i < 0 ? 'OTRO' : s[2][i]; self._paso4();
    }));
  },

  _paso4: function () {
    const self = this, r = self._r, f = r.f;
    const app = self._pintar('<button class="atras" id="a">◀ Atrás</button><div class="paso">AGREGAR FALLA · 3 DE 3 · ' + esc(f.sistema) + ' › ' + esc(f.componente) + '</div>' +
      '<h2>¿Qué tan urgente es?</h2>' +
      INC_URGENCIAS.map(u => '<button class="urg" data-u="' + u[0] + '" style="' + (f.urgencia === u[0] ? 'border-color:' + u[3] + ';background:#fff7ed' : '') + '"><span class="ic">' + u[1] + '</span><span>' + u[0] + '<small>' + u[2] + '</small></span></button>').join('') +
      '<label class="l">📷 Foto de la falla (opcional)</label>' +
      '<label class="grande" style="background:#475569;cursor:pointer;margin:0" for="foto">📷 TOMAR FOTO</label><input type="file" id="foto" accept="image/*" capture="environment" style="display:none">' +
      '<div class="foto-prev" id="fp"></div>' +
      '<label class="l">✍️ Cuéntanos qué pasa ' + (f.componente === 'OTRO' ? '(obligatorio)' : '(opcional)') + '</label>' +
      '<textarea class="t" id="com" rows="3" placeholder="Puedes usar el micrófono 🎤 del teclado para dictar">' + esc(f.comentario || '') + '</textarea>' +
      '<div class="err" id="e"></div>' +
      '<button class="grande" id="ok" style="background:#1c3a5e">➕ AGREGAR A LA LISTA</button>');
    app.querySelector('#a').addEventListener('click', () => self._paso2());
    app.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', function () {
      f.urgencia = b.dataset.u;
      app.querySelectorAll('[data-u]').forEach(x => { const u = INC_URGENCIAS.filter(z => z[0] === x.dataset.u)[0]; x.style.borderColor = x === b ? u[3] : 'transparent'; x.style.background = x === b ? '#fff7ed' : '#fff'; });
    }));
    if (f.foto) app.querySelector('#fp').innerHTML = '<img src="' + f.foto + '">';
    app.querySelector('#foto').addEventListener('change', async function () {
      const fl = this.files && this.files[0]; if (!fl) return;
      app.querySelector('#fp').textContent = 'Preparando foto…';
      try { f.foto = await _incComprimir(fl); app.querySelector('#fp').innerHTML = '<img src="' + f.foto + '"><div class="ayuda">Foto lista ✔ (puedes tomar otra para cambiarla)</div>'; }
      catch (e) { f.foto = ''; app.querySelector('#fp').textContent = 'No se pudo leer la foto. Intenta otra vez.'; }
    });
    app.querySelector('#ok').addEventListener('click', function () {
      const e = app.querySelector('#e');
      f.comentario = app.querySelector('#com').value.trim();
      if (!f.urgencia) { e.textContent = 'Toca qué tan urgente es (rojo, naranja o verde).'; return; }
      if (f.componente === 'OTRO' && f.comentario.length < 3) { e.textContent = 'Escribe qué está fallando.'; app.querySelector('#com').focus(); return; }
      f.placa = f.tipoUnidad === 'CARRETA' ? r.carreta : r.tracto;
      r.lista.push(f); r.f = null;
      self._lista();
    });
  },

  _listo: function (hechos) {
    const self = this, r = self._r;
    const rep = hechos.filter(h => h.reincidencia).length;
    const app = self._pintar('<div style="text-align:center;font-size:4.5rem;margin-top:20px">✅</div><h2 style="text-align:center">¡' + (hechos.length === 1 ? 'Falla enviada' : hechos.length + ' fallas enviadas') + '!</h2>' +
      '<p style="text-align:center;font-size:1.05rem">El mecánico ya las puede ver.</p>' +
      (rep ? '<p style="text-align:center;font-weight:800;color:#b91c1c">⚠️ ' + rep + ' ya estaba(n) reportada(s) y aún no se arreglan: se marcaron como REPETIDAS y suben de prioridad.</p>' : '') +
      '<button class="grande" id="otra" style="background:#dc2626">🚨 REPORTAR MÁS FALLAS</button><button class="grande" id="ini" style="background:#1c3a5e">🏠 INICIO</button>');
    app.querySelector('#otra').addEventListener('click', function () { r.lista = []; self._lista(); });
    app.querySelector('#ini').addEventListener('click', () => { self._r = {}; self._inicio(); });
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
