/**
 * forms/facturaBalanza.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmFacturaBalanza.frm (VBA). El importe de balanza
 * ya incluye IGV (Importe/1.18 = valor unitario), igual que
 * CargarDatosBalanza / btnGrabarBal_Click en el original.
 * -------------------------------------------------------------------------
 */
const FormFacturaBalanza = {

  abrir: async function (fila) {
    const datos = await llamarBackend('cargarDatosFacturaBalanza', { fila: fila });
    if (!datos) { mostrarMensaje('No se pudo cargar la factura de balanza.', 'error'); return; }

    const detalle = await llamarBackend('generarDetalleBalanza', datos);
    const meses = ['','ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    let mesFact = '';
    if (datos.fechaFacturacion) {
      const d = new Date(datos.fechaFacturacion);
      if (!isNaN(d.getTime())) mesFact = meses[d.getMonth() + 1];
    }

    const html = `
      <div class="fila-campos">
        <div class="campo"><label>Booking</label><input id="txtBookingBal" value="${datos.booking||''}" disabled></div>
        <div class="campo"><label>Contenedor</label><input id="txtContenedorBal" value="${datos.contenedor||''}" disabled></div>
        <div class="campo"><label>Cliente</label><input id="txtClienteBal" value="${datos.cliente||''}" disabled></div>
        <div class="campo"><label>Fecha de servicio</label><input id="txtFechaServicioBal" value="${datos.fechaServicio||'-'}" disabled></div>
        <div class="campo"><label>Código de servicio</label><input id="txtCodigoServicioBal" value="${datos.codigoServicio||''}" disabled></div>
        <div class="campo"><label>Placa</label><input id="txtPlacaBal" value="${datos.placa||''}" disabled></div>
        <div class="campo"><label>Fecha de facturación</label><input id="txtFechaFacturacionBal" value="${datos.fechaFacturacion||''}" disabled></div>
        <div class="campo"><label>Mes de facturación</label><input id="txtMesFacturacionBal" value="${mesFact}" disabled></div>
        <div class="campo"><label>Mes de ejecución</label>
          <select id="cboMesEjecucionBal"><option></option><option>ENERO</option><option>FEBRERO</option><option>MARZO</option><option>ABRIL</option>
          <option>MAYO</option><option>JUNIO</option><option>JULIO</option><option>AGOSTO</option><option>SEPTIEMBRE</option>
          <option>OCTUBRE</option><option>NOVIEMBRE</option><option>DICIEMBRE</option></select>
        </div>
        <div class="campo"><label>N° de factura</label><input id="txtNumeroFacturaBal"></div>
        <div class="campo"><label>V. Unitario (S/)</label><input id="txtVUnitarioBal" value="${(datos.vUnitario||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>IGV (S/)</label><input id="txtIGVBal" value="${(datos.igv||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>Importe (S/)</label><input id="txtImporteBal" value="${(datos.importe||0).toFixed(2)}" disabled></div>
      </div>
      <div class="campo"><label>Detalle de facturación</label><textarea id="txtDetalleFacturacionBal" rows="5" disabled>${detalle}</textarea></div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnInicioBal">Inicio</button>
        <button class="boton-primario" id="btnGrabarBal">Grabar</button>
      </div>`;

    abrirPanel('Facturar Balanza', html, (raiz) => this._wire(raiz, datos));
  },

  _wire: function (raiz, datos) {
    raiz.querySelector('#btnInicioBal').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnGrabarBal').addEventListener('click', async function () {
      const numeroFactura = raiz.querySelector('#txtNumeroFacturaBal').value.trim();
      if (numeroFactura === '') { mostrarMensaje('Ingrese el número de factura.', 'error'); return; }
      if (raiz.querySelector('#cboMesEjecucionBal').value.trim() === '') { mostrarMensaje('Seleccione el mes de ejecución.', 'error'); return; }

      const resp = await llamarBackend('grabarFacturaBalanza', {
        booking: datos.booking, contenedor: datos.contenedor, cliente: datos.cliente, fechaServicio: datos.fechaServicio,
        codigoServicio: datos.codigoServicio, placa: datos.placa,
        fechaFacturacion: raiz.querySelector('#txtFechaFacturacionBal').value, mesFacturacion: raiz.querySelector('#txtMesFacturacionBal').value,
        mesEjecucion: raiz.querySelector('#cboMesEjecucionBal').value, numeroFactura: numeroFactura,
        vUnitario: raiz.querySelector('#txtVUnitarioBal').value, igv: raiz.querySelector('#txtIGVBal').value,
        importe: raiz.querySelector('#txtImporteBal').value
      });

      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      mostrarMensaje(resp.mensaje, 'exito');
      cerrarPanel();
    });
  }
};
