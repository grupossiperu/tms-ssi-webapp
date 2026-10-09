/**
 * app.js
 * -------------------------------------------------------------------------
 * Núcleo de la SPA. Contiene:
 *   - CONFIG_APP.API_URL: URL del Web App de Apps Script (la pegas aquí
 *     después de publicar el backend; ver instrucciones al final del
 *     archivo).
 *   - llamarBackend(): wrapper de fetch que evita el preflight CORS
 *     (Content-Type text/plain + Apps Script no soporta preflight OPTIONS).
 *   - abrirPanel()/cerrarPanel(): gestión del modal/panel único donde se
 *     monta cada formulario, sin recargar la página (SPA real).
 *   - Router de los botones de la pantalla HOME.
 * -------------------------------------------------------------------------
 */

const CONFIG_APP = {
  // Pega aquí la URL de tu Web App de Apps Script, por ejemplo:
  // "https://script.google.com/macros/s/AKfycb.../exec"
  API_URL: "https://script.google.com/macros/s/AKfycbw7MzMKMvv8dOA_a4xETgWsG7zXzihmU211J5NeFBH7rId-jt1ajk2XbawpfXYNJ9wFZw/exec"
};

/**
 * Llama a una acción del backend (Code.gs -> ACCIONES[accion]).
 * Devuelve una Promise con la respuesta ya parseada (JSON).
 */
async function llamarBackend(accion, datos) {
  if (!CONFIG_APP.API_URL || CONFIG_APP.API_URL.indexOf('PEGA_AQUI') !== -1) {
    mostrarMensaje('El backend todavía no está conectado. Configura CONFIG_APP.API_URL en app.js con la URL de tu Web App de Apps Script.', 'error');
    throw new Error('API_URL no configurada');
  }

  const respuesta = await fetch(CONFIG_APP.API_URL, {
    method: 'POST',
    // text/plain evita que el navegador dispare un preflight OPTIONS,
    // que los Web Apps de Apps Script no responden.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ accion: accion, datos: datos || {}, token: Sesion.token() })
  });

  if (!respuesta.ok) {
    throw new Error('Error de red al llamar a ' + accion);
  }

  // Si Apps Script responde una página HTML de error (cuota, timeout), json() falla sin explicar nada.
  const texto = await respuesta.text();
  let r;
  try {
    r = JSON.parse(texto);
  } catch (e) {
    throw new Error('El servidor no respondió correctamente (' + accion + '). Intente de nuevo en unos segundos.');
  }
  // v73: sesión vencida o contraseña por cambiar -> pantalla de ingreso.
  if (r && r.sesion === false && accion !== 'login') {
    Sesion.vencida();
    throw new Error(MSG_SESION);
  }
  if (r && r.debeCambiar === true && r.ok === false) {
    Sesion.pedirCambio();
    throw new Error(MSG_SESION);
  }
  return r;
}

// Cualquier error de red o del servidor que un formulario no capture se avisa al usuario.
window.addEventListener('unhandledrejection', function (ev) {
  const msg = ev.reason && ev.reason.message ? ev.reason.message : 'Ocurrió un error inesperado.';
  if (msg === 'API_URL no configurada' || msg === MSG_SESION) { ev.preventDefault(); return; }
  ev.preventDefault();
  mostrarMensaje(msg, 'error');
});

/* ============================ Panel / Modal ============================ */

const contenedorPanel = document.getElementById('contenedor-panel');

/**
 * Abre el panel/modal con el título y el contenido HTML dados, y ejecuta
 * alInicializar(raizDelPanel) para que cada formulario conecte sus eventos.
 */
function abrirPanel(titulo, htmlContenido, alInicializar, opciones) {
  const claseAncho = (opciones && opciones.ancho) ? ' panel-ancho' : '';
  const claseExtra = (opciones && opciones.clase) ? ' ' + opciones.clase : '';
  contenedorPanel.innerHTML = `
    <div class="overlay-modal" id="overlay-panel">
      <div class="panel-modal${claseAncho}${claseExtra}">
        <div class="panel-header">
          <h2>${titulo}</h2>
          <button class="cerrar-panel" title="Cerrar" onclick="solicitarCierrePanel()">&times;</button>
        </div>
        <div class="panel-body" id="cuerpo-panel">${htmlContenido}</div>
      </div>
    </div>`;

  const overlay = document.getElementById('overlay-panel');
  overlay.addEventListener('click', function (ev) {
    if (ev.target === overlay) solicitarCierrePanel();
  });

  if (typeof alInicializar === 'function') {
    alInicializar(document.getElementById('cuerpo-panel'));
  }

  _snapshotFormulario = _serializarFormulario(document.getElementById('cuerpo-panel'));
}

/**
 * Serializa los valores actuales de todos los campos del formulario abierto,
 * para poder detectar si el usuario avanzó algo antes de cerrar el panel.
 */
function _serializarFormulario(raiz) {
  if (!raiz) return '';
  return Array.from(raiz.querySelectorAll('input, select, textarea')).map(function (el) {
    return el.id + '=' + (el.type === 'checkbox' ? el.checked : el.value);
  }).join('|');
}

let _snapshotFormulario = null;

/**
 * Vuelve a tomar la foto del estado del formulario (usar después de
 * navegar de una vista a otra dentro del mismo panel con actualizarPanel).
 */
function _refrescarSnapshotFormulario() {
  _snapshotFormulario = _serializarFormulario(document.getElementById('cuerpo-panel'));
}

/**
 * Cierra el panel, pero si el usuario ya avanzó datos en el formulario
 * (clic afuera del modal o el botón "x"), pide confirmación primero para
 * no perder el avance sin querer.
 */
function solicitarCierrePanel() {
  const cuerpo = document.getElementById('cuerpo-panel');
  if (cuerpo && _snapshotFormulario !== null) {
    const actual = _serializarFormulario(cuerpo);
    if (actual !== _snapshotFormulario) {
      if (!window.confirm('Tienes datos sin guardar en este formulario. ¿Seguro que deseas cerrarlo y perder el avance?')) {
        return;
      }
    }
  }
  cerrarPanel();
}

function cerrarPanel() {
  contenedorPanel.innerHTML = '';
  _snapshotFormulario = null;
}

/**
 * Reemplaza solo el cuerpo del panel abierto (para navegar de un
 * formulario a otro dentro del mismo flujo, p. ej. de "Consolidado de
 * Servicios" -> detalle, sin cerrar y reabrir el modal).
 */
function actualizarPanel(titulo, htmlContenido, alInicializar) {
  document.querySelector('.panel-header h2').textContent = titulo;
  const cuerpo = document.getElementById('cuerpo-panel');
  cuerpo.innerHTML = htmlContenido;
  if (typeof alInicializar === 'function') alInicializar(cuerpo);
  _refrescarSnapshotFormulario();
}

/* ============================ Mensajes / avisos ============================ */

function mostrarMensaje(texto, tipo) {
  // tipo: 'info' | 'error' | 'exito'
  alert(texto); // Reemplazable por un componente de toast más adelante.
}

function confirmar(texto) {
  return window.confirm(texto);
}

/* ============================ Utilidades compartidas ============================ */

const MESES = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** Escapa texto para insertarlo en innerHTML o en atributos value="...". */
function esc(t) {
  return String(t === null || t === undefined ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** Convierte a Date un valor de la hoja: ISO, o texto dd/mm/yyyy. Devuelve null si no es fecha. */
function _aFecha(v) {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim());
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** dd/mm/yyyy. Si no es fecha reconocible devuelve valorVacio (por defecto '-'). */
function formatoFecha(v, valorVacio) {
  const d = _aFecha(v);
  if (!d) return (v && v !== '-') ? String(v) : (valorVacio === undefined ? '-' : valorVacio);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

/** Nombre del mes (ENERO...) de un valor de fecha, o '' si no es fecha. */
function mesDeFecha(v) {
  const d = _aFecha(v);
  return d ? MESES[d.getMonth() + 1] : '';
}

/**
 * Conecta un botón que graba/envía: mientras la operación espera al servidor
 * el botón queda deshabilitado, así un doble clic no la repite.
 */
function protegerClic(boton, fn) {
  boton.addEventListener('click', async function (ev) {
    if (boton.dataset.ocupado) return;
    boton.dataset.ocupado = '1';
    boton.disabled = true;
    try {
      await fn.call(this, ev);
    } finally {
      delete boton.dataset.ocupado;
      boton.disabled = false;
    }
  });
}

/** Un resultado de carga es válido solo si existe y el backend no lo marcó como error. */
function respuestaValida(r) {
  return !!r && r.ok !== false;
}

/* ============================ Sesión (v73) ============================ */

const MSG_SESION = 'Su sesión venció. Ingrese nuevamente.';

/**
 * Inicio de sesión con usuario y contraseña (validados en el backend; aquí
 * nunca se guarda la contraseña, solo el token de la sesión de 12 horas).
 * Cada rol ve solo sus módulos: los elementos con data-modulo="OPER|FIN|MAE|
 * ALM|MANT|RES|ADMIN" se ocultan si el usuario no tiene ese módulo.
 */
const Sesion = {
  CLAVE: 'tms_sesion',
  _d: null,
  _listo: false,
  _cola: [],
  _claveIngresada: '',

  token: function () { return this._d ? this._d.token : ''; },
  datos: function () { return this._d; },
  puede: function (modulo) { return !!this._d && (this._d.modulos || []).indexOf(modulo) !== -1; },
  /** Ejecuta fn cuando ya hay una sesión válida (o de inmediato si ya la hay). */
  alListo: function (fn) { if (this._listo) fn(); else this._cola.push(fn); },

  _guardar: function (d) {
    this._d = d;
    try { localStorage.setItem(this.CLAVE, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ }
  },
  _borrar: function () {
    this._d = null; this._listo = false;
    try { localStorage.removeItem(this.CLAVE); } catch (e) { /* no-op */ }
  },

  iniciar: async function () {
    document.body.classList.add('sin-sesion');
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.CLAVE) || 'null'); } catch (e) { d = null; }
    if (!d || !d.token || !(d.vence > Date.now())) { this._borrar(); this.mostrarLogin(); return; }
    this._d = d;
    this.mostrarLogin('Verificando sesión…', true);
    try {
      const r = await llamarBackend('sesionInfo', {});
      if (!r || !r.ok) { this._borrar(); this.mostrarLogin(); return; }
      this._entrar(r);
    } catch (e) {
      if (e.message !== MSG_SESION) this.mostrarLogin('No se pudo verificar la sesión: ' + e.message);
    }
  },

  _entrar: function (r) {
    this._guardar({ token: r.token, usuario: r.usuario, nombre: r.nombre, rol: r.rol, modulos: r.modulos || [], vence: r.vence });
    if (r.debeCambiar) { this.pedirCambio(); return; }
    const ov = document.getElementById('loginOverlay');
    if (ov) ov.remove();
    document.body.classList.remove('sin-sesion');
    this.aplicarPermisos();
    if (!this._listo) {
      this._listo = true;
      const cola = this._cola; this._cola = [];
      cola.forEach(function (fn) { try { fn(); } catch (e) { /* no-op */ } });
    }
  },

  aplicarPermisos: function () {
    const self = this;
    document.querySelectorAll('[data-modulo]').forEach(function (el) {
      const mods = el.dataset.modulo.split(/\s+/);
      el.style.display = mods.some(function (m) { return self.puede(m); }) ? '' : 'none';
    });
    const d = this._d || {};
    const n = document.getElementById('homeUsuarioNombre');
    const r = document.getElementById('homeUsuarioRol');
    if (n) n.textContent = d.nombre || d.usuario || '';
    if (r) r.textContent = d.rol ? d.rol.charAt(0) + d.rol.slice(1).toLowerCase() : '';
  },

  vencida: function () {
    this._borrar();
    if (typeof cerrarPanel === 'function') cerrarPanel();
    this.mostrarLogin('Su sesión venció. Ingrese nuevamente.');
  },

  cerrar: async function () {
    if (!confirmar('¿Cerrar sesión?')) return;
    try { await llamarBackend('cerrarSesion', {}); } catch (e) { /* igual se cierra aquí */ }
    this._borrar();
    location.reload();
  },

  _caja: function (contenido) {
    let ov = document.getElementById('loginOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'loginOverlay';
      ov.className = 'login-overlay';
      document.body.appendChild(ov);
    }
    ov.innerHTML = '<div class="login-caja">' +
      '<div class="login-logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="1" y="7" width="14" height="10" rx="1"></rect><path d="M15 10h4l4 4v3h-8z"></path><circle cx="6" cy="18.5" r="2"></circle><circle cx="18" cy="18.5" r="2"></circle></svg></div>' +
      '<h2>TRANSPORTES SSI S.A.C.</h2>' + contenido + '<div class="login-error" id="loginError"></div></div>';
    return ov;
  },

  mostrarLogin: function (aviso, soloAviso) {
    const self = this;
    document.body.classList.add('sin-sesion');
    if (soloAviso) { self._caja('<p class="login-ayuda">' + esc(aviso) + '</p>'); return; }
    const ov = self._caja(
      '<p class="login-ayuda">Sistema de Servicios de Transporte</p>' +
      '<div class="campo"><label>Usuario</label><input type="text" id="loginUsuario" autocomplete="username" autocapitalize="none" spellcheck="false"></div>' +
      '<div class="campo"><label>Contraseña</label><input type="password" id="loginClave" autocomplete="current-password"></div>' +
      '<button class="boton-primario login-btn" id="loginBtn" type="button">Ingresar</button>');
    const err = ov.querySelector('#loginError');
    if (aviso) err.textContent = aviso;
    const btn = ov.querySelector('#loginBtn');
    const ingresar = async function () {
      const usuario = ov.querySelector('#loginUsuario').value.trim();
      const clave = ov.querySelector('#loginClave').value;
      if (!usuario || !clave) { err.textContent = 'Ingrese usuario y contraseña.'; return; }
      err.textContent = '';
      btn.disabled = true; btn.textContent = 'Ingresando…';
      try {
        const r = await llamarBackend('login', { usuario: usuario, clave: clave });
        if (!r || !r.ok) { err.textContent = (r && r.mensaje) || 'No se pudo ingresar.'; ov.querySelector('#loginClave').value = ''; return; }
        self._claveIngresada = clave;
        self._entrar(r);
      } catch (e) {
        err.textContent = 'Error de conexión: ' + e.message;
      } finally {
        btn.disabled = false; btn.textContent = 'Ingresar';
      }
    };
    btn.addEventListener('click', ingresar);
    ov.querySelector('#loginUsuario').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') ov.querySelector('#loginClave').focus(); });
    ov.querySelector('#loginClave').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') ingresar(); });
    setTimeout(function () { const u = ov.querySelector('#loginUsuario'); if (u) u.focus(); }, 50);
  },

  /** Primer ingreso o clave temporal: obliga a crear una contraseña propia. */
  pedirCambio: function () {
    const self = this;
    document.body.classList.add('sin-sesion');
    if (typeof cerrarPanel === 'function') cerrarPanel();
    const conocida = !!self._claveIngresada;
    const d = self._d || {};
    const ov = self._caja(
      '<p class="login-ayuda"><strong>' + esc(d.nombre || d.usuario || '') + '</strong>, cree su contraseña personal para continuar.<br>' +
      'Mínimo 8 caracteres, con letras y números, sin su nombre de usuario.</p>' +
      (conocida ? '' : '<div class="campo"><label>Contraseña actual</label><input type="password" id="cambioActual" autocomplete="current-password"></div>') +
      '<div class="campo"><label>Contraseña nueva</label><input type="password" id="cambioNueva" autocomplete="new-password"></div>' +
      '<div class="campo"><label>Repita la contraseña nueva</label><input type="password" id="cambioRepite" autocomplete="new-password"></div>' +
      '<button class="boton-primario login-btn" id="cambioBtn" type="button">Guardar y entrar</button>' +
      '<button class="boton-secundario login-btn" id="cambioSalir" type="button">Salir</button>');
    const err = ov.querySelector('#loginError');
    const btn = ov.querySelector('#cambioBtn');
    const guardar = async function () {
      const actual = conocida ? self._claveIngresada : ov.querySelector('#cambioActual').value;
      const nueva = ov.querySelector('#cambioNueva').value;
      if (nueva !== ov.querySelector('#cambioRepite').value) { err.textContent = 'Las contraseñas nuevas no coinciden.'; return; }
      err.textContent = '';
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const r = await llamarBackend('cambiarMiClave', { actual: actual, nueva: nueva });
        if (!r || !r.ok) { err.textContent = (r && r.mensaje) || 'No se pudo cambiar la contraseña.'; return; }
        self._claveIngresada = '';
        self._entrar(r);
        mostrarMensaje('Contraseña creada. Úsela desde ahora para ingresar.', 'exito');
      } catch (e) {
        if (e.message !== MSG_SESION) err.textContent = 'Error de conexión: ' + e.message;
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar y entrar';
      }
    };
    btn.addEventListener('click', guardar);
    ov.querySelector('#cambioRepite').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') guardar(); });
    ov.querySelector('#cambioSalir').addEventListener('click', function () { self._claveIngresada = ''; self._borrar(); self.mostrarLogin(); });
    setTimeout(function () { const f = ov.querySelector(conocida ? '#cambioNueva' : '#cambioActual'); if (f) f.focus(); }, 50);
  }
};

/* ============================ Router HOME ============================ */


/* ============================ Avisos de vencimiento ============================ */

/**
 * Consulta al backend los documentos (Conductores/Tractos/Semirremolques)
 * que estan vencidos o a 10 dias o menos de vencer, y muestra la franja
 * roja fija en la parte superior. Se ejecuta cada vez que se abre el TMS.
 */
async function verificarAvisosVencimiento() {
  try {
    const resp = await llamarBackend('listarAvisosVencimiento', {});
    if (!resp.ok) return;
    const avisos = resp.avisos || [];
    const franja = document.getElementById('franjaAvisosVencimiento');
    const texto = document.getElementById('textoAvisosVencimiento');
    if (!franja || !texto) return;
    if (!avisos.length) {
      franja.classList.remove('visible');
      return;
    }
    const vencidos = avisos.filter(function (a) { return a.vencido; }).length;
    const porVencer = avisos.length - vencidos;
    const partes = [];
    if (vencidos) partes.push(vencidos + ' vencido(s)');
    if (porVencer) partes.push(porVencer + ' por vencer en 10 días o menos');
    let resumen = '<strong>Documentos por actualizar:</strong> ' + partes.join(' y ') + '. ';
    resumen += avisos.slice(0, 5).map(function (a) {
      return a.nombre + ' - ' + a.documento + (a.vencido ? ' (vencido)' : ' (' + a.dias + ' d.)');
    }).join(' · ');
    if (avisos.length > 5) resumen += ' · y ' + (avisos.length - 5) + ' más...';
    texto.innerHTML = resumen;
    franja.classList.add('visible');
  } catch (e) {
    // Si falla la verificacion, no bloquea el uso normal del TMS.
  }
}
document.addEventListener('DOMContentLoaded', function () {
  Sesion.iniciar();
  Sesion.alListo(function () { if (Sesion.puede('OPER')) verificarAvisosVencimiento(); });

  const franjaAvisos = document.getElementById('franjaAvisosVencimiento');
  if (franjaAvisos) {
    franjaAvisos.addEventListener('click', function (ev) {
      if (ev.target && ev.target.id === 'btnCerrarAvisosVencimiento') {
        franjaAvisos.classList.remove('visible');
        return;
      }
      FormDocumentos.abrir();
    });
  }


  document.getElementById('btn-cerrar-sesion').addEventListener('click', function () { Sesion.cerrar(); });
  document.getElementById('btn-mi-clave').addEventListener('click', function () { FormUsuarios.cambiarMiClave(); });
  document.getElementById('btn-usuarios').addEventListener('click', function () { FormUsuarios.abrir(); });

  document.getElementById('btn-registrar-servicio').addEventListener('click', function () {
    FormServicio.abrir();
  });

  document.getElementById('btn-consolidado-servicios').addEventListener('click', function () {
    FormSelServicioContabilidad.abrir();
  });

  document.getElementById('btn-consolidado-servicios-completar').addEventListener('click', function () {
    FormConsolidadoServicios.abrir();
  });

  document.getElementById('btn-servicios-culminados').addEventListener('click', function () {
    FormServiciosCulminados.abrir();
  });

  document.getElementById('btn-control-combustible').addEventListener('click', function () {
    FormControlCombustible.abrir();
  });

  document.getElementById('btn-datos-viaje').addEventListener('click', function () {
    FormDatosViaje.abrir();
  });

  document.getElementById('btn-deposito').addEventListener('click', function () {
    FormDeposito.abrir();
  });

  document.getElementById('btn-sobrecostos').addEventListener('click', function () {
    FormSobrecostos.abrir();
  });

  document.getElementById('btn-facturar').addEventListener('click', function () {
    FormSelFacturaViaje.abrir();
  });

  document.getElementById('btn-tipo-cambio').addEventListener('click', function () {
    FormTipoCambio.abrir();
  });

  document.getElementById('btn-gestionar-peajes').addEventListener('click', function () {
    FormPeajes.abrir();
  });

  document.getElementById('btn-lista-conductores').addEventListener('click', function () {
    FormConductores.abrir();
  });

  document.getElementById('btn-documentos').addEventListener('click', function () {
    FormDocumentos.abrir();
  });

  document.getElementById('btn-tarifas').addEventListener('click', function () {
    FormTarifas.abrir();
  });

  document.getElementById('btn-ver').addEventListener('click', function () {
    FormAccesoServicios.abrir(function () {
      // Equivalente a hacer visibles las hojas del módulo: en la web
      // simplemente mostramos una franja de estado "hojas visibles".
      document.getElementById('estado-hojas').textContent = 'Hojas de servicios: VISIBLES';
      document.getElementById('estado-hojas').style.display = 'block';
    });
  });

  document.getElementById('btn-ocultar').addEventListener('click', function () {
    document.getElementById('estado-hojas').style.display = 'none';
    mostrarMensaje('Hojas de servicios ocultadas correctamente.', 'info');
  });
});
