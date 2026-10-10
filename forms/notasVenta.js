/**
 * forms/notasVenta.js  (v74)
 * -------------------------------------------------------------------------
 * - Notas de venta combustible: todas las notas de venta de Repsol que salen
 *   de los consolidados (abastecimiento inicial de tracto y generador y
 *   recargas pagadas con Repsol), amarradas al servicio (código, booking,
 *   contenedor, placa) y a la factura del viaje. A cada una se le escribe el
 *   N° de factura Repsol; el estado de pago viene de esa factura.
 * - Facturas Repsol: total de cada factura (suma de sus notas de venta) y su
 *   estado de pago: PENDIENTE, PAGADO PARCIAL (con monto pagado) o PAGADO.
 * Backend: nvListar, nvGuardarFacturas, repsolListar, repsolGuardar.
 * -------------------------------------------------------------------------
 */
const NV_UTIL = {
  dinero: function (n) { return 'S/ ' + (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  iso: function (dmy) { const m = String(dmy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; },
  badge: function (estado) {
    const e = String(estado || '').toUpperCase();
    const cls = e === 'PAGADO' ? 'nv-ok' : e === 'PAGADO PARCIAL' ? 'nv-parcial' : e === 'PENDIENTE' ? 'nv-pend' : 'nv-sin';
    return '<span class="nv-badge ' + cls + '">' + esc(e === 'SIN FACTURA' ? 'Sin factura' : e.charAt(0) + e.slice(1).toLowerCase()) + '</span>';
  },
  css: `
    <style>
      .nv-filtros { display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap:8px 10px; align-items:end; margin-bottom:8px; }
      .nv-filtros .campo { margin:0; }
      .nv-filtros input, .nv-filtros select { width:100%; }
      @media (max-width: 1000px) { .nv-filtros { grid-template-columns: repeat(3, minmax(0,1fr)); } }
      .nv-tabla { width:100%; table-layout:fixed; font-size:.78rem; }
      .nv-tabla th, .nv-tabla td { overflow-wrap:anywhere; padding:6px 5px; vertical-align:middle; }
      .nv-tabla td small { display:block; color:#64748b; font-size:.72rem; }
      .nv-tabla td.num { text-align:right; white-space:nowrap; }
      .nv-tabla input { width:100%; padding:5px 7px; border:1.5px solid #c7ced8; border-radius:7px; font-size:.8rem; text-transform:uppercase; }
      .nv-tabla input.cambiado { border-color:#2563eb; background:#eff6ff; }
      .nv-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:.7rem; font-weight:800; white-space:nowrap; }
      .nv-ok { background:#dcfce7; color:#166534; } .nv-parcial { background:#fef3c7; color:#92400e; }
      .nv-pend { background:#fee2e2; color:#991b1b; } .nv-sin { background:#e2e8f0; color:#475569; }
      .nv-resumen { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 8px; }
      .nv-resumen div { background:#f1f5f9; border-radius:8px; padding:5px 10px; font-size:.78rem; color:#475569; }
      .nv-resumen b { color:#1c3a5e; }
      .nv-scroll { max-height:calc(74vh - 300px); min-height:220px; overflow-y:auto; overflow-x:hidden; }
    </style>`
};

const FormNotasVenta = {

  abrir: function () {
    const self = this;
    const html = NV_UTIL.css + `
      <div class="nv-filtros">
        <div class="campo"><label>Abastecido desde</label><input type="date" id="nvDesde"></div>
        <div class="campo"><label>Abastecido hasta</label><input type="date" id="nvHasta"></div>
        <div class="campo"><label>Cliente</label><div id="msNvCliente"></div></div>
        <div class="campo"><label>Placa</label><div id="msNvPlaca"></div></div>
        <div class="campo"><label>Estado de pago</label><div id="msNvEstado"></div></div>
        <div class="campo"><label>Tipo</label>
          <select id="nvTipo"><option value="">Todos</option><option value="INICIAL">Abastecimiento inicial</option><option value="RECARGA">Recargas</option></select>
        </div>
        <div class="campo"><label>Factura del viaje</label><input type="text" id="nvFactViaje" autocomplete="off" placeholder="F001-…" style="text-transform:uppercase"></div>
        <div class="campo"><label>Factura Repsol</label><input type="text" id="nvFactRepsol" autocomplete="off" style="text-transform:uppercase"></div>
        <div class="campo" style="grid-column:span 2"><label>Buscar (booking, contenedor, código, N° NV…)</label><input type="text" id="nvBuscar" autocomplete="off"></div>
        <div class="campo"><label>&nbsp;</label><button class="boton-secundario" id="nvLimpiar" type="button" style="width:100%">Borrar filtros</button></div>
        <div class="campo"><label>&nbsp;</label><button class="boton-secundario" id="nvFacturas" type="button" style="width:100%">Facturas Repsol</button></div>
      </div>
      <div class="nv-resumen" id="nvResumen">Cargando…</div>
      <div class="nv-scroll">
        <table class="tabla-lista nv-tabla">
          <colgroup><col style="width:8%"><col style="width:7%"><col style="width:13%"><col style="width:10%"><col style="width:10%"><col style="width:9%"><col style="width:10%"><col style="width:6%"><col style="width:8%"><col style="width:11%"><col style="width:8%"></colgroup>
          <thead><tr><th>Abastecido</th><th>Cliente</th><th>Booking / contenedor</th><th>Código / placa</th><th>Factura viaje</th><th>Tipo</th><th>N° nota de venta</th><th>Gal</th><th>Monto</th><th>Factura Repsol</th><th>Estado de pago</th></tr></thead>
          <tbody id="nvCuerpo"><tr><td colspan="11">Cargando…</td></tr></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <span id="nvCambios" style="margin-right:auto;font-size:.8rem;color:#2563eb;font-weight:700;"></span>
        <button class="boton-secundario" id="nvCerrar" type="button">Cerrar</button>
        <button class="boton-primario" id="nvGuardar" type="button">Guardar facturas Repsol</button>
      </div>`;
    abrirPanel('Notas de venta combustible (Repsol)', html, function (raiz) { self._wire(raiz); }, { ancho: true });
  },

  _wire: function (raiz) {
    const $ = function (id) { return raiz.querySelector('#' + id); };
    let filas = [];
    const cambios = {};   // clave -> factura escrita

    const pintar = function () {
      const desde = $('nvDesde').value, hasta = $('nvHasta').value, tipo = $('nvTipo').value;
      const fv = $('nvFactViaje').value.trim().toUpperCase(), fr = $('nvFactRepsol').value.trim().toUpperCase();
      const q = $('nvBuscar').value.trim().toUpperCase();
      const vis = filas.filter(function (f) {
        const iso = NV_UTIL.iso(f.fecha);
        if (desde && (!iso || iso < desde)) return false;
        if (hasta && (!iso || iso > hasta)) return false;
        if (tipo && f.origen !== tipo) return false;
        if (!msCliente.cumple(f.cliente) || !msPlaca.cumple(f.placa) || !msEstado.cumple(f.estadoTxt)) return false;
        if (fv && String(f.facturaViaje).toUpperCase().indexOf(fv) === -1) return false;
        if (fr && String(cambios[f.clave] !== undefined ? cambios[f.clave] : f.facturaRepsol).indexOf(fr) === -1) return false;
        if (q && [f.booking, f.contenedor, f.codigo, f.nv, f.grifo, f.conductor, f.destino].join(' ').toUpperCase().indexOf(q) === -1) return false;
        return true;
      });
      // Resumen por cliente: total y lo que falta pagar a Repsol.
      const porCli = {};
      let total = 0, pend = 0, sinFact = 0;
      vis.forEach(function (f) {
        const c = porCli[f.cliente || '-'] || (porCli[f.cliente || '-'] = { total: 0, pend: 0 });
        c.total += f.monto; total += f.monto;
        if (f.estadoPago !== 'PAGADO') { c.pend += f.monto; pend += f.monto; }
        if (!f.facturaRepsol) sinFact++;
      });
      $('nvResumen').innerHTML = '<div><b>' + vis.length + '</b> nota(s) · total <b>' + NV_UTIL.dinero(total) + '</b> · sin pagar <b>' + NV_UTIL.dinero(pend) + '</b> · sin factura Repsol <b>' + sinFact + '</b></div>' +
        Object.keys(porCli).sort().map(function (k) { return '<div>' + esc(k) + ': <b>' + NV_UTIL.dinero(porCli[k].pend) + '</b> por pagar</div>'; }).join('');
      $('nvCuerpo').innerHTML = vis.length ? vis.map(function (f) {
        const val = cambios[f.clave] !== undefined ? cambios[f.clave] : f.facturaRepsol;
        return '<tr><td>' + esc(f.fecha || '—') + '</td><td>' + esc(f.cliente) + '</td>' +
          '<td>' + esc(f.booking) + '<small>' + esc(f.contenedor) + '</small></td>' +
          '<td>' + esc(f.codigo) + '<small>' + esc(f.placa) + '</small></td>' +
          '<td>' + esc(f.facturaViaje || '—') + '<small>' + esc(f.fechaFacturaViaje || '') + '</small></td>' +
          '<td>' + (f.origen === 'INICIAL' ? 'Inicial' : 'Recarga') + '<small>' + (f.equipo === 'GENERADOR' ? 'Generador' : 'Tracto') + '</small></td>' +
          '<td>' + esc(f.nv) + (f.origen === 'RECARGA' ? '<small>' + esc(f.grifo) + '</small>' : '') + '</td>' +
          '<td class="num">' + (Number(f.galones) || 0).toFixed(2) + '</td>' +
          '<td class="num">' + NV_UTIL.dinero(f.monto) + '</td>' +
          '<td><input data-clave="' + esc(f.clave) + '" value="' + esc(val) + '" placeholder="N° factura" class="' + (cambios[f.clave] !== undefined ? 'cambiado' : '') + '"></td>' +
          '<td>' + NV_UTIL.badge(f.estadoPago) + '</td></tr>';
      }).join('') : '<tr><td colspan="11" style="color:#64748b">No hay notas de venta con estos filtros. Las notas de venta aparecen cuando el consolidado tiene el N° de nota de venta del abastecimiento inicial o recargas pagadas con Repsol.</td></tr>';
      $('nvCuerpo').querySelectorAll('input[data-clave]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          const f = filas.filter(function (x) { return x.clave === inp.dataset.clave; })[0];
          const v = inp.value.trim().toUpperCase().replace(/\s+/g, '');
          if (f && v === f.facturaRepsol) delete cambios[inp.dataset.clave]; else cambios[inp.dataset.clave] = v;
          inp.classList.toggle('cambiado', cambios[inp.dataset.clave] !== undefined);
          contar();
        });
      });
      _refrescarSnapshotFormulario();
    };
    const contar = function () {
      const n = Object.keys(cambios).length;
      $('nvCambios').textContent = n ? n + ' cambio(s) sin guardar' : '';
    };

    const msCliente = crearMultiSelect($('msNvCliente'), { onChange: pintar });
    const msPlaca = crearMultiSelect($('msNvPlaca'), { onChange: pintar });
    const msEstado = crearMultiSelect($('msNvEstado'), { onChange: pintar });

    const cargar = async function () {
      const r = await llamarBackend('nvListar', {});
      if (!respuestaValida(r)) { mostrarMensaje((r && r.mensaje) || 'No se pudieron cargar las notas de venta.', 'error'); return; }
      filas = (r.filas || []).map(function (f) {
        f.estadoTxt = f.estadoPago === 'SIN FACTURA' ? 'Sin factura' : f.estadoPago.charAt(0) + f.estadoPago.slice(1).toLowerCase();
        f._iso = NV_UTIL.iso(f.fecha);
        return f;
      }).sort(function (a, b) { return (b._iso || '').localeCompare(a._iso || '') || a.codigo.localeCompare(b.codigo); });
      const unicos = function (k) { return Array.from(new Set(filas.map(function (f) { return f[k]; }).filter(Boolean))).sort(); };
      msCliente.setOpciones(unicos('cliente'));
      msPlaca.setOpciones(unicos('placa'));
      msEstado.setOpciones(['Sin factura', 'Pendiente', 'Pagado parcial', 'Pagado']);
      pintar();
    };

    ['nvDesde', 'nvHasta', 'nvTipo'].forEach(function (id) { $(id).addEventListener('change', pintar); });
    ['nvFactViaje', 'nvFactRepsol', 'nvBuscar'].forEach(function (id) { $(id).addEventListener('input', pintar); });
    $('nvLimpiar').addEventListener('click', function () {
      ['nvDesde', 'nvHasta', 'nvTipo', 'nvFactViaje', 'nvFactRepsol', 'nvBuscar'].forEach(function (id) { $(id).value = ''; });
      msCliente.limpiar(); msPlaca.limpiar(); msEstado.limpiar(); pintar();
    });
    $('nvCerrar').addEventListener('click', solicitarCierrePanel);
    $('nvFacturas').addEventListener('click', function () {
      if (Object.keys(cambios).length && !confirmar('Tienes facturas Repsol escritas sin guardar. ¿Salir sin guardarlas?')) return;
      FormFacturasRepsol.abrir();
    });
    protegerClic($('nvGuardar'), async function () {
      const claves = Object.keys(cambios);
      if (!claves.length) { mostrarMensaje('No hay cambios para guardar.', 'info'); return; }
      const items = claves.map(function (k) {
        const f = filas.filter(function (x) { return x.clave === k; })[0] || {};
        return { clave: k, codigo: f.codigo, nv: f.nv, factura: cambios[k] };
      });
      const r = await llamarBackend('nvGuardarFacturas', { items: items });
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo guardar.', 'error'); return; }
      claves.forEach(function (k) { delete cambios[k]; });
      contar();
      mostrarMensaje(r.mensaje, 'exito');
      await cargar();
    });
    cargar();
  }
};

const FormFacturasRepsol = {

  abrir: function () {
    const self = this;
    const html = NV_UTIL.css + `
      <div class="nv-filtros">
        <div class="campo"><label>Estado</label><div id="msRpEstado"></div></div>
        <div class="campo" style="grid-column:span 2"><label>Buscar factura o cliente</label><input type="text" id="rpBuscar" autocomplete="off"></div>
        <div class="campo"><label>&nbsp;</label><button class="boton-secundario" id="rpNotas" type="button" style="width:100%">Notas de venta</button></div>
      </div>
      <div class="nv-resumen" id="rpResumen">Cargando…</div>
      <div class="nv-scroll">
        <table class="tabla-lista nv-tabla">
          <colgroup><col style="width:12%"><col style="width:11%"><col style="width:5%"><col style="width:10%"><col style="width:13%"><col style="width:10%"><col style="width:11%"><col style="width:9%"><col style="width:19%"></colgroup>
          <thead><tr><th>Factura Repsol</th><th>Clientes</th><th>NV</th><th>Total</th><th>Estado</th><th>Monto pagado</th><th>Fecha de pago</th><th>Saldo</th><th>Observación</th></tr></thead>
          <tbody id="rpCuerpo"><tr><td colspan="9">Cargando…</td></tr></tbody>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <span style="margin-right:auto;font-size:.78rem;color:#64748b;">Las facturas se crean al escribir su número en "Notas de venta combustible". Cada cambio de estado se guarda con su botón.</span>
        <button class="boton-secundario" id="rpCerrar" type="button">Cerrar</button>
      </div>`;
    abrirPanel('Facturas Repsol', html, function (raiz) { self._wire(raiz); }, { ancho: true });
  },

  _wire: function (raiz) {
    const $ = function (id) { return raiz.querySelector('#' + id); };
    let lista = [];
    const msEstado = crearMultiSelect($('msRpEstado'), { onChange: function () { pintar(); } });

    const pintar = function () {
      const q = $('rpBuscar').value.trim().toUpperCase();
      const vis = lista.filter(function (f) {
        if (!msEstado.cumple(f.estado)) return false;
        if (q && (f.factura + ' ' + f.clientes).toUpperCase().indexOf(q) === -1) return false;
        return true;
      });
      const tot = vis.reduce(function (a, f) { a.t += f.total; a.p += f.montoPagado; a.s += f.saldo; return a; }, { t: 0, p: 0, s: 0 });
      $('rpResumen').innerHTML = '<div><b>' + vis.length + '</b> factura(s) · total <b>' + NV_UTIL.dinero(tot.t) + '</b> · pagado <b>' + NV_UTIL.dinero(tot.p) + '</b> · saldo por pagar <b>' + NV_UTIL.dinero(tot.s) + '</b></div>';
      $('rpCuerpo').innerHTML = vis.length ? vis.map(function (f, i) {
        const parcial = f.estado === 'PAGADO PARCIAL';
        return '<tr data-i="' + lista.indexOf(f) + '"><td><b>' + esc(f.factura) + '</b><small>' + (f.actualizadoPor ? esc(f.actualizadoPor) + ' · ' + esc(f.fechaActualizacion) : '') + '</small></td>' +
          '<td>' + esc(f.clientes || '—') + '</td><td class="num">' + f.notas + '</td><td class="num">' + NV_UTIL.dinero(f.total) + '</td>' +
          '<td><select class="rp-estado" style="width:100%;padding:5px;border-radius:7px;border:1.5px solid #c7ced8;font-size:.8rem">' +
          ['PENDIENTE', 'PAGADO PARCIAL', 'PAGADO'].map(function (e) { return '<option' + (e === f.estado ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></td>' +
          '<td><input class="rp-monto" inputmode="decimal" value="' + (parcial ? f.montoPagado : '') + '"' + (parcial ? '' : ' disabled') + ' style="text-transform:none"></td>' +
          '<td><input type="date" class="rp-fecha" value="' + NV_UTIL.iso(f.fechaPago) + '"' + (f.estado === 'PENDIENTE' ? ' disabled' : '') + '></td>' +
          '<td class="num">' + NV_UTIL.dinero(f.saldo) + '</td>' +
          '<td><div style="display:flex;gap:4px"><input class="rp-obs" value="' + esc(f.observacion) + '" style="text-transform:none"><button class="boton-primario rp-guardar" type="button" style="padding:4px 8px;font-size:.74rem;white-space:nowrap">Guardar</button></div></td></tr>';
      }).join('') : '<tr><td colspan="9" style="color:#64748b">No hay facturas Repsol. Escriba el N° de factura en "Notas de venta combustible".</td></tr>';
      $('rpCuerpo').querySelectorAll('tr[data-i]').forEach(function (tr) {
        const f = lista[Number(tr.dataset.i)];
        const sel = tr.querySelector('.rp-estado');
        sel.addEventListener('change', function () {
          tr.querySelector('.rp-monto').disabled = sel.value !== 'PAGADO PARCIAL';
          if (sel.value !== 'PAGADO PARCIAL') tr.querySelector('.rp-monto').value = '';
          tr.querySelector('.rp-fecha').disabled = sel.value === 'PENDIENTE';
          if (sel.value === 'PENDIENTE') tr.querySelector('.rp-fecha').value = '';
        });
        protegerClic(tr.querySelector('.rp-guardar'), async function () {
          const estado = sel.value;
          const monto = Number(String(tr.querySelector('.rp-monto').value).replace(',', '.')) || 0;
          if (estado === 'PAGADO PARCIAL' && !(monto > 0)) { mostrarMensaje('Escriba el monto pagado.', 'error'); return; }
          if (estado !== 'PENDIENTE' && !tr.querySelector('.rp-fecha').value) { mostrarMensaje('Indique la fecha de pago.', 'error'); return; }
          const r = await llamarBackend('repsolGuardar', {
            factura: f.factura, estado: estado, montoPagado: monto, total: f.total,
            fechaPago: tr.querySelector('.rp-fecha').value, observacion: tr.querySelector('.rp-obs').value
          });
          if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo guardar.', 'error'); return; }
          await cargar();
        });
      });
      _refrescarSnapshotFormulario();
    };

    const cargar = async function () {
      const r = await llamarBackend('repsolListar', {});
      if (!respuestaValida(r)) { mostrarMensaje((r && r.mensaje) || 'No se pudieron cargar las facturas.', 'error'); return; }
      const orden = { 'PAGADO PARCIAL': 0, 'PENDIENTE': 1, 'PAGADO': 2 };
      lista = (r.facturas || []).sort(function (a, b) { return (orden[a.estado] - orden[b.estado]) || a.factura.localeCompare(b.factura); });
      msEstado.setOpciones(['PENDIENTE', 'PAGADO PARCIAL', 'PAGADO']);
      pintar();
    };
    $('rpBuscar').addEventListener('input', pintar);
    $('rpCerrar').addEventListener('click', solicitarCierrePanel);
    $('rpNotas').addEventListener('click', function () { FormNotasVenta.abrir(); });
    cargar();
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const a = document.getElementById('btn-notas-venta');
  if (a) a.addEventListener('click', function () { FormNotasVenta.abrir(); });
  const b = document.getElementById('btn-facturas-repsol');
  if (b) b.addEventListener('click', function () { FormFacturasRepsol.abrir(); });
});
