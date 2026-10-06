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
    @media (max-width: 900px){ .mt-form .fila-campos{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
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
              <div class="mt-buscar"><input type="text" id="pCodigo" autocomplete="off" style="text-transform:uppercase"><button type="button" id="btnGenerarCodigo">Generar código</button></div>
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
          <div class="campo ancho4"><label>Razón social</label><input type="text" id="vRazon" autocomplete="off" style="text-transform:uppercase"></div>
          <div class="campo"><label>RUC</label><input type="text" id="vRuc" maxlength="11" inputmode="numeric" autocomplete="off"></div>
          <div class="campo"><label>Nombre de contacto</label><input type="text" id="vContacto" autocomplete="off" style="text-transform:uppercase"></div>
          <div class="campo"><label>Teléfono</label><input type="text" id="vTelefono" inputmode="numeric" autocomplete="off"></div>
          <div class="campo"><label>Correo</label><input type="email" id="vCorreo" autocomplete="off"></div>
          <div class="campo ancho4"><label>Dirección</label><input type="text" id="vDireccion" autocomplete="off" style="text-transform:uppercase"></div>
        </div>
        <div class="mt-botones">
          <button class="boton-secundario" id="btnInicioProveedor">Inicio</button>
          <button class="boton-secundario" id="btnLimpiarProveedor">Limpiar</button>
          <button class="boton-primario" id="btnGrabarProveedor">Grabar</button>
        </div>
      </div>`;

    abrirPanel('Registrar proveedor', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      const ids = ['vRazon', 'vRuc', 'vContacto', 'vTelefono', 'vCorreo', 'vDireccion'];
      const limpiar = function () { ids.forEach(id => { $(id).value = ''; }); _refrescarSnapshotFormulario(); };
      $('btnLimpiarProveedor').addEventListener('click', limpiar);
      $('btnInicioProveedor').addEventListener('click', solicitarCierrePanel);
      protegerClic($('btnGrabarProveedor'), async function () {
        const r = await MT.llamar('mtGrabarProveedor', {
          razonSocial: $('vRazon').value, ruc: $('vRuc').value, contacto: $('vContacto').value,
          telefono: $('vTelefono').value, correo: $('vCorreo').value, direccion: $('vDireccion').value
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
  _lineas: function (raiz, idTabla, esSalida) {
    const self = this;
    const tbody = raiz.querySelector('#' + idTabla + ' tbody');
    const camara = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>';
    function pintarFila(tr) {
      const p = self._producto(tr.querySelector('.l-cod').value);
      const cant = MT.num(tr.querySelector('.l-cant').value);
      tr.querySelector('.l-prod').innerHTML = p ? '<b>' + esc(p.producto) + '</b><div class="mt-ayuda">' + esc([p.marca, p.categoria, p.ubicacion].filter(Boolean).join(' · ')) + '</div>'
        : (tr.querySelector('.l-cod').value.trim() ? '<span class="mt-bajo">Código no encontrado</span>' : '');
      tr.querySelector('.l-stock').textContent = p ? p.stock : '';
      const mal = esSalida && p && !isNaN(cant) && cant > p.stock;
      tr.querySelector('.l-stock').classList.toggle('mt-bajo', !!mal);
      tr.querySelector('.l-cant').classList.toggle('falta', !!mal);
    }
    function agregar(codigo) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><div class="mt-buscar"><input class="l-cod" autocomplete="off" placeholder="Código o escanear" style="text-transform:uppercase">' +
        '<button type="button" class="l-lupa" title="Buscar en el stock">Buscar</button><button type="button" class="l-cam" title="Escanear con la cámara">' + camara + '</button></div></td>' +
        '<td class="l-prod"></td><td class="l-stock mt-stock" style="text-align:center"></td>' +
        '<td><input class="l-cant" type="number" min="0" step="any" placeholder="0"></td>' +
        '<td style="text-align:center"><button type="button" class="btn-quitar-l" title="Quitar">×</button></td>';
      const cod = tr.querySelector('.l-cod'), cant = tr.querySelector('.l-cant');
      const elegir = function (p) { if (p) { cod.value = p.codigo; pintarFila(tr); cant.focus(); } };
      cod.addEventListener('change', function () { pintarFila(tr); });
      cod.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); pintarFila(tr); if (self._producto(cod.value)) cant.focus(); } });
      cant.addEventListener('input', function () { pintarFila(tr); });
      cant.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); agregar().querySelector('.l-cod').focus(); } });
      tr.querySelector('.l-lupa').addEventListener('click', function () { self.consultarStock(elegir); });
      tr.querySelector('.l-cam').addEventListener('click', function () { MT.escanear(function (c) { elegir(self._producto(c) || (cod.value = c, null)); pintarFila(tr); }); });
      tr.querySelector('.btn-quitar-l').addEventListener('click', function () {
        if (tbody.children.length > 1) tr.remove(); else { cod.value = ''; cant.value = ''; pintarFila(tr); }
      });
      if (codigo) { cod.value = codigo; }
      tbody.appendChild(tr);
      pintarFila(tr);
      return tr;
    }
    function leer() {
      return Array.from(tbody.querySelectorAll('tr')).map(function (tr) {
        return { codigo: tr.querySelector('.l-cod').value.trim().toUpperCase(), cantidad: tr.querySelector('.l-cant').value.trim() };
      }).filter(function (x) { return x.codigo || x.cantidad; });
    }
    function validar() {
      const items = leer();
      if (!items.length) return 'Agrega al menos un producto.';
      for (let i = 0; i < items.length; i++) {
        const p = self._producto(items[i].codigo);
        if (!p) return 'Producto ' + (i + 1) + ': el código ' + (items[i].codigo || '(vacío)') + ' no existe.';
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
    agregar();
    return { agregar: agregar, leer: leer, validar: validar, limpiar: limpiar };
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
    const remans = self._datos.productos.filter(p => p.tipo === 'EXTINTOR' && p.categoria === 'REMAN');

    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="mt-seccion"><h3>Documento de compra</h3>
          <div class="fila-campos">
            <div class="campo"><label>Fecha</label><input type="date" id="iFecha" value="${MT.hoy()}"></div>
            <div class="campo"><label>Hora</label><input type="time" step="1" id="iHora" value="${MT.ahora()}"></div>
            ${self._campoUsuario('iUsuario')}
            <div class="campo"><label>Tipo de documento</label><select id="iTipoDoc"><option value=""></option><option value="FACTURA">FACTURA</option><option value="BOLETA">BOLETA</option></select></div>
            <div class="campo"><label>N° de documento</label><input type="text" id="iDocumento" autocomplete="off" placeholder="Ej. F001-000123" style="text-transform:uppercase"></div>
            <div class="campo ancho2"><label>Razón social (proveedor)</label><select id="iRazon">${MT.opciones(self._datos.proveedores.map(p => p.razonSocial), '')}</select></div>
            <div class="campo"><label>RUC</label><input type="text" id="iRuc" readonly></div>
            <div class="campo ancho4"><label>Observación (opcional)</label><input type="text" id="iObs" autocomplete="off" style="text-transform:uppercase"></div>
          </div>
        </div>
        <div class="mt-seccion"><h3>Productos</h3>
          <table class="tabla-lista mt-lineas" id="tablaLineasIng">
            <colgroup><col style="width:30%"><col><col style="width:80px"><col style="width:120px"><col style="width:40px"></colgroup>
            <thead><tr><th>Código</th><th>Producto</th><th>Stock</th><th>Cantidad ingresada</th><th></th></tr></thead><tbody></tbody>
          </table>
          <button type="button" class="mt-agregar" id="btnAgregarLineaIng">+ Agregar producto</button>
          <div class="mt-ayuda">Con el lector de código de barras: escanea, escribe la cantidad y presiona Enter para pasar al siguiente producto.</div>
          <div class="mt-botones">
            <button class="boton-secundario" id="btnInicioIngreso">Inicio</button>
            <button class="boton-secundario" id="btnLimpiarIngreso">Limpiar</button>
            <button class="boton-primario" id="btnGrabarIngreso">Grabar ingreso</button>
          </div>
        </div>
        <div class="mt-seccion mt-especial"><h3>Ingreso REMAN (extintores recargados)</h3>
          <div class="fila-campos">
            <div class="campo ancho2"><label>Producto REMAN</label><select id="rProducto">${'<option value=""></option>' + remans.map(p => '<option value="' + esc(p.codigo) + '">' + esc(p.producto) + ' (' + esc(p.codigo) + ')</option>').join('')}</select></div>
            <div class="campo"><label>Cantidad</label><input type="number" id="rCantidad" min="0" step="any"></div>
            <div class="campo"><label>Nueva fecha de vencimiento</label><input type="date" id="rVence"></div>
          </div>
          <div class="mt-botones"><button class="boton-primario" id="btnIngresoReman">Registrar ingreso REMAN</button></div>
        </div>
      </div>`;

    abrirPanel('Registrar ingreso', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      const lineas = self._lineas(raiz, 'tablaLineasIng', false);
      $('btnAgregarLineaIng').addEventListener('click', () => lineas.agregar().querySelector('.l-cod').focus());
      $('iRazon').addEventListener('change', function () {
        const p = self._datos.proveedores.find(x => x.razonSocial === this.value);
        $('iRuc').value = p ? p.ruc : '';
      });
      function limpiarTodo() {
        lineas.limpiar();
        ['iTipoDoc', 'iDocumento', 'iRazon', 'iRuc', 'iObs'].forEach(id => { $(id).value = ''; });
        $('iFecha').value = MT.hoy(); $('iHora').value = MT.ahora();
        _refrescarSnapshotFormulario();
      }
      $('btnLimpiarIngreso').addEventListener('click', limpiarTodo);
      $('btnInicioIngreso').addEventListener('click', solicitarCierrePanel);

      protegerClic($('btnGrabarIngreso'), async function () {
        const usuario = $('iUsuario').value.trim();
        if (!usuario) { mostrarMensaje('Ingrese el usuario.', 'error'); return; }
        if (!$('iTipoDoc').value) { mostrarMensaje('Elige si el documento es FACTURA o BOLETA.', 'error'); return; }
        if (!$('iDocumento').value.trim()) { mostrarMensaje('Escribe el número de ' + $('iTipoDoc').value.toLowerCase() + '.', 'error'); return; }
        if (!$('iRazon').value) { mostrarMensaje('Seleccione la razón social del proveedor.', 'error'); return; }
        const err = lineas.validar();
        if (err) { mostrarMensaje(err, 'error'); return; }
        MT.guardarUsuario(usuario);
        const r = await MT.llamar('mtGrabarIngresoLote', {
          fecha: $('iFecha').value, hora: $('iHora').value, usuario: usuario,
          tipoDocumento: $('iTipoDoc').value, documento: $('iDocumento').value, razonSocial: $('iRazon').value, ruc: $('iRuc').value,
          observacion: $('iObs').value, items: lineas.leer()
        });
        if (!r) return;
        self._aplicarStocks(r.items);
        const prov = $('iRazon').value;
        r.items.forEach(it => { const p = self._producto(it.codigo); if (p) p.proveedor = prov; });
        mostrarMensaje(r.mensaje, 'exito');
        limpiarTodo();
      });

      protegerClic($('btnIngresoReman'), async function () {
        const usuario = $('iUsuario').value.trim();
        if (!usuario) { mostrarMensaje('Ingrese el usuario.', 'error'); return; }
        if (!$('rProducto').value) { mostrarMensaje('Seleccione el producto REMAN que está ingresando.', 'error'); return; }
        MT.guardarUsuario(usuario);
        const r = await MT.llamar('mtGrabarIngreso', {
          tipo: 'REMAN', fecha: $('iFecha').value, hora: $('iHora').value, usuario: usuario,
          codigo: $('rProducto').value, cantidad: $('rCantidad').value, fechaVencimiento: $('rVence').value
        });
        if (!r) return;
        const p = self._producto($('rProducto').value);
        if (p) { p.stock = r.stockFinal; p.vence = 'SÍ'; p.fechaVencimiento = $('rVence').value; }
        FormAlmacen.actualizarAvisoAlertas();
        mostrarMensaje(r.mensaje, 'exito');
        ['rProducto', 'rCantidad', 'rVence'].forEach(id => { $(id).value = ''; });
        _refrescarSnapshotFormulario();
      });
      raiz.querySelector('#tablaLineasIng .l-cod').focus();
    }, { clase: 'panel-servicio' });
  },

  /* ============================ SALIDA ============================ */

  abrirSalida: async function () {
    if (!(await this._cargar())) return;
    const self = this;
    const d = self._datos;
    const cores = d.productos.filter(p => p.tipo === 'EXTINTOR' && p.categoria === 'CORE');

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
        <div class="mt-seccion mt-especial"><h3>Extintores CORE</h3>
          <div class="fila-campos">
            <div class="campo ancho2"><label>Producto CORE</label><select id="cProducto">${'<option value=""></option>' + cores.map(p => '<option value="' + esc(p.codigo) + '">' + esc(p.producto) + ' (' + esc(p.codigo) + ')</option>').join('')}</select></div>
            <div class="campo"><label>Placa de origen</label><select id="cPlaca">${MT.opciones(d.placas, '')}</select></div>
            <div class="campo"><label>Cantidad</label><input type="number" id="cCantidad" min="0" step="any"></div>
          </div>
          <div class="mt-ayuda">Ingreso CORE: extintor vencido que se retira de una unidad (pide placa de origen). Salida CORE a recarga: envía los CORE a recargar.</div>
          <div class="mt-botones">
            <button class="boton-secundario" id="btnSalidaCore">Salida CORE a recarga</button>
            <button class="boton-primario" id="btnIngresoCore">Ingreso CORE</button>
          </div>
        </div>
      </div>`;

    abrirPanel('Registrar salida', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      const lineas = self._lineas(raiz, 'tablaLineasSal', true);
      $('btnAgregarLineaSal').addEventListener('click', () => lineas.agregar().querySelector('.l-cod').focus());
      function limpiarTodo() {
        lineas.limpiar();
        ['sEntregado', 'sPlaca', 'sMotivo', 'sObs', 'cProducto', 'cPlaca', 'cCantidad'].forEach(id => { $(id).value = ''; });
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

      async function core(tipo) {
        const usuario = usuarioOk();
        if (!usuario) return;
        if (!$('cProducto').value) { mostrarMensaje('Seleccione el producto CORE.', 'error'); return; }
        if (tipo === 'CORE_INGRESO' && !$('cPlaca').value) { mostrarMensaje('Seleccione la placa de origen del CORE.', 'error'); return; }
        const r = await MT.llamar('mtGrabarSalida', {
          tipo: tipo, fecha: $('sFecha').value, hora: $('sHora').value, usuario: usuario,
          codigo: $('cProducto').value, cantidad: $('cCantidad').value, placaCore: $('cPlaca').value, observacion: $('sObs').value
        });
        if (!r) return;
        const p = self._producto($('cProducto').value);
        if (p) p.stock = r.stockFinal;
        FormAlmacen.actualizarAvisoAlertas();
        mostrarMensaje(r.mensaje, 'exito');
        ['cProducto', 'cPlaca', 'cCantidad'].forEach(id => { $(id).value = ''; });
        _refrescarSnapshotFormulario();
      }
      protegerClic($('btnIngresoCore'), () => core('CORE_INGRESO'));
      protegerClic($('btnSalidaCore'), () => core('CORE_RECARGA'));
    }, { clase: 'panel-servicio' });
  },

  /* ============================ KARDEX POR PRODUCTO ============================ */

  abrirKardex: async function (codigoInicial) {
    if (!(await this._cargar())) return;
    const self = this;
    const html = MT_ESTILOS + `
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
    abrirPanel('Kardex por producto', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
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
    return { stock: stock, venc: venc, total: stock.length + venc.length };
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
    const html = MT_ESTILOS + `
      <div class="mt-form">
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
    abrirPanel('Alertas del almacén', html, function (raiz) {
      raiz.querySelector('#aCerrar').addEventListener('click', cerrarPanel);
      raiz.querySelectorAll('[data-kardex]').forEach(b => b.addEventListener('click', () => self.abrirKardex(b.dataset.kardex)));
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
  enlazar('btn-mt-producto', () => FormAlmacen.abrirProducto());
  enlazar('btn-mt-proveedor', () => FormAlmacen.abrirProveedor());
  enlazar('btn-mt-ingreso', () => FormAlmacen.abrirIngreso());
  enlazar('btn-mt-salida', () => FormAlmacen.abrirSalida());
  enlazar('btn-mt-stock', () => FormAlmacen.abrirConsultaStock());
  enlazar('btn-mt-kardex', () => FormAlmacen.abrirKardex());
  enlazar('btn-mt-alertas', () => FormAlmacen.abrirAlertas());
  // Carga los datos del almacén en segundo plano: aviso de alertas y ventanas más rápidas.
  setTimeout(function () { FormAlmacen.precargar(); }, 2500);
});
