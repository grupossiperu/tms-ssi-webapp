/**
 * forms/selServicioContabilidad.js
 * -------------------------------------------------------------------------
 * Módulo "Acarreo": lista los servicios de SERVICIOS y permite cambiar su
 * ESTADO siguiendo la secuencia del viaje (Programado → Retirando → En Ruta
 * Cliente → En Cliente → En Ruta Retorno → Cola Puerto → Culminado) o
 * marcarlo como Falso Flete, Reprogramado o Cancelado.
 *
 * Filtros: Estado, Conductor, Cliente y Planta son de selección múltiple
 * (se pueden elegir varios a la vez; sin nada marcado = todos). Además
 * Booking (búsqueda al escribir), rango de fechas y Datos completos /
 * incompletos.
 * -------------------------------------------------------------------------
 */
const FormSelServicioContabilidad = {

  _filaSeleccionada: null,

  ESTADOS: ['PROGRAMADO', 'RETIRANDO', 'EN RUTA CLIENTE', 'EN CLIENTE', 'EN RUTA RETORNO', 'COLA PUERTO',
    'CULMINADO', 'FALSO FLETE', 'REPROGRAMADO', 'CANCELADO'],

  abrir: async function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Estado</label><div id="msEstado"></div></div>
        <div class="campo"><label>Conductor</label><div id="msConductor"></div></div>
        <div class="campo"><label>Cliente</label><div id="msCliente"></div></div>
        <div class="campo"><label>Planta (packing)</label><div id="msPacking"></div></div>
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
        .barra-filtros select, .barra-filtros input { max-width: 210px; }
        .barra-filtros #filtroDesde, .barra-filtros #filtroHasta, .barra-filtros #filtroDatos { max-width: 130px; }
        .acarreo-tabla-wrap { max-height: calc(74vh - 230px); min-height: 220px; overflow-y: auto; overflow-x: hidden; }
        #tablaServicios { width: 100%; table-layout: fixed; font-size: .74rem; }
        #tablaServicios th, #tablaServicios td { padding: 5px 5px; white-space: normal; overflow-wrap: anywhere; word-break: break-word; vertical-align: top; }
        #tablaServicios th { font-size: .7rem; position: sticky; top: 0; z-index: 1; }
        #tablaServicios .badge-datos { font-size: .66rem; padding: 2px 6px; word-break: normal; overflow-wrap: normal; display: inline-block; line-height: 1.25; }
        #tablaServicios td .sub { color: #64748b; font-size: .68rem; margin-top: 2px; }
        .btn-acarreo { border: 1px solid #cbd5e1; border-radius: 8px; padding: 2px 6px; font-size: .66rem; font-weight: 700; cursor: pointer; background: #fff; white-space: nowrap; }
        .btn-acarreo.ac-ok { background: #dcfce7; color: #166534; border-color: #86efac; } .btn-acarreo.ac-pend { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
        .btn-datos { border: 1px solid #cbd5e1; border-radius: 8px; padding: 2px 6px; font-size: .66rem; font-weight: 700; cursor: pointer; background: #fff; color: #1c3a5e; white-space: nowrap; }
        .btn-datos .dt-punto { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
        .btn-datos.dt-ok .dt-punto { background: #16a34a; } .btn-datos.dt-pend .dt-punto { background: #f59e0b; }
        .btn-datos:hover { background: #f1f5f9; }
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
        .est-reprogramado { background: #fef9c3; color: #854d0e; }
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
            <col style="width:6.5%"><col style="width:5.5%"><col style="width:9%"><col style="width:6.5%"><col style="width:7.5%">
            <col style="width:8.5%"><col style="width:9%"><col style="width:7.5%"><col style="width:5%"><col style="width:7%">
            <col style="width:6.5%"><col style="width:6%"><col style="width:6%"><col style="width:3%"><col style="width:6.5%">
          </colgroup>
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Conductor</th><th>Unidad</th><th>Booking</th>
            <th>Retiro</th><th>Destino 1 / posic.</th><th>Packing</th><th>Destino 2 / posic.</th><th>Devolución</th>
            <th>Observación</th><th>Datos</th><th title="Contenedor, cita de devolución y 3 documentos">Completar acarreo</th><th>Imp.</th><th>Estado</th>
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
          <button class="boton-secundario btn-estado" data-estado="REPROGRAMADO">Reprogramado</button>
          <button class="boton-secundario" id="btnReprogPos" title="Cambiar la cita de posicionamiento y cobrar la reprogramación">📅 Reprogramar posicionamiento</button>
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
    self._filasCache = null;

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
      // (epoch 1899-12-30) al leerlas via API; hay que extraer solo HH:mm.
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

    // Un registro se considera "completo" cuando NINGUNA casilla del
    // formulario de Registrar Servicio quedó vacía. "-" significa "no
    // aplica"; "" (celda vacía) significa que el campo no se llenó.
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

    const estadoDe = function (f) { return String(f['ESTADO'] || '').trim().toUpperCase() || 'PROGRAMADO'; };
    const mayus = function (v) { return String(v || '').trim().toUpperCase(); };
    const unicos = function (filas, campo) {
      return Array.from(new Set(filas.map(f => mayus(f[campo])).filter(v => v !== '' && v !== '-')))
        .sort((a, b) => a.localeCompare(b, 'es'));
    };

    // Filtros de selección múltiple: solo vuelven a filtrar lo ya traído.
    const refiltrar = function () { cargar(true); };
    const msEstado = crearMultiSelect(raiz.querySelector('#msEstado'), { textoTodos: 'Todos', onChange: refiltrar });
    const msConductor = crearMultiSelect(raiz.querySelector('#msConductor'), { textoTodos: 'Todos', onChange: refiltrar });
    const msCliente = crearMultiSelect(raiz.querySelector('#msCliente'), { textoTodos: 'Todos', onChange: refiltrar });
    const msPacking = crearMultiSelect(raiz.querySelector('#msPacking'), { textoTodos: 'Todas', onChange: refiltrar });
    msEstado.setOpciones(self.ESTADOS);

    // soloFiltrar === true: vuelve a filtrar lo ya traído, sin ir al backend.
    async function cargar(soloFiltrar) {
      const filtros = {
        fechaDesde: raiz.querySelector('#filtroDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroHasta').value.trim()
      };
      let filas;
      if (soloFiltrar === true && self._filasCache) {
        filas = self._filasCache.slice();
      } else {
        const resp = await Promise.all([llamarBackend('listarServiciosPendientes', filtros), FormAcarreoDocs.cargar(true)]);
        filas = resp[0];
        self._filasCache = filas.slice();
      }

      msConductor.setOpciones(unicos(self._filasCache, 'CONDUCTOR'));
      msCliente.setOpciones(unicos(self._filasCache, 'CLIENTE PARA FACTURACIÓN'));
      msPacking.setOpciones(unicos(self._filasCache, 'PACKING'));
      const estadosEnDatos = unicos(self._filasCache, 'ESTADO').filter(e => self.ESTADOS.indexOf(e) === -1);
      msEstado.setOpciones(self.ESTADOS.concat(estadosEnDatos));

      filas = filas.filter(function (f) {
        return msEstado.cumple(estadoDe(f)) &&
          msConductor.cumple(mayus(f['CONDUCTOR'])) &&
          msCliente.cumple(mayus(f['CLIENTE PARA FACTURACIÓN'])) &&
          msPacking.cumple(mayus(f['PACKING']));
      });

      const booking = raiz.querySelector('#filtroBooking').value.trim().toUpperCase();
      if (booking) filas = filas.filter(f => (String(f['BOOKING'] || '') + ' ' + String(f['CODIGO SERVICIO'] || '')).toUpperCase().indexOf(booking) !== -1);

      const datos = raiz.querySelector('#filtroDatos').value;
      if (datos === 'completo') filas = filas.filter(f => esServicioCompleto(f));
      if (datos === 'incompleto') filas = filas.filter(f => !esServicioCompleto(f));

      function prioridadEstado(estado) {
        const e = String(estado || '').trim().toUpperCase();
        if (e === '' || e === 'PROGRAMADO') return 0;
        if (['RETIRANDO', 'EN RUTA CLIENTE', 'EN CLIENTE', 'EN RUTA RETORNO', 'COLA PUERTO', 'EN RUTA'].indexOf(e) !== -1) return 1;
        if (e === 'FALSO FLETE' || e === 'REPROGRAMADO' || e === 'CANCELADO') return 2;
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
        if (self._filaSeleccionada === f._fila) tr.classList.add('seleccionada');
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
          <td>${f['BOOKING'] || ''}${f['CODIGO SERVICIO'] ? '<div style="font-size:.7rem;color:#64748b">' + f['CODIGO SERVICIO'] + '</div>' : ''}</td>
          <td>${linea([f['CIUDAD DE RETIRO'], f['DEPOSITO DE RETIRO']].filter(Boolean).join(' · '), formatoFechaHora(f['FECHA DE RETIRO'], f['HORA DE RETIRO']))}</td>
          <td>${linea(f['DESTINO 1'], formatoFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1']))}</td>
          <td>${f['PACKING'] || ''}</td>
          <td>${d2 ? linea(d2, formatoFechaHora(f['FECHA DE POSICIONAMIENTO 2'], f['HORA DE POSICIONAMIENTO 2'])) : '-'}</td>
          <td>${linea(f['DEPOSITO DE DEVOLUCION'], formatoFechaHora(f['FECHA DE DEVOLUCION'], f['HORA DE DEVOLUCION']))}</td>
          <td>${obs ? '<span class="badge-obs">' + obs + '</span>' : ''}</td>
          <td style="text-align:center;">
            <button type="button" class="btn-datos ${completo ? 'dt-ok' : 'dt-pend'}" title="${completo ? 'Datos completos' : 'Faltan datos del servicio'} · clic para editar"><span class="dt-punto"></span>✎ Editar datos</button>
          </td>
          <td style="text-align:center;">${FormAcarreoDocs.boton(f)}</td>
          <td style="text-align:center;"><button type="button" class="btn-imprimir-fila" title="Imprimir este servicio" style="cursor:pointer; font-size:15px; border:none; background:transparent; padding:0;">🖨️</button></td>
          <td><span class="badge-estado est-${estadoTxt.replace(/\s+/g, '-').toLowerCase()}">${f['ESTADO'] || ''}</span></td>`;

        tr.querySelector('.btn-datos').addEventListener('click', function (ev) {
          ev.stopPropagation();
          FormServicio.abrir(f._fila);
        });

        tr.querySelector('.btn-acarreo').addEventListener('click', function (ev) {
          ev.stopPropagation();
          FormAcarreoDocs.abrir(f, function () { cargar(); });
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
      if (filas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; color:#64748b; padding:14px;">' +
          (booking ? 'No se encontró ningún servicio con ese booking.' : 'No hay servicios con estos filtros.') + '</td></tr>';
      }
      // Cambiar filtros no cuenta como "datos sin guardar" al cerrar.
      if (typeof _refrescarSnapshotFormulario === 'function') _refrescarSnapshotFormulario();
    }

    ['filtroDesde', 'filtroHasta'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', function () { cargar(); });
    });
    raiz.querySelector('#filtroDatos').addEventListener('change', refiltrar);

    let esperaBooking = null;
    raiz.querySelector('#filtroBooking').addEventListener('input', function () {
      clearTimeout(esperaBooking);
      esperaBooking = setTimeout(refiltrar, 250);
    });

    raiz.querySelector('#btnBorrarFiltro').addEventListener('click', function () {
      msEstado.limpiar(); msConductor.limpiar(); msCliente.limpiar(); msPacking.limpiar();
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

    // v106: reprogramar el posicionamiento (nueva cita + cobro de la reprogramación).
    raiz.querySelector('#btnReprogPos').addEventListener('click', function () {
      const f = self._servicioSeleccionado;
      if (self._filaSeleccionada === null || !f) { mostrarMensaje('Seleccione un servicio para continuar.', 'error'); return; }
      const est = estadoDe(f);
      if (est === 'CANCELADO' || est === 'CULMINADO') { mostrarMensaje('El servicio está ' + est + ': no se puede reprogramar.', 'error'); return; }
      let hist = [];
      try { hist = JSON.parse(String(f['REPROGRAMACIONES'] || '[]')) || []; } catch (e) { hist = []; }
      const histHtml = hist.length
        ? '<div style="margin-top:10px;font-size:.78rem"><b style="color:#1c3a5e">Reprogramaciones anteriores</b>' + hist.map(h =>
          '<div style="border-top:1px dashed #e2e8f0;padding:4px 0">' + esc(h.antes || '-') + ' → <b>' + esc(h.despues) + '</b> · ' + esc(h.motivo) +
          (h.tarifa > 0 ? ' · cobro ' + esc(h.moneda) + ' ' + Number(h.tarifa).toFixed(2) : ' · sin cobro') + ' <span style="color:#94a3b8">(' + esc(h.por || '') + ' ' + esc(h.fecha || '') + ')</span></div>').join('') + '</div>'
        : '';
      const velo = document.createElement('div');
      velo.className = 'ac-velo';
      velo.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px';
      velo.innerHTML = `
        <div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.25)">
          <div style="background:#1c3a5e;color:#fff;padding:12px 16px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
            <b>📅 Reprogramar posicionamiento</b><button type="button" id="rpX" style="background:none;border:0;color:#fff;font-size:20px;cursor:pointer">×</button></div>
          <div style="padding:14px 16px">
            <div style="background:#f1f5f9;border-radius:9px;padding:8px 10px;font-size:.82rem;color:#334155;display:flex;flex-wrap:wrap;gap:4px 14px">
              <span>Cliente: <b>${esc(f['CLIENTE PARA FACTURACIÓN'] || '')}</b></span><span>Booking: <b>${esc(f['BOOKING'] || '')}</b></span>
              <span>Código: <b>${esc(f['CODIGO SERVICIO'] || '')}</b></span><span>Destino: <b>${esc(f['DESTINO 1'] || '')}</b></span>
            </div>
            <div style="display:flex;justify-content:space-between;background:#eef4fb;border-radius:8px;padding:7px 10px;margin-top:10px;font-size:.85rem">
              <span>Cita actual de posicionamiento</span><b>${esc(formatoFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1']) || 'Sin dato')}</b></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
              <div class="campo" style="grid-column:1/-1"><label>Nueva cita de posicionamiento (fecha y hora)</label><input type="datetime-local" id="rpNueva"></div>
              <div class="campo" style="grid-column:1/-1"><label>Motivo</label><input id="rpMotivo" list="rpMotivos" autocomplete="off" placeholder="Ej. Cliente indicó cargar al día siguiente">
                <datalist id="rpMotivos"><option value="CLIENTE INDICÓ CARGAR AL DÍA SIGUIENTE"><option value="PLANTA SIN CARGA LISTA"><option value="CAMBIO DE HORARIO DEL CLIENTE"><option value="CONTENEDOR DETENIDO EN PLANTA"></datalist></div>
              <div class="campo"><label>Tarifa de la reprogramación (con IGV)</label><input type="number" id="rpTarifa" min="0" step="0.01" placeholder="0.00"></div>
              <div class="campo"><label>Moneda</label><select id="rpMoneda"><option value="$">Dólares ($)</option><option value="S/">Soles (S/)</option></select></div>
            </div>
            <div style="font-size:.78rem;color:#64748b;margin-top:6px">Se cambia la cita del servicio y se crea el sobrecosto <b>REPROGRAMACIÓN</b> con esta tarifa, listo en Facturar.</div>
            ${histHtml}
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
              <button type="button" class="boton-secundario" id="rpCancelar">Cancelar</button>
              <button type="button" class="boton-primario" id="rpGrabar">Reprogramar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(velo);
      const q = id => velo.querySelector('#' + id);
      const cerrarRp = () => velo.remove();
      q('rpX').addEventListener('click', cerrarRp); q('rpCancelar').addEventListener('click', cerrarRp);
      q('rpGrabar').addEventListener('click', async function () {
        const v = q('rpNueva').value, motivo = q('rpMotivo').value.trim(), tarifa = Number(q('rpTarifa').value) || 0;
        if (!v) { mostrarMensaje('Ingrese la nueva fecha y hora de posicionamiento.', 'error'); return; }
        if (!motivo) { mostrarMensaje('Ingrese el motivo de la reprogramación.', 'error'); return; }
        if (!(tarifa > 0)) { mostrarMensaje('Ingrese la tarifa de la reprogramación.', 'error'); return; }
        const p = v.split('T');
        const btn = this; btn.disabled = true; btn.textContent = 'Guardando…';
        try {
          const r = await llamarBackend('reprogramarPosicionamiento', {
            fila: f._fila, codigo: f['CODIGO SERVICIO'] || '', fecha: p[0].split('-').reverse().join('/'), hora: (p[1] || '').slice(0, 5),
            motivo: motivo.toUpperCase(), tarifa: tarifa, moneda: q('rpMoneda').value
          });
          if (!r || !r.ok) throw new Error((r && r.mensaje) || 'No se pudo reprogramar.');
          cerrarRp();
          mostrarMensaje(r.mensaje, r.parcial ? 'info' : 'exito');
          cargar();
        } catch (e) {
          mostrarMensaje(e.message || String(e), 'error');
          btn.disabled = false; btn.textContent = 'Reprogramar';
        }
      });
    });

    raiz.querySelector('#btnCancelarSelServicio').addEventListener('click', cerrarPanel);

    cargar();
  }
};
