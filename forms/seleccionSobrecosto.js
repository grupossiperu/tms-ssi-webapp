/**
 * forms/seleccionSobrecosto.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmSeleccionSobrecosto.frm (VBA): busca y selecciona
 * el servicio consolidado al que se le imputará el sobrecosto, con el
 * mismo filtro de texto libre (txtBuscar_Change) y luego abre
 * frmRegistroSobrecosto con los datos precargados.
 * -------------------------------------------------------------------------
 */
const FormSeleccionSobrecosto = {

  abrir: function (tipoSobrecosto) {
    const html = `
      <div class="campo"><label>Buscar</label><input type="text" id="txtBuscar" placeholder="Código, cliente, booking, conductor..."></div>
      <div style="max-height:340px; overflow:auto;">
        <table class="tabla-lista" id="tablaSobrecosto">
          <thead><tr><th>Código</th><th>Cliente</th><th>Booking</th><th>Conductor</th><th>Placa</th><th>Fecha</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnCancelarSobreestadia">Cancelar</button>
        <button class="boton-primario" id="btnContinuarSobreestadia">Continuar</button>
      </div>`;

    abrirPanel('Seleccionar servicio - ' + tipoSobrecosto, html, (raiz) => this._wire(raiz, tipoSobrecosto));
  },

  _wire: function (raiz, tipoSobrecosto) {
    let filaSeleccionada = null;

    async function cargar(texto) {
      const filas = await llamarBackend('listarServiciosParaSobrecosto', { texto: texto || '' });
      const tbody = raiz.querySelector('#tablaSobrecosto tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        const fecha = f['FECHA DEL SERVICIO'] ? new Date(f['FECHA DEL SERVICIO']) : null;
        const fechaTxt = fecha && !isNaN(fecha.getTime()) ? (String(fecha.getDate()).padStart(2,'0')+'/'+String(fecha.getMonth()+1).padStart(2,'0')+'/'+fecha.getFullYear()) : '-';
        tr.innerHTML = `<td>${f['CODIGO DEL SERVICIO']||''}</td><td>${f['CLIENTE PARA FACTURACIÓN']||''}</td>
          <td>${f['BOOKING']||''}</td><td>${f['CONDUCTOR']||''}</td><td>${f['PLACA TRACTO']||''}</td><td>${fechaTxt}</td>`;
        tr.addEventListener('click', function () {
          tbody.querySelectorAll('tr').forEach(x => x.classList.remove('seleccionada'));
          tr.classList.add('seleccionada');
          filaSeleccionada = f;
        });
        tbody.appendChild(tr);
      });
    }

    raiz.querySelector('#txtBuscar').addEventListener('input', function () { cargar(this.value); });
    raiz.querySelector('#btnCancelarSobreestadia').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnContinuarSobreestadia').addEventListener('click', function () {
      if (!filaSeleccionada) {
        mostrarMensaje('Seleccione un servicio para continuar.', 'error');
        return;
      }
      FormRegistroSobrecosto.abrir(tipoSobrecosto, filaSeleccionada);
    });

    cargar('');
  }
};
