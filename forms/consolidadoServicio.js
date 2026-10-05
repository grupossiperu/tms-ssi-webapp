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
    const c = function (etq, id, valor, obligatorio, clase) {
      return '<div class="campo' + (clase ? ' ' + clase : '') + '"><label for="' + id + '">' + etq + (obligatorio ? req : '') +
        '</label><input id="' + id + '" value="' + (valor === undefined ? '' : valor) + '" autocomplete="off"></div>';
    };
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
      ${yaRegistrado ? '<div class="aviso">Este servicio ya tiene un consolidado registrado. Si vuelves a grabar se creará otro registro.</div>' : ''}

      <div class="cols">
        <div>
          <div class="seg">
            <div class="seg-tit"><span class="seg-num">1</span> Servicio y cliente</div>
            <div class="g">
              ${c('Fecha del servicio', 'txtFechaServicioConsol', esc(fechaServicio), true)}
              ${k('Mes', 'txtMesConsol')}
              ${k('Semana', 'txtSemanaConsol')}
              <div class="campo calc"><label for="txtCodigoServicioConsol">Código</label><input id="txtCodigoServicioConsol" disabled placeholder="Se genera al grabar"></div>
              ${c('Cliente para facturación', 'txtClienteFacturacionConsol', s('CLIENTE PARA FACTURACIÓN'), true)}
              ${c('Cliente (consolidado)', 'cboClienteConsol', s('CLIENTE PARA FACTURACIÓN'), true)}
              ${c('Empresa', 'txtEmpresaServicioConsol', s('EMPRESA QUE DIO EL SERVICIO'), true)}
              ${c('Flota', 'txtFlotaConsol', 'PROPIO', true)}
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
              ${c('Tara', 'txtTaraConsol', '', true)}
              ${c('Tipo de carga', 'txtTipoCargaConsol', s('TIPO DE CARGA'), true)}
              ${c('Tipo de producto', 'txtTipoProductoConsol', s('TIPO DE PRODUCTO'), true)}
              ${c('Tipo de tratamiento', 'txtTipoTratamientoConsol', s('TIPO DE TRATAMIENTO'), true, 'span2')}
              ${c('Cantidad de viajes', 'txtCantidadViajesConsol', cantidadViajes, true)}
              ${c('Almacén de salida', 'txtAlmacenSalidaConsol', s('DEPOSITO DE RETIRO'), true)}
              ${c('Destino 1', 'txtDestino1Consol', s('DESTINO 1'), true)}
              ${c('Tarifa 1', 'txtTarifa1Consol', s('TARIFA 1'), true)}
              ${c('Almacén de llegada', 'txtAlmacenLlegadaConsol', s('DEPOSITO DE DEVOLUCION'), true)}
              ${c('Destino 2', 'txtDestino2Consol', esc(destino2))}
              ${c('Tarifa 2', 'txtTarifa2Consol', s('TARIFA 2'))}
            </div>
          </div>

          <div class="seg">
            <div class="seg-tit"><span class="seg-num">3</span> Documentos</div>
            <div class="g">
              ${c('N° de transferencia', 'txtNumeroTransferenciaConsol', '', true)}
              ${c('N° de viático', 'txtNumeroViaticoConsol', '', true)}
              ${c('G.R. Transporte 1', 'txtGRTransporte1Consol', '', true)}
              ${c('G.R. Cliente 1', 'txtGRCliente1Consol', '', true)}
              <div class="span2"></div>
              ${c('G.R. Transporte 2', 'txtGRTransporte2Consol')}
              ${c('G.R. Cliente 2', 'txtGRCliente2Consol')}
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
            </div>
          </div>
        </div>

        <div>
          <div class="seg">
            <div class="seg-tit"><span class="seg-num">5</span> Gastos del viaje (S/) <span class="nota">Lo depositado vs. lo gastado</span></div>
            <div class="g">
              ${c('Monto depositado', 'txtMontoDepositadoConsol', s('MONTO DEPOSITADO', 0), true)}
              ${c('Viático', 'txtViaticoConsol', s('VIATICO', 0), true)}
              ${c('Peaje', 'txtPeajeConsol', s('PEAJE', 0), true)}
              ${k('Peaje base imponible', 'txtPeajeBIConsol')}
              ${c('Peaje S.D.C.F.', 'txtPeajeSDCFConsol', 0)}
              ${c('Peaje adicional', 'txtPeajeAdicionalConsol', 0)}
              ${c('Cochera', 'txtCocheraConsol', s('COCHERA', 0), true)}
              ${c('Llanta', 'txtLlantaConsol', 0)}
              ${c('Lavado', 'txtLavadoConsol', 0)}
              ${c('Balanza', 'txtBalanzaConsol', 0)}
              ${c('Otros', 'txtOtrosConsol', 0)}
              <div></div>
              <div class="sub">Bonos del conductor</div>
              <div class="campo"><label for="cboDominicalConsol">¿Dominical?</label><select id="cboDominicalConsol"><option>NO</option><option>SI</option></select></div>
              <div class="campo calc"><label for="txtDominicalConsol">Dominical</label><input id="txtDominicalConsol" value="0" disabled></div>
              <div class="campo"><label for="cboFeriadoConsol">¿Feriado?</label><select id="cboFeriadoConsol"><option>NO</option><option>SI</option></select></div>
              <div class="campo calc"><label for="txtFeriadoConsol">Feriado</label><input id="txtFeriadoConsol" value="0" disabled></div>
              ${c('Bono', 'txtBonoConsol', 0)}
              ${k('Bono + Dom. + Feriado', 'txtBonoTotalConsol')}
              ${k('Total por viaje', 'txtTotalViajeConsol')}
              ${k('Diferencia (dep. − total)', 'txtDiferenciaConsol')}
            </div>
          </div>

          <div class="seg">
            <div class="seg-tit"><span class="seg-num">6</span> Combustible <span class="nota">Abastecimiento: ${s('TIPO DE ABASTECIMIENTO', '-')}</span></div>
            <div class="g">
              ${c('Precio de petróleo (S/ x gl)', 'txtPrecioPetroleoConsol', s('COSTO DEL PETRÓLEO X GALÓN', 0), true, 'span2')}
              <div class="span2"></div>
              <div class="sub">Tracto</div>
              ${k('GL estimados', 'txtGLEstimadosTractoConsol')}
              ${c('GL reales', 'txtGLTractoRealConsol', 0, true)}
              ${k('Diferencia', 'txtDiferenciaTractoConsol')}
              ${k('Petróleo tracto', 'txtPetroleoTractoConsol')}
              ${c('Precio gl adicional', 'txtPrecioGalonTractoConsol', 0)}
              ${c('GL adicional', 'txtGLAdicionalTractoConsol', 0)}
              ${k('Total adicional', 'txtTotalAdicionalTracto')}
              ${k('Petróleo tracto B.I.', 'txtPetroleoTractoBIConsol')}
              <div class="sub">Generador (genset)</div>
              ${k('GL estimados', 'txtGLEstimadosGeneradorConsol')}
              ${c('GL reales', 'txtGLGeneradorRealConsol', 0)}
              ${k('Diferencia', 'txtDiferenciaGeneradorConsol')}
              ${k('Petróleo generador', 'txtPetroleoGeneradorConsol')}
              ${c('Precio gl adicional', 'txtPrecioGalonGensetConsol', 0)}
              ${c('GL adicional', 'txtGLAdicionalGensetConsol', 0)}
              ${k('Total adicional', 'txtTotalAdicionalGenerador')}
              ${k('Petróleo generador B.I.', 'txtPetroleoGeneradorBIConsol')}
              <div class="sub">Adicionales sin IGV</div>
              ${k('Adic. tracto B.I.', 'txtTotalAdicionalBITracto', 'span2')}
              ${k('Adic. generador B.I.', 'txtTotalAdicionalBIGenerador', 'span2')}
            </div>
          </div>

        </div>
      </div>

      <input type="hidden" id="txtCostoViajeRealizadoConsol">
      <input type="hidden" id="txtCostoViajeRealizadoBI">

      <div class="pie">
        <div class="tot"><span>Total por viaje</span><b id="pieTotalViaje">S/ 0.00</b></div>
        <div class="tot" id="pieDifCaja"><span>Diferencia</span><b id="pieDiferencia">S/ 0.00</b></div>
        <div class="tot"><span>Costo por viaje</span><b id="pieCosto">S/ 0.00</b></div>
        <div class="tot"><span>Costo B.I.</span><b id="pieCostoBI">S/ 0.00</b></div>
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
    let glManualTracto = 0, glManualGenerador = 0;
    servicio = servicio || {};
    raiz.querySelector('#txtGLEstimadosTractoConsol').value = servicio['GL TRACTO'] || 0;
    raiz.querySelector('#txtGLEstimadosGeneradorConsol').value = servicio['GL GENERADOR'] || 0;

    // Campos obligatorios para un servicio CULMINADO. El código del
    // servicio no va aquí: lo genera el backend al grabar.
    const OBLIGATORIOS = [
      'txtClienteFacturacionConsol','txtCantidadViajesConsol','txtFlotaConsol','txtEmpresaServicioConsol',
      'txtConductorConsol','txtPlacaTractoConsol','txtPlacaCarretaConsol','txtTipoCargaConsol','txtDestino1Consol',
      'cboClienteConsol','txtTarifa1Consol','txtAlmacenSalidaConsol','txtAlmacenLlegadaConsol',
      'txtFechaServicioConsol','txtMesConsol','txtTipoProductoConsol','txtTipoTratamientoConsol',
      'txtBookingConsol','txtContenedorConsol','txtTaraConsol','txtSemanaConsol','txtMontoDepositadoConsol',
      'txtNumeroTransferenciaConsol','txtNumeroViaticoConsol','txtGRTransporte1Consol','txtGRCliente1Consol',
      'txtViaticoConsol','txtPeajeConsol','txtCocheraConsol','txtGLEstimadosTractoConsol','txtGLTractoRealConsol',
      'txtPrecioPetroleoConsol','txtKmInicialConsol','txtKmFinalConsol','txtNumeroGeneradorConsol',
      'txtHrInicialConsol','txtHrFinalConsol','txtCostoViajeRealizadoConsol'
    ];
    const esCulminado = String(self._estadoOrigen || '').trim().toUpperCase() === 'CULMINADO';
    let marcarFaltantes = false;

    function faltantes() {
      if (!esCulminado) return [];
      return OBLIGATORIOS.filter(function (id) { return raiz.querySelector('#' + id).value.trim() === ''; });
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

    function actualizarPie() {
      raiz.querySelector('#pieTotalViaje').textContent = raiz.querySelector('#txtTotalViajeConsol').value || 'S/ 0.00';
      const dif = self._n(raiz.querySelector('#txtDiferenciaConsol').value);
      raiz.querySelector('#pieDiferencia').textContent = raiz.querySelector('#txtDiferenciaConsol').value || 'S/ 0.00';
      const caja = raiz.querySelector('#pieDifCaja');
      caja.classList.toggle('pos', dif > 0);
      caja.classList.toggle('neg', dif < 0);
      raiz.querySelector('#pieCosto').textContent = raiz.querySelector('#txtCostoViajeRealizadoConsol').value || 'S/ 0.00';
      raiz.querySelector('#pieCostoBI').textContent = raiz.querySelector('#txtCostoViajeRealizadoBI').value || 'S/ 0.00';
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
      actualizarPie();
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
      if (estado === 'CULMINADO') {
        marcarFaltantes = true;
        const lista = actualizarFaltantes();
        if (lista.length) {
          const primero = raiz.querySelector('#' + lista[0]);
          primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (!primero.disabled) primero.focus();
          mostrarMensaje('Faltan ' + lista.length + ' campo(s) obligatorio(s). Están marcados en rojo.', 'error');
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

      if (!resp || !resp.ok) { mostrarMensaje((resp && resp.mensaje) || 'No se pudo grabar el consolidado.', 'error'); return; }
      mostrarMensaje(resp.mensaje + (resp.codigoServicio ? ' Código: ' + resp.codigoServicio : ''), 'exito');
      cerrarPanel();
    });

    calcularMesSemana();
    calcularRecorridos();
    calcularTodo();
    actualizarFaltantes();
  }
};
