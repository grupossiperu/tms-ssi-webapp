/**
 * forms/servicio.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmServicio.frm (VBA) - "Registrar Servicio".
 * Réplica 1:1 de la lógica: combos con valores fijos + valores únicos de
 * SERVICIOS, validación de conductor contra PERSONAL, búsqueda automática
 * de costos por destino en BD_SERVICIOS (con alta de destino nuevo si no
 * existe), cálculo de combustible y total por viaje, validación de hora y
 * de número de contenedor, y todas las validaciones obligatorias de
 * btnGrabarServicio_Click en el mismo orden.
 * -------------------------------------------------------------------------
 */
const FormServicio = {

  _tipoAbastecimiento: '',
  _modoEdicion: false,
  _filaEdicion: null,

  abrir: async function (filaEdicion) {
    const datos = await llamarBackend('datosIniciales_Servicio', {});
    this._modoEdicion = !!filaEdicion;
    this._filaEdicion = filaEdicion || null;
    this._tipoAbastecimiento = '';

    const opciones = function (lista) {
      return '<option value=""></option>' + lista.map(function (v) {
        return `<option value="${v}">${v}</option>`;
      }).join('');
    };

    // El formulario se arma en filas de 3 campos, en el orden exacto que
    // definió el usuario. Cada bloque .fila-campos es una fila visual.
    const html = `
      <div class="fila-campos">
        <div class="campo">
          <label>Fecha de registro</label>
          <input type="date" id="txtFechaServicioRegistro">
        </div>
        <div class="campo">
          <label>Cliente para facturación</label>
          <input list="lst-clientes" id="cboClienteFacturacion">
          <datalist id="lst-clientes">${datos.clientesFacturacion.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Empresa que dio el servicio</label>
          <input list="lst-empresas" id="cboEmpresaServicio">
          <datalist id="lst-empresas">${datos.empresas.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Conductor</label>
          <div class="fila-combo-mas">
            <select id="cboConductorServicio"><option value=""></option>${datos.conductores.map(v => `<option value="${v}">${v}</option>`).join('')}</select>
            <button type="button" id="btnAgregarConductor" class="boton-mas" title="Agregar conductor nuevo">+</button>
          </div>
        </div>
        <div class="campo">
          <label>Placa tracto</label>
          <div class="fila-combo-mas">
            <select id="cboPlacaTractoServicio">${opciones(datos.placasTracto)}</select>
            <button type="button" id="btnAgregarTracto" class="boton-mas" title="Agregar placa de tracto nueva">+</button>
          </div>
        </div>
        <div class="campo">
          <label>Placa carreta</label>
          <div class="fila-combo-mas">
            <select id="cboPlacaCarretaServicio">${opciones(datos.placasCarreta)}</select>
            <button type="button" id="btnAgregarCarreta" class="boton-mas" title="Agregar placa de carreta nueva">+</button>
          </div>
        </div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Tipo de carga</label>
          <select id="cboTipoCarga">${opciones(datos.tipoCarga)}</select>
        </div>
        <div class="campo">
          <label>Reefer o Dry</label>
          <select id="cboReeferDry">
            <option value="">-</option>
            <option value="REEFER">REEFER</option>
            <option value="DRY">DRY</option>
          </select>
        </div>
        <div class="campo">
          <label>Destino 1</label>
          <input list="lst-destinos" id="cboDestino1Servicio">
        </div>
        <div class="campo">
          <label>Destino 2 (solo carga consolidado)</label>
          <input list="lst-destinos" id="cboDestino2Servicio" disabled>
          <datalist id="lst-destinos">${datos.destinos.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Ciudad de retiro</label>
          <input list="lst-ciuRetiro" id="cboCiudadRetiroServicio" placeholder="Escriba o elija">
          <datalist id="lst-ciuRetiro">${(datos.ciudadesRetiro || []).map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Ciudad de devolución</label>
          <input list="lst-ciuDevolucion" id="cboCiudadDevolucionServicio" placeholder="Escriba o elija">
          <datalist id="lst-ciuDevolucion">${(datos.ciudadesDevolucion || []).map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Tarifa</label>
          <div class="fila-combo-mas">
            <input type="text" id="txtTarifa1Servicio" placeholder="0.00">
            <button type="button" class="boton-moneda" data-campo="txtTarifa1Servicio" data-moneda="S">S/</button>
            <button type="button" class="boton-moneda" data-campo="txtTarifa1Servicio" data-moneda="D">$</button>
          </div>
        </div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Booking</label>
          <input type="text" id="txtBookingServicio">
        </div>
        <div class="campo">
          <label>N° Contenedor (ABCU1234567)</label>
          <input type="text" id="txtContenedorServicio">
        </div>
        <div class="campo"></div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Tipo de producto</label>
          <div class="fila-combo-mas">
            <input list="lst-tipoProd" id="cboTipoProductoServicio">
            <button type="button" id="btnAgregarProducto" class="boton-mas" title="Agregar producto nuevo a la lista">+</button>
          </div>
          <datalist id="lst-tipoProd">${datos.tipoProducto.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Tipo de tratamiento</label>
          <input list="lst-tipoTrat" id="cboTipoTratamiento">
          <datalist id="lst-tipoTrat">${datos.tipoTratamiento.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Packing</label>
          <div class="fila-combo-mas">
            <input list="lst-packing" id="cboPackingServicio" placeholder="Escriba o elija">
            <button type="button" id="btnAgregarPacking" class="boton-mas" title="Agregar packing nuevo a la lista">+</button>
          </div>
          <datalist id="lst-packing">${(datos.packings || []).map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Thermoregistro</label>
          <select id="cboThermoregistro"><option value="NO">NO</option><option value="SI">SI</option></select>
        </div>
        <div class="campo">
          <label>Cantidad de thermoregistros</label>
          <input type="number" min="0" step="1" id="txtCantidadThermoregistro" placeholder="0">
        </div>
        <div class="campo">
          <label>Modelo de thermoregistro</label>
          <div class="fila-combo-mas">
            <input list="lst-modeloThermo" id="cboModeloThermoregistro" placeholder="Escriba o elija">
            <button type="button" id="btnAgregarModeloThermo" class="boton-mas" title="Agregar modelo nuevo a la lista">+</button>
          </div>
          <datalist id="lst-modeloThermo">${(datos.modelosThermoregistro || []).map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Precinto de aduana</label>
          <select id="cboPrecintoAduana"><option value="NO">NO</option><option value="SI">SI</option></select>
        </div>
        <div class="campo">
          <label>Operador logístico</label>
          <input list="lst-operadorLog" id="cboOperadorLogistico" placeholder="Escriba o elija">
          <datalist id="lst-operadorLog">${(datos.operadoresLogisticos || []).map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo"></div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Filtro de etileno</label>
          <select id="cboFiltroEtileno"><option value="NO">NO</option><option value="SI">SI</option></select>
        </div>
        <div class="campo">
          <label>Cantidad de filtros de etileno</label>
          <input type="number" min="0" step="1" id="txtCantidadFiltroEtileno" placeholder="0">
        </div>
        <div class="campo"></div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Barras consolidado (solo carga consolidado)</label>
          <select id="cboBarrasConsolidado" disabled><option value="NO">NO</option><option value="SI">SI</option></select>
        </div>
        <div class="campo">
          <label>Cantidad de barras (solo carga consolidado)</label>
          <input type="number" min="0" step="1" id="txtCantidadBarras" placeholder="0" disabled>
        </div>
        <div class="campo"></div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Depósito de retiro</label>
          <input list="lst-depRetiro" id="cboDepositoRetiro">
          <datalist id="lst-depRetiro">${datos.depositosRetiro.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Fecha y hora de retiro</label>
          <input type="datetime-local" id="dtRetiroServicio">
        </div>
        <div class="campo"></div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Lugar de posicionamiento 1</label>
          <input type="text" id="txtLugarPosicionamiento1" placeholder="Se toma del Destino 1" disabled>
        </div>
        <div class="campo">
          <label>Fecha y hora de posicionamiento 1</label>
          <input type="datetime-local" id="dtPosicionamiento1Servicio">
        </div>
        <div class="campo"></div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Lugar de posicionamiento 2 (solo carga consolidado)</label>
          <input type="text" id="txtLugarPosicionamiento2" placeholder="Se toma del Destino 2" disabled>
        </div>
        <div class="campo">
          <label>Fecha y hora de posicionamiento 2 (solo carga consolidado)</label>
          <input type="datetime-local" id="dtPosicionamiento2Servicio" disabled>
        </div>
        <div class="campo"></div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Depósito de devolución</label>
          <input list="lst-depDevolucion" id="cboDepositoDevolucion">
          <datalist id="lst-depDevolucion">${datos.depositosDevolucion.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Fecha y hora de devolución</label>
          <input type="datetime-local" id="dtDevolucionServicio">
        </div>
        <div class="campo"></div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Costo del petróleo x galón</label>
          <input type="text" id="txtCostoPetroleoGalon">
        </div>
        <div class="campo">
          <label>Galones tracto</label>
          <input type="text" id="txtGlTracto">
        </div>
        <div class="campo">
          <label>Galones genset</label>
          <input type="text" id="txtGlGenerador">
        </div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Total tracto</label>
          <input type="text" id="txtTotalTracto" disabled>
        </div>
        <div class="campo">
          <label>Total genset</label>
          <input type="text" id="txtTotalGenerador" disabled>
        </div>
        <div class="campo">
          <label>Total combustible</label>
          <input type="text" id="txtTotalCombustible" disabled>
        </div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Viático</label>
          <input type="text" id="txtViaticoServicio">
        </div>
        <div class="campo">
          <label>Peaje</label>
          <input type="text" id="txtPeajeServicio">
        </div>
        <div class="campo">
          <label>Cochera</label>
          <input type="text" id="txtCocheraServicio">
        </div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>¿Abastecido por proveedor?</label>
          <div class="fila-combo-mas">
            <button type="button" class="boton-moneda" id="btnAbastecidoSi" data-valor="SI">Sí</button>
            <button type="button" class="boton-moneda activo" id="btnAbastecidoNo" data-valor="NO">No</button>
          </div>
        </div>
        <div class="campo">
          <label>Proveedor</label>
          <div class="fila-combo-mas">
            <select id="cboProveedorServicio" disabled><option value=""></option>${opciones(datos.proveedores).replace('<option value=""></option>', '')}</select>
            <button type="button" id="btnAgregarProveedor" class="boton-mas" title="Agregar proveedor nuevo" disabled>+</button>
          </div>
        </div>
        <div class="campo"></div>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Monto para depositar</label>
          <input type="text" id="txtMontoDepositadoServicio" disabled>
        </div>
        <div class="campo">
          <label>Total por viaje</label>
          <input type="text" id="txtTotalViaje" disabled>
        </div>
        <div class="campo"></div>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:space-between;">
        <button class="boton-secundario" id="btnInicioServicio">Inicio</button>
        <div style="display:flex; gap:10px;">
          <button class="boton-secundario" id="btnImprimirServicio">Imprimir</button>
          <button class="boton-primario" id="btnGrabarServicio">Grabar</button>
        </div>
      </div>`;

    abrirPanel('Registrar Servicio' + (filaEdicion ? ' - Completar datos' : ''), html, (raiz) => this._wire(raiz));

    if (filaEdicion) {
      // Carga los datos de la fila para edición/completado.
      const registro = await llamarBackend('cargarDatosServicioParaConsolidado', { fila: filaEdicion });
      if (registro) this._precargar(document.getElementById('cuerpo-panel'), registro);
    } else {
      document.getElementById('txtFechaServicioRegistro').value = this._fechaHoyISO();
    }
  },

  _formatoFechaCampo: function (v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  },

  _formatoHoraCampo: function (v) {
    if (v === null || v === undefined || v === '' || v === '-') return '';
    if (/^\d{1,2}:\d{2}/.test(String(v))) return String(v).slice(0, 5);
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    }
    return String(v);
  },

  _formatoFechaISO: function (v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  },

  _fechaHoyISO: function () {
    const hoy = new Date();
    const pad = n => String(n).padStart(2, '0');
    return hoy.getFullYear() + '-' + pad(hoy.getMonth() + 1) + '-' + pad(hoy.getDate());
  },

  _fechaISOaDDMM: function (valor) {
    if (!valor) return '';
    const p = String(valor).split('-');
    if (p.length !== 3) return '';
    return p[2] + '/' + p[1] + '/' + p[0];
  },

  _datetimeLocalDeFechaHora: function (fechaValor, horaValor) {
    const fecha = this._formatoFechaISO(fechaValor);
    if (!fecha) return '';
    const hora = this._formatoHoraCampo(horaValor);
    if (!hora || !/^\d{1,2}:\d{2}/.test(hora)) return '';
    const partes = hora.split(':');
    const pad = n => String(n).padStart(2, '0');
    return fecha + 'T' + pad(partes[0]) + ':' + pad(partes[1]);
  },

  _fechaDeDatetimeLocal: function (valor) {
    if (!valor) return '';
    const partes = String(valor).split('T');
    const fecha = partes[0].split('-');
    if (fecha.length !== 3) return '';
    return fecha[2] + '/' + fecha[1] + '/' + fecha[0];
  },

  _horaDeDatetimeLocal: function (valor) {
    if (!valor) return '';
    const partes = String(valor).split('T');
    if (partes.length < 2) return '';
    return partes[1].slice(0, 5);
  },

  _precargar: function (raiz, f) {
    const self = this;
    const set = function (id, valor) { const el = raiz.querySelector('#' + id); if (el) el.value = valor || ''; };

    set('txtFechaServicioRegistro', this._formatoFechaISO(f['FECHA DE PROGRAMACION']));
    set('cboClienteFacturacion', f['CLIENTE PARA FACTURACIÓN']);
    set('cboEmpresaServicio', f['EMPRESA QUE DIO EL SERVICIO']);
    set('cboConductorServicio', f['CONDUCTOR']);
    set('cboPlacaTractoServicio', f['PLACA TRACTO']);
    set('cboPlacaCarretaServicio', f['PLACA CARRETA']);
    set('cboTipoCarga', f['TIPO DE CARGA']);
    set('txtBookingServicio', f['BOOKING']);
    set('txtContenedorServicio', f['N° CONTENEDOR']);
    set('cboDestino1Servicio', f['DESTINO 1']);
    set('cboDestino2Servicio', f['DESTINO 2'] && f['DESTINO 2'] !== '-' ? f['DESTINO 2'] : '');
    set('cboDepositoRetiro', f['DEPOSITO DE RETIRO']);
    set('txtLugarPosicionamiento1', f['LUGAR DE POSICIONAMIENTO 1'] || f['DESTINO 1']);
    set('txtLugarPosicionamiento2', f['LUGAR DE POSICIONAMIENTO 2'] ||
      (f['DESTINO 2'] && f['DESTINO 2'] !== '-' ? f['DESTINO 2'] : ''));
    set('dtPosicionamiento2Servicio', this._datetimeLocalDeFechaHora(f['FECHA DE POSICIONAMIENTO 2'], f['HORA DE POSICIONAMIENTO 2']));
    set('cboCiudadRetiroServicio', f['CIUDAD DE RETIRO']);
    set('cboCiudadDevolucionServicio', f['CIUDAD DE DEVOLUCION']);
    set('cboPackingServicio', f['PACKING']);
    set('cboThermoregistro', f['THERMOREGISTRO'] || 'NO');
    set('txtCantidadThermoregistro', f['CANTIDAD THERMOREGISTRO'] || '');
    set('cboModeloThermoregistro', f['MODELO THERMOREGISTRO']);
    set('cboPrecintoAduana', f['PRECINTO DE ADUANA'] || 'NO');
    set('cboOperadorLogistico', f['OPERADOR LOGISTICO']);
    set('cboFiltroEtileno', f['FILTRO DE ETILENO'] || 'NO');
    set('txtCantidadFiltroEtileno', f['CANTIDAD FILTRO DE ETILENO'] || '');
    set('cboBarrasConsolidado', f['BARRAS CONSOLIDADO'] || 'NO');
    set('txtCantidadBarras', f['CANTIDAD BARRAS CONSOLIDADO'] || '');
    set('dtRetiroServicio', this._datetimeLocalDeFechaHora(f['FECHA DE RETIRO'], f['HORA DE RETIRO']));
    set('cboDepositoDevolucion', f['DEPOSITO DE DEVOLUCION']);
    set('dtDevolucionServicio', (f['FECHA DE DEVOLUCION'] && f['FECHA DE DEVOLUCION'] !== '-') ? this._datetimeLocalDeFechaHora(f['FECHA DE DEVOLUCION'], f['HORA DE DEVOLUCION']) : '');
    set('dtPosicionamiento1Servicio', this._datetimeLocalDeFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1']));
    set('cboTipoProductoServicio', f['TIPO DE PRODUCTO']);
    set('cboTipoTratamiento', f['TIPO DE TRATAMIENTO']);
    set('txtCostoPetroleoGalon', f['COSTO DEL PETRÓLEO X GALÓN'] || '');
    set('txtGlTracto', f['GL TRACTO'] || '');
    set('txtTotalTracto', (Number(f['TOTAL TRACTO']) || 0).toFixed(2));
    set('txtGlGenerador', f['GL GENERADOR'] || '');
    set('txtTotalGenerador', (Number(f['TOTAL GENERADOR']) || 0).toFixed(2));
    set('txtTotalCombustible', ((Number(f['TOTAL TRACTO']) || 0) + (Number(f['TOTAL GENERADOR']) || 0)).toFixed(2));
    set('txtViaticoServicio', f['VIATICO'] || '');
    set('txtPeajeServicio', f['PEAJE'] || '');
    set('txtCocheraServicio', f['COCHERA'] || '');
    set('txtMontoDepositadoServicio', (Number(f['MONTO DEPOSITADO']) || 0).toFixed(2));
    set('txtTotalViaje', (Number(f['TOTAL POR VIAJE']) || 0).toFixed(2));
    set('cboReeferDry', f['REEFER O DRY']);
    self._tipoAbastecimiento = f['TIPO DE ABASTECIMIENTO'] || 'CONTADO';

    const esProveedorPrecargado = self._tipoAbastecimiento === 'PROVEEDOR';
    raiz.querySelector('#btnAbastecidoSi').classList.toggle('activo', esProveedorPrecargado);
    raiz.querySelector('#btnAbastecidoNo').classList.toggle('activo', !esProveedorPrecargado);
    raiz.querySelector('#cboProveedorServicio').disabled = !esProveedorPrecargado;
    raiz.querySelector('#btnAgregarProveedor').disabled = !esProveedorPrecargado;
    set('cboProveedorServicio', f['PROVEEDOR']);

    if (String(f['REEFER O DRY'] || '').trim().toUpperCase() === 'DRY') {
      raiz.querySelector('#txtGlGenerador').disabled = true;
    }

    const esConsolidado = String(f['TIPO DE CARGA'] || '').trim().toUpperCase() === 'CARGA CONSOLIDADO';
    raiz.querySelector('#cboDestino2Servicio').disabled = !esConsolidado;
    ['dtPosicionamiento2Servicio', 'cboBarrasConsolidado', 'txtCantidadBarras'].forEach(function (id) {
      raiz.querySelector('#' + id).disabled = !esConsolidado;
    });

    function pintarTarifa(campo, monto, moneda) {
      const n = Number(monto) || 0;
      if (n === 0 && !moneda) return;
      const prefijo = String(moneda).toUpperCase() === 'D' ? '$ ' : 'S/ ';
      set(campo, prefijo + n.toFixed(2));
      // Viene de un servicio ya grabado, no es una tarifa "nueva" escrita a
      // mano en esta sesión: si el usuario no la toca, no se debe duplicar
      // en el módulo de Tarifas al volver a grabar.
      const elCampo = raiz.querySelector('#' + campo);
      if (elCampo) elCampo.dataset.autocompletada = '1';
      raiz.querySelectorAll('.boton-moneda[data-campo="' + campo + '"]').forEach(function (b) {
        b.classList.toggle('activo', b.dataset.moneda === (String(moneda).toUpperCase() === 'D' ? 'D' : 'S'));
      });
    }
    pintarTarifa('txtTarifa1Servicio', f['TARIFA 1'], f['MONEDA TARIFA 1']);
  },

  _fechaHoy: function () {
    const hoy = new Date();
    return String(hoy.getDate()).padStart(2, '0') + '/' + String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear();
  },

  /**
   * Genera una vista imprimible en A4 con todos los datos del formulario,
   * EXCEPTO la Tarifa (ese dato es confidencial y no debe salir impreso).
   * Abre una ventana nueva con el documento listo y dispara el diálogo de
   * impresión del navegador (desde ahí el usuario puede "Guardar como PDF").
   */
  _imprimir: function (raiz) {
    const v = function (id) {
      const el = raiz.querySelector('#' + id);
      return el ? (el.value || '').trim() : '';
    };
    const vF = (idDT) => this._fechaDeDatetimeLocal(v(idDT));
    const vH = (idDT) => this._horaDeDatetimeLocal(v(idDT));
    const moneda = function (id) {
      const t = v(id);
      if (t === '') return '';
      if (/^[S$]/.test(t)) return t;
      const n = Number(t);
      return isNaN(n) ? t : 'S/ ' + n.toFixed(2);
    };
    const esc = function (t) {
      return String(t || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
    };
    const campo = function (etiqueta, valor) {
      return '<div class="campo-imp"><div class="lbl-imp">' + esc(etiqueta) + '</div><div class="val-imp">' + esc(valor) + '&nbsp;</div></div>';
    };
    const seccion = function (titulo, campos) {
      return '<div class="seccion-imp"><div class="tit-imp">' + esc(titulo) + '</div><div class="fila-imp">' + campos.join('') + '</div></div>';
    };

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Registro de Servicio</title><style>' +
      '@page{ size:A4; margin:11mm; }' +
      '*{ box-sizing:border-box; }' +
      'body{ font-family:Arial,Helvetica,sans-serif; color:#1a1a1a; margin:0; font-size:10.5px; }' +
      '.encabezado{ display:flex; align-items:flex-end; justify-content:space-between; border-bottom:2.5px solid #1c3a5e; padding-bottom:7px; margin-bottom:9px; }' +
      '.encabezado h1{ font-size:14px; margin:0; color:#1c3a5e; }' +
      '.encabezado p{ margin:2px 0 0; font-size:10px; color:#444; }' +
      '.encabezado .fecha-imp{ font-size:9px; color:#444; text-align:right; }' +
      '.seccion-imp{ margin-bottom:6px; page-break-inside:avoid; }' +
      '.tit-imp{ background:#1c3a5e; color:#fff; font-size:9px; font-weight:700; padding:2.5px 7px; letter-spacing:.3px; }' +
      '.fila-imp{ display:flex; flex-wrap:wrap; border:1px solid #c7ced8; border-top:none; }' +
      '.campo-imp{ flex:1 1 0; min-width:118px; border-right:1px solid #dde3ea; border-bottom:1px solid #dde3ea; padding:3px 7px; }' +
      '.campo-imp:last-child{ border-right:none; }' +
      '.lbl-imp{ font-size:7.5px; font-weight:700; color:#556; text-transform:uppercase; letter-spacing:.2px; }' +
      '.val-imp{ font-size:10.5px; min-height:13px; margin-top:1px; }' +
      '.no-print{ text-align:center; margin:14px 0; }' +
      '.no-print button{ padding:9px 22px; font-size:13px; border-radius:8px; border:none; background:#1c3a5e; color:#fff; cursor:pointer; font-weight:700; }' +
      '@media print{ .no-print{ display:none; } }' +
      '</style></head><body>' +
      '<div class="encabezado"><div><h1>TRANSPORTES SSI S.A.C.</h1><p>Registro de Servicio</p></div>' +
      '<div class="fecha-imp">Impreso: ' + esc(new Date().toLocaleString('es-PE')) + '</div></div>' +
      seccion('Datos generales', [
        campo('Fecha de registro', this._formatoFechaCampo(v('txtFechaServicioRegistro'))),
        campo('Cliente para facturación', v('cboClienteFacturacion')),
        campo('Empresa que dio el servicio', v('cboEmpresaServicio'))
      ]) +
      seccion('Conductor y unidad', [
        campo('Conductor', v('cboConductorServicio')),
        campo('Placa tracto', v('cboPlacaTractoServicio')),
        campo('Placa carreta', v('cboPlacaCarretaServicio'))
      ]) +
      seccion('Carga y ruta', [
        campo('Tipo de carga', v('cboTipoCarga')),
        campo('Destino 1', v('cboDestino1Servicio')),
        campo('Destino 2', v('cboDestino2Servicio')),
        campo('Ciudad de retiro', v('cboCiudadRetiroServicio')),
        campo('Ciudad de devolución', v('cboCiudadDevolucionServicio'))
      ]) +
      seccion('Documentación', [
        campo('Booking', v('txtBookingServicio')),
        campo('N° Contenedor', v('txtContenedorServicio'))
      ]) +
      seccion('Producto', [
        campo('Tipo de producto', v('cboTipoProductoServicio')),
        campo('Tipo de tratamiento', v('cboTipoTratamiento')),
        campo('Packing', v('cboPackingServicio'))
      ]) +
      seccion('Thermoregistro', [
        campo('Thermoregistro', v('cboThermoregistro')),
        campo('Cantidad', v('txtCantidadThermoregistro')),
        campo('Modelo', v('cboModeloThermoregistro'))
      ]) +
      seccion('Aduana', [
        campo('Precinto de aduana', v('cboPrecintoAduana')),
        campo('Operador logístico', v('cboOperadorLogistico'))
      ]) +
      seccion('Filtro de etileno', [
        campo('Filtro de etileno', v('cboFiltroEtileno')),
        campo('Cantidad', v('txtCantidadFiltroEtileno'))
      ]) +
      seccion('Barras consolidado', [
        campo('Barras consolidado', v('cboBarrasConsolidado')),
        campo('Cantidad', v('txtCantidadBarras'))
      ]) +
      seccion('Retiro', [
        campo('Depósito de retiro', v('cboDepositoRetiro')),
        campo('Fecha de retiro', vF('dtRetiroServicio')),
        campo('Hora de retiro', vH('dtRetiroServicio'))
      ]) +
      seccion('Posicionamiento 1', [
        campo('Lugar', v('txtLugarPosicionamiento1')),
        campo('Fecha', vF('dtPosicionamiento1Servicio')),
        campo('Hora', vH('dtPosicionamiento1Servicio'))
      ]) +
      seccion('Posicionamiento 2 (carga consolidada)', [
        campo('Lugar', v('txtLugarPosicionamiento2')),
        campo('Fecha', vF('dtPosicionamiento2Servicio')),
        campo('Hora', vH('dtPosicionamiento2Servicio'))
      ]) +
      seccion('Devolución', [
        campo('Depósito de devolución', v('cboDepositoDevolucion')),
        campo('Fecha de devolución', vF('dtDevolucionServicio')),
        campo('Hora de devolución', vH('dtDevolucionServicio'))
      ]) +
      seccion('Combustible', [
        campo('Costo petróleo x galón', moneda('txtCostoPetroleoGalon')),
        campo('Galones tracto', v('txtGlTracto')),
        campo('Galones genset', v('txtGlGenerador')),
        campo('Total tracto', moneda('txtTotalTracto')),
        campo('Total genset', moneda('txtTotalGenerador')),
        campo('Total combustible', moneda('txtTotalCombustible'))
      ]) +
      seccion('Gastos', [
        campo('Viático', moneda('txtViaticoServicio')),
        campo('Peaje', moneda('txtPeajeServicio')),
        campo('Cochera', moneda('txtCocheraServicio'))
      ]) +
      seccion('Totales', [
        campo('Monto para depositar', moneda('txtMontoDepositadoServicio')),
        campo('Total por viaje', moneda('txtTotalViaje'))
      ]) +
      '<div class="no-print"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>' +
      '</body></html>';

    const ventana = window.open('', '_blank');
    if (!ventana) {
      mostrarMensaje('El navegador bloqueó la ventana de impresión. Habilite las ventanas emergentes para este sitio.', 'error');
      return;
    }
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  },

  _numero: function (texto) {
    if (texto === null || texto === undefined) return 0;
    let t = String(texto).trim().replace(/S\//g, '').replace(/\$/g, '').replace(/\s/g, '');
    if (t === '') return 0;
    const n = parseFloat(t.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  },

  _wire: function (raiz) {
    const self = this;
    document.getElementById('txtFechaServicioRegistro').value = this._fechaHoyISO();

    // Botones "+" para dar de alta conductor / placa tracto / placa carreta
    // sin salir del formulario (equivalente a mantener PERSONAL/TRACTO/
    // CARRETAS actualizadas desde la propia app, en vez de solo desde Excel).
    raiz.querySelector('#btnAgregarConductor').addEventListener('click', async function () {
      const nombre = prompt('Nombre completo del conductor:');
      if (nombre === null || nombre.trim() === '') return;
      const dni = prompt('N° de DNI del conductor:');
      if (dni === null || dni.trim() === '') return;
      const resp = await llamarBackend('agregarConductor', { conductor: nombre, dni: dni });
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      const select = raiz.querySelector('#cboConductorServicio');
      const opt = document.createElement('option');
      opt.value = resp.conductor; opt.textContent = resp.conductor;
      select.appendChild(opt);
      select.value = resp.conductor;
      mostrarMensaje(resp.mensaje, 'exito');
    });

    raiz.querySelector('#btnAgregarTracto').addEventListener('click', async function () {
      const placa = prompt('Placa del tracto nuevo:');
      if (placa === null || placa.trim() === '') return;
      const resp = await llamarBackend('agregarTracto', { placa: placa });
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      const select = raiz.querySelector('#cboPlacaTractoServicio');
      const opt = document.createElement('option');
      opt.value = resp.placa; opt.textContent = resp.placa;
      select.appendChild(opt);
      select.value = resp.placa;
      mostrarMensaje(resp.mensaje, 'exito');
    });

    raiz.querySelector('#btnAgregarCarreta').addEventListener('click', async function () {
      const placa = prompt('Placa de la carreta nueva:');
      if (placa === null || placa.trim() === '') return;
      const resp = await llamarBackend('agregarCarreta', { placa: placa });
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      const select = raiz.querySelector('#cboPlacaCarretaServicio');
      const opt = document.createElement('option');
      opt.value = resp.placa; opt.textContent = resp.placa;
      select.appendChild(opt);
      select.value = resp.placa;
      mostrarMensaje(resp.mensaje, 'exito');
    });

    function actualizarTotalViaje() {
      const viatico = self._numero(raiz.querySelector('#txtViaticoServicio').value);
      const peaje = self._numero(raiz.querySelector('#txtPeajeServicio').value);
      const cochera = self._numero(raiz.querySelector('#txtCocheraServicio').value);
      const tracto = self._numero(raiz.querySelector('#txtTotalTracto').value);
      const generador = self._numero(raiz.querySelector('#txtTotalGenerador').value);
      raiz.querySelector('#txtTotalViaje').value = (viatico + peaje + cochera + tracto + generador).toFixed(2);
    }

    function calcularMontoDepositado() {
      const viatico = self._numero(raiz.querySelector('#txtViaticoServicio').value);
      const peaje = self._numero(raiz.querySelector('#txtPeajeServicio').value);
      const cochera = self._numero(raiz.querySelector('#txtCocheraServicio').value);
      const tracto = self._numero(raiz.querySelector('#txtTotalTracto').value);
      const generador = self._numero(raiz.querySelector('#txtTotalGenerador').value);

      // Si el abastecimiento fue por PROVEEDOR, el combustible ya se lo
      // factura el proveedor directamente y no forma parte de lo que hay
      // que depositarle al conductor. Si fue al CONTADO, sí se incluye.
      const montoDepositado = self._tipoAbastecimiento === 'PROVEEDOR'
        ? (viatico + peaje + cochera)
        : (viatico + peaje + cochera + tracto + generador);

      raiz.querySelector('#txtMontoDepositadoServicio').value = montoDepositado.toFixed(2);
    }

    function calcularCombustible() {
      const costoGalon = self._numero(raiz.querySelector('#txtCostoPetroleoGalon').value);
      const glTracto = self._numero(raiz.querySelector('#txtGlTracto').value);
      const glGenerador = self._numero(raiz.querySelector('#txtGlGenerador').value);
      const totalTracto = costoGalon * glTracto;
      const totalGenset = costoGalon * glGenerador;

      raiz.querySelector('#txtTotalTracto').value = totalTracto.toFixed(2);
      raiz.querySelector('#txtTotalGenerador').value = totalGenset.toFixed(2);
      // Total combustible = tracto + genset (campo solo de lectura).
      raiz.querySelector('#txtTotalCombustible').value = (totalTracto + totalGenset).toFixed(2);

      calcularMontoDepositado();
      actualizarTotalViaje();
    }

    ['txtViaticoServicio', 'txtPeajeServicio', 'txtCocheraServicio'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('input', actualizarTotalViaje);
    });
    ['txtCostoPetroleoGalon', 'txtGlTracto', 'txtGlGenerador'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', calcularCombustible);
    });

    // Tarifa 1 / Tarifa 2: selección de moneda mediante botones "S/" y "$"
    // en vez del InputBox "S = Soles / D = Dólares" del VBA original (que
    // generaba un messagebox molesto cada vez que se salía del campo).
    raiz.querySelectorAll('.boton-moneda').forEach(function (boton) {
      boton.addEventListener('click', function () {
        const input = raiz.querySelector('#' + boton.dataset.campo);
        const monto = self._numero(input.value);
        const prefijo = boton.dataset.moneda === 'S' ? 'S/ ' : '$ ';
        input.value = prefijo + monto.toFixed(2);

        // Marca visualmente el botón de moneda activo para ese campo.
        raiz.querySelectorAll('.boton-moneda[data-campo="' + boton.dataset.campo + '"]').forEach(function (b) {
          b.classList.remove('activo');
        });
        boton.classList.add('activo');
        input.focus();
      });
    });

    // El lugar de posicionamiento es siempre el destino correspondiente, así
    // que se copia solo y el campo queda de solo lectura para que no puedan
    // quedar desincronizados.
    function sincronizarLugaresPosicionamiento() {
      raiz.querySelector('#txtLugarPosicionamiento1').value = raiz.querySelector('#cboDestino1Servicio').value.trim();
      raiz.querySelector('#txtLugarPosicionamiento2').value = raiz.querySelector('#cboDestino2Servicio').value.trim();
    }
    raiz.querySelector('#cboDestino1Servicio').addEventListener('input', sincronizarLugaresPosicionamiento);
    raiz.querySelector('#cboDestino1Servicio').addEventListener('change', sincronizarLugaresPosicionamiento);
    raiz.querySelector('#cboDestino2Servicio').addEventListener('input', sincronizarLugaresPosicionamiento);
    raiz.querySelector('#cboDestino2Servicio').addEventListener('change', sincronizarLugaresPosicionamiento);

    // Tipo de carga: habilita/bloquea Destino 2 y todo el bloque de
    // posicionamiento 2. La tarifa es única y cubre la ruta completa.
    function aplicarTipoCarga(esConsolidado) {
      raiz.querySelector('#cboDestino2Servicio').disabled = !esConsolidado;
      // Todo lo que solo aplica a carga consolidado.
      ['dtPosicionamiento2Servicio', 'cboBarrasConsolidado', 'txtCantidadBarras'].forEach(function (id) {
        raiz.querySelector('#' + id).disabled = !esConsolidado;
      });

      if (!esConsolidado) {
        raiz.querySelector('#cboDestino2Servicio').value = '';
        raiz.querySelector('#dtPosicionamiento2Servicio').value = '';
        raiz.querySelector('#cboBarrasConsolidado').value = 'NO';
        raiz.querySelector('#txtCantidadBarras').value = '';
      }
      sincronizarLugaresPosicionamiento();
    }

    raiz.querySelector('#cboTipoCarga').addEventListener('change', function () {
      aplicarTipoCarga(this.value.trim().toUpperCase() === 'CARGA CONSOLIDADO');
    });

    // Destino 1 / Destino 2: busca costos automáticamente (Viático/Peaje/Cochera).
    async function alCambiarDestino(numero) {
      const idCampo = numero === 1 ? '#cboDestino1Servicio' : '#cboDestino2Servicio';
      const destino = raiz.querySelector(idCampo).value.trim();
      if (destino === '') return;

      const resp = await llamarBackend('buscarCostosPorDestino', { destino: destino });

      if (resp.encontrado) {
        if (numero === 1) {
          raiz.querySelector('#txtViaticoServicio').value = resp.viatico.toFixed(2);
          raiz.querySelector('#txtPeajeServicio').value = resp.peaje.toFixed(2);
          raiz.querySelector('#txtCocheraServicio').value = resp.cochera.toFixed(2);
          calcularMontoDepositado();
        }
        return;
      }

      if (!confirmar(`El destino '${destino}' no existe en la base de costos.\n¿Desea agregarlo ahora con viático, peaje y cochera?`)) return;

      const viatico = self._numero(window.prompt('Ingrese el VIÁTICO para ' + destino, '0'));
      const peaje = self._numero(window.prompt('Ingrese el PEAJE para ' + destino, '0'));
      const cochera = self._numero(window.prompt('Ingrese la COCHERA para ' + destino, '0'));

      await llamarBackend('agregarDestinoConCostos', { destino: destino, viatico: viatico, peaje: peaje, cochera: cochera });

      if (numero === 1) {
        raiz.querySelector('#txtViaticoServicio').value = viatico.toFixed(2);
        raiz.querySelector('#txtPeajeServicio').value = peaje.toFixed(2);
        raiz.querySelector('#txtCocheraServicio').value = cochera.toFixed(2);
        calcularMontoDepositado();
      }
      mostrarMensaje('Destino agregado correctamente a la base de costos.', 'exito');
    }
    // Se difiere con setTimeout por la misma razón que preguntarMoneda: el
    // evento "change" de un campo de texto se procesa junto con "blur", y
    // abrir confirm()/prompt() de forma síncrona ahí puede dejar el diálogo
    // reabriéndose en bucle en Chrome.
    raiz.querySelector('#cboDestino1Servicio').addEventListener('change', function () { setTimeout(function () { alCambiarDestino(1); }, 0); });
    raiz.querySelector('#cboDestino2Servicio').addEventListener('change', function () {
      if (raiz.querySelector('#cboTipoCarga').value.trim().toUpperCase() === 'CARGA CONSOLIDADO') setTimeout(function () { alCambiarDestino(2); }, 0);
    });

    // Tarifa automática: en cuanto están los 5 campos de la ruta, busca en
    // la matriz de TARIFAS la tarifa vigente (la más reciente) y la
    // completa sola, con su moneda. Si el usuario ya escribió una tarifa a
    // mano, no se pisa.
    async function buscarTarifaAutomatica() {
      const v = function (id) { return raiz.querySelector('#' + id).value.trim(); };

      const cliente = v('cboClienteFacturacion');
      const ciudadRetiro = v('cboCiudadRetiroServicio');
      const destino1 = v('cboDestino1Servicio');
      const destino2 = v('cboDestino2Servicio');
      const ciudadDevolucion = v('cboCiudadDevolucionServicio');

      if (cliente === '' || ciudadRetiro === '' || destino1 === '' || ciudadDevolucion === '') return;

      const campoTarifa = raiz.querySelector('#txtTarifa1Servicio');
      if (self._numero(campoTarifa.value) > 0 && !campoTarifa.dataset.autocompletada) return;

      const resp = await llamarBackend('buscarTarifa', {
        cliente: cliente,
        ciudadRetiro: ciudadRetiro,
        destino1: destino1,
        destino2: destino2,
        ciudadDevolucion: ciudadDevolucion,
        reeferDry: v('cboReeferDry')
      });

      if (!resp.encontrado) return;

      const prefijo = resp.moneda === 'D' ? '$ ' : 'S/ ';
      campoTarifa.value = prefijo + Number(resp.tarifa).toFixed(2);
      campoTarifa.dataset.autocompletada = '1';

      raiz.querySelectorAll('.boton-moneda[data-campo="txtTarifa1Servicio"]').forEach(function (b) {
        b.classList.toggle('activo', b.dataset.moneda === (resp.moneda === 'D' ? 'D' : 'S'));
      });
    }

    ['cboClienteFacturacion', 'cboCiudadRetiroServicio', 'cboDestino1Servicio',
     'cboDestino2Servicio', 'cboCiudadDevolucionServicio', 'cboReeferDry'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', function () {
        setTimeout(buscarTarifaAutomatica, 0);
      });
    });

    // Si el usuario edita la tarifa a mano, deja de considerarse autocompletada.
    raiz.querySelector('#txtTarifa1Servicio').addEventListener('input', function () {
      delete this.dataset.autocompletada;
    });

    // Validación de orden cronológico: retiro < posicionamiento < devolución.
    function momento(idDT) {
      const v = raiz.querySelector('#' + idDT).value;
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d.getTime();
    }

    function validarCronologia(avisar) {
      const retiro = momento('dtRetiroServicio');
      const posic1 = momento('dtPosicionamiento1Servicio');
      const posic2 = momento('dtPosicionamiento2Servicio');
      const devol = momento('dtDevolucionServicio');

      // Secuencia real del viaje: retiro -> posicionamiento 1 ->
      // posicionamiento 2 (si es consolidado) -> devolución. Solo se comparan
      // los momentos que tengan fecha y hora cargadas.
      const pasos = [
        { t: retiro, nombre: 'retiro' },
        { t: posic1, nombre: 'posicionamiento 1' },
        { t: posic2, nombre: 'posicionamiento 2' },
        { t: devol, nombre: 'devolución' }
      ].filter(function (p) { return p.t !== null; });

      let error = null;
      for (let i = 1; i < pasos.length && !error; i++) {
        if (pasos[i].t <= pasos[i - 1].t) {
          error = 'La fecha y hora de ' + pasos[i].nombre +
            ' debe ser posterior a la de ' + pasos[i - 1].nombre + '.';
        }
      }

      if (error && avisar) mostrarMensaje(error, 'error');
      return error;
    }

    ['dtRetiroServicio', 'dtPosicionamiento1Servicio', 'dtPosicionamiento2Servicio',
     'dtDevolucionServicio'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', function () {
        setTimeout(function () { validarCronologia(true); }, 0);
      });
    });

    // Validación de contenedor (equivalente a txtContenedorServicio_Exit).
    raiz.querySelector('#txtContenedorServicio').addEventListener('input', function () {
      this.value = this.value.toUpperCase();
    });
    raiz.querySelector('#txtContenedorServicio').addEventListener('blur', function () {
      const campo = this;
      // Ver nota en preguntarMoneda: se difiere fuera de "blur".
      setTimeout(function () {
        const v = campo.value.trim().toUpperCase();
        if (v === '') return;
        if (!/^[A-Z]{3}U[0-9]{7}$/.test(v)) {
          mostrarMensaje('Número de contenedor inválido.\nFormato correcto: ABCU1234567', 'error');
          campo.value = '';
          campo.focus();
        }
      }, 0);
    });

    // Toggle "¿Abastecido por proveedor?": Sí/No, recalcula el monto a
    // depositar al instante (sin necesitar un botón "Calcular" aparte) y
    // habilita/deshabilita el combo de Proveedor.
    self._tipoAbastecimiento = 'CONTADO';

    function aplicarToggleAbastecimiento(esProveedor) {
      self._tipoAbastecimiento = esProveedor ? 'PROVEEDOR' : 'CONTADO';
      raiz.querySelector('#btnAbastecidoSi').classList.toggle('activo', esProveedor);
      raiz.querySelector('#btnAbastecidoNo').classList.toggle('activo', !esProveedor);

      const cboProveedor = raiz.querySelector('#cboProveedorServicio');
      const btnMasProveedor = raiz.querySelector('#btnAgregarProveedor');
      cboProveedor.disabled = !esProveedor;
      btnMasProveedor.disabled = !esProveedor;
      if (!esProveedor) cboProveedor.value = '';

      calcularMontoDepositado();
    }

    raiz.querySelector('#btnAbastecidoSi').addEventListener('click', function () { aplicarToggleAbastecimiento(true); });
    raiz.querySelector('#btnAbastecidoNo').addEventListener('click', function () { aplicarToggleAbastecimiento(false); });

    raiz.querySelector('#btnAgregarProveedor').addEventListener('click', async function () {
      const nombre = prompt('Nombre del proveedor:');
      if (nombre === null || nombre.trim() === '') return;
      const resp = await llamarBackend('agregarProveedor', { valor: nombre });
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      const select = raiz.querySelector('#cboProveedorServicio');
      const opt = document.createElement('option');
      opt.value = resp.valor; opt.textContent = resp.valor;
      select.appendChild(opt);
      select.value = resp.valor;
      mostrarMensaje(resp.mensaje, 'exito');
    });

    // Botones "+" de Producto / Packing / Modelo de thermoregistro: dan de
    // alta el valor en su lista maestra para que quede disponible en el
    // datalist ni bien se agrega, sin tener que grabar antes un servicio.
    function wireAgregarValorMaestro(idBoton, idCampo, accion, etiqueta, idDatalist) {
      raiz.querySelector('#' + idBoton).addEventListener('click', async function () {
        const campo = raiz.querySelector('#' + idCampo);
        const valorActual = campo.value.trim();
        const valor = prompt('Nuevo ' + etiqueta + ':', valorActual);
        if (valor === null || valor.trim() === '') return;
        const resp = await llamarBackend(accion, { valor: valor });
        if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
        const datalist = raiz.querySelector('#' + idDatalist);
        if (datalist && !datalist.querySelector('option[value="' + resp.valor + '"]')) {
          const opt = document.createElement('option');
          opt.value = resp.valor;
          datalist.appendChild(opt);
        }
        campo.value = resp.valor;
        mostrarMensaje(resp.mensaje, 'exito');
      });
    }
    wireAgregarValorMaestro('btnAgregarProducto', 'cboTipoProductoServicio', 'agregarProducto', 'producto', 'lst-tipoProd');
    wireAgregarValorMaestro('btnAgregarPacking', 'cboPackingServicio', 'agregarPacking', 'packing', 'lst-packing');
    wireAgregarValorMaestro('btnAgregarModeloThermo', 'cboModeloThermoregistro', 'agregarModeloThermoregistro', 'modelo de thermoregistro', 'lst-modeloThermo');

    // Reefer o Dry: si es DRY no hay generador, así que se bloquea (y
    // limpia) el campo de Galones genset.
    raiz.querySelector('#cboReeferDry').addEventListener('change', function () {
      const esDry = this.value.trim().toUpperCase() === 'DRY';
      const campoGenset = raiz.querySelector('#txtGlGenerador');
      campoGenset.disabled = esDry;
      if (esDry) {
        campoGenset.value = '';
        calcularCombustible();
      }
    });

    raiz.querySelector('#btnInicioServicio').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnImprimirServicio').addEventListener('click', function () {
      self._imprimir(raiz);
    });

    raiz.querySelector('#btnGrabarServicio').addEventListener('click', async function () {
      const v = function (id) { return raiz.querySelector('#' + id).value; };

      if (validarCronologia(true)) return;

      const payload = {
        fechaServicioRegistro: self._fechaISOaDDMM(v('txtFechaServicioRegistro')),
        clienteFacturacion: v('cboClienteFacturacion'),
        empresaServicio: v('cboEmpresaServicio'),
        conductor: v('cboConductorServicio'),
        placaTracto: v('cboPlacaTractoServicio'),
        placaCarreta: v('cboPlacaCarretaServicio'),
        tipoCarga: v('cboTipoCarga'),
        destino1: v('cboDestino1Servicio'),
        destino2: v('cboDestino2Servicio'),
        booking: v('txtBookingServicio'),
        contenedor: v('txtContenedorServicio'),
        depositoRetiro: v('cboDepositoRetiro'),
        lugarPosicionamiento1: v('txtLugarPosicionamiento1'),
        lugarPosicionamiento2: v('txtLugarPosicionamiento2'),
        fechaPosicionamiento2: self._fechaDeDatetimeLocal(v('dtPosicionamiento2Servicio')),
        horaPosicionamiento2: self._horaDeDatetimeLocal(v('dtPosicionamiento2Servicio')),
        ciudadRetiro: v('cboCiudadRetiroServicio'),
        ciudadDevolucion: v('cboCiudadDevolucionServicio'),
        packing: v('cboPackingServicio'),
        thermoregistro: v('cboThermoregistro'),
        cantidadThermoregistro: v('txtCantidadThermoregistro'),
        modeloThermoregistro: v('cboModeloThermoregistro'),
        precintoAduana: v('cboPrecintoAduana'),
        operadorLogistico: v('cboOperadorLogistico'),
        filtroEtileno: v('cboFiltroEtileno'),
        cantidadFiltroEtileno: v('txtCantidadFiltroEtileno'),
        barrasConsolidado: v('cboBarrasConsolidado'),
        cantidadBarras: v('txtCantidadBarras'),
        totalCombustible: v('txtTotalCombustible'),
        fechaRetiro: self._fechaDeDatetimeLocal(v('dtRetiroServicio')),
        horaRetiro: self._horaDeDatetimeLocal(v('dtRetiroServicio')),
        depositoDevolucion: v('cboDepositoDevolucion'),
        fechaDevolucion: self._fechaDeDatetimeLocal(v('dtDevolucionServicio')),
        horaDevolucion: self._horaDeDatetimeLocal(v('dtDevolucionServicio')),
        fechaPosicionamiento: self._fechaDeDatetimeLocal(v('dtPosicionamiento1Servicio')),
        horaPosicionamiento: self._horaDeDatetimeLocal(v('dtPosicionamiento1Servicio')),
        tipoProducto: v('cboTipoProductoServicio'),
        tipoTratamiento: v('cboTipoTratamiento'),
        costoPetroleoGalon: v('txtCostoPetroleoGalon'),
        glTracto: v('txtGlTracto'),
        totalTracto: v('txtTotalTracto'),
        glGenerador: v('txtGlGenerador'),
        totalGenerador: v('txtTotalGenerador'),
        viatico: v('txtViaticoServicio'),
        peaje: v('txtPeajeServicio'),
        cochera: v('txtCocheraServicio'),
        montoDepositado: v('txtMontoDepositadoServicio'),
        totalViaje: v('txtTotalViaje'),
        tarifa1: v('txtTarifa1Servicio'),
        tipoAbastecimiento: self._tipoAbastecimiento,
        reeferDry: v('cboReeferDry'),
        proveedor: v('cboProveedorServicio'),
        // Si el usuario dejó la tarifa autocompletada por el buscador, no es
        // nueva. Si la tipeó/modificó a mano, se guarda como tarifa vigente
        // nueva en el módulo de Tarifas.
        tarifaEsNueva: !raiz.querySelector('#txtTarifa1Servicio').dataset.autocompletada,
        modoEdicion: self._modoEdicion,
        filaEdicion: self._filaEdicion
      };

      const resp = await llamarBackend('grabarServicio', payload);

      if (!resp.ok) {
        mostrarMensaje(resp.mensaje, 'error');
        if (resp.foco && raiz.querySelector('#' + (idsMapeo[resp.foco] || resp.foco))) {
          raiz.querySelector('#' + (idsMapeo[resp.foco] || resp.foco)).focus();
        }
        return;
      }

      mostrarMensaje(resp.mensaje, 'exito');
      if (self._modoEdicion && typeof FormSelServicioContabilidad !== 'undefined') {
        FormSelServicioContabilidad.abrir();
      } else {
        cerrarPanel();
      }
    });

    const idsMapeo = {
      clienteFacturacion: 'cboClienteFacturacion', empresaServicio: 'cboEmpresaServicio',
      conductor: 'cboConductorServicio', placaTracto: 'cboPlacaTractoServicio',
      placaCarreta: 'cboPlacaCarretaServicio', tipoCarga: 'cboTipoCarga',
      destino1: 'cboDestino1Servicio', destino2: 'cboDestino2Servicio',
      depositoRetiro: 'cboDepositoRetiro', fechaRetiro: 'dtRetiroServicio',
      horaRetiro: 'dtRetiroServicio', depositoDevolucion: 'cboDepositoDevolucion',
      fechaDevolucion: 'dtDevolucionServicio', horaDevolucion: 'dtDevolucionServicio',
      contenedor: 'txtContenedorServicio', tipoProducto: 'cboTipoProductoServicio',
      tipoTratamiento: 'cboTipoTratamiento', btnCalcular: 'btnCalcularServicio'
    };
  }
};
