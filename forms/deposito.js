/**
 * forms/deposito.js
 * -------------------------------------------------------------------------
 * Módulo "Depósito": control de los depósitos de cada servicio.
 *
 * Pestaña "Servicios": lista los servicios con lo que hay que depositar
 * (viático + peaje + cochera, y combustible si no fue por proveedor), el
 * estado de la unidad y el check "Depositado" (100% manual, lo marca el
 * usuario cuando gerencia ya depositó). Orden: primero los NO depositados
 * y luego los depositados, cada grupo de la fecha más reciente a la más
 * antigua. Filtros: fechas, Cliente, Conductor y Estado (selección
 * múltiple), Booking, Depositado y Adicionales.
 *
 * Depósitos adicionales (imprevistos del viaje: llantas, policía, mal
 * cuadre de peajes, combustible, alimentación, otros): cada uno pasa por
 * Solicitado → Aprobado (gerencia) → Depositado, o Rechazado. Se ven por
 * servicio (botón en la columna Adicionales) y todos juntos en la pestaña
 * "Adicionales", con filtros y totales. Solo los adicionales DEPOSITADOS
 * se suman al total de adicionales del servicio.
 * -------------------------------------------------------------------------
 */
const FormDeposito = {

  MOTIVOS: ['LLANTAS', 'POLICIA / CONTROL', 'MAL CUADRE DE PEAJES', 'COMBUSTIBLE', 'ALIMENTACION', 'OTROS'],
  ESTADOS_ADICIONAL: ['SOLICITADO', 'APROBADO', 'DEPOSITADO', 'RECHAZADO'],
  MEDIOS: ['TRANSFERENCIA', 'YAPE', 'EFECTIVO'],

  abrir: async function () {
    const html = `
      <style>
        .dep-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
        .dep-tab { padding: 8px 16px; border-radius: 8px; border: 1.5px solid #c7ced8; background: #fff; font-weight: 700; font-size: .85rem; cursor: pointer; color: #23303d; }
        .dep-tab.activo { background: #1c3a5e; border-color: #1c3a5e; color: #fff; }
        .dep-tab .dep-cuenta { display: inline-block; min-width: 18px; padding: 0 6px; margin-left: 6px; border-radius: 9px; background: #d33a3a; color: #fff; font-size: .72rem; }
        .dep-wrap { max-height: calc(74vh - 240px); min-height: 220px; overflow-y: auto; overflow-x: hidden; }
        .dep-tabla { width: 100%; table-layout: fixed; font-size: .74rem; }
        .dep-tabla th, .dep-tabla td { padding: 5px 5px; white-space: normal; overflow-wrap: anywhere; word-break: break-word; vertical-align: top; }
        .dep-tabla th { font-size: .7rem; position: sticky; top: 0; z-index: 1; }
        .dep-tabla td .sub { color: #64748b; font-size: .68rem; margin-top: 2px; }
        .dep-tabla tr.dep-hecho td { background: #f6fbf7; }
        .dep-badge { display: inline-block; border-radius: 8px; padding: 2px 6px; font-size: .66rem; font-weight: 700; background: #f1f5f9; color: #334155; white-space: nowrap; }
        .dep-badge.solicitado { background: #fef3c7; color: #92400e; }
        .dep-badge.aprobado { background: #dbeafe; color: #1e40af; }
        .dep-badge.depositado { background: #dcfce7; color: #166534; }
        .dep-badge.rechazado { background: #fee2e2; color: #991b1b; }
        .dep-mini { padding: 3px 7px; border-radius: 6px; border: 1.5px solid #1c3a5e; background: #fff; color: #1c3a5e; font-weight: 700; font-size: .7rem; cursor: pointer; white-space: nowrap; }
        .dep-mini:hover { background: #1c3a5e; color: #fff; }
        .dep-mini.verde { border-color: #1f9d55; color: #157a41; }
        .dep-mini.verde:hover { background: #1f9d55; color: #fff; }
        .dep-mini.rojo { border-color: #d33a3a; color: #ad2b2b; }
        .dep-mini.rojo:hover { background: #d33a3a; color: #fff; }
        .dep-acciones { display: flex; flex-wrap: wrap; gap: 4px; }
        .dep-resumen { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .dep-chip { border: 1px solid #dde4ec; border-radius: 10px; padding: 7px 12px; background: #fff; font-size: .78rem; }
        .dep-chip b { font-size: .95rem; color: #1c3a5e; }
        .dep-cab { background: #f4f7fb; border: 1px solid #dde4ec; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; font-size: .82rem; display: flex; flex-wrap: wrap; gap: 6px 22px; }
        .dep-cab b { color: #1c3a5e; }
        .dep-form { display: grid; grid-template-columns: 1.2fr .8fr 1.2fr 2fr auto; gap: 10px; align-items: end; background: #fff; border: 1px solid #dde4ec; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; }
        .dep-form .campo { margin: 0; }
        .dep-fila-dep td { background: #f8fafc; }
        .dep-fila-dep .dep-form-dep { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
        .dep-fila-dep .campo { margin: 0; min-width: 140px; }
        .barra-filtros .ms .ms-boton { min-width: 150px; }
        @media (max-width: 1000px) { .dep-form { grid-template-columns: 1fr 1fr; } }
      </style>

      <div class="dep-tabs">
        <button type="button" class="dep-tab activo" data-tab="servicios">Servicios</button>
        <button type="button" class="dep-tab" data-tab="adicionales">Adicionales <span class="dep-cuenta" id="depCuentaPend" style="display:none;"></span></button>
      </div>

      <!-- ===================== Pestaña Servicios ===================== -->
      <div id="depVistaServicios">
        <div class="barra-filtros">
          <div class="campo"><label>Desde</label><input type="date" id="depDesde"></div>
          <div class="campo"><label>Hasta</label><input type="date" id="depHasta"></div>
          <div class="campo"><label>Cliente</label><div id="depMsCliente"></div></div>
          <div class="campo"><label>Conductor</label><div id="depMsConductor"></div></div>
          <div class="campo"><label>Estado de la unidad</label><div id="depMsEstado"></div></div>
          <div class="campo"><label>Booking</label><input type="text" id="depBooking" placeholder="Escriba el BK" autocomplete="off"></div>
          <div class="campo"><label>Depositado</label>
            <select id="depEstadoCheck">
              <option value="">Todos</option>
              <option value="no">No depositado</option>
              <option value="si">Depositado</option>
            </select>
          </div>
          <div class="campo"><label>Adicionales</label>
            <select id="depFiltroAdic">
              <option value="">Todos</option>
              <option value="pendientes">Con pendientes</option>
              <option value="con">Con adicionales</option>
            </select>
          </div>
          <button class="boton-secundario" id="depBorrar">Borrar filtro</button>
        </div>
        <div class="dep-wrap">
          <table class="tabla-lista dep-tabla" id="depTabla">
            <colgroup>
              <col style="width:6%"><col style="width:6%"><col style="width:11%"><col style="width:12%"><col style="width:7.5%">
              <col style="width:7.5%"><col style="width:9%"><col style="width:9%"><col style="width:6.5%"><col style="width:7%">
              <col style="width:9%"><col style="width:5.5%"><col style="width:4%">
            </colgroup>
            <thead><tr>
              <th>Fecha</th><th>Cliente</th><th>Conductor / placa</th><th>Ruta</th><th>Retiro</th>
              <th>Estado unidad</th><th>Combustible</th><th>Peaje · viático · cochera</th><th>Total viaje</th><th>A depositar</th>
              <th>Adicionales</th><th>Tarifa</th><th>Dep.</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- ===================== Pestaña Adicionales ===================== -->
      <div id="depVistaAdicionales" style="display:none;">
        <div class="barra-filtros">
          <div class="campo"><label>Estado</label><div id="adMsEstado"></div></div>
          <div class="campo"><label>Motivo</label><div id="adMsMotivo"></div></div>
          <div class="campo"><label>Conductor</label><div id="adMsConductor"></div></div>
          <div class="campo"><label>Cliente</label><div id="adMsCliente"></div></div>
          <div class="campo"><label>Desde</label><input type="date" id="adDesde"></div>
          <div class="campo"><label>Hasta</label><input type="date" id="adHasta"></div>
          <div class="campo"><label>Booking</label><input type="text" id="adBooking" placeholder="Escriba el BK" autocomplete="off"></div>
          <button class="boton-secundario" id="adBorrar">Borrar filtro</button>
        </div>
        <div class="dep-resumen" id="adResumen"></div>
        <div class="dep-wrap">
          <table class="tabla-lista dep-tabla" id="adTabla">
            <colgroup>
              <col style="width:7%"><col style="width:13%"><col style="width:12%"><col style="width:9%"><col style="width:7%">
              <col style="width:8%"><col style="width:8%"><col style="width:9%"><col style="width:13%"><col style="width:14%">
            </colgroup>
            <thead><tr>
              <th>Solicitado</th><th>Servicio</th><th>Conductor / placa</th><th>Motivo</th><th>Monto</th>
              <th>Solicitado por</th><th>Estado</th><th>Aprobado por</th><th>Depósito</th><th>Acciones</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- ================= Detalle de adicionales de un servicio ================= -->
      <div id="depVistaDetalle" style="display:none;"></div>

      <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
        <button class="boton-secundario" id="btnDepCerrar">Cerrar</button>
      </div>`;

    abrirPanel('Depósito', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _wire: function (raiz) {
    const self = this;
    let servicios = [];          // filas de SERVICIOS
    let resumen = {};            // { fila: { depositado, pendiente, nPendientes, n } }
    let adicionales = [];        // todas las filas de DEPOSITOS
    let vistaActual = 'servicios';

    /* ----------------------------- utilidades ----------------------------- */
    const numero = function (v) {
      if (v === null || v === undefined) return 0;
      const n = parseFloat(String(v).replace(/S\//g, '').replace(/\$/g, '').replace(/\s/g, '').replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };
    const fechaDe = function (v) {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const ddmm = function (v) {
      const d = fechaDe(v);
      if (!d) return '';
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    };
    const hora = function (v) {
      if (v === null || v === undefined || v === '' || v === '-') return '';
      const t = String(v).trim();
      if (/^\d{1,2}:\d{2}/.test(t)) return t.slice(0, 5);
      const d = new Date(t);
      if (!isNaN(d.getTime()) && /T\d{2}:\d{2}/.test(t)) {
        return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
      }
      return t;
    };
    const esc = function (t) {
      return String(t === null || t === undefined ? '' : t).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    };
    const soles = function (n) { return 'S/ ' + (Number(n) || 0).toFixed(2); };
    const mayus = function (v) { return String(v || '').trim().toUpperCase(); };
    const esVerdadero = function (v) {
      return v === true || mayus(v) === 'TRUE' || mayus(v) === 'SI';
    };
    const isoADdmm = function (iso) {
      if (!iso) return '';
      const p = iso.split('-');
      return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
    };
    const unicos = function (lista, fn) {
      return Array.from(new Set(lista.map(fn).filter(v => v !== '' && v !== '-'))).sort((a, b) => a.localeCompare(b, 'es'));
    };
    const estadoAdic = function (a) { return mayus(a['ESTADO']) || 'DEPOSITADO'; };
    const refrescarSnapshot = function () {
      if (typeof _refrescarSnapshotFormulario === 'function') _refrescarSnapshotFormulario();
    };
    const servicioPorFila = function (fila) { return servicios.find(s => Number(s._fila) === Number(fila)); };

    const montoBase = function (f) {
      // Igual que en Registrar Servicio: si el combustible lo abastece un
      // proveedor, no entra en el monto a depositar.
      const esProveedor = mayus(f['TIPO DE ABASTECIMIENTO']) === 'PROVEEDOR';
      const gastos = numero(f['VIATICO']) + numero(f['PEAJE']) + numero(f['COCHERA']);
      return esProveedor ? gastos : gastos + numero(f['TOTAL TRACTO']) + numero(f['TOTAL GENERADOR']);
    };
    const resumenDe = function (fila) {
      const r = resumen[fila];
      if (r === undefined || r === null) return { depositado: 0, pendiente: 0, nPendientes: 0, n: 0 };
      if (typeof r === 'number') return { depositado: r, pendiente: 0, nPendientes: 0, n: r > 0 ? 1 : 0 };
      return r;
    };

    /* --------------------------- pestañas / vistas --------------------------- */
    const mostrarVista = function (vista) {
      vistaActual = vista;
      raiz.querySelector('#depVistaServicios').style.display = vista === 'servicios' ? '' : 'none';
      raiz.querySelector('#depVistaAdicionales').style.display = vista === 'adicionales' ? '' : 'none';
      raiz.querySelector('#depVistaDetalle').style.display = vista === 'detalle' ? '' : 'none';
      raiz.querySelectorAll('.dep-tab').forEach(function (b) {
        b.classList.toggle('activo', b.dataset.tab === vista || (vista === 'detalle' && b.dataset.tab === 'servicios' && self._volverA !== 'adicionales') || (vista === 'detalle' && b.dataset.tab === 'adicionales' && self._volverA === 'adicionales'));
      });
    };
    raiz.querySelectorAll('.dep-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        mostrarVista(b.dataset.tab);
        if (b.dataset.tab === 'servicios') pintarServicios(); else pintarAdicionales();
      });
    });

    /* ------------------------------- carga ------------------------------- */
    const cargarTodo = async function () {
      const filtros = {
        fechaDesde: isoADdmm(raiz.querySelector('#depDesde').value),
        fechaHasta: isoADdmm(raiz.querySelector('#depHasta').value)
      };
      const res = await Promise.all([
        llamarBackend('listarServiciosPendientes', filtros),
        llamarBackend('resumenDepositos', {}),
        llamarBackend('listarDepositosAdicionales', {}).catch(function () { return []; })
      ]);
      servicios = Array.isArray(res[0]) ? res[0] : [];
      resumen = res[1] || {};
      adicionales = Array.isArray(res[2]) ? res[2] : [];
      actualizarContadorPendientes();
      if (vistaActual === 'servicios') pintarServicios();
      else if (vistaActual === 'adicionales') pintarAdicionales();
      else if (self._filaDetalle) pintarDetalle(self._filaDetalle);
    };

    const actualizarContadorPendientes = function () {
      const n = adicionales.filter(a => ['SOLICITADO', 'APROBADO'].indexOf(estadoAdic(a)) !== -1).length;
      const el = raiz.querySelector('#depCuentaPend');
      el.textContent = n;
      el.style.display = n > 0 ? '' : 'none';
      el.title = n + ' adicionales por aprobar o depositar';
    };

    /* ======================= Pestaña Servicios ======================= */
    const msCliente = crearMultiSelect(raiz.querySelector('#depMsCliente'), { onChange: function () { pintarServicios(); } });
    const msConductor = crearMultiSelect(raiz.querySelector('#depMsConductor'), { onChange: function () { pintarServicios(); } });
    const msEstado = crearMultiSelect(raiz.querySelector('#depMsEstado'), { onChange: function () { pintarServicios(); } });

    const pintarServicios = function () {
      msCliente.setOpciones(unicos(servicios, f => mayus(f['CLIENTE PARA FACTURACIÓN'])));
      msConductor.setOpciones(unicos(servicios, f => mayus(f['CONDUCTOR'])));
      msEstado.setOpciones(unicos(servicios, f => mayus(f['ESTADO']) || 'PROGRAMADO'));

      const booking = mayus(raiz.querySelector('#depBooking').value);
      const check = raiz.querySelector('#depEstadoCheck').value;
      const filtroAdic = raiz.querySelector('#depFiltroAdic').value;

      let filas = servicios.filter(function (f) {
        if (!msCliente.cumple(mayus(f['CLIENTE PARA FACTURACIÓN']))) return false;
        if (!msConductor.cumple(mayus(f['CONDUCTOR']))) return false;
        if (!msEstado.cumple(mayus(f['ESTADO']) || 'PROGRAMADO')) return false;
        if (booking && mayus(f['BOOKING']).indexOf(booking) === -1) return false;
        const dep = esVerdadero(f['DEPOSITADO']);
        if (check === 'si' && !dep) return false;
        if (check === 'no' && dep) return false;
        const r = resumenDe(f._fila);
        if (filtroAdic === 'pendientes' && r.nPendientes === 0) return false;
        if (filtroAdic === 'con' && r.n === 0) return false;
        return true;
      });

      // No depositados primero; dentro de cada grupo, fecha más reciente primero.
      filas.sort(function (a, b) {
        const da = esVerdadero(a['DEPOSITADO']) ? 1 : 0;
        const db = esVerdadero(b['DEPOSITADO']) ? 1 : 0;
        if (da !== db) return da - db;
        const fa = fechaDe(a['FECHA DE PROGRAMACION']);
        const fb = fechaDe(b['FECHA DE PROGRAMACION']);
        const ta = fa ? fa.getTime() : 0;
        const tb = fb ? fb.getTime() : 0;
        if (ta !== tb) return tb - ta;
        return Number(b._fila) - Number(a._fila);
      });

      const tbody = raiz.querySelector('#depTabla tbody');
      tbody.innerHTML = '';
      if (!filas.length) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color:#64748b; padding:14px;">No hay servicios con estos filtros.</td></tr>';
      }
      filas.forEach(function (f) {
        const esProveedor = mayus(f['TIPO DE ABASTECIMIENTO']) === 'PROVEEDOR';
        const base = montoBase(f);
        const r = resumenDe(f._fila);
        const depositado = esVerdadero(f['DEPOSITADO']);
        // Ruta completa: ciudad de retiro → destino 1 → destinos adicionales.
        const adicionales = (f['DESTINO 2'] && String(f['DESTINO 2']).trim() !== '-')
          ? String(f['DESTINO 2']).split('/').map(function (x) { return x.trim(); }).filter(Boolean) : [];
        const ruta = [f['CIUDAD DE RETIRO'], f['DESTINO 1']].concat(adicionales).filter(Boolean).map(esc).join(' → ');
        const tarifaBase = numero(f['TARIFA 1']);
        const tarifaAdic = numero(f['TARIFA 2']);
        const mon = mayus(f['MONEDA TARIFA 1']) === 'D' ? '$ ' : 'S/ ';
        const estado = mayus(f['ESTADO']) || 'PROGRAMADO';
        const combustibleSoles = numero(f['TOTAL TRACTO']) + numero(f['TOTAL GENERADOR']);
        const gl = numero(f['GL TRACTO']).toFixed(0) + ' gl tracto · ' + numero(f['GL GENERADOR']).toFixed(0) + ' gl genset';

        let adicHtml;
        if (r.n === 0) {
          adicHtml = '<button type="button" class="dep-mini btn-adic">+ Adicional</button>';
        } else {
          adicHtml = (r.depositado > 0 ? '<div>' + soles(r.depositado) + ' dep.</div>' : '') +
            (r.nPendientes > 0 ? '<div><span class="dep-badge solicitado">' + r.nPendientes + ' pendiente' + (r.nPendientes > 1 ? 's' : '') + ' · ' + soles(r.pendiente) + '</span></div>' : '') +
            '<div style="margin-top:3px;"><button type="button" class="dep-mini btn-adic">Ver / agregar</button></div>';
        }

        const tr = document.createElement('tr');
        if (depositado) tr.classList.add('dep-hecho');
        tr.innerHTML = `
          <td>${ddmm(f['FECHA DE PROGRAMACION'])}</td>
          <td>${esc(f['CLIENTE PARA FACTURACIÓN'])}</td>
          <td>${esc(f['CONDUCTOR'])}<div class="sub">${esc(f['PLACA TRACTO'])}</div></td>
          <td>${ruta}<div class="sub">Devolución: ${esc(f['CIUDAD DE DEVOLUCION'])}</div></td>
          <td>${ddmm(f['FECHA DE RETIRO'])}<div class="sub">${hora(f['HORA DE RETIRO'])}</div></td>
          <td><span class="badge-estado est-${estado.replace(/\s+/g, '-').toLowerCase()}">${esc(estado)}</span></td>
          <td>${esProveedor ? 'Proveedor' : soles(combustibleSoles)}<div class="sub">${gl}</div></td>
          <td>${soles(numero(f['PEAJE']) + numero(f['VIATICO']) + numero(f['COCHERA']))}<div class="sub">P ${numero(f['PEAJE']).toFixed(0)} · V ${numero(f['VIATICO']).toFixed(0)} · C ${numero(f['COCHERA']).toFixed(0)}</div></td>
          <td>${soles(numero(f['TOTAL POR VIAJE']))}</td>
          <td><b>${soles(base)}</b></td>
          <td>${adicHtml}</td>
          <td><b>${mon}${(tarifaBase + tarifaAdic).toFixed(2)}</b>${tarifaAdic > 0 ? '<div class="sub">' + tarifaBase.toFixed(2) + ' + ' + tarifaAdic.toFixed(2) + ' adic.</div>' : ''}</td>
          <td style="text-align:center;"><input type="checkbox" class="chk-depositado" ${depositado ? 'checked' : ''} title="Marcar cuando gerencia ya depositó el monto"></td>`;

        const chk = tr.querySelector('.chk-depositado');
        chk.addEventListener('click', function (ev) { ev.stopPropagation(); });
        chk.addEventListener('change', async function () {
          const valor = this.checked;
          await llamarBackend('actualizarDepositado', { fila: f._fila, depositado: valor });
          f['DEPOSITADO'] = valor;
          pintarServicios();
        });

        tr.querySelector('.btn-adic').addEventListener('click', function (ev) {
          ev.stopPropagation();
          abrirDetalle(f._fila, 'servicios');
        });

        tr.addEventListener('click', function () { FormServicio.abrir(f._fila); });
        tbody.appendChild(tr);
      });
      refrescarSnapshot();
    };

    ['depDesde', 'depHasta'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', cargarTodo);
    });
    ['depEstadoCheck', 'depFiltroAdic'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', pintarServicios);
    });
    let esperaBk = null;
    raiz.querySelector('#depBooking').addEventListener('input', function () {
      clearTimeout(esperaBk);
      esperaBk = setTimeout(pintarServicios, 250);
    });
    raiz.querySelector('#depBorrar').addEventListener('click', function () {
      msCliente.limpiar(); msConductor.limpiar(); msEstado.limpiar();
      ['depDesde', 'depHasta', 'depBooking', 'depEstadoCheck', 'depFiltroAdic'].forEach(function (id) { raiz.querySelector('#' + id).value = ''; });
      cargarTodo();
    });

    /* ===================== Acciones sobre adicionales ===================== */
    // Una sola operación a la vez: un doble clic en Depositar/Aprobar no debe repetirla.
    let gestionando = false;
    const gestionar = async function (datos) {
      if (gestionando) return false;
      gestionando = true;
      try {
        const r = await llamarBackend('gestionarDepositoAdicional', datos);
        if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo actualizar el adicional.', 'error'); return false; }
        mostrarMensaje(r.mensaje, 'exito');
        await cargarTodo();
        return true;
      } finally {
        gestionando = false;
      }
    };
    const aprobar = function (id) {
      const nombre = window.prompt('Nombre de quien aprueba (gerencia):', '');
      if (nombre === null || !nombre.trim()) return;
      gestionar({ id: id, accion: 'APROBAR', nombre: nombre.trim() });
    };
    const rechazar = function (id) {
      const nombre = window.prompt('Nombre de quien rechaza:', '');
      if (nombre === null || !nombre.trim()) return;
      const motivo = window.prompt('Motivo del rechazo:', '');
      if (motivo === null || !motivo.trim()) { mostrarMensaje('Indique el motivo del rechazo.', 'error'); return; }
      gestionar({ id: id, accion: 'RECHAZAR', nombre: nombre.trim(), motivoRechazo: motivo.trim() });
    };
    // Fila desplegable con el formulario de depósito, debajo del adicional.
    const mostrarFormDeposito = function (trAdicional, id, columnas) {
      const siguiente = trAdicional.nextElementSibling;
      if (siguiente && siguiente.classList.contains('dep-fila-dep')) { siguiente.remove(); return; }
      const tr = document.createElement('tr');
      tr.className = 'dep-fila-dep';
      tr.innerHTML = '<td colspan="' + columnas + '"><div class="dep-form-dep">' +
        '<div class="campo"><label>Medio de pago</label><select class="fd-medio">' + self.MEDIOS.map(m => '<option>' + m + '</option>').join('') + '</select></div>' +
        '<div class="campo"><label>Quién deposita</label><input type="text" class="fd-persona" autocomplete="off"></div>' +
        '<div class="campo"><label>N° de operación</label><input type="text" class="fd-operacion" placeholder="Obligatorio salvo efectivo" autocomplete="off"></div>' +
        '<button type="button" class="boton-primario fd-ok" style="padding:8px 14px;">Confirmar depósito</button>' +
        '<button type="button" class="boton-secundario fd-cancelar" style="padding:8px 14px;">Cancelar</button>' +
        '</div></td>';
      trAdicional.after(tr);
      tr.querySelector('.fd-cancelar').addEventListener('click', function () { tr.remove(); });
      tr.querySelector('.fd-ok').addEventListener('click', function () {
        const medio = tr.querySelector('.fd-medio').value;
        const persona = tr.querySelector('.fd-persona').value.trim();
        const operacion = tr.querySelector('.fd-operacion').value.trim();
        if (!persona) { mostrarMensaje('Indique quién realiza el depósito.', 'error'); return; }
        if (medio !== 'EFECTIVO' && !operacion) { mostrarMensaje('Indique el N° de operación.', 'error'); return; }
        gestionar({ id: id, accion: 'DEPOSITAR', medio: medio, nombre: persona, operacion: operacion });
      });
      tr.querySelector('.fd-persona').focus();
    };
    const accionesHtml = function (a) {
      const e = estadoAdic(a);
      if (!a['ID']) return '';
      if (e === 'SOLICITADO') return '<div class="dep-acciones"><button type="button" class="dep-mini verde ac-aprobar">Aprobar</button><button type="button" class="dep-mini rojo ac-rechazar">Rechazar</button></div>';
      if (e === 'APROBADO') return '<div class="dep-acciones"><button type="button" class="dep-mini verde ac-depositar">Registrar depósito</button><button type="button" class="dep-mini rojo ac-rechazar">Rechazar</button></div>';
      return '';
    };
    const conectarAcciones = function (tr, a, columnas) {
      const b1 = tr.querySelector('.ac-aprobar');
      const b2 = tr.querySelector('.ac-rechazar');
      const b3 = tr.querySelector('.ac-depositar');
      if (b1) b1.addEventListener('click', function (ev) { ev.stopPropagation(); aprobar(a['ID']); });
      if (b2) b2.addEventListener('click', function (ev) { ev.stopPropagation(); rechazar(a['ID']); });
      if (b3) b3.addEventListener('click', function (ev) { ev.stopPropagation(); mostrarFormDeposito(tr, a['ID'], columnas); });
    };
    const depositoTxt = function (a) {
      const e = estadoAdic(a);
      if (e === 'DEPOSITADO') {
        return esc(a['MEDIO']) + (a['N° OPERACION'] ? ' · ' + esc(a['N° OPERACION']) : '') +
          '<div class="sub">' + esc(a['PERSONA']) + (a['FECHA DEPOSITO'] ? ' · ' + ddmm(a['FECHA DEPOSITO']) : (a['FECHA'] ? ' · ' + ddmm(a['FECHA']) : '')) + '</div>';
      }
      if (e === 'RECHAZADO') return '<span class="sub">' + esc(a['MOTIVO RECHAZO']) + '</span>';
      return '';
    };

    /* ================== Detalle de adicionales de un servicio ================== */
    const abrirDetalle = function (fila, volverA) {
      self._filaDetalle = fila;
      self._volverA = volverA;
      mostrarVista('detalle');
      pintarDetalle(fila);
    };

    const pintarDetalle = function (fila) {
      const f = servicioPorFila(fila) || {};
      const lista = adicionales.filter(a => Number(a['FILA SERVICIO']) === Number(fila))
        .sort((x, y) => (fechaDe(y['FECHA SOLICITUD'] || y['FECHA']) || 0) - (fechaDe(x['FECHA SOLICITUD'] || x['FECHA']) || 0));
      const r = resumenDe(fila);
      const cont = raiz.querySelector('#depVistaDetalle');
      cont.innerHTML =
        '<div style="margin-bottom:10px;"><button type="button" class="boton-secundario" id="detVolver">← Volver</button></div>' +
        '<div class="dep-cab">' +
          '<span>Servicio: <b>' + ddmm(f['FECHA DE PROGRAMACION']) + '</b></span>' +
          '<span>Cliente: <b>' + esc(f['CLIENTE PARA FACTURACIÓN']) + '</b></span>' +
          '<span>Booking: <b>' + esc(f['BOOKING']) + '</b></span>' +
          '<span>Conductor: <b>' + esc(f['CONDUCTOR']) + '</b> (' + esc(f['PLACA TRACTO']) + ')</span>' +
          '<span>Destino: <b>' + esc(f['DESTINO 1']) + '</b></span>' +
          '<span>A depositar: <b>' + soles(montoBase(f)) + '</b></span>' +
          '<span>Adicionales depositados: <b>' + soles(r.depositado) + '</b></span>' +
          '<span>Pendientes: <b>' + soles(r.pendiente) + '</b></span>' +
        '</div>' +
        '<div class="dep-form">' +
          '<div class="campo"><label>Motivo</label><select id="nvMotivo"><option value="">Seleccione…</option>' +
            self.MOTIVOS.map(m => '<option value="' + m + '">' + m.charAt(0) + m.slice(1).toLowerCase() + '</option>').join('') + '</select></div>' +
          '<div class="campo"><label>Monto (S/)</label><input type="number" min="0" step="0.01" id="nvMonto"></div>' +
          '<div class="campo"><label>Solicitado por</label><input type="text" id="nvSolicitante" placeholder="Conductor u operaciones" autocomplete="off"></div>' +
          '<div class="campo"><label>Detalle / observación</label><input type="text" id="nvObs" placeholder="Obligatorio si el motivo es Otros" autocomplete="off"></div>' +
          '<button type="button" class="boton-primario" id="nvRegistrar">Registrar solicitud</button>' +
        '</div>' +
        '<table class="tabla-lista dep-tabla" id="detTabla">' +
          '<colgroup><col style="width:9%"><col style="width:13%"><col style="width:8%"><col style="width:11%"><col style="width:9%"><col style="width:11%"><col style="width:14%"><col style="width:13%"><col style="width:12%"></colgroup>' +
          '<thead><tr><th>Solicitado</th><th>Motivo</th><th>Monto</th><th>Solicitado por</th><th>Estado</th><th>Aprobado por</th><th>Depósito</th><th>Observación</th><th>Acciones</th></tr></thead>' +
          '<tbody></tbody></table>';

      const tbody = cont.querySelector('#detTabla tbody');
      if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#64748b; padding:14px;">Este servicio no tiene depósitos adicionales.</td></tr>';
      }
      lista.forEach(function (a) {
        const e = estadoAdic(a);
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + ddmm(a['FECHA SOLICITUD'] || a['FECHA']) + '</td>' +
          '<td>' + esc(a['MOTIVO'] || 'SIN MOTIVO (registro anterior)') + '</td>' +
          '<td>' + soles(numero(a['MONTO'])) + '</td>' +
          '<td>' + esc(a['SOLICITADO POR']) + '</td>' +
          '<td><span class="dep-badge ' + e.toLowerCase() + '">' + e + '</span></td>' +
          '<td>' + esc(a['APROBADO POR']) + (a['FECHA APROBACION'] ? '<div class="sub">' + ddmm(a['FECHA APROBACION']) + '</div>' : '') + '</td>' +
          '<td>' + depositoTxt(a) + '</td>' +
          '<td>' + esc(a['OBSERVACION']) + '</td>' +
          '<td>' + accionesHtml(a) + '</td>';
        conectarAcciones(tr, a, 9);
        tbody.appendChild(tr);
      });

      cont.querySelector('#detVolver').addEventListener('click', function () {
        self._filaDetalle = null;
        mostrarVista(self._volverA === 'adicionales' ? 'adicionales' : 'servicios');
        if (self._volverA === 'adicionales') pintarAdicionales(); else pintarServicios();
      });
      cont.querySelector('#nvRegistrar').addEventListener('click', async function () {
        const motivo = cont.querySelector('#nvMotivo').value;
        const monto = numero(cont.querySelector('#nvMonto').value);
        const solicitante = cont.querySelector('#nvSolicitante').value.trim();
        const obs = cont.querySelector('#nvObs').value.trim();
        if (!motivo) { mostrarMensaje('Seleccione el motivo.', 'error'); return; }
        if (!monto || monto <= 0) { mostrarMensaje('Ingrese un monto mayor a 0.', 'error'); return; }
        if (!solicitante) { mostrarMensaje('Indique quién solicita el adicional.', 'error'); return; }
        if (motivo === 'OTROS' && !obs) { mostrarMensaje('Para "Otros" describa el motivo en el detalle.', 'error'); return; }
        this.disabled = true;
        const r = await llamarBackend('registrarDeposito', { fila: fila, motivo: motivo, monto: monto, solicitadoPor: solicitante, observacion: obs });
        this.disabled = false;
        if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo registrar.', 'error'); return; }
        mostrarMensaje(r.mensaje, 'exito');
        await cargarTodo();
      });
      refrescarSnapshot();
    };

    /* ======================= Pestaña Adicionales ======================= */
    const adMsEstado = crearMultiSelect(raiz.querySelector('#adMsEstado'), { onChange: function () { pintarAdicionales(); } });
    const adMsMotivo = crearMultiSelect(raiz.querySelector('#adMsMotivo'), { onChange: function () { pintarAdicionales(); } });
    const adMsConductor = crearMultiSelect(raiz.querySelector('#adMsConductor'), { onChange: function () { pintarAdicionales(); } });
    const adMsCliente = crearMultiSelect(raiz.querySelector('#adMsCliente'), { onChange: function () { pintarAdicionales(); } });
    adMsEstado.setOpciones(self.ESTADOS_ADICIONAL);

    const pintarAdicionales = function () {
      adMsMotivo.setOpciones(unicos(adicionales, a => mayus(a['MOTIVO']) || 'SIN MOTIVO'));
      adMsConductor.setOpciones(unicos(adicionales, a => mayus(a['CONDUCTOR'])));
      adMsCliente.setOpciones(unicos(adicionales, a => mayus(a['CLIENTE'])));
      const desde = raiz.querySelector('#adDesde').value;
      const hasta = raiz.querySelector('#adHasta').value;
      const dDesde = desde ? new Date(desde + 'T00:00:00') : null;
      const dHasta = hasta ? new Date(hasta + 'T23:59:59') : null;
      const bk = mayus(raiz.querySelector('#adBooking').value);

      const lista = adicionales.filter(function (a) {
        if (!adMsEstado.cumple(estadoAdic(a))) return false;
        if (!adMsMotivo.cumple(mayus(a['MOTIVO']) || 'SIN MOTIVO')) return false;
        if (!adMsConductor.cumple(mayus(a['CONDUCTOR']))) return false;
        if (!adMsCliente.cumple(mayus(a['CLIENTE']))) return false;
        if (bk && mayus(a['BOOKING']).indexOf(bk) === -1) return false;
        const f = fechaDe(a['FECHA SOLICITUD'] || a['FECHA']);
        if (dDesde && (!f || f < dDesde)) return false;
        if (dHasta && (!f || f > dHasta)) return false;
        return true;
      }).sort(function (x, y) {
        const orden = { 'SOLICITADO': 0, 'APROBADO': 1, 'DEPOSITADO': 2, 'RECHAZADO': 3 };
        const ox = orden[estadoAdic(x)], oy = orden[estadoAdic(y)];
        if (ox !== oy) return ox - oy;
        return (fechaDe(y['FECHA SOLICITUD'] || y['FECHA']) || 0) - (fechaDe(x['FECHA SOLICITUD'] || x['FECHA']) || 0);
      });

      // Resumen por estado y por motivo.
      const porEstado = {}, porMotivo = {};
      lista.forEach(function (a) {
        const e = estadoAdic(a), m = mayus(a['MOTIVO']) || 'SIN MOTIVO', monto = numero(a['MONTO']);
        porEstado[e] = porEstado[e] || { n: 0, s: 0 }; porEstado[e].n++; porEstado[e].s += monto;
        if (e !== 'RECHAZADO') { porMotivo[m] = (porMotivo[m] || 0) + monto; }
      });
      raiz.querySelector('#adResumen').innerHTML =
        self.ESTADOS_ADICIONAL.map(function (e) {
          const x = porEstado[e] || { n: 0, s: 0 };
          return '<div class="dep-chip"><span class="dep-badge ' + e.toLowerCase() + '">' + e + '</span> <b>' + soles(x.s) + '</b> <span style="color:#64748b;">(' + x.n + ')</span></div>';
        }).join('') +
        '<div class="dep-chip" style="flex-basis:100%;">Por motivo (sin rechazados): ' +
          (Object.keys(porMotivo).length
            ? Object.keys(porMotivo).sort((a, b) => porMotivo[b] - porMotivo[a]).map(m => esc(m) + ' <b>' + soles(porMotivo[m]) + '</b>').join(' · ')
            : '—') + '</div>';

      const tbody = raiz.querySelector('#adTabla tbody');
      tbody.innerHTML = '';
      if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#64748b; padding:14px;">No hay adicionales con estos filtros.</td></tr>';
      }
      lista.forEach(function (a) {
        const e = estadoAdic(a);
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + ddmm(a['FECHA SOLICITUD'] || a['FECHA']) + '</td>' +
          '<td>' + esc(a['CLIENTE']) + ' · ' + esc(a['BOOKING']) + '<div class="sub">Servicio ' + ddmm(a['FECHA SERVICIO']) + ' · ' + esc(a['DESTINO']) + '</div></td>' +
          '<td>' + esc(a['CONDUCTOR']) + '<div class="sub">' + esc(a['PLACA']) + '</div></td>' +
          '<td>' + esc(a['MOTIVO'] || 'SIN MOTIVO') + (a['OBSERVACION'] ? '<div class="sub">' + esc(a['OBSERVACION']) + '</div>' : '') + '</td>' +
          '<td><b>' + soles(numero(a['MONTO'])) + '</b></td>' +
          '<td>' + esc(a['SOLICITADO POR']) + '</td>' +
          '<td><span class="dep-badge ' + e.toLowerCase() + '">' + e + '</span></td>' +
          '<td>' + esc(a['APROBADO POR']) + (a['FECHA APROBACION'] ? '<div class="sub">' + ddmm(a['FECHA APROBACION']) + '</div>' : '') + '</td>' +
          '<td>' + depositoTxt(a) + '</td>' +
          '<td>' + accionesHtml(a) + '<div style="margin-top:4px;"><button type="button" class="dep-mini ac-ver">Ver servicio</button></div></td>';
        conectarAcciones(tr, a, 10);
        tr.querySelector('.ac-ver').addEventListener('click', function () { abrirDetalle(a['FILA SERVICIO'], 'adicionales'); });
        tbody.appendChild(tr);
      });
      refrescarSnapshot();
    };

    ['adDesde', 'adHasta'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', pintarAdicionales);
    });
    let esperaAdBk = null;
    raiz.querySelector('#adBooking').addEventListener('input', function () {
      clearTimeout(esperaAdBk);
      esperaAdBk = setTimeout(pintarAdicionales, 250);
    });
    raiz.querySelector('#adBorrar').addEventListener('click', function () {
      adMsEstado.limpiar(); adMsMotivo.limpiar(); adMsConductor.limpiar(); adMsCliente.limpiar();
      ['adDesde', 'adHasta', 'adBooking'].forEach(function (id) { raiz.querySelector('#' + id).value = ''; });
      pintarAdicionales();
    });

    raiz.querySelector('#btnDepCerrar').addEventListener('click', cerrarPanel);

    cargarTodo();
  }
};
