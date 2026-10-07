/**
 * forms/selFacturaViaje.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmSelFacturaViaje.frm (VBA): lista todo lo
 * pendiente de facturar (viajes, falsos fletes, balanza, sobrecostos),
 * con filtro por tipo y texto libre, y al elegir "Facturar" enruta al
 * formulario correspondiente (frmFacturaViaje / frmFacturaSobrecosto /
 * frmFacturaBalanza), igual que btnFacturar_Click.
 * -------------------------------------------------------------------------
 */
const FormSelFacturaViaje = {

  abrir: async function () {
    // Equivalente a la verificación de HOME.AbrirSeleccionFacturacion.
    const validacion = await llamarBackend('validarTipoCambioRegistrado', {});
    if (!validacion.ok) { mostrarMensaje(validacion.mensaje, 'error'); return; }

    const html = `
      <div class="barra-filtros">
        <div class="campo"><label>Buscar</label><input type="text" id="txtBuscarFact"></div>
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
        <button class="boton-secundario" id="btnBorrarFiltro">Borrar filtro</button>
      </div>
      <style>
        #tablaFact { width:100%; table-layout:fixed; font-size:.8rem; }
        #tablaFact th, #tablaFact td { overflow-wrap:anywhere; padding:7px 6px; }
        #tablaFact tr.fact-hecho td { color:#8b95a1; }
        .fact-badge { display:inline-block; padding:2px 7px; border-radius:999px; font-size:.7rem; font-weight:800; white-space:nowrap; }
        .fact-badge.pend { background:#fef3c7; color:#92400e; }
        .fact-badge.hecho { background:#e2e8f0; color:#475569; }
        .fact-sep td { background:#f1f5f9; font-weight:800; color:#1c3a5e; font-size:.74rem; text-transform:uppercase; letter-spacing:.03em; }
      </style>
      <div id="factResumen" style="font-size:.8rem;color:#475569;margin:0 0 6px;"></div>
      <div style="max-height:calc(74vh - 220px); min-height:260px; overflow-y:auto; overflow-x:hidden;">
        <table class="tabla-lista" id="tablaFact">
          <colgroup><col style="width:11%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:12%"><col style="width:8%"><col style="width:9%"><col style="width:12%"><col style="width:9%"></colgroup>
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
    let seleccionado = null;

    async function cargar() {
      const filas = await llamarBackend('filtrarFacturacionPendiente', {
        tipo: raiz.querySelector('#cboFiltroTipoFact').value,
        texto: raiz.querySelector('#txtBuscarFact').value
      });
      if (!Array.isArray(filas)) {
        mostrarMensaje((filas && filas.mensaje) || 'No se pudo cargar la lista de facturación.', 'error');
        return;
      }
      const tbody = raiz.querySelector('#tablaFact tbody');
      tbody.innerHTML = '';
      seleccionado = null;
      // Facturado = tipos que terminan en "FACT." o " F." (SERV. FACT., F.F. FACT., BALANZA F., SOBREEST. F., PERNOCTE F.)
      const facturado = f => /(FACT\.|\sF\.)\s*$/.test(String(f.tipoFact || '').trim().toUpperCase());
      const clave = function (v) {
        const s = String(v || '');
        let m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + m[2] + m[3];
        m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0');
        const d = new Date(s); return isNaN(d) ? '' : d.toISOString().slice(0, 10).replace(/-/g, '');
      };
      const ver = raiz.querySelector('#cboEstadoFact').value;
      const lista = filas.filter(f => !ver || (ver === 'F') === facturado(f))
        .sort((a, b) => (facturado(a) - facturado(b)) || clave(b.fechaServicio).localeCompare(clave(a.fechaServicio)));
      const nPend = filas.filter(f => !facturado(f)).length;
      raiz.querySelector('#factResumen').innerHTML = '<b style="color:#92400e">' + nPend + ' pendiente(s) de facturar</b> · ' + (filas.length - nPend) + ' ya facturado(s). Ordenado: pendientes primero, luego por fecha más reciente.';
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
        const destino = esc(f.destino1) + (f.destino2 && String(f.destino2).trim() !== '-' ? ' / ' + esc(f.destino2) : '');
        tr.innerHTML = `<td><span class="fact-badge ${hecho ? 'hecho' : 'pend'}">${hecho ? 'Facturado' : 'Pendiente'}</span></td>
          <td>${esc(formatoFecha(f.fechaServicio))}</td><td>${esc(f.booking)}</td><td>${esc(f.contenedor)}</td><td>${esc(f.cliente1)}</td>
          <td>${destino}</td><td>${esc(f.placa)}</td><td>${esc(f.codigo)}</td><td>${esc(f.tipoFact)}</td>`;
        tr.addEventListener('click', function () {
          tbody.querySelectorAll('tr').forEach(x => x.classList.remove('seleccionada'));
          tr.classList.add('seleccionada');
          seleccionado = f;
        });
        tbody.appendChild(tr);
      });
    }

    raiz.querySelector('#cboFiltroTipoFact').addEventListener('change', cargar);
    raiz.querySelector('#cboEstadoFact').addEventListener('change', cargar);
    let espera = null;
    raiz.querySelector('#txtBuscarFact').addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(cargar, 300); });
    raiz.querySelector('#btnBorrarFiltro').addEventListener('click', function () {
      raiz.querySelector('#txtBuscarFact').value = '';
      raiz.querySelector('#cboFiltroTipoFact').value = 'TODOS';
      raiz.querySelector('#cboEstadoFact').value = '';
      cargar();
    });
    raiz.querySelector('#btnInicio').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnFacturar').addEventListener('click', async function () {
      if (!seleccionado) { mostrarMensaje('Seleccione un servicio para facturar.', 'error'); return; }

      const resp = await llamarBackend('resolverDestinoFacturacion', seleccionado);
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }

      if (resp.destino === 'frmFacturaSobrecosto') FormFacturaSobrecosto.abrir(resp.fila);
      else if (resp.destino === 'frmFacturaBalanza') FormFacturaBalanza.abrir(resp.fila);
      else FormFacturaViaje.abrir(resp.fila, resp.tipoFacturacionActual);
    });

    cargar();
  }
};
