/**
 * forms/historialReparaciones.js  (v103, 06/11/2026)
 * -------------------------------------------------------------------------
 * Historial de reparaciones (lo ven Mantenimiento y Maestro): junta en una
 * sola lista los mantenimientos registrados, las fallas resueltas
 * (incidencias de conductores) y las reparaciones de piezas en taller.
 * Backend: mtHistorialReparaciones.
 * -------------------------------------------------------------------------
 */
const FormHistorialReparaciones = {
  _items: [],
  _TIPOS: { MANTENIMIENTO: ['Mantenimiento', '#dbeafe', '#1e40af'], FALLA: ['Falla resuelta', '#fee2e2', '#b91c1c'], PIEZA: ['Reparación de pieza', '#ede9fe', '#5b21b6'] },

  abrir: async function () {
    const self = this;
    const html = `
      <style>
        .hr-barra{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:end;margin-bottom:8px}
        .hr-barra .campo{margin:0;min-width:130px}
        .hr-kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:8px}
        .hr-kpi div{background:#f1f5f9;border-radius:9px;padding:6px 10px;border-left:4px solid #94a3b8}
        .hr-kpi span{display:block;font-size:.66rem;font-weight:700;color:#64748b;text-transform:uppercase}.hr-kpi b{font-size:1.05rem;color:#1c3a5e}
        .hr-wrap{max-height:calc(74vh - 210px);min-height:160px;overflow-y:auto;overflow-x:hidden;border:1px solid #e1e6ec;border-radius:10px}
        .hr-t{width:100%;table-layout:fixed;border-collapse:collapse;font-size:.78rem}
        .hr-t th{background:#eef2f7;color:#1c3a5e;font-size:.7rem;padding:6px;position:sticky;top:0;text-align:left}
        .hr-t td{padding:6px;border-bottom:1px solid #eef2f7;vertical-align:top;overflow-wrap:anywhere}
        .hr-t tr.fila{cursor:pointer}.hr-t tr.fila:hover td{background:#f8fafc}
        .hr-tag{display:inline-block;padding:1px 7px;border-radius:8px;font-size:.68rem;font-weight:700}
        .hr-sub{display:block;font-size:.7rem;color:#64748b;margin-top:2px}
        .hr-det td{background:#fbfdff;font-size:.76rem;color:#334155}
        .hr-det b{color:#1c3a5e}
        @media (max-width:800px){.hr-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style>
      <div class="hr-barra">
        <div class="campo"><label>Tipo</label><select id="hrTipo"><option value="">Todos</option><option value="MANTENIMIENTO">Mantenimientos</option><option value="FALLA">Fallas resueltas</option><option value="PIEZA">Reparaciones de piezas</option></select></div>
        <div class="campo"><label>Placa</label><div id="hrPlaca"></div></div>
        <div class="campo"><label>Desde</label><input type="date" id="hrDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="hrHasta"></div>
        <div class="campo" style="flex:1;min-width:180px"><label>Buscar</label><input id="hrBuscar" placeholder="Repuesto, sistema, técnico, observación…" autocomplete="off"></div>
        <button class="boton-secundario" id="hrLimpiar">Borrar filtros</button>
      </div>
      <div class="hr-kpi" id="hrKpi"></div>
      <div class="hr-wrap"><table class="hr-t">
        <colgroup><col style="width:9%"><col style="width:12%"><col style="width:9%"><col><col style="width:9%"><col style="width:14%"><col style="width:9%"></colgroup>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Placa</th><th>Qué se hizo</th><th>Km</th><th>Quién</th><th style="text-align:right">Costo</th></tr></thead>
        <tbody id="hrCuerpo"><tr><td colspan="7" style="text-align:center;color:#64748b;padding:16px">Cargando…</td></tr></tbody>
      </table></div>
      <div class="panel-footer" style="padding-top:10px"><button class="boton-secundario" id="hrCerrar">Cerrar</button></div>`;
    abrirPanel('Historial de reparaciones', html, async function (raiz) {
      self._raiz = raiz;
      const $ = id => raiz.querySelector('#' + id);
      self._msPlaca = crearMultiSelect($('hrPlaca'), { textoTodos: 'Todas', onChange: () => self._pintar() });
      ['hrTipo', 'hrDesde', 'hrHasta'].forEach(id => $(id).addEventListener('change', () => self._pintar()));
      $('hrBuscar').addEventListener('input', () => self._pintar());
      $('hrLimpiar').addEventListener('click', function () { $('hrTipo').value = ''; $('hrDesde').value = ''; $('hrHasta').value = ''; $('hrBuscar').value = ''; self._msPlaca.limpiar(); self._pintar(); });
      $('hrCerrar').addEventListener('click', solicitarCierrePanel);
      $('hrCuerpo').addEventListener('click', function (ev) {
        const tr = ev.target.closest('tr.fila'); if (!tr) return;
        const det = tr.nextElementSibling;
        if (det && det.classList.contains('hr-det')) det.style.display = det.style.display === 'none' ? '' : 'none';
      });
      let r = null;
      try { r = await llamarBackend('mtHistorialReparaciones', {}); } catch (e) { r = null; }
      if (!r || !r.ok) { $('hrCuerpo').innerHTML = '<tr><td colspan="7" style="text-align:center;color:#b91c1c;padding:16px">' + esc((r && r.mensaje) || 'No se pudo cargar el historial.') + '</td></tr>'; return; }
      self._items = r.items || [];
      self._msPlaca.setOpciones(Array.from(new Set(self._items.map(x => x.placa).filter(Boolean))).sort());
      self._pintar();
    }, { ancho: true });
  },

  _vis: function () {
    const $ = id => this._raiz.querySelector('#' + id);
    const tipo = $('hrTipo').value, de = $('hrDesde').value, ha = $('hrHasta').value, q = $('hrBuscar').value.trim().toUpperCase();
    return this._items.filter(x => (!tipo || x.origen === tipo) && this._msPlaca.cumple(x.placa) &&
      (!de || (x.iso && x.iso >= de)) && (!ha || (x.iso && x.iso <= ha)) &&
      (!q || JSON.stringify(x).toUpperCase().indexOf(q) >= 0));
  },

  _pintar: function () {
    const self = this, $ = id => self._raiz.querySelector('#' + id);
    if (typeof _refrescarSnapshotFormulario === 'function') setTimeout(_refrescarSnapshotFormulario, 0);
    const vis = self._vis();
    const cnt = t => vis.filter(x => x.origen === t).length;
    const suma = mon => vis.filter(x => x.costo > 0 && (mon === '$' ? /\$|USD|D[OÓ]L/i.test(x.moneda) : !/\$|USD|D[OÓ]L/i.test(x.moneda))).reduce((a, x) => a + x.costo, 0);
    const sS = suma('S/'), sD = suma('$');
    $('hrKpi').innerHTML = [['Registros', vis.length, '#1c3a5e'], ['Mantenimientos', cnt('MANTENIMIENTO'), '#1e40af'], ['Fallas resueltas', cnt('FALLA'), '#b91c1c'],
      ['Piezas reparadas', cnt('PIEZA'), '#5b21b6'], ['Costo registrado', 'S/ ' + sS.toFixed(2) + (sD ? ' · $ ' + sD.toFixed(2) : ''), '#16a34a']]
      .map(k => '<div style="border-left-color:' + k[2] + '"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>').join('');
    const linea = (k, v) => v ? '<div><b>' + k + ':</b> ' + esc(v) + '</div>' : '';
    $('hrCuerpo').innerHTML = vis.length ? vis.map(function (x) {
      const t = self._TIPOS[x.origen] || [x.origen, '#f1f5f9', '#334155'];
      let sub = '';
      if (x.origen === 'MANTENIMIENTO') sub = [x.tipo, x.sistema, x.repuesto].filter(Boolean).join(' · ');
      else if (x.origen === 'FALLA') sub = x.trabajo ? 'Trabajo: ' + x.trabajo : x.detalle;
      else sub = [x.estado, x.taller].filter(Boolean).join(' · ');
      let det = '';
      if (x.origen === 'MANTENIMIENTO') det = linea('Tipo', x.tipo) + linea('Sistema', x.sistema) + linea('Método', x.metodo) + linea('Repuesto', x.repuesto + (x.cantidad && x.cantidad !== '0' ? ' × ' + x.cantidad : '')) +
        linea('Lugar', x.lugar) + linea('Duración', x.duracion) + linea('Terminó', x.fin) + linea('Observación', x.obs);
      else if (x.origen === 'FALLA') det = linea('Reportada', x.reportada + (x.reporto ? ' por ' + x.reporto : '')) + linea('Unidad', x.tipo) + linea('Urgencia', x.urgencia) +
        linea('Detalle del conductor', x.detalle) + linea('Trabajo realizado', x.trabajo) + (x.reincidencias ? linea('Repeticiones', String(x.reincidencias)) : '') + linea('ID', x.id);
      else det = linea('Código', x.codigo) + linea('Cantidad', x.cantidad) + linea('Origen', x.tipo) + linea('Taller', x.taller) + linea('Guía', x.guia) +
        linea('Enviada', x.envio) + linea('Retornó', x.retorno) + linea('Estado', x.estado) + linea('Observación', x.obs);
      const costo = x.costo > 0 ? ((/\$|USD|D[OÓ]L/i.test(x.moneda) ? '$ ' : 'S/ ') + x.costo.toFixed(2)) : '<span style="color:#94a3b8">—</span>';
      return '<tr class="fila"><td>' + esc(x.fecha) + '</td><td><span class="hr-tag" style="background:' + t[1] + ';color:' + t[2] + '">' + t[0] + '</span></td><td><b>' + esc(x.placa) + '</b></td>' +
        '<td>' + esc(x.titulo) + (sub ? '<span class="hr-sub">' + esc(sub) + '</span>' : '') + '</td><td>' + esc(x.km || '') + '</td><td>' + esc(x.quien || '') + '</td><td style="text-align:right">' + costo + '</td></tr>' +
        '<tr class="hr-det" style="display:none"><td></td><td colspan="6">' + (det || 'Sin más detalle.') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:16px">No hay reparaciones con estos filtros.</td></tr>';
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-historial-reparaciones');
  if (b) b.addEventListener('click', function () { FormHistorialReparaciones.abrir(); });
});
