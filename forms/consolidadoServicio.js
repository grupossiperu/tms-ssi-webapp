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
    if (!respuestaValida(servicio) || !servicio || typeof servicio !== 'object') {
      mostrarMensaje((servicio && servicio.mensaje) || 'No se pudo cargar el servicio.', 'error');
      return;
    }

    this._filaServicioOrigen = filaServicio;
    this._filaConsolidado = null;
    this._estadoOrigen = estadoOrigen;

    const s = function (k, porDefecto) {
      const v = servicio[k];
      return esc(v === null || v === undefined || v === '' ? (porDefecto === undefined ? '' : porDefecto) : v);
    };
    const destino2 = String(servicio['DESTINO 2'] || '').trim();
    const cantidadViajes = (destino2 !== '' && destino2 !== '-') ? 2 : 1;
    const fechaServicio = formatoFecha(servicio['FECHA DE PROGRAMACION'], '');
    const yaRegistrado = servicio['CONSOLIDADO REGISTRADO'] === true || String(servicio['CONSOLIDADO REGISTRADO']).toUpperCase() === 'TRUE';
    const req = ' <span class="req">*</span>';
    // Campo editable: c(etiqueta, id, valor, obligatorio, extraClase)
    const c = function (etq, id, valor, obligatorio, clase, bloqueado) {
      return '<div class="campo' + (clase ? ' ' + clase : '') + (bloqueado ? ' calc' : '') + '"><label for="' + id + '">' + etq + (obligatorio ? req : '') +
        '</label><input id="' + id + '" value="' + (valor === undefined ? '' : valor) + '" autocomplete="off"' + (bloqueado ? ' disabled' : '') + '></div>';
    };
    const tieneDestino2 = cantidadViajes === 2;
    // Campo calculado (solo lectura)
    const k = function (etq, id, clase) {
      return '<div class="campo calc' + (clase ? ' ' + clase : '') + '"><label for="' + id + '">' + etq + '</label><input id="' + id + '" disabled></div>';
    };

    const html = `
      <style>
        .panel-modal.panel-cons { max-width: min(1400px, 97vw); }
        .overlay-modal:has(.panel-cons) { padding: 16px 10px; }
        .panel-cons .panel-body { max-height: calc(100vh - 110px); padding: 16px 22px 0; background: #f6f8fb; }
        .panel-cons .cab { display: flex; flex-wrap: wrap; gap: 6px 22px; align-items: center; background: #fff; border: 1px solid #dbe2ea; border-left: 4px solid #1c3a5e; border-radius: 10px; padding: 10px 16px; margin-bottom: 14px; font-size: .85rem; color: #475569; }
        .panel-cons .cab b { color: #1c3a5e; }
        .panel-cons .cab .ruta { font-weight: 700; color: #1c3a5e; font-size: .95rem; }
        .panel-cons .aviso { background: #fef3c7; color: #92400e; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: .85rem; font-weight: 600; }
        .panel-cons .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 14px; }
        .panel-cons .seg { border: 1px solid #dbe2ea; border-radius: 10px; margin: 0 0 14px; background: #fff; overflow: hidden; }
        .panel-cons .seg-tit { background: #eef3f8; color: #1c3a5e; font-weight: 700; font-size: .78rem; letter-spacing: .4px; text-transform: uppercase; padding: 8px 14px; border-bottom: 1px solid #dbe2ea; display: flex; align-items: center; gap: 8px; }
        .panel-cons .seg-num { background: #1c3a5e; color: #fff; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: .7rem; }
        .panel-cons .seg-tit .nota { margin-left: auto; text-transform: none; letter-spacing: 0; font-weight: 500; color: #64748b; }
        .panel-cons .g { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 12px; padding: 12px 14px 2px; }
        .panel-cons .g.c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .panel-cons .g.c6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
        .panel-cons .span2 { grid-column: span 2; }
        .panel-cons .campo { margin-bottom: 10px; }
        .panel-cons .campo label { font-size: .76rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .panel-cons .campo input, .panel-cons .campo select { padding: 7px 9px; font-size: .86rem; }
        .panel-cons .campo.calc input { background: #f1f5f9; color: #1c3a5e; font-weight: 700; border-color: #e2e8f0; }
        .panel-cons .req { color: #dc2626; }
        .panel-cons .campo.falta input, .panel-cons .campo.falta select { border-color: #dc2626; background: #fef2f2; }
        .panel-cons .sub { grid-column: 1 / -1; font-size: .72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .4px; margin: 2px 0 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0; }
        .panel-cons .sub:first-child { border-top: none; padding-top: 0; }
        .panel-cons .pie { position: sticky; bottom: 0; background: #fff; margin: 0 -22px; padding: 10px 22px; box-shadow: 0 -2px 10px rgba(0,0,0,.08); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .panel-cons .tot { display: flex; flex-direction: column; background: #f1f5f9; border-radius: 8px; padding: 5px 12px; min-width: 130px; }
        .panel-cons .tot span { font-size: .68rem; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: .3px; }
        .panel-cons .tot b { font-size: 1rem; color: #1c3a5e; }
        .panel-cons .tot.pos { background: #dcfce7; } .panel-cons .tot.pos b { color: #166534; }
        .panel-cons .tot.neg { background: #fee2e2; } .panel-cons .tot.neg b { color: #991b1b; }
        .panel-cons .faltan { font-size: .8rem; font-weight: 600; color: #b91c1c; }
        .panel-cons .faltan.ok { color: #166534; }
        .panel-cons .pie .esp { flex: 1; }
        .panel-cons .campo.km-mal input { border-color: #dc2626; background: #fef2f2; }
        .panel-cons .lbl-btn { display: flex !important; justify-content: space-between; align-items: center; gap: 6px; }
        .panel-cons .btn-mini { border: 1px solid #1c3a5e; background: #fff; color: #1c3a5e; border-radius: 6px; font-size: .7rem; font-weight: 700; padding: 1px 8px; cursor: pointer; }
        .panel-cons .btn-mini:hover { background: #1c3a5e; color: #fff; }
        .panel-cons .btn-agregar { grid-column: 1 / -1; justify-self: start; border: 1.5px dashed #94a3b8; background: #f8fafc; color: #1c3a5e; border-radius: 8px; font-size: .8rem; font-weight: 700; padding: 6px 12px; cursor: pointer; margin-bottom: 10px; }
        .panel-cons .btn-agregar:hover { border-color: #1c3a5e; background: #eef3f8; }
        .panel-cons .tabla-mini { grid-column: 1 / -1; width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: .84rem; }
        .panel-cons .tabla-mini th { text-align: left; font-size: .72rem; color: #1c3a5e; font-weight: 700; padding: 0 6px 4px 0; }
        .panel-cons .tabla-mini td { padding: 0 6px 6px 0; vertical-align: middle; }
        .panel-cons .tabla-mini input, .panel-cons .tabla-mini select { width: 100%; padding: 7px 9px; border: 1.5px solid #c7ced8; border-radius: 8px; font-size: .86rem; font-family: inherit; background: #fff; }
        .panel-cons .tabla-mini .falta input { border-color: #dc2626; background: #fef2f2; }
        .panel-cons .tabla-mini .tot-celda { font-weight: 700; color: #1c3a5e; white-space: nowrap; }
        .panel-cons .btn-quitar { border: none; background: transparent; color: #b91c1c; font-size: 1.1rem; cursor: pointer; padding: 0 4px; }
        .panel-cons .btn-quitar:disabled { visibility: hidden; }
        .panel-cons .nota-campo { grid-column: 1 / -1; font-size: .76rem; color: #64748b; margin: -4px 0 10px; }
        .panel-cons .nota-campo.alerta { color: #b45309; font-weight: 600; }
        .panel-cons .lista-dep { grid-column: 1 / -1; font-size: .8rem; margin: -2px 0 10px; }
        .panel-cons .lista-dep div { display: flex; gap: 10px; padding: 3px 0; border-bottom: 1px dashed #e2e8f0; }
        .panel-cons .lista-dep .pend { color: #b45309; }
        @media (max-width: 1100px) { .panel-cons .cols { grid-template-columns: 1fr; } }
        @media (max-width: 700px) { .panel-cons .g, .panel-cons .g.c3, .panel-cons .g.c6 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .panel-cons .span2 { grid-column: auto; } }
      </style>

      <div class="cab">
        <span class="ruta">${s('DEPOSITO DE RETIRO', '-')} → ${s('DESTINO 1', '-')}${cantidadViajes === 2 ? ' → ' + esc(destino2) : ''} → ${s('DEPOSITO DE DEVOLUCION', '-')}</span>
        <span>Cliente: <b>${s('CLIENTE PARA FACTURACIÓN', '-')}</b></span>
        <span>Booking: <b>${s('BOOKING', '-')}</b></span>
        <span>Contenedor: <b>${s('N° CONTENEDOR', '-')}</b></span>
        <span>Conductor: <b>${s('CONDUCTOR', '-')}</b></span>
        <span>Fecha: <b>${esc(fechaServicio || '-')}</b></span>
      </div>
      <div class="aviso" id="avisoEdicionConsol" style="${yaRegistrado ? '' : 'display:none'}">Estás revisando un consolidado ya registrado: puedes corregir cualquier dato y al grabar se actualiza el mismo registro.</div>

      <div class="cols">
        <div>
          <div class="seg">
            <div class="seg-tit"><span class="seg-num">1</span> Servicio y cliente</div>
            <div class="g">
              ${c('Fecha del servicio', 'txtFechaServicioConsol', esc(fechaServicio), true)}
              ${k('Mes', 'txtMesConsol')}
              ${k('Semana', 'txtSemanaConsol')}
              <div class="campo"><label for="txtCodigoServicioConsol" class="lbl-btn"><span>Código${req}</span><button type="button" class="btn-mini" id="btnGenerarCodigoConsol" title="Día + mes + año + cliente + últimos 3 del booking">Generar</button></label><input id="txtCodigoServicioConsol" autocomplete="off" style="text-transform:uppercase"></div>
              ${c('Cliente para facturación', 'txtClienteFacturacionConsol', s('CLIENTE PARA FACTURACIÓN'), true, 'span2')}
              ${c('Empresa', 'txtEmpresaServicioConsol', s('EMPRESA QUE DIO EL SERVICIO'), true, 'span2')}
              ${c('Conductor', 'txtConductorConsol', s('CONDUCTOR'), true, 'span2')}
              ${c('Placa tracto', 'txtPlacaTractoConsol', s('PLACA TRACTO'), true)}
              ${c('Placa carreta', 'txtPlacaCarretaConsol', s('PLACA CARRETA'), true)}
            </div>
          </div>

          <div class="seg">
            <div class="seg-tit"><span class="seg-num">2</span> Carga, ruta y tarifa</div>
            <div class="g">
              ${c('Booking', 'txtBookingConsol', s('BOOKING'), true)}
              ${c('Contenedor', 'txtContenedorConsol', s('N° CONTENEDOR'), true)}
              ${c('Tipo de carga', 'txtTipoCargaConsol', s('TIPO DE CARGA'), true)}
              ${c('Cantidad de viajes', 'txtCantidadViajesConsol', cantidadViajes, true)}
              ${c('Tipo de producto', 'txtTipoProductoConsol', s('TIPO DE PRODUCTO'), true)}
              ${c('Tipo de tratamiento', 'txtTipoTratamientoConsol', s('TIPO DE TRATAMIENTO'), true, 'span2')}
              <div></div>
              ${c('Almacén de salida', 'txtAlmacenSalidaConsol', s('DEPOSITO DE RETIRO'), true)}
              ${c('Destino 1', 'txtDestino1Consol', s('DESTINO 1'), true)}
              ${c('Tarifa 1', 'txtTarifa1Consol', s('TARIFA 1'), true)}
              ${c('Almacén de llegada', 'txtAlmacenLlegadaConsol', s('DEPOSITO DE DEVOLUCION'), true)}
              ${c('Destinos adicionales', 'txtDestino2Consol', esc(destino2), false, 'span2', tieneDestino2)}
              ${c('Tarifa adicional', 'txtTarifa2Consol', s('TARIFA 2'), false, '', tieneDestino2)}
              ${k('Venta total por viaje', 'txtVentaTotalConsol')}
              ${tieneDestino2 ? '<div class="nota-campo">Los destinos adicionales y su tarifa vienen del registro del servicio.</div>' : ''}
            </div>
          </div>

          <div class="seg">
            <div class="seg-tit"><span class="seg-num">3</span> Documentos</div>
            <div class="g">
              ${c('N° de transferencia', 'txtNumeroTransferenciaConsol', '', true)}
              ${c('N° de viático', 'txtNumeroViaticoConsol', '', true)}
              ${c('Nombre de cliente de la guía (GRE)', 'txtClienteGuiaConsol', '', true, 'span2')}
              <div class="sub">Guías de remisión <span style="text-transform:none;font-weight:500">· por cada guía del cliente va una guía de transporte</span></div>
              <table class="tabla-mini" id="tablaGuiasConsol">
                <thead><tr><th>G.R. Transporte (GRT)${req}</th><th>G.R. Cliente (GRE)${req}</th><th style="width:150px">Peso bruto (kg)${req}</th><th style="width:28px"></th></tr></thead>
                <tbody></tbody>
              </table>
              <button type="button" class="btn-agregar" id="btnAgregarGuiaConsol" style="grid-column:span 2;align-self:center;">+ Agregar guía</button>
              <div></div>
              ${k('Peso bruto total (kg)', 'txtPesoBrutoTotalConsol')}
            </div>
          </div>

          <div class="seg">
            <div class="seg-tit"><span class="seg-num">4</span> Kilometraje y horómetro</div>
            <div class="g">
              ${c('KM inicial', 'txtKmInicialConsol', '', true)}
              ${c('KM final', 'txtKmFinalConsol', '', true)}
              <div class="campo calc"><label for="txtKmRecorridoConsol">KM recorridos</label><input id="txtKmRecorridoConsol" disabled></div>
              ${c('N° generador', 'txtNumeroGeneradorConsol', '', true)}
              ${c('Horómetro inicial', 'txtHrInicialConsol', '', true)}
              ${c('Horómetro final', 'txtHrFinalConsol', '', true)}
              <div class="campo calc"><label for="txtHrRecorridoConsol">Horas genset</label><input id="txtHrRecorridoConsol" disabled></div>
              <div class="nota-campo" id="notaKmConsol">Buscando el KM final del viaje anterior de este tracto…</div>
            </div>
          </div>
        </div>

        <div>
          <div class="seg">
            <div class="seg-tit"><span class="seg-num">5</span> Gastos del viaje (S/) <span class="nota">Lo depositado vs. lo gastado</span></div>
            <div class="g">
              ${c('Monto depositado', 'txtMontoDepositadoConsol', s('MONTO DEPOSITADO', 0), true)}
              ${k('Depósitos adicionales', 'txtDepAdicionalesConsol')}
              ${k('Total depositado', 'txtTotalDepositadoConsol', 'span2')}
              <div class="lista-dep" id="listaDepAdicConsol"><span style="color:#64748b">Buscando depósitos adicionales…</span></div>
              ${c('Viático', 'txtViaticoConsol', s('VIATICO', 0), true)}
              ${c('Peaje', 'txtPeajeConsol', s('PEAJE', 0), true)}
              ${k('Peaje base imponible', 'txtPeajeBIConsol')}
              <div></div>
              ${c('Peaje S.D.C.F.', 'txtPeajeSDCFConsol', 0, true)}
              ${c('Peaje adicional', 'txtPeajeAdicionalConsol', 0, true)}
              ${c('Cochera', 'txtCocheraConsol', s('COCHERA', 0), true)}
              ${c('Llanta', 'txtLlantaConsol', 0, true)}
              ${c('Lavado', 'txtLavadoConsol', 0, true)}
              ${c('Balanza', 'txtBalanzaConsol', 0, true)}
              ${c('Otros', 'txtOtrosConsol', 0, true)}
              <div></div>
              <div class="sub">Bonos del conductor</div>
              <div class="campo"><label for="cboDominicalConsol">¿Dominical?</label><select id="cboDominicalConsol"><option>NO</option><option>SI</option></select></div>
              <div class="campo calc"><label for="txtDominicalConsol">Dominical</label><input id="txtDominicalConsol" value="0" disabled></div>
              <div class="campo"><label for="cboFeriadoConsol">¿Feriado?</label><select id="cboFeriadoConsol"><option>NO</option><option>SI</option></select></div>
              <div class="campo calc"><label for="txtFeriadoConsol">Feriado</label><input id="txtFeriadoConsol" value="0" disabled></div>
              ${c('Bono', 'txtBonoConsol', 0, true)}
              ${k('Bono + Dom. + Feriado', 'txtBonoTotalConsol')}
              ${k('Total por viaje', 'txtTotalViajeConsol')}
              ${k('Diferencia', 'txtDiferenciaConsol')}
              ${k('Monto sustentado', 'txtSustentadoConsol', 'span2')}
              <div class="nota-campo span2" style="grid-column:span 2;margin:0;align-self:center" id="notaDiferenciaConsol"></div>
              <div class="nota-campo" id="notaBonoConsol"></div>
            </div>
          </div>

          <div class="seg">
            <div class="seg-tit"><span class="seg-num">6</span> Combustible <span class="nota">Abastecimiento: ${s('TIPO DE ABASTECIMIENTO', '-')}</span></div>
            <div class="g">
              <div class="sub">Estimado del servicio <span style="text-transform:none;font-weight:500">· viene del registro del servicio</span></div>
              ${k('GL estimados tracto', 'txtGLEstimadosTractoConsol')}
              ${k('GL estimados generador', 'txtGLEstimadosGeneradorConsol')}
              ${c('Precio petróleo (S/ x gl)', 'txtPrecioPetroleoConsol', s('COSTO DEL PETRÓLEO X GALÓN', 0), false, 'span2', true)}
              <div class="sub">Tracto</div>
              ${k('Petróleo inicial', 'txtPetroleoTractoConsol', 'span2')}
              ${k('Petróleo B.I.', 'txtPetroleoTractoBIConsol', 'span2')}
              <div class="sub">Generador (genset)</div>
              ${k('Petróleo inicial', 'txtPetroleoGeneradorConsol', 'span2')}
              ${k('Petróleo B.I.', 'txtPetroleoGeneradorBIConsol', 'span2')}
              <div class="sub">Recargas</div>
              <datalist id="dlGrifosConsol"></datalist>
              <table class="tabla-mini" id="tablaRecargasConsol" style="table-layout:fixed">
                <colgroup><col><col style="width:16%"><col style="width:13%"><col style="width:15%"><col style="width:10%"><col style="width:10%"><col style="width:12%"><col style="width:26px"></colgroup><thead><tr><th>Grifo${req}</th><th>N° nota de venta${req}</th><th>Equipo</th><th>Pagó</th><th>Galones</th><th>S/ x gl</th><th>Total</th><th></th></tr></thead>
                <tbody></tbody>
              </table>
              <button type="button" class="btn-agregar" id="btnAgregarRecargaConsol">+ Agregar recarga</button>
              <div class="nota-campo" id="resumenRecargasConsol">Sin recargas.</div>
              <!-- Campos internos: se siguen guardando en la hoja CONSOLIDADO. -->
              <input type="hidden" id="txtGLTractoRealConsol">
              <input type="hidden" id="txtGLGeneradorRealConsol">
              <input type="hidden" id="txtGLRecargaTractoVista">
              <input type="hidden" id="txtGLRecargaGensetVista">
              <input type="hidden" id="txtDiferenciaTractoConsol">
              <input type="hidden" id="txtDiferenciaGeneradorConsol">
              <input type="hidden" id="txtTotalAdicionalTracto">
              <input type="hidden" id="txtTotalAdicionalBITracto">
              <input type="hidden" id="txtTotalAdicionalGenerador">
              <input type="hidden" id="txtTotalAdicionalBIGenerador">
              <input type="hidden" id="txtPrecioGalonTractoConsol" value="0">
              <input type="hidden" id="txtGLAdicionalTractoConsol" value="0">
              <input type="hidden" id="txtPrecioGalonGensetConsol" value="0">
              <input type="hidden" id="txtGLAdicionalGensetConsol" value="0">
            </div>
          </div>

        </div>
      </div>

      <input type="hidden" id="txtCostoViajeRealizadoConsol">
      <input type="hidden" id="txtCostoViajeRealizadoBI">

      <div class="pie">
        <div class="tot"><span>Total por viaje</span><b id="pieTotalViaje">S/ 0.00</b></div>
        <div class="tot" title="Monto depositado + depósitos adicionales confirmados"><span>Monto depositado</span><b id="pieDepositado">S/ 0.00</b></div>
        <div class="tot"><span>Monto sustentado</span><b id="pieSustentado">S/ 0.00</b></div>
        <div class="tot" id="pieDifCaja"><span id="pieDifTitulo">Diferencia</span><b id="pieDiferencia">S/ 0.00</b></div>
        <span class="esp"></span>
        <span class="faltan" id="pieFaltan"></span>
        <button class="boton-secundario" id="btnInicioConsolidado">Cancelar</button>
        <button class="boton-primario" id="btnGrabarConsol">Grabar consolidado</button>
      </div>`;

    abrirPanel('Completar consolidado · ' + esc(estadoOrigen), html, (raiz) => this._wire(raiz, servicio), { clase: 'panel-cons' });
  },

  _n: function (t) {
    if (t === null || t === undefined) return 0;
    let x = String(t).trim().replace(/S\//g, '').replace(/\$/g, '').replace(/\s/g, '');
    if (x === '') return 0;
    const n = parseFloat(x.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  },

  _wire: function (raiz, servicio) {
    const self = this;
    servicio = servicio || {};
    const q = function (id) { return raiz.querySelector('#' + id); };
    const dinero = function (n) { return 'S/ ' + (Number(n) || 0).toFixed(2); };
    let depAdicionales = 0;
    let recargasTotal = 0, recargasConductor = 0;
    let depositosApoyo = [];
    function recalcularDepAdic() {
      depAdicionales = Array.from(raiz.querySelectorAll('.chk-dep-adic')).filter(function (c) { return c.checked; })
        .reduce(function (acc, c) { return acc + (Number((depositosApoyo[Number(c.dataset.i)] || {}).monto) || 0); }, 0);
    }
    function depositosSinConfirmar() {
      return Array.from(raiz.querySelectorAll('.chk-dep-adic')).filter(function (c) { return !c.checked; }).length;
    }
    raiz.querySelector('#txtGLEstimadosTractoConsol').value = servicio['GL TRACTO'] || 0;
    raiz.querySelector('#txtGLEstimadosGeneradorConsol').value = servicio['GL GENERADOR'] || 0;
    // El abastecimiento inicial es lo estimado al registrar el servicio; lo
    // que se cargue de más va como recarga.
    raiz.querySelector('#txtGLTractoRealConsol').value = servicio['GL TRACTO'] || 0;
    raiz.querySelector('#txtGLGeneradorRealConsol').value = servicio['GL GENERADOR'] || 0;

    // Campos obligatorios para un servicio CULMINADO.
    const OBLIGATORIOS = [
      'txtCodigoServicioConsol','txtClienteFacturacionConsol','txtCantidadViajesConsol','txtEmpresaServicioConsol',
      'txtConductorConsol','txtPlacaTractoConsol','txtPlacaCarretaConsol','txtTipoCargaConsol','txtDestino1Consol',
      'txtTarifa1Consol','txtAlmacenSalidaConsol','txtAlmacenLlegadaConsol',
      'txtFechaServicioConsol','txtMesConsol','txtTipoProductoConsol','txtTipoTratamientoConsol',
      'txtBookingConsol','txtContenedorConsol','txtSemanaConsol','txtMontoDepositadoConsol',
      'txtNumeroTransferenciaConsol','txtNumeroViaticoConsol','txtClienteGuiaConsol','txtGRTransporte1Consol','txtGRCliente1Consol',
      'txtViaticoConsol','txtPeajeConsol','txtCocheraConsol','txtGLEstimadosTractoConsol','txtGLTractoRealConsol',
      'txtPrecioPetroleoConsol','txtKmInicialConsol','txtKmFinalConsol','txtNumeroGeneradorConsol',
      'txtHrInicialConsol','txtHrFinalConsol','txtCostoViajeRealizadoConsol',
      'txtPeajeSDCFConsol','txtPeajeAdicionalConsol','txtLlantaConsol','txtLavadoConsol','txtBalanzaConsol','txtOtrosConsol','txtBonoConsol'
    ].concat(raiz.querySelector('#txtDestino2Consol').disabled ? [] : ['txtDestino2Consol', 'txtTarifa2Consol']);
    // Todos los datos son obligatorios, sea cual sea el estado del servicio.
    const esCulminado = true;
    let marcarFaltantes = false;

    function faltantes() {
      if (!esCulminado) return [];
      return OBLIGATORIOS.filter(function (id) { return raiz.querySelector('#' + id).value.trim() === ''; })
        .concat(guiasIncompletas().length ? ['__guias'] : [])
        .concat(recargasIncompletas().length ? ['__recargas'] : [])
        .concat(depositosSinConfirmar() ? ['__depositos'] : []);
    }
    function actualizarFaltantes() {
      const lista = faltantes();
      const aviso = raiz.querySelector('#pieFaltan');
      if (!esCulminado) { aviso.textContent = ''; }
      else if (lista.length) { aviso.textContent = 'Faltan ' + lista.length + ' campo' + (lista.length === 1 ? '' : 's') + ' obligatorio' + (lista.length === 1 ? '' : 's'); aviso.classList.remove('ok'); }
      else { aviso.textContent = 'Todo completo'; aviso.classList.add('ok'); }
      OBLIGATORIOS.forEach(function (id) {
        const campo = raiz.querySelector('#' + id).closest('.campo');
        if (campo) campo.classList.toggle('falta', marcarFaltantes && lista.indexOf(id) !== -1);
      });
      raiz.querySelectorAll('#tablaGuiasConsol td.req-celda').forEach(function (td) {
        const inp = td.querySelector('input');
        const vacio = inp.classList.contains('peso') ? !(self._n(inp.value) > 0) : inp.value.trim() === '';
        td.classList.toggle('falta', marcarFaltantes && vacio);
      });
      raiz.querySelectorAll('#tablaRecargasConsol tr.rec-fila').forEach(function (tr) {
        tr.querySelectorAll('td').forEach(function (td) { td.classList.remove('falta'); });
        if (!marcarFaltantes) return;
        ['lugar', 'nv'].forEach(function (cl) { const i = tr.querySelector('.' + cl); if (!i.value.trim()) i.parentNode.classList.add('falta'); });
        ['gal', 'precio'].forEach(function (cl) { const i = tr.querySelector('.' + cl); if (!(self._n(i.value) > 0)) i.parentNode.classList.add('falta'); });
      });
      return lista;
    }

    function calcularRecorridos() {
      const kmI = self._n(raiz.querySelector('#txtKmInicialConsol').value);
      const kmF = self._n(raiz.querySelector('#txtKmFinalConsol').value);
      raiz.querySelector('#txtKmRecorridoConsol').value = (kmF > 0 && kmF >= kmI) ? (kmF - kmI).toFixed(0) + ' km' : '';
      const hI = self._n(raiz.querySelector('#txtHrInicialConsol').value);
      const hF = self._n(raiz.querySelector('#txtHrFinalConsol').value);
      raiz.querySelector('#txtHrRecorridoConsol').value = (hF > 0 && hF >= hI) ? (hF - hI).toFixed(1) + ' h' : '';
    }

    // Diferencia > 0: el conductor devuelve; < 0: hay que reintegrarle.
    function textoDiferencia(dif) {
      if (dif > 0.004) return 'Conductor devuelve';
      if (dif < -0.004) return 'Reintegrar al conductor';
      return 'Cuadrado';
    }
    function actualizarPie() {
      raiz.querySelector('#pieTotalViaje').textContent = raiz.querySelector('#txtTotalViajeConsol').value || 'S/ 0.00';
      const dif = self._n(raiz.querySelector('#txtDiferenciaConsol').value);
      raiz.querySelector('#pieDiferencia').textContent = dinero(Math.abs(dif));
      raiz.querySelector('#pieDifTitulo').textContent = textoDiferencia(dif);
      const caja = raiz.querySelector('#pieDifCaja');
      caja.classList.toggle('pos', dif > 0.004);
      caja.classList.toggle('neg', dif < -0.004);
      raiz.querySelector('#pieSustentado').textContent = q('txtSustentadoConsol').value || 'S/ 0.00';
      raiz.querySelector('#pieDepositado').textContent = q('txtTotalDepositadoConsol').value || 'S/ 0.00';
    }

    function pintar(input, valor) {
      if (valor > 0) input.style.background = '#c6efce';
      else if (valor < 0) input.style.background = '#ffc7ce';
      else input.style.background = '';
    }

    function calcularCombustible() {
      const glEstTracto = self._n(raiz.querySelector('#txtGLEstimadosTractoConsol').value);
      const glEstGenerador = self._n(raiz.querySelector('#txtGLEstimadosGeneradorConsol').value);
      const precioPetroleo = self._n(raiz.querySelector('#txtPrecioPetroleoConsol').value);

      const glRealTracto = self._n(q('txtGLTractoRealConsol').value);
      const glRealGenerador = self._n(q('txtGLGeneradorRealConsol').value);
      const glRecTracto = self._n(q('txtGLAdicionalTractoConsol').value);
      const glRecGenset = self._n(q('txtGLAdicionalGensetConsol').value);
      q('txtGLRecargaTractoVista').value = glRecTracto.toFixed(2);
      q('txtGLRecargaGensetVista').value = glRecGenset.toFixed(2);

      // Diferencia = lo estimado − lo realmente usado (inicio + recargas).
      // Negativa (roja) = se consumió más de lo estimado.
      const difTracto = glEstTracto - (glRealTracto + glRecTracto);
      const difGenerador = glEstGenerador - (glRealGenerador + glRecGenset);
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
      actualizarPie();
    }

    function calcularTodo() {
      q('txtVentaTotalConsol').value = (self._n(q('txtTarifa1Consol').value) + self._n(q('txtTarifa2Consol').value)).toFixed(2);
      calcularRecargas();
      calcularCombustible();
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
      // Gastos del conductor en ruta.
      const gastos = viatico + peaje + peajeSDCF + peajeAdicional + cochera + llanta + lavado + balanza + otros;

      // Total por viaje = gastos + todas las recargas de combustible + depósitos adicionales.
      const totalViaje = gastos + recargasTotal + depAdicionales;
      // Monto sustentado = lo que el conductor justifica con gastos (las recargas
      // abastecidas con Repsol no las pagó él, por eso no cuentan).
      const sustentado = gastos + recargasConductor;

      raiz.querySelector('#txtPeajeBIConsol').value = 'S/ ' + (peaje / 1.18).toFixed(2);
      raiz.querySelector('#txtTotalViajeConsol').value = 'S/ ' + totalViaje.toFixed(2);
      q('txtSustentadoConsol').value = dinero(sustentado);

      // Diferencia = lo que recibió (depósito + adicionales) − lo sustentado.
      const montoDepositado = self._n(raiz.querySelector('#txtMontoDepositadoConsol').value) + depAdicionales;
      q('txtDepAdicionalesConsol').value = dinero(depAdicionales);
      q('txtTotalDepositadoConsol').value = dinero(montoDepositado);
      const diferencia = montoDepositado - sustentado;
      raiz.querySelector('#txtDiferenciaConsol').value = 'S/ ' + diferencia.toFixed(2);
      pintar(raiz.querySelector('#txtDiferenciaConsol'), diferencia);
      q('notaDiferenciaConsol').textContent = textoDiferencia(diferencia) + (Math.abs(diferencia) > 0.004 ? ': ' + dinero(Math.abs(diferencia)) : '');

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

    ['txtTarifa1Consol','txtTarifa2Consol','txtGLTractoRealConsol','txtGLGeneradorRealConsol'].forEach(function (id) {
      q(id).addEventListener('input', calcularTodo);
    });

    /* ---------------- Guías de remisión (varias) ---------------- */
    const tbodyGuias = q('tablaGuiasConsol').querySelector('tbody');
    function agregarGuia(grt, grc, peso) {
      const primera = tbodyGuias.children.length === 0;
      const tr = document.createElement('tr');
      tr.className = 'guia-fila';
      tr.innerHTML =
        '<td class="req-celda"><input class="grt"' + (primera ? ' id="txtGRTransporte1Consol"' : '') + ' autocomplete="off" placeholder="Ej. T001-000123"></td>' +
        '<td class="req-celda"><input class="grc"' + (primera ? ' id="txtGRCliente1Consol"' : '') + ' autocomplete="off" placeholder="Ej. EG07-000456"></td>' +
        '<td class="req-celda"><input class="peso" inputmode="decimal" autocomplete="off" placeholder="0"></td>' +
        '<td><button type="button" class="btn-quitar" title="Quitar guía"' + (primera ? ' disabled' : '') + '>×</button></td>';
      tr.querySelector('.grt').value = grt || '';
      tr.querySelector('.grc').value = grc || '';
      tr.querySelector('.peso').value = peso || '';
      tr.querySelector('.btn-quitar').addEventListener('click', function () { tr.remove(); calcularPeso(); actualizarFaltantes(); });
      tr.querySelector('.peso').addEventListener('input', calcularPeso);
      tbodyGuias.appendChild(tr);
      return tr;
    }
    function leerGuias() {
      return Array.from(tbodyGuias.querySelectorAll('tr.guia-fila')).map(function (tr) {
        return { grt: tr.querySelector('.grt').value.trim(), grc: tr.querySelector('.grc').value.trim(), peso: self._n(tr.querySelector('.peso').value) };
      });
    }
    function guiasIncompletas() {
      return leerGuias().filter(function (g) { return !g.grt || !g.grc || !(g.peso > 0); });
    }
    function calcularPeso() {
      const total = leerGuias().reduce(function (acc, g) { return acc + g.peso; }, 0);
      q('txtPesoBrutoTotalConsol').value = total ? total.toLocaleString('es-PE', { maximumFractionDigits: 2 }) + ' kg' : '0 kg';
      return total;
    }
    q('btnAgregarGuiaConsol').addEventListener('click', function () {
      const tr = agregarGuia();
      tr.querySelector('.grt').focus();
      actualizarFaltantes();
    });
    agregarGuia();
    calcularPeso();

    /* ---------------- Recargas de combustible en ruta ---------------- */
    const tbodyRec = q('tablaRecargasConsol').querySelector('tbody');
    function agregarRecarga() {
      const tr = document.createElement('tr');
      tr.className = 'rec-fila';
      tr.innerHTML =
        '<td><input class="lugar" list="dlGrifosConsol" autocomplete="off" placeholder="Elija o escriba el grifo" style="text-transform:uppercase"></td>' +
        '<td><input class="nv" autocomplete="off" placeholder="N° NV" style="text-transform:uppercase"></td>' +
        '<td><select class="equipo"><option value="TRACTO">Tracto</option><option value="GENSET">Genset</option></select></td>' +
        '<td><select class="pago" title="Si se abasteció con Repsol (crédito), el conductor no lo pagó y no se descuenta de lo depositado"><option value="CONDUCTOR">Conductor</option><option value="REPSOL">Repsol</option></select></td>' +
        '<td><input class="gal" inputmode="decimal" autocomplete="off" placeholder="0"></td>' +
        '<td><input class="precio" inputmode="decimal" autocomplete="off"></td>' +
        '<td class="tot-celda">S/ 0.00</td>' +
        '<td><button type="button" class="btn-quitar" title="Quitar recarga">×</button></td>';
      tr.querySelector('.precio').value = q('txtPrecioPetroleoConsol').value || '';
      // Si el lugar dice Repsol, se propone "Pagó: Repsol" (se puede cambiar).
      let pagoTocado = false;
      tr.querySelector('.pago').addEventListener('change', function () { pagoTocado = true; });
      tr.querySelector('.lugar').addEventListener('input', function () {
        if (!pagoTocado) tr.querySelector('.pago').value = /REPSOL/i.test(this.value) ? 'REPSOL' : 'CONDUCTOR';
      });
      tr.querySelector('.btn-quitar').addEventListener('click', function () { tr.remove(); calcularTodo(); });
      tr.querySelectorAll('input, select').forEach(function (el) { el.addEventListener('input', calcularTodo); el.addEventListener('change', calcularTodo); });
      tbodyRec.appendChild(tr);
      return tr;
    }
    function leerRecargas() {
      return Array.from(tbodyRec.querySelectorAll('tr.rec-fila')).map(function (tr) {
        return {
          lugar: tr.querySelector('.lugar').value.trim().toUpperCase(), nv: tr.querySelector('.nv').value.trim().toUpperCase(), equipo: tr.querySelector('.equipo').value, pago: tr.querySelector('.pago').value,
          gal: self._n(tr.querySelector('.gal').value), precio: self._n(tr.querySelector('.precio').value), tr: tr
        };
      });
    }
    function recargasIncompletas() {
      return leerRecargas().filter(function (r) { return !r.lugar || !r.nv || !(r.gal > 0) || !(r.precio > 0); });
    }
    // Pasa la suma de recargas a los campos de "adicional" que ya usa el
    // cálculo: galones totales y precio promedio ponderado por equipo.
    function calcularRecargas() {
      const acc = { TRACTO: { gal: 0, soles: 0 }, GENSET: { gal: 0, soles: 0 } };
      recargasTotal = 0; recargasConductor = 0;
      leerRecargas().forEach(function (r) {
        const total = r.gal * r.precio;
        r.tr.querySelector('.tot-celda').textContent = dinero(total);
        acc[r.equipo].gal += r.gal;
        acc[r.equipo].soles += total;
        recargasTotal += total;
        if (r.pago !== 'REPSOL') recargasConductor += total;
      });
      q('resumenRecargasConsol').textContent = (acc.TRACTO.gal + acc.GENSET.gal) > 0
        ? 'Total recargas: ' + dinero(recargasTotal) + ' · tracto ' + acc.TRACTO.gal.toFixed(2) + ' gl ' + dinero(acc.TRACTO.soles) +
          ' · genset ' + acc.GENSET.gal.toFixed(2) + ' gl ' + dinero(acc.GENSET.soles) + '. Pagadas por el conductor: ' + dinero(recargasConductor) +
          ' (las de Repsol no se descuentan de lo depositado).'
        : 'Sin recargas.';
      q('txtGLAdicionalTractoConsol').value = acc.TRACTO.gal;
      q('txtPrecioGalonTractoConsol').value = acc.TRACTO.gal ? (acc.TRACTO.soles / acc.TRACTO.gal) : 0;
      q('txtGLAdicionalGensetConsol').value = acc.GENSET.gal;
      q('txtPrecioGalonGensetConsol').value = acc.GENSET.gal ? (acc.GENSET.soles / acc.GENSET.gal) : 0;
    }
    q('btnAgregarRecargaConsol').addEventListener('click', function () {
      agregarRecarga().querySelector('.lugar').focus();
      calcularTodo();
    });

    /* ---------------- Código del servicio ---------------- */
    // Formato: DDMMAA + 3 letras del cliente + últimos 3 caracteres del
    // booking. Ej.: 130826NEW257 (13/08/2026, cliente NEW, booking ...257).
    let codigoEditadoAMano = false;
    function generarCodigo() {
      const d = _aFecha(q('txtFechaServicioConsol').value.trim());
      const cli = (q('txtClienteFacturacionConsol').value || '').toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '');
      const bk = (q('txtBookingConsol').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!d || !cli || !bk) return '';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const aa = String(d.getFullYear()).slice(-2);
      return dd + mm + aa + (cli + 'XXX').slice(0, 3) + bk.slice(-3);
    }
    function ponerCodigo(forzar) {
      if (codigoEditadoAMano && !forzar) return;
      const cod = generarCodigo();
      q('txtCodigoServicioConsol').value = cod;
      if (forzar) codigoEditadoAMano = false;
      actualizarFaltantes();
    }
    q('btnGenerarCodigoConsol').addEventListener('click', function () {
      ponerCodigo(true);
      if (!q('txtCodigoServicioConsol').value) mostrarMensaje('Para generar el código completa la fecha, el cliente y el booking.', 'error');
    });
    q('txtCodigoServicioConsol').addEventListener('input', function () { codigoEditadoAMano = true; });
    ['txtFechaServicioConsol','txtClienteFacturacionConsol','txtBookingConsol'].forEach(function (id) {
      q(id).addEventListener('change', function () { ponerCodigo(false); });
    });

    /* ---------------- KM inicial no puede ser mayor al final ---------------- */
    function validarKm() {
      const kmI = self._n(q('txtKmInicialConsol').value);
      const kmF = self._n(q('txtKmFinalConsol').value);
      const malo = q('txtKmInicialConsol').value.trim() !== '' && q('txtKmFinalConsol').value.trim() !== '' && kmI > kmF;
      q('txtKmInicialConsol').closest('.campo').classList.toggle('km-mal', malo);
      q('txtKmFinalConsol').closest('.campo').classList.toggle('km-mal', malo);
      return !malo;
    }
    ['txtKmInicialConsol','txtKmFinalConsol'].forEach(function (id) { q(id).addEventListener('input', validarKm); });

    /* ------- Datos de apoyo: bono, KM anterior y depósitos adicionales ------- */
    /* ---------------- Guardar / recuperar lo escrito (para "Revisar") ---------------- */
    function serializarForm() {
      const campos = {};
      raiz.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (el) {
        if (el.type === 'checkbox') return;
        campos[el.id] = el.value;
      });
      return {
        v: 1, campos: campos,
        guias: leerGuias().map(function (g) { return { grt: g.grt, grc: g.grc, peso: g.peso }; }),
        recargas: leerRecargas().map(function (r) { return { lugar: r.lugar, nv: r.nv, equipo: r.equipo, pago: r.pago, gal: r.gal, precio: r.precio }; }),
        depositos: Array.from(raiz.querySelectorAll('.chk-dep-adic')).filter(function (c) { return c.checked; })
          .map(function (c) { return (depositosApoyo[Number(c.dataset.i)] || {}).id; }).filter(Boolean)
      };
    }
    function restaurarForm(f) {
      if (!f || !f.campos) return;
      Object.keys(f.campos).forEach(function (id) {
        const el = q(id);
        if (el && !el.disabled && el.type !== 'hidden') el.value = f.campos[id];
      });
      if (f.campos.txtCodigoServicioConsol) { q('txtCodigoServicioConsol').value = f.campos.txtCodigoServicioConsol; codigoEditadoAMano = true; }
      ['cboDominicalConsol', 'cboFeriadoConsol'].forEach(function (id) { q(id).dispatchEvent(new Event('change')); });
      if (Array.isArray(f.guias) && f.guias.length) {
        tbodyGuias.innerHTML = '';
        f.guias.forEach(function (g) { agregarGuia(g.grt, g.grc, g.peso); });
      }
      if (Array.isArray(f.recargas)) {
        tbodyRec.innerHTML = '';
        f.recargas.forEach(function (r) {
          const tr = agregarRecarga();
          tr.querySelector('.lugar').value = r.lugar || '';
          tr.querySelector('.nv').value = r.nv || '';
          tr.querySelector('.equipo').value = r.equipo || 'TRACTO';
          tr.querySelector('.pago').value = r.pago || 'CONDUCTOR';
          tr.querySelector('.gal').value = r.gal || '';
          tr.querySelector('.precio').value = r.precio || '';
        });
      }
      calcularPeso();
    }

    async function cargarApoyo() {
      const cuerpo = document.getElementById('cuerpo-panel');
      const r = await llamarBackend('datosParaConsolidado', {
        fila: self._filaServicioOrigen,
        placa: q('txtPlacaTractoConsol').value,
        fecha: q('txtFechaServicioConsol').value,
        destino1: q('txtDestino1Consol').value,
        destino2: q('txtDestino2Consol').value
      });
      if (!document.body.contains(raiz)) return;   // se cerró la ventana
      const sinCambios = cuerpo && _serializarFormulario(cuerpo) === _snapshotFormulario;
      const notaKm = q('notaKmConsol');
      const notaBono = q('notaBonoConsol');
      const listaDep = q('listaDepAdicConsol');
      if (!r || r.ok === false) {
        notaKm.textContent = 'No se pudo consultar el viaje anterior.';
        listaDep.innerHTML = '<span style="color:#b91c1c">No se pudieron cargar los depósitos adicionales.</span>';
        return;
      }
      // Consolidado ya registrado: se cargan sus datos para revisarlos/corregirlos.
      if (r.consolidado) {
        self._filaConsolidado = r.consolidado.fila;
        restaurarForm(r.consolidado.form);
        q('avisoEdicionConsol').style.display = '';
        q('avisoEdicionConsol').textContent = 'Estás revisando el consolidado ya registrado' + (r.consolidado.codigo ? ' (código ' + r.consolidado.codigo + ')' : '') +
          '. Corrige lo que necesites: al grabar se actualiza el mismo registro.' + (r.consolidado.form ? '' : ' Este registro es antiguo y no guardó el detalle: revisa todos los campos.');
        q('btnGrabarConsol').textContent = 'Guardar cambios';
      }
      // KM inicial = KM final del viaje anterior del mismo tracto
      if (r.kmAnterior !== null && r.kmAnterior !== undefined) {
        if (q('txtKmInicialConsol').value.trim() === '') q('txtKmInicialConsol').value = r.kmAnterior;
        notaKm.textContent = 'KM inicial tomado del KM final del viaje anterior de este tracto' + (r.fechaKmAnterior ? ' (' + r.fechaKmAnterior + ')' : '') + ': ' + Number(r.kmAnterior).toLocaleString('es-PE') + ' km. No puede ser mayor que el KM final.';
      } else {
        notaKm.textContent = 'No hay un viaje anterior registrado para este tracto: escribe el KM inicial. No puede ser mayor que el KM final.';
      }
      // Bono por destino (BD_SERVICIOS)
      if (self._n(q('txtBonoConsol').value) === 0 && r.bono1 > 0) q('txtBonoConsol').value = r.bono1;
      const d2 = q('txtDestino2Consol').value.trim();
      let txtBono = r.destino1Encontrado
        ? 'Bono de ' + esc(q('txtDestino1Consol').value) + ' según la hoja BD_SERVICIOS: ' + dinero(r.bono1) + '.'
        : 'El destino ' + esc(q('txtDestino1Consol').value) + ' no está en BD_SERVICIOS: escribe el bono.';
      if (d2 && d2 !== '-') txtBono += ' Hay un segundo destino (' + esc(d2) + '): agrega su bono a mano' + (r.bono2 ? ' (referencia: ' + dinero(r.bono2) + ')' : '') + '.';
      notaBono.innerHTML = txtBono;
      notaBono.classList.toggle('alerta', !r.destino1Encontrado || (d2 && d2 !== '-'));
      // Depósitos adicionales del servicio (módulo Depósito). Cada uno se
      // confirma con su check; solo los confirmados suman al depositado.
      // Grifos usados antes (históricos de recargas) para la lista desplegable.
      q('dlGrifosConsol').innerHTML = (r.grifos || []).map(function (g) { return '<option value="' + esc(g) + '">'; }).join('');
      const deps = r.depositos || [];
      const confirmable = function (x) { return x.estado === 'DEPOSITADO' || x.estado === 'APROBADO'; };
      listaDep.innerHTML = deps.length
        ? deps.map(function (x, i) {
            const ok = confirmable(x);
            const detalle = [x.medio, x.operacion ? 'N° ' + x.operacion : '', x.persona].filter(Boolean).map(esc).join(' · ');
            return '<div' + (ok ? '' : ' class="pend"') + '>' +
              (ok ? '<label style="display:flex;gap:8px;align-items:center;cursor:pointer;margin:0;font-weight:400;color:inherit;"><input type="checkbox" class="chk-dep-adic" data-i="' + i + '" style="width:auto;margin:0;">' : '<span style="width:21px"></span>') +
              '<b>' + esc(x.motivo) + '</b>' + (ok ? '</label>' : '') +
              '<span>' + dinero(x.monto) + '</span>' +
              '<span style="color:#64748b">' + detalle + '</span>' +
              (ok ? (x.estado === 'APROBADO' ? '<span>aprobado, falta depositar</span>' : '') : '<span>' + esc(x.estado) + ' · no suma</span>') +
              (x.observacion ? '<span style="color:#64748b">' + esc(x.observacion) + '</span>' : '') + '</div>';
          }).join('') + '<div style="border:none;color:#64748b">Marca cada depósito para confirmarlo. Lo gastado con ellos regístralo en Llanta, Peaje adicional u Otros.</div>'
        : '<span style="color:#64748b">Este servicio no tiene depósitos adicionales.</span>';
      depositosApoyo = deps;
      if (r.consolidado && r.consolidado.form && Array.isArray(r.consolidado.form.depositos)) {
        listaDep.querySelectorAll('.chk-dep-adic').forEach(function (chk) {
          chk.checked = r.consolidado.form.depositos.indexOf((deps[Number(chk.dataset.i)] || {}).id) !== -1;
        });
      }
      listaDep.querySelectorAll('.chk-dep-adic').forEach(function (chk) {
        chk.addEventListener('change', function () { recalcularDepAdic(); calcularTodo(); actualizarFaltantes(); });
      });
      recalcularDepAdic();
      calcularRecorridos();
      validarKm();
      calcularTodo();
      actualizarFaltantes();
      if (sinCambios) _refrescarSnapshotFormulario();
    }

    function calcularMesSemana() {
      const d = _aFecha(raiz.querySelector('#txtFechaServicioConsol').value.trim());
      if (!d) {
        raiz.querySelector('#txtMesConsol').value = '';
        raiz.querySelector('#txtSemanaConsol').value = '';
        return;
      }
      // Mes (equivalente a MonthName) y semana (equivalente a DatePart "ww").
      // El CÓDIGO DEL SERVICIO lo genera el backend al grabar.
      raiz.querySelector('#txtMesConsol').value = MESES[d.getMonth() + 1];
      const inicioAnio = new Date(d.getFullYear(), 0, 1);
      const semana = Math.ceil((((d - inicioAnio) / 86400000) + inicioAnio.getDay() + 1) / 7);
      raiz.querySelector('#txtSemanaConsol').value = 'SEMANA ' + semana;
    }
    raiz.querySelector('#txtFechaServicioConsol').addEventListener('change', function () {
      const d = _aFecha(this.value.trim());
      if (d) this.value = formatoFecha(d);
      calcularMesSemana();
      actualizarFaltantes();
    });

    ['txtKmInicialConsol','txtKmFinalConsol','txtHrInicialConsol','txtHrFinalConsol'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('input', calcularRecorridos);
    });
    raiz.addEventListener('input', actualizarFaltantes);
    raiz.addEventListener('change', actualizarFaltantes);

    raiz.querySelector('#btnInicioConsolidado').addEventListener('click', solicitarCierrePanel);

    protegerClic(raiz.querySelector('#btnGrabarConsol'), async function () {
      const estado = String(self._estadoOrigen || '').trim().toUpperCase();

      const fechaTxt = raiz.querySelector('#txtFechaServicioConsol').value.trim();
      if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fechaTxt) || !_aFecha(fechaTxt)) {
        marcarFaltantes = true; actualizarFaltantes();
        raiz.querySelector('#txtFechaServicioConsol').closest('.campo').classList.add('falta');
        raiz.querySelector('#txtFechaServicioConsol').focus();
        mostrarMensaje('Escribe la fecha del servicio como dd/mm/aaaa.', 'error');
        return;
      }

      // El botón "Culminado" de la pantalla anterior deja el ESTADO en 'CULMINADO'.
      {
        marcarFaltantes = true;
        const lista = actualizarFaltantes();
        if (lista.length) {
          const primero = lista[0] === '__guias'
            ? (tbodyGuias.querySelector('td.falta input') || q('txtGRTransporte1Consol'))
            : lista[0] === '__recargas' ? (q('tablaRecargasConsol').querySelector('td.falta input') || q('tablaRecargasConsol'))
            : lista[0] === '__depositos' ? raiz.querySelector('.chk-dep-adic:not(:checked)')
            : raiz.querySelector('#' + lista[0]);
          if (lista.indexOf('__depositos') !== -1 && lista.length === 1) {
            primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
            mostrarMensaje('Confirma con el check los depósitos adicionales del servicio (Gastos del viaje).', 'error');
            return;
          }
          primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (!primero.disabled) primero.focus();
          mostrarMensaje('Faltan ' + lista.length + ' campo(s) obligatorio(s). Están marcados en rojo.', 'error');
          return;
        }
      }

      if (!validarKm()) {
        q('txtKmInicialConsol').scrollIntoView({ behavior: 'smooth', block: 'center' });
        mostrarMensaje('El KM inicial no puede ser mayor que el KM final.', 'error');
        return;
      }

      const v = function (id) { return raiz.querySelector('#' + id).value; };
      const guias = leerGuias().filter(function (g) { return g.grt || g.grc || g.peso; });
      const guiaCol = function (i, campo) {
        // Columnas fijas 1, 2 y 3 de la hoja; si hay más de 3 guías, la 3 junta el resto.
        if (i < 2) return guias[i] ? guias[i][campo] : '';
        return guias.slice(2).map(function (g) { return g[campo]; }).filter(Boolean).join(' / ');
      };
      const pesoTotal = calcularPeso();
      const recargas = leerRecargas().filter(function (r) { return r.gal > 0; });
      const kmRec = self._n(v('txtKmFinalConsol')) - self._n(v('txtKmInicialConsol'));
      const mapaColumnas = {
        'CLIENTE PARA FACTURACIÓN': v('txtClienteFacturacionConsol'), 'CANTIDAD DE VIAJES': v('txtCantidadViajesConsol'),
        'FLOTA': 'PROPIO', 'EMPRESA QUE DIO EL SERVICIO': v('txtEmpresaServicioConsol'),
        'CONDUCTOR': v('txtConductorConsol'), 'PLACA TRACTO': v('txtPlacaTractoConsol'), 'PLACA CARRETA': v('txtPlacaCarretaConsol'),
        'TIPO DE CARGA': v('txtTipoCargaConsol'), 'DESTINO 1': v('txtDestino1Consol'), 'CLIENTE': v('txtClienteFacturacionConsol'),
        'TARIFA 1': v('txtTarifa1Consol'), 'DESTINO 2': v('txtDestino2Consol'), 'TARIFA 2': v('txtTarifa2Consol'),
        'ALMACEN DE SALIDA': v('txtAlmacenSalidaConsol'), 'ALMACEN DE LLEGADA': v('txtAlmacenLlegadaConsol'),
        'BOOKING': v('txtBookingConsol'), 'Nº CONTENEDOR': v('txtContenedorConsol'),
        'SEMANA': v('txtSemanaConsol'), 'MONTO DEPOSITADO': v('txtMontoDepositadoConsol'),
        'N° DE TRANSFERENCIA': v('txtNumeroTransferenciaConsol'), 'N° DE VIÁTICO': v('txtNumeroViaticoConsol'),
        'G.R. TRANSPORTE 1': guiaCol(0, 'grt'), 'G.R. CLIENTE 1': guiaCol(0, 'grc'),
        'G.R. TRANSPORTE 2': guiaCol(1, 'grt'), 'G.R. CLIENTE 2': guiaCol(1, 'grc'),
        'G.R. TRANSPORTE 3': guiaCol(2, 'grt'), 'G.R. CLIENTE 3': guiaCol(2, 'grc'),
        'GUIAS DETALLE': guias.map(function (g, i) { return (i + 1) + ') GRT ' + (g.grt || '-') + ' · GRE ' + (g.grc || '-') + ' · ' + g.peso + ' kg'; }).join(' ; '),
        'PESO BRUTO TOTAL': pesoTotal,
        'CLIENTE GUIA': v('txtClienteGuiaConsol').trim().toUpperCase(),
        'DEPOSITOS ADICIONALES': depAdicionales,
        'RECARGAS DETALLE': recargas.map(function (r) { return (r.lugar || 'SIN LUGAR') + ' · NV ' + (r.nv || '-') + ' · ' + r.equipo + ' · pagó ' + r.pago + ' · ' + r.gal + ' gl x S/ ' + r.precio.toFixed(2) + ' = S/ ' + (r.gal * r.precio).toFixed(2); }).join(' ; '),
        'P. PETRÓLEO ADIC. TRACTO': self._n(v('txtPrecioGalonTractoConsol')).toFixed(2),
        'P. PETRÓLEO ADIC. GENSED': self._n(v('txtPrecioGalonGensetConsol')).toFixed(2),
        'KM RECORRIDO': kmRec > 0 ? kmRec : '',
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
        codigoServicio: v('txtCodigoServicioConsol').trim().toUpperCase() || undefined,
        filaServicioOrigen: self._filaServicioOrigen, estadoOrigen: self._estadoOrigen,
        filaConsolidado: self._filaConsolidado || undefined,
        formDatos: JSON.stringify(serializarForm()),
        datos: mapaColumnas
      });

      if (!resp || !resp.ok) { mostrarMensaje((resp && resp.mensaje) || 'No se pudo grabar el consolidado.', 'error'); return; }
      mostrarMensaje(resp.mensaje + (resp.codigoServicio ? ' Código: ' + resp.codigoServicio : ''), 'exito');
      cerrarPanel();
    });

    calcularMesSemana();
    ponerCodigo(true);
    calcularRecorridos();
    calcularTodo();
    actualizarFaltantes();
    cargarApoyo();
  }
};
