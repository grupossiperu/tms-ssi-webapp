/**
 * forms/deposito.js
 * -------------------------------------------------------------------------
 * Módulo nuevo "Depósito": pantalla de control de los depósitos que hay que
 * hacerle a cada servicio. Lee y escribe directamente sobre la hoja
 * SERVICIOS (mismo campo DEPOSITADO que usa Consolidado de Servicios, así
 * que marcar/desmarcar acá se refleja también allá y viceversa).
 *
 * Columnas (en este orden): Fecha, Cliente, Conductor, Placa, Ciudad de
 * retiro, Destino 1, Destino 2, Ciudad de devolución, Retiro, Gl. tracto,
 * Gl. genset, Total S/. tracto, Total S/. genset, Peajes, Viático, Cochera,
 * Monto total de viaje, Proveedor (SI/NO), Monto a depositar, Depósito
 * adicional, Persona / Medio, Tarifa, y un check "Depositado" editable.
 *
 * "Monto a depositar" es el cálculo automático (misma lógica que
 * calcularMontoDepositado() en Registrar Servicio: si Proveedor = SI se
 * excluye el combustible). Es independiente del botón "+".
 *
 * Filtros: por fecha (Desde/Hasta) y por si está depositado o no.
 * Clic en la fila abre Registrar Servicio para poder modificar los datos.
 *
 * El check "Depositado" es 100% manual: el usuario lo marca cuando ya
 * depositó el monto completo, y eso es lo único que lo cambia.
 * El botón "+" junto al check registra un DEPÓSITO ADICIONAL (un
 * imprevisto del viaje, por ejemplo): pide monto, persona que lo deposita
 * y medio de pago (Transferencia, Yape o Efectivo). Ese adicional se
 * muestra en su propia columna "Depósito adicional" (con quién lo
 * depositó al lado) y NO se suma al "Monto a depositar". Queda guardado
 * tanto en el historial (hoja DEPOSITOS) como en la propia fila del
 * servicio en SERVICIOS (columnas DEPOSITO ADICIONAL, PERSONA DEPOSITO
 * ADICIONAL y MEDIO DEPOSITO ADICIONAL). El botón "+" no marca ni
 * desmarca el check "Depositado".
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
            <th>Total S/. tracto</th><th>Total S/. genset</th>
            <th>Peajes</th><th>Viático</th><th>Cochera</th><th>Monto total de viaje</th>
            <th>Proveedor</th>
            <th>Monto a depositar</th><th>Tarifa</th><th>Depósito adicional</th><th>Persona / Medio</th>
            <th>Depositado</th>
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

    const MEDIOS_VALIDOS = ['TRANSFERENCIA', 'YAPE', 'EFECTIVO'];

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

    function pedirMedioDePago() {
      let intento = 0;
      while (intento < 5) {
        const texto = window.prompt('Medio de pago (escriba: Transferencia, Yape o Efectivo):', '');
        if (texto === null) return null;
        const medio = texto.trim().toUpperCase();
        if (MEDIOS_VALIDOS.indexOf(medio) !== -1) return medio;
        mostrarMensaje('Medio inválido. Escriba exactamente: Transferencia, Yape o Efectivo.', 'error');
        intento++;
      }
      return null;
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

      filas = filas.slice().sort(function (a, b) {
        const da = esVerdadero(a['DEPOSITADO']) ? 1 : 0;
        const db = esVerdadero(b['DEPOSITADO']) ? 1 : 0;
        if (da !== db) return da - db;
        const fa = new Date(a['FECHA DE PROGRAMACION']);
        const fb = new Date(b['FECHA DE PROGRAMACION']);
        const na = isNaN(fa.getTime()) ? Infinity : Math.abs(fa.getTime() - Date.now());
        const nb = isNaN(fb.getTime()) ? Infinity : Math.abs(fb.getTime() - Date.now());
        return na - nb;
      });

      const tbody = raiz.querySelector('#tablaDepositos tbody');
      tbody.innerHTML = '';

      filas.forEach(function (f) {
        // Misma lógica que calcularMontoDepositado() en Registrar Servicio:
        // si el abastecimiento fue por PROVEEDOR, el combustible no entra
        // en el monto a depositar (el proveedor lo factura directo); si
        // fue al CONTADO, sí se incluye.
        const esProveedor = String(f['TIPO DE ABASTECIMIENTO'] || '').trim().toUpperCase() === 'PROVEEDOR';
        const objetivo = esProveedor
          ? (numero(f['VIATICO']) + numero(f['PEAJE']) + numero(f['COCHERA']))
          : (numero(f['VIATICO']) + numero(f['PEAJE']) + numero(f['COCHERA']) + numero(f['TOTAL TRACTO']) + numero(f['TOTAL GENERADOR']));

        const depositoAdicional = numero(f['DEPOSITO ADICIONAL']);
        const personaAdicional = f['PERSONA DEPOSITO ADICIONAL'] || '';
        const medioAdicional = f['MEDIO DEPOSITO ADICIONAL'] || '';
        const personaMedioTexto = personaAdicional
          ? (personaAdicional + (medioAdicional ? ' (' + medioAdicional + ')' : ''))
          : '';

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
          <td>S/ ${numero(f['TOTAL TRACTO']).toFixed(2)}</td>
          <td>S/ ${numero(f['TOTAL GENERADOR']).toFixed(2)}</td>
          <td>S/ ${numero(f['PEAJE']).toFixed(2)}</td>
          <td>S/ ${numero(f['VIATICO']).toFixed(2)}</td>
          <td>S/ ${numero(f['COCHERA']).toFixed(2)}</td>
          <td>S/ ${numero(f['TOTAL POR VIAJE']).toFixed(2)}</td>
          <td>${esProveedor ? 'SI' : 'NO'}</td>
          <td>S/ ${objetivo.toFixed(2)}</td>
          <td>${simboloMoneda(f['MONEDA TARIFA 1'])}${numero(f['TARIFA 1']).toFixed(2)}</td>
          <td>${depositoAdicional > 0 ? 'S/ ' + depositoAdicional.toFixed(2) : ''}</td>
          <td>${personaMedioTexto}</td>
          <td style="text-align:center; white-space:nowrap;">
            <input type="checkbox" class="chk-depositado" ${esVerdadero(f['DEPOSITADO']) ? 'checked' : ''}>
            <button type="button" class="boton-mas" style="width:22px; height:22px; padding:0; font-size:.9rem; vertical-align:middle;" title="Registrar un depósito adicional">+</button>
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
            'Monto del depósito adicional para ' + (f['CONDUCTOR'] || 'este servicio') +
            (depositoAdicional > 0 ? '\n(Ya tiene S/ ' + depositoAdicional.toFixed(2) + ' registrado; esto se sumará a eso.)' : ''),
            ''
          );
          if (montoTxt === null || montoTxt.trim() === '') return;
          const monto = numero(montoTxt);
          if (!monto || monto <= 0) {
            mostrarMensaje('Ingrese un monto válido mayor a 0.', 'error');
            return;
          }

          const personaTxt = window.prompt('¿Quién realiza el depósito?', '');
          if (personaTxt === null || personaTxt.trim() === '') {
            mostrarMensaje('Debe indicar quién realiza el depósito.', 'error');
            return;
          }

          const medio = pedirMedioDePago();
          if (!medio) return;

          const resp = await llamarBackend('registrarDeposito', {
            fila: f._fila,
            monto: monto,
            persona: personaTxt.trim(),
            medio: medio
          });
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
