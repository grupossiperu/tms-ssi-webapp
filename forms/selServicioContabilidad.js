/**
 * forms/selServicioContabilidad.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmSelServicioContabilidad.frm (VBA). Primera
 * pantalla del botón "Consolidado de Servicios": lista los servicios de
 * SERVICIOS, permite cambiar su ESTADO (Culminado / En Ruta / Falso Flete
 * / Viaje Cancelado) y, al continuar, valida el estado antes de abrir el
 * detalle (frmConsolidadoServicio).
 *
 * Columnas mostradas (a pedido del usuario): Fecha, Cliente, Conductor,
 * Placa, Destino, Fecha/Hora de retiro, Fecha/Hora de posicionamiento,
 * Galones y total de combustible del tracto, Monto a depositar, Tarifa,
 * y una columna "Depositado" con checkbox que se guarda de inmediato en la
 * hoja (columna DEPOSITADO). El filtro de Empresa fue eliminado.
 * -------------------------------------------------------------------------
 */
const FormSelServicioContabilidad = {

  _filaSeleccionada: null,

  abrir: async function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Estado</label>
          <select id="filtroEstado">
            <option value="">Todos</option>
            <option>PROGRAMADO</option><option>RETIRANDO</option><option>EN RUTA CLIENTE</option><option>EN CLIENTE</option><option>EN RUTA RETORNO</option><option>COLA PUERTO</option>
            <option>CULMINADO</option><option>FALSO FLETE</option>
            <option>CANCELADO</option>
          </select>
        </div>
        <div class="campo"><label>Conductor</label>
          <select id="filtroConductor">
            <option value="">Todos</option>
          </select>
        </div>
        <div class="campo"><label>Cliente</label>
          <select id="filtroCliente">
            <option value="">Todos</option>
          </select>
        </div>
        <div class="campo"><label>Booking</label>
          <input type="text" id="filtroBooking" placeholder="Escriba el booking" autocomplete="off">
        </div>
        <div class="campo"><label>Desde</label><input type="text" id="filtroDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Datos</label>
          <select id="filtroDatos">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Datos incompletos</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltro">Borrar filtro</button>
      </div>
      <style>
        .acarreo-tabla-wrap { max-height: calc(74vh - 230px); min-height: 220px; overflow-y: auto; overflow-x: hidden; }
        #tablaServicios { width: 100%; table-layout: fixed; font-size: .74rem; }
        #tablaServicios th, #tablaServicios td { padding: 5px 5px; white-space: normal; overflow-wrap: anywhere; word-break: break-word; vertical-align: top; }
        #tablaServicios th { font-size: .7rem; position: sticky; top: 0; z-index: 1; }
        #tablaServicios .badge-datos { font-size: .66rem; padding: 2px 6px; word-break: normal; overflow-wrap: normal; display: inline-block; line-height: 1.25; }
        #tablaServicios td .sub { color: #64748b; font-size: .68rem; margin-top: 2px; }
        .badge-obs { display: inline-block; background: #e0f2fe; color: #075985; border-radius: 8px; padding: 1px 6px; font-size: .66rem; font-weight: 700; }
        .badge-estado { display: inline-block; border-radius: 8px; padding: 2px 6px; font-size: .66rem; font-weight: 700; background: #f1f5f9; color: #334155; }
        .est-programado { background: #e2e8f0; color: #334155; }
        .est-retirando { background: #fef3c7; color: #92400e; }
        .est-en-ruta-cliente, .est-en-ruta { background: #dbeafe; color: #1e40af; }
        .est-en-cliente { background: #ede9fe; color: #5b21b6; }
        .est-en-ruta-retorno { background: #cffafe; color: #155e75; }
        .est-cola-puerto { background: #ffedd5; color: #9a3412; }
        .est-culminado { background: #dcfce7; color: #166534; }
        .est-falso-flete { background: #fce7f3; color: #9d174d; }
        .est-cancelado { background: #fee2e2; color: #991b1b; }
        .acarreo-estados { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .acarreo-estados .boton-secundario, .acarreo-estados .boton-peligro { padding: 7px 10px; font-size: .8rem; }
        .acarreo-estados .flecha { color: #94a3b8; font-weight: 700; }
        .acarreo-estados .sep { width: 14px; }
        .acarreo-lbl { font-size: .78rem; font-weight: 700; color: #1c3a5e; margin-right: 4px; }
      </style>
      <div class="acarreo-tabla-wrap">
        <table class="tabla-lista" id="tablaServicios">
          <colgroup>
            <col style="width:6.5%"><col style="width:5.5%"><col style="width:10%"><col style="width:6.5%"><col style="width:7.5%">
            <col style="width:9.5%"><col style="width:9%"><col style="width:8.5%"><col style="width:5.5%"><col style="width:7.5%">
            <col style="width:6.5%"><col style="width:7%"><col style="width:3%"><col style="width:7.5%">
          </colgroup>
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Conductor</th><th>Unidad</th><th>Booking</th>
            <th>Retiro</th><th>Destino 1 / posic.</th><th>Packing</th><th>Destino 2 / posic.</th><th>Devolución</th>
            <th>Observación</th><th>Datos</th><th>Imp.</th><th>Estado</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <div class="acarreo-estados">
          <span class="acarreo-lbl">Cambiar estado:</span>
          <button class="boton-secundario btn-estado" data-estado="PROGRAMADO">Programado</button><span class="flecha">🡢</span>
          <button class="boton-secundario btn-estado" data-estado="RETIRANDO">Retirando</button><span class="flecha">🡢</span>
          <button class="boton-secundario btn-estado" data-estado="EN RUTA CLIENTE">En Ruta Cliente</button><span class="flecha">🡢</span>
          <button class="boton-secundario btn-estado" data-estado="EN CLIENTE">En Cliente</button><span class="flecha">🡢</span>
          <button class="boton-secundario btn-estado" data-estado="EN RUTA RETORNO">En Ruta Retorno</button><span class="flecha">🡢</span>
          <button class="boton-secundario btn-estado" data-estado="COLA PUERTO">Cola Puerto</button><span class="flecha">🡢</span>
          <button class="boton-secundario btn-estado" data-estado="CULMINADO">Culminado</button>
          <span class="sep"></span>
          <button class="boton-secundario btn-estado" data-estado="FALSO FLETE">Falso Flete</button>
          <button class="boton-peligro btn-estado" data-estado="CANCELADO">Cancelar viaje</button>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="boton-secundario" id="btnCancelarSelServicio">Cerrar</button>
        </div>
      </div>`;

    abrirPanel('Acarreo - Selección', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _wire: function (raiz) {
    const self = this;
    self._filaSeleccionada = null;

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
      // Google Sheets guarda celdas de solo-hora como fecha/hora completa
      // (epoch 1899-12-30) al leerlas via API; hay que extraer solo HH:mm
      // en vez de mostrar el objeto Date/ISO string tal cual.
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

    // Un registro se considera "completo" cuando NINGUNA casilla del
    // formulario de Registrar Servicio quedó vacía. En esta base de datos,
    // "-" significa "no aplica" (usado a propósito para Destino 2, Fecha y
    // Hora de devolución cuando no corresponden); en cambio "" (celda
    // realmente vacía) significa que el campo simplemente no se llenó, y
    // eso SÍ debe marcarse como incompleto (p. ej. N° Contenedor, Booking).
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

      // El bloque de posicionamiento 2 solo es obligatorio en consolidado.
      if (esConsolidado) {
        if (vacio(f['DESTINO 2']) || String(f['DESTINO 2']).trim() === '-') return false;
        if (vacio(f['LUGAR DE POSICIONAMIENTO 2'])) return false;
        if (vacio(f['FECHA DE POSICIONAMIENTO 2'])) return false;
        if (vacio(f['HORA DE POSICIONAMIENTO 2'])) return false;
      }
      return true;
    }

    function actualizarOpcionesConductor(filas) {
      const select = raiz.querySelector('#filtroConductor');
      const valorActual = select.value;
      const conductores = Array.from(new Set(
        filas.map(f => String(f['CONDUCTOR'] || '').trim()).filter(v => v !== '')
      )).sort((a, b) => a.localeCompare(b, 'es'));

      select.innerHTML = '<option value="">Todos</option>' +
        conductores.map(c => `<option value="${c}">${c}</option>`).join('');

      if (conductores.includes(valorActual)) select.value = valorActual;
    }

    function actualizarOpcionesCliente(filas) {
      const select = raiz.querySelector('#filtroCliente');
      const valorActual = select.value;
      const clientes = Array.from(new Set(
        filas.map(f => String(f['CLIENTE PARA FACTURACIÓN'] || '').trim()).filter(v => v !== '')
      )).sort((a, b) => a.localeCompare(b, 'es'));

      select.innerHTML = '<option value="">Todos</option>' +
        clientes.map(c => `<option value="${c}">${c}</option>`).join('');

      if (clientes.includes(valorActual)) select.value = valorActual;
    }

    // soloFiltrar === true: vuelve a filtrar lo ya traído, sin ir al backend
    // (se usa al escribir el booking, para que responda al instante).
    async function cargar(soloFiltrar) {
      const filtros = {
        estado: raiz.querySelector('#filtroEstado').value.trim(),
        fechaDesde: raiz.querySelector('#filtroDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroHasta').value.trim()
      };
      let filas;
      if (soloFiltrar === true && self._filasCache) {
        filas = self._filasCache.slice();
      } else {
        filas = await llamarBackend('listarServiciosPendientes', filtros);
        self._filasCache = filas.slice();
      }

      actualizarOpcionesConductor(filas);
      actualizarOpcionesCliente(filas);

      const conductor = raiz.querySelector('#filtroConductor').value;
      if (conductor) filas = filas.filter(f => String(f['CONDUCTOR'] || '').trim() === conductor);

      const cliente = raiz.querySelector('#filtroCliente').value;
      if (cliente) filas = filas.filter(f => String(f['CLIENTE PARA FACTURACIÓN'] || '').trim() === cliente);

      const booking = raiz.querySelector('#filtroBooking').value.trim().toUpperCase();
      if (booking) filas = filas.filter(f => String(f['BOOKING'] || '').toUpperCase().indexOf(booking) !== -1);

      const datos = raiz.querySelector('#filtroDatos').value;
      if (datos === 'completo') filas = filas.filter(f => esServicioCompleto(f));
      if (datos === 'incompleto') filas = filas.filter(f => !esServicioCompleto(f));

      function prioridadEstado(estado) {
        const e = String(estado || '').trim().toUpperCase();
        if (e === '' || e === 'PROGRAMADO') return 0;
        if (['RETIRANDO', 'EN RUTA CLIENTE', 'EN CLIENTE', 'EN RUTA RETORNO', 'COLA PUERTO', 'EN RUTA'].indexOf(e) !== -1) return 1;
        if (e === 'FALSO FLETE' || e === 'CANCELADO') return 2;
        return 3;
            }
      function distanciaHoy(f) {
        const d = new Date(f['FECHA DE PROGRAMACION']);
        if (isNaN(d.getTime())) return Infinity;
        return Math.abs(d.getTime() - Date.now());
      }
      filas = filas.slice().sort(function (a, b) {
        const pa = prioridadEstado(a['ESTADO']);
        const pb = prioridadEstado(b['ESTADO']);
        if (pa !== pb) return pa - pb;
        const ca = esServicioCompleto(a) ? 1 : 0;
        const cb = esServicioCompleto(b) ? 1 : 0;
        if (ca !== cb) return ca - cb;
        return distanciaHoy(a) - distanciaHoy(b);
      });

      const tbody = raiz.querySelector('#tablaServicios tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const completo = esServicioCompleto(f);
        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        const reeferSeco = String(f['REEFER O DRY'] || '').trim().toUpperCase() === 'DRY' ? 'SECO' : (f['REEFER O DRY'] || '');
        // Dos datos por celda (valor + fecha/hora debajo) para que la tabla
        // entre completa en pantalla sin barra horizontal.
        const linea = function (a, b) {
          a = String(a || '').trim(); b = String(b || '').trim();
          if (a && b) return a + '<div class="sub">' + b + '</div>';
          return a || (b ? '<div class="sub">' + b + '</div>' : '');
        };
        const d2 = (f['DESTINO 2'] && String(f['DESTINO 2']).trim() !== '-') ? f['DESTINO 2'] : '';
        const estadoTxt = String(f['ESTADO'] || '').trim().toUpperCase();
        const obs = String(f['OBSERVACION'] || '').trim();
        tr.innerHTML = `
          <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
          <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
          <td>${f['CONDUCTOR'] || ''}</td>
          <td>${linea(f['PLACA TRACTO'], reeferSeco)}</td>
          <td>${f['BOOKING'] || ''}</td>
          <td>${linea([f['CIUDAD DE RETIRO'], f['DEPOSITO DE RETIRO']].filter(Boolean).join(' · '), formatoFechaHora(f['FECHA DE RETIRO'], f['HORA DE RETIRO']))}</td>
          <td>${linea(f['DESTINO 1'], formatoFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1']))}</td>
          <td>${f['PACKING'] || ''}</td>
          <td>${d2 ? linea(d2, formatoFechaHora(f['FECHA DE POSICIONAMIENTO 2'], f['HORA DE POSICIONAMIENTO 2'])) : '-'}</td>
          <td>${linea(f['DEPOSITO DE DEVOLUCION'], formatoFechaHora(f['FECHA DE DEVOLUCION'], f['HORA DE DEVOLUCION']))}</td>
          <td>${obs ? '<span class="badge-obs">' + obs + '</span>' : ''}</td>
          <td style="text-align:center;">
            ${completo
              ? '<span class="badge-datos completo" title="Clic para revisar o modificar">Completo</span>'
              : '<span class="badge-datos incompleto" title="Clic para completar los datos">Datos incompletos</span>'}
          </td>
          <td style="text-align:center;"><button type="button" class="btn-imprimir-fila" title="Imprimir este servicio" style="cursor:pointer; font-size:15px; border:none; background:transparent; padding:0;">🖨️</button></td>
          <td><span class="badge-estado est-${estadoTxt.replace(/\s+/g, '-').toLowerCase()}">${f['ESTADO'] || ''}</span></td>`;

        tr.querySelector('.badge-datos').addEventListener('click', function (ev) {
          ev.stopPropagation();
          FormServicio.abrir(f._fila);
        });

        tr.querySelector('.btn-imprimir-fila').addEventListener('click', function (ev) {
          ev.stopPropagation();
          FormServicio.imprimirDesdeFila(f._fila);
        });

        tr.addEventListener('click', function () {
          tbody.querySelectorAll('tr').forEach(x => x.classList.remove('seleccionada'));
          tr.classList.add('seleccionada');
          self._filaSeleccionada = Number(tr.dataset.fila);
          self._servicioSeleccionado = f;
        });
        tbody.appendChild(tr);
      });

      // Si el booking escrito ubica un solo servicio, queda seleccionado.
      if (booking && filas.length === 1) tbody.querySelector('tr').click();
      if (booking && filas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; color:#64748b; padding:14px;">No se encontró ningún servicio con ese booking.</td></tr>';
      }
    }

    ['filtroEstado', 'filtroConductor', 'filtroCliente', 'filtroDesde', 'filtroHasta', 'filtroDatos'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    let esperaBooking = null;
    raiz.querySelector('#filtroBooking').addEventListener('input', function () {
      clearTimeout(esperaBooking);
      esperaBooking = setTimeout(function () { cargar(true); }, 250);
    });

    raiz.querySelector('#btnBorrarFiltro').addEventListener('click', function () {
      raiz.querySelector('#filtroEstado').value = '';
      raiz.querySelector('#filtroConductor').value = '';
      raiz.querySelector('#filtroCliente').value = '';
      raiz.querySelector('#filtroDesde').value = '';
      raiz.querySelector('#filtroHasta').value = '';
      raiz.querySelector('#filtroDatos').value = '';
      raiz.querySelector('#filtroBooking').value = '';
      cargar();
    });

    async function cambiarEstado(nuevoEstado) {
      if (self._filaSeleccionada === null) {
        mostrarMensaje('Seleccione un servicio para continuar.', 'error');
        return;
      }
      if (nuevoEstado === 'CULMINADO' && self._servicioSeleccionado && !esServicioCompleto(self._servicioSeleccionado)) {
        mostrarMensaje('No se puede marcar como Culminado: el servicio tiene datos incompletos.', 'error');
        return;
      }
      await llamarBackend('cambiarEstadoServicio', { fila: self._filaSeleccionada, nuevoEstado: nuevoEstado });
      cargar();
    }
    raiz.querySelectorAll('.btn-estado').forEach(function (b) {
      b.addEventListener('click', function () { cambiarEstado(b.dataset.estado); });
    });

    raiz.querySelector('#btnCancelarSelServicio').addEventListener('click', cerrarPanel);



    cargar();
  }
};
