/**
 * forms/almacen.js
 * -------------------------------------------------------------------------
 * Módulo ALMACÉN. Copia el flujo del Excel (botones REGISTRAR PRODUCTO,
 * REGISTRAR PROVEEDOR, REGISTRAR INGRESO y REGISTRAR SALIDA) más la
 * ventana "Consultar stock" que el Excel abre con la lupa.
 *
 *  - Stock = "Stock Final" del último movimiento del Kardex (lo calcula el
 *    backend en mtDatosAlmacen).
 *  - Ingreso: con documento y proveedor; o "Ingreso REMAN" (extintor
 *    recargado, actualiza su vencimiento).
 *  - Salida: a una persona y placa; motivo MANTENIMIENTO queda PENDIENTE
 *    para asociarlo luego en "Registrar mantenimiento". También "Ingreso
 *    CORE" y "Salida CORE a recarga" para extintores.
 *  - Sin inicio de sesión por ahora: el usuario se escribe y se recuerda
 *    en este navegador.
 *
 * Backend (Code.gs -> ACCIONES): mtDatosAlmacen, mtGrabarProducto,
 * mtGrabarProveedor, mtGrabarIngreso, mtGrabarSalida.
 * -------------------------------------------------------------------------
 */

/* ---------------- Ayudantes compartidos con forms/mantenimiento.js ---------------- */
const MT = {
  usuario: function () {
    try { return localStorage.getItem('tms_mt_usuario') || ''; } catch (e) { return ''; }
  },
  guardarUsuario: function (u) {
    try { localStorage.setItem('tms_mt_usuario', String(u || '').trim().toUpperCase()); } catch (e) { /* sin almacenamiento */ }
  },
  hoy: function () {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  ahora: function () {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  },
  opciones: function (lista, textoVacio) {
    return (textoVacio !== undefined ? '<option value="">' + esc(textoVacio) + '</option>' : '') +
      lista.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  },
  datalist: function (id, lista) {
    return '<datalist id="' + id + '">' + lista.map(v => '<option value="' + esc(v) + '">').join('') + '</datalist>';
  },
  num: function (v) {
    const s = String(v === null || v === undefined ? '' : v).trim().replace(',', '.');
    return s === '' ? NaN : Number(s);
  },
  dinero: function (n) { return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2); },
  /** "yyyy-mm-dd" -> "dd/mm/yyyy" sin pasar por Date (evita el desfase de un día por zona horaria). */
  fechaVista: function (v) {
    const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : formatoFecha(v, '');
  },
  /** Llama al backend y avisa si falla. Devuelve la respuesta o null. */
  llamar: async function (accion, datos) {
    MT._cargando(1);
    let r;
    try {
      try {
        r = await llamarBackend(accion, datos);
      } catch (e) {
        // Las lecturas se reintentan una vez (Apps Script a veces falla al "despertar").
        // Las grabaciones NO, para no registrar dos veces.
        if (accion.indexOf('mtDatos') !== 0) throw e;
        await new Promise(res => setTimeout(res, 1500));
        r = await llamarBackend(accion, datos);
      }
    } finally {
      MT._cargando(-1);
    }
    if (!r || r.ok === false || r.error) {
      if (r && r.confirmarKm) return r;
      mostrarMensaje((r && (r.mensaje || r.error)) || 'No se pudo completar la operación.', 'error');
      return null;
    }
    return r;
  },
  /**
   * Escanea un código de barras/QR con la cámara (celular o laptop).
   * Usa el lector nativo del navegador si existe; si no, carga ZXing.
   */
  escanear: async function (alLeer) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      mostrarMensaje('Este navegador no permite usar la cámara. Usa el lector de código de barras o escribe el código.', 'error');
      return;
    }
    const capa = document.createElement('div');
    capa.className = 'overlay-modal';
    capa.style.zIndex = '1600';
    capa.innerHTML = '<div class="panel-modal" style="max-width:520px"><div class="panel-header"><h2>Escanear código</h2><button class="cerrar-panel" title="Cerrar">&times;</button></div>' +
      '<div class="panel-body" style="text-align:center"><video playsinline muted style="width:100%;border-radius:10px;background:#000;max-height:60vh"></video>' +
      '<div style="font-size:.85rem;color:#64748b;margin-top:8px">Apunta la cámara al código de barras del producto.</div></div></div>';
    document.body.appendChild(capa);
    const video = capa.querySelector('video');
    let stream = null, activo = true, lectorZx = null;
    const cerrar = function () {
      activo = false;
      try { if (lectorZx) lectorZx.reset(); } catch (e) { /* no-op */ }
      if (stream) stream.getTracks().forEach(t => t.stop());
      capa.remove();
    };
    const leido = function (codigo) { if (!activo) return; cerrar(); alLeer(String(codigo).trim().toUpperCase()); };
    capa.querySelector('.cerrar-panel').addEventListener('click', cerrar);
    try {
      if ('BarcodeDetector' in window) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector();
        const buscar = async function () {
          if (!activo) return;
          try { const r = await detector.detect(video); if (r && r.length) { leido(r[0].rawValue); return; } } catch (e) { /* sigue */ }
          setTimeout(buscar, 250);
        };
        buscar();
      } else {
        if (!window.ZXing) {
          await new Promise(function (ok, mal) {
            const sc = document.createElement('script');
            sc.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
            sc.onload = ok; sc.onerror = mal;
            document.head.appendChild(sc);
          });
        }
        lectorZx = new window.ZXing.BrowserMultiFormatReader();
        lectorZx.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, function (r) { if (r) leido(r.getText()); });
      }
    } catch (e) {
      cerrar();
      mostrarMensaje('No se pudo abrir la cámara (' + (e && e.message ? e.message : 'permiso denegado') + ').', 'error');
    }
  },

  /** Aviso "Cargando…" fijo mientras hay llamadas al servidor en curso. */
  _pendientes: 0,
  _cargando: function (delta) {
    MT._pendientes = Math.max(0, MT._pendientes + delta);
    let el = document.getElementById('mtCargando');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mtCargando';
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:3000;background:#142a44;color:#fff;' +
        'padding:10px 18px;border-radius:10px;font-weight:700;font-size:.9rem;box-shadow:0 6px 20px rgba(0,0,0,.25);display:none;';
      el.textContent = 'Cargando… un momento';
      document.body.appendChild(el);
    }
    el.style.display = MT._pendientes > 0 ? 'block' : 'none';
    document.body.style.cursor = MT._pendientes > 0 ? 'progress' : '';
  },
  /** Ventana encima del formulario abierto (no lo cierra). */
  sobreventana: function (titulo, html, alInicializar) {
    const capa = document.createElement('div');
    capa.className = 'overlay-modal';
    capa.style.zIndex = '1500';
    capa.innerHTML = '<div class="panel-modal panel-ancho" style="max-width:min(1250px,96vw);">' +
      '<div class="panel-header"><h2>' + esc(titulo) + '</h2><button class="cerrar-panel" title="Cerrar">&times;</button></div>' +
      '<div class="panel-body">' + html + '</div></div>';
    document.body.appendChild(capa);
    const cerrar = function () { capa.remove(); };
    capa.querySelector('.cerrar-panel').addEventListener('click', cerrar);
    capa.addEventListener('click', function (ev) { if (ev.target === capa) cerrar(); });
    alInicializar(capa.querySelector('.panel-body'), cerrar);
    return cerrar;
  }
};

const MT_ESTILOS = `
  <style>
    .mt-form .fila-campos{ grid-template-columns: repeat(4, minmax(0,1fr)); gap: 0 14px; }
    .mt-form .campo{ margin-bottom: 10px; }
    .mt-form .ancho2{ grid-column: span 2; }
    .mt-form .ancho4{ grid-column: 1 / -1; }
    .mt-form input[readonly]{ background:#eef1f5; color:#3c4754; }
    .mt-seccion{ border:1px solid #dde4ec; border-radius:12px; padding:12px 14px 4px; margin-bottom:12px; background:#fbfcfe; }
    .mt-seccion h3{ margin:0 0 10px; font-size:.82rem; letter-spacing:.6px; text-transform:uppercase; color:#5b6b7d; }
    .mt-seccion.mt-especial{ background:#fff8ec; border-color:#f3d9a7; }
    .mt-seccion.mt-especial h3{ color:#9a5b00; }
    .mt-buscar{ display:flex; gap:6px; }
    .mt-buscar input{ flex:1; }
    .mt-buscar button{ flex:0 0 auto; padding:0 12px; border:1.5px solid var(--azul-marino); border-radius:8px; background:#fff; color:var(--azul-marino); font-weight:700; cursor:pointer; }
    .mt-buscar button:hover{ background:var(--azul-marino); color:#fff; }
    .mt-stock{ font-weight:800; }
    .mt-botones{ display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; padding-top:6px; }
    .mt-ayuda{ font-size:.76rem; color:#64748b; margin-top:3px; }
    .mt-tabla-wrap{ max-height: 52vh; overflow:auto; border:1px solid #e1e6ec; border-radius:10px; }
    .mt-tabla-wrap .tabla-lista{ width:100%; font-size:.78rem; }
    .mt-tabla-wrap .tabla-lista th{ position:sticky; top:0; z-index:1; }
    .mt-tabla-wrap tr.mt-sel td{ background:#dbeafe !important; }
    .mt-tabla-wrap tbody tr{ cursor:pointer; }
    .mt-bajo{ color:#b91c1c; font-weight:800; }
    .mt-lineas{ width:100%; table-layout:fixed; font-size:.82rem; margin-bottom:8px; }
    .mt-lineas td{ vertical-align:middle; padding:5px 6px; }
    .mt-lineas input{ width:100%; padding:7px 9px; border:1.5px solid #c7ced8; border-radius:8px; font-size:.88rem; font-family:inherit; }
    .mt-lineas input.falta{ border-color:#dc2626; background:#fef2f2; }
    .mt-lineas .mt-buscar button{ padding:0 8px; font-size:.75rem; display:flex; align-items:center; }
    .mt-lineas .btn-quitar-l{ border:none; background:transparent; color:#b91c1c; font-size:1.2rem; cursor:pointer; }
    .mt-agregar{ border:1.5px dashed #94a3b8; background:#f8fafc; color:#1c3a5e; border-radius:8px; font-size:.82rem; font-weight:700; padding:7px 14px; cursor:pointer; margin-bottom:6px; }
    .mt-agregar:hover{ border-color:#1c3a5e; background:#eef3f8; }
    .mt-mini{ border:1px solid #1c3a5e; background:#fff; color:#1c3a5e; border-radius:6px; font-size:.72rem; font-weight:700; padding:2px 8px; cursor:pointer; }
    .mt-kres{ display:flex; flex-wrap:wrap; gap:10px; margin:4px 0 10px; }
    .mt-kres div{ background:#f1f5f9; border-radius:8px; padding:6px 12px; display:flex; flex-direction:column; min-width:120px; }
    .mt-kres span{ font-size:.68rem; text-transform:uppercase; color:#64748b; font-weight:700; }
    .mt-kres b{ font-size:1rem; color:#1c3a5e; }
    .mt-kres small{ font-size:.72rem; color:#64748b; }
    .mt-nuevo{ background:#dcfce7; color:#166534; border-radius:6px; font-size:.66rem; font-weight:800; padding:1px 6px; }
    .mt-incompleto{ background:#fef3c7; color:#92400e; border-radius:6px; font-size:.66rem; font-weight:800; padding:1px 6px; white-space:nowrap; }
    .mt-lineas tr.l-ok-nuevo td{ background:#f0fdf4; }
    .mt-crear{ background:#f8fafc; border:1.5px solid #94a3b8; border-radius:10px; padding:10px 12px; margin:2px 0 6px; }
    .mt-crear-tit{ font-size:.76rem; font-weight:800; color:#1c3a5e; text-transform:uppercase; margin-bottom:6px; }
    .mt-crear-g{ display:grid; grid-template-columns: 2fr 1.3fr 1.2fr 1fr auto auto; gap:8px; align-items:end; }
    .mt-crear-g label{ font-size:.74rem; font-weight:700; color:#334155; display:flex; flex-direction:column; gap:3px; }
    .mt-crear-g label.chk{ flex-direction:row; align-items:center; gap:5px; padding-bottom:8px; }
    .mt-crear-g label.chk input{ width:auto; }
    .mt-crear-g input, .mt-crear-g select{ padding:7px 9px; border:1.5px solid #c7ced8; border-radius:8px; font-size:.86rem; font-family:inherit; width:100%; }
    .mt-crear-b{ display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
    .mt-crear-b button{ padding:7px 14px; font-size:.82rem; }
    .mt-crear-g.g4{ grid-template-columns: repeat(4, minmax(0,1fr)); }
    .mt-crear-g .s2{ grid-column: span 2; }
    .mt-crear-b .mt-quitar{ margin-right:auto; background:#fff; color:#b91c1c; border:1.5px solid #fca5a5; border-radius:8px; font-weight:700; cursor:pointer; }
    .mt-crear-b .mt-quitar:hover{ background:#fef2f2; }
    .mt-sug{ position:fixed; z-index:4000; background:#fff; border:1.5px solid #94a3b8; border-radius:10px; box-shadow:0 10px 28px rgba(15,23,42,.18); max-height:300px; overflow:auto; font-size:.82rem; }
    .mt-sug div{ padding:7px 10px; cursor:pointer; border-bottom:1px solid #eef2f6; }
    .mt-sug div:last-child{ border-bottom:none; }
    .mt-sug div.act, .mt-sug div:hover{ background:#e8f0fb; }
    .mt-sug small{ display:block; color:#64748b; font-size:.72rem; }
    .mt-sug .sug-nuevo{ color:#1d4ed8; font-weight:800; }
    .mt-sug .sug-no{ color:#991b1b; cursor:default; }
    .mt-sug .sug-no:hover{ background:#fff; }
    .mt-tabs{ display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap; }
    .mt-tab{ border:1.5px solid #c7ced8; background:#fff; color:#1c3a5e; border-radius:9px; padding:7px 14px; font-weight:700; font-size:.84rem; cursor:pointer; font-family:inherit; }
    .mt-tab.activo{ background:#1c3a5e; border-color:#1c3a5e; color:#fff; }
    .mt-tab .n{ background:#dc2626; color:#fff; border-radius:999px; padding:0 7px; margin-left:6px; font-size:.72rem; }
    .mt-estado{ border-radius:7px; padding:2px 7px; font-size:.7rem; font-weight:800; white-space:nowrap; }
    .mt-estado.danado{ background:#fee2e2; color:#991b1b; } .mt-estado.enrep{ background:#fef3c7; color:#92400e; }
    .mt-estado.ret{ background:#dcfce7; color:#166534; } .mt-estado.baja{ background:#e2e8f0; color:#334155; }
    @media (max-width: 900px){ .mt-form .fila-campos{ grid-template-columns: repeat(2, minmax(0,1fr)); } .mt-crear-g{ grid-template-columns: 1fr 1fr; } }
  </style>`;

const MT_TIPOS_PRODUCTO = ['FILTRO', 'RODAJE', 'LUCES', 'MOTOR', 'FAJA', 'ACEITE', 'MANGUERA', 'TERMINAL', 'PERNO', 'SENSOR',
  'ELÉCTRICO', 'FRENO', 'LLANTA', 'HERRAMIENTA', 'ACCESORIO', 'EXTINTOR', 'CONSUMIBLE', 'TUBERIA', 'CHASIS', 'OTROS'];
const MT_CATEGORIAS = ['NUEVO', 'USADO', 'REMAN', 'CORE'];
const MT_UNIDADES = ['UNIDAD', 'DOCENA', 'CILINDRO', 'BALDE', 'CAJA', 'GALÓN', 'KILO', 'BOLSA', 'PAQUETE', 'JUEGO', 'LITRO', 'METRO', 'PAR', 'KIT'];
const MT_MOTIVOS_SALIDA = ['MANTENIMIENTO', 'CONSUMO INTERNO', 'OTROS'];
const MT_DIAS_AVISO_VENCIMIENTO = 30;

const FormAlmacen = {

  _datos: null,

  _t: 0,

  /** Usa los datos ya cargados si tienen menos de 1 minuto (forzar = siempre del servidor). */
  _cargar: async function (forzar) {
    if (!forzar && this._datos && Date.now() - this._t < 60000) return this._datos;
    const r = await MT.llamar('mtDatosAlmacen', {});
    if (r && !Array.isArray(r.productos)) {
      mostrarMensaje('El servidor no devolvió los datos del almacén. Intente de nuevo en unos segundos.', 'error');
      return null;
    }
    if (r) { this._datos = r; this._t = Date.now(); this.actualizarAvisoAlertas(); }
    return r;
  },

  _producto: function (codigo) {
    const c = String(codigo || '').trim().toUpperCase();
    return (this._datos ? this._datos.productos : []).find(p => p.codigo === c) || null;
  },

  _campoUsuario: function (id) {
    return '<div class="campo"><label>Usuario</label><input type="text" id="' + id + '" value="' + esc(MT.usuario()) +
      '" placeholder="Su nombre" autocomplete="off" style="text-transform:uppercase"></div>';
  },

  /* ============================ CONSULTAR STOCK ============================ */

  /**
   * Abre "Consultar stock". Si se pasa alSeleccionar(producto), muestra el
   * botón Seleccionar (como cuando el Excel la abre desde Ingreso/Salida).
   */
  consultarStock: async function (alSeleccionar) {
    if (!this._datos && !(await this._cargar())) return;
    const self = this;
    const filtros = [
      ['codigo', 'Código'], ['producto', 'Producto'], ['proveedor', 'Proveedor'],
      ['marca', 'Marca'], ['categoria', 'Categoría'], ['ubicacion', 'Ubicación']
    ];
    const unicos = campo => Array.from(new Set(self._datos.productos.map(p => p[campo]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="fila-campos" style="grid-template-columns:repeat(6,minmax(0,1fr));">
          ${filtros.map(f => '<div class="campo"><label>' + f[1] + '</label><input type="text" list="dlStock_' + f[0] + '" id="fStock_' + f[0] + '" autocomplete="off">' + MT.datalist('dlStock_' + f[0], unicos(f[0])) + '</div>').join('')}
        </div>
        <div class="mt-ayuda" id="stockCuenta" style="margin-bottom:6px;"></div>
        <div class="mt-tabla-wrap">
          <table class="tabla-lista" id="tablaStock">
            <thead><tr><th>Código</th><th>Producto</th><th>Proveedor</th><th>Marca</th><th>Categoría</th><th>Ubicación</th><th>Precio</th><th>Stock</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="mt-botones">
          <button class="boton-secundario" id="btnLimpiarStock">Limpiar filtros</button>
          <button class="boton-secundario" id="btnCerrarStock">${alSeleccionar ? 'Cancelar' : 'Cerrar'}</button>
          ${alSeleccionar ? '<button class="boton-primario" id="btnSeleccionarStock">Seleccionar</button>' : ''}
        </div>
      </div>`;

    MT.sobreventana('Consultar stock', html, function (raiz, cerrar) {
      let elegido = null;
      function pintar() {
        const f = {};
        filtros.forEach(x => { f[x[0]] = raiz.querySelector('#fStock_' + x[0]).value.trim().toUpperCase(); });
        const filas = self._datos.productos.filter(p => filtros.every(x => !f[x[0]] || String(p[x[0]] || '').toUpperCase().indexOf(f[x[0]]) !== -1));
        raiz.querySelector('#stockCuenta').textContent = filas.length + ' producto(s)';
        const tbody = raiz.querySelector('#tablaStock tbody');
        tbody.innerHTML = filas.map(p => {
          const bajo = p.stockMinimo > 0 && p.stock <= p.stockMinimo;
          return '<tr data-codigo="' + esc(p.codigo) + '"' + (elegido === p.codigo ? ' class="mt-sel"' : '') + '>' +
            '<td>' + esc(p.codigo) + '</td><td>' + esc(p.producto) + '</td><td>' + esc(p.proveedor) + '</td>' +
            '<td>' + esc(p.marca) + '</td><td>' + esc(p.categoria) + '</td><td>' + esc(p.ubicacion) + '</td>' +
            '<td style="white-space:nowrap">' + esc(p.moneda) + ' ' + MT.dinero(p.total) + '</td>' +
            '<td class="mt-stock' + (bajo ? ' mt-bajo' : '') + '" style="text-align:center">' + esc(p.stock) + '</td></tr>';
        }).join('') || '<tr><td colspan="8" style="text-align:center;color:#8b95a1;padding:16px;">Sin productos con estos filtros.</td></tr>';
      }
      filtros.forEach(x => raiz.querySelector('#fStock_' + x[0]).addEventListener('input', pintar));
      raiz.querySelector('#tablaStock tbody').addEventListener('click', function (ev) {
        const tr = ev.target.closest('tr[data-codigo]');
        if (!tr) return;
        elegido = tr.dataset.codigo;
        raiz.querySelectorAll('#tablaStock tr.mt-sel').forEach(t => t.classList.remove('mt-sel'));
        tr.classList.add('mt-sel');
      });
      raiz.querySelector('#tablaStock tbody').addEventListener('dblclick', function (ev) {
        const tr = ev.target.closest('tr[data-codigo]');
        if (tr && alSeleccionar) { alSeleccionar(self._producto(tr.dataset.codigo)); cerrar(); }
      });
      raiz.querySelector('#btnLimpiarStock').addEventListener('click', function () {
        filtros.forEach(x => { raiz.querySelector('#fStock_' + x[0]).value = ''; });
        pintar();
      });
      raiz.querySelector('#btnCerrarStock').addEventListener('click', cerrar);
      if (alSeleccionar) {
        raiz.querySelector('#btnSeleccionarStock').addEventListener('click', function () {
          if (!elegido) { mostrarMensaje('Seleccione un producto de la lista.', 'error'); return; }
          alSeleccionar(self._producto(elegido));
          cerrar();
        });
      }
      pintar();
    });
  },

  abrirConsultaStock: async function () {
    if (!(await this._cargar(true))) return;
    await this.consultarStock(null);
  },

  /* ============================ PRODUCTO ============================ */

  abrirProducto: async function () {
    if (!(await this._cargar())) return;
    const self = this;
    const tipos = MT_TIPOS_PRODUCTO.slice();
    self._datos.productos.forEach(p => { if (p.tipo && tipos.indexOf(p.tipo) === -1) tipos.push(p.tipo); });

    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="mt-seccion"><h3>Producto</h3>
          <div class="fila-campos">
            <div class="campo ancho2"><label>Código del producto</label>
              <div class="mt-buscar"><input type="text" id="pCodigo" autocomplete="off" placeholder="Escanea el código de barras o genera uno" style="text-transform:uppercase"><button type="button" id="btnEscanearCodigo" title="Escanear con la cámara">Escanear</button><button type="button" id="btnGenerarCodigo">Generar código</button></div>
            </div>
            ${self._campoUsuario('pUsuario')}
            <div class="campo"><label>Tipo de producto</label><input type="text" id="pTipo" list="dlTipos" autocomplete="off" style="text-transform:uppercase">${MT.datalist('dlTipos', tipos)}</div>
            <div class="campo ancho2"><label>Producto</label><input type="text" id="pProducto" autocomplete="off" style="text-transform:uppercase"></div>
            <div class="campo ancho2"><label>Marca</label><input type="text" id="pMarca" autocomplete="off" style="text-transform:uppercase"></div>
            <div class="campo"><label>Categoría</label><select id="pCategoria">${MT.opciones(MT_CATEGORIAS, '')}</select></div>
            <div class="campo"><label>Unidad de medida</label><select id="pUnidad">${MT.opciones(MT_UNIDADES, '')}</select></div>
            <div class="campo"><label>Ubicación</label><input type="text" id="pUbicacion" autocomplete="off" style="text-transform:uppercase"></div>
            <div class="campo"><label>Stock mínimo</label><input type="number" id="pStockMin" min="0" step="any"></div>
          </div>
        </div>
        <div class="mt-seccion"><h3>Precio</h3>
          <div class="fila-campos">
            <div class="campo"><label>Moneda</label><select id="pMoneda">${MT.opciones(['S/', '$'], '')}</select></div>
            <div class="campo"><label>Subtotal (sin IGV)</label><input type="number" id="pSubtotal" min="0" step="any"></div>
            <div class="campo"><label>IGV (18%)</label><input type="text" id="pIgv" readonly></div>
            <div class="campo"><label>Total (con IGV)</label><input type="number" id="pTotal" min="0" step="any"></div>
            <div class="campo"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="pVence" style="width:auto"> ¿Tiene vencimiento?</label></div>
            <div class="campo"><label>Fecha de vencimiento</label><input type="date" id="pFechaVence" disabled></div>
          </div>
          <div class="mt-ayuda">Escriba el subtotal o el total: el otro y el IGV se calculan solos.</div>
        </div>
        <div class="mt-botones">
          <button class="boton-secundario" id="btnInicioProducto">Inicio</button>
          <button class="boton-secundario" id="btnLimpiarProducto">Limpiar</button>
          <button class="boton-primario" id="btnGrabarProducto">Grabar</button>
        </div>
      </div>`;

    abrirPanel('Registrar producto', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      const abreviar = function (t) {
        t = String(t || '').trim().toUpperCase()
          .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ñ/g, 'N')
          .replace(/[.,]/g, '').replace(/[-/]/g, ' ');
        if (t === 'GENERICO') return 'GEN';
        return t.replace(/\s/g, '').slice(0, 3);
      };
      // Código de barras del fabricante: con el lector USB (escribe y da Enter) o con la cámara.
      const avisarSiExiste = function () {
        const c = $('pCodigo').value.trim().toUpperCase();
        $('pCodigo').value = c;
        if (c && self._producto(c)) mostrarMensaje('El código ' + c + ' ya está registrado (' + self._producto(c).producto + ').', 'error');
      };
      $('pCodigo').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); avisarSiExiste(); $('pProducto').focus(); } });
      $('pCodigo').addEventListener('change', avisarSiExiste);
      $('btnEscanearCodigo').addEventListener('click', function () {
        MT.escanear(function (c) { $('pCodigo').value = c; avisarSiExiste(); $('pProducto').focus(); });
      });
      $('btnGenerarCodigo').addEventListener('click', function () {
        const prod = $('pProducto').value.trim(), marca = $('pMarca').value.trim();
        if (!prod) { mostrarMensaje('Ingrese primero el nombre del producto.', 'error'); return; }
        if (!marca) { mostrarMensaje('Ingrese primero la marca del producto.', 'error'); return; }
        const base = abreviar(prod) + '-' + abreviar(marca);
        let n = 1, cod;
        do { cod = base + '-' + String(n).padStart(3, '0'); n++; } while (self._producto(cod));
        $('pCodigo').value = cod;
      });
      $('pSubtotal').addEventListener('change', function () {
        const s = MT.num(this.value);
        if (isNaN(s) || s < 0) { $('pIgv').value = ''; return; }
        $('pIgv').value = MT.dinero(s * 0.18); $('pTotal').value = MT.dinero(s * 1.18); this.value = MT.dinero(s);
      });
      $('pTotal').addEventListener('change', function () {
        const t = MT.num(this.value);
        if (isNaN(t) || t < 0) { $('pIgv').value = ''; return; }
        const s = t / 1.18;
        $('pSubtotal').value = MT.dinero(s); $('pIgv').value = MT.dinero(t - s); this.value = MT.dinero(t);
      });
      $('pVence').addEventListener('change', function () {
        $('pFechaVence').disabled = !this.checked;
        if (!this.checked) $('pFechaVence').value = '';
      });
      function limpiar() {
        ['pCodigo', 'pProducto', 'pMarca', 'pTipo', 'pCategoria', 'pUnidad', 'pUbicacion', 'pStockMin', 'pMoneda', 'pSubtotal', 'pIgv', 'pTotal', 'pFechaVence']
          .forEach(id => { $(id).value = ''; });
        $('pVence').checked = false; $('pFechaVence').disabled = true;
        _refrescarSnapshotFormulario();
      }
      $('btnLimpiarProducto').addEventListener('click', limpiar);
      $('btnInicioProducto').addEventListener('click', solicitarCierrePanel);
      protegerClic($('btnGrabarProducto'), async function () {
        const usuario = $('pUsuario').value.trim();
        if (!usuario) { mostrarMensaje('Ingrese el usuario.', 'error'); return; }
        MT.guardarUsuario(usuario);
        const r = await MT.llamar('mtGrabarProducto', {
          codigo: $('pCodigo').value, usuario: usuario, producto: $('pProducto').value, marca: $('pMarca').value,
          tipo: $('pTipo').value, categoria: $('pCategoria').value, unidad: $('pUnidad').value, ubicacion: $('pUbicacion').value,
          stockMinimo: $('pStockMin').value, moneda: $('pMoneda').value,
          subtotal: $('pSubtotal').value, total: $('pSubtotal').value ? '' : $('pTotal').value,
          tieneVencimiento: $('pVence').checked, fechaVencimiento: $('pFechaVence').value
        });
        if (!r) return;
        mostrarMensaje(r.mensaje + ' Código: ' + r.codigo, 'exito');
        self._datos.productos.push({ codigo: r.codigo, producto: $('pProducto').value.toUpperCase(), stock: 0 });
        limpiar();
      });
    }, { clase: 'panel-servicio' });
  },

  /* ============================ PROVEEDOR ============================ */

  abrirProveedor: function () {
    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="fila-campos" style="grid-template-columns:repeat(2,minmax(0,1fr));">
          <div class="campo ancho4"><label>Razón social *</label><input type="text" id="vRazon" autocomplete="off" style="text-transform:uppercase"></div>
          <div class="campo"><label>RUC *</label><input type="text" id="vRuc" maxlength="11" inputmode="numeric" autocomplete="off"></div>
          <div class="campo"><label>Nombre del vendedor</label><input type="text" id="vContacto" autocomplete="off" style="text-transform:uppercase"></div>
          <div class="campo"><label>Teléfono</label><input type="text" id="vTelefono" inputmode="numeric" autocomplete="off"></div>
          <div class="campo"><label>Correo</label><input type="email" id="vCorreo" autocomplete="off"></div>
          <div class="campo ancho4"><label>Dirección</label><input type="text" id="vDireccion" autocomplete="off" style="text-transform:uppercase"></div>
          <div class="campo ancho4"><label>Ubicación (enlace de Google Maps)</label><input type="text" id="vMapa" autocomplete="off" placeholder="https://maps.app.goo.gl/..."></div>
        </div>
        <div class="mt-ayuda">Obligatorio: razón social y RUC.</div>
        <div class="mt-botones">
          <button class="boton-secundario" id="btnInicioProveedor">Inicio</button>
          <button class="boton-secundario" id="btnLimpiarProveedor">Limpiar</button>
          <button class="boton-primario" id="btnGrabarProveedor">Grabar</button>
        </div>
      </div>`;

    abrirPanel('Registrar proveedor', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      const ids = ['vRazon', 'vRuc', 'vContacto', 'vTelefono', 'vCorreo', 'vDireccion', 'vMapa'];
      const limpiar = function () { ids.forEach(id => { $(id).value = ''; }); _refrescarSnapshotFormulario(); };
      $('btnLimpiarProveedor').addEventListener('click', limpiar);
      $('btnInicioProveedor').addEventListener('click', solicitarCierrePanel);
      protegerClic($('btnGrabarProveedor'), async function () {
        const r = await MT.llamar('mtGrabarProveedor', {
          razonSocial: $('vRazon').value, ruc: $('vRuc').value, contacto: $('vContacto').value,
          telefono: $('vTelefono').value, correo: $('vCorreo').value, direccion: $('vDireccion').value, ubicacion: $('vMapa').value.trim()
        });
        if (!r) return;
        mostrarMensaje(r.mensaje, 'exito');
        FormAlmacen._datos = null;
        limpiar();
      });
    });
  },

  /* ============================ LÍNEAS DE PRODUCTOS (ingreso y salida) ============================ */

  /**
   * Tabla de productos de un documento. Cada línea: código (escribir, lector
   * de código de barras, lupa o cámara), producto, stock y cantidad.
   * Enter en el código pasa a la cantidad; Enter en la cantidad agrega otra línea.
   */
  /** Abreviatura para generar códigos (igual que "Generar código" del Excel). */
  _abreviar: function (t) {
    t = String(t || '').trim().toUpperCase()
      .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ñ/g, 'N')
      .replace(/[.,]/g, '').replace(/[-/]/g, ' ');
    if (t === 'GENERICO') return 'GEN';
    return t.replace(/\s/g, '').slice(0, 3);
  },
  /** Código libre PRO-MAR-001 que no exista en el almacén ni en "reservados". */
  _generarCodigo: function (producto, marca, reservados) {
    const base = this._abreviar(producto) + '-' + this._abreviar(marca);
    let n = 1, cod;
    do { cod = base + '-' + String(n).padStart(3, '0'); n++; } while (this._producto(cod) || (reservados || []).indexOf(cod) !== -1);
    return cod;
  },
  _tiposProducto: function () {
    const tipos = MT_TIPOS_PRODUCTO.slice();
    (this._datos ? this._datos.productos : []).forEach(p => { if (p.tipo && tipos.indexOf(p.tipo) === -1) tipos.push(p.tipo); });
    return tipos;
  },

  /**
   * Tabla de productos de un documento. Cada línea: código (escribir, lector
   * de código de barras, lupa o cámara), producto, stock y cantidad.
   * Enter en el código pasa a la cantidad; Enter en la cantidad agrega otra línea.
   * En el INGRESO, si el código no existe, "Crear aquí" abre los datos mínimos
   * del producto nuevo en la misma fila (se crea al grabar el ingreso).
   */
  _lineas: function (raiz, idTabla, esSalida, alCambiar) {
    const self = this;
    const tbody = raiz.querySelector('#' + idTabla + ' tbody');
    const avisar = function () { if (typeof alCambiar === 'function') alCambiar(); };
    const camara = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>';
    // ---- Buscador: código, nombre, marca, tipo o categoría ----
    let sug = null, sugTr = null, sugItems = [], sugAct = 0;
    const normal = function (t) { return String(t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    function buscar(texto) {
      const palabras = normal(texto).split(/\s+/).filter(Boolean);
      if (!palabras.length) return [];
      return (self._datos ? self._datos.productos : []).filter(function (p) {
        const h = normal([p.codigo, p.producto, p.marca, p.tipo, p.categoria].join(' '));
        return palabras.every(function (w) { return h.indexOf(w) !== -1; });
      }).sort(function (a, b) { return (b.stock > 0) - (a.stock > 0) || a.producto.localeCompare(b.producto); }).slice(0, 12);
    }
    function cerrarSug() { if (sug) { sug.remove(); sug = null; } sugTr = null; sugItems = []; }
    function pareceCodigo(t) { return /^[A-Z0-9\-]+$/.test(t) && /\d/.test(t); }
    function mostrarSug(tr) {
      const cod = tr.querySelector('.l-cod');
      const texto = cod.value.trim();
      if (!texto || self._producto(texto)) { cerrarSug(); return; }
      const lista = buscar(texto);
      if (!sug) {
        sug = document.createElement('div');
        sug.className = 'mt-sug';
        document.body.appendChild(sug);
        sug.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
        sug.addEventListener('click', function (ev) {
          const d = ev.target.closest('[data-i]'); if (!d || !sugTr) return;
          elegirSug(sugTr, Number(d.dataset.i));
        });
      }
      sugTr = tr;
      sugItems = lista.map(function (p) { return { p: p }; });
      if (!esSalida) sugItems.push({ nuevo: true });
      sugAct = 0;
      sug.innerHTML = (lista.length ? '' : '<div class="sug-no">Sin coincidencias' + (esSalida ? '. Si es nuevo, regístralo desde Ingreso.' : '') + '</div>') +
        sugItems.map(function (it, i) {
          if (it.nuevo) return '<div data-i="' + i + '" class="sug-nuevo">+ Agregar producto nuevo' + (pareceCodigo(texto.toUpperCase()) ? ' con código ' + esc(texto.toUpperCase()) : ': ' + esc(texto.toUpperCase())) + '</div>';
          const p = it.p;
          return '<div data-i="' + i + '"><b>' + esc(p.producto) + '</b> <span style="color:#64748b">(' + esc(p.codigo) + ')</span><small>' +
            esc([p.marca, p.tipo, p.categoria].filter(Boolean).join(' · ')) + ' · stock ' + esc(p.stock) + '</small></div>';
        }).join('');
      const r = cod.getBoundingClientRect();
      sug.style.left = r.left + 'px';
      sug.style.top = (r.bottom + 2) + 'px';
      sug.style.width = Math.max(r.width + 120, 380) + 'px';
      pintarAct();
    }
    function pintarAct() {
      if (!sug) return;
      sug.querySelectorAll('[data-i]').forEach(function (d) { d.classList.toggle('act', Number(d.dataset.i) === sugAct); });
      const a = sug.querySelector('[data-i="' + sugAct + '"]'); if (a) a.scrollIntoView({ block: 'nearest' });
    }
    function elegirSug(tr, i) {
      const it = sugItems[i]; if (!it) return;
      const cod = tr.querySelector('.l-cod');
      cerrarSug();
      if (it.nuevo) {
        const t = cod.value.trim().toUpperCase();
        if (pareceCodigo(t)) abrirCreacion(tr);
        else { cod.value = ''; pintarFila(tr); abrirCreacion(tr, t); }
      } else {
        cod.value = it.p.codigo; tr._nuevo = null; pintarFila(tr); tr.querySelector('.l-cant').focus();
      }
      avisar();
    }
    raiz.addEventListener('scroll', cerrarSug, true);
    const codigosNuevos = function (salvo) {
      return Array.from(tbody.querySelectorAll('tr.l-fila')).filter(t => t !== salvo && t._nuevo).map(t => t._nuevo.codigo);
    };
    function pintarFila(tr) {
      const codigo = tr.querySelector('.l-cod').value.trim().toUpperCase();
      const p = self._producto(codigo);
      if (p && tr._nuevo) tr._nuevo = null;
      if (tr._nuevo && tr._nuevo.codigo !== codigo) tr._nuevo = null;
      const cant = MT.num(tr.querySelector('.l-cant').value);
      let html = '';
      if (p) html = '<b>' + esc(p.producto) + '</b><div class="mt-ayuda">' + esc([p.marca, p.categoria, p.ubicacion].filter(Boolean).join(' · ')) + '</div>';
      else if (tr._nuevo) html = '<b>' + esc(tr._nuevo.producto) + '</b> <span class="mt-nuevo">NUEVO</span> <button type="button" class="mt-mini l-editar">Editar</button><div class="mt-ayuda">' + esc([tr._nuevo.marca, tr._nuevo.tipo, tr._nuevo.unidad].join(' · ')) + '</div>';
      else if (codigo) html = esSalida ? '<span class="mt-bajo">No existe.</span><div class="mt-ayuda">Regístralo primero desde Ingreso.</div>'
        : '<span class="mt-bajo">No existe</span> <button type="button" class="mt-mini l-crear">Agregar producto nuevo</button>';
      tr.querySelector('.l-prod').innerHTML = html;
      tr.classList.toggle('l-ok-nuevo', !!tr._nuevo);
      tr.querySelector('.l-stock').textContent = p ? p.stock : (tr._nuevo ? '0' : '');
      const mal = esSalida && p && !isNaN(cant) && cant > p.stock;
      tr.querySelector('.l-stock').classList.toggle('mt-bajo', !!mal);
      tr.querySelector('.l-cant').classList.toggle('falta', !!mal);
      const ed = tr.querySelector('.l-editar');
      if (ed) ed.addEventListener('click', function () { abrirCreacion(tr); });
      const crear = tr.querySelector('.l-crear');
      if (crear) crear.addEventListener('click', function () { crearDesdeTexto(tr); });
    }
    // Abre la ficha del producto nuevo: si lo escrito parece código lo usa como código; si no, como nombre.
    function crearDesdeTexto(tr) {
      const cod = tr.querySelector('.l-cod');
      const t = cod.value.trim().toUpperCase();
      if (t && !pareceCodigo(t)) { cod.value = ''; tr._nuevo = null; pintarFila(tr); abrirCreacion(tr, t); }
      else abrirCreacion(tr);
    }
    // Datos mínimos del producto nuevo, en una sub-fila debajo de la línea.
    // Ficha del producto nuevo, en una sub-fila debajo de la línea.
    // nombreInicial: lo que se escribió en el buscador (si no era un código).
    function abrirCreacion(tr, nombreInicial) {
      if (tr.nextSibling && tr.nextSibling.classList && tr.nextSibling.classList.contains('l-sub')) return;
      cerrarSug();
      const n = tr._nuevo || { producto: nombreInicial || '' };
      const editando = !!tr._nuevo;
      const sub = document.createElement('tr');
      sub.className = 'l-sub';
      const dl = 'dlTiposNuevo' + Math.random().toString(36).slice(2, 7);
      const codTxt = tr.querySelector('.l-cod').value.trim().toUpperCase();
      sub.innerHTML = '<td colspan="5"><div class="mt-crear">' +
        '<div class="mt-crear-tit">Producto nuevo ' + (codTxt ? '(código ' + esc(codTxt) + ')' : '(sin código de barras: se generará uno)') + '</div>' +
        '<div class="mt-crear-g g4">' +
        '<label class="s2">Nombre del producto *<input class="n-prod" style="text-transform:uppercase" value="' + esc(n.producto || '') + '"></label>' +
        '<label>Marca *<input class="n-marca" style="text-transform:uppercase" placeholder="GENERICO si no tiene" value="' + esc(n.marca || '') + '"></label>' +
        '<label>Tipo de producto *<input class="n-tipo" list="' + dl + '" style="text-transform:uppercase" value="' + esc(n.tipo || '') + '">' + MT.datalist(dl, self._tiposProducto()) + '</label>' +
        '<label>Categoría *<select class="n-cat">' + MT.opciones(MT_CATEGORIAS) + '</select></label>' +
        '<label>Unidad *<select class="n-unidad">' + MT.opciones(MT_UNIDADES, '') + '</select></label>' +
        '<label>Ubicación<input class="n-ubic" style="text-transform:uppercase" placeholder="Ej. A1" value="' + esc(n.ubicacion || '') + '"></label>' +
        '<label>Stock mínimo<input class="n-min" type="number" min="0" step="any" value="' + esc(n.stockMinimo === undefined ? '' : n.stockMinimo) + '"></label>' +
        '<label>Moneda<select class="n-mon"><option value=""></option><option value="S/">S/</option><option value="$">$</option></select></label>' +
        '<label>Precio con IGV<input class="n-total" type="number" min="0" step="any" value="' + esc(n.total || '') + '"></label>' +
        '<label class="chk"><input type="checkbox" class="n-rep"' + (n.reparable ? ' checked' : '') + '> Reparable</label>' +
        '<label class="chk"><input type="checkbox" class="n-vence"' + (n.vence ? ' checked' : '') + '> Vence</label>' +
        '<label class="n-campo-fv" style="display:none">Fecha de vencimiento<input class="n-fv" type="date" value="' + esc(n.fechaVencimiento || '') + '"></label>' +
        '</div><div class="mt-crear-b">' +
        '<button type="button" class="mt-quitar n-quitar">✕ Quitar y volver a buscar</button>' +
        (editando ? '<button type="button" class="boton-secundario n-cerrar">Cerrar sin cambios</button>' : '') +
        '<button type="button" class="boton-primario n-ok">Guardar y seguir</button></div>' +
        '<div class="mt-ayuda">Obligatorio: nombre, marca, tipo, categoría y unidad. Lo que dejes en blanco se completa después en Catálogo.</div></div></td>';
      tr.after(sub);
      sub.querySelector('.n-cat').value = n.categoria || 'NUEVO';
      if (n.unidad) sub.querySelector('.n-unidad').value = n.unidad;
      if (n.moneda) sub.querySelector('.n-mon').value = n.moneda;
      const verFv = function () { sub.querySelector('.n-campo-fv').style.display = sub.querySelector('.n-vence').checked ? '' : 'none'; };
      sub.querySelector('.n-vence').addEventListener('change', verFv);
      verFv();
      sub.querySelector(n.producto ? '.n-marca' : '.n-prod').focus();
      sub.querySelector('.n-quitar').addEventListener('click', function () {
        sub.remove();
        tr._nuevo = null;
        tr.querySelector('.l-cod').value = '';
        pintarFila(tr);
        tr.querySelector('.l-cod').focus();
        avisar();
      });
      if (editando) sub.querySelector('.n-cerrar').addEventListener('click', function () { sub.remove(); });
      sub.querySelector('.n-ok').addEventListener('click', function () {
        const v = function (c) { return sub.querySelector(c).value.trim().toUpperCase(); };
        const datos = { producto: v('.n-prod'), marca: v('.n-marca'), tipo: v('.n-tipo'), categoria: sub.querySelector('.n-cat').value,
          unidad: sub.querySelector('.n-unidad').value, ubicacion: v('.n-ubic'), stockMinimo: sub.querySelector('.n-min').value.trim(),
          moneda: sub.querySelector('.n-mon').value, total: sub.querySelector('.n-total').value.trim(),
          reparable: sub.querySelector('.n-rep').checked, vence: sub.querySelector('.n-vence').checked,
          fechaVencimiento: sub.querySelector('.n-vence').checked ? sub.querySelector('.n-fv').value : '' };
        if (!datos.producto || !datos.marca || !datos.tipo || !datos.categoria || !datos.unidad) { mostrarMensaje('Completa nombre, marca, tipo, categoría y unidad del producto nuevo.', 'error'); return; }
        if (datos.total && !datos.moneda) { mostrarMensaje('Elige la moneda del precio.', 'error'); return; }
        let codigo = tr.querySelector('.l-cod').value.trim().toUpperCase();
        if (!codigo) codigo = self._generarCodigo(datos.producto, datos.marca, codigosNuevos(tr));
        if (self._producto(codigo)) { mostrarMensaje('El código ' + codigo + ' ya existe.', 'error'); return; }
        if (codigosNuevos(tr).indexOf(codigo) !== -1) { mostrarMensaje('Ese código ya está como producto nuevo en otra línea.', 'error'); return; }
        datos.codigo = codigo;
        tr._nuevo = datos;
        tr.querySelector('.l-cod').value = codigo;
        sub.remove();
        pintarFila(tr);
        tr.querySelector('.l-cant').focus();
        avisar();
      });
    }
    function agregar(codigo, cantidad, nuevo) {
      const tr = document.createElement('tr');
      tr.className = 'l-fila';
      tr.innerHTML =
        '<td><div class="mt-buscar"><input class="l-cod" autocomplete="off" placeholder="Código, nombre, marca, tipo o categoría" style="text-transform:uppercase">' +
        '<button type="button" class="l-lupa" title="Buscar en el stock">Buscar</button><button type="button" class="l-cam" title="Escanear con la cámara">' + camara + '</button>' +
        (esSalida ? '' : '<button type="button" class="l-nuevo" title="Producto nuevo sin código de barras">Nuevo</button>') + '</div></td>' +
        '<td class="l-prod"></td><td class="l-stock mt-stock" style="text-align:center"></td>' +
        '<td><input class="l-cant" type="number" min="0" step="any" placeholder="0"></td>' +
        '<td style="text-align:center"><button type="button" class="btn-quitar-l" title="Quitar">×</button></td>';
      const cod = tr.querySelector('.l-cod'), cant = tr.querySelector('.l-cant');
      const elegir = function (p) { if (p) { cod.value = p.codigo; pintarFila(tr); cant.focus(); avisar(); } };
      cod.addEventListener('change', function () { pintarFila(tr); avisar(); });
      cod.addEventListener('input', function () { if (tr._nuevo) { tr._nuevo = null; } mostrarSug(tr); });
      cod.addEventListener('focus', function () { if (cod.value.trim() && !self._producto(cod.value)) mostrarSug(tr); });
      cod.addEventListener('blur', function () { setTimeout(function () { if (sugTr === tr) cerrarSug(); }, 150); });
      cod.addEventListener('keydown', function (ev) {
        const abierta = sug && sugTr === tr && sugItems.length;
        if (abierta && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
          ev.preventDefault();
          sugAct = (sugAct + (ev.key === 'ArrowDown' ? 1 : -1) + sugItems.length) % sugItems.length;
          pintarAct(); return;
        }
        if (ev.key === 'Escape') { cerrarSug(); return; }
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        // Código exacto (lector de código de barras) → directo a cantidad
        if (self._producto(cod.value) || tr._nuevo) { cerrarSug(); pintarFila(tr); cant.focus(); avisar(); return; }
        if (!cod.value.trim()) return;
        if (abierta) { elegirSug(tr, sugAct); return; }
        pintarFila(tr);
        if (!esSalida) crearDesdeTexto(tr);
      });
      cant.addEventListener('input', function () { pintarFila(tr); avisar(); });
      cant.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); agregar().querySelector('.l-cod').focus(); } });
      tr.querySelector('.l-lupa').addEventListener('click', function () { self.consultarStock(elegir); });
      tr.querySelector('.l-cam').addEventListener('click', function () {
        MT.escanear(function (c) {
          cod.value = c; pintarFila(tr);
          if (self._producto(c)) cant.focus(); else if (!esSalida) abrirCreacion(tr);
          avisar();
        });
      });
      if (!esSalida) tr.querySelector('.l-nuevo').addEventListener('click', function () { cod.value = ''; tr._nuevo = null; pintarFila(tr); abrirCreacion(tr); });
      tr.querySelector('.btn-quitar-l').addEventListener('click', function () {
        const sub = tr.nextSibling && tr.nextSibling.classList && tr.nextSibling.classList.contains('l-sub') ? tr.nextSibling : null;
        if (tbody.querySelectorAll('tr.l-fila').length > 1) { if (sub) sub.remove(); tr.remove(); }
        else { cod.value = ''; cant.value = ''; tr._nuevo = null; if (sub) sub.remove(); pintarFila(tr); }
        avisar();
      });
      if (codigo) cod.value = codigo;
      if (cantidad) cant.value = cantidad;
      if (nuevo && nuevo.codigo === String(codigo || '').toUpperCase() && !self._producto(codigo)) tr._nuevo = nuevo;
      tbody.appendChild(tr);
      pintarFila(tr);
      return tr;
    }
    function leer() {
      return Array.from(tbody.querySelectorAll('tr.l-fila')).map(function (tr) {
        const it = { codigo: tr.querySelector('.l-cod').value.trim().toUpperCase(), cantidad: tr.querySelector('.l-cant').value.trim() };
        if (tr._nuevo) it.nuevo = tr._nuevo;
        return it;
      }).filter(function (x) { return x.codigo || x.cantidad; });
    }
    function validar() {
      const items = leer();
      if (!items.length) return 'Agrega al menos un producto.';
      for (let i = 0; i < items.length; i++) {
        const p = self._producto(items[i].codigo) || items[i].nuevo;
        if (!p) return 'Producto ' + (i + 1) + ': el código ' + (items[i].codigo || '(vacío)') + ' no existe.' + (esSalida ? '' : ' Usa "Crear aquí" para registrarlo.');
        const c = MT.num(items[i].cantidad);
        if (isNaN(c) || c <= 0) return 'Producto ' + (i + 1) + ' (' + p.producto + '): escribe la cantidad.';
      }
      if (esSalida) {
        const suma = {};
        items.forEach(function (it) { suma[it.codigo] = (suma[it.codigo] || 0) + MT.num(it.cantidad); });
        for (const c in suma) {
          const p = self._producto(c);
          if (suma[c] > p.stock) return 'No hay stock suficiente de ' + p.producto + '. Stock: ' + p.stock + ', pedido: ' + suma[c] + '.';
        }
      }
      return '';
    }
    function limpiar() { tbody.innerHTML = ''; agregar(); }
    function cargar(items) {
      tbody.innerHTML = '';
      (items || []).forEach(function (it) { agregar(it.codigo, it.cantidad, it.nuevo); });
      if (!tbody.children.length) agregar();
    }
    agregar();
    return { agregar: agregar, leer: leer, validar: validar, limpiar: limpiar, cargar: cargar };
  },

  /** Actualiza el stock local con lo que devolvió el servidor. */
  _aplicarStocks: function (items) {
    const self = this;
    (items || []).forEach(function (it) { const p = self._producto(it.codigo); if (p) p.stock = it.stockFinal; });
    FormAlmacen.actualizarAvisoAlertas();
  },

  /* ============================ INGRESO ============================ */

  abrirIngreso: async function () {
    if (!(await this._cargar())) return;
    const self = this;
    const CLAVE_BORRADOR = 'tms_mt_borrador_ingreso';
    let borrador = null;
    try { borrador = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) || 'null'); } catch (e) { borrador = null; }
    if (borrador && Array.isArray(borrador.lineas) && borrador.lineas.length) {
      const desc = (borrador.tipoDoc ? borrador.tipoDoc.toLowerCase() + ' ' : '') + (borrador.documento || 'sin número') + ', ' + borrador.lineas.length + ' producto(s)';
      if (!confirmar('Hay un ingreso sin terminar (' + desc + ').\n\n¿Quieres recuperarlo?')) {
        borrador = null;
        try { localStorage.removeItem(CLAVE_BORRADOR); } catch (e) { /* no-op */ }
      }
    } else borrador = null;

    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="mt-seccion"><h3>Documento de compra</h3>
          <div class="fila-campos">
            <div class="campo"><label>Fecha</label><input type="date" id="iFecha" value="${MT.hoy()}"></div>
            <div class="campo"><label>Hora</label><input type="time" step="1" id="iHora" value="${MT.ahora()}"></div>
            ${self._campoUsuario('iUsuario')}
            <div class="campo"><label>Tipo de documento</label><select id="iTipoDoc"><option value=""></option><option value="FACTURA">FACTURA</option><option value="BOLETA">BOLETA</option></select></div>
            <div class="campo"><label>N° de documento</label><input type="text" id="iDocumento" autocomplete="off" placeholder="Ej. F001-000123" style="text-transform:uppercase"></div>
            <div class="campo ancho2"><label>Razón social (proveedor)</label>
              <div class="mt-buscar"><select id="iRazon" style="flex:1">${MT.opciones(self._datos.proveedores.map(p => p.razonSocial), '')}</select><button type="button" id="btnNuevoProv">+ Nuevo</button></div></div>
            <div class="campo"><label>RUC</label><input type="text" id="iRuc" readonly></div>
            <div class="campo ancho4" id="iProvNuevo" style="display:none">
              <div class="mt-crear"><div class="mt-crear-tit">Proveedor nuevo</div>
                <div class="mt-crear-g g4">
                  <label class="s2">Razón social *<input id="iProvRazon" style="text-transform:uppercase"></label>
                  <label>RUC *<input id="iProvRuc" maxlength="11" inputmode="numeric"></label>
                  <label>Nombre del vendedor<input id="iProvVendedor" style="text-transform:uppercase"></label>
                  <label class="s2">Dirección<input id="iProvDireccion" style="text-transform:uppercase"></label>
                  <label class="s2">Ubicación (enlace de Google Maps)<input id="iProvMapa" placeholder="https://maps.app.goo.gl/..."></label>
                </div>
                <div class="mt-crear-b"><button type="button" class="mt-quitar" id="iProvCancelar">✕ Quitar y volver a la lista</button></div>
                <div class="mt-ayuda">Obligatorio: razón social y RUC. Teléfono y correo se completan después en Catálogo.</div></div>
            </div>
            <div class="campo ancho4"><label>Observación (opcional)</label><input type="text" id="iObs" autocomplete="off" style="text-transform:uppercase"></div>
          </div>
        </div>
        <div class="mt-seccion"><h3>Productos</h3>
          <table class="tabla-lista mt-lineas" id="tablaLineasIng">
            <colgroup><col style="width:36%"><col><col style="width:70px"><col style="width:110px"><col style="width:40px"></colgroup>
            <thead><tr><th>Código</th><th>Producto</th><th>Stock</th><th>Cantidad ingresada</th><th></th></tr></thead><tbody></tbody>
          </table>
          <button type="button" class="mt-agregar" id="btnAgregarLineaIng">+ Agregar producto</button>
          <div class="mt-ayuda">Escanea el código o escribe el nombre, marca, tipo o categoría y elige de la lista. Si no está, elige "+ Agregar producto nuevo" (o "Nuevo" si no tiene código de barras). Lo escrito se guarda solo en este navegador hasta que grabes.</div>
          <div class="mt-botones">
            <button class="boton-secundario" id="btnInicioIngreso">Inicio</button>
            <button class="boton-secundario" id="btnLimpiarIngreso">Limpiar</button>
            <button class="boton-primario" id="btnGrabarIngreso">Grabar ingreso</button>
          </div>
        </div>
      </div>`;

    abrirPanel('Registrar ingreso', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      let provNuevo = false;
      const guardarBorrador = function () {
        try {
          const lineas = lineasObj ? lineasObj.leer() : [];
          if (!lineas.length && !$('iDocumento').value.trim()) { localStorage.removeItem(CLAVE_BORRADOR); return; }
          localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({
            fecha: $('iFecha').value, tipoDoc: $('iTipoDoc').value, documento: $('iDocumento').value.trim().toUpperCase(),
            razon: $('iRazon').value, provNuevo: provNuevo ? { razonSocial: $('iProvRazon').value, ruc: $('iProvRuc').value, vendedor: $('iProvVendedor').value,
              direccion: $('iProvDireccion').value, ubicacion: $('iProvMapa').value } : null,
            obs: $('iObs').value, lineas: lineas
          }));
        } catch (e) { /* sin almacenamiento */ }
      };
      let espera = null;
      const programarBorrador = function () { clearTimeout(espera); espera = setTimeout(guardarBorrador, 400); };
      const lineasObj = self._lineas(raiz, 'tablaLineasIng', false, programarBorrador);
      const mostrarProvNuevo = function (si) {
        provNuevo = si;
        $('iProvNuevo').style.display = si ? '' : 'none';
        $('iRazon').disabled = si;
        $('btnNuevoProv').style.display = si ? 'none' : '';
        if (si) { $('iRazon').value = ''; $('iRuc').value = ''; $('iProvRazon').focus(); }
        else ['iProvRazon', 'iProvRuc', 'iProvVendedor', 'iProvDireccion', 'iProvMapa'].forEach(id => { $(id).value = ''; });
        programarBorrador();
      };
      $('btnNuevoProv').addEventListener('click', () => mostrarProvNuevo(true));
      $('iProvCancelar').addEventListener('click', () => mostrarProvNuevo(false));
      $('btnAgregarLineaIng').addEventListener('click', () => { lineasObj.agregar().querySelector('.l-cod').focus(); });
      $('iRazon').addEventListener('change', function () {
        const p = self._datos.proveedores.find(x => x.razonSocial === this.value);
        $('iRuc').value = p ? p.ruc : '';
      });
      ['iFecha', 'iTipoDoc', 'iDocumento', 'iRazon', 'iObs', 'iProvRazon', 'iProvRuc', 'iProvVendedor', 'iProvDireccion', 'iProvMapa'].forEach(id => {
        $(id).addEventListener('input', programarBorrador); $(id).addEventListener('change', programarBorrador);
      });
      // Recuperar el borrador
      if (borrador) {
        if (borrador.fecha) $('iFecha').value = borrador.fecha;
        $('iTipoDoc').value = borrador.tipoDoc || '';
        $('iDocumento').value = borrador.documento || '';
        $('iObs').value = borrador.obs || '';
        if (borrador.provNuevo) {
          mostrarProvNuevo(true);
          const pn = borrador.provNuevo;
          $('iProvRazon').value = pn.razonSocial || ''; $('iProvRuc').value = pn.ruc || ''; $('iProvVendedor').value = pn.vendedor || '';
          $('iProvDireccion').value = pn.direccion || ''; $('iProvMapa').value = pn.ubicacion || '';
        }
        else if (borrador.razon) { $('iRazon').value = borrador.razon; $('iRazon').dispatchEvent(new Event('change')); }
        lineasObj.cargar(borrador.lineas);
      }
      function limpiarTodo() {
        lineasObj.limpiar();
        ['iTipoDoc', 'iDocumento', 'iRazon', 'iRuc', 'iObs'].forEach(id => { $(id).value = ''; });
        mostrarProvNuevo(false);
        $('iFecha').value = MT.hoy(); $('iHora').value = MT.ahora();
        try { localStorage.removeItem(CLAVE_BORRADOR); } catch (e) { /* no-op */ }
        _refrescarSnapshotFormulario();
      }
      $('btnLimpiarIngreso').addEventListener('click', function () { if (confirmar('¿Borrar todo lo escrito en este ingreso?')) limpiarTodo(); });
      $('btnInicioIngreso').addEventListener('click', function () { guardarBorrador(); cerrarPanel(); });

      protegerClic($('btnGrabarIngreso'), async function () {
        const usuario = $('iUsuario').value.trim();
        if (!usuario) { mostrarMensaje('Ingrese el usuario.', 'error'); return; }
        if (!$('iTipoDoc').value) { mostrarMensaje('Elige si el documento es FACTURA o BOLETA.', 'error'); return; }
        if (!$('iDocumento').value.trim()) { mostrarMensaje('Escribe el número de ' + $('iTipoDoc').value.toLowerCase() + '.', 'error'); return; }
        let razon = $('iRazon').value, proveedorNuevo = null;
        if (provNuevo) {
          razon = $('iProvRazon').value.trim().toUpperCase();
          if (!razon) { mostrarMensaje('Escribe la razón social del proveedor nuevo.', 'error'); return; }
          if (!/^\d{11}$/.test($('iProvRuc').value.trim())) { mostrarMensaje('El RUC del proveedor nuevo debe tener 11 dígitos.', 'error'); return; }
          const mapa = $('iProvMapa').value.trim();
          if (mapa && !/^https?:\/\//i.test(mapa)) { mostrarMensaje('La ubicación debe ser un enlace de Google Maps (empieza con https://).', 'error'); return; }
          proveedorNuevo = { razonSocial: razon, ruc: $('iProvRuc').value.trim(), vendedor: $('iProvVendedor').value.trim().toUpperCase(),
            direccion: $('iProvDireccion').value.trim().toUpperCase(), ubicacion: mapa };
        }
        if (!razon) { mostrarMensaje('Seleccione la razón social del proveedor.', 'error'); return; }
        // Productos nuevos que quedaron con "Crear aquí" abierto sin guardar
        if (raiz.querySelector('#tablaLineasIng tr.l-sub')) { mostrarMensaje('Hay un producto nuevo sin terminar: completa sus datos y pulsa "Guardar y seguir".', 'error'); return; }
        const err = lineasObj.validar();
        if (err) { mostrarMensaje(err, 'error'); return; }
        MT.guardarUsuario(usuario);
        guardarBorrador();
        const items = lineasObj.leer();
        const nuevos = items.filter(it => it.nuevo).map(it => it.nuevo);
        const r = await MT.llamar('mtGrabarIngresoV2', {
          fecha: $('iFecha').value, hora: $('iHora').value, usuario: usuario,
          tipoDocumento: $('iTipoDoc').value, documento: $('iDocumento').value, razonSocial: razon, ruc: proveedorNuevo ? proveedorNuevo.ruc : $('iRuc').value,
          observacion: $('iObs').value, proveedorNuevo: proveedorNuevo, productosNuevos: nuevos,
          items: items.map(it => ({ codigo: it.codigo, cantidad: it.cantidad }))
        });
        if (!r) return;
        // Productos y proveedor nuevos entran a la lista local
        nuevos.forEach(n => {
          if (!self._producto(n.codigo)) self._datos.productos.push({ codigo: n.codigo, producto: n.producto, marca: n.marca, tipo: n.tipo, categoria: n.categoria || 'NUEVO', unidad: n.unidad,
            ubicacion: n.ubicacion || '', stockMinimo: MT.num(n.stockMinimo) || 0, moneda: n.moneda || '', total: MT.num(n.total) || 0, vence: n.vence ? 'SÍ' : 'NO',
            fechaVencimiento: n.fechaVencimiento || '', stock: 0, proveedor: razon, reparable: !!n.reparable,
            incompleto: !(n.ubicacion && n.moneda && n.total !== '' && n.stockMinimo !== ''), danado: 0, enReparacion: 0 });
        });
        if (proveedorNuevo && !self._datos.proveedores.find(p => p.razonSocial === razon)) self._datos.proveedores.push({ razonSocial: razon, ruc: proveedorNuevo.ruc,
          contacto: proveedorNuevo.vendedor, direccion: proveedorNuevo.direccion, ubicacion: proveedorNuevo.ubicacion, telefono: '', correo: '' });
        self._aplicarStocks(r.items);
        r.items.forEach(it => { const p = self._producto(it.codigo); if (p) p.proveedor = razon; });
        try { localStorage.removeItem(CLAVE_BORRADOR); } catch (e) { /* no-op */ }
        const incompletos = nuevos.filter(n => !(n.ubicacion && n.moneda && n.total !== '' && n.stockMinimo !== '')).length;
        mostrarMensaje(r.mensaje + (nuevos.length ? '\n\nSe crearon ' + nuevos.length + ' producto(s) nuevo(s).' +
          (incompletos ? ' ' + incompletos + ' quedaron con datos por completar en Catálogo.' : '') : ''), 'exito');
        cerrarPanel();
      });
      raiz.querySelector('#tablaLineasIng .l-cod').focus();
    }, { clase: 'panel-servicio' });
  },

  /* ============================ SALIDA ============================ */

  abrirSalida: async function () {
    if (!(await this._cargar())) return;
    const self = this;
    const d = self._datos;

    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="mt-seccion"><h3>Entrega</h3>
          <div class="fila-campos">
            <div class="campo"><label>Fecha</label><input type="date" id="sFecha" value="${MT.hoy()}"></div>
            <div class="campo"><label>Hora</label><input type="time" step="1" id="sHora" value="${MT.ahora()}"></div>
            ${self._campoUsuario('sUsuario')}
            <div class="campo"><label>Motivo de salida</label><select id="sMotivo">${MT.opciones(MT_MOTIVOS_SALIDA, '')}</select></div>
            <div class="campo ancho2"><label>Entregado a</label><select id="sEntregado">${MT.opciones(d.personal, '')}</select></div>
            <div class="campo"><label>Placa</label><select id="sPlaca">${MT.opciones(d.placas, '')}</select></div>
            <div class="campo"></div>
            <div class="campo ancho4"><label>Observación (opcional)</label><input type="text" id="sObs" autocomplete="off" style="text-transform:uppercase"></div>
          </div>
          <div class="mt-ayuda">Las salidas con motivo MANTENIMIENTO quedan pendientes para asociarlas en "Registrar mantenimiento".</div>
        </div>
        <div class="mt-seccion"><h3>Productos</h3>
          <table class="tabla-lista mt-lineas" id="tablaLineasSal">
            <colgroup><col style="width:30%"><col><col style="width:80px"><col style="width:120px"><col style="width:40px"></colgroup>
            <thead><tr><th>Código</th><th>Producto</th><th>Stock</th><th>Cantidad entregada</th><th></th></tr></thead><tbody></tbody>
          </table>
          <button type="button" class="mt-agregar" id="btnAgregarLineaSal">+ Agregar producto</button>
          <div class="mt-botones">
            <button class="boton-secundario" id="btnInicioSalida">Inicio</button>
            <button class="boton-secundario" id="btnLimpiarSalida">Limpiar</button>
            <button class="boton-primario" id="btnGrabarSalida">Grabar salida</button>
          </div>
        </div>
        <div class="mt-ayuda" style="margin-top:-4px">¿Una pieza dañada o un extintor vencido sale a reparar? Usa el botón <b>Reparaciones</b> del inicio.</div>
      </div>`;

    abrirPanel('Registrar salida', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      const lineas = self._lineas(raiz, 'tablaLineasSal', true);
      $('btnAgregarLineaSal').addEventListener('click', () => lineas.agregar().querySelector('.l-cod').focus());
      function limpiarTodo() {
        lineas.limpiar();
        ['sEntregado', 'sPlaca', 'sMotivo', 'sObs'].forEach(id => { $(id).value = ''; });
        $('sFecha').value = MT.hoy(); $('sHora').value = MT.ahora();
        _refrescarSnapshotFormulario();
      }
      $('btnLimpiarSalida').addEventListener('click', limpiarTodo);
      $('btnInicioSalida').addEventListener('click', solicitarCierrePanel);
      const usuarioOk = function () {
        const u = $('sUsuario').value.trim();
        if (!u) { mostrarMensaje('Ingrese el usuario.', 'error'); return ''; }
        MT.guardarUsuario(u);
        return u;
      };

      protegerClic($('btnGrabarSalida'), async function () {
        const usuario = usuarioOk();
        if (!usuario) return;
        if (!$('sMotivo').value) { mostrarMensaje('Seleccione el motivo de salida.', 'error'); return; }
        if (!$('sEntregado').value) { mostrarMensaje('Seleccione a quién se entregó.', 'error'); return; }
        if (!$('sPlaca').value) { mostrarMensaje('Seleccione la placa.', 'error'); return; }
        const err = lineas.validar();
        if (err) { mostrarMensaje(err, 'error'); return; }
        const r = await MT.llamar('mtGrabarSalidaLote', {
          fecha: $('sFecha').value, hora: $('sHora').value, usuario: usuario,
          entregadoA: $('sEntregado').value, placa: $('sPlaca').value, motivo: $('sMotivo').value,
          observacion: $('sObs').value, items: lineas.leer()
        });
        if (!r) return;
        self._aplicarStocks(r.items);
        mostrarMensaje(r.mensaje + (r.stockMinimo && r.stockMinimo.length ? '\n\nAtención, quedaron en stock mínimo o por debajo:\n- ' + r.stockMinimo.join('\n- ') : ''), 'exito');
        limpiarTodo();
      });

    }, { clase: 'panel-servicio' });
  },

  /* ============================ KARDEX POR PRODUCTO ============================ */

  abrirKardex: async function (codigoInicial) {
    if (!(await this._cargar())) return;
    const self = this;
    const html = MT_ESTILOS + self._tabsStock('kardex') + `
      <div class="mt-form">
        <div class="fila-campos" style="grid-template-columns:minmax(0,1fr) auto;">
          <div class="campo"><label>Producto</label>
            <div class="mt-buscar"><input id="kProducto" list="dlKardexProd" autocomplete="off" placeholder="Escribe o escanea el código o el nombre" style="text-transform:uppercase">
            <button type="button" id="kCam" title="Escanear con la cámara">Escanear</button><button type="button" id="kVer">Ver kardex</button></div>
            ${'<datalist id="dlKardexProd">' + self._datos.productos.map(p => '<option value="' + esc(p.codigo) + '">' + esc(p.producto) + '</option>').join('') + '</datalist>'}
          </div>
        </div>
        <div id="kResumen" class="mt-kres"></div>
        <div class="mt-tabla-wrap">
          <table class="tabla-lista" id="tablaKardex">
            <thead><tr><th>Fecha</th><th>Hora</th><th>Movimiento</th><th>Entrada</th><th>Salida</th><th>Saldo</th><th>Referencia / placa</th><th>Entregado a</th><th>Usuario</th><th>Observación</th></tr></thead>
            <tbody><tr><td colspan="10" style="text-align:center;color:#8b95a1;padding:16px;">Elige un producto.</td></tr></tbody>
          </table>
        </div>
        <div class="mt-botones"><button class="boton-secundario" id="kCerrar">Cerrar</button></div>
      </div>`;
    abrirPanel('Stock · Kardex por producto', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      self._wireTabsStock(raiz);
      async function ver() {
        const p = self._producto($('kProducto').value);
        if (!p) { mostrarMensaje('Producto no encontrado. Verifique el código.', 'error'); return; }
        $('kProducto').value = p.codigo;
        const r = await MT.llamar('mtKardexProducto', { codigo: p.codigo });
        if (!r) return;
        const m = r.movimientos || [];
        const ent = m.reduce((a, x) => a + x.entrada, 0), sal = m.reduce((a, x) => a + x.salida, 0);
        $('kResumen').innerHTML = '<div><span>Producto</span><b>' + esc(p.producto) + '</b><small>' + esc([p.codigo, p.marca, p.ubicacion].filter(Boolean).join(' · ')) + '</small></div>' +
          '<div><span>Stock actual</span><b>' + esc(p.stock) + '</b>' + (p.stockMinimo ? '<small>mínimo ' + esc(p.stockMinimo) + '</small>' : '') + '</div>' +
          '<div><span>Total ingresado</span><b>' + ent + '</b></div><div><span>Total entregado</span><b>' + sal + '</b></div><div><span>Movimientos</span><b>' + m.length + '</b></div>';
        $('tablaKardex').querySelector('tbody').innerHTML = m.length ? m.map(x =>
          '<tr><td>' + esc(MT.fechaVista(x.fecha)) + '</td><td>' + esc(String(x.hora || '').slice(0, 5)) + '</td><td>' + esc(x.tipo) + '</td>' +
          '<td style="text-align:center;color:#166534;font-weight:700">' + (x.entrada || '') + '</td><td style="text-align:center;color:#b91c1c;font-weight:700">' + (x.salida || '') + '</td>' +
          '<td style="text-align:center;font-weight:800">' + x.saldo + '</td><td>' + esc(x.referencia) + '</td><td>' + esc(x.entregadoA || '') + '</td>' +
          '<td>' + esc(x.usuario) + '</td><td>' + esc(x.observacion) + '</td></tr>').join('')
          : '<tr><td colspan="10" style="text-align:center;color:#8b95a1;padding:16px;">Sin movimientos.</td></tr>';
      }
      $('kVer').addEventListener('click', ver);
      $('kProducto').addEventListener('change', function () { if (self._producto(this.value)) ver(); });
      $('kProducto').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ver(); } });
      $('kCam').addEventListener('click', () => MT.escanear(c => { $('kProducto').value = c; ver(); }));
      $('kCerrar').addEventListener('click', cerrarPanel);
      if (codigoInicial) { $('kProducto').value = codigoInicial; ver(); } else $('kProducto').focus();
    }, { ancho: true });
  },

  /* ============================ ALERTAS: STOCK MÍNIMO Y VENCIMIENTOS ============================ */

  _alertas: function () {
    const prods = this._datos ? this._datos.productos : [];
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const aFecha = function (v) {
      const s = String(v || '').trim();
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
      const d = new Date(s);
      return isNaN(d) ? null : d;
    };
    const stock = prods.filter(p => p.stockMinimo > 0 && p.stock <= p.stockMinimo)
      .sort((a, b) => (a.stock - a.stockMinimo) - (b.stock - b.stockMinimo));
    const venc = prods.map(p => {
      const tiene = /^S/i.test(String(p.vence || '').trim());
      const f = tiene ? aFecha(p.fechaVencimiento) : null;
      if (!f) return null;
      const dias = Math.round((f - hoy) / 86400000);
      return dias <= MT_DIAS_AVISO_VENCIMIENTO ? Object.assign({ dias: dias, fecha: f }, p) : null;
    }).filter(Boolean).sort((a, b) => a.dias - b.dias);
    // Piezas en reparación que ya pasaron su fecha estimada (o más de 15 días fuera si no tienen fecha)
    const rep = ((this._datos && this._datos.reparaciones) || []).filter(r => r.estado === 'EN REPARACIÓN').map(r => {
      const env = aFecha(r.fechaEnvio), est = aFecha(r.fechaEstimada);
      const dias = env ? Math.round((hoy - env) / 86400000) : 0;
      const atraso = est ? Math.round((hoy - est) / 86400000) : dias - 15;
      return atraso > 0 ? Object.assign({ diasFuera: dias, atraso: atraso }, r) : null;
    }).filter(Boolean).sort((a, b) => b.atraso - a.atraso);
    return { stock: stock, venc: venc, rep: rep, total: stock.length + venc.length + rep.length };
  },

  actualizarAvisoAlertas: function () {
    const b = document.getElementById('mtAlertasBadge');
    if (!b || !this._datos) return;
    const n = this._alertas().total;
    b.textContent = n;
    b.style.display = n ? '' : 'none';
  },

  abrirAlertas: async function () {
    if (!(await this._cargar(true))) return;
    const self = this;
    const a = self._alertas();
    const fecha = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    const html = MT_ESTILOS + self._tabsStock('alertas') + `
      <div class="mt-form">
        <div class="mt-seccion"><h3>Reparaciones fuera de plazo (${a.rep.length})</h3>
          <div class="mt-tabla-wrap" style="max-height:24vh;margin-bottom:10px">
            <table class="tabla-lista"><thead><tr><th>Producto</th><th>Cant.</th><th>Taller</th><th>Enviado</th><th>Fecha estimada</th><th>Días fuera</th></tr></thead><tbody>
            ${a.rep.length ? a.rep.map(r => '<tr><td><b>' + esc(r.producto) + '</b><div class="mt-ayuda">' + esc(r.codigo) + '</div></td><td style="text-align:center">' + esc(r.cantidad) + '</td><td>' + esc(r.taller) +
              '</td><td>' + esc(MT.fechaVista(r.fechaEnvio)) + '</td><td>' + esc(MT.fechaVista(r.fechaEstimada) || '-') + '</td><td class="mt-bajo" style="text-align:center">' + r.diasFuera + '</td></tr>').join('')
              : '<tr><td colspan="6" style="text-align:center;color:#166534;padding:14px;">Ninguna reparación atrasada.</td></tr>'}
            </tbody></table>
          </div>
        </div>
        <div class="mt-seccion"><h3>Stock mínimo o por debajo (${a.stock.length})</h3>
          <div class="mt-tabla-wrap" style="max-height:32vh;margin-bottom:10px">
            <table class="tabla-lista"><thead><tr><th>Código</th><th>Producto</th><th>Ubicación</th><th>Stock</th><th>Mínimo</th><th>Último proveedor</th><th></th></tr></thead><tbody>
            ${a.stock.length ? a.stock.map(p => '<tr><td>' + esc(p.codigo) + '</td><td>' + esc(p.producto) + '</td><td>' + esc(p.ubicacion) + '</td>' +
              '<td class="mt-bajo" style="text-align:center">' + esc(p.stock) + '</td><td style="text-align:center">' + esc(p.stockMinimo) + '</td><td>' + esc(p.proveedor) + '</td>' +
              '<td><button type="button" class="mt-mini" data-kardex="' + esc(p.codigo) + '">Kardex</button></td></tr>').join('')
              : '<tr><td colspan="7" style="text-align:center;color:#166534;padding:14px;">Ningún producto en stock mínimo.</td></tr>'}
            </tbody></table>
          </div>
        </div>
        <div class="mt-seccion"><h3>Vencidos o por vencer en ${MT_DIAS_AVISO_VENCIMIENTO} días (${a.venc.length})</h3>
          <div class="mt-tabla-wrap" style="max-height:32vh;margin-bottom:10px">
            <table class="tabla-lista"><thead><tr><th>Código</th><th>Producto</th><th>Ubicación</th><th>Stock</th><th>Vence</th><th>Estado</th></tr></thead><tbody>
            ${a.venc.length ? a.venc.map(p => '<tr><td>' + esc(p.codigo) + '</td><td>' + esc(p.producto) + '</td><td>' + esc(p.ubicacion) + '</td>' +
              '<td style="text-align:center">' + esc(p.stock) + '</td><td>' + fecha(p.fecha) + '</td>' +
              '<td>' + (p.dias < 0 ? '<span class="mt-bajo">Vencido hace ' + (-p.dias) + ' día(s)</span>' : '<span style="color:#b45309;font-weight:700">Vence en ' + p.dias + ' día(s)</span>') + '</td></tr>').join('')
              : '<tr><td colspan="6" style="text-align:center;color:#166534;padding:14px;">Nada vencido ni por vencer.</td></tr>'}
            </tbody></table>
          </div>
        </div>
        <div class="mt-botones"><button class="boton-secundario" id="aCerrar">Cerrar</button></div>
      </div>`;
    abrirPanel('Stock · Alertas', html, function (raiz) {
      self._wireTabsStock(raiz);
      raiz.querySelector('#aCerrar').addEventListener('click', cerrarPanel);
      raiz.querySelectorAll('[data-kardex]').forEach(b => b.addEventListener('click', () => self.abrirKardex(b.dataset.kardex)));
    }, { ancho: true });
  },

  /* ============================ STOCK (pestañas Stock · Kardex · Alertas) ============================ */

  _tabsStock: function (activa) {
    const n = this._datos ? this._alertas().total : 0;
    const t = function (k, txt) { return '<button type="button" class="mt-tab' + (k === activa ? ' activo' : '') + '" data-tab-stock="' + k + '">' + txt + '</button>'; };
    return '<div class="mt-tabs">' + t('stock', 'Stock') + t('kardex', 'Kardex por producto') +
      t('alertas', 'Alertas' + (n ? '<span class="n">' + n + '</span>' : '')) + '</div>';
  },
  _wireTabsStock: function (raiz) {
    const self = this;
    raiz.querySelectorAll('[data-tab-stock]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('activo')) return;
        const k = b.dataset.tabStock;
        if (k === 'stock') self.abrirStock(); else if (k === 'kardex') self.abrirKardex(); else self.abrirAlertas();
      });
    });
  },

  abrirStock: async function () {
    if (!(await this._cargar())) return;
    const self = this;
    const html = MT_ESTILOS + self._tabsStock('stock') + `
      <div class="mt-form">
        <div class="fila-campos" style="grid-template-columns: 2fr 1fr 1fr 1fr;">
          <div class="campo"><label>Buscar (código, producto, marca, proveedor)</label>
            <div class="mt-buscar"><input id="stBuscar" autocomplete="off" placeholder="Escribe o escanea" style="text-transform:uppercase"><button type="button" id="stCam">Escanear</button></div></div>
          <div class="campo"><label>Tipo</label><select id="stTipo">${MT.opciones(self._tiposProducto(), 'Todos')}</select></div>
          <div class="campo"><label>Ubicación</label><select id="stUbic">${MT.opciones(Array.from(new Set(self._datos.productos.map(p => p.ubicacion).filter(Boolean))).sort(), 'Todas')}</select></div>
          <div class="campo"><label>Mostrar</label><select id="stVer"><option value="">Todos</option><option value="con">Con stock</option><option value="bajo">En stock mínimo</option><option value="rep">Con piezas dañadas o en reparación</option></select></div>
        </div>
        <div class="mt-ayuda" id="stCuenta" style="margin-bottom:6px"></div>
        <div class="mt-tabla-wrap" style="max-height:56vh">
          <table class="tabla-lista" id="tablaStockP">
            <thead><tr><th>Código</th><th>Producto</th><th>Marca</th><th>Tipo</th><th>Ubicación</th><th>Operativo</th><th>Dañado</th><th>En reparación</th><th>Mínimo</th><th>Precio</th><th></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="mt-botones"><button class="boton-secundario" id="stCerrar">Cerrar</button></div>
      </div>`;
    abrirPanel('Stock', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      self._wireTabsStock(raiz);
      function pintar() {
        const q = $('stBuscar').value.trim().toUpperCase(), tipo = $('stTipo').value, ub = $('stUbic').value, ver = $('stVer').value;
        const filas = self._datos.productos.filter(p => {
          if (q && [p.codigo, p.producto, p.marca, p.proveedor].join(' ').toUpperCase().indexOf(q) === -1) return false;
          if (tipo && p.tipo !== tipo) return false;
          if (ub && p.ubicacion !== ub) return false;
          if (ver === 'con' && !(p.stock > 0)) return false;
          if (ver === 'bajo' && !(p.stockMinimo > 0 && p.stock <= p.stockMinimo)) return false;
          if (ver === 'rep' && !((p.danado || 0) + (p.enReparacion || 0) > 0)) return false;
          return true;
        });
        $('stCuenta').textContent = filas.length + ' producto(s)';
        $('tablaStockP').querySelector('tbody').innerHTML = filas.map(p => {
          const bajo = p.stockMinimo > 0 && p.stock <= p.stockMinimo;
          return '<tr><td>' + esc(p.codigo) + '</td><td><b>' + esc(p.producto) + '</b>' + (p.incompleto ? ' <span class="mt-incompleto">datos incompletos</span>' : '') + '</td><td>' + esc(p.marca) +
            '</td><td>' + esc(p.tipo) + '</td><td>' + esc(p.ubicacion) + '</td><td class="mt-stock' + (bajo ? ' mt-bajo' : '') + '" style="text-align:center">' + esc(p.stock) +
            '</td><td style="text-align:center;color:#991b1b;font-weight:700">' + (p.danado || '') + '</td><td style="text-align:center;color:#92400e;font-weight:700">' + (p.enReparacion || '') +
            '</td><td style="text-align:center">' + (p.stockMinimo || '') + '</td><td style="white-space:nowrap">' + (p.total ? esc(p.moneda) + ' ' + MT.dinero(p.total) : '') +
            '</td><td><button type="button" class="mt-mini" data-k="' + esc(p.codigo) + '">Kardex</button></td></tr>';
        }).join('') || '<tr><td colspan="11" style="text-align:center;color:#8b95a1;padding:16px;">Sin productos con estos filtros.</td></tr>';
        raiz.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => self.abrirKardex(b.dataset.k)));
      }
      let espera = null;
      $('stBuscar').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(pintar, 200); });
      ['stTipo', 'stUbic', 'stVer'].forEach(id => $(id).addEventListener('change', pintar));
      $('stCam').addEventListener('click', () => MT.escanear(c => { $('stBuscar').value = c; pintar(); }));
      $('stCerrar').addEventListener('click', cerrarPanel);
      pintar();
      $('stBuscar').focus();
    }, { ancho: true });
  },

  /* ============================ CATÁLOGO (productos y proveedores) ============================ */

  abrirCatalogo: async function (pestana) {
    if (!(await this._cargar())) return;
    const self = this;
    const tab = pestana === 'proveedores' ? 'proveedores' : 'productos';
    const inc = self._datos.productos.filter(p => p.incompleto).length;
    const tabs = '<div class="mt-tabs"><button type="button" class="mt-tab' + (tab === 'productos' ? ' activo' : '') + '" data-tab-cat="productos">Productos' + (inc ? '<span class="n">' + inc + '</span>' : '') + '</button>' +
      '<button type="button" class="mt-tab' + (tab === 'proveedores' ? ' activo' : '') + '" data-tab-cat="proveedores">Proveedores</button></div>';
    const tipos = self._tiposProducto();
    let cuerpo;
    if (tab === 'productos') {
      cuerpo = `
        <div class="mt-seccion" id="cEditor" style="display:none"><h3 id="cEditorTit">Editar producto</h3>
          <div class="fila-campos">
            <div class="campo"><label>Código</label><input id="ceCodigo" readonly></div>
            <div class="campo ancho2"><label>Producto *</label><input id="ceProducto" style="text-transform:uppercase"></div>
            <div class="campo"><label>Marca *</label><input id="ceMarca" style="text-transform:uppercase"></div>
            <div class="campo"><label>Tipo *</label><input id="ceTipo" list="dlCatTipos" style="text-transform:uppercase">${MT.datalist('dlCatTipos', tipos)}</div>
            <div class="campo"><label>Categoría *</label><select id="ceCategoria">${MT.opciones(MT_CATEGORIAS, '')}</select></div>
            <div class="campo"><label>Unidad *</label><select id="ceUnidad">${MT.opciones(MT_UNIDADES, '')}</select></div>
            <div class="campo"><label>Ubicación *</label><input id="ceUbicacion" style="text-transform:uppercase"></div>
            <div class="campo"><label>Stock mínimo *</label><input id="ceMin" type="number" min="0" step="any"></div>
            <div class="campo"><label>Moneda *</label><select id="ceMoneda">${MT.opciones(['S/', '$'], '')}</select></div>
            <div class="campo"><label>Precio con IGV *</label><input id="ceTotal" type="number" min="0" step="any"></div>
            <div class="campo"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ceRep" style="width:auto"> Reparable</label>
              <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ceVence" style="width:auto"> Vence</label></div>
            <div class="campo"><label>Fecha de vencimiento</label><input id="ceFechaV" type="date"></div>
          </div>
          <div class="mt-botones"><button class="boton-secundario" id="ceCancelar">Cancelar</button><button class="boton-primario" id="ceGuardar">Guardar cambios</button></div>
        </div>
        <div class="fila-campos" style="grid-template-columns: 2fr 1fr auto;">
          <div class="campo"><label>Buscar</label><input id="cBuscar" autocomplete="off" placeholder="Código, producto o marca" style="text-transform:uppercase"></div>
          <div class="campo"><label>Mostrar</label><select id="cVer"><option value="">Todos</option><option value="inc"${inc ? ' selected' : ''}>Datos incompletos</option><option value="rep">Reparables</option><option value="vence">Con vencimiento</option></select></div>
          <div class="campo"><label>&nbsp;</label><button class="boton-primario" id="cNuevo" type="button">+ Nuevo producto</button></div>
        </div>
        <div class="mt-tabla-wrap" style="max-height:46vh"><table class="tabla-lista" id="tablaCat">
          <thead><tr><th>Código</th><th>Producto</th><th>Marca</th><th>Tipo</th><th>Categoría</th><th>Unidad</th><th>Ubicación</th><th>Mínimo</th><th>Precio</th><th>Reparable</th><th>Vence</th></tr></thead><tbody></tbody>
        </table></div>`;
    } else {
      cuerpo = `
        <div class="mt-seccion" id="cEditor" style="display:none"><h3>Editar proveedor</h3>
          <div class="fila-campos">
            <div class="campo ancho2"><label>Razón social</label><input id="cvRazon" readonly></div>
            <div class="campo"><label>RUC *</label><input id="cvRuc" maxlength="11" inputmode="numeric"></div>
            <div class="campo"><label>Nombre del vendedor</label><input id="cvContacto" style="text-transform:uppercase"></div>
            <div class="campo"><label>Teléfono</label><input id="cvTelefono" inputmode="numeric"></div>
            <div class="campo"><label>Correo</label><input id="cvCorreo" type="email"></div>
            <div class="campo ancho2"><label>Dirección</label><input id="cvDireccion" style="text-transform:uppercase"></div>
            <div class="campo ancho2"><label>Ubicación (enlace de Google Maps)</label><input id="cvMapa" placeholder="https://maps.app.goo.gl/..."></div>
          </div>
          <div class="mt-botones"><button class="boton-secundario" id="ceCancelar">Cancelar</button><button class="boton-primario" id="ceGuardar">Guardar cambios</button></div>
        </div>
        <div class="fila-campos" style="grid-template-columns: 2fr auto;">
          <div class="campo"><label>Buscar</label><input id="cBuscar" autocomplete="off" placeholder="Razón social o RUC" style="text-transform:uppercase"></div>
          <div class="campo"><label>&nbsp;</label><button class="boton-primario" id="cNuevo" type="button">+ Nuevo proveedor</button></div>
        </div>
        <div class="mt-tabla-wrap" style="max-height:50vh"><table class="tabla-lista" id="tablaCat">
          <thead><tr><th>Razón social</th><th>RUC</th><th>Vendedor</th><th>Teléfono</th><th>Correo</th><th>Dirección</th><th style="width:70px">Mapa</th></tr></thead><tbody></tbody>
        </table></div>`;
    }
    const html = MT_ESTILOS + tabs + '<div class="mt-form">' + cuerpo + '<div class="mt-botones"><button class="boton-secundario" id="cCerrar">Cerrar</button></div></div>';
    abrirPanel('Catálogo', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      raiz.querySelectorAll('[data-tab-cat]').forEach(b => b.addEventListener('click', () => { if (!b.classList.contains('activo')) self.abrirCatalogo(b.dataset.tabCat); }));
      $('cCerrar').addEventListener('click', cerrarPanel);
      $('ceCancelar').addEventListener('click', () => { $('cEditor').style.display = 'none'; _refrescarSnapshotFormulario(); });
      let actual = null;
      if (tab === 'productos') {
        $('cNuevo').addEventListener('click', () => self.abrirProducto());
        const pintar = function () {
          const q = $('cBuscar').value.trim().toUpperCase(), ver = $('cVer').value;
          const filas = self._datos.productos.filter(p => {
            if (q && [p.codigo, p.producto, p.marca].join(' ').toUpperCase().indexOf(q) === -1) return false;
            if (ver === 'inc' && !p.incompleto) return false;
            if (ver === 'rep' && !p.reparable) return false;
            if (ver === 'vence' && !/^S/i.test(String(p.vence || ''))) return false;
            return true;
          });
          $('tablaCat').querySelector('tbody').innerHTML = filas.map(p => '<tr data-c="' + esc(p.codigo) + '"><td>' + esc(p.codigo) + '</td><td><b>' + esc(p.producto) + '</b>' +
            (p.incompleto ? ' <span class="mt-incompleto">incompleto</span>' : '') + '</td><td>' + esc(p.marca) + '</td><td>' + esc(p.tipo) + '</td><td>' + esc(p.categoria) +
            '</td><td>' + esc(p.unidad) + '</td><td>' + esc(p.ubicacion) + '</td><td style="text-align:center">' + esc(p.stockMinimo) + '</td><td style="white-space:nowrap">' +
            (p.total ? esc(p.moneda) + ' ' + MT.dinero(p.total) : '') + '</td><td>' + (p.reparable ? 'Sí' : '') + '</td><td>' + (/^S/i.test(String(p.vence || '')) ? esc(MT.fechaVista(p.fechaVencimiento) || 'Sí') : '') + '</td></tr>').join('')
            || '<tr><td colspan="11" style="text-align:center;color:#8b95a1;padding:16px;">Sin productos.</td></tr>';
        };
        $('tablaCat').querySelector('tbody').addEventListener('click', function (ev) {
          const tr = ev.target.closest('tr[data-c]'); if (!tr) return;
          const p = self._producto(tr.dataset.c); if (!p) return;
          actual = p;
          $('cEditorTit').textContent = 'Editar producto: ' + p.producto;
          $('ceCodigo').value = p.codigo; $('ceProducto').value = p.producto; $('ceMarca').value = p.marca; $('ceTipo').value = p.tipo;
          $('ceCategoria').value = p.categoria || ''; $('ceUnidad').value = p.unidad || ''; $('ceUbicacion').value = p.ubicacion || '';
          $('ceMin').value = p.incompleto && !p.stockMinimo ? '' : (p.stockMinimo || 0); $('ceMoneda').value = p.moneda || ''; $('ceTotal').value = p.total || '';
          $('ceRep').checked = !!p.reparable; $('ceVence').checked = /^S/i.test(String(p.vence || ''));
          $('ceFechaV').value = /^\d{4}-\d{2}-\d{2}/.test(String(p.fechaVencimiento || '')) ? String(p.fechaVencimiento).slice(0, 10) : '';
          $('cEditor').style.display = '';
          $('cEditor').scrollIntoView({ block: 'start', behavior: 'smooth' });
          _refrescarSnapshotFormulario();
        });
        protegerClic($('ceGuardar'), async function () {
          if (!actual) return;
          const d = {
            codigo: actual.codigo, producto: $('ceProducto').value, marca: $('ceMarca').value, tipo: $('ceTipo').value, categoria: $('ceCategoria').value,
            unidad: $('ceUnidad').value, ubicacion: $('ceUbicacion').value, stockMinimo: $('ceMin').value, moneda: $('ceMoneda').value, total: $('ceTotal').value,
            reparable: $('ceRep').checked, tieneVencimiento: $('ceVence').checked, fechaVencimiento: $('ceFechaV').value
          };
          const r = await MT.llamar('mtActualizarProducto', d);
          if (!r) return;
          Object.assign(actual, r.producto || {});
          mostrarMensaje(r.mensaje, 'exito');
          $('cEditor').style.display = 'none';
          pintar();
          _refrescarSnapshotFormulario();
        });
        $('cBuscar').addEventListener('input', pintar);
        $('cVer').addEventListener('change', pintar);
        pintar();
      } else {
        $('cNuevo').addEventListener('click', () => self.abrirProveedor());
        const provs = self._datos.proveedores;
        const pintar = function () {
          const q = $('cBuscar').value.trim().toUpperCase();
          $('tablaCat').querySelector('tbody').innerHTML = provs.filter(p => !q || (p.razonSocial + ' ' + p.ruc).toUpperCase().indexOf(q) !== -1)
            .map(p => '<tr data-r="' + esc(p.razonSocial) + '"><td><b>' + esc(p.razonSocial) + '</b>' + (!p.contacto || !p.telefono ? ' <span class="mt-incompleto">incompleto</span>' : '') + '</td><td>' + esc(p.ruc) +
              '</td><td>' + esc(p.contacto || '') + '</td><td>' + esc(p.telefono || '') + '</td><td>' + esc(p.correo || '') + '</td><td>' + esc(p.direccion || '') + '</td><td>' +
              (/^https?:\/\//i.test(p.ubicacion || '') ? '<a href="' + esc(p.ubicacion) + '" target="_blank" rel="noopener" class="mt-mini" onclick="event.stopPropagation()">Ver mapa</a>' : '') + '</td></tr>').join('')
            || '<tr><td colspan="7"style="text-align:center;color:#8b95a1;padding:16px;">Sin proveedores.</td></tr>';
        };
        $('tablaCat').querySelector('tbody').addEventListener('click', function (ev) {
          const tr = ev.target.closest('tr[data-r]'); if (!tr) return;
          actual = provs.find(p => p.razonSocial === tr.dataset.r); if (!actual) return;
          $('cvRazon').value = actual.razonSocial; $('cvRuc').value = actual.ruc || ''; $('cvContacto').value = actual.contacto || '';
          $('cvTelefono').value = actual.telefono || ''; $('cvCorreo').value = actual.correo || ''; $('cvDireccion').value = actual.direccion || '';
          $('cvMapa').value = actual.ubicacion || '';
          $('cEditor').style.display = '';
          _refrescarSnapshotFormulario();
        });
        protegerClic($('ceGuardar'), async function () {
          if (!actual) return;
          const d = { razonSocial: actual.razonSocial, ruc: $('cvRuc').value, contacto: $('cvContacto').value, telefono: $('cvTelefono').value, correo: $('cvCorreo').value, direccion: $('cvDireccion').value, ubicacion: $('cvMapa').value.trim() };
          if (d.ubicacion && !/^https?:\/\//i.test(d.ubicacion)) { mostrarMensaje('La ubicación debe ser un enlace de Google Maps (empieza con https://).', 'error'); return; }
          const r = await MT.llamar('mtActualizarProveedor', d);
          if (!r) return;
          Object.assign(actual, { ruc: d.ruc.trim(), contacto: d.contacto.toUpperCase(), telefono: d.telefono.trim(), correo: d.correo.trim().toLowerCase(), direccion: d.direccion.toUpperCase(), ubicacion: d.ubicacion });
          mostrarMensaje(r.mensaje, 'exito');
          $('cEditor').style.display = 'none';
          pintar();
          _refrescarSnapshotFormulario();
        });
        $('cBuscar').addEventListener('input', pintar);
        pintar();
      }
    }, { ancho: true });
  },

  /* ============================ REPARACIONES ============================ */

  abrirReparaciones: async function (pestana) {
    if (!(await this._cargar())) return;
    const self = this;
    const d = self._datos;
    const reps = d.reparaciones || [];
    const pendientes = reps.filter(r => r.estado === 'DAÑADO' || r.estado === 'EN REPARACIÓN');
    const danados = reps.filter(r => r.estado === 'DAÑADO');
    const enRep = reps.filter(r => r.estado === 'EN REPARACIÓN');
    const talleres = Array.from(new Set(d.proveedores.map(p => p.razonSocial).concat(reps.map(r => r.taller)).filter(Boolean))).sort();
    const vencibles = d.productos.filter(p => p.tipo === 'EXTINTOR' || /^S/i.test(String(p.vence || '')));
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const diasDesde = function (f) { const m = String(f || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Math.round((hoy - new Date(+m[1], +m[2] - 1, +m[3])) / 86400000) : ''; };
    const estadoHtml = function (e) {
      const c = e === 'DAÑADO' ? 'danado' : e === 'EN REPARACIÓN' ? 'enrep' : e === 'BAJA' ? 'baja' : 'ret';
      return '<span class="mt-estado ' + c + '">' + esc(e) + '</span>';
    };
    const tab = pestana || 'pendientes';
    const T = [['pendientes', 'Pendientes' + (pendientes.length ? '<span class="n">' + pendientes.length + '</span>' : '')], ['retiro', '1. Retirar pieza dañada'],
      ['envio', '2. Enviar a reparación'], ['retorno', '3. Registrar retorno'], ['canje', 'Canje de extintores'], ['historial', 'Historial']];
    const html = MT_ESTILOS + `
      <div class="mt-tabs">${T.map(t => '<button type="button" class="mt-tab' + (t[0] === tab ? ' activo' : '') + '" data-rtab="' + t[0] + '">' + t[1] + '</button>').join('')}</div>
      <div class="mt-form">
        <div class="campo" style="max-width:260px">${self._campoUsuario('rUsuario').replace('<div class="campo">', '').replace(/<\/div>$/, '')}</div>

        <div data-rsec="pendientes">
          <div class="mt-ayuda" style="margin-bottom:6px">Piezas retiradas de las unidades (dañadas) y piezas que están en el taller. Usa los botones para enviarlas o registrar su retorno.</div>
          <div class="mt-tabla-wrap"><table class="tabla-lista">
            <thead><tr><th>Producto</th><th>Cant.</th><th>Estado</th><th>Origen</th><th>Taller</th><th>Guía</th><th>Enviado</th><th>Estimada</th><th>Días fuera</th><th></th></tr></thead><tbody>
            ${pendientes.length ? pendientes.map(r => '<tr><td><b>' + esc(r.producto) + '</b><div class="mt-ayuda">' + esc(r.codigo) + '</div></td><td style="text-align:center">' + esc(r.cantidad) + '</td><td>' + estadoHtml(r.estado) +
              '</td><td>' + esc(r.origen === 'UNIDAD' ? 'Placa ' + (r.placa || '-') : 'Almacén') + '</td><td>' + esc(r.taller || '') + '</td><td>' + esc(r.guia || '') + '</td><td>' + esc(MT.fechaVista(r.fechaEnvio)) +
              '</td><td>' + esc(MT.fechaVista(r.fechaEstimada)) + '</td><td style="text-align:center">' + (r.estado === 'EN REPARACIÓN' ? diasDesde(r.fechaEnvio) : '') + '</td><td>' +
              (r.estado === 'DAÑADO' ? '<button type="button" class="mt-mini" data-ir="envio" data-id="' + esc(r.id) + '">Enviar</button>' : '<button type="button" class="mt-mini" data-ir="retorno" data-id="' + esc(r.id) + '">Retorno</button>') + '</td></tr>').join('')
              : '<tr><td colspan="10" style="text-align:center;color:#166534;padding:16px;">No hay piezas dañadas ni en reparación.</td></tr>'}
            </tbody></table></div>
        </div>

        <div data-rsec="retiro">
          <div class="mt-seccion"><h3>Pieza dañada retirada de una unidad</h3>
            <div class="fila-campos">
              <div class="campo"><label>Fecha</label><input type="date" id="reFecha" value="${MT.hoy()}"></div>
              <div class="campo"><label>Placa de origen *</label><select id="rePlaca">${MT.opciones(d.placas, '')}</select></div>
              <div class="campo ancho2"><label>Observación (qué falla tiene)</label><input id="reObs" style="text-transform:uppercase"></div>
            </div>
            <table class="tabla-lista mt-lineas" id="tablaRetiro">
              <colgroup><col style="width:36%"><col><col style="width:70px"><col style="width:110px"><col style="width:40px"></colgroup>
              <thead><tr><th>Código</th><th>Pieza</th><th>Stock</th><th>Cantidad</th><th></th></tr></thead><tbody></tbody>
            </table>
            <button type="button" class="mt-agregar" id="reAgregar">+ Agregar pieza</button>
            <div class="mt-ayuda">La pieza queda como DAÑADA (no suma al stock operativo) hasta que la envíes a reparar y regrese.</div>
            <div class="mt-botones"><button class="boton-primario" id="reGrabar">Registrar pieza dañada</button></div>
          </div>
        </div>

        <div data-rsec="envio">
          <div class="mt-seccion"><h3>Envío a reparación</h3>
            <div class="fila-campos">
              <div class="campo ancho2"><label>Taller / proveedor *</label><input id="enTaller" list="dlTalleres" style="text-transform:uppercase">${MT.datalist('dlTalleres', talleres)}</div>
              <div class="campo"><label>N° de guía (opcional)</label><input id="enGuia" style="text-transform:uppercase"></div>
              <div class="campo"><label>Fecha de envío</label><input type="date" id="enFecha" value="${MT.hoy()}"></div>
              <div class="campo"><label>Fecha estimada de retorno</label><input type="date" id="enEstimada"></div>
              <div class="campo ancho2"><label>Observación</label><input id="enObs" style="text-transform:uppercase"></div>
            </div>
            <h3 style="margin-top:6px">Piezas dañadas pendientes</h3>
            <div class="mt-tabla-wrap" style="max-height:26vh;margin-bottom:10px"><table class="tabla-lista">
              <thead><tr><th style="width:34px"></th><th>Pieza</th><th>Cant.</th><th>Placa de origen</th><th>Retirada</th><th>Observación</th></tr></thead><tbody>
              ${danados.length ? danados.map(r => '<tr><td style="text-align:center"><input type="checkbox" class="en-chk" value="' + esc(r.id) + '"></td><td><b>' + esc(r.producto) + '</b><div class="mt-ayuda">' + esc(r.codigo) +
                '</div></td><td style="text-align:center">' + esc(r.cantidad) + '</td><td>' + esc(r.placa || '-') + '</td><td>' + esc(MT.fechaVista(r.fecha)) + '</td><td>' + esc(r.observacion || '') + '</td></tr>').join('')
                : '<tr><td colspan="6" style="text-align:center;color:#8b95a1;padding:12px;">No hay piezas dañadas registradas.</td></tr>'}
              </tbody></table></div>
            <h3>También enviar desde el stock del almacén (opcional)</h3>
            <table class="tabla-lista mt-lineas" id="tablaEnvioStock">
              <colgroup><col style="width:36%"><col><col style="width:70px"><col style="width:110px"><col style="width:40px"></colgroup>
              <thead><tr><th>Código</th><th>Producto</th><th>Stock</th><th>Cantidad</th><th></th></tr></thead><tbody></tbody>
            </table>
            <div class="mt-ayuda">Ejemplo: extintores vencidos guardados en el almacén. Se descuentan del stock operativo y quedan EN REPARACIÓN.</div>
            <div class="mt-botones"><button class="boton-primario" id="enGrabar">Registrar envío</button></div>
          </div>
        </div>

        <div data-rsec="retorno">
          <div class="mt-seccion"><h3>Retorno de reparación</h3>
            <div class="fila-campos">
              <div class="campo ancho4"><label>Pieza en reparación *</label><select id="rtId"><option value=""></option>${enRep.map(r => '<option value="' + esc(r.id) + '">' + esc(r.producto + ' · ' + r.cantidad + ' und · ' + (r.taller || 'sin taller') + ' · enviado ' + MT.fechaVista(r.fechaEnvio)) + '</option>').join('')}</select></div>
              <div class="campo"><label>Resultado *</label><select id="rtResultado"><option value="REPARADO">Reparado / operativo</option><option value="BAJA">No se pudo reparar (baja)</option></select></div>
              <div class="campo"><label>Cantidad que vuelve *</label><input type="number" id="rtCantidad" min="0" step="any"></div>
              <div class="campo"><label>Fecha de retorno</label><input type="date" id="rtFecha" value="${MT.hoy()}"></div>
              <div class="campo" id="rtCampoVence" style="display:none"><label>Nueva fecha de vencimiento *</label><input type="date" id="rtVence"></div>
              <div class="campo"><label>Costo de la reparación</label><input type="number" id="rtCosto" min="0" step="any"></div>
              <div class="campo"><label>Moneda</label><select id="rtMoneda"><option value="S/">S/</option><option value="$">$</option></select></div>
              <div class="campo"><label>Factura / boleta</label><input id="rtDoc" style="text-transform:uppercase"></div>
              <div class="campo ancho2"><label>Observación</label><input id="rtObs" style="text-transform:uppercase"></div>
            </div>
            <div class="mt-ayuda">Al registrar el retorno, la pieza vuelve al stock operativo. Si regresa menos cantidad, el resto sigue en reparación.</div>
            <div class="mt-botones"><button class="boton-primario" id="rtGrabar">Registrar retorno</button></div>
          </div>
        </div>

        <div data-rsec="canje">
          <div class="mt-seccion"><h3>Canje de extintores (entregas vencidos y recibes recargados)</h3>
            <div class="fila-campos">
              <div class="campo ancho2"><label>Producto *</label><select id="cjProducto"><option value=""></option>${vencibles.map(p => '<option value="' + esc(p.codigo) + '">' + esc(p.producto + ' (' + p.codigo + ') · stock ' + p.stock) + '</option>').join('')}</select></div>
              <div class="campo"><label>Cantidad *</label><input type="number" id="cjCantidad" min="0" step="any"></div>
              <div class="campo"><label>Fecha</label><input type="date" id="cjFecha" value="${MT.hoy()}"></div>
              <div class="campo"><label>Los vencidos vienen de *</label><select id="cjOrigen"><option value="ALMACEN">Stock del almacén</option><option value="UNIDAD">Una unidad (placa)</option></select></div>
              <div class="campo" id="cjCampoPlaca" style="display:none"><label>Placa</label><select id="cjPlaca">${MT.opciones(d.placas, '')}</select></div>
              <div class="campo ancho2"><label>Taller / proveedor *</label><input id="cjTaller" list="dlTalleres2" style="text-transform:uppercase">${MT.datalist('dlTalleres2', talleres)}</div>
              <div class="campo"><label>Nueva fecha de vencimiento *</label><input type="date" id="cjVence"></div>
              <div class="campo"><label>Costo</label><input type="number" id="cjCosto" min="0" step="any"></div>
              <div class="campo"><label>Moneda</label><select id="cjMoneda"><option value="S/">S/</option><option value="$">$</option></select></div>
              <div class="campo"><label>Factura / boleta</label><input id="cjDoc" style="text-transform:uppercase"></div>
            </div>
            <div class="mt-ayuda">Del almacén: el stock no cambia, solo se renueva la fecha de vencimiento. De una unidad: los recargados entran al stock (luego haces la Salida para instalarlos).</div>
            <div class="mt-botones"><button class="boton-primario" id="cjGrabar">Registrar canje</button></div>
          </div>
        </div>

        <div data-rsec="historial">
          <div class="mt-tabla-wrap"><table class="tabla-lista">
            <thead><tr><th>Producto</th><th>Cant.</th><th>Estado</th><th>Origen</th><th>Taller</th><th>Enviado</th><th>Retornó</th><th>Días</th><th>Costo</th><th>Documento</th></tr></thead><tbody>
            ${reps.filter(r => r.estado === 'RETORNADO' || r.estado === 'BAJA').map(r => '<tr><td><b>' + esc(r.producto) + '</b><div class="mt-ayuda">' + esc(r.codigo) + '</div></td><td style="text-align:center">' + esc(r.cantidad) + '</td><td>' + estadoHtml(r.estado) +
              '</td><td>' + esc(r.origen === 'UNIDAD' ? 'Placa ' + (r.placa || '-') : 'Almacén') + '</td><td>' + esc(r.taller || '') + '</td><td>' + esc(MT.fechaVista(r.fechaEnvio)) + '</td><td>' + esc(MT.fechaVista(r.fechaRetorno)) +
              '</td><td style="text-align:center">' + (r.dias === '' || r.dias === undefined ? '' : esc(r.dias)) + '</td><td style="white-space:nowrap">' + (r.costo ? esc(r.moneda) + ' ' + MT.dinero(r.costo) : '') + '</td><td>' + esc(r.documento || '') + '</td></tr>').join('')
              || '<tr><td colspan="10" style="text-align:center;color:#8b95a1;padding:16px;">Aún no hay reparaciones terminadas.</td></tr>'}
            </tbody></table></div>
        </div>
        <div class="mt-botones"><button class="boton-secundario" id="rCerrar">Cerrar</button></div>
      </div>`;

    abrirPanel('Reparaciones', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      const mostrar = function (k) {
        raiz.querySelectorAll('[data-rtab]').forEach(b => b.classList.toggle('activo', b.dataset.rtab === k));
        raiz.querySelectorAll('[data-rsec]').forEach(s => { s.style.display = s.dataset.rsec === k ? '' : 'none'; });
      };
      raiz.querySelectorAll('[data-rtab]').forEach(b => b.addEventListener('click', () => mostrar(b.dataset.rtab)));
      mostrar(tab);
      const usuario = function () {
        const u = $('rUsuario').value.trim();
        if (!u) { mostrarMensaje('Escribe el usuario.', 'error'); $('rUsuario').focus(); return ''; }
        MT.guardarUsuario(u);
        return u;
      };
      const recargar = function (k) { self._datos = null; self.abrirReparaciones(k); };
      $('rCerrar').addEventListener('click', cerrarPanel);
      raiz.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', function () {
        if (b.dataset.ir === 'envio') { mostrar('envio'); const c = raiz.querySelector('.en-chk[value="' + b.dataset.id + '"]'); if (c) c.checked = true; }
        else { mostrar('retorno'); $('rtId').value = b.dataset.id; $('rtId').dispatchEvent(new Event('change')); }
      }));

      // 1. Retiro
      const lineasRetiro = self._lineas(raiz, 'tablaRetiro', false);
      $('reAgregar').addEventListener('click', () => lineasRetiro.agregar().querySelector('.l-cod').focus());
      protegerClic($('reGrabar'), async function () {
        const u = usuario(); if (!u) return;
        if (!$('rePlaca').value) { mostrarMensaje('Elige la placa de donde se retiró la pieza.', 'error'); return; }
        if (raiz.querySelector('#tablaRetiro tr.l-sub')) { mostrarMensaje('Termina de crear el producto nuevo ("Guardar y seguir").', 'error'); return; }
        const err = lineasRetiro.validar(); if (err) { mostrarMensaje(err, 'error'); return; }
        const items = lineasRetiro.leer();
        const r = await MT.llamar('mtRepRetiro', { usuario: u, fecha: $('reFecha').value, placa: $('rePlaca').value, observacion: $('reObs').value,
          items: items.map(it => ({ codigo: it.codigo, cantidad: it.cantidad })), productosNuevos: items.filter(it => it.nuevo).map(it => it.nuevo) });
        if (!r) return;
        mostrarMensaje(r.mensaje, 'exito');
        recargar('pendientes');
      });

      // 2. Envío
      const lineasEnvio = self._lineas(raiz, 'tablaEnvioStock', true);
      protegerClic($('enGrabar'), async function () {
        const u = usuario(); if (!u) return;
        if (!$('enTaller').value.trim()) { mostrarMensaje('Escribe el taller o proveedor que hará la reparación.', 'error'); return; }
        const ids = Array.from(raiz.querySelectorAll('.en-chk:checked')).map(c => c.value);
        const desdeStock = lineasEnvio.leer().filter(it => it.codigo);
        if (desdeStock.length) { const err = lineasEnvio.validar(); if (err) { mostrarMensaje(err, 'error'); return; } }
        if (!ids.length && !desdeStock.length) { mostrarMensaje('Marca las piezas dañadas a enviar o agrega productos del stock.', 'error'); return; }
        const r = await MT.llamar('mtRepEnvio', { usuario: u, fecha: $('enFecha').value, taller: $('enTaller').value, guia: $('enGuia').value,
          fechaEstimada: $('enEstimada').value, observacion: $('enObs').value, ids: ids, desdeStock: desdeStock });
        if (!r) return;
        mostrarMensaje(r.mensaje, 'exito');
        recargar('pendientes');
      });

      // 3. Retorno
      const pintarRetorno = function () {
        const rep = enRep.find(x => x.id === $('rtId').value);
        const p = rep ? self._producto(rep.codigo) : null;
        $('rtCantidad').value = rep ? rep.cantidad : '';
        const vence = p && (/^S/i.test(String(p.vence || '')) || p.tipo === 'EXTINTOR');
        $('rtCampoVence').style.display = vence && $('rtResultado').value === 'REPARADO' ? '' : 'none';
      };
      $('rtId').addEventListener('change', pintarRetorno);
      $('rtResultado').addEventListener('change', pintarRetorno);
      protegerClic($('rtGrabar'), async function () {
        const u = usuario(); if (!u) return;
        if (!$('rtId').value) { mostrarMensaje('Elige la pieza que regresa.', 'error'); return; }
        const pideVence = $('rtCampoVence').style.display !== 'none';
        if (pideVence && !$('rtVence').value) { mostrarMensaje('Escribe la nueva fecha de vencimiento.', 'error'); return; }
        const r = await MT.llamar('mtRepRetorno', { usuario: u, id: $('rtId').value, resultado: $('rtResultado').value, cantidad: $('rtCantidad').value,
          fecha: $('rtFecha').value, nuevoVencimiento: pideVence ? $('rtVence').value : '', costo: $('rtCosto').value, moneda: $('rtMoneda').value,
          documento: $('rtDoc').value, observacion: $('rtObs').value });
        if (!r) return;
        mostrarMensaje(r.mensaje, 'exito');
        recargar('pendientes');
      });

      // Canje
      $('cjOrigen').addEventListener('change', function () { $('cjCampoPlaca').style.display = this.value === 'UNIDAD' ? '' : 'none'; });
      protegerClic($('cjGrabar'), async function () {
        const u = usuario(); if (!u) return;
        if (!$('cjProducto').value) { mostrarMensaje('Elige el producto.', 'error'); return; }
        if (!(MT.num($('cjCantidad').value) > 0)) { mostrarMensaje('Escribe la cantidad.', 'error'); return; }
        if (!$('cjTaller').value.trim()) { mostrarMensaje('Escribe el taller o proveedor.', 'error'); return; }
        if (!$('cjVence').value) { mostrarMensaje('Escribe la nueva fecha de vencimiento.', 'error'); return; }
        if ($('cjOrigen').value === 'UNIDAD' && !$('cjPlaca').value) { mostrarMensaje('Elige la placa.', 'error'); return; }
        const r = await MT.llamar('mtRepCanje', { usuario: u, fecha: $('cjFecha').value, codigo: $('cjProducto').value, cantidad: $('cjCantidad').value,
          origen: $('cjOrigen').value, placa: $('cjPlaca').value, taller: $('cjTaller').value, nuevoVencimiento: $('cjVence').value,
          costo: $('cjCosto').value, moneda: $('cjMoneda').value, documento: $('cjDoc').value });
        if (!r) return;
        mostrarMensaje(r.mensaje, 'exito');
        recargar('historial');
      });
    }, { ancho: true });
  },

  /** Carga en segundo plano al abrir el sistema (aviso de alertas y ventanas más rápidas). */
  precargar: async function () {
    try {
      const r = await llamarBackend('mtDatosAlmacen', {});
      if (r && Array.isArray(r.productos)) { this._datos = r; this._t = Date.now(); this.actualizarAvisoAlertas(); }
    } catch (e) { /* sin aviso: se cargará al abrir */ }
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const enlazar = function (id, fn) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', function () { if (!MT._pendientes) fn(); });
  };
  enlazar('btn-mt-ingreso', () => FormAlmacen.abrirIngreso());
  enlazar('btn-mt-salida', () => FormAlmacen.abrirSalida());
  enlazar('btn-mt-reparaciones', () => FormAlmacen.abrirReparaciones());
  enlazar('btn-mt-stock', () => FormAlmacen.abrirStock());
  enlazar('btn-mt-catalogo', () => FormAlmacen.abrirCatalogo());
  // Carga los datos del almacén en segundo plano: aviso de alertas y ventanas más rápidas.
  setTimeout(function () { FormAlmacen.precargar(); }, 2500);
});
