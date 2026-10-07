/**
 * forms/selFacturaViaje.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmSelFacturaViaje.frm (VBA): lista todo lo
 * pendiente de facturar (viajes, falsos fletes, balanza, sobrecostos),
 * y al elegir "Facturar" enruta al formulario correspondiente
 * (frmFacturaViaje / frmFacturaSobrecosto / frmFacturaBalanza).
 * Orden: pendientes primero, luego fecha más reciente.
 * Filtros (en el navegador): fecha desde/hasta, booking, cliente, destino,
 * placa, tipo, estado (pendiente/facturado) y búsqueda libre.
 * -------------------------------------------------------------------------
 */
const FormSelFacturaViaje = {

  abrir: async function () {
    // Equivalente a la verificación de HOME.AbrirSeleccionFacturacion.
    const validacion = await llamarBackend('validarTipoCambioRegistrado', {});
    if (!validacion.ok) { mostrarMensaje(validacion.mensaje, 'error'); return; }

    const html = `
      <style>
        .fact-filtros { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap:8px 10px; align-items:end; margin-bottom:8px; }
        .fact-filtros .campo { margin:0; }
        .fact-filtros input, .fact-filtros select { width:100%; }
        .fact-filtros .fact-acc { display:flex; gap:8px; align-items:end; }
        @media (max-width: 900px) { .fact-filtros { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        #tablaFact { width:100%; table-layout:fixed; font-size:.8rem; }
        #tablaFact th, #tablaFact td { overflow-wrap:anywhere; padding:7px 6px; }
        #tablaFact tr.fact-hecho td { color:#8b95a1; }
        .fact-badge { display:inline-block; padding:2px 7px; border-radius:999px; font-size:.7rem; font-weight:800; white-space:nowrap; }
        .fact-badge.pend { background:#fef3c7; color:#92400e; }
        .fact-badge.hecho { background:#e2e8f0; color:#475569; }
        .fact-sep td { background:#f1f5f9; font-weight:800; color:#1c3a5e; font-size:.74rem; text-transform:uppercase; letter-spacing:.03em; }
      </style>
      <div class="fact-filtros">
        <div class="campo"><label>Fecha desde</label><input type="date" id="factDesde"></div>
        <div class="campo"><label>Fecha hasta</label><input type="date" id="factHasta"></div>
        <div class="campo"><label>Booking</label><input type="text" id="factBooking" autocomplete="off" placeholder="Escriba el booking" style="text-transform:uppercase"></div>
        <div class="campo"><label>Cliente</label><div id="msFactCliente"></div></div>
        <div class="campo"><label>Destino</label><div id="msFactDestino"></div></div>
        <div class="campo"><label>Placa</label><div id="msFactPlaca"></div></div>
        <div class="campo"><label>Tipo</label>
          <select id="cboFiltroTipoFact">
            <option>TODOS</option><option>VIAJE NORMAL</option><option>FALSO FLETE</option>
            <option>BALANZA</option><option>SOBREESTADIA</option><option>PERNOCTE</option>
            <option>BALANZA F.</option><option>SERV. FACT.</option><option>F.F. FACT.</option>
            <option>SOBREEST. F.</option><option>PERNOCTE F.</option>
          </select>
        </div>
        <div class="campo"><label>Mostrar</label>
          <select id="cboEstadoFact">
            <option value="">Todos (pendientes primero)</option>
            <option value="P">Solo pendientes de facturar</option>
            <option value="F">Solo facturados</option>
          </select>
        </div>
        <div class="campo"><label>Buscar (contenedor, código…)</label><input type="text" id="txtBuscarFact" autocomplete="off"></div>
        <div class="fact-acc"><button class="boton-secundario" id="btnBorrarFiltro" type="button">Borrar filtros</button></div>
      </div>
      <div id="factResumen" style="font-size:.8rem;color:#475569;margin:0 0 6px;">Cargando…</div>
      <div style="max-height:calc(74vh - 290px); min-height:220px; overflow-y:auto; overflow-x:hidden;">
        <table class="tabla-lista" id="tablaFact">
          <colgroup><col style="width:11%"><col style="width:10%"><col style="width:14%"><col style="width:13%"><col style="width:12%"><col style="width:12%"><col style="width:8%"><col style="width:11%"><col style="width:9%"></colgroup>
          <thead><tr><th>Estado</th><th>Fecha</th><th>Booking</th><th>Contenedor</th><th>Cliente</th><th>Destino</th><th>Placa</th><th>Código</th><th>Tipo</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnInicio">Inicio</button>
        <button class="boton-primario" id="btnFacturar">Facturar</button>
      </div>`;

    abrirPanel('Facturar', html, (raiz) => this._wire(raiz));
  },

  _wire: function (raiz) {
    const $ = id => raiz.querySelector('#' + id);
    let seleccionado = null;
    let todas = [];

    // Facturado = tipos que terminan en "FACT." o " F." (SERV. FACT., F.F. FACT., BALANZA F., SOBREEST. F., PERNOCTE F.)
    const facturado = f => /(FACT\.|\sF\.)\s*$/.test(String(f.tipoFact || '').trim().toUpperCase());
    const iso = function (v) {
      const s = String(v || '');
      let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        // Las fechas llegan como 2026-10-01T05:00:00Z (medianoche de Perú): se toma la fecha local.
        const d = new Date(s);
        if (!isNaN(d) && /T/.test(s)) return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        return m[1] + '-' + m[2] + '-' + m[3];
      }
      m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
    };
    const txt = v => String(v === null || v === undefined ? '' : v).trim().toUpperCase();
    const destinoDe = f => txt(f.destino1) + (f.destino2 && txt(f.destino2) !== '-' ? ' / ' + txt(f.destino2) : '');

    const msCliente = crearMultiSelect($('msFactCliente'), { onChange: pintar });
    const msDestino = crearMultiSelect($('msFactDestino'), { onChange: pintar });
    const msPlaca = crearMultiSelect($('msFactPlaca'), { onChange: pintar });

    async function cargar() {
      const filas = await llamarBackend('filtrarFacturacionPendiente', { tipo: 'TODOS', texto: '' });
      if (!Array.isArray(filas)) {
        mostrarMensaje((filas && filas.mensaje) || 'No se pudo cargar la lista de facturación.', 'error');
        $('factResumen').textContent = 'No se pudo cargar la lista.';
        return;
      }
      todas = filas.map(f => Object.assign({}, f, { _fecha: iso(f.fechaServicio), _cli: txt(f.cliente1), _dest: txt(f.destino1), _placa: txt(f.placa) }));
      const unicos = k => Array.from(new Set(todas.map(f => f[k]).filter(Boolean))).sort();
      msCliente.setOpciones(unicos('_cli'));
      msDestino.setOpciones(unicos('_dest'));
      msPlaca.setOpciones(unicos('_placa'));
      pintar();
    }

    function pintar() {
      const desde = $('factDesde').value, hasta = $('factHasta').value;
      const bk = txt($('factBooking').value).replace(/\s+/g, '');
      const tipo = $('cboFiltroTipoFact').value;
      const ver = $('cboEstadoFact').value;
      const q = txt($('txtBuscarFact').value);
      const lista = todas.filter(function (f) {
        if (desde && f._fecha < desde) return false;
        if (hasta && f._fecha > hasta) return false;
        if (bk && txt(f.booking).replace(/\s+/g, '').indexOf(bk) === -1) return false;
        if (!msCliente.cumple(f._cli)) return false;
        if (!msDestino.cumple(f._dest)) return false;
        if (!msPlaca.cumple(f._placa)) return false;
        if (tipo !== 'TODOS' && txt(f.tipoFact) !== tipo) return false;
        if (ver && (ver === 'F') !== facturado(f)) return false;
        if (q && ![f.booking, f.contenedor, f.destino1, f.cliente1, f.destino2, f.cliente2, f.codigo, f.placa].some(v => txt(v).indexOf(q) !== -1)) return false;
        return true;
      }).sort((a, b) => (facturado(a) - facturado(b)) || b._fecha.localeCompare(a._fecha));

      const tbody = $('tablaFact').querySelector('tbody');
      tbody.innerHTML = '';
      seleccionado = null;
      const nPend = lista.filter(f => !facturado(f)).length;
      const totPend = todas.filter(f => !facturado(f)).length;
      $('factResumen').innerHTML = lista.length + ' resultado(s): <b style="color:#92400e">' + nPend + ' pendiente(s)</b> · ' + (lista.length - nPend) +
        ' facturado(s)' + (lista.length !== todas.length ? ' <span style="color:#8b95a1">(en total hay ' + totPend + ' pendiente(s))</span>' : '') +
        '. Orden: pendientes primero y luego la fecha más reciente.';
      if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#8b95a1;padding:16px;">No hay servicios con estos filtros.</td></tr>';
        return;
      }
      let grupo = null;
      lista.forEach(function (f) {
        const hecho = facturado(f);
        if (!ver && grupo !== hecho) {
          grupo = hecho;
          const sep = document.createElement('tr'); sep.className = 'fact-sep';
          sep.innerHTML = '<td colspan="9">' + (hecho ? 'Ya facturados' : 'Pendientes de facturar') + '</td>';
          tbody.appendChild(sep);
        }
        const tr = document.createElement('tr');
        if (hecho) tr.className = 'fact-hecho';
        tr.innerHTML = `<td><span class="fact-badge ${hecho ? 'hecho' : 'pend'}">${hecho ? 'Facturado' : 'Pendiente'}</span></td>
          <td>${esc(formatoFecha(f.fechaServicio))}</td><td>${esc(f.booking)}</td><td>${esc(f.contenedor)}</td><td>${esc(f.cliente1)}</td>
          <td>${esc(destinoDe(f))}</td><td>${esc(f.placa)}</td><td>${esc(f.codigo)}</td><td>${esc(f.tipoFact)}</td>`;
        tr.addEventListener('click', function () {
          tbody.querySelectorAll('tr').forEach(x => x.classList.remove('seleccionada'));
          tr.classList.add('seleccionada');
          seleccionado = f;
        });
        tbody.appendChild(tr);
      });
      if (typeof _refrescarSnapshotFormulario === 'function') _refrescarSnapshotFormulario();
    }

    ['factDesde', 'factHasta', 'cboFiltroTipoFact', 'cboEstadoFact'].forEach(id => $(id).addEventListener('change', pintar));
    let espera = null;
    ['factBooking', 'txtBuscarFact'].forEach(id => $(id).addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(pintar, 250); }));
    $('btnBorrarFiltro').addEventListener('click', function () {
      ['factDesde', 'factHasta', 'factBooking', 'txtBuscarFact', 'cboEstadoFact'].forEach(id => { $(id).value = ''; });
      $('cboFiltroTipoFact').value = 'TODOS';
      msCliente.limpiar(); msDestino.limpiar(); msPlaca.limpiar();
      pintar();
    });
    $('btnInicio').addEventListener('click', cerrarPanel);

    $('btnFacturar').addEventListener('click', async function () {
      if (!seleccionado) { mostrarMensaje('Seleccione un servicio para facturar.', 'error'); return; }
      const sel = Object.assign({}, seleccionado);
      Object.keys(sel).forEach(k => { if (k.charAt(0) === '_') delete sel[k]; });
      const resp = await llamarBackend('resolverDestinoFacturacion', sel);
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }

      if (resp.destino === 'frmFacturaSobrecosto') FormFacturaSobrecosto.abrir(resp.fila);
      else if (resp.destino === 'frmFacturaBalanza') FormFacturaBalanza.abrir(resp.fila);
      else FormFacturaViaje.abrir(resp.fila, resp.tipoFacturacionActual);
    });

    cargar();
  }
};
