/**
 * forms/tipoCambio.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmTipoCambio.frm (VBA). Registra/actualiza el tipo
 * de cambio para una fecha. Misma validación y misma pregunta de
 * confirmación cuando la fecha ya existe (btnGrabarTC_Click original).
 * -------------------------------------------------------------------------
 */
const FormTipoCambio = {

  abrir: function () {
    const hoy = new Date();
    const hoyTxt = String(hoy.getDate()).padStart(2, '0') + '/' +
                   String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear();

    const html = `
      <div class="campo">
        <label>Fecha de facturación</label>
        <input type="text" id="txtFechaFacturacionTC" placeholder="dd/mm/yyyy" value="${hoyTxt}">
      </div>
      <div class="campo">
        <label>Tipo de cambio</label>
        <input type="text" id="txtTipoCambioTC" placeholder="0.000">
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnInicioTC">Inicio</button>
        <button class="boton-primario" id="btnGrabarTC">Grabar</button>
      </div>`;

    abrirPanel('Registro de Tipo de Cambio', html, function (raiz) {

      raiz.querySelector('#btnInicioTC').addEventListener('click', cerrarPanel);

      raiz.querySelector('#btnGrabarTC').addEventListener('click', function () {
        grabar(raiz, false);
      });

      async function grabar(raiz, confirmarActualizacion) {
        const fechaFacturacion = raiz.querySelector('#txtFechaFacturacionTC').value.trim();
        const tipoCambio = raiz.querySelector('#txtTipoCambioTC').value.trim();

        const resp = await llamarBackend('grabarTipoCambio', {
          fechaFacturacion: fechaFacturacion, tipoCambio: tipoCambio,
          confirmarActualizacion: confirmarActualizacion
        });

        if (!resp.ok) {
          if (resp.requiereConfirmacion) {
            if (confirmar(resp.mensaje)) {
              grabar(raiz, true);
            }
            return;
          }
          mostrarMensaje(resp.mensaje, 'error');
          return;
        }

        mostrarMensaje(resp.mensaje, 'exito');
        raiz.querySelector('#txtFechaFacturacionTC').value = hoyTxt;
        raiz.querySelector('#txtTipoCambioTC').value = '';
        raiz.querySelector('#txtFechaFacturacionTC').focus();
      }
    });
  }
};
