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

    const puntosHtml = (datos.puntosMtc || []).map(function (p) {
      const etiqueta = p.p + ' — ' + (p.t === 'VIAJE' ? 'S/ ' + p.v.toFixed(2) + ' por viaje' : p.km.toFixed(0) + ' km · S/ ' + p.v.toFixed(2) + ' x TM');
      return '<option value="' + esc(p.p) + '"' + (p.p === datos.puntoMtc ? ' selected' : '') + '>' + esc(etiqueta) + '</option>';
    }).join('');
    const ruta = [datos.destino1, datos.destino2].filter(function (x) { return x && String(x).trim() !== '' && String(x).trim() !== '-'; }).map(esc).join(' → ');
    const html = `
      <style>
        .panel-modal.panel-fact { max-width: min(1250px, 96vw); }
        .panel-fact .panel-body { padding: 16px 20px 0; }
        .panel-fact .cab { display: flex; flex-wrap: wrap; gap: 6px 18px; background: #f1f5f9; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; font-size: .84rem; color: #334155; }
        .panel-fact .cab b { color: #1c3a5e; }
        .panel-fact .cab .ruta { font-weight: 700; color: #1c3a5e; font-size: .95rem; width: 100%; }
        .panel-fact .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 14px; }
        .panel-fact .seg { border: 1px solid #dbe2ea; border-radius: 10px; margin: 0 0 14px; background: #fff; overflow: hidden; }
        .panel-fact .seg-tit { background: #eef3f8; color: #1c3a5e; font-weight: 700; font-size: .78rem; letter-spacing: .4px; text-transform: uppercase; padding: 8px 14px; border-bottom: 1px solid #dbe2ea; display: flex; align-items: center; gap: 8px; }
        .panel-fact .seg-num { background: #1c3a5e; color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: .7rem; }
        .panel-fact .seg.destacado { border: 2px solid #1c3a5e; }
        .panel-fact .seg.destacado .seg-tit { background: #1c3a5e; color: #fff; }
        .panel-fact .seg.destacado .seg-num { background: #fff; color: #1c3a5e; }
        .panel-fact .g { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 12px; padding: 12px 14px 2px; }
        .panel-fact .campo { margin-bottom: 10px; }
        .panel-fact .campo label { font-size: .76rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .panel-fact .campo input, .panel-fact .campo select, .panel-fact textarea { padding: 7px 9px; font-size: .86rem; }
        .panel-fact .campo input:disabled { background: #f1f5f9; color: #1c3a5e; font-weight: 700; border-color: #e2e8f0; }
        .panel-fact .chk-lbl { display: flex !important; align-items: center; gap: 6px; }
        .panel-fact .chk-lbl input { width: auto !important; margin: 0; }
        .panel-fact .nota-mtc { font-size: .74rem; color: #64748b; margin-top: 3px; }
        .panel-fact .aviso-tc { grid-column: 1 / -1; background: #fef3c7; color: #92400e; border-radius: 8px; padding: 8px 12px; font-weight: 600; font-size: .85rem; margin-bottom: 10px; }
        .panel-fact .facturas { padding: 12px 14px 4px; }
        .panel-fact .fila-fac { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .panel-fact .fila-fac span { font-size: .78rem; font-weight: 700; color: #64748b; width: 22px; }
        .panel-fact .fila-fac input { flex: 1; padding: 9px 11px; border: 1.5px solid #c7ced8; border-radius: 8px; font-size: 1rem; font-weight: 700; text-transform: uppercase; font-family: inherit; }
        .panel-fact .fila-fac input.falta { border-color: #dc2626; background: #fef2f2; }
        .panel-fact .btn-quitar { border: none; background: transparent; color: #b91c1c; font-size: 1.2rem; cursor: pointer; padding: 0 6px; }
        .panel-fact .btn-agregar { border: 1.5px dashed #94a3b8; background: #f8fafc; color: #1c3a5e; border-radius: 8px; font-size: .8rem; font-weight: 700; padding: 6px 12px; cursor: pointer; margin-bottom: 10px; }
        .panel-fact .btn-agregar:hover { border-color: #1c3a5e; background: #eef3f8; }
        .panel-fact textarea { width: 100%; border: 1.5px solid #e2e8f0; border-radius: 8px; background: #f8fafc; font-family: inherit; resize: vertical; }
        .panel-fact .det { padding: 12px 14px; }
        .panel-fact .pie { position: sticky; bottom: 0; background: #fff; margin: 0 -20px; padding: 10px 20px; box-shadow: 0 -2px 10px rgba(0,0,0,.08); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .panel-fact .tot { display: flex; flex-direction: column; background: #f1f5f9; border-radius: 8px; padding: 5px 12px; min-width: 130px; }
        .panel-fact .tot span { font-size: .68rem; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: .3px; }
        .panel-fact .tot b { font-size: 1rem; color: #1c3a5e; }
        .panel-fact .tot.prin { background: #dcfce7; } .panel-fact .tot.prin b { color: #166534; }
        .panel-fact .pie .esp { flex: 1; }
        @media (max-width: 1000px) { .panel-fact .cols { grid-template-columns: 1fr; } }
        @media (max-width: 640px) { .panel-fact .g { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      </style>
      <input type="hidden" id="hidCodigoServicio" value="${esc(datos.codigoServicio)}">
      <input type="hidden" id="hidTipoFacturacionActual" value="${esc(tipoFacturacionActual)}">
      <!-- Datos del servicio (se usan en el detalle y al grabar) -->
      <input type="hidden" id="txtBookingFact" value="${esc(datos.booking)}">
      <input type="hidden" id="txtContenedorFact" value="${esc(datos.contenedor)}">
      <input type="hidden" id="txtClienteFact" value="${esc(datos.cliente)}">
      <input type="hidden" id="txtClienteGuiaFact" value="${esc(datos.clienteGuia || datos.cliente)}">
      <input type="hidden" id="txtFechaServicioFact" value="${fechaTxt(datos.fechaServicio)}">
      <input type="hidden" id="txtCodigoServicioFact" value="${esc(datos.codigoServicio)}">
      <input type="hidden" id="txtPlacaFact" value="${esc(datos.placa)}">
      <input type="hidden" id="txtDestino1Fact" value="${esc(datos.destino1)}">
      <input type="hidden" id="txtDestino2Fact" value="${esc(datos.destino2)}">
      <input type="hidden" id="txtVentaDolaresFact" value="${(datos.ventaDolares||0).toFixed(2)}">
      <input type="hidden" id="txtSobreestadiaFact" value="0">

      <div class="cab">
        <span class="ruta">${ruta || '-'}</span>
        <span>Cliente: <b>${esc(datos.cliente || '-')}</b></span>
        <span>Cliente guía (GRE): <b>${esc(datos.clienteGuia || datos.cliente || '-')}</b></span>
        <span>Booking: <b>${esc(datos.booking || '-')}</b></span>
        <span>Contenedor: <b>${esc(datos.contenedor || '-')}</b></span>
        <span>Fecha servicio: <b>${fechaTxt(datos.fechaServicio) || '-'}</b></span>
        <span>Código: <b>${esc(datos.codigoServicio || '-')}</b></span>
        <span>Placa: <b>${esc(datos.placa || '-')}</b></span>
        <span>Venta: <b>$ ${(datos.ventaDolares||0).toFixed(2)}</b></span>
      </div>

      <div class="cols">
        <div>
          <div class="seg">
            <div class="seg-tit"><span class="seg-num">1</span> Fecha y tipo de cambio</div>
            <div class="g">
              <div class="campo"><label>Fecha de facturación</label><input id="txtFechaFacturacionFact" value="${fechaTxt(datos.fechaFacturacion)}" placeholder="dd/mm/aaaa" autocomplete="off"></div>
              <div class="campo"><label>Mes de facturación</label><input id="txtMesFacturacionFact" value="${mesDeFecha(datos.fechaFacturacion)}" disabled></div>
              <div class="campo"><label>Tipo de cambio (de la fecha)</label><input id="txtTipoCambioFact" value="${datos.tipoCambio > 0 ? Number(datos.tipoCambio).toFixed(3) : ''}" disabled></div>
              <div class="aviso-tc" id="avisoTipoCambioFact" style="${datos.tipoCambio > 0 ? 'display:none;' : ''}">No hay tipo de cambio registrado para la fecha de facturación. Regístrelo en el módulo Tipo de cambio antes de facturar.</div>
            </div>
          </div>
          <div class="seg">
            <div class="seg-tit"><span class="seg-num">2</span> Venta</div>
            <div class="g">
              <div class="campo"><label>Valor venta ($)</label><input id="txtValorVentaFact" disabled></div>
              <div class="campo"><label>IGV 18% ($)</label><input id="txtIGVFact" disabled></div>
              <div class="campo"><label>Precio venta ($)</label><input id="txtPrecioVentaFact" disabled></div>
              <div class="campo"><label>Venta en soles (S/)</label><input id="txtVentaSolesFact" disabled></div>
              <div class="campo"><label class="chk-lbl"><input type="checkbox" id="chkCompraDolaresTerceroFact"> Compra tercero ($)</label><input id="txtCompraDolaresTerceroFact" value="0.00" disabled></div>
              <div class="campo"><label class="chk-lbl"><input type="checkbox" id="chkCompraSolesTerceroFact"> Compra tercero (S/)</label><input id="txtCompraSolesTerceroFact" value="0.00" disabled></div>
            </div>
          </div>
        </div>
        <div>
          <div class="seg">
            <div class="seg-tit"><span class="seg-num">3</span> Detracción <span style="margin-left:auto;text-transform:none;letter-spacing:0;font-weight:500;color:#64748b">DS 022-2025-MTC</span></div>
            <div class="g">
              <div class="campo" style="grid-column:1 / -1"><label>Punto MTC para el destino <b>${esc(datos.destino1 || '-')}</b> *</label>
                <select id="cboPuntoMtcFact"><option value="">— Elige el punto de la tabla del MTC —</option>${puntosHtml}</select>
                <div class="nota-mtc" id="notaPuntoMtcFact">${datos.puntoMtcRecordado ? 'Elegido en una facturación anterior de este destino.' : (datos.puntoMtc ? 'Propuesto por el nombre del destino: revísalo. Se recordará al grabar.' : 'Elige el punto más cercano a tu destino. Se recordará para las próximas facturas.')}</div>
              </div>
              <div class="campo"><label>Km (desde Lima)</label><input id="txtKmMtcFact" disabled></div>
              <div class="campo"><label id="lblValorMtcFact">S/ por TM (MTC)</label><input id="txtValorMtcFact" disabled></div>
              <div class="campo"><label>Factor (1.4 si &gt; 200 km)</label><input id="txtFactorMtcFact" disabled></div>
              <div class="campo"><label>Carga efectiva (TM) *</label><input id="txtCargaEfectivaFact" value="${datos.pesoBrutoTotal > 0 ? (datos.pesoBrutoTotal / 1000).toFixed(2) : ''}" disabled></div>
              <div class="campo"><label>Carga útil nominal (TM)</label><input id="txtCargaNominalFact" value="${Number(datos.cargaNominal || 30).toFixed(2)}" disabled></div>
              <div class="campo"><label>70% carga nominal (TM)</label><input id="txtCargaNominal70Fact" disabled></div>
              <div class="campo"><label>V.R. carga efectiva (S/)</label><input id="txtVRCargaEfectivaFact" disabled></div>
              <div class="campo"><label>V.R. carga útil nominal (S/)</label><input id="txtVRCargaUtilFact" disabled></div>
              <div class="campo"><label>Valor referencial (el mayor)</label><input id="txtValorReferencialFact" disabled></div>
              <div class="aviso-tc" id="avisoPesoFact" style="${datos.pesoBrutoTotal > 0 ? 'display:none;' : ''}">El consolidado no tiene el peso bruto de las guías. Complétalo en Consolidado de servicios (Revisar) antes de facturar.</div>
              <div class="campo"><label>Costo viaje realizado B.I. (S/)</label><input id="txtCostoViajeRealizadoFact" value="${(datos.costoViajeRealizado||0).toFixed(2)}" disabled></div>
              <div class="campo"><label>% Detracción</label>
                <select id="cboPorcentajeDetraccionFact"><option value="4.00%">4.00%</option><option value="12.00%">12.00%</option></select>
              </div>
              <div class="campo"><label>Importe operación (S/)</label><input id="txtImporteOperacionFact" disabled></div>
              <div class="campo"><label>Detracción (S/)</label><input id="txtDetraccionFact" disabled></div>
              <div class="campo"><label>Estimación resultante (S/)</label><input id="txtEstimacionResultanteFact" disabled></div>
              <div class="campo"><label>Detracción ($)</label><input id="txtDetraccionDolarFact" disabled></div>
              <div class="campo"><label>Importe fact. dsct. detracción ($)</label><input id="txtImporteFacturadoFact" disabled></div>
            </div>
          </div>
        </div>
      </div>

      <div class="seg destacado">
        <div class="seg-tit"><span class="seg-num">4</span> Cliente y N° de factura</div>
        <div class="g" style="padding-bottom:0">
          <div class="campo"><label>RUC del cliente</label><input id="txtRucClienteFact" value="${esc(datos.rucCliente || '')}" disabled></div>
          <div class="campo" style="grid-column:span 2"><label>Razón social</label><input id="txtRazonSocialFact" value="${esc(datos.razonSocialCliente || '')}" disabled></div>
          <div class="campo" style="grid-column:1 / -1"><label>G.R. Cliente (GRE)</label><input id="txtGRClienteFact" value="${esc(datos.grCliente || '')}" disabled></div>
          <div class="aviso-tc" id="avisoClienteFact" style="${datos.rucCliente ? 'display:none;' : ''}">El cliente ${esc(datos.cliente || '')} no está en el maestro de clientes. Regístralo en Maestros &gt; Clientes (código, razón social y RUC) y vuelve a abrir esta factura.</div>
        </div>
        <div class="facturas">
          <div id="listaFacturasFact"></div>
          <button type="button" class="btn-agregar" id="btnAgregarFacturaFact">+ Agregar otra factura</button>
        </div>
      </div>

      <div class="seg">
        <div class="seg-tit"><span class="seg-num">5</span> Detalle de facturación</div>
        <div class="det"><textarea id="txtDetalleFacturacionFact" rows="7" readonly></textarea></div>
      </div>

      <div class="pie">
        <div class="tot"><span>Precio venta</span><b id="totPrecioVentaFact">-</b></div>
        <div class="tot"><span>Detracción</span><b id="totDetraccionFact">-</b></div>
        <div class="tot prin"><span>Importe facturado</span><b id="totImporteFact">-</b></div>
        <div class="esp"></div>
        <button class="boton-secundario" id="btnInicioFact">Inicio</button>
        <button class="boton-primario" id="btnGrabarFact">Grabar</button>
      </div>`;

    abrirPanel('Facturar viaje - ' + esc(tipoFacturacionActual), html, (raiz) => this._wire(raiz, datos), { clase: 'panel-fact' });
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
      const sobreestadia = 0; // La sobreestadía se factura aparte (factura de sobrecosto).
      const tipoCambio = self._n(raiz.querySelector('#txtTipoCambioFact').value);
      if (tipoCambio <= 0) {
        ['#txtVentaSolesFact', '#txtValorVentaFact', '#txtIGVFact', '#txtPrecioVentaFact'].forEach(function (s) { raiz.querySelector(s).value = ''; });
        pintarTotales();
        return;
      }

      const ventaSoles = (ventaDolares + sobreestadia) * tipoCambio;
      raiz.querySelector('#txtVentaSolesFact').value = 'S/ ' + ventaSoles.toFixed(2);
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
          vrCargaEfectiva: mtc.vr,
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
        pintarTotales();
        return;
      }
      raiz.querySelector('#txtImporteOperacionFact').value = 'S/ ' + resp.importeOperacion.toFixed(2);
      raiz.querySelector('#txtDetraccionFact').value = 'S/ ' + resp.detraccionSoles.toFixed(2);
      raiz.querySelector('#txtEstimacionResultanteFact').value = 'S/ ' + resp.estimacionResultante.toFixed(2);
      raiz.querySelector('#txtDetraccionDolarFact').value = '$ ' + resp.detraccionDolares.toFixed(2);
      raiz.querySelector('#txtImporteFacturadoFact').value = '$ ' + resp.importeFacturado.toFixed(2);
      pintarTotales();
    }

    function pintarTotales() {
      const val = function (id) { return raiz.querySelector('#' + id).value || '-'; };
      raiz.querySelector('#totPrecioVentaFact').textContent = val('txtPrecioVentaFact');
      raiz.querySelector('#totDetraccionFact').textContent = val('txtDetraccionDolarFact');
      raiz.querySelector('#totImporteFact').textContent = val('txtImporteFacturadoFact');
    }

    /* ---- Valor referencial MTC (DS 022-2025-MTC) ---- */
    // Peso = el mayor entre la carga efectiva y el 70% de la carga nominal;
    // x S/ por TM del MTC; x 1.4 solo si el destino está a más de 200 km.
    // Puntos del Callao (Anexo I): valor fijo por viaje (contenedor lleno).
    const puntosMtc = datos.puntosMtc || [];
    let mtc = { punto: '', km: 0, valor: 0, factor: 0, ce: 0, cn: 0, vrEf: 0, vrNom: 0, vr: 0 };
    function calcularMtc() {
      const p = puntosMtc.find(function (x) { return x.p === raiz.querySelector('#cboPuntoMtcFact').value; });
      const ce = self._n(raiz.querySelector('#txtCargaEfectivaFact').value);
      const cn = self._n(raiz.querySelector('#txtCargaNominalFact').value);
      const f2 = function (n) { return n ? Number(n).toFixed(2) : ''; };
      raiz.querySelector('#txtCargaNominal70Fact').value = f2(cn * 0.7);
      if (!p) {
        mtc = { punto: '', km: 0, valor: 0, factor: 0, ce: ce, cn: cn, vrEf: 0, vrNom: 0, vr: 0 };
        ['#txtKmMtcFact', '#txtValorMtcFact', '#txtFactorMtcFact', '#txtVRCargaEfectivaFact', '#txtVRCargaUtilFact', '#txtValorReferencialFact']
          .forEach(function (sel) { raiz.querySelector(sel).value = ''; });
        return;
      }
      let factor, vrEf, vrNom;
      if (p.t === 'VIAJE') {
        factor = 1; vrEf = p.v; vrNom = p.v;
        raiz.querySelector('#lblValorMtcFact').textContent = 'S/ por viaje (MTC)';
      } else {
        factor = p.km > 200 ? 1.4 : 1;
        vrEf = ce * p.v * factor;
        vrNom = cn * 0.7 * p.v * factor;
        raiz.querySelector('#lblValorMtcFact').textContent = 'S/ por TM (MTC)';
      }
      const vr = Math.max(vrEf, vrNom);
      mtc = { punto: p.p, km: p.km, valor: p.v, factor: factor, ce: ce, cn: cn, vrEf: vrEf, vrNom: vrNom, vr: vr };
      raiz.querySelector('#txtKmMtcFact').value = p.km ? p.km.toFixed(2) + ' km' : '-';
      raiz.querySelector('#txtValorMtcFact').value = 'S/ ' + p.v.toFixed(2);
      raiz.querySelector('#txtFactorMtcFact').value = factor.toFixed(1);
      raiz.querySelector('#txtVRCargaEfectivaFact').value = 'S/ ' + vrEf.toFixed(2);
      raiz.querySelector('#txtVRCargaUtilFact').value = 'S/ ' + vrNom.toFixed(2);
      raiz.querySelector('#txtValorReferencialFact').value = 'S/ ' + vr.toFixed(2);
    }
    raiz.querySelector('#cboPuntoMtcFact').addEventListener('change', function () {
      raiz.querySelector('#notaPuntoMtcFact').textContent = this.value ? 'Se recordará para las próximas facturas de este destino.' : 'Elige el punto más cercano a tu destino.';
      calcularMtc(); programarDetraccion();
    });
    calcularMtc();

    /* ---- N° de factura: una o varias ---- */
    const listaFacturas = raiz.querySelector('#listaFacturasFact');
    function renumerarFacturas() {
      const filas = listaFacturas.querySelectorAll('.fila-fac');
      filas.forEach(function (f, i) {
        f.querySelector('span').textContent = (i + 1) + '.';
        f.querySelector('.btn-quitar').style.visibility = filas.length > 1 ? 'visible' : 'hidden';
      });
    }
    function agregarFactura() {
      const f = document.createElement('div');
      f.className = 'fila-fac';
      f.innerHTML = '<span></span><input class="num-fac" autocomplete="off" placeholder="Ej.: F001-000123"><button type="button" class="btn-quitar" title="Quitar">×</button>';
      f.querySelector('.btn-quitar').addEventListener('click', function () { f.remove(); renumerarFacturas(); });
      f.querySelector('input').addEventListener('input', function () { this.classList.remove('falta'); });
      listaFacturas.appendChild(f);
      renumerarFacturas();
      return f.querySelector('input');
    }
    function leerFacturas() {
      return Array.from(listaFacturas.querySelectorAll('.num-fac')).map(function (i) { return i.value.trim().toUpperCase(); }).filter(Boolean);
    }
    raiz.querySelector('#btnAgregarFacturaFact').addEventListener('click', function () { agregarFactura().focus(); });
    agregarFactura();

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

    function generarDetalle() {
      const v = function (id) { return raiz.querySelector('#' + id).value; };
      raiz.querySelector('#txtDetalleFacturacionFact').value =
        'POR LOS SERVICIOS DE FLETE Y FRIO\n' +
        'BOOKING: ' + v('txtBookingFact') + '\n' +
        'CONTENEDOR: ' + v('txtContenedorFact') + '\n' +
        'CLIENTE: ' + v('txtClienteGuiaFact') + '\n' +
        'FECHA DE SERVICIO: ' + v('txtFechaServicioFact') + '\n' +
        'CODIGO: ' + v('txtCodigoServicioFact') + '\n' +
        'PLACA: ' + v('txtPlacaFact');
    }

    // Tipo de cambio de la fecha de facturación (obligatorio para grabar).
    async function cargarTipoCambio() {
      const campoFecha = raiz.querySelector('#txtFechaFacturacionFact');
      const d = _aFecha(campoFecha.value.trim());
      const aviso = raiz.querySelector('#avisoTipoCambioFact');
      raiz.querySelector('#txtMesFacturacionFact').value = d ? MESES[d.getMonth() + 1] : '';
      if (!d) {
        raiz.querySelector('#txtTipoCambioFact').value = '';
        aviso.textContent = 'Escriba la fecha de facturación como dd/mm/aaaa.';
        aviso.style.display = '';
        calcularVenta(); programarDetraccion();
        return;
      }
      campoFecha.value = formatoFecha(d);
      const r = await llamarBackend('tipoCambioDeFecha', { fecha: campoFecha.value });
      if (r && r.ok && r.tipoCambio > 0) {
        raiz.querySelector('#txtTipoCambioFact').value = Number(r.tipoCambio).toFixed(3);
        aviso.style.display = 'none';
      } else {
        raiz.querySelector('#txtTipoCambioFact').value = '';
        aviso.textContent = (r && r.mensaje) || 'No hay tipo de cambio registrado para esa fecha.';
        aviso.style.display = '';
      }
      calcularVenta(); programarDetraccion();
    }
    raiz.querySelector('#txtFechaFacturacionFact').addEventListener('change', cargarTipoCambio);

    raiz.querySelector('#chkCompraDolaresTerceroFact').addEventListener('change', function () {
      raiz.querySelector('#txtCompraDolaresTerceroFact').disabled = !this.checked;
      if (!this.checked) raiz.querySelector('#txtCompraDolaresTerceroFact').value = '0.00';
    });
    raiz.querySelector('#chkCompraSolesTerceroFact').addEventListener('change', function () {
      raiz.querySelector('#txtCompraSolesTerceroFact').disabled = !this.checked;
      if (!this.checked) raiz.querySelector('#txtCompraSolesTerceroFact').value = '0.00';
    });

    raiz.querySelector('#cboPorcentajeDetraccionFact').addEventListener('change', programarDetraccion);

    raiz.querySelector('#btnInicioFact').addEventListener('click', cerrarPanel);

    protegerClic(raiz.querySelector('#btnGrabarFact'), async function () {
      const facturas = leerFacturas();
      if (!facturas.length) {
        const primera = listaFacturas.querySelector('.num-fac');
        if (primera) { primera.classList.add('falta'); primera.focus(); }
        mostrarMensaje('Ingrese el número de factura.', 'error');
        return;
      }
      if (new Set(facturas).size !== facturas.length) { mostrarMensaje('Hay un número de factura repetido.', 'error'); return; }
      // Varias facturas del mismo viaje se guardan juntas: "F001-1 / F001-2".
      const numeroFactura = facturas.join(' / ');
      if (!raiz.querySelector('#txtRucClienteFact').value || !raiz.querySelector('#txtRazonSocialFact').value) { mostrarMensaje('Falta el RUC y la razón social del cliente. Regístralo en Maestros > Clientes.', 'error'); return; }
      if (!raiz.querySelector('#txtGRClienteFact').value) { mostrarMensaje('El consolidado no tiene la G.R. Cliente (GRE). Complétala en Consolidado de servicios (Revisar).', 'error'); return; }
      if (!mtc.punto) { raiz.querySelector('#cboPuntoMtcFact').focus(); mostrarMensaje('Elige el punto del MTC para el destino.', 'error'); return; }
      if (!(mtc.ce > 0)) { mostrarMensaje('Falta la carga efectiva (peso bruto de las guías). Complétalo en el consolidado.', 'error'); return; }
      if (!raiz.querySelector('#txtFechaFacturacionFact').value.trim()) { mostrarMensaje('Escribe la fecha de facturación.', 'error'); return; }
      if (self._n(raiz.querySelector('#txtVentaDolaresFact').value) <= 0) { mostrarMensaje('El servicio no tiene tarifa (venta en dólares). Revise la tarifa en el consolidado.', 'error'); return; }
      if (self._n(raiz.querySelector('#txtTipoCambioFact').value) <= 0) { mostrarMensaje('No hay tipo de cambio para la fecha de facturación. Regístrelo en Tipo de cambio antes de facturar.', 'error'); return; }

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
        mesEjecucion: '', numeroFactura: numeroFactura,
        tipoCambio: raiz.querySelector('#txtTipoCambioFact').value, ventaDolares: raiz.querySelector('#txtVentaDolaresFact').value,
        sobreestadia: raiz.querySelector('#txtSobreestadiaFact').value, ventaSoles: raiz.querySelector('#txtVentaSolesFact').value,
        compraDolaresTercero: raiz.querySelector('#txtCompraDolaresTerceroFact').value, compraSolesTercero: raiz.querySelector('#txtCompraSolesTerceroFact').value,
        valorVenta: raiz.querySelector('#txtValorVentaFact').value, igv: raiz.querySelector('#txtIGVFact').value,
        precioVenta: raiz.querySelector('#txtPrecioVentaFact').value, costoViajeRealizado: raiz.querySelector('#txtCostoViajeRealizadoFact').value,
        vrCargaEfectiva: mtc.vrEf, vrCargaUtil: mtc.vrNom,
        grCliente: raiz.querySelector('#txtGRClienteFact').value,
        rucCliente: raiz.querySelector('#txtRucClienteFact').value, razonSocialCliente: raiz.querySelector('#txtRazonSocialFact').value,
        puntoMtc: mtc.punto, kmMtc: mtc.km, valorMtc: mtc.valor, factor: mtc.factor,
        cargaEfectiva: mtc.ce, cargaNominal: mtc.cn, valorReferencial: mtc.vr,
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
    generarDetalle();
    calcularDetraccion();
  }
};
