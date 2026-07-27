/**
 * forms/accesoServicios.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmAccesoServicios.frm (VBA). Protege el botón "Ver"
 * de la pantalla principal. Misma validación que btnIngresarServ_Click:
 * usuario y clave obligatorios, y credenciales verificadas contra
 * CONFIG.USUARIOS_ACCESO_SERVICIOS en el backend.
 * -------------------------------------------------------------------------
 */
const FormAccesoServicios = {

  abrir: function (alConceder) {
    const html = `
      <div class="campo">
        <label>Usuario</label>
        <input type="text" id="txtUsuarioServ" autocomplete="off">
      </div>
      <div class="campo">
        <label>Contraseña</label>
        <input type="password" id="txtClaveServ">
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnCancelarServ">Cancelar</button>
        <button class="boton-primario" id="btnIngresarServ">Ingresar</button>
      </div>`;

    abrirPanel('Acceso a Hojas de Servicios', html, function (raiz) {
      raiz.querySelector('#txtUsuarioServ').focus();

      raiz.querySelector('#btnCancelarServ').addEventListener('click', cerrarPanel);

      raiz.querySelector('#btnIngresarServ').addEventListener('click', async function () {
        const usuario = raiz.querySelector('#txtUsuarioServ').value.trim();
        const clave = raiz.querySelector('#txtClaveServ').value.trim();

        if (usuario === '') {
          mostrarMensaje('Ingrese el usuario.', 'error');
          raiz.querySelector('#txtUsuarioServ').focus();
          return;
        }
        if (clave === '') {
          mostrarMensaje('Ingrese la contraseña.', 'error');
          raiz.querySelector('#txtClaveServ').focus();
          return;
        }

        const resp = await llamarBackend('validarAccesoServicios', { usuario: usuario, clave: clave });

        if (!resp.ok) {
          mostrarMensaje(resp.mensaje, 'error');
          raiz.querySelector('#txtClaveServ').value = '';
          raiz.querySelector('#txtClaveServ').focus();
          return;
        }

        mostrarMensaje(resp.mensaje, 'exito');
        cerrarPanel();
        if (typeof alConceder === 'function') alConceder();
      });
    });
  }
};
