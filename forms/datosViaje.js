/**
 * forms/datosViaje.js
 * -------------------------------------------------------------------------
 * Módulo "Datos del Viaje" (botón de la pantalla principal). Lista los
 * servicios con: Fecha, Cliente, Booking, Tipo de carga, Conductor, Tracto,
 * Depósito de retiro, Fecha de retiro, Destino, Fecha de posicionamiento,
 * Fecha de devolución y un estado "Seguimiento" (Completo / Incompleto).
 *
 * Un clic sobre el estado de seguimiento abre un sub-formulario (dentro
 * del mismo panel, sin cerrar la lista) con 10 campos de fecha/hora del
 * recorrido del viaje. Se puede grabar aunque no estén todos completos;
 * el estado de "Seguimiento" solo pasa a Completo cuando los 10 campos
 * están llenos (validado en el backend).
 * -------------------------------------------------------------------------
 */
const FormDatosViaje = {

  /** Horas libres en puerto (cola → salida), iguales para todos los clientes. */
  LIBRES_PUERTO: 4,

  abrir: async function () {
    this._mostrarLista();
  },

  _mostrarLista: function () {
    this._filtros = null; // ventana nueva: filtros limpios
    abrirPanel('Datos del Viaje', this._htmlLista(), (raiz) => this._wireLista(raiz), { ancho: true });
  },

  /** HTML de la lista (filtros iguales a Acarreo + Seguimiento). */
  _htmlLista: function () {
    return `
      <style>
        #dvFiltros select, #dvFiltros input { max-width: 200px; }
        #dvFiltros #filtroViajeDesde, #dvFiltros #filtroViajeHasta, #dvFiltros #filtroViajeSeguimiento, #dvFiltros #filtroViajeGas { max-width: 125px; }
      </style>
      <div class="barra-filtros" id="dvFiltros">
        <div class="campo"><label>Estado</label><div id="dvMsEstado"></div></div>
        <div class="campo"><label>Conductor</label><div id="dvMsConductor"></div></div>
        <div class="campo"><label>Cliente</label><div id="dvMsCliente"></div></div>
        <div class="campo"><label>Planta (packing)</label><div id="dvMsPacking"></div></div>
        <div class="campo"><label>Booking</label><input type="text" id="filtroViajeBooking" placeholder="Booking o código" autocomplete="off"></div>
        <div class="campo"><label>Desde</label><input type="text" id="filtroViajeDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroViajeHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Seguimiento</label>
          <select id="filtroViajeSeguimiento">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Incompleto</option>
          </select>
        </div>
        <div class="campo"><label>Gasificado</label>
          <select id="filtroViajeGas"><option value="">Todos</option><option value="si">Sí</option><option value="no">No</option></select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltroViaje">Borrar filtro</button>
      </div>
      <div style="font-size:.78rem;color:#64748b;margin:-4px 0 6px" id="dvConteo"></div>
      <div style="max-height:calc(74vh - 230px); min-height:220px; overflow:auto;">
        <table class="tabla-lista" id="tablaDatosViaje">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Booking</th><th>Tipo de carga</th><th>Conductor</th>
            <th>Tracto</th><th>Depósito de retiro</th><th>Fecha de retiro</th><th>Destino</th>
            <th>Fecha de posicionamiento</th><th>Fecha de devolución</th><th title="Retiro vacío → salida del depósito">T. retiro</th><th title="Llegada → salida de planta. El extra se cuenta desde la cita o la llegada (la más tarde)">T. planta</th><th title="Servicio gasificado y horas de gasificado (inicio → fin)">Gasificado</th><th title="Llegada a cola de puerto → salida de puerto (4 h libres, todos los clientes)">T. puerto</th><th>Estado</th><th>Seguimiento</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarDatosViaje">Cerrar</button>
      </div>`;
  },

  _wireLista: function (raiz) {
    const self = this;

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

    // Hora sin fecha (fecha guardada como "-"): avisar en vez de mostrar "- 18:00".
    function fechaHoraOAviso(fecha, hora) {
      const sinFecha = !fecha || String(fecha).trim() === '-' || isNaN(new Date(fecha).getTime());
      const h = formatoHora(hora);
      if (sinFecha && h && h !== '-') return '<span title="Tiene hora pero falta la fecha: complétala en Completar acarreo o Editar datos" style="display:inline-block;padding:1px 6px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:.72rem;font-weight:700">Falta fecha · ' + h + '</span>';
      return formatoFechaHora(fecha, hora);
    }
    function formatoFechaHora(fecha, hora) {
      const f = formatoFecha(fecha);
      const h = formatoHora(hora);
      if (f === '' && h === '') return '';
      if (h === '') return f;
      return (f + ' ' + h).trim();
    }

    const $q = id => raiz.querySelector('#' + id);
    const mayus = v => String(v || '').trim().toUpperCase();
    const unicos = (filas, campo) => Array.from(new Set(filas.map(f => mayus(f[campo])).filter(v => v !== '' && v !== '-'))).sort((a, b) => a.localeCompare(b, 'es'));
    const ESTADOS = (typeof FormSelServicioContabilidad !== 'undefined' && FormSelServicioContabilidad.ESTADOS) || ['PROGRAMADO', 'RETIRANDO', 'EN RUTA CLIENTE', 'EN CLIENTE', 'EN RUTA RETORNO', 'COLA PUERTO', 'CULMINADO', 'FALSO FLETE', 'REPROGRAMADO', 'CANCELADO'];
    const estadoDe = f => mayus(f['ESTADO']) || 'PROGRAMADO';
    const refiltrar = () => cargar(true);
    const msEstado = crearMultiSelect($q('dvMsEstado'), { textoTodos: 'Todos', onChange: refiltrar });
    const msConductor = crearMultiSelect($q('dvMsConductor'), { textoTodos: 'Todos', onChange: refiltrar });
    const msCliente = crearMultiSelect($q('dvMsCliente'), { textoTodos: 'Todos', onChange: refiltrar });
    const msPacking = crearMultiSelect($q('dvMsPacking'), { textoTodos: 'Todas', onChange: refiltrar });
    msEstado.setOpciones(ESTADOS);

    // Filtros recordados al volver del seguimiento.
    const prev = self._filtros;
    if (prev) {
      $q('filtroViajeDesde').value = prev.desde || ''; $q('filtroViajeHasta').value = prev.hasta || '';
      $q('filtroViajeSeguimiento').value = prev.seg || ''; $q('filtroViajeGas').value = prev.gas || ''; $q('filtroViajeBooking').value = prev.booking || '';
    }
    let restaurado = !prev;
    const guardarFiltros = function () {
      self._filtros = {
        desde: $q('filtroViajeDesde').value, hasta: $q('filtroViajeHasta').value, seg: $q('filtroViajeSeguimiento').value,
        gas: $q('filtroViajeGas').value, booking: $q('filtroViajeBooking').value,
        estado: msEstado.valores(), cond: msConductor.valores(), cli: msCliente.valores(), pack: msPacking.valores()
      };
    };

    async function cargar(soloFiltrar) {
      let filas;
      if (soloFiltrar === true && self._filasCache) filas = self._filasCache.slice();
      else {
        const filtros = { fechaDesde: $q('filtroViajeDesde').value.trim(), fechaHasta: $q('filtroViajeHasta').value.trim() };
        filas = await llamarBackend('listarConSeguimiento', filtros) || [];
        self._filasCache = filas.slice();
      }
      msConductor.setOpciones(unicos(self._filasCache, 'CONDUCTOR'));
      msCliente.setOpciones(unicos(self._filasCache, 'CLIENTE PARA FACTURACIÓN'));
      msPacking.setOpciones(unicos(self._filasCache, 'PACKING'));
      msEstado.setOpciones(ESTADOS.concat(unicos(self._filasCache, 'ESTADO').filter(e => ESTADOS.indexOf(e) === -1)));
      if (!restaurado) {
        restaurado = true;
        msEstado.setValores(prev.estado); msConductor.setValores(prev.cond); msCliente.setValores(prev.cli); msPacking.setValores(prev.pack);
      }
      guardarFiltros();

      filas = filas.filter(f => msEstado.cumple(estadoDe(f)) && msConductor.cumple(mayus(f['CONDUCTOR'])) &&
        msCliente.cumple(mayus(f['CLIENTE PARA FACTURACIÓN'])) && msPacking.cumple(mayus(f['PACKING'])));
      const booking = mayus($q('filtroViajeBooking').value);
      if (booking) filas = filas.filter(f => (String(f['BOOKING'] || '') + ' ' + String(f['CODIGO SERVICIO'] || '')).toUpperCase().indexOf(booking) !== -1);
      const seg = $q('filtroViajeSeguimiento').value;
      if (seg === 'completo') filas = filas.filter(f => f._seguimientoCompleto);
      if (seg === 'incompleto') filas = filas.filter(f => !f._seguimientoCompleto);
      const gas = $q('filtroViajeGas').value;
      if (gas === 'si') filas = filas.filter(f => self._esGas(f));
      if (gas === 'no') filas = filas.filter(f => !self._esGas(f));
      $q('dvConteo').textContent = filas.length + ' de ' + self._filasCache.length + ' servicios';

      filas = filas.slice().sort(function (a, b) {
        const da = new Date(a['FECHA DE PROGRAMACION']);
        const db = new Date(b['FECHA DE PROGRAMACION']);
        const ta = isNaN(da.getTime()) ? -Infinity : da.getTime();
        const tb = isNaN(db.getTime()) ? -Infinity : db.getTime();
        return tb - ta;
      });

      const tbody = raiz.querySelector('#tablaDatosViaje tbody');
      tbody.innerHTML = '';
      filas.forEach(function (f) {
        const completo = !!f._seguimientoCompleto;
        const tr = document.createElement('tr');
        tr.dataset.fila = f._fila;
        tr.innerHTML = `
          <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
          <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
          <td>${f['BOOKING'] || ''}${f['CODIGO SERVICIO'] ? '<div style="font-size:.7rem;color:#64748b">' + f['CODIGO SERVICIO'] + '</div>' : ''}</td>
          <td>${f['TIPO DE CARGA'] || ''}</td>
          <td>${f['CONDUCTOR'] || ''}</td>
          <td>${f['PLACA TRACTO'] || ''}</td>
          <td>${f['DEPOSITO DE RETIRO'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE RETIRO'], f['HORA DE RETIRO'])}</td>
          <td>${f['DESTINO 1'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1'])}</td>
          <td class="celda-fechahora">${fechaHoraOAviso(f['FECHA DE DEVOLUCION'], f['HORA DE DEVOLUCION'])}</td>
          <td class="dv-retiro" style="text-align:center;cursor:pointer;">${self._celdaH(self._calc(f).enRetiro)}</td>
          <td class="dv-planta" style="text-align:center;cursor:pointer;">${self._celdaPlanta(f)}</td>
          <td class="dv-gas" style="text-align:center;cursor:pointer;">${self._celdaGas(f)}</td>
          <td class="dv-puerto" style="text-align:center;cursor:pointer;">${self._celdaPuerto(f)}</td>
          <td><span class="badge-estado est-${(String(f['ESTADO'] || '').trim().toUpperCase() || 'PROGRAMADO').replace(/\s+/g, '-').toLowerCase()}">${esc(String(f['ESTADO'] || '').trim() || 'PROGRAMADO')}</span></td>
          <td style="text-align:center;">
            ${completo
              ? '<span class="badge-datos completo" title="Clic para revisar el seguimiento">Completo</span>'
              : '<span class="badge-datos incompleto" title="Clic para completar el seguimiento">Incompleto</span>'}
          </td>`;

        tr.querySelector('.badge-datos').addEventListener('click', function (ev) {
          ev.stopPropagation();
          self._abrirSeguimiento(f._fila, f);
        });
        tr.querySelectorAll('.dv-planta, .dv-retiro, .dv-gas, .dv-puerto').forEach(function (td) {
          td.addEventListener('click', function (ev) { ev.stopPropagation(); self._abrirSeguimiento(f._fila, f); });
        });

        tbody.appendChild(tr);
      });
      if (!filas.length) tbody.innerHTML = '<tr><td colspan="17" style="text-align:center;color:#64748b;padding:14px">No hay servicios con estos filtros.</td></tr>';
      if (typeof _refrescarSnapshotFormulario === 'function') _refrescarSnapshotFormulario();
    }

    ['filtroViajeDesde', 'filtroViajeHasta'].forEach(function (id) {
      $q(id).addEventListener('change', function () { cargar(); });
    });
    ['filtroViajeSeguimiento', 'filtroViajeGas'].forEach(id => $q(id).addEventListener('change', refiltrar));
    let esperaBk = null;
    $q('filtroViajeBooking').addEventListener('input', function () { clearTimeout(esperaBk); esperaBk = setTimeout(refiltrar, 250); });

    $q('btnBorrarFiltroViaje').addEventListener('click', function () {
      msEstado.limpiar(); msConductor.limpiar(); msCliente.limpiar(); msPacking.limpiar();
      ['filtroViajeDesde', 'filtroViajeHasta', 'filtroViajeSeguimiento', 'filtroViajeGas', 'filtroViajeBooking'].forEach(id => { $q(id).value = ''; });
      cargar();
    });

    raiz.querySelector('#btnCerrarDatosViaje').addEventListener('click', cerrarPanel);

    cargar();
  },

  _abrirSeguimiento: async function (filaServicio, servicio) {
    const self = this;
    const f = servicio || {};
    const seguimiento = await llamarBackend('obtenerSeguimiento', { fila: filaServicio }) || {};
    const cita = self._cita(f);
    const retiro = self._fhDe(f, 'FECHA DE RETIRO', 'HORA DE RETIRO');
    const devol = self._fhDe(f, 'FECHA DE DEVOLUCION', 'HORA DE DEVOLUCION');
    const libres = Number(f._horasLibres) >= 0 ? Number(f._horasLibres) : 7;

    function aDatetimeLocal(v) {
      if (!v) return '';
      const d = v instanceof Date ? v : new Date(String(v).trim());
      if (isNaN(d.getTime())) return '';
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    const esGas = self._esGas(f);
    const campos = [
      { id: 'txtInicioRuta', col: 'INICIO RUTA', label: 'Inicio de ruta', tipo: 'datetime-local', etapa: 1 },
      { id: 'txtRetiroVacio', col: 'RETIRO VACIO', label: 'Llegada al depósito (retiro vacío)', tipo: 'datetime-local', etapa: 1 },
      { id: 'txtSalidaVacio', col: 'SALIDA VACIO', label: 'Salida del depósito', tipo: 'datetime-local', etapa: 1 },
      { id: 'txtMuertos1', col: 'T MUERTOS 1', label: 'Tiempos muertos en ruta (h)', tipo: 'number', etapa: 2 },
      { id: 'txtLlegadaPlanta', col: 'LLEGADA PLANTA', label: 'Llegada a planta', tipo: 'datetime-local', etapa: 2 },
      { id: 'txtSalidaPlanta', col: 'SALIDA PLANTA', label: 'Salida de planta', tipo: 'datetime-local', etapa: 2 },
      { id: 'txtGasIni', col: 'INICIO GASIFICADO', label: 'Inicio del gasificado', tipo: 'datetime-local', etapa: 'g', dis: !esGas },
      { id: 'txtGasFin', col: 'FIN GASIFICADO', label: 'Fin del gasificado', tipo: 'datetime-local', etapa: 'g', dis: !esGas },
      { id: 'txtMuertos2', col: 'T MUERTOS 2', label: 'Tiempos muertos en ruta (h)', tipo: 'number', etapa: 3 },
      { id: 'txtLlegadaColaPuerto', col: 'LLEGADA COLA PUERTO', label: 'Llegada a cola de puerto', tipo: 'datetime-local', etapa: 3 },
      { id: 'txtSalidaPuerto', col: 'SALIDA DE PUERTO', label: 'Salida de puerto', tipo: 'datetime-local', etapa: 3 },
      { id: 'txtFinRuta', col: 'FIN DE RUTA', label: 'Fin de ruta', tipo: 'datetime-local', etapa: 3 }
    ];
    const campo = function (c) {
      const valor = c.tipo === 'datetime-local' ? aDatetimeLocal(seguimiento[c.col]) : (seguimiento[c.col] || '');
      return '<div class="sg-campo"><label for="' + c.id + '">' + c.label + '</label><input type="' + c.tipo + '" id="' + c.id + '" value="' + valor + '"' + (c.tipo === 'number' ? ' step="0.5" min="0"' : '') + (c.dis ? ' disabled title="Solo para servicios GASIFICADOS"' : '') + '></div>';
    };
    const etapa = function (n, icono, titulo, citaTxt, citaVal, idRes) {
      return '<div class="sg-etapa"><div class="sg-cab"><span class="sg-num">' + n + '</span><span>' + icono + ' ' + titulo + '</span></div>' +
        '<div class="sg-cita"><span>' + citaTxt + '</span><b>' + (citaVal ? self._fh(citaVal) : 'Sin dato') + '</b></div>' +
        campos.filter(c => c.etapa === n).map(campo).join('') +
        '<div class="sg-res" id="' + idRes + '">—</div></div>';
    };
    const MOT = { 'HORAS EXTRAS PLANTA': 'Horas extras en planta', 'GASIFICADO': 'Gasificado (horas)', 'HORAS EXTRAS PUERTO': 'Horas extras en puerto', 'PERNOCTE': 'Pernocte' };
    const scTabla = () => (f._sc || []).length
      ? '<table class="tabla-lista" style="margin-top:6px"><thead><tr><th>Código</th><th>Motivo</th><th>Cantidad</th><th>Total</th><th>Observación</th></tr></thead><tbody>' +
        f._sc.map(x => '<tr><td>' + esc(x.codigo) + '</td><td>' + esc(x.tipo) + '</td><td>' + (x.cantidad || '') + '</td><td>' + esc(x.moneda) + ' ' + Number(x.total || 0).toFixed(2) + '</td><td>' + esc(x.obs) + '</td></tr>').join('') + '</tbody></table>'
      : '<p style="color:#94a3b8;margin:6px 0 0">Aún no hay sobrecostos registrados para este servicio.</p>';

    const html = `
      <style>
        .sg-info { display:flex; flex-wrap:wrap; gap:4px 18px; background:#f1f5f9; border-radius:10px; padding:8px 12px; font-size:.84rem; color:#334155; margin-bottom:12px; }
        .sg-etapas { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .sg-etapa { border:1px solid #dbe3ee; border-radius:12px; padding:10px 12px; background:#fff; box-shadow:0 1px 2px rgba(15,23,42,.04); }
        .sg-cab { display:flex; align-items:center; gap:8px; font-weight:800; color:#1c3a5e; margin-bottom:8px; }
        .sg-num { display:inline-flex; width:24px; height:24px; border-radius:50%; background:#1c3a5e; color:#fff; align-items:center; justify-content:center; font-size:.8rem; }
        .sg-cita { display:flex; justify-content:space-between; background:#eef4fb; border-radius:8px; padding:6px 9px; font-size:.8rem; color:#475569; margin-bottom:8px; }
        .sg-cita b { color:#1c3a5e; }
        .sg-campo { margin-bottom:7px; }
        .sg-campo label { display:block; font-size:.74rem; color:#64748b; font-weight:600; margin-bottom:2px; }
        .sg-campo input { width:100%; box-sizing:border-box; }
        .sg-res { margin-top:6px; border-top:1px dashed #dbe3ee; padding-top:7px; font-size:.84rem; color:#334155; }
        .sg-res b { font-size:1rem; color:#1c3a5e; }
        .sg-tag { display:inline-block; padding:1px 8px; border-radius:9px; font-size:.72rem; font-weight:700; margin-left:4px; }
        .sg-fact { margin-top:14px; border:1px solid #fcd34d; background:#fffbeb; border-radius:12px; padding:10px 12px; }
        .sg-sug { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
        .sg-sug button { border:1px solid #f59e0b; background:#fff; color:#92400e; border-radius:9px; padding:6px 10px; font-weight:700; cursor:pointer; }
        .sg-sug button:hover { background:#fef3c7; }
        @media (max-width: 1250px) { .sg-etapas { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width: 760px) { .sg-etapas { grid-template-columns:1fr; } }
      </style>
      <div class="sg-info">
        <span>Cliente: <b>${esc(f['CLIENTE PARA FACTURACIÓN'] || '')}</b></span><span>Booking: <b>${esc(f['BOOKING'] || '')}</b></span>
        <span>Código: <b>${esc(f['CODIGO SERVICIO'] || '')}</b></span><span>Conductor: <b>${esc(f['CONDUCTOR'] || '')}</b> (${esc(f['PLACA TRACTO'] || '')})</span>
        <span>Destino: <b>${esc(f['DESTINO 1'] || '')}</b></span><span>Horas libres en planta: <b>${libres} h</b></span>
      </div>
      <div class="sg-etapas">
        ${etapa(1, '📦', 'Retiro del contenedor', 'Cita de retiro', retiro, 'sgRes1')}
        ${etapa(2, '🏭', 'Planta', 'Cita (posicionamiento)', cita, 'sgRes2')}
        <div class="sg-etapa"${esGas ? '' : ' style="opacity:.55"'}><div class="sg-cab"><span class="sg-num" style="background:#5b21b6">G</span><span>🧪 Gasificado</span></div>
          <div class="sg-cita" style="background:${esGas ? '#ede9fe' : '#f1f5f9'}"><span>Observación del servicio</span><b>${esGas ? 'GASIFICADO' : 'No aplica'}</b></div>
          ${campos.filter(c => c.etapa === 'g').map(campo).join('')}
          <div class="sg-res" id="sgResG">${esGas ? '—' : 'Este servicio no es gasificado: los campos están bloqueados.'}</div></div>
        ${etapa(3, '⚓', 'Puerto y devolución', 'Cita de devolución', devol, 'sgRes3')}
      </div>
      <div class="sg-fact">
        <b style="color:#92400e">💰 Por facturar al cliente (sobrecostos)</b>
        <div id="sgSugerencias" class="sg-sug"></div>
        <div id="sgNcForm" style="display:none;margin-top:8px;border:1px dashed #94a3b8;border-radius:10px;padding:8px 10px;background:#f8fafc">
          <b id="sgNcTit" style="color:#334155;font-size:.88rem"></b>
          <div class="fila-campos" style="margin-top:6px">
            <div class="campo"><label>Motivo</label><select id="sgNcMot">${self.MOTIVOS_NO_COBRO.map(m => '<option>' + m + '</option>').join('')}</select></div>
            <div class="campo" style="grid-column:span 2"><label>Detalle (obligatorio si es OTRO)</label><input type="text" id="sgNcDet" autocomplete="off"></div>
          </div>
          <div style="text-align:right;margin-top:4px"><button class="boton-secundario" id="sgNcCancelar">Cancelar</button> <button class="boton-primario" id="sgNcGrabar">Guardar: no se cobra</button></div>
        </div>
        <div style="margin-top:8px"><b style="color:#1c3a5e;font-size:.85rem">Ya registrados</b><div id="sgYaReg">${scTabla()}</div></div>
        <div id="dvFormSc" style="display:none;margin-top:10px;border-top:1px dashed #f59e0b;padding-top:10px">
          <div class="fila-campos">
            <div class="campo"><label>Motivo</label><select id="dvScMotivo">${Object.keys(MOT).map(k => '<option value="' + k + '">' + MOT[k] + '</option>').join('')}</select></div>
            <div class="campo"><label id="dvScCantLbl">Horas</label><input type="number" id="dvScCant" step="0.5" min="0"></div>
            <div class="campo"><label id="dvScPrecioLbl">Tarifa por hora (con IGV)</label><input type="number" id="dvScPrecio" step="0.01" min="0" placeholder="0.00"></div>
            <div class="campo"><label>Moneda</label><select id="dvScMoneda"><option value="$">Dólares ($)</option><option value="S/">Soles (S/)</option></select></div>
            <div class="campo" style="grid-column:1/-1"><label>Observación</label><input type="text" id="dvScObs" autocomplete="off"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <span id="dvScTotal" style="font-weight:700;color:#1c3a5e"></span>
            <span><button class="boton-secundario" id="dvScCancelar">Cancelar</button> <button class="boton-primario" id="dvScGrabar">Agregar al sobrecosto</button></span>
          </div>
        </div>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:space-between;">
        <button class="boton-secundario" id="btnVolverSeguimiento">Volver a la lista</button>
        <span style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="boton-secundario" id="btnCopiarSeg" title="Copia el resumen (tiempos y sobrecostos) para pegarlo en un correo">📋 Copiar para correo</button>
          <button class="boton-secundario" id="btnImprimirSeg" title="Abre el resumen listo para imprimir o guardar como PDF">🖨 Imprimir / PDF</button>
          <button class="boton-primario" id="btnGrabarSeguimiento">Grabar seguimiento</button>
        </span>
      </div>`;

    actualizarPanel('Seguimiento del Viaje', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      const val = id => { const v = $(id).value; if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
      const hTxt = function (h) {
        if (h === null) return '<span style="color:#94a3b8">falta completar</span>';
        if (h < 0 || h > 200) return '<span class="sg-tag" style="background:#fef3c7;color:#92400e">⚠ revisa las fechas (' + h.toFixed(1) + ' h)</span>';
        return '<b>' + h.toFixed(1) + ' h</b>';
      };
      let cobradoPlanta, cobradoPuerto, cobradoGas;
      const verCobrados = function () {
        cobradoPlanta = (f._sc || []).some(x => /^HORAS EXTRAS PLANTA|^H\.E\. PLANTA/.test(x.tipo));
        cobradoPuerto = (f._sc || []).some(x => /^HORAS EXTRAS PUERTO|^H\.E\. PUERTO/.test(x.tipo));
        cobradoGas = (f._sc || []).some(x => /^GASIFICADO/.test(x.tipo));
      };
      verCobrados();
      const nc = self._nc(f);
      const ncTag = c => '<span class="sg-tag" title="' + esc(self._ncTxt(nc[c])) + '" style="background:#e2e8f0;color:#475569">no se cobra</span>';
      const datosSeg = function () {
        const sg = {};
        campos.forEach(c => { if (!c.dis) sg[c.col] = $(c.id).value; });
        sg['NO COBRAR'] = Object.keys(nc).length ? JSON.stringify(nc) : '';
        return sg;
      };
      const tagCobro = (extra, cobrado, lib) => extra > 0
        ? '<span class="sg-tag" style="background:' + (cobrado ? '#dcfce7;color:#166534">✓ cobrado' : '#fee2e2;color:#b91c1c">+' + extra.toFixed(1) + ' h extra') + '</span>'
        : (extra === 0 ? '<span class="sg-tag" style="background:#dcfce7;color:#166534">dentro de las ' + lib + ' h</span>' : '');
      let ctx = {};
      const recalcular = function () {
        const retV = val('txtRetiroVacio'), salV = val('txtSalidaVacio'), lleP = val('txtLlegadaPlanta'), salP = val('txtSalidaPlanta');
        const cola = val('txtLlegadaColaPuerto'), salPu = val('txtSalidaPuerto');
        const enRet = self._horas(retV, salV), enPl = self._horas(lleP, salP), enPu = self._horas(cola, salPu);
        const cb = self._cobro(cita, lleP, salP, libres), extra = cb.extra;
        const okH = h => h !== null && h >= 0 && h <= 200;
        const extraPu = okH(enPu) ? Math.max(0, Math.round((enPu - self.LIBRES_PUERTO) * 100) / 100) : null;
        const gIni = esGas ? val('txtGasIni') : null, gFin = esGas ? val('txtGasFin') : null, enGas = self._horas(gIni, gFin);
        const gasCobrar = esGas && okH(enGas) && enGas >= 0.05 ? enGas : 0;
        ctx = { lleP: lleP, salP: salP, enPl: enPl, cb: cb, extra: extra, cola: cola, salPu: salPu, enPu: enPu, extraPu: extraPu, gIni: gIni, gFin: gFin, enGas: enGas };
        const desdeTxt = cb.desde === 'LLEGADA' ? 'desde la llegada (llegó después de la cita)' : (cb.desde === 'CITA' ? (lleP ? 'desde la cita (llegó antes)' : 'desde la cita') : '');
        $('sgRes1').innerHTML = 'Tiempo en el depósito: ' + hTxt(enRet);
        $('sgRes2').innerHTML = 'Tiempo real en planta (llegada → salida): ' + hTxt(enPl) +
          '<br>Tiempo para el cobro: ' + hTxt(cb.horas) + (desdeTxt && cb.horas !== null ? ' <span style="font-size:.74rem;color:#64748b">' + desdeTxt + '</span>' : '') + (extra > 0 ? (!cobradoPlanta && nc.PLANTA ? ncTag('PLANTA') : '<span class="sg-tag" style="background:' + (cobradoPlanta ? '#dcfce7;color:#166534">✓ cobrado' : '#fee2e2;color:#b91c1c">+' + extra.toFixed(1) + ' h extra') + '</span>') : (extra === 0 ? '<span class="sg-tag" style="background:#dcfce7;color:#166534">dentro de las ' + libres + ' h</span>' : ''));
        $('sgRes3').innerHTML = 'Tiempo en puerto (cola → salida): ' + hTxt(enPu) + (extraPu > 0 && !cobradoPuerto && nc.PUERTO ? ncTag('PUERTO') : tagCobro(extraPu, cobradoPuerto, self.LIBRES_PUERTO));
        if (esGas) $('sgResG').innerHTML = 'Tiempo de gasificado: ' + hTxt(enGas) +
          (gasCobrar && !cobradoGas && nc.GASIFICADO ? ncTag('GASIFICADO') : gasCobrar ? '<span class="sg-tag" style="background:' + (cobradoGas ? '#dcfce7;color:#166534">✓ cobrado' : '#ede9fe;color:#5b21b6">se cobran todas las horas') + '</span>' : '');
        const sug = [];
        const bNo = (c, h, txt) => nc[c]
          ? '<span style="display:inline-flex;align-items:center;gap:6px;font-size:.8rem;color:#475569;background:#e2e8f0;border-radius:9px;padding:4px 8px" title="' + esc(self._ncTxt(nc[c])) + '">' + txt + ': no se cobra (' + esc(nc[c].motivo) + ') <button data-rc="' + c + '" style="border:1px solid #64748b;color:#334155;padding:2px 7px">↺ Volver a cobrar</button></span>'
          : '<button data-nc="' + c + '" data-h="' + h + '" style="border-color:#94a3b8;color:#475569">✕ No se cobra</button>';
        ctx.ncH = { PLANTA: extra, GASIFICADO: gasCobrar, PUERTO: extraPu };
        if (extra > 0 && !cobradoPlanta) sug.push(nc.PLANTA ? bNo('PLANTA', extra, 'Horas extra en planta') : '<button data-m="HORAS EXTRAS PLANTA">+ Facturar ' + extra.toFixed(1) + ' h extra en planta</button>' + bNo('PLANTA', extra));
        if (gasCobrar && !cobradoGas) sug.push(nc.GASIFICADO ? bNo('GASIFICADO', gasCobrar, 'Gasificado') : '<button data-m="GASIFICADO">+ Facturar ' + gasCobrar.toFixed(1) + ' h de gasificado</button>' + bNo('GASIFICADO', gasCobrar));
        if (extraPu > 0 && !cobradoPuerto) sug.push(nc.PUERTO ? bNo('PUERTO', extraPu, 'Horas extra en puerto') : '<button data-m="HORAS EXTRAS PUERTO">+ Facturar ' + extraPu.toFixed(1) + ' h extra en puerto</button>' + bNo('PUERTO', extraPu));
        sug.push('<button data-m="PERNOCTE">+ Facturar pernocte</button>');
        const avisos = [];
        if (extra > 0 && !cobradoPlanta && !nc.PLANTA) avisos.push('pasó las horas libres en planta');
        if (gasCobrar && !cobradoGas && !nc.GASIFICADO) avisos.push('tiene horas de gasificado por cobrar');
        if (extraPu > 0 && !cobradoPuerto && !nc.PUERTO) avisos.push('pasó las ' + self.LIBRES_PUERTO + ' h libres en puerto');
        $('sgSugerencias').innerHTML = (avisos.length ? '<span style="width:100%;font-size:.82rem;color:#b91c1c">Este viaje ' + avisos.join(', ') + ': revisa y aprueba el cobro.</span>' : '') + sug.join('');
      };
      // Si las horas del gasificado no quedaron grabadas pero ya hay sobrecosto GASIFICADO, se recuperan de su detalle
      if (esGas && !$('txtGasIni').value && !$('txtGasFin').value) {
        const g = (f._sc || []).find(x => /^GASIF/.test(String(x.tipo || '')));
        const m = g && String(g.obs || '').match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}).*?(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})/);
        if (m) {
          $('txtGasIni').value = m[3] + '-' + m[2] + '-' + m[1] + 'T' + m[4];
          $('txtGasFin').value = m[7] + '-' + m[6] + '-' + m[5] + 'T' + m[8];
          $('txtGasIni').style.background = $('txtGasFin').style.background = '#fef9c3';
          $('txtGasIni').title = $('txtGasFin').title = 'Recuperado del sobrecosto registrado: revisa y pulsa Guardar';
        }
      }
      campos.forEach(c => $(c.id).addEventListener('input', recalcular));
      recalcular();

      // Formulario de sobrecosto
      const total = function () {
        const t = (Number($('dvScCant').value) || 0) * (Number($('dvScPrecio').value) || 0);
        $('dvScTotal').textContent = t > 0 ? 'Total: ' + $('dvScMoneda').value + ' ' + t.toFixed(2) : '';
      };
      const preparar = function (m) {
        $('dvScMotivo').value = m;
        $('dvScCantLbl').textContent = m === 'PERNOCTE' ? 'Noches' : 'Horas';
        $('dvScPrecioLbl').textContent = m === 'PERNOCTE' ? 'Tarifa por noche (con IGV)' : 'Tarifa por hora (con IGV)';
        if (m === 'HORAS EXTRAS PLANTA') { $('dvScCant').value = ctx.extra > 0 ? ctx.extra : ''; $('dvScObs').value = ctx.extra > 0 ? self._textoCobro(cita, ctx.lleP, ctx.salP, ctx.cb, libres) : ''; }
        else if (m === 'HORAS EXTRAS PUERTO') { $('dvScCant').value = ctx.extraPu > 0 ? ctx.extraPu : ''; $('dvScObs').value = ctx.enPu !== null ? ('Cola puerto ' + self._fh(ctx.cola) + ' · salida ' + self._fh(ctx.salPu) + ' · ' + ctx.enPu.toFixed(2) + ' h en puerto − ' + self.LIBRES_PUERTO + ' h libres') : ''; }
        else if (m === 'GASIFICADO') { $('dvScCant').value = ctx.enGas > 0 ? ctx.enGas : ''; $('dvScObs').value = ctx.enGas > 0 ? ('Gasificado ' + self._fh(ctx.gIni) + ' → ' + self._fh(ctx.gFin) + ' · ' + ctx.enGas.toFixed(2) + ' h (se cobran todas)') : ''; }
        else { $('dvScCant').value = 1; $('dvScObs').value = ''; }
        $('dvFormSc').style.display = ''; total(); $('dvScPrecio').focus();
      };
      const NOMBRE_NC = { PLANTA: 'horas extra en planta', GASIFICADO: 'horas de gasificado', PUERTO: 'horas extra en puerto' };
      let ncConcepto = null;
      const grabarNc = async function (msgOk) {
        const rs = await llamarBackend('grabarSeguimiento', { fila: filaServicio, datos: datosSeg() });
        if (!rs || !rs.ok) { mostrarMensaje('No se pudo guardar: ' + ((rs && rs.mensaje) || 'error'), 'error'); return false; }
        f._noCobrar = Object.keys(nc).length ? JSON.stringify(nc) : '';
        recalcular();
        if (typeof _refrescarSnapshotFormulario === 'function') setTimeout(_refrescarSnapshotFormulario, 0);
        mostrarMensaje(msgOk, 'exito');
        return true;
      };
      $('sgSugerencias').addEventListener('click', async function (ev) {
        const b = ev.target.closest('button[data-m]'); if (b) { preparar(b.dataset.m); return; }
        const n = ev.target.closest('button[data-nc]');
        if (n) {
          ncConcepto = n.dataset.nc;
          $('sgNcTit').textContent = 'No cobrar ' + Number(n.dataset.h || 0).toFixed(2) + ' ' + NOMBRE_NC[ncConcepto] + ' — indica el motivo';
          $('sgNcDet').value = ''; $('sgNcForm').style.display = ''; $('dvFormSc').style.display = 'none'; $('sgNcMot').focus();
          return;
        }
        const r = ev.target.closest('button[data-rc]');
        if (r) {
          const c = r.dataset.rc, prev = nc[c];
          delete nc[c];
          if (!(await grabarNc('Listo: las ' + NOMBRE_NC[c] + ' vuelven a quedar por cobrar.'))) nc[c] = prev;
        }
      });
      $('sgNcCancelar').addEventListener('click', () => { $('sgNcForm').style.display = 'none'; ncConcepto = null; });
      protegerClic($('sgNcGrabar'), async function () {
        if (!ncConcepto) return;
        const mot = $('sgNcMot').value, det = $('sgNcDet').value.trim();
        if (mot === 'OTRO' && !det) { mostrarMensaje('Escribe el detalle del motivo.', 'error'); return; }
        const s = (typeof Sesion !== 'undefined' && Sesion.datos && Sesion.datos()) || {};
        const hoy = new Date(), fecha = String(hoy.getDate()).padStart(2, '0') + '/' + String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear();
        const c = ncConcepto;
        nc[c] = { horas: Math.round((Number((ctx.ncH || {})[c]) || 0) * 100) / 100, motivo: mot + (det ? ': ' + det : ''), usuario: s.nombre || s.usuario || '', fecha: fecha };
        if (await grabarNc('Guardado: las ' + NOMBRE_NC[c] + ' no se cobran (' + nc[c].motivo + ').')) { $('sgNcForm').style.display = 'none'; ncConcepto = null; }
        else delete nc[c];
      });
      $('dvScMotivo').addEventListener('change', () => preparar($('dvScMotivo').value));
      ['dvScCant', 'dvScPrecio', 'dvScMoneda'].forEach(id => $(id).addEventListener('input', total));
      $('dvScCancelar').addEventListener('click', () => { $('dvFormSc').style.display = 'none'; });
      protegerClic($('dvScGrabar'), async function () {
        const d = { fila: filaServicio, tipo: $('dvScMotivo').value, cantidad: Number($('dvScCant').value), precio: Number($('dvScPrecio').value), moneda: $('dvScMoneda').value, observacion: $('dvScObs').value };
        if (!(d.cantidad > 0)) { mostrarMensaje('Ingrese la cantidad.', 'error'); return; }
        if (!(d.precio > 0)) { mostrarMensaje('Ingrese la tarifa.', 'error'); return; }
        // Primero se graban los tiempos escritos (si no, al volver a la lista se perdían, p. ej. las horas del gasificado)
        const rs = await llamarBackend('grabarSeguimiento', { fila: filaServicio, datos: datosSeg() });
        if (!rs || !rs.ok) { mostrarMensaje('No se pudieron grabar los tiempos del seguimiento: ' + ((rs && rs.mensaje) || 'error') + '. No se registró el sobrecosto.', 'error'); return; }
        const r = await llamarBackend('sobrecostoDesdePlanta', d);
        if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo registrar.', 'error'); return; }
        // Se queda en la ventana: agrega a "Ya registrados", oculta el formulario y deja listos los demás botones
        f._sc = (f._sc || []).concat([{ codigo: (r.codigo || r.codigoServicio || ''), tipo: d.tipo, cantidad: d.cantidad, total: Math.round(d.cantidad * d.precio * 100) / 100, moneda: d.moneda, obs: d.observacion }]);
        $('sgYaReg').innerHTML = scTabla();
        $('dvFormSc').style.display = 'none';
        verCobrados(); recalcular();
        if (typeof _refrescarSnapshotFormulario === 'function') setTimeout(_refrescarSnapshotFormulario, 0);
        mostrarMensaje('Sobrecosto agregado (' + (MOT[d.tipo] || d.tipo) + '). Los tiempos quedaron guardados. Puedes agregar otro o volver a la lista.', 'exito');
      });

      // Resumen para correo / PDF (con lo que está escrito en pantalla, aunque no se haya grabado)
      const armarResumen = function () {
        recalcular();
        const fh = d => d ? self._fh(d) : '—';
        const hh = h => (h === null || h === undefined) ? '—' : (h < 0 || h > 200 ? 'revisar fechas' : h.toFixed(2) + ' h');
        const td = 'style="border:1px solid #cbd5e1;padding:5px 8px;font-family:Arial,sans-serif;font-size:12px"';
        const th = 'style="border:1px solid #cbd5e1;padding:5px 8px;background:#1c3a5e;color:#fff;font-family:Arial,sans-serif;font-size:12px;text-align:left"';
        const fila = (a, b, c) => '<tr><td ' + td + '>' + a + '</td><td ' + td + '>' + b + '</td><td ' + td + '>' + (c || '') + '</td></tr>';
        let gasH = esGas ? self._horas(val('txtGasIni'), val('txtGasFin')) : null;
        const gasSc = (f._sc || []).find(x => /^GASIF/.test(String(x.tipo || '').toUpperCase()));
        if (esGas && gasH === null && gasSc && Number(gasSc.cantidad) > 0) gasH = Number(gasSc.cantidad);
        const extraPu = ctx.extraPu;
        const MOTL = { 'HORAS EXTRAS PLANTA': 'Horas extras en planta', 'H.E. PLANTA F.': 'Horas extras en planta', 'HORAS EXTRAS PUERTO': 'Horas extras en puerto', 'H.E. PUERTO F.': 'Horas extras en puerto',
          'GASIFICADO': 'Gasificado', 'GASIFICADO F.': 'Gasificado', 'REPROGRAMACION': 'Reprogramación de posicionamiento', 'REPROG. F.': 'Reprogramación de posicionamiento', 'PERNOCTE': 'Pernocte', 'PERNOCTE F.': 'Pernocte', 'SOBREESTADIA': 'Sobreestadía', 'SOBREEST. F.': 'Sobreestadía' };
        const unidad = tp => /PERNOCTE|SOBREEST/.test(tp) ? ' día(s)' : (/HORAS|H\.E\.|GASIF/.test(tp) ? ' h' : '');
        // 1) Detalle del sobrecosto (primera parte del correo)
        const sc = f._sc || [];
        const regTipos = sc.map(x => String(x.tipo || '').toUpperCase());
        const pend = [];
        if (ctx.extra > 0 && !nc.PLANTA && !regTipos.some(x => /HORAS EXTRAS PLANTA|H\.E\. PLANTA/.test(x))) pend.push(['Horas extras en planta', ctx.extra.toFixed(2) + ' h']);
        if (esGas && !nc.GASIFICADO && gasH >= 0.05 && gasH <= 200 && !regTipos.some(x => /^GASIF/.test(x))) pend.push(['Gasificado', gasH.toFixed(2) + ' h']);
        if (extraPu > 0 && !nc.PUERTO && !regTipos.some(x => /HORAS EXTRAS PUERTO|H\.E\. PUERTO/.test(x))) pend.push(['Horas extras en puerto', extraPu.toFixed(2) + ' h']);
        let h = '<div style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b">';
        h += '<p style="margin:0 0 8px">Estimados, se detalla el sobrecosto del siguiente servicio:</p>';
        h += '<p style="margin:0 0 4px"><b>Detalle del sobrecosto</b></p>';
        h += '<table style="border-collapse:collapse;margin-bottom:12px"><tr><th ' + th + '>Concepto</th><th ' + th + '>Cantidad</th><th ' + th + '>Tarifa</th><th ' + th + '>Total</th><th ' + th + '>Detalle</th></tr>';
        let totUsd = 0, totPen = 0;
        sc.forEach(function (x) {
          const tp = String(x.tipo || '').toUpperCase(), cant = Number(x.cantidad) || 0, tot = Number(x.total) || 0, mon = String(x.moneda || '$');
          if (/S\//.test(mon)) totPen += tot; else totUsd += tot;
          h += '<tr><td ' + td + '>' + esc(MOTL[tp] || x.tipo) + '</td><td ' + td + '>' + (cant ? cant + unidad(tp) : '1') + '</td><td ' + td + '>' + esc(mon) + ' ' + (cant ? (tot / cant).toFixed(2) : tot.toFixed(2)) + '</td><td ' + td + '><b>' + esc(mon) + ' ' + tot.toFixed(2) + '</b></td><td ' + td + '>' + esc(x.obs || '') + '</td></tr>';
        });
        pend.forEach(function (x) { h += '<tr><td ' + td + '>' + x[0] + '</td><td ' + td + '>' + x[1] + '</td><td ' + td + '>—</td><td ' + td + '>—</td><td ' + td + '>Según tiempos del servicio</td></tr>'; });
        if (!sc.length && !pend.length) h += '<tr><td ' + td + ' colspan="5">Sin sobrecostos.</td></tr>';
        if (totUsd || totPen) h += '<tr><td ' + td + ' colspan="3"><b>TOTAL</b></td><td ' + td + '><b>' + [totUsd ? '$ ' + totUsd.toFixed(2) : '', totPen ? 'S/ ' + totPen.toFixed(2) : ''].filter(Boolean).join(' + ') + '</b></td><td ' + td + '></td></tr>';
        h += '</table>';
        // 2) Datos del servicio y tiempos
        h += '<p style="margin:0 0 4px"><b>Datos del servicio</b></p>';
        h += '<table style="border-collapse:collapse;margin-bottom:10px">' +
          [['Cliente', f['CLIENTE PARA FACTURACIÓN']], ['Booking', f['BOOKING']], ['Contenedor', f['N° CONTENEDOR']], ['Código', f['CODIGO SERVICIO']],
           ['Conductor / placa', (f['CONDUCTOR'] || '') + ' / ' + (f['PLACA TRACTO'] || '')], ['Planta / destino', [f['PACKING'], f['DESTINO 1']].filter(x => x && x !== '-').join(' · ')]]
            .map(x => '<tr><td ' + td + '><b>' + x[0] + '</b></td><td ' + td + '>' + esc(x[1] || '') + '</td></tr>').join('') + '</table>';
        h += '<p style="margin:0 0 4px"><b>Tiempos del servicio</b></p>';
        h += '<table style="border-collapse:collapse;margin-bottom:10px"><tr><th ' + th + '>Etapa</th><th ' + th + '>Fecha y hora</th><th ' + th + '>Detalle</th></tr>';
        h += fila('Cita de retiro', fh(retiro), '') + fila('Llegada al depósito', fh(val('txtRetiroVacio')), '') + fila('Salida del depósito', fh(val('txtSalidaVacio')), '');
        h += fila('<b>Cita en planta (posicionamiento)</b>', '<b>' + fh(cita) + '</b>', '') + fila('Llegada a planta', fh(ctx.lleP), '') + fila('Salida de planta', fh(ctx.salP), '');
        if (esGas) h += fila('Inicio del gasificado', fh(val('txtGasIni')), '') + fila('Fin del gasificado', fh(val('txtGasFin')), '');
        h += fila('Cita de devolución', fh(devol), '') + fila('Llegada a cola de puerto', fh(ctx.cola), '') + fila('Salida de puerto', fh(ctx.salPu), '');
        h += '</table>';
        h += '<table style="border-collapse:collapse;margin-bottom:10px"><tr><th ' + th + '>Concepto</th><th ' + th + '>Tiempo</th><th ' + th + '>Horas libres</th><th ' + th + '>Por cobrar</th></tr>';
        const fila4 = (a, b, c, d) => '<tr><td ' + td + '>' + a + '</td><td ' + td + '>' + b + '</td><td ' + td + '>' + c + '</td><td ' + td + '><b>' + d + '</b></td></tr>';
        h += fila4('Tiempo real en planta (llegada → salida)', hh(ctx.enPl), '', '');
        h += fila4('Tiempo en planta para el cobro (' + (ctx.cb && ctx.cb.desde === 'LLEGADA' ? 'desde la llegada, llegó después de la cita' : 'desde la cita') + ')', hh(ctx.cb && ctx.cb.horas), libres + ' h', ctx.extra > 0 ? (nc.PLANTA ? 'No se cobra (' + esc(nc.PLANTA.motivo) + ')' : ctx.extra.toFixed(2) + ' h') : '0 h');
        if (esGas) h += fila4('Gasificado', hh(gasH), 'sin horas libres', gasH >= 0.05 && gasH <= 200 ? (nc.GASIFICADO ? 'No se cobra (' + esc(nc.GASIFICADO.motivo) + ')' : gasH.toFixed(2) + ' h') : '0 h');
        h += fila4('Tiempo en puerto (cola → salida)', hh(ctx.enPu), self.LIBRES_PUERTO + ' h', extraPu > 0 ? (nc.PUERTO ? 'No se cobra (' + esc(nc.PUERTO.motivo) + ')' : extraPu.toFixed(2) + ' h') : '0 h');
        h += '</table>';
        h += '<p style="margin:10px 0 0"><b>Favor de confirmar para proceder con la facturación.</b></p>';
        h += '</div>';
        const txt = h.replace(/<\/(tr|p)>/g, '\n').replace(/<\/t[dh]>/g, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
        return { html: h, txt: txt };
      };
      // Asunto: SOBRECOSTOS - BK: xxx- CONTENEDOR: xxx|| CLIENTE: <razón social del maestro de clientes>
      const asunto = async function () {
        if (!self._razones) {
          self._razones = {};
          try { const r = await llamarBackend('listarClientes', {}); (r && r.clientes || []).forEach(c => { self._razones[String(c.codigo || '').trim().toUpperCase()] = c.razonSocial; }); } catch (e) { /* sin maestro */ }
        }
        const cod = String(f['CLIENTE PARA FACTURACIÓN'] || '').trim().toUpperCase();
        return 'SOBRECOSTOS - BK: ' + String(f['BOOKING'] || '').trim() + '- CONTENEDOR: ' + String(f['N° CONTENEDOR'] || '').trim() + '|| CLIENTE: ' + (self._razones[cod] || cod);
      };
      const copiar = async function (html, txt) {
        try {
          if (html) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([txt], { type: 'text/plain' }) })]);
          else await navigator.clipboard.writeText(txt);
        } catch (e) {
          const d = document.createElement('div'); if (html) d.innerHTML = html; else d.textContent = txt; d.style.position = 'fixed'; d.style.left = '-9999px'; document.body.appendChild(d);
          const rg = document.createRange(); rg.selectNodeContents(d); const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg);
          document.execCommand('copy'); s.removeAllRanges(); d.remove();
        }
      };
      $('btnCopiarSeg').addEventListener('click', async function () {
        const r = armarResumen(); const as = await asunto();
        const velo = document.createElement('div');
        velo.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px';
        velo.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:640px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.25)">' +
          '<div style="background:#1c3a5e;color:#fff;padding:12px 16px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between"><b>📧 Correo de sobrecosto</b><button type="button" id="ccX" style="background:none;border:0;color:#fff;font-size:20px;cursor:pointer">×</button></div>' +
          '<div style="padding:14px 16px;font-size:.88rem">' +
          '<div class="campo"><label>Asunto</label><div style="display:flex;gap:6px"><input id="ccAsunto" readonly style="flex:1" value="' + esc(as) + '"><button type="button" class="boton-secundario" id="ccCopAs">📋 Copiar asunto</button></div></div>' +
          '<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="color:#64748b">El cuerpo lleva el detalle del sobrecosto, los datos y tiempos del servicio y la línea "Favor de confirmar para proceder con la facturación."</span>' +
          '<button type="button" class="boton-primario" id="ccCopCu">📋 Copiar cuerpo</button></div>' +
          '<div style="text-align:right;margin-top:12px"><button type="button" class="boton-secundario" id="ccCerrar">Cerrar</button></div></div></div>';
        document.body.appendChild(velo);
        const q = id => velo.querySelector('#' + id); const cerrar = () => velo.remove();
        q('ccX').addEventListener('click', cerrar); q('ccCerrar').addEventListener('click', cerrar);
        q('ccCopAs').addEventListener('click', async function () { await copiar(null, as); this.textContent = '✓ Asunto copiado'; });
        q('ccCopCu').addEventListener('click', async function () { await copiar(r.html, r.txt); this.textContent = '✓ Cuerpo copiado'; });
      });
      $('btnImprimirSeg').addEventListener('click', async function () {
        const r = armarResumen(); const as = await asunto();
        const w = window.open('', '_blank');
        if (!w) { mostrarMensaje('El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio.', 'error'); return; }
        w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(as) + '</title>' +
          '<style>body{margin:24px}@page{size:A4;margin:14mm}</style></head><body>' +
          '<div style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#1c3a5e;margin-bottom:4px">TRANSPORTES SSI S.A.C.</div>' +
          '<div style="font-family:Arial,sans-serif;font-size:12px;font-weight:bold;margin-bottom:10px">' + esc(as) + '</div>' + r.html +
          '<p style="font-family:Arial,sans-serif;font-size:11px;color:#64748b;margin-top:14px">Generado el ' + self._fh(new Date()) + '</p></body></html>');
        w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 400);
      });

      $('btnVolverSeguimiento').addEventListener('click', () => self._mostrarListaEnPanel());
      protegerClic($('btnGrabarSeguimiento'), async function () {
        const resp = await llamarBackend('grabarSeguimiento', { fila: filaServicio, datos: datosSeg() });
        if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
        mostrarMensaje(resp.mensaje, resp.completo ? 'exito' : 'info');
        self._mostrarListaEnPanel();
      });
    });
  },

  /** Fecha+hora de la cita (posicionamiento 1) como Date local. */
  _cita: function (f) { return this._fhDe(f, 'FECHA DE POSICIONAMIENTO 1', 'HORA DE POSICIONAMIENTO 1'); },
  /** Fecha + hora de dos columnas del servicio como Date local. */
  _fhDe: function (f, colFecha, colHora) {
    const fv = f[colFecha];
    if (!fv) return null;
    const d = new Date(fv);
    if (isNaN(d.getTime())) return null;
    let hh = 0, mm = 0;
    const h = f[colHora];
    const m = String(h || '').match(/(\d{1,2}):(\d{2})/);
    if (m) { hh = +m[1]; mm = +m[2]; }
    else if (h) { const dh = new Date(h); if (!isNaN(dh.getTime())) { hh = dh.getUTCHours(); mm = dh.getUTCMinutes(); } }
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
  },
  _fecha: function (v) { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; },
  _fh: function (d) {
    if (!d) return '—';
    const p = n => String(n).padStart(2, '0');
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },
  _horas: function (a, b) { return (a && b) ? Math.round((b - a) / 36000) / 100 : null; },
  /**
   * Horas extra en planta. El cobro empieza en la hora MÁS TARDE entre la cita
   * (posicionamiento) y la llegada: si llegó antes de la cita se cuenta desde la cita;
   * si llegó después, desde la llegada. Extra = (salida − inicio) − horas libres.
   */
  _cobro: function (cita, llegada, salida, libres) {
    let inicio = null, desde = '';
    if (cita && llegada) { if (llegada > cita) { inicio = llegada; desde = 'LLEGADA'; } else { inicio = cita; desde = 'CITA'; } }
    else if (cita) { inicio = cita; desde = 'CITA'; }
    else if (llegada) { inicio = llegada; desde = 'LLEGADA'; }
    const horas = this._horas(inicio, salida);
    const extra = horas === null || horas < 0 || horas > 200 ? null : Math.max(0, Math.round((horas - libres) * 100) / 100);
    return { inicio: inicio, desde: desde, horas: horas, extra: extra };
  },
  _textoCobro: function (cita, llegada, salida, cb, libres) {
    const hh = d => d ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '—';
    const ini = cb.desde === 'LLEGADA'
      ? 'Llegada ' + this._fh(llegada) + (cita ? ' (después de la cita ' + hh(cita) + ')' : '')
      : 'Cita ' + this._fh(cita) + (llegada ? ' (llegó antes, ' + hh(llegada) + ')' : '');
    return ini + ' · salida ' + this._fh(salida) + ' · ' + (cb.horas || 0).toFixed(2) + ' h − ' + libres + ' h libres';
  },
  _calc: function (f) {
    const cita = this._cita(f), sal = this._fecha(f._salidaPlanta);
    const libres = Number(f._horasLibres) >= 0 ? Number(f._horasLibres) : 7;
    const cb = this._cobro(cita, this._fecha(f._llegadaPlanta), sal, libres);
    const enPlanta = cb.horas, extra = cb.extra;
    const cobrado = (f._sc || []).filter(x => /^HORAS EXTRAS PLANTA|^H\.E\. PLANTA/.test(x.tipo));
    return { cita: cita, llegada: this._fecha(f._llegadaPlanta), salida: sal, enPlanta: enPlanta, libres: libres, extra: extra, cobrado: cobrado, cb: cb,
      llegPuerto: this._fecha(f._llegadaPuerto), salPuerto: this._fecha(f._salidaPuerto),
      enPlantaReal: this._horas(this._fecha(f._llegadaPlanta), sal),
      enPuerto: this._horas(this._fecha(f._llegadaPuerto), this._fecha(f._salidaPuerto)),
      retVacio: this._fecha(f._retiroVacio), salVacio: this._fecha(f._salidaVacio),
      enRetiro: this._horas(this._fecha(f._retiroVacio), this._fecha(f._salidaVacio)),
      esGas: this._esGas(f), enGas: this._horas(this._fecha(f._gasIni), this._fecha(f._gasFin)) };
  },
  _esGas: function (f) { return /GASIF/i.test(String(f['OBSERVACION'] || '')); },
  MOTIVOS_NO_COBRO: ['CORTESIA AL CLIENTE', 'DEMORA ATRIBUIBLE A SSI', 'ACUERDO COMERCIAL', 'CLIENTE NO ACEPTO EL COBRO', 'OTRO'],
  _nc: function (f) { try { const o = JSON.parse(f._noCobrar || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } },
  _ncTxt: function (x) { return x ? ('No se cobra: ' + x.motivo + (x.horas ? ' · ' + Number(x.horas).toFixed(2) + ' h' : '') + (x.usuario ? ' · ' + x.usuario : '') + (x.fecha ? ' · ' + x.fecha : '')) : ''; },
  _celdaGas: function (f) {
    if (!this._esGas(f)) return '<span style="color:#94a3b8">—</span>';
    let h = this._calc(f).enGas;
    const sc = (f._sc || []).find(x => /^GASIF/.test(String(x.tipo || '')));
    if (h === null && sc && Number(sc.cantidad) > 0) h = Number(sc.cantidad);
    const nc = this._nc(f).GASIFICADO;
    return '<span style="display:inline-block;padding:1px 7px;border-radius:8px;background:#ede9fe;color:#5b21b6;font-size:.72rem;font-weight:700">Sí</span>' +
      '<br>' + (h === null ? '<span style="font-size:.7rem;color:#94a3b8">sin horas</span>' : this._celdaH(h)) +
      (sc ? '<br><span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#dcfce7;color:#166534;font-size:.7rem;font-weight:700">✓ cobrado</span>'
        : nc ? '<br><span title="' + esc(this._ncTxt(nc)) + '" style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#e2e8f0;color:#475569;font-size:.7rem;font-weight:700">no se cobra</span>'
        : (h >= 0.05 && h <= 200 ? '<br><span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#fee2e2;color:#b91c1c;font-size:.7rem;font-weight:700">por cobrar</span>' : ''));
  },
  _celdaH: function (h) {
    if (h === null || h === undefined) return '<span style="color:#94a3b8">—</span>';
    if (h < 0 || h > 200) return '<span title="Las fechas del seguimiento parecen mal digitadas (sale ' + h.toFixed(1) + ' h). Revisa el año, mes y día." style="display:inline-block;padding:1px 6px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:.7rem;font-weight:700">⚠ revisar</span>';
    return '<b>' + h.toFixed(1) + ' h</b>';
  },
  _celdaPuerto: function (f) {
    const h = this._calc(f).enPuerto;
    let s = this._celdaH(h);
    if (h === null || h < 0 || h > 200) return s;
    const cobrado = (f._sc || []).some(x => /^HORAS EXTRAS PUERTO|^H\.E\. PUERTO/.test(x.tipo));
    const ex = Math.max(0, Math.round((h - this.LIBRES_PUERTO) * 100) / 100);
    const nc = this._nc(f).PUERTO;
    if (cobrado) s += '<br><span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#dcfce7;color:#166534;font-size:.7rem;font-weight:700">✓ cobrado</span>';
    else if (ex > 0 && nc) s += '<br><span title="' + esc(this._ncTxt(nc)) + '" style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#e2e8f0;color:#475569;font-size:.7rem;font-weight:700">no se cobra</span>';
    else if (ex > 0) s += '<br><span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#fee2e2;color:#b91c1c;font-size:.7rem;font-weight:700">+' + ex.toFixed(1) + ' h extra</span>';
    return s;
  },
  _celdaPlanta: function (f) {
    const c = this._calc(f);
    if (c.enPlantaReal === null && c.enPlanta === null) return '<span style="color:#94a3b8">—</span>';
    let h = this._celdaH(c.enPlantaReal);
    const nc = this._nc(f).PLANTA;
    if (c.cobrado.length) h += '<br><span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#dcfce7;color:#166534;font-size:.7rem;font-weight:700">✓ cobrado</span>';
    else if (c.extra > 0 && nc) h += '<br><span title="' + esc(this._ncTxt(nc)) + '" style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#e2e8f0;color:#475569;font-size:.7rem;font-weight:700">no se cobra</span>';
    else if (c.extra > 0) h += '<br><span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#fee2e2;color:#b91c1c;font-size:.7rem;font-weight:700">+' + c.extra.toFixed(1) + ' h extra</span>';
    return h;
  },

  /** Ventana: tiempos en planta / puerto y registro de sobrecosto. */
  _abrirTiempos: function (f) {
    const self = this;
    const c = self._calc(f);
    const enPuerto = self._horas(c.llegPuerto, c.salPuerto);
    const fila = (k, v, st) => '<tr><td style="padding:5px 8px;color:#475569">' + k + '</td><td style="padding:5px 8px;font-weight:600;' + (st || '') + '">' + v + '</td></tr>';
    const MOT = { 'HORAS EXTRAS PLANTA': 'Horas extras en planta', 'GASIFICADO': 'Gasificado (horas)', 'HORAS EXTRAS PUERTO': 'Horas extras en puerto', 'PERNOCTE': 'Pernocte' };
    const scHtml = (f._sc || []).length
      ? '<table class="tabla-lista" style="margin-top:6px"><thead><tr><th>Código</th><th>Motivo</th><th>Cantidad</th><th>Total</th><th>Observación</th></tr></thead><tbody>' +
        f._sc.map(x => '<tr><td>' + esc(x.codigo) + '</td><td>' + esc(x.tipo) + '</td><td>' + (x.cantidad || '') + '</td><td>' + esc(x.moneda) + ' ' + Number(x.total || 0).toFixed(2) + '</td><td>' + esc(x.obs) + '</td></tr>').join('') + '</tbody></table>'
      : '<p style="color:#94a3b8;margin:6px 0">Este servicio no tiene sobrecostos registrados.</p>';
    const html = `
      <div style="display:flex;flex-wrap:wrap;gap:6px 18px;margin-bottom:10px;font-size:.85rem;color:#334155">
        <span>Cliente: <b>${esc(f['CLIENTE PARA FACTURACIÓN'] || '')}</b></span><span>Booking: <b>${esc(f['BOOKING'] || '')}</b></span>
        <span>Código: <b>${esc(f['CODIGO SERVICIO'] || '')}</b></span><span>Conductor: <b>${esc(f['CONDUCTOR'] || '')}</b> (${esc(f['PLACA TRACTO'] || '')})</span>
        <span>Destino: <b>${esc(f['DESTINO 1'] || '')}</b></span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px">
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px">
          <b style="color:#1c3a5e">En retiro (depósito)</b>
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            ${fila('Retiro vacío', self._fh(c.retVacio))}${fila('Salida del depósito', self._fh(c.salVacio))}
            ${fila('Tiempo total en retiro', c.enRetiro === null ? '—' : c.enRetiro.toFixed(2) + ' h')}
          </table>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px">
          <b style="color:#1c3a5e">En planta</b>
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            ${fila('Posicionamiento (cita)', self._fh(c.cita))}${fila('Llegada a planta', self._fh(c.llegada))}${fila('Salida de planta', self._fh(c.salida))}
            ${fila('Tiempo total en planta (llegada → salida)', c.enPlantaReal === null ? '—' : c.enPlantaReal.toFixed(2) + ' h')}
            ${fila('Horas para el cobro (' + (c.cb.desde === 'LLEGADA' ? 'desde la llegada' : 'desde la cita') + ')', c.enPlanta === null ? '—' : c.enPlanta.toFixed(2) + ' h')}
            ${fila('Horas libres del cliente', c.libres + ' h')}
            ${fila('Horas extra', c.extra === null ? '—' : c.extra.toFixed(2) + ' h', c.extra > 0 ? 'color:#b91c1c;font-size:1rem' : 'color:#166534')}
          </table>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px">
          <b style="color:#1c3a5e">En puerto</b>
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            ${fila('Llegada a cola de puerto', self._fh(c.llegPuerto))}${fila('Salida de puerto', self._fh(c.salPuerto))}
            ${fila('Tiempo total en puerto (cola → salida)', enPuerto === null ? '—' : enPuerto.toFixed(2) + ' h')}
          </table>
        </div>
      </div>
      <div style="margin-top:12px"><b style="color:#1c3a5e">Sobrecostos del servicio</b>${scHtml}</div>
      <div id="dvFormSc" style="display:none;margin-top:12px;border:1px solid #fcd34d;background:#fffbeb;border-radius:10px;padding:10px 12px">
        <b style="color:#92400e">Agregar sobrecosto</b>
        <div class="fila-campos" style="margin-top:6px">
          <div class="campo"><label>Motivo</label><select id="dvScMotivo">${Object.keys(MOT).map(k => '<option value="' + k + '">' + MOT[k] + '</option>').join('')}</select></div>
          <div class="campo"><label id="dvScCantLbl">Horas</label><input type="number" id="dvScCant" step="0.5" min="0"></div>
          <div class="campo"><label id="dvScPrecioLbl">Tarifa por hora (con IGV)</label><input type="number" id="dvScPrecio" step="0.01" min="0" placeholder="0.00"></div>
          <div class="campo"><label>Moneda</label><select id="dvScMoneda"><option value="$">Dólares ($)</option><option value="S/">Soles (S/)</option></select></div>
          <div class="campo" style="grid-column:1/-1"><label>Observación</label><input type="text" id="dvScObs" autocomplete="off"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span id="dvScTotal" style="font-weight:700;color:#1c3a5e"></span>
          <button class="boton-primario" id="dvScGrabar">Agregar al sobrecosto</button>
        </div>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:space-between;">
        <button class="boton-secundario" id="dvVolver">Volver a la lista</button>
        <button class="boton-primario" id="dvAbrirSc" style="background:#b45309">+ Agregar sobrecosto</button>
      </div>`;
    actualizarPanel('Tiempo en planta y sobrecostos', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      $('dvVolver').addEventListener('click', () => self._mostrarListaEnPanel());
      const sugerida = function () {
        const m = $('dvScMotivo').value;
        $('dvScCantLbl').textContent = m === 'PERNOCTE' ? 'Noches' : 'Horas';
        $('dvScPrecioLbl').textContent = m === 'PERNOCTE' ? 'Tarifa por noche (con IGV)' : 'Tarifa por hora (con IGV)';
        if (m === 'HORAS EXTRAS PLANTA') { $('dvScCant').value = c.extra > 0 ? c.extra : ''; $('dvScObs').value = c.extra > 0 ? self._textoCobro(c.cita, c.llegada, c.salida, c.cb, c.libres) : ''; }
        else if (m === 'HORAS EXTRAS PUERTO') { $('dvScCant').value = ''; $('dvScObs').value = enPuerto !== null ? ('Cola puerto ' + self._fh(c.llegPuerto) + ' · salida ' + self._fh(c.salPuerto) + ' · ' + enPuerto.toFixed(2) + ' h en puerto') : ''; }
        else { $('dvScCant').value = 1; $('dvScObs').value = ''; }
        total();
      };
      const total = function () {
        const t = (Number($('dvScCant').value) || 0) * (Number($('dvScPrecio').value) || 0);
        $('dvScTotal').textContent = t > 0 ? 'Total: ' + $('dvScMoneda').value + ' ' + t.toFixed(2) : '';
      };
      ['dvScCant', 'dvScPrecio', 'dvScMoneda'].forEach(id => $(id).addEventListener('input', total));
      $('dvScMotivo').addEventListener('change', sugerida);
      $('dvAbrirSc').addEventListener('click', function () { $('dvFormSc').style.display = ''; this.style.display = 'none'; sugerida(); $('dvScPrecio').focus(); });
      protegerClic($('dvScGrabar'), async function () {
        const d = { fila: f._fila, tipo: $('dvScMotivo').value, cantidad: Number($('dvScCant').value), precio: Number($('dvScPrecio').value), moneda: $('dvScMoneda').value, observacion: $('dvScObs').value };
        if (!(d.cantidad > 0)) { mostrarMensaje('Ingrese la cantidad.', 'error'); return; }
        if (!(d.precio > 0)) { mostrarMensaje('Ingrese la tarifa.', 'error'); return; }
        const r = await llamarBackend('sobrecostoDesdePlanta', d);
        if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo registrar.', 'error'); return; }
        mostrarMensaje(r.mensaje, 'exito');
        self._mostrarListaEnPanel();
      });
    });
  },

  _mostrarListaEnPanel: function () {
    // Reconstruye la lista dentro del panel ya abierto, con los filtros recordados.
    actualizarPanel('Datos del Viaje', this._htmlLista(), (raiz) => this._wireLista(raiz));
  }
};
