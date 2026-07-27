/**
 * forms/peajes.js
 * -------------------------------------------------------------------------
 * Pantalla nueva "Gestionar Peajes" (no existía en el VBA original). Muestra
 * la lista de la hoja BD_PEAJES y permite editar el costo (COSTO 6 EJES)
 * de un peaje puntual con un botón "Editar" por fila, guardando el cambio
 * de inmediato en la hoja.
 * -------------------------------------------------------------------------
 */
const FormPeajes = {

  abrir: async function () {
    const html = `
      <div style="margin-bottom:10px; font-size:.85rem; color:#5a6672;">
        Lista de peajes registrados. Usa "Editar" para actualizar el costo de un peaje.
      </div>
      <table class="tabla-lista" id="tablaPeajes">
        <thead>
          <tr>
            <th>Sentido</th>
            <th>Peaje</th>
            <th>Costo 6 ejes (S/)</th>
            <th>Ubicación</th>
            <th>Departamento</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="cuerpoTablaPeajes">
          <tr><td colspan="6">Cargando...</td></tr>
        </tbody>
      </table>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarPeajes">Cerrar</button>
      </div>`;

    abrirPanel('Gestionar Peajes', html, (raiz) => this._wire(raiz));
  },

  _wire: async function (raiz) {
    raiz.querySelector('#btnCerrarPeajes').addEventListener('click', cerrarPanel);

    const resp = await llamarBackend('listarPeajes', {});
    if (!resp.ok) {
      mostrarMensaje(resp.mensaje || 'No se pudo cargar la lista de peajes.', 'error');
      return;
    }

    this._pintar(raiz, resp.peajes || []);
  },

  _pintar: function (raiz, peajes) {
    const cuerpo = raiz.querySelector('#cuerpoTablaPeajes');
    if (!peajes.length) {
      cuerpo.innerHTML = '<tr><td colspan="6">No hay peajes registrados.</td></tr>';
      return;
    }

    const self = this;
    cuerpo.innerHTML = peajes.map(function (p) {
      const costo = Number(p['COSTO 6 EJES']) || 0;
      return `
        <tr data-fila="${p._fila}">
          <td>${p['SENTIDO'] || ''}</td>
          <td>${p['PEAJES'] || ''}</td>
          <td class="celda-costo">S/ ${costo.toFixed(2)}</td>
          <td>${p['UBICACION'] || ''}</td>
          <td>${p['DEPARTAMENTO'] || ''}</td>
          <td><button type="button" class="boton-secundario btn-editar-peaje">Editar</button></td>
        </tr>`;
    }).join('');

    cuerpo.querySelectorAll('.btn-editar-peaje').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const fila = btn.closest('tr').getAttribute('data-fila');
        self._editar(raiz, fila, btn);
      });
    });
  },

  _editar: async function (raiz, fila, btn) {
    const filaTr = btn.closest('tr');
    const nombrePeaje = filaTr.children[1].textContent;
    const costoActual = filaTr.querySelector('.celda-costo').textContent.replace('S/', '').trim();

    const nuevoValor = prompt('Nuevo costo (6 ejes) para "' + nombrePeaje + '":', costoActual);
    if (nuevoValor === null) return;

    const resp = await llamarBackend('actualizarPeaje', { fila: fila, costo: nuevoValor });
    if (!resp.ok) {
      mostrarMensaje(resp.mensaje || 'No se pudo actualizar el peaje.', 'error');
      return;
    }

    filaTr.querySelector('.celda-costo').textContent = 'S/ ' + Number(resp.costo).toFixed(2);
    mostrarMensaje(resp.mensaje, 'exito');
  }
};
