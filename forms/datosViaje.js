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

  abrir: async function () {
    this._mostrarLista();
  },

  _mostrarLista: function () {
    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Desde</label><input type="text" id="filtroViajeDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroViajeHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Seguimiento</label>
          <select id="filtroViajeSeguimiento">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Incompleto</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltroViaje">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaDatosViaje">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Booking</th><th>Tipo de carga</th><th>Conductor</th>
            <th>Tracto</th><th>Depósito de retiro</th><th>Fecha de retiro</th><th>Destino</th>
            <th>Fecha de posicionamiento</th><th>Fecha de devolución</th><th title="Retiro vacío → salida del depósito">T. retiro</th><th title="Llegada → salida de planta (el extra se cuenta desde la cita)">T. planta</th><th title="Llegada a cola de puerto → salida de puerto">T. puerto</th><th>Seguimiento</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarDatosViaje">Cerrar</button>
      </div>`;

    abrirPanel('Datos del Viaje', html, (raiz) => this._wireLista(raiz), { ancho: true });
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

    function formatoFechaHora(fecha, hora) {
      const f = formatoFecha(fecha);
      const h = formatoHora(hora);
      if (f === '' && h === '') return '';
      if (h === '') return f;
      return (f + ' ' + h).trim();
    }

    async function cargar() {
      const filtros = {
        fechaDesde: raiz.querySelector('#filtroViajeDesde').value.trim(),
        fechaHasta: raiz.querySelector('#filtroViajeHasta').value.trim()
      };
      let filas = await llamarBackend('listarConSeguimiento', filtros);

      const seg = raiz.querySelector('#filtroViajeSeguimiento').value;
      if (seg === 'completo') filas = filas.filter(f => f._seguimientoCompleto);
      if (seg === 'incompleto') filas = filas.filter(f => !f._seguimientoCompleto);

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
          <td>${f['BOOKING'] || ''}</td>
          <td>${f['TIPO DE CARGA'] || ''}</td>
          <td>${f['CONDUCTOR'] || ''}</td>
          <td>${f['PLACA TRACTO'] || ''}</td>
          <td>${f['DEPOSITO DE RETIRO'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE RETIRO'], f['HORA DE RETIRO'])}</td>
          <td>${f['DESTINO 1'] || ''}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE POSICIONAMIENTO 1'], f['HORA DE POSICIONAMIENTO 1'])}</td>
          <td class="celda-fechahora">${formatoFechaHora(f['FECHA DE DEVOLUCION'], f['HORA DE DEVOLUCION'])}</td>
          <td class="dv-retiro" style="text-align:center;cursor:pointer;">${self._celdaH(self._calc(f).enRetiro)}</td>
          <td class="dv-planta" style="text-align:center;cursor:pointer;">${self._celdaPlanta(f)}</td>
          <td class="dv-puerto" style="text-align:center;cursor:pointer;">${self._celdaH(self._calc(f).enPuerto)}</td>
          <td style="text-align:center;">
            ${completo
              ? '<span class="badge-datos completo" title="Clic para revisar el seguimiento">Completo</span>'
              : '<span class="badge-datos incompleto" title="Clic para completar el seguimiento">Incompleto</span>'}
          </td>`;

        tr.querySelector('.badge-datos').addEventListener('click', function (ev) {
          ev.stopPropagation();
          self._abrirSeguimiento(f._fila, f);
        });
        tr.querySelectorAll('.dv-planta, .dv-retiro, .dv-puerto').forEach(function (td) {
          td.addEventListener('click', function (ev) { ev.stopPropagation(); self._abrirTiempos(f); });
        });

        tbody.appendChild(tr);
      });
    }

    ['filtroViajeDesde', 'filtroViajeHasta', 'filtroViajeSeguimiento'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargar);
    });

    raiz.querySelector('#btnBorrarFiltroViaje').addEventListener('click', function () {
      raiz.querySelector('#filtroViajeDesde').value = '';
      raiz.querySelector('#filtroViajeHasta').value = '';
      raiz.querySelector('#filtroViajeSeguimiento').value = '';
      cargar();
    });

    raiz.querySelector('#btnCerrarDatosViaje').addEventListener('click', cerrarPanel);

    cargar();
  },

  _abrirSeguimiento: async function (filaServicio, servicio) {
    const self = this;
    const seguimiento = await llamarBackend('obtenerSeguimiento', { fila: filaServicio });
    const cita = servicio ? self._cita(servicio) : null;
    const retiro = servicio ? self._fhDe(servicio, 'FECHA DE RETIRO', 'HORA DE RETIRO') : null;
    const devol = servicio ? self._fhDe(servicio, 'FECHA DE DEVOLUCION', 'HORA DE DEVOLUCION') : null;
    const ro = (lbl, d, txtVacio) => '<div class="campo"><label>' + lbl + '</label><input type="text" value="' + (d ? self._fh(d) : txtVacio) + '" disabled style="background:#eef4fb;font-weight:600"></div>';

    function aDatetimeLocal(v) {
      if (!v) return '';
      let d;
      if (v instanceof Date) d = v;
      else {
        const texto = String(v).trim();
        if (texto === '') return '';
        d = new Date(texto);
      }
      if (isNaN(d.getTime())) return '';
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    const campos = [
      { id: 'txtInicioRuta', col: 'INICIO RUTA', label: 'Inicio Ruta', tipo: 'datetime-local' },
      { id: 'txtRetiroVacio', col: 'RETIRO VACIO', label: 'Retiro Vacío', tipo: 'datetime-local' },
      { id: 'txtSalidaVacio', col: 'SALIDA VACIO', label: 'Salida Vacío', tipo: 'datetime-local' },
      { id: 'txtMuertos1', col: 'T MUERTOS 1', label: 'T. Muertos 1 (horas)', tipo: 'number' },
      { id: 'txtLlegadaPlanta', col: 'LLEGADA PLANTA', label: 'Llegada Planta', tipo: 'datetime-local' },
      { id: 'txtSalidaPlanta', col: 'SALIDA PLANTA', label: 'Salida Planta', tipo: 'datetime-local' },
      { id: 'txtMuertos2', col: 'T MUERTOS 2', label: 'T. Muertos 2 (horas)', tipo: 'number' },
      { id: 'txtLlegadaColaPuerto', col: 'LLEGADA COLA PUERTO', label: 'Llegada Cola Puerto', tipo: 'datetime-local' },
      { id: 'txtSalidaPuerto', col: 'SALIDA DE PUERTO', label: 'Salida de Puerto', tipo: 'datetime-local' },
      { id: 'txtFinRuta', col: 'FIN DE RUTA', label: 'Fin de Ruta', tipo: 'datetime-local' }
    ];

    const html = `
      <div class="fila-campos">
        ${ro('Retiro (cita)', retiro, 'Sin fecha de retiro')}
        ${ro('Posicionamiento (cita)', cita, 'Sin fecha de posicionamiento')}
        ${ro('Devolución (cita)', devol, 'Sin fecha de devolución')}
      </div>
      <div class="fila-campos">
        ${campos.map(function (c) {
          const valor = c.tipo === 'datetime-local' ? aDatetimeLocal(seguimiento[c.col]) : (seguimiento[c.col] || '');
          return `<div class="campo"><label>${c.label}</label><input type="${c.tipo}" id="${c.id}" value="${valor}"${c.tipo === 'number' ? ' step="0.5" min="0"' : ''}></div>`;
        }).join('')}
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:space-between;">
        <button class="boton-secundario" id="btnVolverSeguimiento">Volver a la lista</button>
        <button class="boton-primario" id="btnGrabarSeguimiento">Grabar</button>
      </div>`;

    actualizarPanel('Seguimiento del Viaje', html, function (raiz) {
      raiz.querySelector('#btnVolverSeguimiento').addEventListener('click', function () {
        self._mostrarListaEnPanel();
      });

      raiz.querySelector('#btnGrabarSeguimiento').addEventListener('click', async function () {
        const datos = {};
        campos.forEach(function (c) {
          datos[c.col] = raiz.querySelector('#' + c.id).value;
        });

        const resp = await llamarBackend('grabarSeguimiento', { fila: filaServicio, datos: datos });
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
  _calc: function (f) {
    const cita = this._cita(f), sal = this._fecha(f._salidaPlanta);
    const enPlanta = this._horas(cita, sal);
    const libres = Number(f._horasLibres) >= 0 ? Number(f._horasLibres) : 7;
    const extra = enPlanta === null ? null : Math.max(0, Math.round((enPlanta - libres) * 100) / 100);
    const cobrado = (f._sc || []).filter(x => /^HORAS EXTRAS PLANTA|^H\.E\. PLANTA/.test(x.tipo));
    return { cita: cita, llegada: this._fecha(f._llegadaPlanta), salida: sal, enPlanta: enPlanta, libres: libres, extra: extra, cobrado: cobrado,
      llegPuerto: this._fecha(f._llegadaPuerto), salPuerto: this._fecha(f._salidaPuerto),
      enPlantaReal: this._horas(this._fecha(f._llegadaPlanta), sal),
      enPuerto: this._horas(this._fecha(f._llegadaPuerto), this._fecha(f._salidaPuerto)),
      retVacio: this._fecha(f._retiroVacio), salVacio: this._fecha(f._salidaVacio),
      enRetiro: this._horas(this._fecha(f._retiroVacio), this._fecha(f._salidaVacio)) };
  },
  _celdaH: function (h) { return h === null || h === undefined ? '<span style="color:#94a3b8">—</span>' : '<b>' + h.toFixed(1) + ' h</b>'; },
  _celdaPlanta: function (f) {
    const c = this._calc(f);
    if (c.enPlantaReal === null && c.enPlanta === null) return '<span style="color:#94a3b8">—</span>';
    let h = this._celdaH(c.enPlantaReal);
    if (c.cobrado.length) h += '<br><span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#dcfce7;color:#166534;font-size:.7rem;font-weight:700">✓ cobrado</span>';
    else if (c.extra > 0) h += '<br><span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:8px;background:#fee2e2;color:#b91c1c;font-size:.7rem;font-weight:700">+' + c.extra.toFixed(1) + ' h extra</span>';
    return h;
  },

  /** Ventana: tiempos en planta / puerto y registro de sobrecosto. */
  _abrirTiempos: function (f) {
    const self = this;
    const c = self._calc(f);
    const enPuerto = self._horas(c.llegPuerto, c.salPuerto);
    const fila = (k, v, st) => '<tr><td style="padding:5px 8px;color:#475569">' + k + '</td><td style="padding:5px 8px;font-weight:600;' + (st || '') + '">' + v + '</td></tr>';
    const MOT = { 'HORAS EXTRAS PLANTA': 'Horas extras en planta', 'HORAS EXTRAS PUERTO': 'Horas extras en puerto', 'PERNOCTE': 'Pernocte' };
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
            ${fila('Horas desde la cita', c.enPlanta === null ? '—' : c.enPlanta.toFixed(2) + ' h')}
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
        if (m === 'HORAS EXTRAS PLANTA') { $('dvScCant').value = c.extra > 0 ? c.extra : ''; $('dvScObs').value = c.extra > 0 ? ('Cita ' + self._fh(c.cita) + ' · salida ' + self._fh(c.salida) + ' · ' + c.enPlanta.toFixed(2) + ' h en planta − ' + c.libres + ' h libres') : ''; }
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
    const self = this;
    const html = document.getElementById('cuerpo-panel');
    // Reutiliza el mismo flujo que abrir(): reconstruye la lista dentro
    // del panel ya abierto en vez de cerrar y volver a abrir el modal.
    const contenido = `
      <div class="barra-filtros">
        <div class="campo"><label>Desde</label><input type="text" id="filtroViajeDesde" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Hasta</label><input type="text" id="filtroViajeHasta" placeholder="dd/mm/yyyy"></div>
        <div class="campo"><label>Seguimiento</label>
          <select id="filtroViajeSeguimiento">
            <option value="">Todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Incompleto</option>
          </select>
        </div>
        <button class="boton-secundario" id="btnBorrarFiltroViaje">Borrar filtro</button>
      </div>
      <div style="max-height:460px; overflow:auto;">
        <table class="tabla-lista" id="tablaDatosViaje">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Booking</th><th>Tipo de carga</th><th>Conductor</th>
            <th>Tracto</th><th>Depósito de retiro</th><th>Fecha de retiro</th><th>Destino</th>
            <th>Fecha de posicionamiento</th><th>Fecha de devolución</th><th title="Retiro vacío → salida del depósito">T. retiro</th><th title="Llegada → salida de planta (el extra se cuenta desde la cita)">T. planta</th><th title="Llegada a cola de puerto → salida de puerto">T. puerto</th><th>Seguimiento</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnCerrarDatosViaje">Cerrar</button>
      </div>`;

    actualizarPanel('Datos del Viaje', contenido, (raiz) => self._wireLista(raiz));
  }
};
