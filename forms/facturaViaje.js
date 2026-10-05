/**
 * forms/facturaViaje.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmFacturaViaje.frm (VBA). Factura un viaje normal o
 * falso flete: venta en dólares/soles, IGV 18%, valor referencial (carga
 * efectiva y útil nominal), detracción (4% o 5.4%, elegible), estimación
 * resultante e importe facturado con descuento de detracción. Réplica
 * EXACTA de CalcularVenta, CalcularVRCargaEfectiva,
 * CalcularVRCargaUtilNominal, CalcularDetraccion y GenerarDetalleFacturacion.
 * -------------------------------------------------------------------------
 */
const FormFacturaViaje = {

  abrir: async function (fila, tipoFacturacionActual) {
    const datos = await llamarBackend('cargarDatosFacturaViaje', { fila: fila });
    if (!respuestaValida(datos)) { mostrarMensaje((datos && datos.mensaje) || 'No se pudo cargar la factura.', 'error'); return; }

    const fechaTxt = function (v) { return esc(formatoFecha(v, '')); };

    const html = `
      <input type="hidden" id="hidCodigoServicio" value="${esc(datos.codigoServicio)}">
      <input type="hidden" id="hidTipoFacturacionActual" value="${esc(tipoFacturacionActual)}">
      <div class="fila-campos">
        <div class="campo"><label>Booking</label><input id="txtBookingFact" value="${esc(datos.booking)}" disabled></div>
        <div class="campo"><label>Contenedor</label><input id="txtContenedorFact" value="${esc(datos.contenedor)}" disabled></div>
        <div class="campo"><label>Cliente</label><input id="txtClienteFact" value="${esc(datos.cliente)}" disabled></div>
        <div class="campo"><label>Fecha de servicio</label><input id="txtFechaServicioFact" value="${fechaTxt(datos.fechaServicio)}" disabled></div>
        <div class="campo"><label>Código de servicio</label><input id="txtCodigoServicioFact" value="${esc(datos.codigoServicio)}" disabled></div>
        <div class="campo"><label>Placa</label><input id="txtPlacaFact" value="${esc(datos.placa)}" disabled></div>
        <div class="campo"><label>Destino 1</label><input id="txtDestino1Fact" value="${esc(datos.destino1)}" disabled></div>
        <div class="campo"><label>Destino 2</label><input id="txtDestino2Fact" value="${esc(datos.destino2)}" disabled></div>
        <div class="campo"><label>Fecha de facturación</label><input id="txtFechaFacturacionFact" value="${fechaTxt(datos.fechaFacturacion)}" disabled></div>
        <div class="campo"><label>Mes de facturación</label><input id="txtMesFacturacionFact" value="${mesDeFecha(datos.fechaFacturacion)}" disabled></div>
        <div class="campo"><label>Mes de ejecución</label>
          <select id="cboMesEjecucionFact">${MESES.map(m=>`<option>${m}</option>`).join('')}</select>
        </div>
        <div class="campo"><label>N° de factura</label><input id="txtNumeroFacturaFact"></div>
        <div class="campo"><label>Tipo de cambio</label><input id="txtTipoCambioFact" value="${(datos.tipoCambio||0).toFixed(3)}" disabled></div>
        <div class="campo"><label>Venta en dólares ($)</label><input id="txtVentaDolaresFact" value="${(datos.ventaDolares||0).toFixed(2)}"></div>
        <div class="campo"><label>Sobreestadía ($)</label><input id="txtSobreestadiaFact" value="${(datos.sobreestadia||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>Venta en soles (S/)</label><input id="txtVentaSolesFact" disabled></div>
        <div class="campo"><label><input type="checkbox" id="chkCompraDolaresTerceroFact"> Compra dólares tercero ($)</label><input id="txtCompraDolaresTerceroFact" value="0.00" disabled></div>
        <div class="campo"><label><input type="checkbox" id="chkCompraSolesTerceroFact"> Compra soles tercero (S/)</label><input id="txtCompraSolesTerceroFact" value="0.00" disabled></div>
        <div class="campo"><label>Valor venta ($)</label><input id="txtValorVentaFact" disabled></div>
        <div class="campo"><label>IGV ($)</label><input id="txtIGVFact" disabled></div>
        <div class="campo"><label>Precio venta ($)</label><input id="txtPrecioVentaFact" disabled></div>
        <div class="campo"><label>Costo por viaje realizado B.I. (S/)</label><input id="txtCostoViajeRealizadoFact" value="${(datos.costoViajeRealizado||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>V.R. carga efectiva (S/)</label><input id="txtVRCargaEfectivaFact" value="${(datos.vrCargaEfectiva||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>V.R. carga útil nominal (S/)</label><input id="txtVRCargaUtilFact" value="${(datos.vrCargaUtil||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>% Detracción</label>
          <select id="cboPorcentajeDetraccionFact"><option value="4.00%">4.00%</option><option value="5.40%">5.40%</option></select>
        </div>
        <div class="campo"><label>Importe operación (S/)</label><input id="txtImporteOperacionFact" disabled></div>
        <div class="campo"><label>Detracción (S/)</label><input id="txtDetraccionFact" disabled></div>
        <div class="campo"><label>Estimación resultante (S/)</label><input id="txtEstimacionResultanteFact" disabled></div>
        <div class="campo"><label>Detracción ($)</label><input id="txtDetraccionDolarFact" disabled></div>
        <div class="campo"><label>Importe facturado dsct. detracción ($)</label><input id="txtImporteFacturadoFact" disabled></div>
      </div>
      <div class="campo"><label>Detalle de facturación</label><textarea id="txtDetalleFacturacionFact" rows="6" disabled></textarea></div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnInicioFact">Inicio</button>
        <button class="boton-primario" id="btnGrabarFact">Grabar</button>
      </div>`;

    abrirPanel('Facturar Viaje - ' + esc(tipoFacturacionActual), html, (raiz) => this._wire(raiz, datos));
  },

  _n: function (t) {
    if (t === null || t === undefined) return 0;
    let x = String(t).trim().replace(/S\//g,'').replace(/\$/g,'').replace(/\s/g,'');
    const n = parseFloat(x.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  },

  _wire: function (raiz, datos) {
    const self = this;

    function calcularVenta() {
      const ventaDolares = self._n(raiz.querySelector('#txtVentaDolaresFact').value);
      const sobreestadia = self._n(raiz.querySelector('#txtSobreestadiaFact').value);
      const tipoCambio = self._n(raiz.querySelector('#txtTipoCambioFact').value);
      if (tipoCambio <= 0) {
        ['#txtVentaSolesFact', '#txtValorVentaFact', '#txtIGVFact', '#txtPrecioVentaFact'].forEach(function (s) { raiz.querySelector(s).value = ''; });
        return;
      }

      const ventaSoles = (ventaDolares + sobreestadia) * tipoCambio;
      raiz.querySelector('#txtVentaSolesFact').value = 'S/ ' + ventaSoles.toFixed(2);
      // La sobreestadía también lleva IGV: valor venta = venta + sobreestadía.
      const valorVenta = ventaDolares + sobreestadia;
      raiz.querySelector('#txtValorVentaFact').value = '$ ' + valorVenta.toFixed(2);
      const igv = valorVenta * 0.18;
      raiz.querySelector('#txtIGVFact').value = '$ ' + igv.toFixed(2);
      raiz.querySelector('#txtPrecioVentaFact').value = '$ ' + (valorVenta + igv).toFixed(2);
    }

    // Solo vale la respuesta de la última consulta: si el usuario sigue escribiendo, las anteriores se descartan.
    let consultaDetraccion = 0;
    async function calcularDetraccion() {
      const miConsulta = ++consultaDetraccion;
      const campos = ['#txtImporteOperacionFact', '#txtDetraccionFact', '#txtEstimacionResultanteFact', '#txtDetraccionDolarFact', '#txtImporteFacturadoFact'];
      let resp;
      try {
        resp = await llamarBackend('calcularDetraccionFactura', {
          precioVenta: self._n(raiz.querySelector('#txtPrecioVentaFact').value),
          tipoCambio: self._n(raiz.querySelector('#txtTipoCambioFact').value),
          vrCargaEfectiva: self._n(raiz.querySelector('#txtVRCargaEfectivaFact').value),
          valorVenta: self._n(raiz.querySelector('#txtValorVentaFact').value),
          costoViaje: self._n(raiz.querySelector('#txtCostoViajeRealizadoFact').value),
          porcentaje: self._n(raiz.querySelector('#cboPorcentajeDetraccionFact').value.replace('%','')) / 100
        });
      } catch (e) {
        resp = null;
      }
      if (miConsulta !== consultaDetraccion || !document.body.contains(raiz)) return;
      if (!respuestaValida(resp) || typeof resp.importeOperacion !== 'number') {
        // Mejor campos vacíos que valores de otro monto: Grabar exige que estén calculados.
        campos.forEach(function (s) { raiz.querySelector(s).value = ''; });
        return;
      }
      raiz.querySelector('#txtImporteOperacionFact').value = 'S/ ' + resp.importeOperacion.toFixed(2);
      raiz.querySelector('#txtDetraccionFact').value = 'S/ ' + resp.detraccionSoles.toFixed(2);
      raiz.querySelector('#txtEstimacionResultanteFact').value = 'S/ ' + resp.estimacionResultante.toFixed(2);
      raiz.querySelector('#txtDetraccionDolarFact').value = '$ ' + resp.detraccionDolares.toFixed(2);
      raiz.querySelector('#txtImporteFacturadoFact').value = '$ ' + resp.importeFacturado.toFixed(2);
    }

    // Se espera 300 ms tras la última tecla para consultar; Grabar fuerza y espera el cálculo pendiente.
    let temporizadorDetraccion = null;
    let calculoPendiente = Promise.resolve();
    function programarDetraccion() {
      clearTimeout(temporizadorDetraccion);
      temporizadorDetraccion = setTimeout(function () { temporizadorDetraccion = null; calculoPendiente = calcularDetraccion(); }, 300);
    }
    async function asegurarDetraccion() {
      if (temporizadorDetraccion) {
        clearTimeout(temporizadorDetraccion);
        temporizadorDetraccion = null;
        calculoPendiente = calcularDetraccion();
      }
      await calculoPendiente;
    }

    async function generarDetalle() {
      const detalle = await llamarBackend('generarDetalleFacturacion', {
        booking: raiz.querySelector('#txtBookingFact').value, contenedor: raiz.querySelector('#txtContenedorFact').value,
        cliente: raiz.querySelector('#txtClienteFact').value, fechaServicio: raiz.querySelector('#txtFechaServicioFact').value,
        codigoServicio: raiz.querySelector('#txtCodigoServicioFact').value, placa: raiz.querySelector('#txtPlacaFact').value,
        destino1: raiz.querySelector('#txtDestino1Fact').value, destino2: raiz.querySelector('#txtDestino2Fact').value,
        vrCargaEfectiva: self._n(raiz.querySelector('#txtVRCargaEfectivaFact').value), vrCargaUtil: self._n(raiz.querySelector('#txtVRCargaUtilFact').value)
      });
      if (typeof detalle === 'string') raiz.querySelector('#txtDetalleFacturacionFact').value = detalle;
    }

    raiz.querySelector('#chkCompraDolaresTerceroFact').addEventListener('change', function () {
      raiz.querySelector('#txtCompraDolaresTerceroFact').disabled = !this.checked;
      if (!this.checked) raiz.querySelector('#txtCompraDolaresTerceroFact').value = '0.00';
    });
    raiz.querySelector('#chkCompraSolesTerceroFact').addEventListener('change', function () {
      raiz.querySelector('#txtCompraSolesTerceroFact').disabled = !this.checked;
      if (!this.checked) raiz.querySelector('#txtCompraSolesTerceroFact').value = '0.00';
    });

    raiz.querySelector('#txtVentaDolaresFact').addEventListener('input', function () { calcularVenta(); programarDetraccion(); });
    raiz.querySelector('#cboPorcentajeDetraccionFact').addEventListener('change', programarDetraccion);

    raiz.querySelector('#btnInicioFact').addEventListener('click', cerrarPanel);

    protegerClic(raiz.querySelector('#btnGrabarFact'), async function () {
      const numeroFactura = raiz.querySelector('#txtNumeroFacturaFact').value.trim();
      if (numeroFactura === '') { mostrarMensaje('Ingrese el número de factura.', 'error'); return; }
      if (self._n(raiz.querySelector('#txtVentaDolaresFact').value) <= 0) { mostrarMensaje('Ingrese la venta en dólares.', 'error'); return; }

      await asegurarDetraccion();
      if (!raiz.querySelector('#txtImporteFacturadoFact').value || !raiz.querySelector('#txtVentaSolesFact').value) {
        mostrarMensaje('No se pudo calcular la detracción ni los importes. Revise el tipo de cambio e intente de nuevo.', 'error');
        return;
      }

      const resp = await llamarBackend('grabarFacturaViaje', {
        booking: raiz.querySelector('#txtBookingFact').value, contenedor: raiz.querySelector('#txtContenedorFact').value,
        cliente: raiz.querySelector('#txtClienteFact').value, fechaServicio: raiz.querySelector('#txtFechaServicioFact').value,
        codigoServicio: raiz.querySelector('#hidCodigoServicio').value, placa: raiz.querySelector('#txtPlacaFact').value,
        destino1: raiz.querySelector('#txtDestino1Fact').value, destino2: raiz.querySelector('#txtDestino2Fact').value,
        fechaFacturacion: raiz.querySelector('#txtFechaFacturacionFact').value, mesFacturacion: raiz.querySelector('#txtMesFacturacionFact').value,
        mesEjecucion: raiz.querySelector('#cboMesEjecucionFact').value, numeroFactura: numeroFactura,
        tipoCambio: raiz.querySelector('#txtTipoCambioFact').value, ventaDolares: raiz.querySelector('#txtVentaDolaresFact').value,
        sobreestadia: raiz.querySelector('#txtSobreestadiaFact').value, ventaSoles: raiz.querySelector('#txtVentaSolesFact').value,
        compraDolaresTercero: raiz.querySelector('#txtCompraDolaresTerceroFact').value, compraSolesTercero: raiz.querySelector('#txtCompraSolesTerceroFact').value,
        valorVenta: raiz.querySelector('#txtValorVentaFact').value, igv: raiz.querySelector('#txtIGVFact').value,
        precioVenta: raiz.querySelector('#txtPrecioVentaFact').value, costoViajeRealizado: raiz.querySelector('#txtCostoViajeRealizadoFact').value,
        vrCargaEfectiva: raiz.querySelector('#txtVRCargaEfectivaFact').value, vrCargaUtil: raiz.querySelector('#txtVRCargaUtilFact').value,
        porcentajeDetraccion: raiz.querySelector('#cboPorcentajeDetraccionFact').value, importeOperacion: raiz.querySelector('#txtImporteOperacionFact').value,
        detraccionSoles: raiz.querySelector('#txtDetraccionFact').value, estimacionResultante: raiz.querySelector('#txtEstimacionResultanteFact').value,
        detraccionDolares: raiz.querySelector('#txtDetraccionDolarFact').value, importeFacturado: raiz.querySelector('#txtImporteFacturadoFact').value,
        tipoFacturacionActual: raiz.querySelector('#hidTipoFacturacionActual').value
      });

      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      mostrarMensaje(resp.mensaje, 'exito');
      cerrarPanel();
    });

    calcularVenta();
    calcularDetraccion().then(generarDetalle);
  }
};
