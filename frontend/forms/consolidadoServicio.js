/**
 * forms/consolidadoServicio.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmConsolidadoServicio.frm (VBA) - detalle del
 * Consolidado de Servicios. Réplica las fórmulas EXACTAS encontradas en
 * CalcularTodoConsolidado y CalcularCombustible: bono total, peaje base
 * imponible (peaje/1.18), total por viaje, diferencia (monto depositado -
 * total viaje) con semáforo de color, combustible real vs. estimado
 * (tracto y generador) con sus diferencias, adicionales de combustible
 * (con y sin IGV) y costo por viaje realizado (con y sin IGV).
 *
 * Nota de adaptación técnica (no de negocio): en el VBA original, varios
 * campos (peaje SDCF, peaje adicional, llanta, lavado, balanza, otros,
 * galones adicionales) se habilitaban con checkboxes antes de poder
 * escribirse. Aquí esos campos están siempre editables (más simple para
 * web), pero las fórmulas que los combinan son idénticas.
 * -------------------------------------------------------------------------
 */
const FormConsolidadoServicio = {

  _filaServicioOrigen: null,
  _estadoOrigen: '',

  abrir: async function (filaServicio, estadoOrigen) {
    const servicio = await llamarBackend('cargarDatosServicioParaConsolidado', { fila: filaServicio });
    if (!servicio) { mostrarMensaje('No se pudo cargar el servicio.', 'error'); return; }

    this._filaServicioOrigen = filaServicio;
    this._estadoOrigen = estadoOrigen;

    const destino2 = String(servicio['DESTINO 2'] || '').trim();
    const cantidadViajes = (destino2 !== '' && destino2 !== '-') ? 2 : 1;

    const html = `
      <div class="fila-campos">
        <div class="campo"><label>Cliente para facturación</label><input id="txtClienteFacturacionConsol" value="${servicio['CLIENTE PARA FACTURACIÓN']||''}"></div>
        <div class="campo"><label>Cantidad de viajes</label><input id="txtCantidadViajesConsol" value="${cantidadViajes}"></div>
        <div class="campo"><label>Flota</label><input id="txtFlotaConsol" value="PROPIO"></div>
        <div class="campo"><label>Empresa</label><input id="txtEmpresaServicioConsol" value="${servicio['EMPRESA QUE DIO EL SERVICIO']||''}"></div>
        <div class="campo"><label>Conductor</label><input id="txtConductorConsol" value="${servicio['CONDUCTOR']||''}"></div>
        <div class="campo"><label>Placa tracto</label><input id="txtPlacaTractoConsol" value="${servicio['PLACA TRACTO']||''}"></div>
        <div class="campo"><label>Placa carreta</label><input id="txtPlacaCarretaConsol" value="${servicio['PLACA CARRETA']||''}"></div>
        <div class="campo"><label>Tipo de carga</label><input id="txtTipoCargaConsol" value="${servicio['TIPO DE CARGA']||''}"></div>
        <div class="campo"><label>Destino 1</label><input id="txtDestino1Consol" value="${servicio['DESTINO 1']||''}"></div>
        <div class="campo"><label>Cliente (facturación consolidado)</label><input id="cboClienteConsol"></div>
        <div class="campo"><label>Tarifa 1</label><input id="txtTarifa1Consol" value="${servicio['TARIFA 1']||''}"></div>
        <div class="campo"><label>Destino 2</label><input id="txtDestino2Consol" value="${destino2}"></div>
        <div class="campo"><label>Tarifa 2</label><input id="txtTarifa2Consol" value="${servicio['TARIFA 2']||''}"></div>
        <div class="campo"><label>Almacén de salida</label><input id="txtAlmacenSalidaConsol" value="${servicio['DEPOSITO DE RETIRO']||''}"></div>
        <div class="campo"><label>Almacén de llegada</label><input id="txtAlmacenLlegadaConsol" value="${servicio['DEPOSITO DE DEVOLUCION']||''}"></div>
        <div class="campo"><label>Booking</label><input id="txtBookingConsol" value="${servicio['BOOKING']||''}"></div>
        <div class="campo"><label>Contenedor</label><input id="txtContenedorConsol" value="${servicio['N° CONTENEDOR']||''}"></div>
        <div class="campo"><label>Tipo de producto</label><input id="txtTipoProductoConsol" value="${servicio['TIPO DE PRODUCTO']||''}"></div>
        <div class="campo"><label>Tipo de tratamiento</label><input id="txtTipoTratamientoConsol" value="${servicio['TIPO DE TRATAMIENTO']||''}"></div>
        <div class="campo"><label>Fecha del servicio</label><input id="txtFechaServicioConsol" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Mes</label><input id="txtMesConsol" disabled></div>
        <div class="campo"><label>Código del servicio</label><input id="txtCodigoServicioConsol" disabled></div>
        <div class="campo"><label>Semana</label><input id="txtSemanaConsol" disabled></div>
        <div class="campo"><label>Tara</label><input id="txtTaraConsol"></div>
        <div class="campo"><label>N° de transferencia</label><input id="txtNumeroTransferenciaConsol"></div>
        <div class="campo"><label>N° de viático</label><input id="txtNumeroViaticoConsol"></div>
        <div class="campo"><label>G.R. Transporte 1</label><input id="txtGRTransporte1Consol"></div>
        <div class="campo"><label>G.R. Cliente 1</label><input id="txtGRCliente1Consol"></div>
        <div class="campo"><label>G.R. Transporte 2</label><input id="txtGRTransporte2Consol"></div>
        <div class="campo"><label>G.R. Cliente 2</label><input id="txtGRCliente2Consol"></div>

        <div class="campo"><label>Monto depositado</label><input id="txtMontoDepositadoConsol" value="${(servicio['MONTO DEPOSITADO']||0)}"></div>
        <div class="campo"><label>Viático</label><input id="txtViaticoConsol" value="${servicio['VIATICO']||0}"></div>
        <div class="campo"><label>Peaje</label><input id="txtPeajeConsol" value="${servicio['PEAJE']||0}"></div>
        <div class="campo"><label>Peaje base imponible</label><input id="txtPeajeBIConsol" disabled></div>
        <div class="campo"><label>Peaje S.D.C.F.</label><input id="txtPeajeSDCFConsol" value="0"></div>
        <div class="campo"><label>Peaje adicional</label><input id="txtPeajeAdicionalConsol" value="0"></div>
        <div class="campo"><label>Cochera</label><input id="txtCocheraConsol" value="${servicio['COCHERA']||0}"></div>
        <div class="campo"><label>Llanta</label><input id="txtLlantaConsol" value="0"></div>
        <div class="campo"><label>Lavado</label><input id="txtLavadoConsol" value="0"></div>
        <div class="campo"><label>Balanza</label><input id="txtBalanzaConsol" value="0"></div>
        <div class="campo"><label>Otros</label><input id="txtOtrosConsol" value="0"></div>
        <div class="campo"><label>¿Dominical?</label>
          <select id="cboDominicalConsol"><option>NO</option><option>SI</option></select>
        </div>
        <div class="campo"><label>Dominical (S/.)</label><input id="txtDominicalConsol" value="0" disabled></div>
        <div class="campo"><label>¿Feriado?</label>
          <select id="cboFeriadoConsol"><option>NO</option><option>SI</option></select>
        </div>
        <div class="campo"><label>Feriado (S/.)</label><input id="txtFeriadoConsol" value="0" disabled></div>
        <div class="campo"><label>Bono</label><input id="txtBonoConsol" value="0"></div>
        <div class="campo"><label>Bono + Dom + Feriado</label><input id="txtBonoTotalConsol" disabled></div>
        <div class="campo"><label>Total por viaje</label><input id="txtTotalViajeConsol" disabled></div>
        <div class="campo"><label>Diferencia (depositado - total)</label><input id="txtDiferenciaConsol" disabled></div>

        <div class="campo"><label>GL estimados tracto</label><input id="txtGLEstimadosTractoConsol" value="${servicio['GL TRACTO']||0}" disabled></div>
        <div class="campo"><label>GL tracto real</label><input id="txtGLTractoRealConsol" value="0"></div>
        <div class="campo"><label>Diferencia tracto</label><input id="txtDiferenciaTractoConsol" disabled></div>
        <div class="campo"><label>GL estimados generador</label><input id="txtGLEstimadosGeneradorConsol" value="${servicio['GL GENERADOR']||0}" disabled></div>
        <div class="campo"><label>GL generador real</label><input id="txtGLGeneradorRealConsol" value="0"></div>
        <div class="campo"><label>Diferencia generador</label><input id="txtDiferenciaGeneradorConsol" disabled></div>
        <div class="campo"><label>Precio de petróleo</label><input id="txtPrecioPetroleoConsol" value="0"></div>
        <div class="campo"><label>Petróleo tracto</label><input id="txtPetroleoTractoConsol" disabled></div>
        <div class="campo"><label>Petróleo tracto B.I.</label><input id="txtPetroleoTractoBIConsol" disabled></div>
        <div class="campo"><label>Petróleo generador</label><input id="txtPetroleoGeneradorConsol" disabled></div>
        <div class="campo"><label>Petróleo generador B.I.</label><input id="txtPetroleoGeneradorBIConsol" disabled></div>
        <div class="campo"><label>Precio galón adicional tracto</label><input id="txtPrecioGalonTractoConsol" value="0"></div>
        <div class="campo"><label>GL adicional tracto</label><input id="txtGLAdicionalTractoConsol" value="0"></div>
        <div class="campo"><label>Total adicional tracto</label><input id="txtTotalAdicionalTracto" disabled></div>
        <div class="campo"><label>Total adicional tracto B.I.</label><input id="txtTotalAdicionalBITracto" disabled></div>
        <div class="campo"><label>Precio galón adicional genset</label><input id="txtPrecioGalonGensetConsol" value="0"></div>
        <div class="campo"><label>GL adicional genset</label><input id="txtGLAdicionalGensetConsol" value="0"></div>
        <div class="campo"><label>Total adicional generador</label><input id="txtTotalAdicionalGenerador" disabled></div>
        <div class="campo"><label>Total adicional generador B.I.</label><input id="txtTotalAdicionalBIGenerador" disabled></div>

        <div class="campo"><label>KM inicial</label><input id="txtKmInicialConsol"></div>
        <div class="campo"><label>KM final</label><input id="txtKmFinalConsol"></div>
        <div class="campo"><label>N° generador</label><input id="txtNumeroGeneradorConsol"></div>
        <div class="campo"><label>Horómetro inicial</label><input id="txtHrInicialConsol"></div>
        <div class="campo"><label>Horómetro final</label><input id="txtHrFinalConsol"></div>

        <div class="campo"><label>Costo por viaje realizado</label><input id="txtCostoViajeRealizadoConsol" disabled></div>
        <div class="campo"><label>Costo por viaje realizado B.I.</label><input id="txtCostoViajeRealizadoBI" disabled></div>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:space-between;">
        <button class="boton-secundario" id="btnInicioConsolidado">Inicio</button>
        <button class="boton-primario" id="btnGrabarConsol">Grabar</button>
      </div>`;

    abrirPanel('Consolidado de Servicios - Detalle (Estado: ' + estadoOrigen + ')', html, (raiz) => this._wire(raiz));
  },

  _n: function (t) {
    if (t === null || t === undefined) return 0;
    let x = String(t).trim().replace(/S\//g, '').replace(/\$/g, '').replace(/\s/g, '');
    if (x === '') return 0;
    const n = parseFloat(x.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  },

  _wire: function (raiz) {
    const self = this;
    let glManualTracto = 0, glManualGenerador = 0;

    function pintar(input, valor) {
      if (valor > 0) input.style.background = '#c6efce';
      else if (valor < 0) input.style.background = '#ffc7ce';
      else input.style.background = '#fff';
    }

    function calcularCombustible() {
      const glEstTracto = self._n(raiz.querySelector('#txtGLEstimadosTractoConsol').value);
      const glEstGenerador = self._n(raiz.querySelector('#txtGLEstimadosGeneradorConsol').value);
      const precioPetroleo = self._n(raiz.querySelector('#txtPrecioPetroleoConsol').value);

      const glRealTracto = glManualTracto;
      const glRealGenerador = glManualGenerador;

      const difTracto = glEstTracto - glRealTracto;
      const difGenerador = glEstGenerador - glRealGenerador;
      raiz.querySelector('#txtDiferenciaTractoConsol').value = difTracto.toFixed(2);
      raiz.querySelector('#txtDiferenciaGeneradorConsol').value = difGenerador.toFixed(2);
      pintar(raiz.querySelector('#txtDiferenciaTractoConsol'), difTracto);
      pintar(raiz.querySelector('#txtDiferenciaGeneradorConsol'), difGenerador);

      const totalTracto = glRealTracto * precioPetroleo;
      const totalGenerador = glRealGenerador * precioPetroleo;
      raiz.querySelector('#txtPetroleoTractoConsol').value = 'S/ ' + totalTracto.toFixed(2);
      raiz.querySelector('#txtPetroleoTractoBIConsol').value = 'S/ ' + (totalTracto / 1.18).toFixed(2);
      raiz.querySelector('#txtPetroleoGeneradorConsol').value = 'S/ ' + totalGenerador.toFixed(2);
      raiz.querySelector('#txtPetroleoGeneradorBIConsol').value = 'S/ ' + (totalGenerador / 1.18).toFixed(2);

      const precioGalonTracto = self._n(raiz.querySelector('#txtPrecioGalonTractoConsol').value);
      const glAdicTracto = self._n(raiz.querySelector('#txtGLAdicionalTractoConsol').value);
      const precioGalonGenset = self._n(raiz.querySelector('#txtPrecioGalonGensetConsol').value);
      const glAdicGenset = self._n(raiz.querySelector('#txtGLAdicionalGensetConsol').value);

      raiz.querySelector('#txtTotalAdicionalTracto').value = 'S/ ' + (precioGalonTracto * glAdicTracto).toFixed(2);
      raiz.querySelector('#txtTotalAdicionalBITracto').value = 'S/ ' + ((precioGalonTracto / 1.18) * glAdicTracto).toFixed(2);
      raiz.querySelector('#txtTotalAdicionalGenerador').value = 'S/ ' + (precioGalonGenset * glAdicGenset).toFixed(2);
      raiz.querySelector('#txtTotalAdicionalBIGenerador').value = 'S/ ' + ((precioGalonGenset / 1.18) * glAdicGenset).toFixed(2);

      const viatico = self._n(raiz.querySelector('#txtViaticoConsol').value);
      const peaje = self._n(raiz.querySelector('#txtPeajeConsol').value);
      const peajeBI = self._n(raiz.querySelector('#txtPeajeBIConsol').value);
      const peajeSDCF = self._n(raiz.querySelector('#txtPeajeSDCFConsol').value);
      const peajeAdicional = self._n(raiz.querySelector('#txtPeajeAdicionalConsol').value);
      const llanta = self._n(raiz.querySelector('#txtLlantaConsol').value);
      const lavado = self._n(raiz.querySelector('#txtLavadoConsol').value);
      const cochera = self._n(raiz.querySelector('#txtCocheraConsol').value);
      const otros = self._n(raiz.querySelector('#txtOtrosConsol').value);
      const bonoTotal = self._n(raiz.querySelector('#txtBonoTotalConsol').value);
      const totalAdicTracto = self._n(raiz.querySelector('#txtTotalAdicionalTracto').value);
      const totalAdicGenerador = self._n(raiz.querySelector('#txtTotalAdicionalGenerador').value);
      const totalAdicBITracto = self._n(raiz.querySelector('#txtTotalAdicionalBITracto').value);
      const totalAdicBIGenerador = self._n(raiz.querySelector('#txtTotalAdicionalBIGenerador').value);
      const petroleoTracto = self._n(raiz.querySelector('#txtPetroleoTractoConsol').value);
      const petroleoGenerador = self._n(raiz.querySelector('#txtPetroleoGeneradorConsol').value);
      const petroleoTractoBI = self._n(raiz.querySelector('#txtPetroleoTractoBIConsol').value);
      const petroleoGeneradorBI = self._n(raiz.querySelector('#txtPetroleoGeneradorBIConsol').value);

      const costoViaje = viatico + peaje + peajeSDCF + peajeAdicional + llanta + lavado + otros + cochera +
        totalAdicTracto + totalAdicGenerador + bonoTotal + petroleoTracto + petroleoGenerador;
      raiz.querySelector('#txtCostoViajeRealizadoConsol').value = 'S/ ' + costoViaje.toFixed(2);

      const costoViajeBI = viatico + peajeBI + peajeSDCF + peajeAdicional + llanta + lavado + cochera + otros +
        totalAdicBITracto + totalAdicBIGenerador + bonoTotal + petroleoTractoBI + petroleoGeneradorBI;
      raiz.querySelector('#txtCostoViajeRealizadoBI').value = 'S/ ' + costoViajeBI.toFixed(2);
    }

    function calcularTodo() {
      const bono = self._n(raiz.querySelector('#txtBonoConsol').value);
      const dominical = self._n(raiz.querySelector('#txtDominicalConsol').value);
      const feriado = self._n(raiz.querySelector('#txtFeriadoConsol').value);
      raiz.querySelector('#txtBonoTotalConsol').value = 'S/ ' + (bono + dominical + feriado).toFixed(2);

      const viatico = self._n(raiz.querySelector('#txtViaticoConsol').value);
      const peaje = self._n(raiz.querySelector('#txtPeajeConsol').value);
      const peajeSDCF = self._n(raiz.querySelector('#txtPeajeSDCFConsol').value);
      const peajeAdicional = self._n(raiz.querySelector('#txtPeajeAdicionalConsol').value);
      const llanta = self._n(raiz.querySelector('#txtLlantaConsol').value);
      const lavado = self._n(raiz.querySelector('#txtLavadoConsol').value);
      const balanza = self._n(raiz.querySelector('#txtBalanzaConsol').value);
      const cochera = self._n(raiz.querySelector('#txtCocheraConsol').value);
      const otros = self._n(raiz.querySelector('#txtOtrosConsol').value);
      const totalAdicTracto = self._n(raiz.querySelector('#txtTotalAdicionalTracto').value);
      const totalAdicGenerador = self._n(raiz.querySelector('#txtTotalAdicionalGenerador').value);

      const totalViaje = viatico + peaje + peajeSDCF + peajeAdicional + llanta + lavado + balanza + cochera + otros + totalAdicTracto + totalAdicGenerador;

      raiz.querySelector('#txtPeajeBIConsol').value = 'S/ ' + (peaje / 1.18).toFixed(2);
      raiz.querySelector('#txtTotalViajeConsol').value = 'S/ ' + totalViaje.toFixed(2);

      const montoDepositado = self._n(raiz.querySelector('#txtMontoDepositadoConsol').value);
      const diferencia = montoDepositado - totalViaje;
      raiz.querySelector('#txtDiferenciaConsol').value = 'S/ ' + diferencia.toFixed(2);
      pintar(raiz.querySelector('#txtDiferenciaConsol'), diferencia);

      calcularCombustible();
    }

    raiz.querySelector('#cboDominicalConsol').addEventListener('change', function () {
      raiz.querySelector('#txtDominicalConsol').value = this.value === 'SI' ? 60 : 0;
      calcularTodo();
    });
    raiz.querySelector('#cboFeriadoConsol').addEventListener('change', function () {
      raiz.querySelector('#txtFeriadoConsol').value = this.value === 'SI' ? 60 : 0;
      calcularTodo();
    });

    ['txtPeajeSDCFConsol','txtPeajeAdicionalConsol','txtLlantaConsol','txtLavadoConsol','txtBalanzaConsol',
     'txtOtrosConsol','txtBonoConsol','txtViaticoConsol','txtPeajeConsol','txtCocheraConsol','txtMontoDepositadoConsol',
     'txtPrecioGalonTractoConsol','txtGLAdicionalTractoConsol','txtPrecioGalonGensetConsol','txtGLAdicionalGensetConsol',
     'txtPrecioPetroleoConsol'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('input', calcularTodo);
    });

    raiz.querySelector('#txtGLTractoRealConsol').addEventListener('change', function () {
      glManualTracto = self._n(this.value);
      calcularTodo();
    });
    raiz.querySelector('#txtGLGeneradorRealConsol').addEventListener('change', function () {
      glManualGenerador = self._n(this.value);
      calcularTodo();
    });

    raiz.querySelector('#txtFechaServicioConsol').addEventListener('change', function () {
      const fecha = this.value.trim();
      if (!fecha) return;
      // Mes (equivalente a MonthName) y semana (equivalente a DatePart "ww").
      // El CÓDIGO DEL SERVICIO lo genera el backend recién al grabar
      // (generarCodigoServicioAutomatico), igual que en el VBA original:
      // aquí solo se muestra el mes y la semana como referencia visual.
      const partes = fecha.split(/[\/\-]/);
      const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
      const mesNum = parseInt(partes[1], 10);
      if (mesNum >= 1 && mesNum <= 12) raiz.querySelector('#txtMesConsol').value = meses[mesNum - 1];

      const d = new Date(parseInt(partes[2],10), mesNum - 1, parseInt(partes[0],10));
      if (!isNaN(d.getTime())) {
        const inicioAnio = new Date(d.getFullYear(), 0, 1);
        const semanaISO = Math.ceil((((d - inicioAnio) / 86400000) + inicioAnio.getDay() + 1) / 7);
        raiz.querySelector('#txtSemanaConsol').value = 'SEMANA ' + semanaISO;
      }
    });

    raiz.querySelector('#btnInicioConsolidado').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnGrabarConsol').addEventListener('click', async function () {
      const estado = String(self._estadoOrigen || '').trim().toUpperCase();

      // El botón "Culminado" de la pantalla anterior deja el ESTADO en
      // 'COMPLETADO' (no 'CULMINADO'); antes esta comparación nunca
      // coincidía y la validación de obligatorios quedaba sin efecto.
      if (estado === 'COMPLETADO') {
        const obligatorios = [
          'txtClienteFacturacionConsol','txtCantidadViajesConsol','txtFlotaConsol','txtEmpresaServicioConsol',
          'txtConductorConsol','txtPlacaTractoConsol','txtPlacaCarretaConsol','txtTipoCargaConsol','txtDestino1Consol',
          'cboClienteConsol','txtTarifa1Consol','txtAlmacenSalidaConsol','txtAlmacenLlegadaConsol',
          'txtCodigoServicioConsol','txtFechaServicioConsol','txtMesConsol','txtTipoProductoConsol','txtTipoTratamientoConsol',
          'txtBookingConsol','txtContenedorConsol','txtTaraConsol','txtSemanaConsol','txtMontoDepositadoConsol',
          'txtNumeroTransferenciaConsol','txtNumeroViaticoConsol','txtGRTransporte1Consol','txtGRCliente1Consol',
          'txtViaticoConsol','txtPeajeConsol','txtCocheraConsol','txtGLEstimadosTractoConsol','txtGLTractoRealConsol',
          'txtPrecioPetroleoConsol','txtKmInicialConsol','txtKmFinalConsol','txtNumeroGeneradorConsol',
          'txtHrInicialConsol','txtHrFinalConsol','txtCostoViajeRealizadoConsol'
        ];
        const faltante = obligatorios.some(function (id) { return raiz.querySelector('#' + id).value.trim() === ''; });
        if (faltante) {
          mostrarMensaje('Para servicios CULMINADOS debe completar todos los campos obligatorios.', 'error');
          return;
        }
      }

      const v = function (id) { return raiz.querySelector('#' + id).value; };
      const mapaColumnas = {
        'CLIENTE PARA FACTURACIÓN': v('txtClienteFacturacionConsol'), 'CANTIDAD DE VIAJES': v('txtCantidadViajesConsol'),
        'FLOTA': v('txtFlotaConsol'), 'EMPRESA QUE DIO EL SERVICIO': v('txtEmpresaServicioConsol'),
        'CONDUCTOR': v('txtConductorConsol'), 'PLACA TRACTO': v('txtPlacaTractoConsol'), 'PLACA CARRETA': v('txtPlacaCarretaConsol'),
        'TIPO DE CARGA': v('txtTipoCargaConsol'), 'DESTINO 1': v('txtDestino1Consol'), 'CLIENTE': v('cboClienteConsol'),
        'TARIFA 1': v('txtTarifa1Consol'), 'DESTINO 2': v('txtDestino2Consol'), 'TARIFA 2': v('txtTarifa2Consol'),
        'ALMACEN DE SALIDA': v('txtAlmacenSalidaConsol'), 'ALMACEN DE LLEGADA': v('txtAlmacenLlegadaConsol'),
        'BOOKING': v('txtBookingConsol'), 'Nº CONTENEDOR': v('txtContenedorConsol'), 'TARA': v('txtTaraConsol'),
        'SEMANA': v('txtSemanaConsol'), 'MONTO DEPOSITADO': v('txtMontoDepositadoConsol'),
        'N° DE TRANSFERENCIA': v('txtNumeroTransferenciaConsol'), 'N° DE VIÁTICO': v('txtNumeroViaticoConsol'),
        'G.R. TRANSPORTE 1': v('txtGRTransporte1Consol'), 'G.R. CLIENTE 1': v('txtGRCliente1Consol'),
        'G.R. TRANSPORTE 2': v('txtGRTransporte2Consol'), 'G.R. CLIENTE 2': v('txtGRCliente2Consol'),
        'VIATICO': v('txtViaticoConsol'), 'PEAJE': v('txtPeajeConsol'), 'PEAJE S.D.C.F.': v('txtPeajeSDCFConsol'),
        'PEAJE ADICIONAL': v('txtPeajeAdicionalConsol'), 'PEAJE BASE IMPONIBLE': v('txtPeajeBIConsol'),
        'LLANTA': v('txtLlantaConsol'), 'LAVADO': v('txtLavadoConsol'), 'BALANZA': v('txtBalanzaConsol'),
        'COCHERA': v('txtCocheraConsol'), 'OTROS': v('txtOtrosConsol'),
        'DOMINICAL       (S/.)': v('txtDominicalConsol'), 'FERIADO (S/.)         ': v('txtFeriadoConsol'),
        'BONO': v('txtBonoConsol'), 'BONO + DOM + FERIADO': v('txtBonoTotalConsol'),
        'TOTAL POR VIAJE': v('txtTotalViajeConsol'), 'DIFERENCIA (MONTO DEPOSITADO - T.VIAJE)': v('txtDiferenciaConsol'),
        'GL ESTIMADOS TRACTO': v('txtGLEstimadosTractoConsol'), 'GL TRACTO REAL': v('txtGLTractoRealConsol'),
        'DIFERENCIA TRACTO': v('txtDiferenciaTractoConsol'), 'PRECIO DE PETRÓLEO': v('txtPrecioPetroleoConsol'),
        'PETROLEO TRACTO': v('txtPetroleoTractoConsol'), 'PETROLEO TRACTO B.I': v('txtPetroleoTractoBIConsol'),
        'GL ESTIMADOS GENERADOR': v('txtGLEstimadosGeneradorConsol'), 'GL GENERADOR REAL': v('txtGLGeneradorRealConsol'),
        'DIFERENCIA GENERADOR': v('txtDiferenciaGeneradorConsol'),
        'TOTAL PETROLEO GENERADOR': v('txtPetroleoGeneradorConsol'), 'PETROLEO GENERADOR B.I': v('txtPetroleoGeneradorBIConsol'),
        'GL ADIC. TRACTO': v('txtGLAdicionalTractoConsol'), 'TOTAL ADIC. TRACTO': v('txtTotalAdicionalTracto'),
        'TOTAL ADIC. TRACTO B.I.': v('txtTotalAdicionalBITracto'), 'GL ADIC. GENSED': v('txtGLAdicionalGensetConsol'),
        'TOTAL ADIC. GENSED': v('txtTotalAdicionalGenerador'), 'TOTAL ADIC. GENSED B.I.': v('txtTotalAdicionalBIGenerador'),
        'KM INICIAL': v('txtKmInicialConsol'), 'KM FINAL': v('txtKmFinalConsol'),
        'N° GENERADOR': v('txtNumeroGeneradorConsol'), 'HOROMETRO GENSET INICIAL': v('txtHrInicialConsol'),
        'HOROMETRO GENSET FINAL': v('txtHrFinalConsol'),
        'COSTO POR VIAJE REALIZADO': v('txtCostoViajeRealizadoConsol'), 'COSTO POR VIAJE REALIZADO B.I.': v('txtCostoViajeRealizadoBI'),
        'ESTADO': estado
      };

      const resp = await llamarBackend('grabarConsolidado', {
        fechaServicio: v('txtFechaServicioConsol'),
        codigoServicio: v('txtCodigoServicioConsol') || undefined,
        filaServicioOrigen: self._filaServicioOrigen, estadoOrigen: self._estadoOrigen,
        datos: mapaColumnas
      });

      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      mostrarMensaje(resp.mensaje, 'exito');
      cerrarPanel();
    });

    calcularTodo();
  }
};
