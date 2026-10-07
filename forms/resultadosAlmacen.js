/**
 * forms/resultadosAlmacen.js
 * -------------------------------------------------------------------------
 * Resultados > pestaña "Almacén y mantenimiento".
 *  - Inventario: valor, bajo mínimo, por vencer, piezas en reparación.
 *  - Compras y consumo: valorizados al precio del catálogo (S/), consumo
 *    por placa y top productos.
 *  - Mantenimiento: costo del período vs período anterior, preventivo /
 *    correctivo, costo por placa y costo por km recorrido.
 *  - Fallas: pendientes vs solucionadas, sistemas y placas con más fallas.
 * Backend: resultadosAlmacen({token}).
 * -------------------------------------------------------------------------
 */
const FormResultadosAlmacen = {
  _datos: null,
  _graficos: {},

  mostrar: async function (cont, token) {
    const self = this;
    if (!cont.dataset.listo) {
      cont.dataset.listo = '1';
      cont.innerHTML = `
        <style>
          .ra-sec { font-size:.8rem; font-weight:800; color:#1c3a5e; text-transform:uppercase; letter-spacing:.03em; margin:16px 0 8px; }
          .ra-tabla { width:100%; border-collapse:collapse; font-size:.78rem; table-layout:fixed; }
          .ra-tabla th { background:#f1f5f9; color:#475569; text-align:left; padding:6px 8px; font-size:.72rem; }
          .ra-tabla td { padding:6px 8px; border-bottom:1px solid #eef2f6; overflow-wrap:anywhere; }
          .ra-rojo { color:#b91c1c; font-weight:700; } .ra-ambar { color:#b45309; font-weight:700; }
          .ra-scroll { max-height:260px; overflow:auto; }
        </style>
        <div class="res-barra">
          <div class="campo"><label>Período</label>
            <select id="raPeriodo">
              <option value="mes">Este mes</option>
              <option value="mesAnt">Mes anterior</option>
              <option value="3m" selected>Últimos 3 meses</option>
              <option value="anio">Este año</option>
              <option value="todo">Todo el historial</option>
            </select></div>
          <div class="campo"><label>Placa</label><select id="raPlaca"><option value="">Todas</option></select></div>
          <button class="boton-secundario" id="raActualizar" type="button">Actualizar</button>
          <div class="res-actualizado"><span id="raEstado">Cargando…</span></div>
        </div>
        <div class="ra-sec">Inventario (hoy)</div>
        <div class="res-kpis" id="raKpiInv"></div>
        <div class="ra-sec">Compras, consumo y mantenimiento del período</div>
        <div class="res-kpis" id="raKpiPer"></div>
        <div class="res-graficos">
          <div class="res-card ancho2"><h3>Costo de mantenimiento por mes (S/)</h3><div class="res-canvas"><canvas id="raMes"></canvas></div></div>
          <div class="res-card"><h3>Preventivo vs correctivo (S/)</h3><div class="res-canvas"><canvas id="raTipo"></canvas></div></div>
          <div class="res-card"><h3>Costo de mantenimiento por placa (S/)</h3><div class="res-canvas"><canvas id="raPlacaCosto"></canvas></div></div>
          <div class="res-card"><h3>Costo de mantenimiento por km (S/ por km)</h3><div class="res-canvas"><canvas id="raPorKm"></canvas></div></div>
          <div class="res-card"><h3>Consumo de almacén por placa (S/)</h3><div class="res-canvas"><canvas id="raConsumoPlaca"></canvas></div></div>
          <div class="res-card"><h3>Productos más consumidos (cantidad)</h3><div class="res-canvas"><canvas id="raTopProd"></canvas></div></div>
          <div class="res-card"><h3>Fallas: pendientes vs solucionadas</h3><div class="res-canvas"><canvas id="raFallasEst"></canvas></div></div>
          <div class="res-card"><h3>Sistemas con más fallas</h3><div class="res-canvas"><canvas id="raFallasSis"></canvas></div></div>
          <div class="res-card ancho2"><h3>Productos bajo stock mínimo</h3><div class="ra-scroll" id="raBajo"></div></div>
          <div class="res-card"><h3>Vencidos y por vencer (30 días)</h3><div class="ra-scroll" id="raVence"></div></div>
        </div>`;
      cont.querySelector('#raPeriodo').addEventListener('change', function () { self._render(cont); });
      cont.querySelector('#raPlaca').addEventListener('change', function () { self._render(cont); });
      cont.querySelector('#raActualizar').addEventListener('click', function () { self._cargar(cont, token); });
    }
    if (!self._datos) await self._cargar(cont, token); else self._render(cont);
  },

  _cargar: async function (cont, token) {
    const self = this;
    cont.querySelector('#raEstado').textContent = 'Cargando…';
    try {
      if (!window.Chart && typeof FormResultados !== 'undefined') await FormResultados._cargarChartJs();
      const r = await llamarBackend('resultadosAlmacen', { token: token });
      if (!r || !r.ok) { cont.querySelector('#raEstado').textContent = (r && r.mensaje) || 'No se pudo cargar.'; return; }
      self._datos = r;
      const placas = Array.from(new Set(r.mantenimientos.map(m => m.placa).concat(r.salidas.map(s => s.placa)).filter(Boolean))).sort();
      const sel = cont.querySelector('#raPlaca'); const actual = sel.value;
      sel.innerHTML = '<option value="">Todas</option>' + placas.map(p => '<option>' + esc(p) + '</option>').join('');
      sel.value = actual;
      cont.querySelector('#raEstado').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      self._render(cont);
    } catch (e) {
      cont.querySelector('#raEstado').textContent = 'Error: ' + e.message;
    }
  },

  _rango: function (valor, hoy) {
    const y = +hoy.slice(0, 4), m = +hoy.slice(5, 7);
    const f = (yy, mm, dd) => yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    const finMes = (yy, mm) => new Date(yy, mm, 0).getDate();
    let d, h;
    if (valor === 'mes') { d = f(y, m, 1); h = hoy; }
    else if (valor === 'mesAnt') { const yy = m === 1 ? y - 1 : y, mm = m === 1 ? 12 : m - 1; d = f(yy, mm, 1); h = f(yy, mm, finMes(yy, mm)); }
    else if (valor === '3m') { const dt = new Date(y, m - 3, 1); d = f(dt.getFullYear(), dt.getMonth() + 1, 1); h = hoy; }
    else if (valor === 'anio') { d = f(y, 1, 1); h = hoy; }
    else { d = '0000-01-01'; h = '9999-12-31'; }
    // Período anterior del mismo largo (para comparar)
    const dd = new Date(d.slice(0, 4) === '0000' ? 2000 : +d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
    const hh = new Date(+h.slice(0, 4) > 3000 ? 3000 : +h.slice(0, 4), +h.slice(5, 7) - 1, +h.slice(8, 10));
    const largo = Math.round((hh - dd) / 86400000) + 1;
    const pa = new Date(dd); pa.setDate(pa.getDate() - 1);
    const pd = new Date(pa); pd.setDate(pd.getDate() - largo + 1);
    const iso = x => f(x.getFullYear(), x.getMonth() + 1, x.getDate());
    return { d: d, h: h, ad: valor === 'todo' ? null : iso(pd), ah: valor === 'todo' ? null : iso(pa) };
  },

  _render: function (cont) {
    const self = this, D = self._datos;
    if (!D || !window.Chart) return;
    const placa = cont.querySelector('#raPlaca').value;
    const R = self._rango(cont.querySelector('#raPeriodo').value, D.hoy);
    const tcHoy = (function () { const ks = Object.keys(D.tc).sort(); return ks.length ? D.tc[ks[ks.length - 1]] : 3.7; })();
    const tcDe = function (f) { if (D.tc[f]) return D.tc[f]; const ks = Object.keys(D.tc).filter(k => k <= f).sort(); return ks.length ? D.tc[ks[ks.length - 1]] : tcHoy; };
    const soles = (monto, moneda, fecha) => /\$|D|USD/i.test(String(moneda || '')) && !/S\//.test(String(moneda || '')) ? monto * (fecha ? tcDe(fecha) : tcHoy) : monto;
    const S = n => 'S/ ' + Math.round(n).toLocaleString('es-PE');
    const enR = (f, d, h) => f >= d && f <= h;
    const prod = {}; D.productos.forEach(p => { prod[p.codigo] = p; });
    const precioS = (codigo, fecha) => { const p = prod[codigo]; return p ? soles(p.precio || 0, p.moneda, fecha) : 0; };
    const kpi = (tit, val, sub, clase) => '<div class="res-kpi ' + (clase || '') + '"><div class="k-tit">' + tit + '</div><div class="k-val">' + val + '</div>' + (sub ? '<div class="k-delta igual">' + sub + '</div>' : '') + '</div>';
    const delta = (a, b, invertir) => {
      if (b === null || b === undefined) return '';
      if (!b) return 'Período anterior: ' + S(0);
      const p = (a - b) / b * 100; const sube = p > 0;
      const color = (sube !== !!invertir) ? '#b91c1c' : '#15803d';
      return '<span style="color:' + color + ';font-weight:700">' + (sube ? '▲ ' : '▼ ') + Math.abs(p).toFixed(0) + '%</span> vs período anterior (' + S(b) + ')';
    };

    // ---------- Inventario (hoy) ----------
    const hoy = D.hoy; const en30 = (() => { const x = new Date(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10) + 30); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); })();
    const valorInv = D.productos.reduce((a, p) => a + (p.stock > 0 ? p.stock * soles(p.precio || 0, p.moneda) : 0), 0);
    const bajo = D.productos.filter(p => p.minimo > 0 && p.stock <= p.minimo);
    const vencidos = D.productos.filter(p => p.vence && p.fechaVencimiento && p.fechaVencimiento < hoy && p.stock > 0);
    const porVencer = D.productos.filter(p => p.vence && p.fechaVencimiento && p.fechaVencimiento >= hoy && p.fechaVencimiento <= en30 && p.stock > 0);
    const reps = (D.reparaciones || []).filter(r => r.estado === 'EN REPARACIÓN' || r.estado === 'DAÑADO');
    const fuera = reps.filter(r => r.estado === 'EN REPARACIÓN' && ((r.fechaEstimada && r.fechaEstimada < hoy) || (r.dias !== '' && r.dias > 15)));
    cont.querySelector('#raKpiInv').innerHTML =
      kpi('Valor del inventario', S(valorInv), D.productos.filter(p => p.stock > 0).length + ' productos con stock · al precio del catálogo', 'k-verde') +
      kpi('Bajo stock mínimo', bajo.length, bajo.length ? 'Revisa la lista de abajo' : 'Todo en orden', bajo.length ? 'k-rojo' : '') +
      kpi('Vencidos / por vencer', vencidos.length + ' / ' + porVencer.length, 'Productos con stock (30 días)', (vencidos.length || porVencer.length) ? 'k-naranja' : '') +
      kpi('Piezas dañadas o en taller', reps.reduce((a, r) => a + (r.cantidad || 0), 0), fuera.length ? fuera.length + ' fuera de plazo' : 'Ninguna fuera de plazo', fuera.length ? 'k-rojo' : 'k-cian');

    // ---------- Período ----------
    const filtroPlaca = x => !placa || x.placa === placa;
    const compras = (d, h) => D.ingresos.filter(x => enR(x.fecha, d, h)).reduce((a, x) => a + x.cantidad * precioS(x.codigo, x.fecha), 0);
    const consumo = (d, h) => D.salidas.filter(x => enR(x.fecha, d, h) && filtroPlaca(x)).reduce((a, x) => a + x.cantidad * precioS(x.codigo, x.fecha), 0);
    const mants = (d, h) => D.mantenimientos.filter(x => enR(x.fecha, d, h) && filtroPlaca(x));
    const costoM = L => L.reduce((a, x) => a + soles(x.costo, x.moneda, x.fecha), 0);
    const kmDe = (d, h) => D.km.filter(x => enR(x.fecha, d, h) && filtroPlaca(x)).reduce((a, x) => a + x.km, 0);
    const mP = mants(R.d, R.h), mA = R.ad ? mants(R.ad, R.ah) : null;
    const cM = costoM(mP), cMA = mA ? costoM(mA) : null;
    const kmP = kmDe(R.d, R.h);
    const prev = mP.filter(x => /PREV/.test(x.tipo)).length, corr = mP.filter(x => /CORR/.test(x.tipo)).length;
    const fP = D.fallas.filter(x => enR(x.fecha, R.d, R.h) && filtroPlaca(x));
    const fPend = D.fallas.filter(x => x.estado !== 'SOLUCIONADO' && filtroPlaca(x)).length;
    cont.querySelector('#raKpiPer').innerHTML =
      kpi('Compras de almacén', S(compras(R.d, R.h)), R.ad ? delta(compras(R.d, R.h), compras(R.ad, R.ah), true) : 'Valorizado al precio del catálogo', 'k-morado') +
      kpi('Consumo (salidas)' + (placa ? ' · ' + esc(placa) : ''), S(consumo(R.d, R.h)), R.ad ? delta(consumo(R.d, R.h), consumo(R.ad, R.ah), true) : '', 'k-naranja') +
      kpi('Costo de mantenimiento', S(cM), R.ad ? delta(cM, cMA, true) : '', 'k-rojo') +
      kpi('Mantenimientos', mP.length, prev + ' preventivos · ' + corr + ' correctivos', 'k-cian') +
      kpi('Costo por km', kmP ? 'S/ ' + (cM / kmP).toFixed(2) : '—', kmP ? Math.round(kmP).toLocaleString('es-PE') + ' km recorridos en viajes' : 'Sin km de viajes en el período', '') +
      kpi('Fallas reportadas', fP.length, fPend + ' pendientes en total', fPend ? 'k-rojo' : 'k-verde');

    // ---------- Gráficos ----------
    const dibujar = (id, config) => {
      const c = cont.querySelector('#' + id); if (!c) return;
      if (self._graficos[id] && document.body.contains(self._graficos[id].canvas)) { self._graficos[id].data = config.data; self._graficos[id].options = config.options; self._graficos[id].update(); return; }
      self._graficos[id] = new Chart(c.getContext('2d'), config);
    };
    const base = extra => Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { display: false } } }, extra || {});
    const top = (mapa, n) => Object.keys(mapa).map(k => [k, mapa[k]]).sort((a, b) => b[1] - a[1]).slice(0, n);
    const sumar = (L, clave, valor) => { const m = {}; L.forEach(x => { const k = (typeof clave === 'function' ? clave(x) : x[clave]) || '(SIN DATO)'; m[k] = (m[k] || 0) + (valor ? valor(x) : 1); }); return m; };
    const horizontal = (id, pares, color, soles_) => dibujar(id, { type: 'bar',
      data: { labels: pares.map(p => p[0].length > 28 ? p[0].slice(0, 27) + '…' : p[0]), datasets: [{ data: pares.map(p => Math.round(p[1] * 100) / 100), backgroundColor: color, borderRadius: 5 }] },
      options: base({ indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { callback: v => soles_ ? 'S/ ' + Number(v).toLocaleString('es-PE') : v } }, y: { ticks: { font: { size: 10 } } } } }) });

    // Costo por mes: últimos 12 meses (independiente del período)
    const meses = []; { const y = +hoy.slice(0, 4), m = +hoy.slice(5, 7); for (let i = 11; i >= 0; i--) { const dt = new Date(y, m - 1 - i, 1); meses.push(dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0')); } }
    const nombresMes = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
    const porMes = {}; D.mantenimientos.filter(filtroPlaca).forEach(x => { const k = x.fecha.slice(0, 7); porMes[k] = (porMes[k] || 0) + soles(x.costo, x.moneda, x.fecha); });
    const consMes = {}; D.salidas.filter(filtroPlaca).forEach(x => { const k = x.fecha.slice(0, 7); consMes[k] = (consMes[k] || 0) + x.cantidad * precioS(x.codigo, x.fecha); });
    dibujar('raMes', { type: 'bar', data: { labels: meses.map(k => nombresMes[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4)),
      datasets: [{ label: 'Mantenimiento', data: meses.map(k => Math.round(porMes[k] || 0)), backgroundColor: '#dc2626', borderRadius: 4 },
                 { label: 'Consumo de almacén', data: meses.map(k => Math.round(consMes[k] || 0)), backgroundColor: '#f59e0b', borderRadius: 4 }] },
      options: base({ plugins: { legend: { display: true, position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => 'S/ ' + Number(v).toLocaleString('es-PE') } } } }) });
    const tipos = sumar(mP, x => x.tipo || 'SIN TIPO', x => soles(x.costo, x.moneda, x.fecha));
    const tk = Object.keys(tipos);
    dibujar('raTipo', { type: 'doughnut', data: { labels: tk, datasets: [{ data: tk.map(k => Math.round(tipos[k])), backgroundColor: ['#22c55e', '#ef4444', '#3b82f6', '#a855f7', '#f59e0b'] }] },
      options: base({ cutout: '58%', plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }) });
    horizontal('raPlacaCosto', top(sumar(mP, 'placa', x => soles(x.costo, x.moneda, x.fecha)), 10), '#dc2626', true);
    const kmPlaca = sumar(D.km.filter(x => enR(x.fecha, R.d, R.h) && filtroPlaca(x)), 'placa', x => x.km);
    const cPlaca = sumar(mP, 'placa', x => soles(x.costo, x.moneda, x.fecha));
    horizontal('raPorKm', Object.keys(cPlaca).filter(p => kmPlaca[p] > 0).map(p => [p, cPlaca[p] / kmPlaca[p]]).sort((a, b) => b[1] - a[1]).slice(0, 10), '#7c3aed', false);
    const sP = D.salidas.filter(x => enR(x.fecha, R.d, R.h) && filtroPlaca(x));
    horizontal('raConsumoPlaca', top(sumar(sP, 'placa', x => x.cantidad * precioS(x.codigo, x.fecha)), 10), '#f59e0b', true);
    horizontal('raTopProd', top(sumar(sP, 'producto', x => x.cantidad), 10), '#0891b2', false);
    const fEst = sumar(D.fallas.filter(x => enR(x.fecha, R.d, R.h) && filtroPlaca(x)), x => x.estado === 'SOLUCIONADO' ? 'SOLUCIONADO' : 'PENDIENTE');
    dibujar('raFallasEst', { type: 'doughnut', data: { labels: Object.keys(fEst), datasets: [{ data: Object.keys(fEst).map(k => fEst[k]), backgroundColor: Object.keys(fEst).map(k => k === 'SOLUCIONADO' ? '#22c55e' : '#ef4444') }] },
      options: base({ cutout: '58%', plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }) });
    horizontal('raFallasSis', top(sumar(fP, x => x.sistema + (x.componente ? ' · ' + x.componente : '')), 10), '#ef4444', false);

    // ---------- Listas ----------
    cont.querySelector('#raBajo').innerHTML = bajo.length ? '<table class="ra-tabla"><thead><tr><th style="width:22%">Código</th><th>Producto</th><th style="width:14%">Stock</th><th style="width:14%">Mínimo</th></tr></thead><tbody>' +
      bajo.sort((a, b) => (a.stock - a.minimo) - (b.stock - b.minimo)).map(p => '<tr><td>' + esc(p.codigo) + '</td><td>' + esc(p.producto) + '</td><td class="ra-rojo">' + p.stock + '</td><td>' + p.minimo + '</td></tr>').join('') + '</tbody></table>'
      : '<div style="color:#15803d;padding:10px">Ningún producto bajo el mínimo.</div>';
    const fv = f => f ? f.slice(8, 10) + '/' + f.slice(5, 7) + '/' + f.slice(0, 4) : '';
    const lv = vencidos.map(p => [p, 'ra-rojo']).concat(porVencer.map(p => [p, 'ra-ambar']));
    cont.querySelector('#raVence').innerHTML = lv.length ? '<table class="ra-tabla"><thead><tr><th>Producto</th><th style="width:30%">Vence</th><th style="width:16%">Stock</th></tr></thead><tbody>' +
      lv.map(x => '<tr><td>' + esc(x[0].producto) + '</td><td class="' + x[1] + '">' + fv(x[0].fechaVencimiento) + '</td><td>' + x[0].stock + '</td></tr>').join('') + '</tbody></table>'
      : '<div style="color:#15803d;padding:10px">Nada vencido ni por vencer.</div>';
  }
};
