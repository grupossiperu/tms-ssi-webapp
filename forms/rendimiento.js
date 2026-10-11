/**
 * forms/rendimiento.js  (v76)
 * -------------------------------------------------------------------------
 * Resultados → pestaña "Rendimiento" (datos del Cierre de combustible).
 *  - km/gal por unidad y por conductor. Con lectura (sonda/varilla): km ÷
 *    consumo real. Sin lectura: km ÷ galones abastecidos (lleno a lleno).
 *  - Unidad piloto (AYN-941) vs. comparación (AYQ-822) vs. flota.
 *  - % de viajes con exceso sobre lo establecido, días del viaje al cierre,
 *    comprobante vs. sonda (±1 %) y duplicados, con los semáforos de la
 *    Tabla 118 de la tesis.
 * Backend: resultadosRendimiento({token}).
 * -------------------------------------------------------------------------
 */
const FormRendimiento = {
  PILOTO: 'AYN941',
  COMPARACION: 'AYQ822',
  _datos: null,

  mostrar: async function (cont, token) {
    const self = this;
    cont.innerHTML = `
      <style>
        .rd-barra { display:flex; flex-wrap:wrap; gap:10px; align-items:end; margin-bottom:10px; }
        .rd-barra .campo { margin:0; min-width:150px; }
        .rd-kpis { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:10px; margin-bottom:12px; }
        .rd-kpi { border-radius:10px; padding:9px 12px; background:#f1f5f9; border-left:5px solid #94a3b8; }
        .rd-kpi span { display:block; font-size:.68rem; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:.3px; }
        .rd-kpi b { font-size:1.25rem; color:#1c3a5e; } .rd-kpi small { display:block; font-size:.7rem; color:#64748b; }
        .rd-kpi.verde { border-left-color:#16a34a; background:#f0fdf4; } .rd-kpi.ambar { border-left-color:#d97706; background:#fffbeb; } .rd-kpi.rojo { border-left-color:#dc2626; background:#fef2f2; }
        .rd-grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        .rd-card { background:#fff; border:1px solid #dbe2ea; border-radius:10px; padding:10px 12px; }
        .rd-card h3 { margin:0 0 8px; font-size:.84rem; color:#1c3a5e; }
        .rd-t { width:100%; table-layout:fixed; border-collapse:collapse; font-size:.78rem; }
        .rd-t th, .rd-t td { padding:5px 6px; border-bottom:1px solid #eef2f7; text-align:right; overflow-wrap:anywhere; }
        .rd-t th:first-child, .rd-t td:first-child { text-align:left; }
        .rd-t th { color:#1c3a5e; font-size:.72rem; }
        .rd-t tr.piloto td { background:#eff6ff; font-weight:700; }
        @media (max-width: 1100px) { .rd-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .rd-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="rd-barra">
        <div class="campo"><label>Desde</label><input type="date" id="rdDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="rdHasta"></div>
        <button class="boton-secundario" id="rdActualizar" type="button">Actualizar</button>
        <button class="boton-primario" id="rdGrafico" type="button">📊 Gráfico: estimado vs abastecido vs real</button>
        <span style="font-size:.76rem;color:#64748b">Fuente: Cierre de combustible del viaje. Semáforos según la Tabla 118.</span>
      </div>
      <div id="rdCuerpo">Cargando…</div>`;
    cont.querySelector('#rdActualizar').addEventListener('click', function () { self._datos = null; self._cargar(cont, token); });
    cont.querySelector('#rdGrafico').addEventListener('click', function () { FormGraficoCombustible.abrir(); });
    ['rdDesde', 'rdHasta'].forEach(id => cont.querySelector('#' + id).addEventListener('change', function () { self._render(cont); }));
    if (!self._datos) await self._cargar(cont, token); else self._render(cont);
  },

  _cargar: async function (cont, token) {
    const r = await llamarBackend('resultadosRendimiento', { token: token });
    if (!respuestaValida(r)) { cont.querySelector('#rdCuerpo').textContent = (r && r.mensaje) || 'No se pudieron cargar los datos.'; return; }
    this._datos = r;
    this._render(cont);
  },

  _render: function (cont) {
    const self = this, d = self._datos; if (!d) return;
    const desde = cont.querySelector('#rdDesde').value, hasta = cont.querySelector('#rdHasta').value;
    const enRango = f => (!desde || (f && f >= desde)) && (!hasta || (f && f <= hasta));
    const vj = d.viajes.filter(v => enRango(v.fecha));
    const norm = p => String(p || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    // Agregado: con lectura -> km/consumo; sin lectura -> km/abastecido (lleno a lleno).
    const agregar = function (lista) {
      const conL = lista.filter(v => v.consumo !== null && v.consumo > 0);
      const sinL = lista.filter(v => !(v.consumo !== null && v.consumo > 0));
      const km = lista.reduce((s, v) => s + v.km, 0);
      const kmL = conL.reduce((s, v) => s + v.km, 0), gL = conL.reduce((s, v) => s + v.consumo, 0);
      const kmS = sinL.reduce((s, v) => s + v.km, 0), gS = sinL.reduce((s, v) => s + v.abastecido, 0);
      const gal = gL + gS;
      return {
        viajes: lista.length, km: km, gal: gal, rend: gal > 0 ? (kmL + kmS) / gal : null, conLectura: conL.length,
        exceso: conL.length ? conL.filter(v => v.exceso > 0).length / conL.length * 100 : null,
        estimado: lista.reduce((s, v) => s + v.estimado, 0), abastecido: lista.reduce((s, v) => s + v.abastecido, 0)
      };
    };
    const agrupar = function (clave) {
      const g = {};
      vj.forEach(v => { (g[v[clave] || '—'] = g[v[clave] || '—'] || []).push(v); });
      return Object.keys(g).map(k => Object.assign({ k: k }, agregar(g[k]))).sort((a, b) => (b.rend || 0) - (a.rend || 0));
    };
    const piloto = agregar(vj.filter(v => norm(v.placa) === self.PILOTO));
    const comp = agregar(vj.filter(v => norm(v.placa) === self.COMPARACION));
    const flota = agregar(vj);
    const conDias = vj.filter(v => v.diasCierre !== null);
    const dias = conDias.length ? conDias.reduce((s, v) => s + v.diasCierre, 0) / conDias.length : null;
    const conDif = vj.filter(v => v.difPct !== null);
    const difFuera = conDif.filter(v => Math.abs(v.difPct) > 1).length;
    const dups = d.duplicados.filter(x => enRango(x.fecha));
    const pctDup = d.totalServicios ? dups.length / d.totalServicios * 100 : 0;

    const sem = (v, verde, ambar) => v === null ? '' : verde(v) ? 'verde' : ambar(v) ? 'ambar' : 'rojo';
    const f2 = (x, s) => x === null || x === undefined ? '—' : x.toFixed(2) + (s || '');
    const kpi = (t, v, cls, sub) => '<div class="rd-kpi ' + (cls || '') + '"><span>' + t + '</span><b>' + v + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
    const fila = (r, piloto) => '<tr class="' + (piloto ? 'piloto' : '') + '"><td>' + esc(r.k) + '</td><td>' + r.viajes + '</td><td>' + Math.round(r.km).toLocaleString('es-PE') +
      '</td><td>' + r.gal.toFixed(1) + '</td><td>' + f2(r.rend) + '</td><td>' + (r.exceso === null ? '—' : r.exceso.toFixed(0) + ' %') + '</td><td>' + (r.abastecido - r.estimado >= 0 ? '+' : '') + (r.abastecido - r.estimado).toFixed(1) + '</td></tr>';
    const tabla = (titulo, filas, marcar) => '<div class="rd-card"><h3>' + titulo + '</h3><table class="rd-t"><colgroup><col style="width:30%"><col><col><col><col><col><col></colgroup>' +
      '<thead><tr><th></th><th>Viajes</th><th>Km</th><th>Galones</th><th>km/gal</th><th>Con exceso</th><th>Abast. vs estim. (gal)</th></tr></thead><tbody>' +
      (filas.length ? filas.map(r => fila(r, marcar && marcar(r))).join('') : '<tr><td colspan="7" style="text-align:left;color:#64748b">Sin cierres en el período.</td></tr>') + '</tbody></table></div>';

    cont.querySelector('#rdCuerpo').innerHTML =
      '<div class="rd-kpis">' +
        kpi('Rendimiento unidad piloto (AYN-941)', f2(piloto.rend, ' km/gal'), sem(piloto.rend, v => v >= 10, v => v >= 9.66), 'Meta ≥ 10.0 · ' + piloto.viajes + ' viaje(s)') +
        kpi('Unidad de comparación (AYQ-822)', f2(comp.rend, ' km/gal'), '', comp.viajes + ' viaje(s) · lleno a lleno si no tiene sonda') +
        kpi('Flota', f2(flota.rend, ' km/gal'), '', flota.viajes + ' viaje(s) cerrados · línea base 9.51') +
        kpi('Viajes con exceso sobre lo establecido', piloto.exceso === null ? '—' : piloto.exceso.toFixed(1) + ' %', sem(piloto.exceso, v => v <= 15, v => v <= 30), 'Unidad piloto · meta ≤ 15 %') +
        kpi('Días del viaje al cierre', dias === null ? '—' : dias.toFixed(1), sem(dias, v => v <= 0.5, v => v <= 2), 'Promedio · meta 0 días') +
        kpi('Comprobante vs. sonda fuera de ±1 %', conDif.length ? difFuera + ' de ' + conDif.length : '—', conDif.length ? (difFuera === 0 ? 'verde' : 'rojo') : '', 'Abastecimientos contrastados') +
        kpi('Registros duplicados', pctDup.toFixed(1) + ' %', sem(pctDup, v => v === 0, v => v <= 2), dups.length + ' caso(s) · meta 0 %') +
        kpi('Estimado vs. abastecido (flota)', (flota.abastecido - flota.estimado >= 0 ? '+' : '') + (flota.abastecido - flota.estimado).toFixed(1) + ' gal', '', 'Abastecido real menos estimado') +
      '</div>' +
      '<div class="rd-grid">' +
        tabla('Rendimiento por unidad', agrupar('placa'), r => norm(r.k) === self.PILOTO) +
        tabla('Rendimiento por conductor', agrupar('conductor')) +
      '</div>' +
      (dups.length ? '<div class="rd-card" style="margin-top:12px"><h3>Posibles duplicados (mismo booking y contenedor)</h3>' +
        dups.map(x => esc(x.booking) + ' · ' + esc(x.contenedor) + ' (filas ' + x.filas.join(' y ') + ')').join('<br>') + '</div>' : '');
  }
};
