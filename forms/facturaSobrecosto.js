/**
 * forms/facturaSobrecosto.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmFacturaSobrecosto.frm (VBA). Detracción fija de
 * 12% (a diferencia de frmFacturaViaje, que usa 4%/5.4% seleccionable),
 * igual que CargarDatosSobrecosto / btnGrabarSC_Click en el original.
 * -------------------------------------------------------------------------
 */
const FormFacturaSobrecosto = {

  abrir: async function (fila) {
    const datos = await llamarBackend('cargarDatosFacturaSobrecosto', { fila: fila });
    if (!datos) { mostrarMensaje('No se pudo cargar la factura de sobrecosto.', 'error'); return; }

    const detalle = await llamarBackend('generarDetalleSobrecosto', datos);

    const html = `
      <div class="fila-campos">
        <div class="campo"><label>Booking</label><input id="txtBookingSC" value="${datos.booking||''}" disabled></div>
        <div class="campo"><label>Contenedor</label><input id="txtContenedorSC" value="${datos.contenedor||''}" disabled></div>
        <div class="campo"><label>Cliente</label><input id="txtClienteSC" value="${datos.cliente||''}" disabled></div>
        <div class="campo"><label>Fecha de servicio</label><input id="txtFechaServicioSC" value="${datos.fechaServicio||'-'}" disabled></div>
        <div class="campo"><label>Código de servicio</label><input id="txtCodigoServicioSC" value="${datos.codigoServicio||''}" disabled></div>
        <div class="campo"><label>Placa</label><input id="txtPlacaSC" value="${datos.placa||''}" disabled></div>
        <div class="campo"><label>Tipo sobrecosto</label><input id="txtTipoSobrecostoSC" value="${datos.tipoSobrecosto||''}" disabled></div>
        <div class="campo"><label>Fecha de facturación</label><input id="txtFechaFacturacionSC" value="${datos.fechaFacturacion||''}" disabled></div>
        <div class="campo"><label>Mes de facturación</label><input id="txtMesFacturacionSC" disabled></div>
        <div class="campo"><label>Mes de ejecución</label>
          <select id="cboMesEjecucionSC"><option></option><option>ENERO</option><option>FEBRERO</option><option>MARZO</option><option>ABRIL</option>
          <option>MAYO</option><option>JUNIO</option><option>JULIO</option><option>AGOSTO</option><option>SEPTIEMBRE</option>
          <option>OCTUBRE</option><option>NOVIEMBRE</option><option>DICIEMBRE</option></select>
        </div>
        <div class="campo"><label>N° de factura</label><input id="txtNumeroFacturaSC"></div>
        <div class="campo"><label>Tipo de cambio</label><input id="txtTipoCambioSC" value="${(datos.tipoCambio||0).toFixed(3)}" disabled></div>
        <div class="campo"><label>V. Unitario ($)</label><input id="txtVUnitarioSC" value="${(datos.vUnitario||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>IGV ($)</label><input id="txtIGVSC" value="${(datos.igv||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>Importe ($)</label><input id="txtImporteSC" value="${(datos.importe||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>% Detracción</label><input id="txtPorcentajeDetraccionSC" value="12%" disabled></div>
        <div class="campo"><label>Detracción (S/)</label><input id="txtDetraccionSolesSC" value="${(datos.detraccionSoles||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>Detracción ($)</label><input id="txtDetraccionDolaresSC" value="${(datos.detraccionDolares||0).toFixed(2)}" disabled></div>
        <div class="campo"><label>Importe facturado ($)</label><input id="txtImporteFacturadoSC" value="${(datos.importeFacturado||0).toFixed(2)}" disabled></div>
      </div>
      <div class="campo"><label>Detalle de facturación</label><textarea id="txtDetalleFacturacionSC" rows="5" disabled>${detalle}</textarea></div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnInicioSC">Inicio</button>
        <button class="boton-primario" id="btnGrabarSC">Grabar</button>
      </div>`;

    abrirPanel('Facturar Sobrecosto', html, (raiz) => this._wire(raiz, datos));
  },

  _wire: function (raiz, datos) {
    raiz.querySelector('#btnInicioSC').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnGrabarSC').addEventListener('click', async function () {
      const numeroFactura = raiz.querySelector('#txtNumeroFacturaSC').value.trim();
      if (numeroFactura === '') { mostrarMensaje('Ingrese el número de factura.', 'error'); return; }
      if (raiz.querySelector('#cboMesEjecucionSC').value.trim() === '') { mostrarMensaje('Seleccione el mes de ejecución.', 'error'); return; }

      const resp = await llamarBackend('grabarFacturaSobrecosto', {
        tipoSobrecosto: datos.tipoSobrecosto, booking: datos.booking, contenedor: datos.contenedor, cliente: datos.cliente,
        fechaServicio: datos.fechaServicio, codigoServicio: datos.codigoServicio, placa: datos.placa,
        fechaFacturacion: raiz.querySelector('#txtFechaFacturacionSC').value, mesFacturacion: raiz.querySelector('#txtMesFacturacionSC').value,
        mesEjecucion: raiz.querySelector('#cboMesEjecucionSC').value, numeroFactura: numeroFactura,
        tipoCambio: raiz.querySelector('#txtTipoCambioSC').value, vUnitario: raiz.querySelector('#txtVUnitarioSC').value,
        igv: raiz.querySelector('#txtIGVSC').value, importe: raiz.querySelector('#txtImporteSC').value,
        porcentajeDetraccion: raiz.querySelector('#txtPorcentajeDetraccionSC').value,
        detraccionSoles: raiz.querySelector('#txtDetraccionSolesSC').value, detraccionDolares: raiz.querySelector('#txtDetraccionDolaresSC').value,
        importeFacturado: raiz.querySelector('#txtImporteFacturadoSC').value
      });

      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      mostrarMensaje(resp.mensaje, 'exito');
      cerrarPanel();
    });

    // Mes de facturación textual (a partir de la fecha ya calculada en backend).
    const meses = ['','ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    if (datos.fechaFacturacion) {
      const d = new Date(datos.fechaFacturacion);
      if (!isNaN(d.getTime())) raiz.querySelector('#txtMesFacturacionSC').value = meses[d.getMonth() + 1];
    }
  }
};
