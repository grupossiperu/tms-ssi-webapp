/**
 * forms/controlCombustible.js
 * -------------------------------------------------------------------------
 * Módulo "Control de Combustible" (botón de la pantalla principal).
 * Primera versión: lista TODOS los servicios (sin importar el estado:
 * programado, en ruta o culminado) con: Fecha, Cliente, Conductor, Placa,
 * Booking, Reefer o Seco, Retiro, Galones Tracto y una casilla "Abasteció"
 * para marcar si ya se hizo el abastecimiento de combustible del tracto.
 *
 * La casilla "Abasteció" graba de inmediato al marcarla/desmarcarla
 * (columna SERVICIOS['COMBUSTIBLE ABASTECIDO']), sin necesidad de un botón
 * "Grabar" aparte.
 * -------------------------------------------------------------------------
 */
const FormControlCombustible = {

  abrir: async function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Desde</label><input type="text" id="filtroComDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroComHasta" placeholder="dd/mm/yyyy"></div>
        <button class="boton-secundario" id="btnBorrarFiltroCom">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaControlCombustible">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Conductor</th><th>Placa</th><th>Booking</th>
            <th>Reefer o Seco</th><th>Retiro</th><th>Galones Tracto</th><th>Abasteció</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarControlCombustible">Cerrar</button>
      </div>`;

    abrirPanel('Control de Combustible', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _wire: function (raiz) {

    function formatoFecha(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    function esVerdadero(v) {
      return v === true || String(v).trim().toUpperCase() === 'TRUE' || String(v).trim().toUpperCase() === 'SI';
    }

    async function cargar() {
      const filtros = {
        fechaDesde: raiz.querySelector('#filtroComDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroComHasta').value.trim()
      };
      // Sin filtro de estado: se listan todos los servicios (programados,
      // en ruta y culminados) para el control de combustible.
      let filas = await llamarBackend('listarServiciosPendientes', filtros);

      filas = filas.slice().sort(function (a, b) {
        const da = new Date(a['FECHA DE PROGRAMACION']);
        const db = new Date(b['FECHA DE PROGRAMACION']);
        const ta = isNaN(da.getTime()) ? -Infinity : da.getTime();
        const tb = isNaN(db.getTime()) ? -Infinity : db.getTime();
        return tb - ta;
      });

      const tbody = raiz.querySelector('#tablaControlCombustible tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        tr.innerHTML = `
          <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
          <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
          <td>${f['CONDUCTOR'] || ''}</td>
          <td>${f['PLACA TRACTO'] || ''}</td>
          <td>${f['BOOKING'] || ''}</td>
          <td>${f['REEFER O DRY'] || ''}</td>
          <td>${f['DEPOSITO DE RETIRO'] || ''}</td>
          <td style="text-align:right;">${f['GL TRACTO'] || ''}</td>
          <td style="text-align:center;"><input type="checkbox" class="chk-abastecio"></td>`;

        const chk = tr.querySelector('.chk-abastecio');
        chk.checked = esVerdadero(f['COMBUSTIBLE ABASTECIDO']);
        chk.addEventListener('change', async function () {
          chk.disabled = true;
          const resp = await llamarBackend('actualizarAbastecido', { fila: f._fila, abastecido: chk.checked });
          chk.disabled = false;
          if (!resp || !resp.ok) {
            chk.checked = !chk.checked;
            mostrarMensaje((resp && resp.mensaje) || 'No se pudo grabar el cambio.', 'error');
          }
        });

        tbody.appendChild(tr);
      });

      if (!filas.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="9" style="text-align:center; color:#8b95a1; padding:18px;">No hay servicios con estos filtros.</td>';
        tbody.appendChild(tr);
      }
    }

    ['filtroComDesde', 'filtroComHasta'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    raiz.querySelector('#btnBorrarFiltroCom').addEventListener('click', function () {
      raiz.querySelector('#filtroComDesde').value = '';
      raiz.querySelector('#filtroComHasta').value = '';
      cargar();
    });

    raiz.querySelector('#btnCerrarControlCombustible').addEventListener('click', cerrarPanel);

    cargar();
  }
};
