/**
 * forms/almacenCorregir.js  (v82)
 * -------------------------------------------------------------------------
 * Almacén > Stock > pestaña "Corregir (maestros)". Solo rol MAESTRO.
 * Editar y anular: ingresos (por comprobante o por línea), salidas,
 * productos del catálogo, reparaciones de piezas y mantenimientos.
 * Todo cambio pide motivo y queda en el historial (hoja MT_AUDITORIA).
 * Backend: mtCorrDatos, mtCorrIngresoDoc, mtCorrIngresoLinea,
 *   mtCorrAnularIngreso, mtCorrSalida, mtCorrAnularSalida, mtCorrProducto,
 *   mtCorrReparacion, mtCorrAnularReparacion, mtCorrMantenimiento,
 *   mtCorrAnularMantenimiento, mtCorrHistorial.
 * -------------------------------------------------------------------------
 */
const FormAlmacenCorregir = {
  _d: null,
  _sub: 'ingresos',

  esMaestro: function () {
    const d = (typeof Sesion !== 'undefined') ? Sesion.datos() : null;
    return !!(d && String(d.rol || '').toUpperCase() === 'MAESTRO');
  },

  abrir: async function (sub) {
    if (!this.esMaestro()) { mostrarMensaje('Solo los usuarios MAESTRO pueden corregir movimientos.', 'error'); return; }
    if (sub) this._sub = sub;
    const self = this;
    if (FormAlmacen._cargar) await FormAlmacen._cargar();
    const subt = function (k, t) { return '<button type="button" class="mt-tab' + (k === self._sub ? ' activo' : '') + '" data-csub="' + k + '">' + t + '</button>'; };
    const html = MT_ESTILOS + FormAlmacen._tabsStock('corregir') + `
      <style>
        .cr-t { width:100%; table-layout:fixed; border-collapse:collapse; font-size:.76rem; }
        .cr-t th { background:#1c3a5e; color:#fff; font-size:.68rem; padding:6px 5px; position:sticky; top:0; z-index:1; text-align:left; }
        .cr-t td { padding:5px; border-bottom:1px solid #eef2f7; vertical-align:top; overflow-wrap:anywhere; }
        .cr-t tr.anulado td { color:#94a3b8; text-decoration:line-through; }
        .cr-t tr.doc td { background:#f1f5f9; font-weight:700; }
        .cr-acc { display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end; }
        .cr-b { padding:3px 8px; font-size:.7rem; border-radius:6px; border:1px solid #cbd5e1; background:#fff; cursor:pointer; white-space:nowrap; }
        .cr-b:hover { background:#eef4fb; } .cr-b.rojo { border-color:#fca5a5; color:#b91c1c; } .cr-b.rojo:hover { background:#fef2f2; }
        .cr-wrap { max-height:58vh; overflow:auto; border:1px solid #e1e6ec; border-radius:10px; }
        .cr-barra { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:end; margin:8px 0; }
        .cr-barra .campo { margin:0; min-width:140px; }
        .cr-aviso { font-size:.78rem; color:#64748b; margin:4px 0 8px; }
        .cr-dlg .fila-campos { grid-template-columns: repeat(3, minmax(0,1fr)); }
        .cr-dlg textarea { width:100%; min-height:56px; }
      </style>
      <div class="mt-tabs" style="margin-top:6px">${subt('ingresos', 'Ingresos')}${subt('salidas', 'Salidas')}${subt('productos', 'Productos')}${subt('reparaciones', 'Reparaciones')}${subt('mantenimientos', 'Mantenimientos')}${subt('historial', 'Historial de cambios')}</div>
      <div class="cr-aviso">Todo cambio pide un <b>motivo</b> y queda en el historial. Anular = deja de contar en el stock y en los reportes (queda tachado). El stock se recalcula solo.</div>
      <div id="crCuerpo">Cargando…</div>
      <div class="mt-botones"><button class="boton-secundario" id="crCerrar">Cerrar</button></div>`;
    abrirPanel('Stock · Corregir (maestros)', html, function (raiz) {
      self._raiz = raiz;
      FormAlmacen._wireTabsStock(raiz);
      raiz.querySelectorAll('[data-csub]').forEach(b => b.addEventListener('click', function () { self._sub = b.dataset.csub; self.abrir(); }));
      raiz.querySelector('#crCerrar').addEventListener('click', cerrarPanel);
      self._cargar();
    }, { ancho: true });
  },

  _cargar: async function () {
    const self = this, c = self._raiz.querySelector('#crCuerpo');
    if (self._sub === 'historial') {
      const r = await MT.llamar('mtCorrHistorial', {});
      if (!r) { c.textContent = 'No se pudo cargar.'; return; }
      c.innerHTML = '<div class="cr-wrap"><table class="cr-t"><colgroup><col style="width:12%"><col style="width:12%"><col style="width:16%"><col style="width:12%"><col><col style="width:22%"></colgroup>' +
        '<thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Hoja · fila</th><th>Cambio</th><th>Motivo</th></tr></thead><tbody>' +
        (r.items.length ? r.items.map(x => '<tr><td>' + esc(x.fecha) + '</td><td>' + esc(x.usuario) + '</td><td>' + esc(x.accion) + '</td><td>' + esc(x.hoja) + ' · ' + esc(x.fila) +
          (x.clave ? '<br><small>' + esc(x.clave) + '</small>' : '') + '</td><td><small><b>Antes:</b> ' + esc(String(x.antes).slice(0, 400)) + '<br><b>Después:</b> ' + esc(String(x.despues).slice(0, 300)) +
          '</small></td><td>' + esc(x.motivo) + '</td></tr>').join('') : '<tr><td colspan="6" style="text-align:center;color:#8b95a1;padding:14px">Sin cambios registrados.</td></tr>') +
        '</tbody></table></div>';
      return;
    }
    const r = await MT.llamar('mtCorrDatos', {});
    if (!r) { c.textContent = 'No se pudieron cargar los datos.'; return; }
    self._d = r;
    self['_' + self._sub]();
  },

  /* ---------- utilidades ---------- */
  _f: function (v) { return MT.fechaVista(v); },
  /** Nombre del producto desde el catálogo (en algunas hojas la columna Producto guarda otro código). */
  _nom: function (codigo, texto) { const p = FormAlmacen._producto ? FormAlmacen._producto(codigo) : null; return (p && p.producto) || texto || codigo; },
  _motivoHtml: '<div class="campo ancho4"><label>Motivo del cambio *</label><textarea id="dlMotivo" placeholder="Ej. se digitó mal la cantidad; la factura dice 4"></textarea></div>',
  /** Abre un cuadro con campos; al aceptar llama a la acción y recarga. */
  _dialogo: function (titulo, campos, accion, armar, aviso) {
    const self = this;
    MT.sobreventana(titulo, '<div class="mt-form cr-dlg">' + (aviso ? '<div class="cr-aviso" style="color:#92400e">' + aviso + '</div>' : '') +
      '<div class="fila-campos">' + campos + self._motivoHtml + '</div><div class="mt-botones"><button class="boton-secundario" id="dlNo">Cancelar</button><button class="boton-primario" id="dlSi">Guardar</button></div></div>',
      function (cuerpo, cerrar) {
        cuerpo.querySelector('#dlNo').addEventListener('click', cerrar);
        protegerClic(cuerpo.querySelector('#dlSi'), async function () {
          const q = id => cuerpo.querySelector('#' + id);
          const datos = armar(q);
          if (!datos) return;
          datos.motivo = q('dlMotivo').value.trim();
          if (datos.motivo.length < 4) { mostrarMensaje('Escribe el motivo del cambio.', 'error'); return; }
          const r = await MT.llamar(accion, datos);
          if (!r) return;
          cerrar();
          mostrarMensaje(r.mensaje || 'Listo.', 'exito');
          FormAlmacen._datos = null;
          if (FormAlmacen._cargar) await FormAlmacen._cargar(true);
          self._cargar();
        });
      });
  },
  _filtros: function (extra) {
    return '<div class="cr-barra"><div class="campo"><label>Desde</label><input type="date" id="crDesde"></div><div class="campo"><label>Hasta</label><input type="date" id="crHasta"></div>' +
      '<div class="campo" style="min-width:240px"><label>Buscar</label><input id="crBuscar" placeholder="Comprobante, proveedor, producto, persona, placa…" autocomplete="off" style="text-transform:uppercase"></div>' +
      (extra || '') + '<label style="display:flex;gap:6px;align-items:center;font-size:.8rem"><input type="checkbox" id="crAnul" style="width:auto"> Ver anulados</label></div>';
  },
  _wireFiltros: function (pintar) {
    const c = this._raiz;
    ['crDesde', 'crHasta', 'crAnul'].forEach(id => { const e = c.querySelector('#' + id); if (e) e.addEventListener('change', pintar); });
    const b = c.querySelector('#crBuscar'); if (b) b.addEventListener('input', pintar);
    c.querySelectorAll('[data-filtro]').forEach(e => e.addEventListener('change', pintar));
  },
  _pasa: function (fecha, texto, anulado) {
    const c = this._raiz, de = c.querySelector('#crDesde').value, ha = c.querySelector('#crHasta').value;
    const q = c.querySelector('#crBuscar').value.trim().toUpperCase(), va = c.querySelector('#crAnul').checked;
    if (anulado && !va) return false;
    if (de && fecha < de) return false;
    if (ha && fecha > ha) return false;
    return !q || String(texto).toUpperCase().indexOf(q) !== -1;
  },

  /* ---------- INGRESOS ---------- */
  _ingresos: function () {
    const self = this, c = self._raiz.querySelector('#crCuerpo');
    c.innerHTML = self._filtros() + '<div class="cr-wrap"><table class="cr-t"><colgroup><col style="width:9%"><col><col style="width:13%"><col style="width:11%"><col style="width:11%"><col style="width:180px"></colgroup>' +
      '<thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>P. unit. c/IGV</th><th>Total línea</th><th></th></tr></thead><tbody id="crTb"></tbody></table></div>';
    const pintar = function () {
      const docs = {};
      self._d.ingresos.forEach(function (x) {
        const k = [x.tipoDoc, x.documento, x.proveedor, x.fecha].join('|');
        (docs[k] = docs[k] || { tipoDoc: x.tipoDoc, documento: x.documento, proveedor: x.proveedor, ruc: x.ruc, fecha: x.fecha, moneda: x.moneda, lineas: [] }).lineas.push(x);
      });
      const lista = Object.keys(docs).map(k => docs[k]).filter(function (g) {
        const todoAnul = g.lineas.every(l => l.anulado);
        return self._pasa(g.fecha, [g.tipoDoc, g.documento, g.proveedor].concat(g.lineas.map(l => self._nom(l.codigo, l.producto) + ' ' + l.producto + ' ' + l.codigo)).join(' '), todoAnul);
      }).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const va = self._raiz.querySelector('#crAnul').checked;
      self._raiz.querySelector('#crTb').innerHTML = lista.length ? lista.slice(0, 200).map(function (g) {
        const vivas = g.lineas.filter(l => !l.anulado);
        const tot = vivas.reduce((a, l) => a + l.totalLinea, 0);
        const filasDoc = g.lineas.map(l => l.fila).join(',');
        return '<tr class="doc"><td>' + esc(self._f(g.fecha)) + '</td><td colspan="3">' + esc((g.tipoDoc || 'S/D') + ' ' + (g.documento || '')) + ' · ' + esc(g.proveedor) +
          ' <small>(' + vivas.length + ' línea(s))</small></td><td>' + (tot ? esc(g.moneda) + ' ' + MT.dinero(tot) : '') + '</td><td><div class="cr-acc">' +
          (vivas.length ? '<button class="cr-b" data-doc="' + filasDoc + '">Editar comprobante</button><button class="cr-b rojo" data-anuldoc="' + vivas.map(l => l.fila).join(',') + '">Anular todo</button>' : '') +
          '</div></td></tr>' + g.lineas.filter(l => va || !l.anulado).map(l => '<tr class="' + (l.anulado ? 'anulado' : '') + '"><td></td><td>' + esc(self._nom(l.codigo, l.producto)) + ' <small>(' + esc(l.codigo) + ')</small>' +
            (l.anulado ? '<br><small>' + esc(l.observacion) + '</small>' : '') + '</td><td>' + esc(MT.cant(l.cantidad, l.unidadCompra)) + (l.cantidadStock && l.unidadStock && l.unidadStock !== l.unidadCompra ? '<br><small>= ' + esc(MT.cant(l.cantidadStock, l.unidadStock)) + '</small>' : '') +
            '</td><td>' + (l.precioConIgv ? esc(l.moneda) + ' ' + MT.dinero(l.precioConIgv) : '<small>sin precio</small>') + '</td><td>' + (l.totalLinea ? MT.dinero(l.totalLinea) : '') + '</td><td><div class="cr-acc">' +
            (l.anulado ? '' : '<button class="cr-b" data-lin="' + l.fila + '">Editar</button><button class="cr-b rojo" data-anullin="' + l.fila + '">Anular</button>') + '</div></td></tr>').join('');
      }).join('') : '<tr><td colspan="6" style="text-align:center;color:#8b95a1;padding:14px">Sin ingresos con estos filtros.</td></tr>';
    };
    self._wireFiltros(pintar);
    const prov = (FormAlmacen._datos ? FormAlmacen._datos.proveedores : []).map(p => p.razonSocial);
    self._raiz.querySelector('#crTb').addEventListener('click', function (ev) {
      const b = ev.target.closest('button'); if (!b) return;
      const linea = f => self._d.ingresos.find(x => x.fila === Number(f));
      if (b.dataset.doc) {
        const filas = b.dataset.doc.split(',').map(Number), l0 = linea(filas[0]);
        self._dialogo('Editar comprobante', '<div class="campo"><label>Tipo</label><select id="dTipo"><option>FACTURA</option><option>BOLETA</option></select></div>' +
          '<div class="campo"><label>N° documento</label><input id="dDoc" style="text-transform:uppercase"></div><div class="campo"><label>Fecha</label><input type="date" id="dFecha"></div>' +
          '<div class="campo ancho2"><label>Proveedor</label><input id="dProv" list="crDlProv" style="text-transform:uppercase">' + MT.datalist('crDlProv', prov) + '</div>' +
          '<div class="campo"><label>Moneda</label><select id="dMon"><option value="">(sin cambio)</option><option value="S/">S/</option><option value="$">$</option></select></div>',
          'mtCorrIngresoDoc', function (q) { return { filas: filas, tipoDoc: q('dTipo').value, documento: q('dDoc').value, fecha: q('dFecha').value, razonSocial: q('dProv').value, ruc: l0.ruc, moneda: q('dMon').value }; });
        setTimeout(function () {
          const q = id => document.getElementById(id);
          if (l0.tipoDoc) q('dTipo').value = l0.tipoDoc; q('dDoc').value = l0.documento; q('dFecha').value = l0.fecha; q('dProv').value = l0.proveedor; q('dMon').value = l0.moneda || '';
        }, 0);
      } else if (b.dataset.lin) {
        const l = linea(b.dataset.lin);
        self._dialogo('Editar línea: ' + self._nom(l.codigo, l.producto), '<div class="campo"><label>Cantidad (' + esc((l.unidadCompra || '').toLowerCase()) + ')</label><input type="number" step="any" min="0" id="dCant"></div>' +
          '<div class="campo"><label>P. unit. con IGV</label><input type="number" step="any" min="0" id="dPcon"></div><div class="campo"><label>Total línea</label><input id="dTot" readonly></div>',
          'mtCorrIngresoLinea', function (q) { return { fila: l.fila, cantidad: q('dCant').value, precioConIgv: q('dPcon').value }; },
          'Si bajas la cantidad y esas unidades ya salieron, no se podrá grabar.');
        setTimeout(function () {
          const q = id => document.getElementById(id);
          q('dCant').value = l.cantidad; q('dPcon').value = l.precioConIgv || '';
          const calc = () => { q('dTot').value = MT.dinero((MT.num(q('dCant').value) || 0) * (MT.num(q('dPcon').value) || 0)); };
          q('dCant').addEventListener('input', calc); q('dPcon').addEventListener('input', calc); calc();
        }, 0);
      } else if (b.dataset.anullin || b.dataset.anuldoc) {
        const filas = (b.dataset.anullin || b.dataset.anuldoc).split(',').map(Number);
        self._dialogo(filas.length > 1 ? 'Anular comprobante completo (' + filas.length + ' líneas)' : 'Anular línea: ' + self._nom(linea(filas[0]).codigo, linea(filas[0]).producto), '',
          'mtCorrAnularIngreso', function () { return { filas: filas }; }, 'Las unidades de este ingreso se quitarán del stock. Si ya salieron, no se podrá anular.');
      }
    });
    pintar();
  },

  /* ---------- SALIDAS ---------- */
  _salidas: function () {
    const self = this, c = self._raiz.querySelector('#crCuerpo');
    c.innerHTML = self._filtros() + '<div class="cr-wrap"><table class="cr-t"><colgroup><col style="width:9%"><col><col style="width:11%"><col style="width:20%"><col style="width:14%"><col style="width:140px"></colgroup>' +
      '<thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Entregado a · unidad</th><th>Motivo</th><th></th></tr></thead><tbody id="crTb"></tbody></table></div>';
    const pintar = function () {
      const lista = self._d.salidas.filter(x => self._pasa(x.fecha, [self._nom(x.codigo, x.producto), x.producto, x.codigo, x.entregadoA, x.placa, x.motivo].join(' '), x.anulado))
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.fila - a.fila);
      self._raiz.querySelector('#crTb').innerHTML = lista.length ? lista.slice(0, 300).map(x => '<tr class="' + (x.anulado ? 'anulado' : '') + '"><td>' + esc(self._f(x.fecha)) + '</td><td>' + esc(self._nom(x.codigo, x.producto)) +
        ' <small>(' + esc(x.codigo) + ')</small>' + (x.anulado ? '<br><small>' + esc(x.observacion) + '</small>' : '') + '</td><td>' + esc(MT.cant(x.cantidad)) + '</td><td>' + esc(x.entregadoA) + ' · ' + esc(x.placa) +
        '</td><td>' + esc(x.motivo) + (x.estadoMant && x.estadoMant !== 'NO APLICA' ? '<br><small>' + esc(x.estadoMant) + '</small>' : '') + '</td><td><div class="cr-acc">' +
        (x.anulado ? '' : '<button class="cr-b" data-ed="' + x.fila + '">Editar</button>' + (x.estadoMant === 'ASOCIADO' ? '' : '<button class="cr-b rojo" data-an="' + x.fila + '">Anular</button>')) +
        '</div></td></tr>').join('') : '<tr><td colspan="6" style="text-align:center;color:#8b95a1;padding:14px">Sin salidas con estos filtros.</td></tr>';
    };
    self._wireFiltros(pintar);
    const d = FormAlmacen._datos || {};
    self._raiz.querySelector('#crTb').addEventListener('click', function (ev) {
      const b = ev.target.closest('button'); if (!b) return;
      const x = self._d.salidas.find(s => s.fila === Number(b.dataset.ed || b.dataset.an));
      if (b.dataset.ed) {
        self._dialogo('Editar salida: ' + self._nom(x.codigo, x.producto), '<div class="campo"><label>Cantidad</label><input type="number" step="any" min="0" id="dCant"' + (x.estadoMant === 'ASOCIADO' ? ' disabled' : '') + '></div>' +
          '<div class="campo"><label>Entregado a</label><input id="dEnt" list="crDlPer" style="text-transform:uppercase">' + MT.datalist('crDlPer', d.personal || []) + '</div>' +
          '<div class="campo"><label>Placa / unidad</label>' + MT.campoPlaca('dPlaca', d.placas || []) + '</div>' +
          '<div class="campo"><label>Motivo de salida</label><input id="dMot" style="text-transform:uppercase"></div><div class="campo ancho2"><label>Observación</label><input id="dObs" style="text-transform:uppercase"></div>',
          'mtCorrSalida', function (q) { return { fila: x.fila, cantidad: q('dCant').value, entregadoA: q('dEnt').value, placa: q('dPlaca').value, motivoSalida: q('dMot').value, observacion: q('dObs').value }; },
          x.estadoMant === 'ASOCIADO' ? 'Esta salida ya está asociada a un mantenimiento: no se puede cambiar la cantidad.' : '');
        setTimeout(function () { const q = id => document.getElementById(id); q('dCant').value = x.cantidad; q('dEnt').value = x.entregadoA; q('dPlaca').value = x.placa; q('dMot').value = x.motivo; q('dObs').value = x.observacion; }, 0);
      } else if (b.dataset.an) {
        self._dialogo('Anular salida: ' + self._nom(x.codigo, x.producto) + ' (' + MT.cant(x.cantidad) + ')', '', 'mtCorrAnularSalida', function () { return { fila: x.fila }; }, 'El producto vuelve al stock.');
      }
    });
    pintar();
  },

  /* ---------- PRODUCTOS ---------- */
  _productos: function () {
    const self = this, c = self._raiz.querySelector('#crCuerpo');
    c.innerHTML = '<div class="cr-barra"><div class="campo" style="min-width:260px"><label>Buscar</label><input id="crBuscar" placeholder="Código, producto o marca" style="text-transform:uppercase"></div>' +
      '<div class="campo"><label>Mostrar</label><select id="crEst"><option value="">Todos</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option><option value="ANULADO">Anulados</option><option value="SIN">Sin movimientos</option></select></div></div>' +
      '<div class="cr-aviso">Anular: solo productos sin movimientos (creados por error). Desactivar: deja de salir en los buscadores y en el stock (debe tener stock 0).</div>' +
      '<div class="cr-wrap"><table class="cr-t"><colgroup><col style="width:13%"><col><col style="width:14%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:190px"></colgroup>' +
      '<thead><tr><th>Código</th><th>Producto</th><th>Marca</th><th>Stock</th><th>Movimientos</th><th>Estado</th><th></th></tr></thead><tbody id="crTb"></tbody></table></div>';
    const pintar = function () {
      const q = self._raiz.querySelector('#crBuscar').value.trim().toUpperCase(), e = self._raiz.querySelector('#crEst').value;
      const lista = self._d.productos.filter(p => (!q || (p.codigo + ' ' + p.producto + ' ' + p.marca).indexOf(q) !== -1) && (!e || (e === 'SIN' ? !p.movimientos : p.estado === e)));
      self._raiz.querySelector('#crTb').innerHTML = lista.map(p => '<tr class="' + (p.estado === 'ANULADO' ? 'anulado' : '') + '"><td>' + esc(p.codigo) + '</td><td>' + esc(p.producto) + '</td><td>' + esc(p.marca) +
        '</td><td>' + esc(MT.cant(p.stock)) + '</td><td>' + p.movimientos + '</td><td>' + esc(p.estado) + '</td><td><div class="cr-acc">' +
        (p.estado !== 'ACTIVO' ? '<button class="cr-b" data-p="' + esc(p.codigo) + '" data-a="ACTIVAR">Activar</button>' : '') +
        (p.estado === 'ACTIVO' ? '<button class="cr-b" data-p="' + esc(p.codigo) + '" data-a="DESACTIVAR">Desactivar</button>' : '') +
        (!p.movimientos && p.estado !== 'ANULADO' ? '<button class="cr-b rojo" data-p="' + esc(p.codigo) + '" data-a="ANULAR">Anular</button>' : '') + '</div></td></tr>').join('') ||
        '<tr><td colspan="7" style="text-align:center;color:#8b95a1;padding:14px">Sin productos.</td></tr>';
    };
    self._raiz.querySelector('#crBuscar').addEventListener('input', pintar);
    self._raiz.querySelector('#crEst').addEventListener('change', pintar);
    self._raiz.querySelector('#crTb').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-p]'); if (!b) return;
      const p = self._d.productos.find(x => x.codigo === b.dataset.p);
      self._dialogo(b.dataset.a.charAt(0) + b.dataset.a.slice(1).toLowerCase() + ' producto: ' + p.producto, '', 'mtCorrProducto', function () { return { codigo: p.codigo, accion: b.dataset.a }; });
    });
    pintar();
  },

  /* ---------- REPARACIONES ---------- */
  _reparaciones: function () {
    const self = this, c = self._raiz.querySelector('#crCuerpo');
    c.innerHTML = self._filtros() + '<div class="cr-wrap"><table class="cr-t"><colgroup><col style="width:9%"><col><col style="width:8%"><col style="width:13%"><col style="width:16%"><col style="width:12%"><col style="width:140px"></colgroup>' +
      '<thead><tr><th>Fecha</th><th>Pieza</th><th>Cant.</th><th>Origen</th><th>Taller · guía</th><th>Estado</th><th></th></tr></thead><tbody id="crTb"></tbody></table></div>';
    const pintar = function () {
      const lista = self._d.reparaciones.filter(x => self._pasa(x.fecha, [x.producto, x.codigo, x.placa, x.taller, x.guia, x.id].join(' '), x.estado === 'ANULADO'))
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      self._raiz.querySelector('#crTb').innerHTML = lista.length ? lista.map(x => '<tr class="' + (x.estado === 'ANULADO' ? 'anulado' : '') + '"><td>' + esc(self._f(x.fecha)) + '</td><td>' + esc(x.producto) +
        ' <small>(' + esc(x.id) + ')</small></td><td>' + esc(MT.cant(x.cantidad)) + '</td><td>' + esc(x.origen) + (x.placa ? ' · ' + esc(x.placa) : '') + '</td><td>' + esc(x.taller) + (x.guia ? ' · ' + esc(x.guia) : '') +
        '</td><td>' + esc(x.estado) + '</td><td><div class="cr-acc">' + (x.estado === 'ANULADO' ? '' : '<button class="cr-b" data-ed="' + x.fila + '">Editar</button><button class="cr-b rojo" data-an="' + x.fila + '">Anular</button>') +
        '</div></td></tr>').join('') : '<tr><td colspan="7" style="text-align:center;color:#8b95a1;padding:14px">Sin reparaciones registradas.</td></tr>';
    };
    self._wireFiltros(pintar);
    self._raiz.querySelector('#crTb').addEventListener('click', function (ev) {
      const b = ev.target.closest('button'); if (!b) return;
      const x = self._d.reparaciones.find(r => r.fila === Number(b.dataset.ed || b.dataset.an));
      if (b.dataset.ed) {
        self._dialogo('Editar reparación: ' + x.producto, '<div class="campo"><label>Taller</label><input id="dTal" style="text-transform:uppercase"></div><div class="campo"><label>Guía</label><input id="dGuia" style="text-transform:uppercase"></div>' +
          '<div class="campo"><label>Fecha estimada</label><input type="date" id="dFe"></div><div class="campo"><label>Placa origen</label><input id="dPla" style="text-transform:uppercase"></div>' +
          '<div class="campo"><label>Costo</label><input type="number" step="any" min="0" id="dCos"></div><div class="campo"><label>Moneda</label><select id="dMon"><option value=""></option><option>S/</option><option>$</option></select></div>' +
          '<div class="campo"><label>Documento</label><input id="dDoc" style="text-transform:uppercase"></div><div class="campo ancho2"><label>Observación</label><input id="dObs" style="text-transform:uppercase"></div>',
          'mtCorrReparacion', function (q) { return { fila: x.fila, taller: q('dTal').value, guia: q('dGuia').value, fechaEstimada: q('dFe').value, placa: q('dPla').value, costo: q('dCos').value, moneda: q('dMon').value, documento: q('dDoc').value, observacion: q('dObs').value }; });
        setTimeout(function () { const q = id => document.getElementById(id); q('dTal').value = x.taller; q('dGuia').value = x.guia; q('dFe').value = x.fechaEstimada; q('dPla').value = x.placa; q('dCos').value = x.costo || ''; q('dMon').value = x.moneda; q('dDoc').value = x.documento; q('dObs').value = x.observacion; }, 0);
      } else if (b.dataset.an) {
        self._dialogo('Anular reparación: ' + x.producto, '', 'mtCorrAnularReparacion', function () { return { fila: x.fila }; }, 'Si la pieza salió del almacén al taller o regresó al stock, ese movimiento también se revierte.');
      }
    });
    pintar();
  },

  /* ---------- MANTENIMIENTOS ---------- */
  _mantenimientos: function () {
    const self = this, c = self._raiz.querySelector('#crCuerpo');
    c.innerHTML = self._filtros() + '<div class="cr-wrap"><table class="cr-t"><colgroup><col style="width:9%"><col><col style="width:9%"><col style="width:14%"><col style="width:14%"><col style="width:9%"><col style="width:9%"><col style="width:140px"></colgroup>' +
      '<thead><tr><th>Fecha</th><th>Reparación</th><th>Placa</th><th>Tipo · técnico</th><th>Repuesto</th><th>Km</th><th>Costo</th><th></th></tr></thead><tbody id="crTb"></tbody></table></div>';
    const pintar = function () {
      const lista = self._d.mantenimientos.filter(x => self._pasa(x.fechaInicial, [x.nombre, x.placa, x.tipo, x.tecnico, x.repuesto, x.lugar].join(' '), x.anulado))
        .sort((a, b) => String(b.fechaInicial).localeCompare(String(a.fechaInicial)) || b.fila - a.fila);
      self._raiz.querySelector('#crTb').innerHTML = lista.length ? lista.slice(0, 300).map(x => '<tr class="' + (x.anulado ? 'anulado' : '') + '"><td>' + esc(self._f(x.fechaInicial)) + '</td><td>' + esc(x.nombre) +
        (x.anulado ? '<br><small>' + esc(x.observacion) + '</small>' : '') + '</td><td>' + esc(x.placa) + '</td><td>' + esc(x.tipo) + '<br><small>' + esc(x.tecnico) + '</small></td><td>' + esc(x.repuesto) +
        '</td><td>' + (x.km || '') + '</td><td>' + (x.costo ? esc(x.moneda) + ' ' + MT.dinero(x.costo) : '') + '</td><td><div class="cr-acc">' +
        (x.anulado ? '' : '<button class="cr-b" data-ed="' + x.fila + '">Editar</button><button class="cr-b rojo" data-an="' + x.fila + '">Anular</button>') + '</div></td></tr>').join('')
        : '<tr><td colspan="8" style="text-align:center;color:#8b95a1;padding:14px">Sin mantenimientos con estos filtros.</td></tr>';
    };
    self._wireFiltros(pintar);
    self._raiz.querySelector('#crTb').addEventListener('click', function (ev) {
      const b = ev.target.closest('button'); if (!b) return;
      const x = self._d.mantenimientos.find(m => m.fila === Number(b.dataset.ed || b.dataset.an));
      if (b.dataset.ed) {
        self._dialogo('Editar mantenimiento: ' + x.nombre,
          '<div class="campo ancho2"><label>Nombre de la reparación</label><input id="dNom" style="text-transform:uppercase"></div><div class="campo"><label>Tipo</label><input id="dTipo" style="text-transform:uppercase"></div>' +
          '<div class="campo"><label>Técnico / taller</label><input id="dTec" style="text-transform:uppercase"></div><div class="campo"><label>Placa</label><input id="dPla" style="text-transform:uppercase"></div><div class="campo"><label>Kilometraje</label><input type="number" step="any" id="dKm"></div>' +
          '<div class="campo"><label>Fecha inicial</label><input type="date" id="dFi"></div><div class="campo"><label>Hora inicial</label><input type="time" step="1" id="dHi"></div><div class="campo"><label>Lugar</label><input id="dLug" style="text-transform:uppercase"></div>' +
          '<div class="campo"><label>Fecha final</label><input type="date" id="dFf"></div><div class="campo"><label>Hora final</label><input type="time" step="1" id="dHf"></div><div class="campo"><label>Sistema reparado</label><input id="dSis" style="text-transform:uppercase"></div>' +
          '<div class="campo"><label>Método</label><input id="dMet" style="text-transform:uppercase"></div><div class="campo"><label>Moneda</label><select id="dMon"><option value="-">-</option><option>S/</option><option>$</option></select></div><div class="campo"><label>N° documento</label><input id="dDoc" style="text-transform:uppercase"></div>' +
          '<div class="campo"><label>Cantidad (costo)</label><input type="number" step="any" min="0" id="dCan"></div><div class="campo"><label>Precio unitario</label><input type="number" step="any" min="0" id="dPre"></div><div class="campo"><label>Observación</label><input id="dObs" style="text-transform:uppercase"></div>',
          'mtCorrMantenimiento', function (q) {
            return { fila: x.fila, nombre: q('dNom').value, tipo: q('dTipo').value, tecnico: q('dTec').value, placa: q('dPla').value, km: q('dKm').value ? q('dKm').value : undefined, lugar: q('dLug').value,
              sistema: q('dSis').value, metodo: q('dMet').value, fechaInicial: q('dFi').value, horaInicial: q('dHi').value, fechaFinal: q('dFf').value, horaFinal: q('dHf').value,
              moneda: q('dMon').value, cantidad: q('dCan').value, precio: q('dPre').value, documento: q('dDoc').value, observacion: q('dObs').value };
          });
        setTimeout(function () {
          const q = id => document.getElementById(id);
          q('dNom').value = x.nombre; q('dTipo').value = x.tipo; q('dTec').value = x.tecnico; q('dPla').value = x.placa; q('dKm').value = x.km || ''; q('dLug').value = x.lugar;
          q('dFi').value = x.fechaInicial; q('dHi').value = String(x.horaInicial).slice(0, 8); q('dFf').value = x.fechaFinal; q('dHf').value = String(x.horaFinal).slice(0, 8);
          q('dSis').value = x.sistema; q('dMet').value = x.metodo; q('dMon').value = x.moneda || '-'; q('dDoc').value = x.documento; q('dCan').value = x.cantidad; q('dPre').value = x.precio; q('dObs').value = x.observacion;
        }, 0);
      } else if (b.dataset.an) {
        self._dialogo('Anular mantenimiento: ' + x.nombre + ' (' + x.placa + ')', '', 'mtCorrAnularMantenimiento', function () { return { fila: x.fila }; },
          'Deja de contar en costos y en el último km de la placa. Si usó un repuesto del almacén, esa salida vuelve a quedar PENDIENTE.');
      }
    });
    pintar();
  }
};
