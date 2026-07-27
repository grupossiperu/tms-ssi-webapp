/**
 * forms/conductores.js
 * -------------------------------------------------------------------------
 * Pantalla nueva "Lista de Conductores" (no existía como pantalla propia en
 * el VBA original). Muestra la lista de la hoja PERSONAL, permite agregar
 * un conductor nuevo y editar el nombre/DNI de uno existente por si quedó
 * mal escrito, guardando el cambio de inmediato en la hoja.
 * -------------------------------------------------------------------------
 */
const FormConductores = {

  abrir: async function () {
    const html = `
      <div style="margin-bottom:10px; font-size:.85rem; color:#5a6672; display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <span>Lista de conductores registrados. Usa "Editar" para corregir el nombre o DNI.</span>
        <button class="boton-primario" id="btnAgregarConductorLista" style="white-space:nowrap;">+ Agregar conductor</button>
      </div>
      <table class="tabla-lista" id="tablaConductores">
        <thead>
          <tr>
            <th>Conductor</th>
            <th>N° DNI</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="cuerpoTablaConductores">
          <tr><td colspan="3">Cargando...</td></tr>
        </tbody>
      </table>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarConductores">Cerrar</button>
      </div>`;

    abrirPanel('Lista de Conductores', html, (raiz) => this._wire(raiz));
  },

  _wire: async function (raiz) {
    const self = this;
    raiz.querySelector('#btnCerrarConductores').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnAgregarConductorLista').addEventListener('click', async function () {
      const nombre = prompt('Nombre completo del conductor:');
      if (nombre === null || nombre.trim() === '') return;
      const dni = prompt('N° de DNI del conductor:');
      if (dni === null || dni.trim() === '') return;
      const resp = await llamarBackend('agregarConductor', { conductor: nombre, dni: dni });
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      mostrarMensaje(resp.mensaje, 'exito');
      self._cargar(raiz);
    });

    await this._cargar(raiz);
  },

  _cargar: async function (raiz) {
    const resp = await llamarBackend('listarConductores', {});
    if (!resp.ok) {
      mostrarMensaje(resp.mensaje || 'No se pudo cargar la lista de conductores.', 'error');
      return;
    }
    this._pintar(raiz, resp.conductores || []);
  },

  _pintar: function (raiz, conductores) {
    const cuerpo = raiz.querySelector('#cuerpoTablaConductores');
    if (!conductores.length) {
      cuerpo.innerHTML = '<tr><td colspan="3">No hay conductores registrados.</td></tr>';
      return;
    }

    const self = this;
    cuerpo.innerHTML = conductores.map(function (c) {
      return `
        <tr data-fila="${c._fila}">
          <td class="celda-conductor">${c['CONDUCTOR'] || ''}</td>
          <td class="celda-dni">${c['N° DNI'] || ''}</td>
          <td><button type="button" class="boton-secundario btn-editar-conductor">Editar</button></td>
        </tr>`;
    }).join('');

    cuerpo.querySelectorAll('.btn-editar-conductor').forEach(function (btn) {
      btn.addEventListener('click', function () {
        self._editar(raiz, btn);
      });
    });
  },

  _editar: async function (raiz, btn) {
    const filaTr = btn.closest('tr');
    const fila = filaTr.getAttribute('data-fila');
    const nombreActual = filaTr.querySelector('.celda-conductor').textContent;
    const dniActual = filaTr.querySelector('.celda-dni').textContent;

    const nuevoNombre = prompt('Nombre completo del conductor:', nombreActual);
    if (nuevoNombre === null || nuevoNombre.trim() === '') return;
    const nuevoDni = prompt('N° de DNI del conductor:', dniActual);
    if (nuevoDni === null || nuevoDni.trim() === '') return;

    const resp = await llamarBackend('actualizarConductor', { fila: fila, conductor: nuevoNombre, dni: nuevoDni });
    if (!resp.ok) {
      mostrarMensaje(resp.mensaje || 'No se pudo actualizar el conductor.', 'error');
      return;
    }

    filaTr.querySelector('.celda-conductor').textContent = resp.conductor;
    filaTr.querySelector('.celda-dni').textContent = resp.dni;
    mostrarMensaje(resp.mensaje, 'exito');
  }
};
