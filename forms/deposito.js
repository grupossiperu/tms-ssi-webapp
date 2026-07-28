/**
 * forms/deposito.js
 * -------------------------------------------------------------------------
 * Módulo nuevo "Depósito": pantalla de control de los depósitos que hay que
 * hacerle a cada servicio. Lee y escribe directamente sobre la hoja
 * SERVICIOS (mismo campo DEPOSITADO que usa Consolidado de Servicios, así
 * que marcar/desmarcar acá se refleja también allá y viceversa).
 *
 * Columnas: Fecha, Cliente, Conductor, Placa, Ciudad de retiro, Destino 1,
 * Destino 2, Ciudad de devolución, Retiro, Gl. tracto, Gl. genset, Peajes,
 * Viático, Cochera, Proveedor (si el abastecimiento fue por proveedor o al
 * contado), Total a depositar, Tarifa, y un check "Depositado" editable.
 *
 * Filtros: por fecha (Desde/Hasta) y por si está depositado o no.
 * Clic en la fila abre Registrar Servicio para poder modificar los datos.
 *
 * El check "Depositado" es 100% manual: el usuario lo marca cuando ya
 * depositó el monto completo, y eso es lo único que lo cambia.
 * El botón "+" junto al check es para otra cosa: a veces hay que hacerle al
 * conductor un depósito ADICIONAL, fuera del "Total a depositar" calculado
 * (un imprevisto del viaje, por ejemplo). Ese botón solo deja un historial
 * de esos depósitos extra — nunca marca ni desmarca el check.
 * -------------------------------------------------------------------------
 */
const FormDeposito = {

  abrir: async function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Desde</label><input type="text" id="filtroDepDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroDepHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Depositado</label>
          <select id="filtroDepEstado">
            <option value="">Todos</option>
            <option value="si">Depositado</option>
            <option value="no">No depositado</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnDepBorrarFiltro">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaDepositos">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Conductor</th><th>Placa</th>
            <th>Ciudad retiro</th><th>Destino 1</th><th>Destino 2</th><th>Ciudad devolución</th>
            <th>Retiro</th><th>Gl. tracto</th><th>Gl. genset</th>
            <th>Peajes</th><th>Viático</th><th>Cochera</th><th>Proveedor</th>
            <th>Total a depositar</th><th>Tarifa</th><th>Depositado</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnDepCerrar">Cerrar</button>
      </div>`;

    abrirPanel('Depósito', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _wire: function (raiz) {

    function numero(v) {
      if (v === null || v === undefined) return 0;
      const n = parseFloat(String(v).replace(/S\//g, '').replace(/\$/g, '').replace(/\s/g, '').replace(',', '.'));
      return isNaN(n) ? 0 : n;
    }

    function formatoFecha(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    function formatoHora(v) {
      if (v === null || v === undefined || v === '' || v === '-') return '';
      if (v instanceof Date) {
        return String(v.getUTCHours()).padStart(2, '0') + ':' + String(v.getUTCMinutes()).padStart(2, '0');
      }
      const texto = String(v).trim();
      if (/^\d{1,2}:\d{2}/.test(texto)) return texto.slice(0, 5);
      const d = new Date(texto);
      if (!isNaN(d.getTime()) && /T\d{2}:\d{2}/.test(texto)) {
        return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
      }
      return texto;
    }

    function formatoFechaHora(fecha, hora) {
      const f = formatoFecha(fecha);
      const h = formatoHora(hora);
      if (f === '' && h === '') return '';
      if (h === '') return f;
      return (f + ' ' + h).trim();
    }

    function esVerdadero(v) {
      return v === true || String(v).trim().toUpperCase() === 'TRUE' || String(v).trim().toUpperCase() === 'SI';
    }

    function simboloMoneda(m) {
      return String(m || '').trim().toUpperCase() === 'D' ? '$ ' : 'S/ ';
    }

    async function cargar() {
      const filtros = {
        fechaDesde: raiz.querySelector('#filtroDepDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroDepHasta').value.trim()
      };
      let filas = await llamarBackend('listarServiciosPendientes', filtros);

      const dep = raiz.querySelector('#filtroDepEstado').value;
      if (dep === 'si') filas = filas.filter(f => esVerdadero(f['DEPOSITADO']));
      if (dep === 'no') filas = filas.filter(f => !esVerdadero(f['DEPOSITADO']));

      const resumen = await llamarBackend('resumenDepositos', {});

      const tbody = raiz.querySelector('#tablaDepositos tbody');
      tbody.innerHTML = '';

      filas.forEach(function (f) {
        const objetivo = numero(f['MONTO DEPOSITADO']);
        const adicional = numero(resumen[f._fila]);

        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        tr.innerHTML = `
          <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
          <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
          <td>${f['CONDUCTOR'] || ''}</td>
          <td>${f['PLACA TRACTO'] || ''}</td>
          <td>${f['CIUDAD DE RETIRO'] || ''}</td>
          <td>${f['DESTINO 1'] || ''}</td>
          <td>${f['DESTINO 2'] || ''}</td>
          <td>${f['CIUDAD DE DEVOLUCION'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE RETIRO'], f['HORA DE RETIRO'])}</td>
          <td>${numero(f['GL TRACTO']).toFixed(2)}</td>
          <td>${numero(f['GL GENERADOR']).toFixed(2)}</td>
          <td>S/ ${numero(f['PEAJE']).toFixed(2)}</td>
          <td>S/ ${numero(f['VIATICO']).toFixed(2)}</td>
          <td>S/ ${numero(f['COCHERA']).toFixed(2)}</td>
          <td>${f['TIPO DE ABASTECIMIENTO'] || ''}</td>
          <td>S/ ${objetivo.toFixed(2)}${adicional > 0 ? ' <span style="color:#1c3a5e;font-size:.72rem;" title="Depósitos adicionales registrados para este servicio">(+S/ ' + adicional.toFixed(2) + ')</span>' : ''}</td>
          <td>${simboloMoneda(f['MONEDA TARIFA 1'])}${numero(f['TARIFA 1']).toFixed(2)}</td>
          <td style="text-align:center; white-space:nowrap;">
            <input type="checkbox" class="chk-depositado" ${esVerdadero(f['DEPOSITADO']) ? 'checked' : ''}>
            <button type="button" class="boton-mas" style="width:22px; height:22px; padding:0; font-size:.9rem; vertical-align:middle;" title="Registrar un depósito adicional (fuera del total a depositar)">+</button>
          </td>`;

        const chk = tr.querySelector('.chk-depositado');
        chk.addEventListener('click', function (ev) { ev.stopPropagation(); });
        chk.addEventListener('change', async function () {
          await llamarBackend('actualizarDepositado', { fila: f._fila, depositado: this.checked });
        });

        const btnMas = tr.querySelector('.boton-mas');
        btnMas.addEventListener('click', async function (ev) {
          ev.stopPropagation();

          const montoTxt = window.prompt(
            'Monto del depósito ADICIONAL para ' + (f['CONDUCTOR'] || 'este servicio') +
            '\n(Esto es dinero extra, fuera del Total a depositar de S/ ' + objetivo.toFixed(2) + '. No afecta el check "Depositado".)' +
            (adicional > 0 ? '\nYa registrado como adicional: S/ ' + adicional.toFixed(2) : ''),
            ''
          );
          if (montoTxt === null || montoTxt.trim() === '') return;
          const monto = numero(montoTxt);
          if (!monto || monto <= 0) {
            mostrarMensaje('Ingrese un monto válido mayor a 0.', 'error');
            return;
          }
          const medio = window.prompt('Medio de pago (efectivo, transferencia, etc.) - opcional:', '') || '';

          const resp = await llamarBackend('registrarDeposito', { fila: f._fila, monto: monto, medio: medio });
          if (!resp.ok) {
            mostrarMensaje(resp.mensaje, 'error');
            return;
          }
          mostrarMensaje(resp.mensaje, 'exito');
          cargar();
        });

        tr.addEventListener('click', function () {
          FormServicio.abrir(f._fila);
        });

        tbody.appendChild(tr);
      });
    }

    ['filtroDepDesde', 'filtroDepHasta', 'filtroDepEstado'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    raiz.querySelector('#btnDepBorrarFiltro').addEventListener('click', function () {
      raiz.querySelector('#filtroDepDesde').value = '';
      raiz.querySelector('#filtroDepHasta').value = '';
      raiz.querySelector('#filtroDepEstado').value = '';
      cargar();
    });

    raiz.querySelector('#btnDepCerrar').addEventListener('click', cerrarPanel);

    cargar();
  }
};
