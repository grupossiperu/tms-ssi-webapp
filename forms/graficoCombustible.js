/**
 * forms/graficoCombustible.js  (v77)
 * -------------------------------------------------------------------------
 * Gráfico de combustible: compara, viaje por viaje (o por unidad, conductor
 * o mes), el ESTIMADO (galones establecidos), lo ABASTECIDO (notas de venta)
 * y el CONSUMO REAL (sonda), más el consumo según NAVISAT si se registró.
 * Datos del Cierre de combustible (acción cierreListar).
 * -------------------------------------------------------------------------
 */
const FormGraficoCombustible = {
  _graf: null,

  _cargarChart: function () {
    if (window.Chart) return Promise.resolve();
    return new Promise(function (ok, mal) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      s.onload = ok; s.onerror = function () { mal(new Error('No se pudo cargar la librería de gráficos.')); };
      document.head.appendChild(s);
    });
  },

  abrir: function () {
    const self = this;
    const html = `
      <style>
        .gc-filtros { display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap:8px 10px; align-items:end; margin-bottom:10px; }
        .gc-filtros .campo { margin:0; } .gc-filtros input, .gc-filtros select { width:100%; }
        .gc-kpis { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap:8px; margin-bottom:10px; }
        .gc-kpi { background:#f1f5f9; border-radius:9px; padding:7px 11px; border-left:4px solid #94a3b8; }
        .gc-kpi span { display:block; font-size:.66rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.3px; }
        .gc-kpi b { font-size:1.1rem; color:#1c3a5e; }
        .gc-canvas { position:relative; height:330px; background:#fff; border:1px solid #dbe2ea; border-radius:10px; padding:8px; margin-bottom:10px; }
        .gc-t { width:100%; table-layout:fixed; border-collapse:collapse; font-size:.76rem; }
        .gc-t th, .gc-t td { padding:5px 6px; border-bottom:1px solid #eef2f7; text-align:right; overflow-wrap:anywhere; }
        .gc-t th:first-child, .gc-t td:first-child { text-align:left; }
        .gc-t th { color:#1c3a5e; font-size:.7rem; }
        .gc-neg { color:#b91c1c; font-weight:700; } .gc-pos { color:#166534; }
        @media (max-width:1000px){ .gc-filtros{grid-template-columns:repeat(3,minmax(0,1fr));} .gc-kpis{grid-template-columns:repeat(2,minmax(0,1fr));} }
      </style>
      <div class="gc-filtros">
        <div class="campo"><label>Ver por</label><select id="gcPor"><option value="viaje">Viaje</option><option value="placa">Unidad</option><option value="conductor">Conductor</option><option value="mes">Mes</option></select></div>
        <div class="campo"><label>Desde</label><input type="date" id="gcDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="gcHasta"></div>
        <div class="campo"><label>Unidad</label><div id="msGcPlaca"></div></div>
        <div class="campo"><label>Conductor</label><div id="msGcCond"></div></div>
        <div class="campo"><label style="display:flex;gap:6px;align-items:center;margin-top:18px"><input type="checkbox" id="gcSolo" checked style="width:auto"> Solo viajes con lectura de sonda</label></div>
      </div>
      <div class="gc-kpis" id="gcKpis"></div>
      <div class="gc-canvas"><canvas id="gcCanvas"></canvas></div>
      <div style="max-height:30vh;overflow-y:auto">
        <table class="gc-t"><colgroup><col style="width:24%"><col><col><col><col><col><col><col><col></colgroup>
          <thead><tr><th></th><th>Viajes</th><th>Estimado (gal)</th><th>Abastecido (gal)</th><th>Real sonda (gal)</th><th>Navisat (gal)</th><th>Abast. − real</th><th>Real − estimado</th><th>km/gal real</th></tr></thead>
          <tbody id="gcCuerpo"><tr><td colspan="9">Cargando…</td></tr></tbody></table>
      </div>`;
    abrirPanel('Gráfico de combustible: estimado vs abastecido vs real', html, function (raiz) { self._wire(raiz); }, { ancho: true });
  },

  _wire: function (raiz) {
    const self = this;
    const $ = id => raiz.querySelector('#' + id);
    let viajes = [];
    const mesTxt = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})/); return m ? MESES[Number(m[2])].slice(0, 3) + ' ' + m[1] : '—'; };
    const f1 = x => x === null || x === undefined ? '—' : x.toFixed(1);

    const pintar = function () {
      const por = $('gcPor').value, desde = $('gcDesde').value, hasta = $('gcHasta').value, solo = $('gcSolo').checked;
      const lista = viajes.filter(v => (!desde || v.iso >= desde) && (!hasta || v.iso <= hasta) &&
        msPlaca.cumple(v.placa) && msCond.cumple(v.conductor) && (!solo || v.consumo !== null))
        .sort((a, b) => a.iso.localeCompare(b.iso));
      const grupos = [];
      const idx = {};
      lista.forEach(function (v) {
        const k = por === 'viaje' ? v.iso + '|' + v.fila : por === 'mes' ? v.iso.slice(0, 7) : v[por] || '—';
        let g = idx[k];
        if (!g) {
          g = idx[k] = { etiqueta: por === 'viaje' ? (formatoFecha(v.iso) + ' · ' + v.placa + ' · ' + v.destino) : por === 'mes' ? mesTxt(v.iso) : k,
            n: 0, est: 0, ab: 0, real: 0, nReal: 0, nav: 0, nNav: 0, km: 0, kmReal: 0 };
          grupos.push(g);
        }
        g.n++; g.est += v.estimado; g.ab += v.abastecido; g.km += v.km;
        if (v.consumo !== null) { g.real += v.consumo; g.nReal++; g.kmReal += v.km; }
        if (v.navisat !== null) { g.nav += v.navisat; g.nNav++; }
      });
      if (por !== 'viaje' && por !== 'mes') grupos.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
      // KPIs
      const t = grupos.reduce((a, g) => { a.n += g.n; a.est += g.est; a.ab += g.ab; a.real += g.real; a.nReal += g.nReal; a.nav += g.nav; a.nNav += g.nNav; a.kmReal += g.kmReal; return a; },
        { n: 0, est: 0, ab: 0, real: 0, nReal: 0, nav: 0, nNav: 0, kmReal: 0 });
      const kpi = (titulo, valor) => '<div class="gc-kpi"><span>' + titulo + '</span><b>' + valor + '</b></div>';
      $('gcKpis').innerHTML = kpi('Viajes', t.n) + kpi('Estimado', t.est.toFixed(1) + ' gal') + kpi('Abastecido', t.ab.toFixed(1) + ' gal') +
        kpi('Consumo real (sonda)', t.nReal ? t.real.toFixed(1) + ' gal' : '—') +
        kpi('Rendimiento real', t.nReal && t.real ? (t.kmReal / t.real).toFixed(2) + ' km/gal' : '—');
      // Tabla
      const dif = (x) => x === null ? '—' : '<span class="' + (x > 0.05 ? 'gc-neg' : 'gc-pos') + '">' + (x >= 0 ? '+' : '') + x.toFixed(1) + '</span>';
      $('gcCuerpo').innerHTML = grupos.length ? grupos.map(g => '<tr><td>' + esc(g.etiqueta) + '</td><td>' + g.n + '</td><td>' + g.est.toFixed(1) + '</td><td>' + g.ab.toFixed(1) +
        '</td><td>' + (g.nReal ? g.real.toFixed(1) : '—') + '</td><td>' + (g.nNav ? g.nav.toFixed(1) : '—') + '</td><td>' + dif(g.nReal ? g.ab - g.real : null) +
        '</td><td>' + dif(g.nReal ? g.real - g.est : null) + '</td><td>' + (g.nReal && g.real ? (g.kmReal / g.real).toFixed(2) : '—') + '</td></tr>').join('')
        : '<tr><td colspan="9" style="text-align:left;color:#64748b">No hay viajes cerrados con estos filtros. Cierre los viajes en "Cierre de combustible".</td></tr>';
      // Gráfico
      if (!window.Chart) return;
      if (self._graf) { try { self._graf.destroy(); } catch (e) { /* no-op */ } }
      const hayNav = grupos.some(g => g.nNav);
      const ds = [
        { label: 'Estimado', data: grupos.map(g => +g.est.toFixed(2)), backgroundColor: '#94a3b8' },
        { label: 'Abastecido (notas de venta)', data: grupos.map(g => +g.ab.toFixed(2)), backgroundColor: '#2563eb' },
        { label: 'Consumo real (sonda)', data: grupos.map(g => g.nReal ? +g.real.toFixed(2) : null), backgroundColor: '#16a34a' }
      ];
      if (hayNav) ds.push({ label: 'Navisat', data: grupos.map(g => g.nNav ? +g.nav.toFixed(2) : null), backgroundColor: '#f59e0b' });
      self._graf = new Chart($('gcCanvas'), {
        type: 'bar',
        data: { labels: grupos.map(g => g.etiqueta.length > 34 ? g.etiqueta.slice(0, 33) + '…' : g.etiqueta), datasets: ds },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + (c.raw === null ? '—' : c.raw.toFixed(2) + ' gal') } } },
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Galones' } }, x: { ticks: { autoSkip: false, maxRotation: 50, minRotation: 0, font: { size: 10 } } } } }
      });
      _refrescarSnapshotFormulario();
    };
    const msPlaca = crearMultiSelect($('msGcPlaca'), { onChange: pintar });
    const msCond = crearMultiSelect($('msGcCond'), { onChange: pintar });
    ['gcPor', 'gcDesde', 'gcHasta', 'gcSolo'].forEach(id => $(id).addEventListener('change', pintar));
    (async function () {
      try { await self._cargarChart(); } catch (e) { mostrarMensaje(e.message, 'error'); }
      const r = await llamarBackend('cierreListar', {});
      if (!respuestaValida(r)) { $('gcCuerpo').innerHTML = '<tr><td colspan="9">' + esc((r && r.mensaje) || 'No se pudieron cargar los cierres.') + '</td></tr>'; return; }
      viajes = Object.keys(r.cierres || {}).map(k => {
        const c = r.cierres[k];
        return { fila: c.fila, iso: c.fechaIso || '', placa: String(c.placa || '').toUpperCase(), conductor: String(c.conductor || '').toUpperCase(),
          destino: c.destino || '', estimado: Number(c.estimadoTracto) || 0, abastecido: Number(c.abastecidoTracto) || 0,
          consumo: c.consumo === null || c.consumo === undefined ? null : Number(c.consumo),
          navisat: c.consumoNavisat === null || c.consumoNavisat === undefined ? null : Number(c.consumoNavisat), km: Number(c.km) || 0 };
      });
      msPlaca.setOpciones(Array.from(new Set(viajes.map(v => v.placa).filter(Boolean))).sort());
      msCond.setOpciones(Array.from(new Set(viajes.map(v => v.conductor).filter(Boolean))).sort());
      pintar();
    })();
  }
};
