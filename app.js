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
    body: JSON.stringify({ accion: accion, datos: datos || {} })
  });

  if (!respuesta.ok) {
    throw new Error('Error de red al llamar a ' + accion);
  }

  return respuesta.json();
}

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

/* ============================ Router HOME ============================ */

document.addEventListener('DOMContentLoaded', function () {

  document.getElementById('btn-registrar-servicio').addEventListener('click', function () {
    FormServicio.abrir();
  });

  document.getElementById('btn-consolidado-servicios').addEventListener('click', function () {
    FormSelServicioContabilidad.abrir();
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
