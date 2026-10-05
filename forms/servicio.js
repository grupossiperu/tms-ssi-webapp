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
    this._datos = datos;
    this._modoEdicion = !!filaEdicion;
    this._filaEdicion = filaEdicion || null;
    this._tipoAbastecimiento = '';

    const opciones = function (lista) {
      return '<option value=""></option>' + lista.map(function (v) {
        return `<option value="${v}">${v}</option>`;
      }).join('');
    };

    // El formulario se arma por segmentos (secciones) para que sea más fácil
    // de leer. Los ids de los campos no cambian: la lógica (_wire, _precargar,
    // _imprimir y Grabar) sigue funcionando igual.
    const html = `
      <style>
        .panel-modal.panel-srv { max-width: min(1400px, 97vw); }
        .overlay-modal:has(.panel-srv) { padding: 16px 10px; }
        .panel-srv .panel-body { max-height: calc(100vh - 110px); padding: 18px 22px 0; background: #f6f8fb; }
        .panel-srv .seg { border: 1px solid #dbe2ea; border-radius: 10px; margin: 0 0 14px; background: #fff; overflow: hidden; }
        .panel-srv .seg-tit { background: #eef3f8; color: #1c3a5e; font-weight: 700; font-size: .8rem; letter-spacing: .4px; text-transform: uppercase; padding: 8px 14px; border-bottom: 1px solid #dbe2ea; display: flex; align-items: center; gap: 8px; }
        .panel-srv .seg-num { background: #1c3a5e; color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: .7rem; }
        .panel-srv .seg-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 16px; padding: 12px 14px 2px; }
        .panel-srv .seg-grid.c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .panel-srv .seg-grid .span2 { grid-column: span 2; }
        .panel-srv .campo { margin-bottom: 10px; }
        .panel-srv .campo label.lbl-flex { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .panel-srv .badge-vig { font-size: .72rem; font-weight: 600; padding: 2px 9px; border-radius: 10px; background: #f1f5f9; color: #64748b; white-space: nowrap; }
        .panel-srv .badge-vig.ok { background: #dcfce7; color: #166534; }
        .panel-srv .badge-vig.no { background: #fef3c7; color: #92400e; }
        .panel-srv .ref-comb { grid-column: 1 / -1; font-size: .8rem; color: #475569; background: #f1f5f9; border-radius: 8px; padding: 7px 11px; margin-bottom: 10px; }
        .panel-srv .ref-comb.ok { background: #dcfce7; color: #166534; }
        .panel-srv .ref-comb.no { background: #fef3c7; color: #92400e; }
        .panel-srv .chk-gas { display: flex !important; align-items: center; gap: 6px; margin: 0 0 0 10px !important; white-space: nowrap; font-weight: 600; font-size: .85rem; color: #1c3a5e; cursor: pointer; }
        .panel-srv .chk-gas input { width: auto; margin: 0; }
        .panel-srv .panel-footer { position: sticky; bottom: 0; background: #fff; margin: 0 -22px; padding: 12px 22px; box-shadow: 0 -2px 8px rgba(0,0,0,.06); }
        .panel-srv .adic-bloque { grid-column: 1 / -1; border-top: 1px dashed #dbe2ea; padding-top: 10px; margin-bottom: 10px; }
        .panel-srv .adic-tit { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
        .panel-srv .adic-tit b { color: #1c3a5e; font-size: .85rem; }
        .panel-srv .adic-tit small { color: #64748b; font-weight: 500; }
        .panel-srv .total-venta { background: #eef3f8; color: #1c3a5e; border-radius: 8px; padding: 6px 12px; font-weight: 700; font-size: .9rem; }
        .panel-srv .tabla-adic { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        .panel-srv .tabla-adic th { text-align: left; font-size: .75rem; color: #1c3a5e; padding: 0 8px 4px 0; }
        .panel-srv .tabla-adic td { padding: 0 8px 6px 0; }
        .panel-srv .tabla-adic input { width: 100%; padding: 8px 10px; border: 1.5px solid #c7ced8; border-radius: 8px; font-size: .9rem; font-family: inherit; }
        .panel-srv .btn-quitar-adic { border: none; background: transparent; color: #b91c1c; font-size: 1.2rem; cursor: pointer; }
        .panel-srv .btn-agregar-adic { border: 1.5px dashed #94a3b8; background: #f8fafc; color: #1c3a5e; border-radius: 8px; font-size: .82rem; font-weight: 700; padding: 6px 12px; cursor: pointer; }
        .panel-srv .btn-agregar-adic:hover { border-color: #1c3a5e; background: #eef3f8; }
        @media (max-width: 1000px) { .panel-srv .seg-grid, .panel-srv .seg-grid.c3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .panel-srv .seg-grid, .panel-srv .seg-grid.c3 { grid-template-columns: 1fr; } .panel-srv .seg-grid .span2 { grid-column: auto; } }
      </style>

      <div class="seg">
        <div class="seg-tit"><span class="seg-num">1</span> Datos generales</div>
        <div class="seg-grid c3">
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
      </div>

      <div class="seg">
        <div class="seg-tit"><span class="seg-num">2</span> Conductor y unidad</div>
        <div class="seg-grid c3">
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
      </div>

      <div class="seg">
        <div class="seg-tit"><span class="seg-num">3</span> Ruta y tarifa</div>
        <div class="seg-grid">
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
          <div style="display:none">
          <!-- Destino 2 = destinos adicionales unidos con " / " (se arma solo). -->
          <input type="hidden" id="cboDestino2Servicio">
          <datalist id="lst-destinos">${datos.destinos.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
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
          <div class="campo span2">
            <label class="lbl-flex"><span>Tarifa</span><span id="fechaVigenciaTarifa" class="badge-vig">Vigencia: —</span></label>
            <div class="fila-combo-mas">
              <input type="text" id="txtTarifa1Servicio" placeholder="0.00">
              <button type="button" class="boton-moneda" data-campo="txtTarifa1Servicio" data-moneda="S">S/</button>
              <button type="button" class="boton-moneda" data-campo="txtTarifa1Servicio" data-moneda="D">$</button>
            </div>
          </div>
          <div class="adic-bloque">
            <div class="adic-tit">
              <b>Destinos adicionales <small>· cada punto extra de la ruta con su tarifa adicional (misma moneda que la tarifa)</small></b>
              <span class="total-venta" id="txtTotalVentaServicio">Total venta por viaje: —</span>
            </div>
            <table class="tabla-adic" id="tablaDestinosAdic">
              <thead><tr><th>Destino adicional</th><th style="width:200px">Tarifa adicional</th><th style="width:30px"></th></tr></thead>
              <tbody></tbody>
            </table>
            <button type="button" class="btn-agregar-adic" id="btnAgregarDestinoAdic">+ Agregar destino</button>
          </div>
        </div>
      </div>

      <div class="seg">
        <div class="seg-tit"><span class="seg-num">4</span> Carga y contenedor</div>
        <div class="seg-grid c3">
          <div class="campo">
          <label>Booking</label>
          <input type="text" id="txtBookingServicio">
        </div>
          <div class="campo">
          <label>N° Contenedor (ABCU1234567)</label>
          <input type="text" id="txtContenedorServicio">
        </div>
          <div class="campo">
          <label>Operador logístico</label>
          <input list="lst-operadorLog" id="cboOperadorLogistico" placeholder="Escriba o elija">
          <datalist id="lst-operadorLog">${(datos.operadoresLogisticos || []).map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
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
      </div>

      <div class="seg">
        <div class="seg-tit"><span class="seg-num">5</span> Accesorios y control</div>
        <div class="seg-grid c3">
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
          <div class="campo">
          <label>Precinto de aduana</label>
          <select id="cboPrecintoAduana"><option value="NO">NO</option><option value="SI">SI</option></select>
        </div>
          <div class="campo">
          <label>Filtro de etileno</label>
          <select id="cboFiltroEtileno"><option value="NO">NO</option><option value="SI">SI</option></select>
        </div>
          <div class="campo">
          <label>Cantidad de filtros de etileno</label>
          <input type="number" min="0" step="1" id="txtCantidadFiltroEtileno" placeholder="0">
        </div>
          <div class="campo">
          <label>Barras consolidado (solo carga consolidado)</label>
          <select id="cboBarrasConsolidado" disabled><option value="NO">NO</option><option value="SI">SI</option></select>
        </div>
          <div class="campo">
          <label>Cantidad de barras (solo carga consolidado)</label>
          <input type="number" min="0" step="1" id="txtCantidadBarras" placeholder="0" disabled>
        </div>
          <div class="campo">
            <label>Observación</label>
            <select id="cboObservacionServicio">
              <option value=""></option>
              <option value="GASIFICADO">GASIFICADO</option>
              <option value="PREENFRIADO">PREENFRIADO</option>
            </select>
          </div>
        </div>
      </div>

      <div class="seg">
        <div class="seg-tit"><span class="seg-num">6</span> Programación del viaje (retiro, posicionamiento y devolución)</div>
        <div class="seg-grid">
          <div class="campo">
          <label>Depósito de retiro</label>
          <input list="lst-depRetiro" id="cboDepositoRetiro">
          <datalist id="lst-depRetiro">${datos.depositosRetiro.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
          <div class="campo">
          <label>Fecha y hora de retiro</label>
          <input type="datetime-local" id="dtRetiroServicio">
        </div>
          <div class="campo">
          <label>Depósito de devolución</label>
          <input list="lst-depDevolucion" id="cboDepositoDevolucion">
          <datalist id="lst-depDevolucion">${datos.depositosDevolucion.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
          <div class="campo">
          <label>Fecha y hora de devolución</label>
          <input type="datetime-local" id="dtDevolucionServicio">
        </div>
          <div class="campo">
          <label>Lugar de posicionamiento 1</label>
          <input type="text" id="txtLugarPosicionamiento1" placeholder="Se toma del Destino 1" disabled>
        </div>
          <div class="campo">
          <label>Fecha y hora de posicionamiento 1</label>
          <input type="datetime-local" id="dtPosicionamiento1Servicio">
        </div>
          <div class="campo">
          <label>Lugar de posicionamiento 2 (solo carga consolidado)</label>
          <input type="text" id="txtLugarPosicionamiento2" placeholder="Se toma del Destino 2" disabled>
        </div>
          <div class="campo">
          <label>Fecha y hora de posicionamiento 2 (solo carga consolidado)</label>
          <input type="datetime-local" id="dtPosicionamiento2Servicio" disabled>
        </div>
          <div class="campo" style="grid-column: 1 / -1;">
            <label>Ubicación del packing (link de Google Maps, coordenadas o dirección)</label>
            <div class="fila-combo-mas">
              <input type="text" id="txtUbicacionPacking" placeholder="Ej: https://maps.app.goo.gl/...  o  -13.4101, -76.1325" autocomplete="off">
              <button type="button" id="btnVerUbicacionPacking" class="boton-secundario" title="Abrir en Google Maps" style="white-space:nowrap;">Ver mapa</button>
            </div>
          </div>
        </div>
      </div>

      <div class="seg">
        <div class="seg-tit"><span class="seg-num">7</span> Combustible</div>
        <div class="seg-grid c3">
          <div id="refCombustible" class="ref-comb">Galones de referencia: complete ciudad de retiro, ciudad de devolución, destino y planta.</div>
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
      </div>

      <div class="seg">
        <div class="seg-tit"><span class="seg-num">8</span> Gastos del viaje y liquidación</div>
        <div class="seg-grid">
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
          <div class="campo">
          <label>¿Abastecido por proveedor?</label>
          <div class="fila-combo-mas">
            <button type="button" class="boton-moneda" id="btnAbastecidoSi" data-valor="SI">Sí</button>
            <button type="button" class="boton-moneda activo" id="btnAbastecidoNo" data-valor="NO">No</button>
          </div>
        </div>
          <div class="campo span2">
          <label>Proveedor</label>
          <div class="fila-combo-mas">
            <select id="cboProveedorServicio" disabled><option value=""></option>${opciones(datos.proveedores).replace('<option value=""></option>', '')}</select>
            <button type="button" id="btnAgregarProveedor" class="boton-mas" title="Agregar proveedor nuevo" disabled>+</button>
          </div>
        </div>
          <div class="campo">
          <label>Monto para depositar</label>
          <input type="text" id="txtMontoDepositadoServicio" disabled>
        </div>
          <div class="campo">
          <label>Total por viaje</label>
          <input type="text" id="txtTotalViaje" disabled>
        </div>
        </div>
      </div>

      <div class="panel-footer" style="padding-top:10px; justify-content:space-between;">
        <button class="boton-secundario" id="btnInicioServicio">Inicio</button>
        <div style="display:flex; gap:10px;">
          <button class="boton-secundario" id="btnImprimirServicio">Imprimir</button>
          <button class="boton-primario" id="btnGrabarServicio">Grabar</button>
        </div>
      </div>`;

    abrirPanel('Registrar Servicio' + (filaEdicion ? ' - Completar datos' : ''), html, (raiz) => this._wire(raiz), { clase: 'panel-srv' });

    if (filaEdicion) {
      // Carga los datos de la fila para edición/completado.
      const registro = await llamarBackend('cargarDatosServicioParaConsolidado', { fila: filaEdicion });
      if (registro) this._precargar(document.getElementById('cuerpo-panel'), registro);
      if (registro && this._proponerGalones) this._proponerGalones();
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
    if (typeof self._cargarDestinosAdic === 'function') {
      let lista = [];
      try { lista = JSON.parse(f['DESTINOS ADICIONALES'] || '[]'); } catch (e) { lista = []; }
      if (!Array.isArray(lista) || !lista.length) {
        const d2 = String(f['DESTINO 2'] || '').trim();
        const partes = (d2 && d2 !== '-') ? d2.split('/').map(function (x) { return x.trim(); }).filter(Boolean) : [];
        lista = partes.map(function (d) { return { destino: d, tarifa: partes.length === 1 ? (Number(f['TARIFA 2']) || 0) : 0 }; });
      }
      self._cargarDestinosAdic(lista);
    }
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
    set('cboObservacionServicio', String(f['OBSERVACION'] || '').trim().toUpperCase());
    set('txtUbicacionPacking', f['UBICACION PACKING']);
    if (!String(f['UBICACION PACKING'] || '').trim()) {
      const mapaUbic = (self._datos && self._datos.ubicacionPorPacking) || {};
      const ubic = mapaUbic[String(f['PACKING'] || '').trim().toUpperCase()];
      if (ubic) {
        set('txtUbicacionPacking', ubic);
        raiz.querySelector('#txtUbicacionPacking').dataset.autocompletada = '1';
      }
    }

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
    if (typeof self._actualizarTotalVenta === 'function') self._actualizarTotalVenta();
  },

  _fechaHoy: function () {
    const hoy = new Date();
    return String(hoy.getDate()).padStart(2, '0') + '/' + String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear();
  },

  /**
   * Vista imprimible (A4) del servicio. Nunca incluye la Tarifa (dato
   * confidencial). Si el combustible lo abastece un proveedor tampoco salen
   * el costo del petróleo, los totales de combustible ni el total por viaje.
   * Lleva un QR con la ubicación del packing en Google Maps.
   */
  _imprimir: function (raiz) {
    const v = function (id) {
      const el = raiz.querySelector('#' + id);
      return el ? (el.value || '').trim() : '';
    };
    const vF = (id) => this._fechaDeDatetimeLocal(v(id));
    const vH = (id) => this._horaDeDatetimeLocal(v(id));
    const btnSi = raiz.querySelector('#btnAbastecidoSi');
    const d = {
      fechaRegistro: this._fechaISOaDDMM(v('txtFechaServicioRegistro')),
      cliente: v('cboClienteFacturacion'), empresa: v('cboEmpresaServicio'),
      conductor: v('cboConductorServicio'), tracto: v('cboPlacaTractoServicio'), carreta: v('cboPlacaCarretaServicio'),
      tipoCarga: v('cboTipoCarga'), reeferDry: v('cboReeferDry'),
      destino1: v('cboDestino1Servicio'), destino2: v('cboDestino2Servicio'),
      ciudadRetiro: v('cboCiudadRetiroServicio'), ciudadDevolucion: v('cboCiudadDevolucionServicio'),
      booking: v('txtBookingServicio'), contenedor: v('txtContenedorServicio'),
      tipoProducto: v('cboTipoProductoServicio'), tipoTratamiento: v('cboTipoTratamiento'),
      packing: v('cboPackingServicio'), ubicacionPacking: v('txtUbicacionPacking'),
      thermo: v('cboThermoregistro'), cantThermo: v('txtCantidadThermoregistro'), modeloThermo: v('cboModeloThermoregistro'),
      precinto: v('cboPrecintoAduana'), operador: v('cboOperadorLogistico'),
      filtroEtileno: v('cboFiltroEtileno'), cantFiltro: v('txtCantidadFiltroEtileno'),
      barras: v('cboBarrasConsolidado'), cantBarras: v('txtCantidadBarras'),
      observacion: v('cboObservacionServicio'),
      depRetiro: v('cboDepositoRetiro'), fRetiro: vF('dtRetiroServicio'), hRetiro: vH('dtRetiroServicio'),
      lugar1: v('txtLugarPosicionamiento1'), fPos1: vF('dtPosicionamiento1Servicio'), hPos1: vH('dtPosicionamiento1Servicio'),
      lugar2: v('txtLugarPosicionamiento2'), fPos2: vF('dtPosicionamiento2Servicio'), hPos2: vH('dtPosicionamiento2Servicio'),
      depDevol: v('cboDepositoDevolucion'), fDevol: vF('dtDevolucionServicio'), hDevol: vH('dtDevolucionServicio'),
      costoPetroleo: v('txtCostoPetroleoGalon'), glTracto: v('txtGlTracto'), glGenset: v('txtGlGenerador'),
      totalTracto: v('txtTotalTracto'), totalGenset: v('txtTotalGenerador'), totalCombustible: v('txtTotalCombustible'),
      viatico: v('txtViaticoServicio'), peaje: v('txtPeajeServicio'), cochera: v('txtCocheraServicio'),
      montoDepositar: v('txtMontoDepositadoServicio'), totalViaje: v('txtTotalViaje'),
      proveedor: !!(btnSi && btnSi.classList.contains('activo')),
      nombreProveedor: v('cboProveedorServicio')
    };
    this._imprimirDatos(d);
  },

  /**
   * Imprime un servicio ya grabado (botón de impresora del módulo Acarreo),
   * leyendo la fila directamente de la hoja SERVICIOS.
   */
  imprimirDesdeFila: async function (fila) {
    const ventana = window.open('', '_blank');
    if (!ventana) {
      mostrarMensaje('El navegador bloqueó la ventana de impresión. Habilite las ventanas emergentes para este sitio.', 'error');
      return;
    }
    ventana.document.write('<p style="font-family:Arial,sans-serif; padding:24px; color:#1c3a5e;">Cargando servicio...</p>');
    let f = null;
    try { f = await llamarBackend('cargarDatosServicioParaConsolidado', { fila: fila }); } catch (e) { f = null; }
    if (!f) {
      ventana.document.body.textContent = 'No se pudo cargar el servicio para imprimir.';
      return;
    }
    const txt = function (c) {
      const x = f[c];
      return (x === null || x === undefined || String(x).trim() === '-') ? '' : String(x).trim();
    };
    const num = function (c) {
      if (txt(c) === '') return '';
      const n = Number(f[c]);
      return isNaN(n) ? txt(c) : n.toFixed(2);
    };
    const fch = (c) => (txt(c) ? this._formatoFechaCampo(f[c]) : '');
    const hr = (c) => (txt(c) ? this._formatoHoraCampo(f[c]) : '');
    const d = {
      fechaRegistro: fch('FECHA DE PROGRAMACION'),
      cliente: txt('CLIENTE PARA FACTURACIÓN'), empresa: txt('EMPRESA QUE DIO EL SERVICIO'),
      conductor: txt('CONDUCTOR'), tracto: txt('PLACA TRACTO'), carreta: txt('PLACA CARRETA'),
      tipoCarga: txt('TIPO DE CARGA'), reeferDry: txt('REEFER O DRY'),
      destino1: txt('DESTINO 1'), destino2: txt('DESTINO 2'),
      ciudadRetiro: txt('CIUDAD DE RETIRO'), ciudadDevolucion: txt('CIUDAD DE DEVOLUCION'),
      booking: txt('BOOKING'), contenedor: txt('N° CONTENEDOR'),
      tipoProducto: txt('TIPO DE PRODUCTO'), tipoTratamiento: txt('TIPO DE TRATAMIENTO'),
      packing: txt('PACKING'), ubicacionPacking: txt('UBICACION PACKING'),
      thermo: txt('THERMOREGISTRO'), cantThermo: txt('CANTIDAD THERMOREGISTRO'), modeloThermo: txt('MODELO THERMOREGISTRO'),
      precinto: txt('PRECINTO DE ADUANA'), operador: txt('OPERADOR LOGISTICO'),
      filtroEtileno: txt('FILTRO DE ETILENO'), cantFiltro: txt('CANTIDAD FILTRO DE ETILENO'),
      barras: txt('BARRAS CONSOLIDADO'), cantBarras: txt('CANTIDAD BARRAS CONSOLIDADO'),
      observacion: txt('OBSERVACION'),
      depRetiro: txt('DEPOSITO DE RETIRO'), fRetiro: fch('FECHA DE RETIRO'), hRetiro: hr('HORA DE RETIRO'),
      lugar1: txt('LUGAR DE POSICIONAMIENTO 1') || txt('DESTINO 1'), fPos1: fch('FECHA DE POSICIONAMIENTO 1'), hPos1: hr('HORA DE POSICIONAMIENTO 1'),
      lugar2: txt('LUGAR DE POSICIONAMIENTO 2') || txt('DESTINO 2'), fPos2: fch('FECHA DE POSICIONAMIENTO 2'), hPos2: hr('HORA DE POSICIONAMIENTO 2'),
      depDevol: txt('DEPOSITO DE DEVOLUCION'), fDevol: fch('FECHA DE DEVOLUCION'), hDevol: hr('HORA DE DEVOLUCION'),
      costoPetroleo: num('COSTO DEL PETRÓLEO X GALÓN'), glTracto: txt('GL TRACTO'), glGenset: txt('GL GENERADOR'),
      totalTracto: num('TOTAL TRACTO'), totalGenset: num('TOTAL GENERADOR'),
      totalCombustible: ((Number(f['TOTAL TRACTO']) || 0) + (Number(f['TOTAL GENERADOR']) || 0)).toFixed(2),
      viatico: num('VIATICO'), peaje: num('PEAJE'), cochera: num('COCHERA'),
      montoDepositar: num('MONTO DEPOSITADO'), totalViaje: num('TOTAL POR VIAJE'),
      proveedor: txt('TIPO DE ABASTECIMIENTO').toUpperCase() === 'PROVEEDOR',
      nombreProveedor: txt('PROVEEDOR')
    };
    this._imprimirDatos(d, ventana);
  },

  /** Convierte lo escrito en "Ubicación del packing" en un link de Google Maps. */
  _urlMapa: function (ubicacion) {
    const u = String(ubicacion || '').trim();
    if (u === '') return '';
    if (/^https?:\/\//i.test(u)) return u;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(u);
  },

  _imprimirDatos: function (d, ventanaAbierta) {
    const esc = function (t) {
      return String(t === null || t === undefined ? '' : t).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    };
    const dinero = function (t) {
      const s = String(t || '').trim();
      if (s === '') return '';
      if (/^[S$]/.test(s)) return s;
      const n = Number(s.replace(',', '.'));
      return isNaN(n) ? s : 'S/ ' + n.toFixed(2);
    };
    const campo = function (etiqueta, valor, clase) {
      return '<div class="c' + (clase ? ' ' + clase : '') + '"><div class="l">' + esc(etiqueta) + '</div><div class="v">' + (esc(valor) || '&nbsp;') + '</div></div>';
    };
    const bloque = function (titulo, contenido, clase) {
      return '<section class="b' + (clase ? ' ' + clase : '') + '"><h3>' + esc(titulo) + '</h3>' + contenido + '</section>';
    };

    const esConsolidado = String(d.tipoCarga || '').toUpperCase() === 'CARGA CONSOLIDADO' || !!d.destino2;
    const urlMapa = this._urlMapa(d.ubicacionPacking);
    const destinoTxt = [d.destino1, d.destino2].filter(Boolean).join(' / ');

    const etapas = [
      ['Retiro', d.depRetiro, d.fRetiro, d.hRetiro],
      ['Posicionamiento 1', d.lugar1, d.fPos1, d.hPos1]
    ];
    if (esConsolidado) etapas.push(['Posicionamiento 2', d.lugar2, d.fPos2, d.hPos2]);
    etapas.push(['Devolución', d.depDevol, d.fDevol, d.hDevol]);
    const tablaViaje = '<table class="t"><thead><tr><th>Etapa</th><th>Lugar / depósito</th><th>Fecha</th><th>Hora</th></tr></thead><tbody>' +
      etapas.map(function (r) {
        return '<tr><td class="et">' + esc(r[0]) + '</td><td>' + (esc(r[1]) || '&nbsp;') + '</td><td>' + esc(r[2]) + '</td><td>' + esc(r[3]) + '</td></tr>';
      }).join('') + '</tbody></table>';

    // Si abastece un proveedor no se imprimen costos ni totales de combustible.
    const combustible = d.proveedor
      ? [campo('Abastecimiento', 'PROVEEDOR'), campo('Proveedor', d.nombreProveedor),
         campo('Galones tracto', d.glTracto), campo('Galones genset', d.glGenset)]
      : [campo('Abastecimiento', 'CONTADO'), campo('Costo petróleo x galón', dinero(d.costoPetroleo)),
         campo('Galones tracto', d.glTracto), campo('Galones genset', d.glGenset),
         campo('Total tracto', dinero(d.totalTracto)), campo('Total genset', dinero(d.totalGenset)),
         campo('Total combustible', dinero(d.totalCombustible), 'fuerte span2')];
    const gastos = [campo('Viático', dinero(d.viatico)), campo('Peaje', dinero(d.peaje)),
      campo('Cochera', dinero(d.cochera)), campo('Monto para depositar', dinero(d.montoDepositar), 'fuerte')];
    if (!d.proveedor) gastos.push(campo('Total por viaje', dinero(d.totalViaje), 'fuerte span2'));

    const accesorios = [
      campo('Thermoregistro', d.thermo), campo('Cant. thermoregistros', d.cantThermo),
      campo('Modelo thermoregistro', d.modeloThermo), campo('Precinto de aduana', d.precinto),
      campo('Filtro de etileno', d.filtroEtileno), campo('Cant. filtros etileno', d.cantFiltro)
    ];
    if (esConsolidado) {
      accesorios.push(campo('Barras consolidado', d.barras));
      accesorios.push(campo('Cant. barras', d.cantBarras));
    } else {
      accesorios.push(campo('Observación', d.observacion, 'span2'));
    }

    const qrHtml = urlMapa
      ? '<div id="qr"></div><div class="qr-pie">Escanee para abrir la ubicación del packing en Google Maps</div>' +
        '<div class="qr-pk">' + esc(d.packing) + '</div><div class="qr-url">' + esc(d.ubicacionPacking) + '</div>'
      : '<div class="qr-vacio">Sin ubicación del packing registrada.<br>Complete el campo "Ubicación del packing" en Programación del viaje.</div>';

    const css =
      '@page{ size:A4; margin:9mm; }' +
      '*{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }' +
      'body{ font-family:Arial,Helvetica,sans-serif; color:#1a1a1a; margin:0; font-size:11px; background:#e9edf2; }' +
      '.hoja{ background:#fff; width:192mm; margin:14px auto; padding:9mm; box-shadow:0 2px 14px rgba(0,0,0,.18); }' +
      'header{ display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #1c3a5e; padding-bottom:7px; margin-bottom:8px; }' +
      'header h1{ margin:0; font-size:19px; color:#1c3a5e; letter-spacing:.5px; }' +
      'header p{ margin:2px 0 0; font-size:10px; color:#555; text-transform:uppercase; letter-spacing:1.5px; }' +
      '.hdr-der{ text-align:right; }' +
      '.bk{ font-size:10px; color:#555; text-transform:uppercase; } .bk b{ font-size:18px; color:#1c3a5e; margin-left:4px; }' +
      '.fi{ font-size:8.5px; color:#666; margin-top:3px; }' +
      '.obs{ background:#fff4e5; border:2px solid #e8590c; color:#b3470a; font-weight:800; font-size:15px; padding:6px 10px; border-radius:6px; margin-bottom:8px; text-align:center; letter-spacing:1px; }' +
      '.destacado{ display:grid; grid-template-columns:1.25fr 1.35fr 1fr 1fr; gap:6px; margin-bottom:8px; }' +
      '.destacado .d{ border:2px solid #1c3a5e; border-radius:8px; padding:7px 9px; background:#f2f6fb; }' +
      '.destacado .l{ font-size:8.5px; font-weight:700; color:#1c3a5e; text-transform:uppercase; letter-spacing:.5px; }' +
      '.destacado .v{ font-size:16px; font-weight:800; margin-top:3px; line-height:1.15; word-break:normal; overflow-wrap:break-word; }' +
      '.destacado.con-obs{ grid-template-columns:0.9fr 1.45fr 0.85fr 1.1fr 1fr; gap:5px; }' +
      '.destacado.con-obs .v{ font-size:14px; }' +
      '.destacado .d-obs{ border-color:#e8590c; background:#fff4e5; }' +
      '.destacado .d-obs .l, .destacado .d-obs .v{ color:#b3470a; }' +
      '.medio{ display:grid; grid-template-columns:1fr 64mm; gap:8px; }' +
      '.der{ display:flex; flex-direction:column; }' +
      '.b{ border:1px solid #c7ced8; border-radius:6px; margin-bottom:8px; overflow:hidden; page-break-inside:avoid; }' +
      '.b h3{ margin:0; background:#1c3a5e; color:#fff; font-size:9.5px; padding:4px 8px; text-transform:uppercase; letter-spacing:.6px; }' +
      '.g{ display:grid; } .g2{ grid-template-columns:repeat(2,1fr); } .g3{ grid-template-columns:repeat(3,1fr); } .g4{ grid-template-columns:repeat(4,1fr); }' +
      '.c{ padding:4px 8px; border-right:1px solid #e3e8ee; border-bottom:1px solid #e3e8ee; min-height:35px; }' +
      '.c.span2{ grid-column:span 2; }' +
      '.c .l{ font-size:7.5px; font-weight:700; color:#5a6472; text-transform:uppercase; letter-spacing:.3px; }' +
      '.c .v{ font-size:11.5px; margin-top:2px; font-weight:600; word-break:break-word; }' +
      '.c.fuerte .v{ font-size:13px; font-weight:800; color:#1c3a5e; }' +
      '.qrb{ flex:1; display:flex; flex-direction:column; }' +
      '.qrb #qr{ display:flex; justify-content:center; padding:12px 8px 6px; }' +
      '.qrb #qr img, .qrb #qr canvas{ width:200px !important; height:200px !important; }' +
      '.qr-pie{ text-align:center; font-size:9px; color:#333; padding:0 8px; font-weight:700; }' +
      '.qr-pk{ text-align:center; font-size:12px; color:#1c3a5e; font-weight:800; padding:4px 8px 0; }' +
      '.qr-url{ text-align:center; font-size:7.5px; color:#777; padding:3px 8px 8px; word-break:break-all; }' +
      '.qr-vacio{ padding:40px 12px; text-align:center; color:#888; font-size:11px; line-height:1.5; }' +
      '.t{ width:100%; border-collapse:collapse; }' +
      '.t th{ background:#eef3f8; color:#1c3a5e; font-size:8.5px; text-transform:uppercase; text-align:left; padding:4px 8px; border-bottom:1px solid #c7ced8; }' +
      '.t td{ padding:6px 8px; border-bottom:1px solid #e3e8ee; font-size:12px; font-weight:600; }' +
      '.t td.et{ color:#1c3a5e; font-weight:800; width:24%; }' +
      '.dos{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }' +
      '.firmas{ display:grid; grid-template-columns:1fr 1fr; gap:50px; margin-top:38px; padding:0 24px; }' +
      '.firmas div{ border-top:1px solid #333; text-align:center; padding-top:4px; font-size:10px; color:#333; }' +
      '.no-print{ text-align:center; margin:4px 0 24px; }' +
      '.no-print button{ padding:10px 26px; font-size:14px; border-radius:8px; border:none; background:#1c3a5e; color:#fff; cursor:pointer; font-weight:700; }' +
      '@media print{ body{ background:#fff; } .hoja{ width:auto; margin:0; padding:0; box-shadow:none; } .no-print{ display:none; } }';

    const urlSegura = JSON.stringify(urlMapa).replace(/</g, '\\u003c');
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orden de Servicio' + (d.booking ? ' - ' + esc(d.booking) : '') + '</title>' +
      '<style>' + css + '</style>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script></head><body>' +
      '<div class="hoja">' +
      '<header><div><h1>TRANSPORTES SSI S.A.C.</h1><p>Orden de servicio de transporte</p></div>' +
      '<div class="hdr-der"><div class="bk">Booking <b>' + (esc(d.booking) || '—') + '</b></div>' +
      '<div class="fi">Registro: ' + esc(d.fechaRegistro) + ' &nbsp;·&nbsp; Impreso: ' + esc(new Date().toLocaleString('es-PE')) + '</div></div></header>' +
      '<div class="destacado' + (d.observacion ? ' con-obs' : '') + '">' +
        '<div class="d"><div class="l">Destino</div><div class="v">' + (esc(destinoTxt) || '&nbsp;') + '</div></div>' +
        '<div class="d"><div class="l">Packing</div><div class="v">' + (esc(d.packing) || '&nbsp;') + '</div></div>' +
        '<div class="d"><div class="l">Tipo de producto</div><div class="v">' + (esc(d.tipoProducto) || '&nbsp;') + '</div></div>' +
        '<div class="d"><div class="l">Tipo de tratamiento</div><div class="v">' + (esc(d.tipoTratamiento) || '&nbsp;') + '</div></div>' +
        (d.observacion ? '<div class="d d-obs"><div class="l">Observación</div><div class="v">' + esc(d.observacion) + '</div></div>' : '') +
      '</div>' +
      '<div class="medio"><div class="izq">' +
        bloque('Datos generales', '<div class="g g3">' +
          campo('Cliente', d.cliente) + campo('Empresa', d.empresa) + campo('Tipo de carga', d.tipoCarga) + '</div>') +
        bloque('Conductor y unidad', '<div class="g g4">' +
          campo('Conductor', d.conductor, 'span2') + campo('Placa tracto', d.tracto) + campo('Placa carreta', d.carreta) + '</div>') +
        bloque('Contenedor y ruta', '<div class="g g4">' +
          campo('N° contenedor', d.contenedor) + campo('Reefer / Dry', d.reeferDry) +
          campo('Ciudad de retiro', d.ciudadRetiro) + campo('Ciudad de devolución', d.ciudadDevolucion) +
          campo('Operador logístico', d.operador, 'span2') + campo('Observación', d.observacion, 'span2') + '</div>') +
      '</div><div class="der">' + bloque('Ubicación del packing', qrHtml, 'qrb') + '</div></div>' +
      bloque('Programación del viaje', tablaViaje) +
      bloque('Accesorios y control', '<div class="g g4">' + accesorios.join('') + '</div>') +
      '<div class="dos">' +
        bloque('Combustible', '<div class="g g2">' + combustible.join('') + '</div>') +
        bloque('Gastos del viaje', '<div class="g g2">' + gastos.join('') + '</div>') +
      '</div>' +
      '<div class="firmas"><div>Firma del conductor</div><div>V°B° Operaciones</div></div>' +
      '</div>' +
      '<div class="no-print"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>' +
      '<script>(function () {' +
        'var u = ' + urlSegura + '; var el = document.getElementById("qr"); if (!u || !el) return;' +
        'function pintar() {' +
          'if (typeof QRCode === "undefined") { el.textContent = "No se pudo generar el QR. Enlace: " + u; return; }' +
          'new QRCode(el, { text: u, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });' +
        '}' +
        'if (document.readyState === "complete") pintar(); else window.addEventListener("load", pintar);' +
      '})();<\/script>' +
      '</body></html>';

    const ventana = ventanaAbierta || window.open('', '_blank');
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

    // Al elegir un conductor se proponen el tracto y la carreta de su último
    // servicio registrado. Ambos combos siguen editables a mano.
    raiz.querySelector('#cboConductorServicio').addEventListener('change', function () {
      const mapa = (self._datos && self._datos.ultimaUnidadPorConductor) || {};
      const u = mapa[String(this.value || '').trim().toUpperCase()];
      if (!u) return;
      const asignar = function (id, placa) {
        const sel = raiz.querySelector('#' + id);
        const p = String(placa || '').trim().toUpperCase();
        if (!sel || p === '' || p === '-') return;
        if (!Array.from(sel.options).some(function (o) { return o.value === p; })) {
          const op = document.createElement('option');
          op.value = p; op.textContent = p;
          sel.appendChild(op);
        }
        sel.value = p;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      };
      asignar('cboPlacaTractoServicio', u.tracto);
      asignar('cboPlacaCarretaServicio', u.carreta);
    });

    // Ubicación del packing: se propone la última usada para ese packing
    // (se puede cambiar a mano) y se puede abrir en Google Maps.
    const campoUbicacion = raiz.querySelector('#txtUbicacionPacking');
    campoUbicacion.addEventListener('input', function () { delete this.dataset.autocompletada; });
    const proponerUbicacion = function () {
      const mapa = (self._datos && self._datos.ubicacionPorPacking) || {};
      const u = mapa[String(raiz.querySelector('#cboPackingServicio').value || '').trim().toUpperCase()];
      const puedeCambiar = campoUbicacion.value.trim() === '' || !!campoUbicacion.dataset.autocompletada;
      if (!puedeCambiar) return;
      if (u) {
        campoUbicacion.value = u;
        campoUbicacion.dataset.autocompletada = '1';
      } else if (campoUbicacion.dataset.autocompletada) {
        campoUbicacion.value = '';
        delete campoUbicacion.dataset.autocompletada;
      }
    };
    raiz.querySelector('#cboPackingServicio').addEventListener('change', proponerUbicacion);
    raiz.querySelector('#cboPackingServicio').addEventListener('input', proponerUbicacion);
    raiz.querySelector('#btnVerUbicacionPacking').addEventListener('click', function () {
      const url = self._urlMapa(campoUbicacion.value);
      if (!url) { mostrarMensaje('Ingrese primero la ubicación del packing.', 'error'); return; }
      window.open(url, '_blank');
    });
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
      raiz.querySelector('#txtLugarPosicionamiento2').value = (raiz.querySelector('#cboDestino2Servicio').value.split('/')[0] || '').trim();
    }

    /* ---------- Destinos adicionales (varios), cada uno con su tarifa ---------- */
    const tbodyAdic = raiz.querySelector('#tablaDestinosAdic tbody');
    function leerDestinosAdic() {
      return Array.from(tbodyAdic.querySelectorAll('tr')).map(function (tr) {
        return { destino: tr.querySelector('.adic-destino').value.trim().toUpperCase(), tarifa: self._numero(tr.querySelector('.adic-tarifa').value) };
      }).filter(function (d) { return d.destino !== ''; });
    }
    function monedaTarifa() {
      return String(raiz.querySelector('#txtTarifa1Servicio').value || '').indexOf('$') !== -1 ? '$ ' : 'S/ ';
    }
    function actualizarTotalVenta() {
      const base = self._numero(raiz.querySelector('#txtTarifa1Servicio').value);
      const adic = leerDestinosAdic().reduce(function (s, d) { return s + d.tarifa; }, 0);
      const el = raiz.querySelector('#txtTotalVentaServicio');
      el.textContent = 'Total venta por viaje: ' + monedaTarifa() + (base + adic).toFixed(2) +
        (adic > 0 ? '  (tarifa ' + base.toFixed(2) + ' + adicionales ' + adic.toFixed(2) + ')' : '');
    }
    function sincronizarDestino2() {
      const oculto = raiz.querySelector('#cboDestino2Servicio');
      const nuevo = leerDestinosAdic().map(function (d) { return d.destino; }).join(' / ');
      if (oculto.value !== nuevo) {
        oculto.value = nuevo;
        oculto.dispatchEvent(new Event('change'));
      }
      sincronizarLugaresPosicionamiento();
      actualizarTotalVenta();
    }
    function agregarDestinoAdic(destino, tarifa) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td><input class="adic-destino" list="lst-destinos" autocomplete="off" placeholder="Ej. PISCO"></td>' +
        '<td><input class="adic-tarifa" inputmode="decimal" autocomplete="off" placeholder="0.00"></td>' +
        '<td><button type="button" class="btn-quitar-adic" title="Quitar destino">×</button></td>';
      tr.querySelector('.adic-destino').value = destino || '';
      tr.querySelector('.adic-tarifa').value = tarifa ? Number(tarifa).toFixed(2) : '';
      tr.querySelector('.adic-destino').addEventListener('change', sincronizarDestino2);
      tr.querySelector('.adic-tarifa').addEventListener('input', actualizarTotalVenta);
      tr.querySelector('.btn-quitar-adic').addEventListener('click', function () { tr.remove(); sincronizarDestino2(); });
      tbodyAdic.appendChild(tr);
      return tr;
    }
    raiz.querySelector('#btnAgregarDestinoAdic').addEventListener('click', function () {
      agregarDestinoAdic().querySelector('.adic-destino').focus();
    });
    raiz.querySelector('#txtTarifa1Servicio').addEventListener('input', actualizarTotalVenta);
    raiz.querySelectorAll('.boton-moneda').forEach(function (b) { b.addEventListener('click', function () { setTimeout(actualizarTotalVenta, 0); }); });
    self._leerDestinosAdic = leerDestinosAdic;
    self._actualizarTotalVenta = actualizarTotalVenta;
    self._cargarDestinosAdic = function (lista) {
      tbodyAdic.innerHTML = '';
      (lista || []).forEach(function (d) { agregarDestinoAdic(d.destino, d.tarifa); });
      sincronizarDestino2();
    };
    raiz.querySelector('#cboDestino1Servicio').addEventListener('input', sincronizarLugaresPosicionamiento);
    raiz.querySelector('#cboDestino1Servicio').addEventListener('change', sincronizarLugaresPosicionamiento);

    // Tipo de carga: habilita/bloquea el posicionamiento 2 y las barras
    // (solo carga consolidado). Los destinos adicionales valen para todos.
    function aplicarTipoCarga(esConsolidado) {
      // Todo lo que solo aplica a carga consolidado.
      ['dtPosicionamiento2Servicio', 'cboBarrasConsolidado', 'txtCantidadBarras'].forEach(function (id) {
        raiz.querySelector('#' + id).disabled = !esConsolidado;
      });

      if (!esConsolidado) {
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

    // Tarifa automática: en cuanto están los 5 campos de la ruta, busca en
    // la matriz de TARIFAS la tarifa vigente (la más reciente) y la
    // completa sola, con su moneda. Si el usuario ya escribió una tarifa a
    // mano, no se pisa.
    async function buscarTarifaAutomatica() {
      const v = function (id) { return raiz.querySelector('#' + id).value.trim(); };

      const cliente = v('cboClienteFacturacion');
      const ciudadRetiro = v('cboCiudadRetiroServicio');
      const destino1 = v('cboDestino1Servicio');
      // La tarifa de la tabla es la de la ruta base; cada destino adicional
      // lleva su propia tarifa adicional escrita a mano.
      const destino2 = '';
      const ciudadDevolucion = v('cboCiudadDevolucionServicio');

      const campoFechaVigencia = raiz.querySelector('#fechaVigenciaTarifa');

      const pintarVig = function (txt, estado) {
        if (!campoFechaVigencia) return;
        campoFechaVigencia.textContent = txt;
        campoFechaVigencia.className = 'badge-vig' + (estado ? ' ' + estado : '');
      };

      if (cliente === '' || ciudadRetiro === '' || destino1 === '' || ciudadDevolucion === '') {
        pintarVig('Vigencia: —', '');
        return;
      }

      const campoTarifa = raiz.querySelector('#txtTarifa1Servicio');
      // Si el usuario escribió la tarifa a mano no se pisa, pero igual se
      // muestra la vigencia de la tarifa de la tabla como referencia.
      const tarifaManual = self._numero(campoTarifa.value) > 0 && !campoTarifa.dataset.autocompletada;
      pintarVig('Buscando tarifa…', '');

      const resp = await llamarBackend('buscarTarifa', {
        cliente: cliente,
        ciudadRetiro: ciudadRetiro,
        destino1: destino1,
        destino2: destino2,
        ciudadDevolucion: ciudadDevolucion,
        reeferDry: v('cboReeferDry')
      });

      if (!resp.encontrado) {
        pintarVig('Sin tarifa registrada para esta ruta', 'no');
        return;
      }

      const prefijo = resp.moneda === 'D' ? '$ ' : 'S/ ';
      if (!tarifaManual) {
        campoTarifa.value = prefijo + Number(resp.tarifa).toFixed(2);
        campoTarifa.dataset.autocompletada = '1';
      }

      if (campoFechaVigencia) {
        if (resp.fecha) {
          const df = new Date(resp.fecha);
          const txt = isNaN(df.getTime())
            ? ''
            : (tarifaManual ? 'Tabla: ' + prefijo + Number(resp.tarifa).toFixed(2) + ' · vigente desde ' : 'Vigente desde ') + String(df.getDate()).padStart(2, '0') + '/' +
              String(df.getMonth() + 1).padStart(2, '0') + '/' + df.getFullYear();
          pintarVig(txt || 'Vigencia: sin fecha', txt ? 'ok' : '');
        } else {
          pintarVig('Vigencia: sin fecha', '');
        }
      }

      raiz.querySelectorAll('.boton-moneda[data-campo="txtTarifa1Servicio"]').forEach(function (b) {
        b.classList.toggle('activo', b.dataset.moneda === (resp.moneda === 'D' ? 'D' : 'S'));
      });
      actualizarTotalVenta();
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
      const cf = raiz.querySelector('#fechaVigenciaTarifa');
      if (cf) { cf.textContent = 'Tarifa ingresada a mano'; cf.className = 'badge-vig'; }
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

    // Galones de referencia: si ya hubo un viaje con la misma ciudad de
    // retiro, ciudad de devolución, destino 1, destino 2 y planta, se
    // proponen los galones de tracto y genset del viaje más reciente de la
    // hoja SERVICIOS. Siempre se pueden modificar a mano.
    const avisoComb = raiz.querySelector('#refCombustible');
    const campoGlTracto = raiz.querySelector('#txtGlTracto');
    const campoGlGenset = raiz.querySelector('#txtGlGenerador');
    [campoGlTracto, campoGlGenset].forEach(function (c) {
      c.addEventListener('input', function () { delete this.dataset.autocompletada; });
    });
    const proponerGalones = function () {
      if (!avisoComb) return;
      const val = function (id) { return String(raiz.querySelector('#' + id).value || '').trim().toUpperCase(); };
      const d2 = val('cboDestino2Servicio') === '-' ? '' : val('cboDestino2Servicio');
      const partes = [val('cboCiudadRetiroServicio'), val('cboCiudadDevolucionServicio'), val('cboDestino1Servicio'), d2, val('cboPackingServicio')];
      const limpiarPropuestos = function () {
        let cambio = false;
        [campoGlTracto, campoGlGenset].forEach(function (c) {
          if (c.dataset.autocompletada) { c.value = ''; delete c.dataset.autocompletada; cambio = true; }
        });
        if (cambio) calcularCombustible();
      };
      if (!partes[0] || !partes[1] || !partes[2] || !partes[4]) {
        avisoComb.textContent = 'Galones de referencia: complete ciudad de retiro, ciudad de devolución, destino y planta.';
        avisoComb.className = 'ref-comb';
        limpiarPropuestos();
        return;
      }
      const mapa = (self._datos && self._datos.combustiblePorRuta) || {};
      const ref = mapa[partes.join('|')];
      if (!ref) {
        avisoComb.textContent = 'Sin viajes anteriores con esta ruta y planta: ingrese los galones.';
        avisoComb.className = 'ref-comb no';
        limpiarPropuestos();
        return;
      }
      let cambio = false;
      if (campoGlTracto.value.trim() === '' || campoGlTracto.dataset.autocompletada) {
        campoGlTracto.value = ref.glTracto || '';
        campoGlTracto.dataset.autocompletada = '1';
        cambio = true;
      }
      if (!campoGlGenset.disabled && (campoGlGenset.value.trim() === '' || campoGlGenset.dataset.autocompletada)) {
        campoGlGenset.value = ref.glGenset || '';
        campoGlGenset.dataset.autocompletada = '1';
        cambio = true;
      }
      avisoComb.textContent = 'Referencia del último viaje con esta ruta y planta (' + (ref.fecha || 'sin fecha') +
        (ref.booking ? ', booking ' + ref.booking : '') + '): ' + (ref.glTracto || 0) + ' gl tracto / ' +
        (ref.glGenset || 0) + ' gl genset. Puede modificarlos.';
      avisoComb.className = 'ref-comb ok';
      if (cambio) calcularCombustible();
    };
    self._proponerGalones = proponerGalones;
    ['cboCiudadRetiroServicio', 'cboCiudadDevolucionServicio', 'cboDestino1Servicio', 'cboDestino2Servicio', 'cboPackingServicio'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', proponerGalones);
    });
    raiz.querySelector('#cboPackingServicio').addEventListener('input', proponerGalones);

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
        destinosAdicionales: JSON.stringify(leerDestinosAdic()),
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
        observacion: v('cboObservacionServicio'),
        ubicacionPacking: v('txtUbicacionPacking'),
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
      destino1: 'cboDestino1Servicio', destino2: 'btnAgregarDestinoAdic',
      depositoRetiro: 'cboDepositoRetiro', fechaRetiro: 'dtRetiroServicio',
      horaRetiro: 'dtRetiroServicio', depositoDevolucion: 'cboDepositoDevolucion',
      fechaDevolucion: 'dtDevolucionServicio', horaDevolucion: 'dtDevolucionServicio',
      contenedor: 'txtContenedorServicio', tipoProducto: 'cboTipoProductoServicio',
      tipoTratamiento: 'cboTipoTratamiento', btnCalcular: 'btnCalcularServicio'
    };
  }
};
