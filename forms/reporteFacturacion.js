/**
 * forms/reporteFacturacion.js
 * -------------------------------------------------------------------------
 * Finanzas > "Reporte de facturación": la tabla que la facturadora envía por
 * correo (cliente para facturación, empresa, conductor, placa, almacenes,
 * destino, booking, contenedor, cliente de la guía, fecha de facturación,
 * N° de factura y venta en dólares), con filtros por cliente, fecha de
 * facturación y booking. "Copiar para correo" deja la tabla lista para
 * pegar en Gmail/Outlook. Backend: reporteFacturacion.
 * -------------------------------------------------------------------------
 */
const FormReporteFacturacion = {

  abrir: async function () {
    const r = await llamarBackend('reporteFacturacion', {});
    if (!respuestaValida(r) || !Array.isArray(r.filas)) {
      mostrarMensaje((r && r.mensaje) || 'No se pudo cargar el reporte de facturación.', 'error');
      return;
    }
    const html = `
      <style>
        .rf-filtros input, .rf-filtros select { max-width: 190px; }
        .rf-wrap { max-height: calc(74vh - 200px); min-height: 200px; overflow: auto; border: 1px solid #e1e6ec; border-radius: 10px; }
        #tablaRF { width: 100%; table-layout: fixed; font-size: .74rem; border-collapse: collapse; }
        #tablaRF th { background: #808080; color: #fff; font-size: .7rem; padding: 6px 5px; position: sticky; top: 0; text-align: center; white-space: normal; }
        #tablaRF th.negro { background: #000; }
        #tablaRF td { padding: 5px; border-bottom: 1px solid #e2e8f0; text-align: center; overflow-wrap: anywhere; }
        #tablaRF tbody tr:nth-child(even) td { background: #dbe8f5; }
        #tablaRF tfoot td { font-weight: 800; background: #eef3f8; }
        .rf-cuenta { font-size: .8rem; color: #64748b; margin: 0 0 6px; }
      </style>
      <div class="barra-filtros rf-filtros">
        <div class="campo"><label>Cliente</label><div id="msRFCliente"></div></div>
        <div class="campo"><label>Facturado desde</label><input type="date" id="rfDesde"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="rfHasta"></div>
        <div class="campo"><label>Booking</label><input type="text" id="rfBooking" placeholder="Escriba el booking" autocomplete="off"></div>
        <button class="boton-secundario" id="rfBorrar">Borrar filtro</button>
      </div>
      <div class="rf-cuenta" id="rfCuenta"></div>
      <div class="rf-wrap">
        <table id="tablaRF">
          <colgroup><col style="width:7%"><col style="width:9%"><col style="width:12%"><col style="width:6%"><col style="width:7%"><col style="width:7%">
            <col style="width:8%"><col style="width:8%"><col style="width:9%"><col style="width:9%"><col style="width:7%"><col style="width:6%"><col style="width:5%"></colgroup>
          <thead><tr>
            <th>CLIENTE PARA FACTURACIÓN</th><th>EMPRESA QUE DIO EL SERVICIO</th><th>CONDUCTOR</th><th>PLACA</th><th>ALMACEN DE SALIDA</th>
            <th>ALMACEN DE LLEGADA</th><th>DESTINO</th><th class="negro">BOOKING</th><th class="negro">CONTENEDOR</th><th>CLIENTE</th>
            <th>FECHA DE FACTURACIÓN</th><th>NÚMERO DE FACTURA</th><th>VENTA DOLARES</th>
          </tr></thead>
          <tbody></tbody>
          <tfoot></tfoot>
        </table>
      </div>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="rfCerrar">Cerrar</button>
        <button class="boton-primario" id="rfCopiar">Copiar para correo</button>
      </div>`;

    abrirPanel('Reporte de facturación', html, function (raiz) {
      const filas = r.filas.slice().sort(function (a, b) { return String(b.fechaFacturacion).localeCompare(String(a.fechaFacturacion)) || String(a.factura).localeCompare(String(b.factura)); });
      const $ = function (id) { return raiz.querySelector('#' + id); };
      const fechaVista = function (v) { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[3]) + '/' + Number(m[2]) + '/' + m[1] : ''; };
      const usd = function (n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
      let visibles = [];
      const msCliente = crearMultiSelect($('msRFCliente'), { onChange: pintar });
      msCliente.setOpciones(Array.from(new Set(filas.map(f => f.clienteFacturacion).filter(Boolean))).sort());

      function pintar() {
        const desde = $('rfDesde').value, hasta = $('rfHasta').value;
        const bk = $('rfBooking').value.trim().toUpperCase();
        visibles = filas.filter(function (f) {
          if (!msCliente.cumple(f.clienteFacturacion)) return false;
          if (desde && f.fechaFacturacion < desde) return false;
          if (hasta && f.fechaFacturacion > hasta) return false;
          if (bk && f.booking.indexOf(bk) === -1) return false;
          return true;
        });
        $('tablaRF').querySelector('tbody').innerHTML = visibles.length ? visibles.map(function (f) {
          return '<tr><td>' + esc(f.clienteFacturacion) + '</td><td>' + esc(f.empresa) + '</td><td>' + esc(f.conductor) + '</td><td>' + esc(f.placa) +
            '</td><td>' + esc(f.almacenSalida) + '</td><td>' + esc(f.almacenLlegada) + '</td><td>' + esc(f.destino) + '</td><td>' + esc(f.booking) +
            '</td><td>' + esc(f.contenedor) + '</td><td>' + esc(f.clienteGuia) + '</td><td>' + esc(fechaVista(f.fechaFacturacion)) + '</td><td>' + esc(f.factura) +
            '</td><td>' + usd(f.ventaDolares) + '</td></tr>';
        }).join('') : '<tr><td colspan="13" style="color:#8b95a1;padding:16px;">No hay facturas con estos filtros.</td></tr>';
        const total = visibles.reduce(function (a, f) { return a + (Number(f.ventaDolares) || 0); }, 0);
        $('tablaRF').querySelector('tfoot').innerHTML = visibles.length ? '<tr><td colspan="12" style="text-align:right">TOTAL (' + visibles.length + ' servicio' + (visibles.length === 1 ? '' : 's') + ')</td><td>' + usd(total) + '</td></tr>' : '';
        $('rfCuenta').textContent = visibles.length + ' factura(s) · total ' + usd(total);
        if (typeof _refrescarSnapshotFormulario === 'function') _refrescarSnapshotFormulario();
      }

      // Tabla con estilos en línea para que se vea igual al pegarla en el correo.
      function htmlCorreo() {
        const th = 'style="background:#808080;color:#fff;border:1px solid #000;padding:4px 6px;font-family:Calibri,Arial;font-size:11pt;font-weight:bold;text-align:center"';
        const thN = th.replace('#808080', '#000000');
        const td = function (par) { return 'style="background:' + (par ? '#dbe8f5' : '#c5d9f1') + ';border:1px solid #000;padding:3px 6px;font-family:Calibri,Arial;font-size:11pt;text-align:center"'; };
        const cab = ['CLIENTE PARA FACTURACION', 'EMPRESA QUE DIO EL SERVICIO', 'CONDUCTOR', 'PLACA', 'ALMACEN DE SALIDA', 'ALMACEN DE LLEGADA', 'DESTINO', 'BOOKING', 'CONTENEDOR', 'CLIENTE', 'FECHA DE FACTURACIÓN', 'NÚMERO DE FACTURA', 'VENTA DOLARES'];
        let h = '<table style="border-collapse:collapse"><tr>' + cab.map(function (c) { return '<th ' + (c === 'BOOKING' || c === 'CONTENEDOR' ? thN : th) + '>' + c + '</th>'; }).join('') + '</tr>';
        visibles.forEach(function (f, i) {
          h += '<tr>' + [f.clienteFacturacion, f.empresa, f.conductor, f.placa, f.almacenSalida, f.almacenLlegada, f.destino, f.booking, f.contenedor, f.clienteGuia,
            fechaVista(f.fechaFacturacion), f.factura, usd(f.ventaDolares)].map(function (v) { return '<td ' + td(i % 2) + '>' + esc(v) + '</td>'; }).join('') + '</tr>';
        });
        return h + '</table>';
      }
      function textoPlano() {
        return visibles.map(function (f) {
          return [f.clienteFacturacion, f.empresa, f.conductor, f.placa, f.almacenSalida, f.almacenLlegada, f.destino, f.booking, f.contenedor, f.clienteGuia, fechaVista(f.fechaFacturacion), f.factura, usd(f.ventaDolares)].join('\t');
        }).join('\n');
      }

      $('rfCopiar').addEventListener('click', async function () {
        if (!visibles.length) { mostrarMensaje('No hay filas para copiar.', 'error'); return; }
        try {
          await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([htmlCorreo()], { type: 'text/html' }),
            'text/plain': new Blob([textoPlano()], { type: 'text/plain' })
          })]);
          mostrarMensaje('Tabla copiada (' + visibles.length + ' fila(s)). Pégala en el correo con Ctrl+V.', 'exito');
        } catch (e) {
          mostrarMensaje('No se pudo copiar automáticamente. Selecciona la tabla con el mouse y cópiala con Ctrl+C.', 'error');
        }
      });
      ['rfDesde', 'rfHasta'].forEach(function (id) { $(id).addEventListener('change', pintar); });
      let espera = null;
      $('rfBooking').addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(pintar, 250); });
      $('rfBorrar').addEventListener('click', function () {
        msCliente.limpiar(); ['rfDesde', 'rfHasta', 'rfBooking'].forEach(function (id) { $(id).value = ''; }); pintar();
      });
      $('rfCerrar').addEventListener('click', cerrarPanel);
      pintar();
    }, { ancho: true });
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-reporte-facturacion');
  if (b) b.addEventListener('click', function () { FormReporteFacturacion.abrir(); });
});
