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
    { clave: 'GENERALES', etiqueta: 'Generales', campoClave: 'EMPRESA', tituloClave: 'Empresa', campos: [
      { campo: 'EMPRESA', etiqueta: 'Empresa' }
    ] },
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
  _verBajas: false,

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
    if (this._tipoActual === 'GENERALES') {
      return '' +
        '<div class="tabs-documentos">' + tabs + '</div>' +
        '<p style="margin:4px 0 10px;color:#475569;font-size:.85rem">Documentos de la empresa (Transportes SSI S.A.C.): SCTR y pólizas.</p>' +
        '<div id="formAgregarEntidad"></div>' +
        '<div id="listaEntidadesDocs">Cargando...</div>' +
        '<div class="panel-footer" style="margin-top:16px; justify-content:flex-end;">' +
          '<button type="button" class="boton-secundario" id="btnVolverMenuDocs">Volver al menú</button>' +
        '</div>';
    }
    return '' +
      '<div class="tabs-documentos">' + tabs + '</div>' +
      '<div class="barra-filtros">' +
        '<label style="display:flex;align-items:center;gap:6px;font-size:.85rem;align-self:flex-end;margin-bottom:8px"><input type="checkbox" id="chkVerBajas"' + (this._verBajas ? ' checked' : '') + '> Mostrar dados de baja</label>' +
        '<div class="campo"><label>Buscar</label><input type="text" id="buscarEntidad" placeholder="Nombre, DNI o placa..."></div>' +
        '<button type="button" class="boton-secundario" id="btnRecargarDocs">Recargar</button>' +
        '<button type="button" class="boton-primario" id="btnAgregarEntidad">+ Agregar</button>' +
      '</div>' +
      '<div id="formAgregarEntidad"></div>' +
      '<div id="listaEntidadesDocs">Cargando...</div>' +
      '<div class="panel-footer" style="margin-top:16px; justify-content:flex-end;">' +
        '<button type="button" class="boton-secundario" id="btnVolverMenuDocs">Volver al menú</button>' +
      '</div>';
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
    raiz.querySelector('#btnVolverMenuDocs').addEventListener('click', function () { cerrarPanel(); });
    if (this._tipoActual === 'GENERALES') { this._cargar(raiz); return; }
    raiz.querySelector('#btnRecargarDocs').addEventListener('click', function () { self._cargar(raiz); });
    raiz.querySelector('#btnAgregarEntidad').addEventListener('click', function () {
      self._mostrarAgregar = !self._mostrarAgregar;
      self._renderFormAgregar(raiz);
    });
    raiz.querySelector('#buscarEntidad').addEventListener('input', function () { self._renderLista(raiz); });
    raiz.querySelector('#chkVerBajas').addEventListener('change', function () { self._verBajas = this.checked; self._renderLista(raiz); });
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
    if (this._tipoActual === 'GENERALES') {
      const ent = this._entidades[0];
      cont.innerHTML = ent ? this._tablaDocs(ent) : '<p>No hay registro de la empresa.</p>';
      if (ent) this._wireFilas(cont, ent);
      return;
    }
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
    if (estado === 'BAJA') return '<span class="badge-doc" style="background:#e2e8f0;color:#475569">' + texto + '</span>';
    const clases = { OK: 'ok', POR_VENCER: 'por-vencer', VENCIDO: 'vencido', PENDIENTE: 'pendiente' };
    return '<span class="badge-doc ' + (clases[estado] || 'pendiente') + '">' + texto + '</span>';
  },

  _renderLista: function (raiz) {
    const self = this;
    const info = this._tipoInfo();
    const filtro = (raiz.querySelector('#buscarEntidad').value || '').trim().toUpperCase();
    let filas = this._entidades;
    if (!this._verBajas) filas = filas.filter(function (f) { return !f._baja; });
    if (filtro) {
      filas = filas.filter(function (f) {
        return info.campos.some(function (c) { return String(f[c.campo] || '').toUpperCase().indexOf(filtro) !== -1; });
      });
    }
    const cont = raiz.querySelector('#listaEntidadesDocs');
    if (!filas.length) { cont.innerHTML = '<p>No hay registros.</p>'; return; }
    const tituloCol = info.clave === 'CONDUCTORES' ? 'Nombre' : 'Placa';
    const filasHtml = filas.map(function (f) {
      const r = f._baja ? { estado: 'BAJA', texto: 'Dado de baja' } : self._resumenEntidad(f._documentos || []);
      const nombreMostrar = info.clave === 'CONDUCTORES' ? (f.NOMBRE || '-') : (f.PLACA || '-');
      const subMostrar = info.clave === 'CONDUCTORES' ? ('DNI ' + (f.DNI || '-')) : '';
      return '<tr data-fila="' + f._fila + '"' + (f._baja ? ' style="opacity:.6"' : '') + '>' +
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
    const baja = entidad._baja;
    const aviso = baja
      ? '<div style="margin:0 0 10px;padding:8px 12px;border-radius:8px;background:#f1f5f9;color:#334155;font-size:.85rem"><b>Dado de baja</b> el ' + (entidad['FECHA BAJA'] || '') + ' — ' + (entidad['MOTIVO BAJA'] || '') + '. Ya no se le piden documentos ni genera avisos.</div>'
      : '';
    const ctlBaja = baja
      ? '<button type="button" class="boton-secundario" id="btnReactivar">Reactivar</button>'
      : '<span id="cajaBaja" style="display:inline-flex;gap:6px;align-items:center"><button type="button" class="boton-secundario" id="btnBaja" style="border-color:#b91c1c;color:#b91c1c">Dar de baja</button></span>';
    return aviso + this._tablaDocs(entidad) +
      '<div class="panel-footer" style="margin-top:16px;display:flex;gap:8px;justify-content:space-between">' +
        '<button type="button" class="boton-secundario" id="btnVolverLista">Volver a la lista</button>' + ctlBaja + '</div>';
  },

  _tablaDocs: function (entidad) {
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
    return '<table class="tabla-lista"><thead><tr><th>Estado</th><th>Descripción</th><th>Fecha de vencimiento</th><th>Adjuntos</th></tr></thead><tbody>' + filas + '</tbody></table>';
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
    const enviarBaja = async function (baja, motivo) {
      const resp = await llamarBackend('darBajaDocumentos', { tipoEntidad: self._tipoActual, fila: entidad._fila, baja: baja, motivo: motivo });
      if (!resp || !resp.ok) { mostrarMensaje((resp && resp.mensaje) || 'No se pudo guardar.', 'error'); return; }
      mostrarMensaje(resp.mensaje, 'exito');
      self._recargarEntidadYRedetallar(entidad);
    };
    const bBaja = raiz.querySelector('#btnBaja');
    if (bBaja) bBaja.addEventListener('click', function () {
      const caja = raiz.querySelector('#cajaBaja');
      caja.innerHTML = '<input type="text" id="txtMotivoBaja" placeholder="Motivo (ej.: ya no trabaja / unidad vendida)" style="min-width:280px">' +
        '<button type="button" class="boton-primario" id="btnBajaOk" style="background:#b91c1c">Confirmar baja</button>';
      caja.querySelector('#txtMotivoBaja').focus();
      caja.querySelector('#btnBajaOk').addEventListener('click', function () {
        const m = caja.querySelector('#txtMotivoBaja').value.trim();
        if (!m) { mostrarMensaje('Indique el motivo de la baja.', 'error'); return; }
        this.disabled = true;
        enviarBaja(true, m);
      });
    });
    const bRe = raiz.querySelector('#btnReactivar');
    if (bRe) bRe.addEventListener('click', function () { this.disabled = true; enviarBaja(false, ''); });
    this._wireFilas(raiz, entidad);
  },

  _wireFilas: function (raiz, entidad) {
    const self = this;
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
    if (this._tipoActual === 'GENERALES') {
      const self = this;
      actualizarPanel('Documentos', this._plantillaLista(), function (r) { self._wireLista(r); });
      return;
    }
    const resp = await llamarBackend('listarDocumentos', { tipoEntidad: this._tipoActual });
    if (!resp.ok) return;
    this._entidades = resp.entidades || [];
    const actualizada = this._entidades.filter(function (f) { return f._fila === entidadVieja._fila; })[0];
    if (actualizada) this._abrirDetalle(actualizada);
  }
};
