/**
 * forms/sobrecostos.js
 * -------------------------------------------------------------------------
 * Módulo "Sobrecostos": muestra la misma lista de servicios y los mismos
 * filtros que Acarreo (Estado, Conductor, Cliente, Desde, Hasta, Datos),
 * pero sin los botones de cambio de estado (Programado/En Ruta/Culminado/
 * Falso Flete/Cancelar viaje), porque acá no se gestiona el viaje sino
 * que se le imputan sobrecostos.
 *
 * Al hacer clic en una fila se abre FormRegistroSobrecosto con los datos
 * de ese servicio precargados, para asignar el motivo del sobrecosto
 * (Sobreestadía, Pernocte, Falsa Nombrada, Falso Flete, Punto Adicional,
 * Horas Adicionales), una observación y el precio con su moneda.
 * -------------------------------------------------------------------------
 */
const FormSobrecostos = {

  abrir: async function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Estado</label>
          <select id="filtroEstadoSobrecosto">
            <option value="">Todos</option>
            <option>PROGRAMADO</option><option>EN RUTA</option>
            <option>CULMINADO</option><option>FALSO FLETE</option>
            <option>CANCELADO</option>
          </select>
        </div>
        <div class="campo"><label>Conductor</label>
          <select id="filtroConductorSobrecosto">
            <option value="">Todos</option>
          </select>
        </div>
        <div class="campo"><label>Cliente</label>
          <select id="filtroClienteSobrecosto">
            <option value="">Todos</option>
          </select>
        </div>
        <div class="campo"><label>Desde</label><input type="text" id="filtroDesdeSobrecosto" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroHastaSobrecosto" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Datos</label>
          <select id="filtroDatosSobrecosto">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Datos incompletos</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltroSobrecosto">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaSobrecostos">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Conductor</th><th>Placa</th><th>Booking</th>
            <th>Reefer o Seco</th><th>Ciudad de retiro</th><th>Depósito de retiro</th><th>Retiro</th>
            <th>Destino 1</th><th>Packing</th><th>Posicionamiento</th><th>Destino 2</th><th>Posicionamiento 2</th>
            <th>Depósito de devolución</th><th>Fecha y hora de devolución</th>
            <th>Datos</th><th>Imprimir</th><th>Estado</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarSobrecostos">Cerrar</button>
      </div>`;

    abrirPanel('Sobrecostos', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _wire: function (raiz) {
    const self = this;

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

    function vacio(v) {
      return v === null || v === undefined || String(v).trim() === '';
    }

    function esServicioCompleto(f) {
      const esConsolidado = String(f['TIPO DE CARGA'] || '').trim().toUpperCase() === 'CARGA CONSOLIDADO';

      const campos = [
        'FECHA DE PROGRAMACION', 'CLIENTE PARA FACTURACIÓN', 'EMPRESA QUE DIO EL SERVICIO', 'CONDUCTOR',
        'PLACA TRACTO', 'PLACA CARRETA', 'BOOKING', 'N° CONTENEDOR', 'TIPO DE CARGA', 'TIPO DE PRODUCTO',
        'TIPO DE TRATAMIENTO', 'PACKING', 'DEPOSITO DE RETIRO',
        'CIUDAD DE RETIRO', 'CIUDAD DE DEVOLUCION',
        'FECHA DE RETIRO', 'HORA DE RETIRO', 'DESTINO 1',
        'LUGAR DE POSICIONAMIENTO 1', 'FECHA DE POSICIONAMIENTO 1', 'HORA DE POSICIONAMIENTO 1',
        'DEPOSITO DE DEVOLUCION',
        'COSTO DEL PETRÓLEO X GALÓN', 'GL TRACTO', 'GL GENERADOR', 'TIPO DE ABASTECIMIENTO',
        'VIATICO', 'PEAJE', 'COCHERA', 'TOTAL POR VIAJE', 'MONTO DEPOSITADO', 'TARIFA 1'
      ];
      for (let i = 0; i < campos.length; i++) {
        if (vacio(f[campos[i]])) return false;
      }

      if (esConsolidado) {
        if (vacio(f['DESTINO 2']) || String(f['DESTINO 2']).trim() === '-') return false;
        if (vacio(f['LUGAR DE POSICIONAMIENTO 2'])) return false;
        if (vacio(f['FECHA DE POSICIONAMIENTO 2'])) return false;
        if (vacio(f['HORA DE POSICIONAMIENTO 2'])) return false;
      }
      return true;
    }

    function actualizarOpcionesConductor(filas) {
      const select = raiz.querySelector('#filtroConductorSobrecosto');
      const valorActual = select.value;
      const conductores = Array.from(new Set(
        filas.map(f => String(f['CONDUCTOR'] || '').trim()).filter(v => v !== '')
      )).sort((a, b) => a.localeCompare(b, 'es'));

      select.innerHTML = '<option value="">Todos</option>' +
        conductores.map(c => `<option value="${c}">${c}</option>`).join('');

      if (conductores.includes(valorActual)) select.value = valorActual;
    }

    function actualizarOpcionesCliente(filas) {
      const select = raiz.querySelector('#filtroClienteSobrecosto');
      const valorActual = select.value;
      const clientes = Array.from(new Set(
        filas.map(f => String(f['CLIENTE PARA FACTURACIÓN'] || '').trim()).filter(v => v !== '')
      )).sort((a, b) => a.localeCompare(b, 'es'));

      select.innerHTML = '<option value="">Todos</option>' +
        clientes.map(c => `<option value="${c}">${c}</option>`).join('');

      if (clientes.includes(valorActual)) select.value = valorActual;
    }

    async function cargar() {
      const filtros = {
        estado: raiz.querySelector('#filtroEstadoSobrecosto').value.trim(),
        fechaDesde: raiz.querySelector('#filtroDesdeSobrecosto').value.trim(),
        fechaHasta: raiz.querySelector('#filtroHastaSobrecosto').value.trim()
      };
      let filas = await llamarBackend('listarServiciosPendientes', filtros);

      actualizarOpcionesConductor(filas);
      actualizarOpcionesCliente(filas);

      const conductor = raiz.querySelector('#filtroConductorSobrecosto').value;
      if (conductor) filas = filas.filter(f => String(f['CONDUCTOR'] || '').trim() === conductor);

      const cliente = raiz.querySelector('#filtroClienteSobrecosto').value;
      if (cliente) filas = filas.filter(f => String(f['CLIENTE PARA FACTURACIÓN'] || '').trim() === cliente);

      const datos = raiz.querySelector('#filtroDatosSobrecosto').value;
      if (datos === 'completo') filas = filas.filter(f => esServicioCompleto(f));
      if (datos === 'incompleto') filas = filas.filter(f => !esServicioCompleto(f));

      function distanciaHoy(f) {
        const d = new Date(f['FECHA DE PROGRAMACION']);
        if (isNaN(d.getTime())) return Infinity;
        return Math.abs(d.getTime() - Date.now());
      }
      filas = filas.slice().sort(function (a, b) { return distanciaHoy(a) - distanciaHoy(b); });

      const tbody = raiz.querySelector('#tablaSobrecostos tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const completo = esServicioCompleto(f);
        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        tr.style.cursor = 'pointer';
        tr.title = 'Clic para registrar un sobrecosto de este servicio';
        const reeferSeco = String(f['REEFER O DRY'] || '').trim().toUpperCase() === 'DRY' ? 'SECO' : (f['REEFER O DRY'] || '');
        tr.innerHTML = `
          <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
          <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
          <td>${f['CONDUCTOR'] || ''}</td>
          <td>${f['PLACA TRACTO'] || ''}</td>
          <td>${f['BOOKING'] || ''}</td>
          <td>${reeferSeco}</td>
          <td>${f['CIUDAD DE RETIRO'] || ''}</td>
          <td>${f['DEPOSITO DE RETIRO'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE RETIRO'], f['HORA DE RETIRO'])}</td>
          <td>${f['DESTINO 1'] || ''}</td>
          <td>${f['PACKING'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1'])}</td>
          <td>${f['DESTINO 2'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE POSICIONAMIENTO 2'], f['HORA DE POSICIONAMIENTO 2'])}</td>
          <td>${f['DEPOSITO DE DEVOLUCION'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE DEVOLUCION'], f['HORA DE DEVOLUCION'])}</td>
          <td style="text-align:center;">
            ${completo
              ? '<span class="badge-datos completo">Completo</span>'
              : '<span class="badge-datos incompleto">Datos incompletos</span>'}
          </td>
          <td style="text-align:center;"><button type="button" class="btn-imprimir-fila" title="Imprimir este servicio" style="cursor:pointer; font-size:16px; border:none; background:transparent;">🖨️</button></td>
          <td>${f['ESTADO'] || ''}</td>`;

        tr.querySelector('.btn-imprimir-fila').addEventListener('click', function (ev) {
          ev.stopPropagation();
          FormServicio.imprimirDesdeFila(f._fila);
        });

        tr.addEventListener('click', function () {
          FormRegistroSobrecosto.abrir(f);
        });

        tbody.appendChild(tr);
      });
    }

    ['filtroEstadoSobrecosto', 'filtroConductorSobrecosto', 'filtroClienteSobrecosto', 'filtroDesdeSobrecosto', 'filtroHastaSobrecosto', 'filtroDatosSobrecosto'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    raiz.querySelector('#btnBorrarFiltroSobrecosto').addEventListener('click', function () {
      raiz.querySelector('#filtroEstadoSobrecosto').value = '';
      raiz.querySelector('#filtroConductorSobrecosto').value = '';
      raiz.querySelector('#filtroClienteSobrecosto').value = '';
      raiz.querySelector('#filtroDesdeSobrecosto').value = '';
      raiz.querySelector('#filtroHastaSobrecosto').value = '';
      raiz.querySelector('#filtroDatosSobrecosto').value = '';
      cargar();
    });

    raiz.querySelector('#btnCerrarSobrecostos').addEventListener('click', cerrarPanel);

    cargar();
  }
};
