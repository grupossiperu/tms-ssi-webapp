/**
 * forms/estadoResultados.js
 * -------------------------------------------------------------------------
 * Pestaña "Estado de resultados" del módulo Resultados (usa la sesión ya
 * iniciada). Últimos 12 meses en columnas, con filtros por cliente, placa,
 * conductor y destino, gráfico de tendencia y rentabilidad agrupada por
 * unidad / cliente / conductor / destino. Exporta a Excel (CSV).
 *
 * Ingresos: servicios CULMINADOS y FALSO FLETE (tarifa 1 + tarifa 2) por
 * fecha del servicio, más sobrecostos. Los dólares se pasan a soles con el
 * tipo de cambio de la fecha (o el más cercano anterior).
 * Costos: gastos de viaje, combustible (inicial y recargas) y depósitos
 * adicionales del CONSOLIDADO; mantenimiento (costo de taller de
 * MT_MANTENIMIENTO, solo se reparte por placa).
 * Backend: resultadosEstado({token}).
 * -------------------------------------------------------------------------
 */
const FormEstadoResultados = {

  _datos: null,
  _token: null,
  _grafico: null,

  LINEAS: [
    { k: 'tit', t: 'INGRESOS' },
    { k: 'fletes', t: 'Fletes (tarifa base)' },
    { k: 'adicDestinos', t: 'Destinos adicionales' },
    { k: 'sobrecostos', t: 'Sobrecostos' },
    { k: 'ingresos', t: 'Total ingresos', total: true },
    { k: 'tit', t: 'COSTOS DE VIAJE' },
    { k: 'viatico', t: 'Viáticos' },
    { k: 'peaje', t: 'Peajes' },
    { k: 'cochera', t: 'Cochera' },
    { k: 'llanta', t: 'Llantas' },
    { k: 'lavadoBalanza', t: 'Lavado y balanza' },
    { k: 'otros', t: 'Otros gastos' },
    { k: 'bonos', t: 'Bonos (bono + dominical + feriado)' },
    { k: 'adicionales', t: 'Depósitos adicionales' },
    { k: 'tit', t: 'COMBUSTIBLE' },
    { k: 'petroleoInicial', t: 'Petróleo inicial (tracto + genset)' },
    { k: 'recargas', t: 'Recargas en ruta' },
    { k: 'tit', t: 'MANTENIMIENTO' },
    { k: 'mantenimiento', t: 'Talleres y servicios' },
    { k: 'costos', t: 'Total costos', total: true },
    { k: 'utilidad', t: 'UTILIDAD BRUTA', total: true, fuerte: true },
    { k: 'margen', t: 'Margen %', pct: true },
    { k: 'tit', t: 'INDICADORES' },
    { k: 'viajes', t: 'Viajes (culminados + falsos fletes)', cant: true },
    { k: 'sinCons', t: 'Viajes sin consolidado (costos pendientes)', cant: true },
    { k: 'utilViaje', t: 'Utilidad por viaje' },
    { k: 'facturado', t: 'Ya facturado' },
    { k: 'porFacturar', t: 'Por facturar' }
  ],
  COSTOS: ['viatico', 'peaje', 'cochera', 'llanta', 'lavadoBalanza', 'otros', 'bonos', 'adicionales', 'petroleoInicial', 'recargas', 'mantenimiento'],
  MESES: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'],

  mostrar: async function (cont, token) {
    const self = this;
    if (cont.dataset.listo === '1' && self._datos) return;
    self._token = token;
    cont.innerHTML = '<div class="res-vacio">Cargando estado de resultados…</div>';
    const r = await llamarBackend('resultadosEstado', { token: token });
    if (!r || !r.ok) { cont.innerHTML = '<div class="res-vacio">' + esc((r && r.mensaje) || 'No se pudo cargar.') + '</div>'; return; }
    self._datos = r;
    cont.dataset.listo = '1';
    self._armar(cont);
  },

  /* ---------------- utilidades ---------------- */
  _tcFechas: null,
  _tc: function (fecha) {
    const tc = this._datos.tc || {};
    if (!this._tcFechas) this._tcFechas = Object.keys(tc).sort();
    const f = this._tcFechas;
    if (!f.length) return 0;
    if (tc[fecha]) return tc[fecha];
    let ant = null;
    for (let i = 0; i < f.length; i++) { if (f[i] <= fecha) ant = f[i]; else break; }
    return tc[ant || f[0]];
  },
  _soles: function (monto, dolares, fecha) { return dolares ? monto * this._tc(fecha || '') : monto; },
  _mes: function (fecha) { return String(fecha || '').slice(0, 7); },
  _fmt: function (n) { return (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); },
  _ultimos12: function (hasta) {
    const p = hasta.split('-').map(Number);
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(p[0], p[1] - 1 - i, 1);
      out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return out;
  },
  _vacio: function () {
    const o = {};
    this.LINEAS.forEach(function (l) { if (l.k !== 'tit') o[l.k] = 0; });
    return o;
  },
  _cerrar: function (o) {
    const self = this;
    o.ingresos = o.fletes + o.adicDestinos + o.sobrecostos;
    o.costos = self.COSTOS.reduce(function (a, k) { return a + o[k]; }, 0);
    o.utilidad = o.ingresos - o.costos;
    o.margen = o.ingresos ? o.utilidad / o.ingresos * 100 : 0;
    o.utilViaje = o.viajes ? o.utilidad / o.viajes : 0;
    return o;
  },

  /** Suma movimientos al acumulador según la clave de agrupación (mes, placa, cliente...). */
  _acumular: function (f, claveDe, filtroMant) {
    const self = this;
    const d = self._datos;
    const acc = {};
    const tomar = function (k) { if (!acc[k]) acc[k] = self._vacio(); return acc[k]; };
    d.servicios.forEach(function (s) {
      if (!f.servicio(s)) return;
      const k = claveDe(s, 'servicio');
      if (k === null) return;
      const o = tomar(k);
      o.viajes += 1;
      o.fletes += self._soles(s.tarifa1, s.dolares, s.fecha);
      o.adicDestinos += self._soles(s.tarifa2, s.dolares, s.fecha);
      const venta = self._soles(s.tarifa1 + s.tarifa2, s.dolares, s.fecha);
      if (s.facturado) o.facturado += venta; else o.porFacturar += venta;
      if (!s.costos) { o.sinCons += 1; return; }
      ['viatico', 'peaje', 'cochera', 'llanta', 'lavadoBalanza', 'otros', 'bonos', 'adicionales', 'petroleoInicial', 'recargas']
        .forEach(function (c) { o[c] += Number(s.costos[c]) || 0; });
    });
    d.sobrecostos.forEach(function (x) {
      if (!f.sobrecosto(x)) return;
      const k = claveDe(x, 'sobrecosto');
      if (k === null) return;
      tomar(k).sobrecostos += self._soles(x.total, x.dolares, x.fecha);
    });
    if (filtroMant) {
      d.mantenimiento.forEach(function (m) {
        if (!f.mant(m)) return;
        const k = claveDe(m, 'mant');
        if (k === null) return;
        tomar(k).mantenimiento += self._soles(m.costo, m.dolares, m.fecha);
      });
    }
    Object.keys(acc).forEach(function (k) { self._cerrar(acc[k]); });
    return acc;
  },

  /* ---------------- pantalla ---------------- */
  _armar: function (cont) {
    const self = this;
    const d = self._datos;
    const hoy = new Date();
    const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
    const meses = Array.from(new Set(d.servicios.map(s => self._mes(s.fecha)).concat([mesActual]).filter(Boolean))).sort().reverse();
    const nombreMes = function (m) { const p = m.split('-'); return self.MESES[Number(p[1]) - 1] + ' ' + p[0]; };

    cont.innerHTML = `
      <style>
        .res-tabs{ display:flex; gap:6px; margin-bottom:12px; }
        .er-barra{ display:flex; flex-wrap:wrap; gap:10px; align-items:end; background:#fff; border:1px solid #dde4ec; border-radius:12px; padding:10px 14px; margin-bottom:14px; }
        .er-barra .campo{ margin:0; min-width:150px; }
        .er-tabla-wrap{ background:#fff; border:1px solid #dde4ec; border-radius:12px; overflow:auto; margin-bottom:14px; }
        .er-tabla{ width:100%; border-collapse:collapse; font-size:.76rem; font-variant-numeric:tabular-nums; }
        .er-tabla th{ background:#1c3a5e; color:#fff; padding:7px 6px; text-align:right; font-size:.72rem; position:sticky; top:0; white-space:nowrap; }
        .er-tabla th:first-child{ text-align:left; position:sticky; left:0; z-index:2; min-width:230px; }
        .er-tabla td{ padding:5px 6px; text-align:right; border-bottom:1px solid #eef2f6; white-space:nowrap; }
        .er-tabla td:first-child{ text-align:left; position:sticky; left:0; background:#fff; white-space:normal; }
        .er-tabla tr.tit td{ background:#eef3f8 !important; font-weight:800; color:#1c3a5e; font-size:.7rem; letter-spacing:.5px; }
        .er-tabla tr.tot td{ font-weight:800; border-top:1.5px solid #c7ced8; }
        .er-tabla tr.fuerte td{ background:#dcfce7 !important; color:#166534; font-size:.82rem; }
        .er-tabla tr.fuerte td.neg{ color:#b91c1c; }
        .er-tabla td.col-total{ background:#f8fafc; font-weight:700; }
        .er-tabla td.neg{ color:#b91c1c; }
        .er-nota{ font-size:.76rem; color:#64748b; margin:-6px 0 12px; }
        .er-grid{ display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:12px; }
        @media (max-width: 1100px){ .er-grid{ grid-template-columns:1fr; } }
      </style>
      <div class="er-barra">
        <div class="campo"><label>Hasta el mes</label><select id="erHasta">${meses.map(m => '<option value="' + m + '">' + nombreMes(m) + '</option>').join('')}</select></div>
        <div class="campo"><label>Cliente</label><div id="erCliente"></div></div>
        <div class="campo"><label>Placa</label><div id="erPlaca"></div></div>
        <div class="campo"><label>Conductor</label><div id="erConductor"></div></div>
        <div class="campo"><label>Destino</label><div id="erDestino"></div></div>
        <button class="boton-secundario" type="button" id="erLimpiar">Borrar filtros</button>
        <button class="boton-secundario" type="button" id="erRecargar">Actualizar</button>
        <button class="boton-primario" type="button" id="erExportar">Exportar a Excel</button>
      </div>
      <div class="res-kpis" id="erKpis"></div>
      <div class="er-nota" id="erNota"></div>
      <div class="er-tabla-wrap"><table class="er-tabla" id="erTabla"></table></div>
      <div class="er-grid">
        <div class="res-card"><h3>Ingresos, costos y utilidad por mes (S/)</h3><div class="res-canvas"><canvas id="erGrafico"></canvas></div></div>
        <div class="res-card">
          <h3 style="justify-content:space-between">Rentabilidad por
            <select id="erAgrupar" style="margin-left:auto;padding:4px 8px;border-radius:7px;border:1px solid #c7ced8;font-weight:700;color:#1c3a5e">
              <option value="placa">Unidad (placa)</option><option value="cliente">Cliente</option>
              <option value="conductor">Conductor</option><option value="destino">Destino</option>
            </select>
            <select id="erPeriodoGrupo" style="padding:4px 8px;border-radius:7px;border:1px solid #c7ced8"></select>
          </h3>
          <div style="max-height:300px;overflow:auto"><table class="res-tabla" id="erGrupos"></table></div>
        </div>
      </div>`;

    const unicos = function (campo) {
      return Array.from(new Set(d.servicios.map(s => s[campo]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    };
    const placas = Array.from(new Set(unicos('placa').concat(d.mantenimiento.map(m => m.placa).filter(Boolean)))).sort();
    const repintar = function () { self._pintar(cont); };
    self._ms = {
      cliente: crearMultiSelect(cont.querySelector('#erCliente'), { onChange: repintar }),
      placa: crearMultiSelect(cont.querySelector('#erPlaca'), { textoTodas: 'Todas', textoTodos: 'Todas', onChange: repintar }),
      conductor: crearMultiSelect(cont.querySelector('#erConductor'), { onChange: repintar }),
      destino: crearMultiSelect(cont.querySelector('#erDestino'), { onChange: repintar })
    };
    self._ms.cliente.setOpciones(unicos('cliente'));
    self._ms.placa.setOpciones(placas);
    self._ms.conductor.setOpciones(unicos('conductor'));
    self._ms.destino.setOpciones(unicos('destino'));

    cont.querySelector('#erHasta').addEventListener('change', repintar);
    cont.querySelector('#erAgrupar').addEventListener('change', function () { self._pintarGrupos(cont); });
    cont.querySelector('#erPeriodoGrupo').addEventListener('change', function () { self._pintarGrupos(cont); });
    cont.querySelector('#erLimpiar').addEventListener('click', function () {
      Object.keys(self._ms).forEach(function (k) { self._ms[k].limpiar(); });
      repintar();
    });
    cont.querySelector('#erRecargar').addEventListener('click', async function () {
      cont.dataset.listo = '';
      self._tcFechas = null;
      await self.mostrar(cont, self._token);
    });
    cont.querySelector('#erExportar').addEventListener('click', function () { self._exportar(); });
    self._pintar(cont);
  },

  _filtros: function () {
    const ms = this._ms;
    const conFiltroNoPlaca = ms.cliente.valores().length || ms.conductor.valores().length || ms.destino.valores().length;
    return {
      servicio: function (s) {
        return ms.cliente.cumple(s.cliente) && ms.placa.cumple(s.placa) && ms.conductor.cumple(s.conductor) && ms.destino.cumple(s.destino);
      },
      sobrecosto: function (x) {
        return ms.cliente.cumple(x.cliente) && ms.placa.cumple(x.placa) && ms.conductor.cumple(x.conductor) && !ms.destino.valores().length;
      },
      mant: function (m) { return ms.placa.cumple(m.placa); },
      // El mantenimiento solo se puede repartir por placa.
      incluyeMant: !conFiltroNoPlaca
    };
  },

  _pintar: function (cont) {
    const self = this;
    const f = self._filtros();
    const hasta = cont.querySelector('#erHasta').value;
    const meses = self._ultimos12(hasta);
    self._meses = meses;
    const porMes = self._acumular(f, function (x) { const m = self._mes(x.fecha); return meses.indexOf(m) === -1 ? null : m; }, f.incluyeMant);
    const total = self._vacio();
    meses.forEach(function (m) {
      const o = porMes[m];
      if (!o) return;
      Object.keys(total).forEach(function (k) { total[k] += o[k] || 0; });
    });
    self._cerrar(total);
    self._porMes = porMes; self._total = total;

    // Tabla
    const nombre = function (m) { const p = m.split('-'); return self.MESES[Number(p[1]) - 1] + ' ' + p[0].slice(2); };
    const celda = function (l, o) {
      const v = o ? o[l.k] : 0;
      if (l.pct) return '<td class="' + (v < 0 ? 'neg' : '') + '">' + (o && o.ingresos ? v.toFixed(1) + '%' : '-') + '</td>';
      if (l.cant) return '<td>' + (v || '-') + '</td>';
      return '<td class="' + (v < 0 ? 'neg' : '') + '">' + (v ? self._fmt(v) : '-') + '</td>';
    };
    let h = '<thead><tr><th>Concepto (S/)</th>' + meses.map(m => '<th>' + nombre(m) + '</th>').join('') + '<th>Total 12 meses</th></tr></thead><tbody>';
    self.LINEAS.forEach(function (l) {
      if (l.k === 'tit') { h += '<tr class="tit"><td colspan="' + (meses.length + 2) + '">' + l.t + '</td></tr>'; return; }
      if (l.k === 'mantenimiento' && !f.incluyeMant) { h += '<tr><td>' + l.t + '</td><td colspan="' + (meses.length + 1) + '" style="text-align:center;color:#94a3b8">No aplica con filtro de cliente, conductor o destino</td></tr>'; return; }
      h += '<tr class="' + (l.total ? 'tot ' : '') + (l.fuerte ? 'fuerte' : '') + '"><td>' + l.t + '</td>' +
        meses.map(m => celda(l, porMes[m])).join('') + celda(l, total).replace('<td class="', '<td class="col-total ') + '</tr>';
    });
    cont.querySelector('#erTabla').innerHTML = h + '</tbody>';

    // KPIs: mes elegido vs mes anterior
    const mA = porMes[hasta] ? porMes[hasta] : self._cerrar(self._vacio());
    const mP = porMes[meses[10]] ? porMes[meses[10]] : self._cerrar(self._vacio());
    const delta = function (a, b, inv) {
      if (!b) return '<div class="k-delta igual">sin datos del mes anterior</div>';
      const p = (a - b) / Math.abs(b) * 100;
      const sube = p > 0.5, baja = p < -0.5;
      const bueno = inv ? baja : sube;
      return '<div class="k-delta ' + (sube || baja ? (bueno ? 'sube' : 'baja') : 'igual') + '">' + (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + Math.abs(p).toFixed(1) + '% vs ' + nombre(meses[10]) + '</div>';
    };
    cont.querySelector('#erKpis').innerHTML =
      '<div class="res-kpi k-verde"><div class="k-tit">Ingresos ' + nombre(hasta) + '</div><div class="k-val">S/ ' + self._fmt(mA.ingresos) + '</div>' + delta(mA.ingresos, mP.ingresos) + '</div>' +
      '<div class="res-kpi k-rojo"><div class="k-tit">Costos ' + nombre(hasta) + '</div><div class="k-val">S/ ' + self._fmt(mA.costos) + '</div>' + delta(mA.costos, mP.costos, true) + '</div>' +
      '<div class="res-kpi k-morado"><div class="k-tit">Utilidad bruta</div><div class="k-val">S/ ' + self._fmt(mA.utilidad) + '</div>' + delta(mA.utilidad, mP.utilidad) + '</div>' +
      '<div class="res-kpi k-naranja"><div class="k-tit">Margen</div><div class="k-val">' + (mA.ingresos ? mA.margen.toFixed(1) : '0.0') + '%</div><div class="k-sub">mes anterior ' + (mP.ingresos ? mP.margen.toFixed(1) : '0.0') + '%</div></div>' +
      '<div class="res-kpi"><div class="k-tit">Viajes</div><div class="k-val">' + mA.viajes + '</div>' + delta(mA.viajes, mP.viajes) + '</div>' +
      '<div class="res-kpi k-cian"><div class="k-tit">Por facturar (12 meses)</div><div class="k-val">S/ ' + self._fmt(total.porFacturar) + '</div><div class="k-sub">' + total.sinCons + ' viaje(s) sin consolidado</div></div>';
    cont.querySelector('#erNota').textContent = 'Ingresos por fecha del servicio (culminados y falsos fletes); dólares convertidos con el tipo de cambio de cada fecha. ' +
      'Los costos salen del consolidado: los viajes sin consolidado suman ingreso pero aún no costo.' +
      (f.incluyeMant ? '' : ' El mantenimiento no se incluye porque hay filtro de cliente, conductor o destino.');

    // Gráfico
    if (window.Chart) {
      if (self._grafico) { try { self._grafico.destroy(); } catch (e) { /* no-op */ } }
      const v = function (k) { return meses.map(m => porMes[m] ? Math.round(porMes[m][k]) : 0); };
      self._grafico = new Chart(cont.querySelector('#erGrafico'), {
        data: {
          labels: meses.map(nombre),
          datasets: [
            { type: 'bar', label: 'Ingresos', data: v('ingresos'), backgroundColor: '#1f9d55' },
            { type: 'bar', label: 'Costos', data: v('costos'), backgroundColor: '#d33a3a' },
            { type: 'line', label: 'Utilidad', data: v('utilidad'), borderColor: '#1c3a5e', backgroundColor: '#1c3a5e', tension: .25 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { ticks: { callback: x => 'S/ ' + Number(x).toLocaleString('es-PE') } } } }
      });
    }

    // Selector de período para la rentabilidad agrupada
    const sel = cont.querySelector('#erPeriodoGrupo');
    const actual = sel.value;
    sel.innerHTML = '<option value="12">12 meses</option>' + meses.slice().reverse().map(m => '<option value="' + m + '">' + nombre(m) + '</option>').join('');
    if (actual && (actual === '12' || meses.indexOf(actual) !== -1)) sel.value = actual;
    self._pintarGrupos(cont);
  },

  _pintarGrupos: function (cont) {
    const self = this;
    const f = self._filtros();
    const campo = cont.querySelector('#erAgrupar').value;
    const per = cont.querySelector('#erPeriodoGrupo').value;
    const meses = per === '12' ? self._meses : [per];
    const enPeriodo = function (x) { return meses.indexOf(self._mes(x.fecha)) !== -1; };
    const incluyeMant = campo === 'placa' && f.incluyeMant;
    const grupos = self._acumular(f, function (x, tipo) {
      if (!enPeriodo(x)) return null;
      if (tipo === 'mant') return campo === 'placa' ? (x.placa || 'SIN PLACA') : null;
      if (tipo === 'sobrecosto' && campo === 'destino') return null;
      return x[campo] || 'SIN DATO';
    }, incluyeMant);
    const filas = Object.keys(grupos).map(k => Object.assign({ nombre: k }, grupos[k])).sort((a, b) => b.utilidad - a.utilidad);
    const combustible = function (o) { return o.petroleoInicial + o.recargas; };
    const viaje = function (o) { return o.costos - combustible(o) - o.mantenimiento; };
    cont.querySelector('#erGrupos').innerHTML = '<thead><tr><th>' + ({ placa: 'Placa', cliente: 'Cliente', conductor: 'Conductor', destino: 'Destino' })[campo] +
      '</th><th>Viajes</th><th>Ingresos</th><th>Gastos viaje</th><th>Combustible</th>' + (incluyeMant ? '<th>Mantenim.</th>' : '') +
      '<th>Utilidad</th><th>Margen</th><th>Util./viaje</th></tr></thead><tbody>' +
      (filas.length ? filas.map(o => '<tr><td><b>' + esc(o.nombre) + '</b></td><td>' + o.viajes + '</td><td>' + self._fmt(o.ingresos) + '</td><td>' + self._fmt(viaje(o)) +
        '</td><td>' + self._fmt(combustible(o)) + '</td>' + (incluyeMant ? '<td>' + self._fmt(o.mantenimiento) + '</td>' : '') +
        '<td style="font-weight:800;color:' + (o.utilidad < 0 ? '#b91c1c' : '#166534') + '">' + self._fmt(o.utilidad) + '</td><td>' + (o.ingresos ? o.margen.toFixed(1) + '%' : '-') +
        '</td><td>' + (o.viajes ? self._fmt(o.utilViaje) : '-') + '</td></tr>').join('')
        : '<tr><td colspan="9" class="res-vacio">Sin datos en el período.</td></tr>') + '</tbody>';
  },

  _exportar: function () {
    const self = this;
    if (!self._meses) return;
    const sep = ';';
    const n = function (v) { return (Math.round((Number(v) || 0) * 100) / 100).toString().replace('.', ','); };
    let csv = 'Concepto (S/)' + sep + self._meses.join(sep) + sep + 'Total 12 meses\n';
    self.LINEAS.forEach(function (l) {
      if (l.k === 'tit') { csv += l.t + '\n'; return; }
      csv += '"' + l.t + '"' + sep + self._meses.map(m => n(self._porMes[m] ? self._porMes[m][l.k] : 0)).join(sep) + sep + n(self._total[l.k]) + '\n';
    });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Estado_de_resultados_' + self._meses[11] + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }
};
