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

  // v110: pantalla con dos pestañas. "Registrados" (lista de sobrecostos) se abre primero.
  _MOT: { 'HORAS EXTRAS PLANTA': 'Horas extras en planta', 'H.E. PLANTA F.': 'Horas extras en planta', 'HORAS EXTRAS PUERTO': 'Horas extras en puerto', 'H.E. PUERTO F.': 'Horas extras en puerto',
    'GASIFICADO': 'Gasificado', 'GASIFICADO F.': 'Gasificado', 'REPROGRAMACION': 'Reprogramación', 'REPROG. F.': 'Reprogramación', 'PERNOCTE': 'Pernocte', 'PERNOCTE F.': 'Pernocte',
    'SOBREESTADIA': 'Sobreestadía', 'SOBREEST. F.': 'Sobreestadía' },
  _mot: function (t) { t = String(t || '').toUpperCase(); return this._MOT[t] || t.replace(/\s+F\.$/, ''); },
  _pestanas: function (activa) {
    return '<div style="display:flex;gap:6px;margin-bottom:10px">' +
      '<button type="button" class="' + (activa === 'reg' ? 'boton-primario' : 'boton-secundario') + '" id="scTabReg">📋 Registrados</button>' +
      '<button type="button" class="' + (activa === 'nuevo' ? 'boton-primario' : 'boton-secundario') + '" id="scTabNuevo">➕ Registrar nuevo</button></div>';
  },
  _wireTabs: function (raiz) {
    const self = this;
    const r = raiz.querySelector('#scTabReg'), n = raiz.querySelector('#scTabNuevo');
    if (r) r.addEventListener('click', () => self.abrir(true));
    if (n) n.addEventListener('click', () => self._abrirNuevo(true));
  },

  abrir: async function (enPanel) {
    const self = this;
    const html = this._pestanas('reg') + `
      <style>
        .scr-barra{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:end;margin-bottom:8px}
        .scr-barra .campo{margin:0;min-width:120px}
        .scr-kpi{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px}
        .scr-kpi div{background:#f1f5f9;border-radius:9px;padding:6px 12px;border-left:4px solid #b45309}
        .scr-kpi span{display:block;font-size:.66rem;font-weight:700;color:#64748b;text-transform:uppercase}.scr-kpi b{font-size:1.05rem;color:#1c3a5e}
        .scr-wrap{max-height:calc(74vh - 260px);min-height:180px;overflow-y:auto;overflow-x:hidden;border:1px solid #e1e6ec;border-radius:10px}
        .scr-t{width:100%;table-layout:fixed;border-collapse:collapse;font-size:.74rem}
        .scr-t th{background:#eef2f7;color:#1c3a5e;font-size:.68rem;padding:5px;position:sticky;top:0;text-align:left;z-index:1}
        .scr-t td{padding:5px;border-bottom:1px solid #eef2f7;vertical-align:top;overflow-wrap:anywhere}
        .scr-t .sub{display:block;color:#64748b;font-size:.66rem}
        .scr-tag{display:inline-block;padding:1px 7px;border-radius:8px;font-size:.66rem;font-weight:700}
        .scr-b{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:2px 6px;font-size:.66rem;font-weight:700;cursor:pointer;margin:1px 0;display:block;width:100%}
        .scr-b:hover{background:#f1f5f9}
      </style>
      <div class="scr-barra">
        <div class="campo"><label>Estado</label><select id="scrEstado"><option value="pend">Por facturar</option><option value="fact">Facturados</option><option value="">Todos</option></select></div>
        <div class="campo"><label>Cliente</label><div id="scrCliente"></div></div>
        <div class="campo"><label>Motivo</label><div id="scrMotivo"></div></div>
        <div class="campo"><label>Desde</label><input type="date" id="scrDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="scrHasta"></div>
        <div class="campo" style="flex:1;min-width:160px"><label>Buscar</label><input id="scrBuscar" placeholder="BK, código, contenedor, conductor…" autocomplete="off"></div>
        <button class="boton-secundario" id="scrLimpiar">Borrar filtros</button>
      </div>
      <div class="scr-kpi" id="scrKpi"></div>
      <div class="scr-wrap"><table class="scr-t">
        <colgroup><col style="width:3%"><col style="width:8%"><col style="width:12%"><col style="width:7%"><col style="width:12%"><col style="width:11%"><col style="width:7%"><col style="width:7%"><col style="width:8%"><col><col style="width:9%"><col style="width:8%"></colgroup>
        <thead><tr><th><input type="checkbox" id="scrTodos" title="Marcar todos los visibles"></th><th>Fecha</th><th>Código / BK</th><th>Cliente</th><th>Conductor / contenedor</th><th>Motivo</th><th>Cantidad</th><th>Tarifa</th><th style="text-align:right">Total</th><th>Detalle</th><th>Estado</th><th></th></tr></thead>
        <tbody id="scrCuerpo"><tr><td colspan="12" style="text-align:center;color:#64748b;padding:16px">Cargando…</td></tr></tbody>
      </table></div>
      <div class="panel-footer" style="padding-top:10px;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="boton-secundario" id="scrCopiar">📋 Copiar marcados para correo</button>
          <button class="boton-secundario" id="scrImprimir">🖨 Imprimir / PDF marcados</button>
        </span>
        <button class="boton-secundario" id="scrCerrar">Cerrar</button>
      </div>`;
    const wire = async function (raiz) {
      self._raiz = raiz; self._marcados = new Set();
      self._wireTabs(raiz);
      const $ = id => raiz.querySelector('#' + id);
      self._msCli = crearMultiSelect($('scrCliente'), { textoTodos: 'Todos', onChange: () => self._pintar() });
      self._msMot = crearMultiSelect($('scrMotivo'), { textoTodos: 'Todos', onChange: () => self._pintar() });
      ['scrEstado', 'scrDesde', 'scrHasta'].forEach(id => $(id).addEventListener('change', () => self._pintar()));
      $('scrBuscar').addEventListener('input', () => self._pintar());
      $('scrLimpiar').addEventListener('click', function () { $('scrEstado').value = 'pend'; $('scrDesde').value = ''; $('scrHasta').value = ''; $('scrBuscar').value = ''; self._msCli.limpiar(); self._msMot.limpiar(); self._pintar(); });
      $('scrCerrar').addEventListener('click', cerrarPanel);
      $('scrTodos').addEventListener('change', function () { self._vis().forEach(x => this.checked ? self._marcados.add(x.fila) : self._marcados.delete(x.fila)); self._pintar(); });
      $('scrCuerpo').addEventListener('change', function (ev) {
        const c = ev.target.closest('input.scr-chk'); if (!c) return;
        const f = Number(c.dataset.f); c.checked ? self._marcados.add(f) : self._marcados.delete(f);
      });
      $('scrCuerpo').addEventListener('click', function (ev) {
        const b = ev.target.closest('button[data-acc]'); if (!b) return;
        const x = self._items.find(i => i.fila === Number(b.dataset.f)); if (!x) return;
        if (b.dataset.acc === 'fact') FormFacturaSobrecosto.abrir(x.fila);
        if (b.dataset.acc === 'seg') self._verSeguimiento(x);
      });
      $('scrCopiar').addEventListener('click', () => self._correo(false));
      $('scrImprimir').addEventListener('click', () => self._correo(true));
      let r = null;
      try { r = await llamarBackend('sobrecostosListar', {}); } catch (e) { r = null; }
      if (!r || !r.ok) { $('scrCuerpo').innerHTML = '<tr><td colspan="12" style="text-align:center;color:#b91c1c;padding:16px">' + esc((r && r.mensaje) || 'No se pudo cargar la lista.') + '</td></tr>'; return; }
      self._items = r.items || [];
      self._msCli.setOpciones(Array.from(new Set(self._items.map(x => String(x.cliente).toUpperCase()).filter(Boolean))).sort());
      self._msMot.setOpciones(Array.from(new Set(self._items.map(x => self._mot(x.tipo)).filter(Boolean))).sort());
      self._pintar();
    };
    if (enPanel === true) actualizarPanel('Sobrecostos', html, wire);
    else abrirPanel('Sobrecostos', html, wire, { ancho: true });
  },

  _vis: function () {
    const $ = id => this._raiz.querySelector('#' + id);
    const est = $('scrEstado').value, de = $('scrDesde').value, ha = $('scrHasta').value, q = $('scrBuscar').value.trim().toUpperCase();
    return (this._items || []).filter(x => (!est || (est === 'pend' ? !x.facturado : x.facturado)) &&
      this._msCli.cumple(String(x.cliente).toUpperCase()) && this._msMot.cumple(this._mot(x.tipo)) &&
      (!de || (x.iso && x.iso >= de)) && (!ha || (x.iso && x.iso <= ha)) &&
      (!q || [x.codigo, x.booking, x.contenedor, x.conductor, x.placa, x.obs].join(' ').toUpperCase().indexOf(q) >= 0));
  },

  _pintar: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    if (typeof _refrescarSnapshotFormulario === 'function') setTimeout(_refrescarSnapshotFormulario, 0);
    const vis = self._vis();
    const sum = (arr, m) => arr.filter(x => (/S\//.test(x.moneda) ? 'S/' : '$') === m).reduce((a, x) => a + x.total, 0);
    const pend = vis.filter(x => !x.facturado);
    $('scrKpi').innerHTML = [['Sobrecostos', vis.length], ['Por facturar', pend.length],
      ['Por cobrar US$', '$ ' + sum(pend, '$').toFixed(2)], ['Por cobrar S/', 'S/ ' + sum(pend, 'S/').toFixed(2)]]
      .map(k => '<div><span>' + k[0] + '</span><b>' + k[1] + '</b></div>').join('');
    $('scrCuerpo').innerHTML = vis.length ? vis.map(function (x) {
      const mon = /S\//.test(x.moneda) ? 'S/' : '$';
      const est = x.facturado ? '<span class="scr-tag" style="background:#dcfce7;color:#166534">Facturado</span>' + (x.factura ? '<span class="sub">' + esc(x.factura) + (x.fechaFactura ? ' · ' + esc(x.fechaFactura) : '') + '</span>' : '')
        : '<span class="scr-tag" style="background:#fef3c7;color:#92400e">Por facturar</span>';
      return '<tr><td><input type="checkbox" class="scr-chk" data-f="' + x.fila + '"' + (self._marcados.has(x.fila) ? ' checked' : '') + '></td>' +
        '<td>' + esc(x.fecha) + '</td><td><b>' + esc(x.codigo) + '</b><span class="sub">BK ' + esc(x.booking) + '</span></td><td>' + esc(x.cliente) + '</td>' +
        '<td>' + esc(x.conductor) + '<span class="sub">' + esc(x.contenedor) + ' · ' + esc(x.placa) + '</span></td><td>' + esc(self._mot(x.tipo)) + '</td>' +
        '<td>' + (x.unidad ? x.cantidad + ' ' + x.unidad : x.cantidad) + '</td><td>' + mon + ' ' + Number(x.precio).toFixed(2) + '</td>' +
        '<td style="text-align:right"><b>' + mon + ' ' + Number(x.total).toFixed(2) + '</b></td><td>' + esc(x.obs) + '</td><td>' + est + '</td>' +
        '<td>' + (x.facturado ? '' : '<button type="button" class="scr-b" data-acc="fact" data-f="' + x.fila + '">💲 Facturar</button>') +
        (x.filaServicio ? '<button type="button" class="scr-b" data-acc="seg" data-f="' + x.fila + '">⏱ Seguimiento</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="12" style="text-align:center;color:#64748b;padding:16px">No hay sobrecostos con estos filtros.</td></tr>';
  },

  _verSeguimiento: async function (x) {
    let filas = null;
    try { filas = await llamarBackend('listarConSeguimiento', {}); } catch (e) { filas = null; }
    const f = (filas || []).find(s => String(s['CODIGO SERVICIO'] || '').toUpperCase() === String(x.codigoServicio).toUpperCase()) || (filas || []).find(s => s._fila === x.filaServicio);
    if (!f) { mostrarMensaje('No se encontró el servicio ' + x.codigoServicio + '.', 'error'); return; }
    FormDatosViaje._abrirSeguimiento(f._fila, f);
  },

  _correo: async function (imprimir) {
    const self = this;
    const sel = (self._items || []).filter(x => self._marcados.has(x.fila));
    if (!sel.length) { mostrarMensaje('Marque uno o más sobrecostos con la casilla de la izquierda.', 'error'); return; }
    if (!self._razones) {
      self._razones = {};
      try { const r = await llamarBackend('listarClientes', {}); (r && r.clientes || []).forEach(c => { self._razones[String(c.codigo || '').trim().toUpperCase()] = c.razonSocial; }); } catch (e) { /* sin maestro */ }
    }
    const raz = c => self._razones[String(c || '').trim().toUpperCase()] || c;
    const bks = Array.from(new Set(sel.map(x => x.booking))), clis = Array.from(new Set(sel.map(x => String(x.cliente).toUpperCase())));
    const asunto = bks.length === 1
      ? 'SOBRECOSTOS - BK: ' + bks[0] + '- CONTENEDOR: ' + (sel[0].contenedor || '') + '|| CLIENTE: ' + raz(sel[0].cliente)
      : 'SOBRECOSTOS - ' + bks.length + ' SERVICIOS (BK: ' + bks.join(', ') + ')|| CLIENTE: ' + clis.map(raz).join(' / ');
    const td = 'style="border:1px solid #cbd5e1;padding:5px 8px;font-family:Arial,sans-serif;font-size:12px"';
    const th = 'style="border:1px solid #cbd5e1;padding:5px 8px;background:#1c3a5e;color:#fff;font-family:Arial,sans-serif;font-size:12px;text-align:left"';
    let totU = 0, totS = 0;
    let h = '<div style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b"><p style="margin:0 0 8px">Estimados, se detalla el sobrecosto ' + (bks.length > 1 ? 'de los siguientes servicios' : 'del siguiente servicio') + ':</p>';
    h += '<table style="border-collapse:collapse;margin-bottom:10px"><tr><th ' + th + '>Booking</th><th ' + th + '>Contenedor</th><th ' + th + '>Fecha servicio</th><th ' + th + '>Concepto</th><th ' + th + '>Cantidad</th><th ' + th + '>Tarifa</th><th ' + th + '>Total</th><th ' + th + '>Detalle</th></tr>';
    sel.forEach(function (x) {
      const mon = /S\//.test(x.moneda) ? 'S/' : '$'; if (mon === 'S/') totS += x.total; else totU += x.total;
      h += '<tr><td ' + td + '>' + esc(x.booking) + '</td><td ' + td + '>' + esc(x.contenedor) + '</td><td ' + td + '>' + esc(x.fecha) + '</td><td ' + td + '>' + esc(self._mot(x.tipo)) + '</td><td ' + td + '>' + (x.unidad ? x.cantidad + ' ' + x.unidad : x.cantidad) + '</td><td ' + td + '>' + mon + ' ' + Number(x.precio).toFixed(2) + '</td><td ' + td + '><b>' + mon + ' ' + Number(x.total).toFixed(2) + '</b></td><td ' + td + '>' + esc(x.obs) + '</td></tr>';
    });
    h += '<tr><td ' + td + ' colspan="6"><b>TOTAL</b></td><td ' + td + '><b>' + [totU ? '$ ' + totU.toFixed(2) : '', totS ? 'S/ ' + totS.toFixed(2) : ''].filter(Boolean).join(' + ') + '</b></td><td ' + td + '></td></tr></table>';
    h += '<p style="margin:10px 0 0"><b>Favor de confirmar para proceder con la facturación.</b></p></div>';
    const txt = h.replace(/<\/(tr|p)>/g, '\n').replace(/<\/t[dh]>/g, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
    if (imprimir) {
      const w = window.open('', '_blank');
      if (!w) { mostrarMensaje('El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio.', 'error'); return; }
      w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(asunto) + '</title><style>body{margin:24px}@page{size:A4 landscape;margin:12mm}</style></head><body>' +
        '<div style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#1c3a5e;margin-bottom:4px">TRANSPORTES SSI S.A.C.</div><div style="font-family:Arial,sans-serif;font-size:12px;font-weight:bold;margin-bottom:10px">' + esc(asunto) + '</div>' + h + '</body></html>');
      w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 400);
      return;
    }
    const copiar = async function (html, t) {
      try {
        if (html) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([t], { type: 'text/plain' }) })]);
        else await navigator.clipboard.writeText(t);
      } catch (e) {
        const d = document.createElement('div'); if (html) d.innerHTML = html; else d.textContent = t; d.style.position = 'fixed'; d.style.left = '-9999px'; document.body.appendChild(d);
        const rg = document.createRange(); rg.selectNodeContents(d); const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); document.execCommand('copy'); s.removeAllRanges(); d.remove();
      }
    };
    const velo = document.createElement('div');
    velo.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px';
    velo.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:680px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.25)">' +
      '<div style="background:#1c3a5e;color:#fff;padding:12px 16px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between"><b>📧 Correo de sobrecostos (' + sel.length + ')</b><button type="button" id="scX" style="background:none;border:0;color:#fff;font-size:20px;cursor:pointer">×</button></div>' +
      '<div style="padding:14px 16px;font-size:.88rem"><div class="campo"><label>Asunto</label><div style="display:flex;gap:6px"><input id="scAs" readonly style="flex:1" value="' + esc(asunto) + '"><button type="button" class="boton-secundario" id="scCopAs">📋 Copiar asunto</button></div></div>' +
      '<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="color:#64748b">El cuerpo lleva la tabla de sobrecostos marcados, el total y "Favor de confirmar para proceder con la facturación."</span><button type="button" class="boton-primario" id="scCopCu">📋 Copiar cuerpo</button></div>' +
      '<div style="text-align:right;margin-top:12px"><button type="button" class="boton-secundario" id="scCerrarC">Cerrar</button></div></div></div>';
    document.body.appendChild(velo);
    const q = id => velo.querySelector('#' + id), cerrar = () => velo.remove();
    q('scX').addEventListener('click', cerrar); q('scCerrarC').addEventListener('click', cerrar);
    q('scCopAs').addEventListener('click', async function () { await copiar(null, asunto); this.textContent = '✓ Asunto copiado'; });
    q('scCopCu').addEventListener('click', async function () { await copiar(h, txt); this.textContent = '✓ Cuerpo copiado'; });
  },

  _abrirNuevo: async function (enPanel) {
    const html = this._pestanas('nuevo') + `
      <div class="barra-filtros">
        <div class="campo"><label>Estado</label>
          <select id="filtroEstadoSobrecosto">
            <option value="">Todos</option>
            <option>PROGRAMADO</option><option>RETIRANDO</option><option>EN RUTA CLIENTE</option><option>EN CLIENTE</option><option>EN RUTA RETORNO</option><option>COLA PUERTO</option>
            <option>CULMINADO</option><option>FALSO FLETE</option><option>REPROGRAMADO</option>
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

    const w = (raiz) => { this._wireTabs(raiz); this._wire(raiz); };
    if (enPanel === true) actualizarPanel('Sobrecostos', html, w);
    else abrirPanel('Sobrecostos', html, w, { ancho: true });
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
