/**
 * forms/registroSobrecosto.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmRegistroSobrecosto.frm (VBA). Etiquetas dinámicas
 * según el tipo (Horas/Precio x hora para Sobreestadía, Días/Precio x día
 * para Pernocte), cálculo IGV al 18% en ambos sentidos (desde
 * cantidad×precio, o editando subtotal/total directamente), y las mismas
 * validaciones obligatorias de btnGuardar_Click.
 * -------------------------------------------------------------------------
 */
const FormRegistroSobrecosto = {

  abrir: function (tipoSobrecosto, servicio) {
    const etiquetas = tipoSobrecosto === 'PERNOCTE'
      ? { cantidad: 'DÍAS:', precio: 'PRECIO X DÍA:' }
      : { cantidad: 'HORAS:', precio: 'PRECIO X HORA:' };

    const fecha = servicio['FECHA DEL SERVICIO'] ? new Date(servicio['FECHA DEL SERVICIO']) : null;
    const fechaTxt = fecha && !isNaN(fecha.getTime())
      ? (String(fecha.getDate()).padStart(2,'0')+'/'+String(fecha.getMonth()+1).padStart(2,'0')+'/'+fecha.getFullYear()) : '-';

    const html = `
      <input type="hidden" id="txtTipoSobrecosto" value="${tipoSobrecosto}">
      <div class="fila-campos">
        <div class="campo"><label>Código de servicio</label><input id="txtCodigoServicio" value="${servicio['CODIGO DEL SERVICIO']||''}" disabled></div>
        <div class="campo"><label>Cliente</label><input id="txtCliente" value="${servicio['CLIENTE PARA FACTURACIÓN']||''}" disabled></div>
        <div class="campo"><label>Booking</label><input id="txtBooking" value="${servicio['BOOKING']||''}" disabled></div>
        <div class="campo"><label>Contenedor</label><input id="txtContenedor" value="${servicio['Nº CONTENEDOR']||''}" disabled></div>
        <div class="campo"><label>Conductor</label><input id="txtConductor" value="${servicio['CONDUCTOR']||''}" disabled></div>
        <div class="campo"><label>Placa tracto</label><input id="txtPlacaTracto" value="${servicio['PLACA TRACTO']||''}" disabled></div>
        <div class="campo"><label>Fecha de servicio</label><input id="txtFechaServicio" value="${fechaTxt}" disabled></div>
        <div class="campo"><label>Moneda</label>
          <select id="cboMoneda"><option value=""></option><option value="S/">S/</option><option value="$">$</option></select>
        </div>
        <div class="campo"><label id="lblCantidad">${etiquetas.cantidad}</label><input id="txtCantidad"></div>
        <div class="campo"><label id="lblPrecio">${etiquetas.precio}</label><input id="txtPrecioUnitario"></div>
        <div class="campo"><label>Subtotal</label><input id="txtSubtotal"></div>
        <div class="campo"><label>IGV (18%)</label><input id="txtIGV" disabled></div>
        <div class="campo"><label>Total</label><input id="txtTotal"></div>
        <div class="campo"><label>Observación</label><input id="txtObservacion"></div>
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnCancelar">Cancelar</button>
        <button class="boton-primario" id="btnGuardar">Guardar</button>
      </div>`;

    abrirPanel('Registro de Sobrecosto - ' + tipoSobrecosto, html, (raiz) => this._wire(raiz, servicio));
  },

  _n: function (t) {
    if (t === null || t === undefined) return 0;
    const n = parseFloat(String(t).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  },

  _wire: function (raiz, servicio) {
    const self = this;
    let actualizando = false;

    function calcularDesdeCantidadPrecio() {
      if (actualizando) return;
      const cantidad = self._n(raiz.querySelector('#txtCantidad').value);
      const precio = self._n(raiz.querySelector('#txtPrecioUnitario').value);
      if (raiz.querySelector('#txtCantidad').value.trim() === '' || raiz.querySelector('#txtPrecioUnitario').value.trim() === '') return;

      actualizando = true;
      const total = cantidad * precio; // el precio ingresado incluye IGV
      const subtotal = total / 1.18;
      const igv = total - subtotal;
      raiz.querySelector('#txtSubtotal').value = subtotal.toFixed(2);
      raiz.querySelector('#txtIGV').value = igv.toFixed(2);
      raiz.querySelector('#txtTotal').value = total.toFixed(2);
      actualizando = false;
    }

    raiz.querySelector('#txtCantidad').addEventListener('input', calcularDesdeCantidadPrecio);
    raiz.querySelector('#txtPrecioUnitario').addEventListener('input', calcularDesdeCantidadPrecio);

    raiz.querySelector('#txtSubtotal').addEventListener('input', function () {
      if (actualizando || this.value.trim() === '') return;
      actualizando = true;
      const subtotal = self._n(this.value);
      raiz.querySelector('#txtIGV').value = (subtotal * 0.18).toFixed(2);
      raiz.querySelector('#txtTotal').value = (subtotal * 1.18).toFixed(2);
      actualizando = false;
    });

    raiz.querySelector('#txtTotal').addEventListener('input', function () {
      if (actualizando || this.value.trim() === '') return;
      actualizando = true;
      const total = self._n(this.value);
      const subtotal = total / 1.18;
      raiz.querySelector('#txtSubtotal').value = subtotal.toFixed(2);
      raiz.querySelector('#txtIGV').value = (total - subtotal).toFixed(2);
      actualizando = false;
    });

    raiz.querySelector('#btnCancelar').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnGuardar').addEventListener('click', async function () {
      const v = (id) => raiz.querySelector('#' + id).value;

      if (v('txtTipoSobrecosto').trim() === '') { mostrarMensaje('Seleccione el tipo de sobrecosto.', 'error'); return; }
      if (v('txtCodigoServicio').trim() === '') { mostrarMensaje('Ingrese el código de servicio.', 'error'); return; }
      if (v('cboMoneda').trim() === '') { mostrarMensaje('Seleccione la moneda.', 'error'); return; }
      if (v('txtCantidad').trim() === '') { mostrarMensaje('Ingrese la cantidad.', 'error'); return; }
      if (v('txtPrecioUnitario').trim() === '') { mostrarMensaje('Ingrese el precio unitario.', 'error'); return; }

      const resp = await llamarBackend('grabarSobrecosto', {
        tipoSobrecosto: v('txtTipoSobrecosto'), codigoServicio: v('txtCodigoServicio'),
        cliente: v('txtCliente'), booking: v('txtBooking'), contenedor: v('txtContenedor'),
        conductor: v('txtConductor'), placaTracto: v('txtPlacaTracto'), fechaServicio: v('txtFechaServicio'),
        moneda: v('cboMoneda'), cantidad: v('txtCantidad'), precioUnitario: v('txtPrecioUnitario'),
        observacion: v('txtObservacion')
      });

      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      mostrarMensaje(resp.mensaje, 'exito');
      cerrarPanel();
    });
  }
};
