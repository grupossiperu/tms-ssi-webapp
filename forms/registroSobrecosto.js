/**
 * forms/registroSobrecosto.js
 * -------------------------------------------------------------------------
 * Ventana que se abre al hacer clic en un servicio dentro de Sobrecostos.
 * Pide: Motivo (desplegable: Sobreestadía, Pernocte, Falsa Nombrada, Falso
 * Flete, Punto Adicional, Horas Adicionales), Observaciones y el Precio
 * del sobrecosto con su moneda (S/ o $).
 *
 * Internamente sigue usando la acción de backend "grabarSobrecosto"
 * (columnas SUBTOTAL/IGV/TOTAL de la hoja SOBRECOSTOS), enviando
 * cantidad = 1 y el precio ingresado como precio unitario, para no tener
 * que tocar esa hoja ni el cálculo de IGV que ya usa Facturación.
 * -------------------------------------------------------------------------
 */
const FormRegistroSobrecosto = {

  _motivos: ['SOBREESTADIA', 'PERNOCTE', 'FALSA NOMBRADA', 'FALSO FLETE', 'PUNTO ADICIONAL', 'HORAS ADICIONALES'],

  _etiquetas: {
    'SOBREESTADIA': 'Sobreestadía',
    'PERNOCTE': 'Pernocte',
    'FALSA NOMBRADA': 'Falsa Nombrada',
    'FALSO FLETE': 'Falso Flete',
    'PUNTO ADICIONAL': 'Punto Adicional',
    'HORAS ADICIONALES': 'Horas Adicionales'
  },

  _fechaTxt: function (servicio) {
    const fecha = servicio['FECHA DE PROGRAMACION'] ? new Date(servicio['FECHA DE PROGRAMACION']) : null;
    return fecha && !isNaN(fecha.getTime())
      ? (String(fecha.getDate()).padStart(2, '0') + '/' + String(fecha.getMonth() + 1).padStart(2, '0') + '/' + fecha.getFullYear())
      : '-';
  },

  abrir: function (servicio) {
    const self = this;
    const fechaTxt = self._fechaTxt(servicio);

    const html = `
      <div class="fila-campos">
        <div class="campo"><label>Cliente</label><input value="${servicio['CLIENTE PARA FACTURACIÓN'] || ''}" disabled></div>
        <div class="campo"><label>Conductor</label><input value="${servicio['CONDUCTOR'] || ''}" disabled></div>
        <div class="campo"><label>Placa tracto</label><input value="${servicio['PLACA TRACTO'] || ''}" disabled></div>
        <div class="campo"><label>Booking</label><input value="${servicio['BOOKING'] || ''}" disabled></div>
        <div class="campo"><label>Fecha de servicio</label><input value="${fechaTxt}" disabled></div>
        <div class="campo"><label>Motivo</label>
          <select id="cboMotivoSobrecosto">
            <option value="">Seleccione...</option>
            ${self._motivos.map(function (m) { return `<option value="${m}">${self._etiquetas[m]}</option>`; }).join('')}
          </select>
        </div>
        <div class="campo" style="grid-column: 1 / -1;"><label>Observaciones</label><textarea id="txtObservacionSobrecosto" rows="3" placeholder="Detalle del sobrecosto (opcional)"></textarea></div>
        <div class="campo"><label>Precio</label><input type="number" id="txtPrecioSobrecosto" step="0.01" min="0" placeholder="0.00"></div>
        <div class="campo"><label>Moneda</label>
          <select id="cboMonedaSobrecosto">
            <option value="S/">Soles (S/)</option>
            <option value="$">Dólares ($)</option>
          </select>
        </div>
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnCancelarSobrecosto">Cancelar</button>
        <button class="boton-primario" id="btnGuardarSobrecosto">Guardar</button>
      </div>`;

    abrirPanel('Registrar Sobrecosto', html, function (raiz) { self._wire(raiz, servicio); });
  },

  _wire: function (raiz, servicio) {
    const self = this;

    raiz.querySelector('#btnCancelarSobrecosto').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnGuardarSobrecosto').addEventListener('click', async function () {
      const motivo = raiz.querySelector('#cboMotivoSobrecosto').value;
      const observacion = raiz.querySelector('#txtObservacionSobrecosto').value.trim();
      const precioTxt = raiz.querySelector('#txtPrecioSobrecosto').value;
      const moneda = raiz.querySelector('#cboMonedaSobrecosto').value;

      if (!motivo) { mostrarMensaje('Seleccione el motivo del sobrecosto.', 'error'); return; }
      const precio = parseFloat(String(precioTxt).replace(',', '.'));
      if (!precioTxt || isNaN(precio) || precio <= 0) { mostrarMensaje('Ingrese un precio válido mayor a 0.', 'error'); return; }
      if (!moneda) { mostrarMensaje('Seleccione la moneda.', 'error'); return; }

      const resp = await llamarBackend('grabarSobrecosto', {
        tipoSobrecosto: motivo,
        codigoServicio: 'F' + servicio._fila,
        cliente: servicio['CLIENTE PARA FACTURACIÓN'] || '',
        booking: servicio['BOOKING'] || '',
        contenedor: servicio['N° CONTENEDOR'] || '',
        conductor: servicio['CONDUCTOR'] || '',
        placaTracto: servicio['PLACA TRACTO'] || '',
        fechaServicio: self._fechaTxt(servicio),
        moneda: moneda,
        cantidad: 1,
        precioUnitario: precio,
        observacion: observacion
      });

      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      mostrarMensaje(resp.mensaje, 'exito');
      cerrarPanel();
    });
  }
};
