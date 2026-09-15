/**
 * documentos.js
 * -------------------------------------------------------------------------
 * Modulo de Documentos con vencimiento para Conductores, Tractos y
 * Semirremolques. Permite cargar un archivo (se guarda en Google Drive) y
 * la fecha de vencimiento de cada documento del checklist.
 * -------------------------------------------------------------------------
 */

const FormDocumentos = {
  _tipos: [
    { clave: 'CONDUCTORES', etiqueta: 'Conductores', campoClave: 'DNI', tituloClave: 'DNI', campos: [
      { campo: 'NOMBRE', etiqueta: 'Nombres y Apellidos' },
      { campo: 'DNI', etiqueta: 'N° DNI' },
      { campo: 'BREVETE', etiqueta: 'N° Brevete' },
      { campo: 'TELEFONO', etiqueta: 'Celular' }
    ] },
    { clave: 'TRACTOS', etiqueta: 'Tractos', campoClave: 'PLACA', tituloClave: 'Placa', campos: [
      { campo: 'PLACA', etiqueta: 'Placa' }
    ] },
    { clave: 'SEMIRREMOLQUES', etiqueta: 'Semirremolques', campoClave: 'PLACA', tituloClave: 'Placa', campos: [
      { campo: 'PLACA', etiqueta: 'Placa' }
    ] }
  ],
  _tipoActual: 'CONDUCTORES',
  _entidades: [],
  _mostrarAgregar: false,

  abrir: function (tipoInicial) {
    this._tipoActual = tipoInicial || 'CONDUCTORES';
    this._mostrarAgregar = false;
    abrirPanel('Documentos', this._plantillaLista(), function (raiz) { FormDocumentos._wireLista(raiz); }, { ancho: true });
  },

  _tipoInfo: function (clave) {
    const buscado = clave || this._tipoActual;
    return this._tipos.filter(function (t) { return t.clave === buscado; })[0];
  },

  _plantillaLista: function () {
    const self = this;
    const tabs = this._tipos.map(function (t) {
      const activo = t.clave === self._tipoActual ? ' activo' : '';
      return '<button type="button" class="tab-documentos' + activo + '" data-tipo="' + t.clave + '">' + t.etiqueta + '</button>';
    }).join('');
    return '' +
      '<div class="tabs-documentos">' + tabs + '</div>' +
      '<div class="barra-filtros">' +
        '<div class="campo"><label>Buscar</label><input type="text" id="buscarEntidad" placeholder="Nombre, DNI o placa..."></div>' +
        '<button type="button" class="boton-secundario" id="btnRecargarDocs">Recargar</button>' +
        '<button type="button" class="boton-primario" id="btnAgregarEntidad">+ Agregar</button>' +
      '</div>' +
      '<div id="formAgregarEntidad"></div>' +
      '<div id="listaEntidadesDocs">Cargando...</div>';
  },

  _wireLista: function (raiz) {
    const self = this;
    Array.prototype.forEach.call(raiz.querySelectorAll('.tab-documentos'), function (btn) {
      btn.addEventListener('click', function () {
        self._tipoActual = btn.getAttribute('data-tipo');
        self._mostrarAgregar = false;
        actualizarPanel('Documentos', self._plantillaLista(), function (r) { self._wireLista(r); });
      });
    });
    raiz.querySelector('#btnRecargarDocs').addEventListener('click', function () { self._cargar(raiz); });
    raiz.querySelector('#btnAgregarEntidad').addEventListener('click', function () {
      self._mostrarAgregar = !self._mostrarAgregar;
      self._renderFormAgregar(raiz);
    });
    raiz.querySelector('#buscarEntidad').addEventListener('input', function () { self._renderLista(raiz); });
    this._renderFormAgregar(raiz);
    this._cargar(raiz);
  },

  _renderFormAgregar: function (raiz) {
    const cont = raiz.querySelector('#formAgregarEntidad');
    if (!this._mostrarAgregar) { cont.innerHTML = ''; return; }
    const info = this._tipoInfo();
    const self = this;
    cont.innerHTML = '<div class="fila-campos">' +
      info.campos.map(function (c) {
        return '<div class="campo"><label>' + c.etiqueta + '</label><input type="text" data-campo="' + c.campo + '"></div>';
      }).join('') +
      '</div><div style="margin:8px 0 16px;"><button type="button" class="boton-primario" id="btnGuardarEntidad">Guardar</button> ' +
      '<button type="button" class="boton-secundario" id="btnCancelarEntidad">Cancelar</button></div>';
    cont.querySelector('#btnCancelarEntidad').addEventListener('click', function () {
      self._mostrarAgregar = false;
      self._renderFormAgregar(raiz);
    });
    cont.querySelector('#btnGuardarEntidad').addEventListener('click', async function () {
      const datos = { tipoEntidad: self._tipoActual };
      info.campos.forEach(function (c) {
        datos[c.campo] = cont.querySelector('[data-campo="' + c.campo + '"]').value.trim();
      });
      if (!datos[info.campoClave]) { mostrarMensaje('Complete el campo ' + info.tituloClave + '.', 'error'); return; }
      const resp = await llamarBackend('agregarEntidadDocumentos', datos);
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      mostrarMensaje(resp.mensaje, 'exito');
      self._mostrarAgregar = false;
      self._renderFormAgregar(raiz);
      self._cargar(raiz);
    });
  },

  _cargar: async function (raiz) {
    const cont = raiz.querySelector('#listaEntidadesDocs');
    cont.textContent = 'Cargando...';
    const resp = await llamarBackend('listarDocumentos', { tipoEntidad: this._tipoActual });
    if (!resp.ok) { cont.textContent = 'Error al cargar.'; mostrarMensaje(resp.mensaje || 'Error al cargar documentos.', 'error'); return; }
    this._entidades = resp.entidades || [];
    this._renderLista(raiz);
  },

  _resumenEntidad: function (documentos) {
    const orden = { VENCIDO: 3, POR_VENCER: 2, PENDIENTE: 1, OK: 0 };
    let peor = null;
    (documentos || []).forEach(function (d) {
      if (!peor || orden[d.estado] > orden[peor.estado]) peor = d;
    });
    if (!peor) return { estado: 'OK', texto: 'Vigente' };
    const mapa = {
      OK: 'Vigente',
      POR_VENCER: (peor.dias === 0 ? (peor.etiqueta + ': vence hoy') : (peor.etiqueta + ': vence en ' + peor.dias + ' d.')),
      VENCIDO: peor.etiqueta + ': vencido hace ' + Math.abs(peor.dias) + ' d.',
      PENDIENTE: 'Documentos pendientes'
    };
    return { estado: peor.estado, texto: mapa[peor.estado] };
  },

  _badgeEstado: function (estado, texto) {
    const clases = { OK: 'ok', POR_VENCER: 'por-vencer', VENCIDO: 'vencido', PENDIENTE: 'pendiente' };
    return '<span class="badge-doc ' + (clases[estado] || 'pendiente') + '">' + texto + '</span>';
  },

  _renderLista: function (raiz) {
    const self = this;
    const info = this._tipoInfo();
    const filtro = (raiz.querySelector('#buscarEntidad').value || '').trim().toUpperCase();
    let filas = this._entidades;
    if (filtro) {
      filas = filas.filter(function (f) {
        return info.campos.some(function (c) { return String(f[c.campo] || '').toUpperCase().indexOf(filtro) !== -1; });
      });
    }
    const cont = raiz.querySelector('#listaEntidadesDocs');
    if (!filas.length) { cont.innerHTML = '<p>No hay registros.</p>'; return; }
    const tituloCol = info.clave === 'CONDUCTORES' ? 'Nombre' : 'Placa';
    const filasHtml = filas.map(function (f) {
      const r = self._resumenEntidad(f._documentos || []);
      const nombreMostrar = info.clave === 'CONDUCTORES' ? (f.NOMBRE || '-') : (f.PLACA || '-');
      const subMostrar = info.clave === 'CONDUCTORES' ? ('DNI ' + (f.DNI || '-')) : '';
      return '<tr data-fila="' + f._fila + '">' +
        '<td>' + nombreMostrar + (subMostrar ? ' <span style="color:#66707d;font-size:.8rem;">(' + subMostrar + ')</span>' : '') + '</td>' +
        '<td>' + self._badgeEstado(r.estado, r.texto) + '</td>' +
      '</tr>';
    }).join('');
    cont.innerHTML = '<table class="tabla-lista"><thead><tr><th>' + tituloCol + '</th><th>Estado documentos</th></tr></thead><tbody>' + filasHtml + '</tbody></table>';
    Array.prototype.forEach.call(cont.querySelectorAll('tr[data-fila]'), function (tr) {
      tr.addEventListener('click', function () {
        const fila = Number(tr.getAttribute('data-fila'));
        const entidad = filas.filter(function (f) { return f._fila === fila; })[0];
        self._abrirDetalle(entidad);
      });
    });
  },

  _abrirDetalle: function (entidad) {
    const info = this._tipoInfo();
    const titulo = 'Documentos - ' + (info.clave === 'CONDUCTORES' ? entidad.NOMBRE : entidad.PLACA);
    const self = this;
    actualizarPanel(titulo, this._plantillaDetalle(entidad), function (raiz) { self._wireDetalle(raiz, entidad); });
  },

  _plantillaDetalle: function (entidad) {
    const self = this;
    const filas = (entidad._documentos || []).map(function (d) {
      const fechaISO = d.fechaVencimiento ? self._aInputDate(d.fechaVencimiento) : '';
      const adj = d.archivoUrl ? ('<a href="' + d.archivoUrl + '" target="_blank" rel="noopener">Ver archivo</a>') : '<span style="color:#8b95a1;">Sin archivo</span>';
      return '<tr data-clave="' + d.clave + '">' +
        '<td>' + self._badgeEstado(d.estado, self._resumenEntidad([d]).texto) + '</td>' +
        '<td>' + d.etiqueta + '</td>' +
        '<td><input type="date" class="input-fecha-doc" value="' + fechaISO + '"></td>' +
        '<td>' + adj + '<br><input type="file" class="input-archivo-doc" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"></td>' +
      '</tr>';
    }).join('');
    return '' +
      '<table class="tabla-lista"><thead><tr><th>Estado</th><th>Descripción</th><th>Fecha de vencimiento</th><th>Adjuntos</th></tr></thead><tbody>' + filas + '</tbody></table>' +
      '<div class="panel-footer" style="margin-top:16px;"><button type="button" class="boton-secundario" id="btnVolverLista">Volver a la lista</button></div>';
  },

  _aInputDate: function (valor) {
    const f = new Date(valor);
    if (isNaN(f.getTime())) return '';
    return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0');
  },

  _wireDetalle: function (raiz, entidad) {
    const self = this;
    raiz.querySelector('#btnVolverLista').addEventListener('click', function () {
      actualizarPanel('Documentos', self._plantillaLista(), function (r) { self._wireLista(r); });
    });
    Array.prototype.forEach.call(raiz.querySelectorAll('tr[data-clave]'), function (tr) {
      const clave = tr.getAttribute('data-clave');
      const inputFecha = tr.querySelector('.input-fecha-doc');
      inputFecha.addEventListener('change', async function () {
        const resp = await llamarBackend('guardarDocumento', {
          tipoEntidad: self._tipoActual, fila: entidad._fila, claveDoc: clave, fechaVencimiento: inputFecha.value
        });
        if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
        mostrarMensaje('Fecha guardada.', 'exito');
        self._recargarEntidadYRedetallar(entidad);
      });
      const inputArchivo = tr.querySelector('.input-archivo-doc');
      inputArchivo.addEventListener('change', async function () {
        const file = inputArchivo.files[0];
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) {
          mostrarMensaje('El archivo supera los 15 MB. Reduce el tamaño e intenta de nuevo.', 'error');
          inputArchivo.value = '';
          return;
        }
        const base64 = await self._archivoABase64(file);
        const resp = await llamarBackend('guardarDocumento', {
          tipoEntidad: self._tipoActual, fila: entidad._fila, claveDoc: clave,
          archivoBase64: base64, nombreArchivo: file.name, mimeType: file.type || 'application/octet-stream'
        });
        if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
        mostrarMensaje('Documento subido a Drive correctamente.', 'exito');
        self._recargarEntidadYRedetallar(entidad);
      });
    });
  },

  _archivoABase64: function (file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  _recargarEntidadYRedetallar: async function (entidadVieja) {
    const resp = await llamarBackend('listarDocumentos', { tipoEntidad: this._tipoActual });
    if (!resp.ok) return;
    this._entidades = resp.entidades || [];
    const actualizada = this._entidades.filter(function (f) { return f._fila === entidadVieja._fila; })[0];
    if (actualizada) this._abrirDetalle(actualizada);
  }
};
