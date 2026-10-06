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
    @media (max-width: 900px){ .mt-form .fila-campos{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
  </style>`;

const MT_TIPOS_PRODUCTO = ['FILTRO', 'RODAJE', 'LUCES', 'MOTOR', 'FAJA', 'ACEITE', 'MANGUERA', 'TERMINAL', 'PERNO', 'SENSOR',
  'ELÉCTRICO', 'FRENO', 'LLANTA', 'HERRAMIENTA', 'ACCESORIO', 'EXTINTOR', 'CONSUMIBLE', 'TUBERIA', 'CHASIS', 'OTROS'];
const MT_CATEGORIAS = ['NUEVO', 'USADO', 'REMAN', 'CORE'];
const MT_UNIDADES = ['UNIDAD', 'DOCENA', 'CILINDRO', 'BALDE', 'CAJA', 'GALÓN', 'KILO', 'BOLSA', 'PAQUETE', 'JUEGO', 'LITRO', 'METRO', 'PAR', 'KIT'];
const MT_MOTIVOS_SALIDA = ['MANTENIMIENTO', 'CONSUMO INTERNO', 'OTROS'];

const FormAlmacen = {

  _datos: null,

  _cargar: async function () {
    const r = await MT.llamar('mtDatosAlmacen', {});
    if (r && !Array.isArray(r.productos)) {
      mostrarMensaje('El servidor no devolvió los datos del almacén. Intente de nuevo en unos segundos.', 'error');
      return null;
    }
    if (r) this._datos = r;
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
    this._datos = null;
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

  /* ============================ INGRESO ============================ */

  abrirIngreso: async function () {
    if (!(await this._cargar())) return;
    const self = this;
    const remans = self._datos.productos.filter(p => p.tipo === 'EXTINTOR' && p.categoria === 'REMAN');

    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="mt-seccion"><h3>Ingreso de productos</h3>
          <div class="fila-campos">
            <div class="campo"><label>Fecha</label><input type="date" id="iFecha" value="${MT.hoy()}"></div>
            <div class="campo"><label>Hora</label><input type="time" step="1" id="iHora" value="${MT.ahora()}"></div>
            ${self._campoUsuario('iUsuario')}
            <div class="campo"><label>N° documento</label><input type="text" id="iDocumento" autocomplete="off" style="text-transform:uppercase"></div>
            <div class="campo ancho2"><label>Código del producto</label>
              <div class="mt-buscar"><input type="text" id="iCodigo" autocomplete="off" style="text-transform:uppercase" placeholder="Escriba o escanee el código"><button type="button" id="btnBuscarIngreso" title="Consultar stock">Buscar</button></div>
            </div>
            <div class="campo ancho2"><label>Producto</label><input type="text" id="iProducto" readonly></div>
            <div class="campo"><label>Marca</label><input type="text" id="iMarca" readonly></div>
            <div class="campo"><label>Categoría</label><input type="text" id="iCategoria" readonly></div>
            <div class="campo"><label>Ubicación</label><input type="text" id="iUbicacion" readonly></div>
            <div class="campo"><label>Stock actual</label><input type="text" id="iStock" readonly class="mt-stock"></div>
            <div class="campo"><label>Cantidad ingresada</label><input type="number" id="iCantidad" min="0" step="any"></div>
            <div class="campo ancho2"><label>Razón social (proveedor)</label><select id="iRazon">${MT.opciones(self._datos.proveedores.map(p => p.razonSocial), '')}</select></div>
            <div class="campo"><label>RUC</label><input type="text" id="iRuc" readonly></div>
            <div class="campo ancho4"><label>Observación</label><input type="text" id="iObs" autocomplete="off" style="text-transform:uppercase"></div>
          </div>
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
      function mostrarProducto(p) {
        $('iCodigo').value = p ? p.codigo : $('iCodigo').value;
        $('iProducto').value = p ? p.producto : '';
        $('iMarca').value = p ? p.marca : '';
        $('iCategoria').value = p ? p.categoria : '';
        $('iUbicacion').value = p ? p.ubicacion : '';
        $('iStock').value = p ? p.stock : '';
      }
      function buscar() {
        const c = $('iCodigo').value.trim();
        if (!c) { mostrarProducto(null); return; }
        const p = self._producto(c);
        if (!p) { mostrarProducto(null); mostrarMensaje('Producto no encontrado. Verifique el código.', 'error'); return; }
        mostrarProducto(p);
      }
      $('iCodigo').addEventListener('change', buscar);
      $('btnBuscarIngreso').addEventListener('click', () => self.consultarStock(p => { mostrarProducto(p); $('iCantidad').focus(); }));
      $('iRazon').addEventListener('change', function () {
        const p = self._datos.proveedores.find(x => x.razonSocial === this.value);
        $('iRuc').value = p ? p.ruc : '';
      });
      function limpiarProducto() {
        ['iCodigo', 'iProducto', 'iMarca', 'iCategoria', 'iUbicacion', 'iStock', 'iCantidad', 'iObs'].forEach(id => { $(id).value = ''; });
        $('iHora').value = MT.ahora();
      }
      function limpiarTodo() {
        limpiarProducto();
        $('iFecha').value = MT.hoy(); $('iDocumento').value = ''; $('iRazon').value = ''; $('iRuc').value = '';
        _refrescarSnapshotFormulario();
      }
      $('btnLimpiarIngreso').addEventListener('click', limpiarTodo);
      $('btnInicioIngreso').addEventListener('click', solicitarCierrePanel);

      protegerClic($('btnGrabarIngreso'), async function () {
        const usuario = $('iUsuario').value.trim();
        if (!usuario) { mostrarMensaje('Ingrese el usuario.', 'error'); return; }
        if (!$('iProducto').value) { buscar(); if (!$('iProducto').value) return; }
        MT.guardarUsuario(usuario);
        const r = await MT.llamar('mtGrabarIngreso', {
          tipo: 'NORMAL', fecha: $('iFecha').value, hora: $('iHora').value, usuario: usuario,
          documento: $('iDocumento').value, codigo: $('iCodigo').value, cantidad: $('iCantidad').value,
          razonSocial: $('iRazon').value, ruc: $('iRuc').value, observacion: $('iObs').value
        });
        if (!r) return;
        const p = self._producto($('iCodigo').value);
        if (p) { p.stock = r.stockFinal; if ($('iRazon').value) p.proveedor = $('iRazon').value; }
        if (confirmar(r.mensaje + '\nStock: ' + r.stockAntes + ' → ' + r.stockFinal +
          '\n\n¿Desea registrar otro ingreso con el mismo documento y proveedor?')) {
          limpiarProducto();
          $('iCodigo').focus();
          _refrescarSnapshotFormulario();
        } else {
          limpiarTodo();
        }
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
        if (p) p.stock = r.stockFinal;
        mostrarMensaje(r.mensaje, 'exito');
        ['rProducto', 'rCantidad', 'rVence'].forEach(id => { $(id).value = ''; });
        _refrescarSnapshotFormulario();
      });
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
        <div class="mt-seccion"><h3>Salida de productos</h3>
          <div class="fila-campos">
            <div class="campo"><label>Fecha</label><input type="date" id="sFecha" value="${MT.hoy()}"></div>
            <div class="campo"><label>Hora</label><input type="time" step="1" id="sHora" value="${MT.ahora()}"></div>
            ${self._campoUsuario('sUsuario')}
            <div class="campo"></div>
            <div class="campo ancho2"><label>Código del producto</label>
              <div class="mt-buscar"><input type="text" id="sCodigo" autocomplete="off" style="text-transform:uppercase" placeholder="Escriba o escanee el código"><button type="button" id="btnBuscarSalida" title="Consultar stock">Buscar</button></div>
            </div>
            <div class="campo ancho2"><label>Producto</label><input type="text" id="sProducto" readonly></div>
            <div class="campo"><label>Marca</label><input type="text" id="sMarca" readonly></div>
            <div class="campo"><label>Categoría</label><input type="text" id="sCategoria" readonly></div>
            <div class="campo"><label>Ubicación</label><input type="text" id="sUbicacion" readonly></div>
            <div class="campo"><label>Stock actual</label><input type="text" id="sStock" readonly class="mt-stock"></div>
            <div class="campo"><label>Cantidad entregada</label><input type="number" id="sCantidad" min="0" step="any"></div>
            <div class="campo"><label>Entregado a</label><select id="sEntregado">${MT.opciones(d.personal, '')}</select></div>
            <div class="campo"><label>Placa</label><select id="sPlaca">${MT.opciones(d.placas, '')}</select></div>
            <div class="campo"><label>Motivo de salida</label><select id="sMotivo">${MT.opciones(MT_MOTIVOS_SALIDA, '')}</select></div>
            <div class="campo ancho4"><label>Observación</label><input type="text" id="sObs" autocomplete="off" style="text-transform:uppercase"></div>
          </div>
          <div class="mt-ayuda">Las salidas con motivo MANTENIMIENTO quedan pendientes para asociarlas en "Registrar mantenimiento".</div>
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
      function mostrarProducto(p) {
        $('sCodigo').value = p ? p.codigo : $('sCodigo').value;
        $('sProducto').value = p ? p.producto : '';
        $('sMarca').value = p ? p.marca : '';
        $('sCategoria').value = p ? p.categoria : '';
        $('sUbicacion').value = p ? p.ubicacion : '';
        $('sStock').value = p ? p.stock : '';
      }
      function buscar() {
        const c = $('sCodigo').value.trim();
        if (!c) { mostrarProducto(null); return; }
        const p = self._producto(c);
        if (!p) { mostrarProducto(null); mostrarMensaje('Producto no encontrado. Verifique el código.', 'error'); return; }
        mostrarProducto(p);
      }
      $('sCodigo').addEventListener('change', buscar);
      $('btnBuscarSalida').addEventListener('click', () => self.consultarStock(p => { mostrarProducto(p); $('sCantidad').focus(); }));
      function limpiarProducto() {
        ['sCodigo', 'sProducto', 'sMarca', 'sCategoria', 'sUbicacion', 'sStock', 'sCantidad', 'sObs'].forEach(id => { $(id).value = ''; });
        $('sHora').value = MT.ahora();
      }
      function limpiarTodo() {
        limpiarProducto();
        ['sEntregado', 'sPlaca', 'sMotivo', 'cProducto', 'cPlaca', 'cCantidad'].forEach(id => { $(id).value = ''; });
        $('sFecha').value = MT.hoy();
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
        if (!$('sProducto').value) { buscar(); if (!$('sProducto').value) return; }
        const p = self._producto($('sCodigo').value);
        const cant = MT.num($('sCantidad').value);
        if (p && !isNaN(cant) && cant > p.stock) { mostrarMensaje('No hay stock suficiente. Stock actual: ' + p.stock, 'error'); return; }
        const r = await MT.llamar('mtGrabarSalida', {
          tipo: 'NORMAL', fecha: $('sFecha').value, hora: $('sHora').value, usuario: usuario,
          codigo: $('sCodigo').value, cantidad: $('sCantidad').value, entregadoA: $('sEntregado').value,
          placa: $('sPlaca').value, motivo: $('sMotivo').value, observacion: $('sObs').value
        });
        if (!r) return;
        if (p) p.stock = r.stockFinal;
        if (r.stockMinimo) mostrarMensaje('Salida registrada. Atención: el producto quedó en stock mínimo o por debajo (stock: ' + r.stockFinal + ').', 'error');
        if (confirmar(r.mensaje + '\n\n¿Desea registrar otra salida para la misma persona y placa?')) {
          limpiarProducto();
          $('sCodigo').focus();
          _refrescarSnapshotFormulario();
        } else {
          limpiarTodo();
        }
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
        mostrarMensaje(r.mensaje, 'exito');
        ['cProducto', 'cPlaca', 'cCantidad'].forEach(id => { $(id).value = ''; });
        _refrescarSnapshotFormulario();
      }
      protegerClic($('btnIngresoCore'), () => core('CORE_INGRESO'));
      protegerClic($('btnSalidaCore'), () => core('CORE_RECARGA'));
    }, { clase: 'panel-servicio' });
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
});
