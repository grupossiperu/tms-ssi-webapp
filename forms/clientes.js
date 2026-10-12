/**
 * forms/clientes.js
 * -------------------------------------------------------------------------
 * Maestro de clientes: código (como aparece en los servicios, ej. DLG),
 * razón social y RUC. Facturar toma de aquí el RUC y la razón social.
 * v79: días de crédito, detracción (SI/NO) e IGV (SI/NO) para Cobranzas.
 * Hoja CLIENTES. Backend: listarClientes, grabarCliente.
 * -------------------------------------------------------------------------
 */
const FormClientes = {

  abrir: async function () {
    const r = await llamarBackend('listarClientes', {});
    if (!respuestaValida(r) || !Array.isArray(r.clientes)) {
      mostrarMensaje((r && r.mensaje) || 'No se pudo cargar la lista de clientes.', 'error');
      return;
    }
    const html = `
      <style>
        .cli-form { display: grid; grid-template-columns: 110px minmax(0, 1fr) 130px 95px 110px 95px auto; gap: 0 12px; align-items: end; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px 2px; margin-bottom: 14px; }
        .cli-form .acciones { display: flex; gap: 8px; margin-bottom: 12px; }
        .cli-tabla { width: 100%; table-layout: fixed; }
        .cli-tabla td, .cli-tabla th { padding: 7px 8px; }
        .cli-tabla tbody tr { cursor: pointer; }
        .cli-tabla tbody tr:hover td { background: #eef4fb; }
        .cli-ayuda { font-size: .78rem; color: #64748b; margin: -6px 0 10px; }
        @media (max-width: 700px) { .cli-form { grid-template-columns: 1fr; } }
      </style>
      <div class="cli-form">
        <div class="campo"><label>Código</label><input id="txtCodigoCli" autocomplete="off" placeholder="Ej. DLG" style="text-transform:uppercase"></div>
        <div class="campo"><label>Razón social</label><input id="txtRazonCli" autocomplete="off" style="text-transform:uppercase"></div>
        <div class="campo"><label>RUC</label><input id="txtRucCli" autocomplete="off" maxlength="11" inputmode="numeric"></div>
        <div class="campo"><label>Días crédito</label><input id="txtDiasCli" type="number" min="0" max="365" value="30"></div>
        <div class="campo"><label>Detracción</label><select id="selDetrCli"><option value="SI">Con detracción</option><option value="NO">Sin detracción</option></select></div>
        <div class="campo"><label>IGV</label><select id="selIgvCli"><option value="SI">Con IGV</option><option value="NO">Sin IGV</option></select></div>
        <div class="acciones">
          <button class="boton-secundario" id="btnNuevoCli">Nuevo</button>
          <button class="boton-primario" id="btnGrabarCli">Agregar</button>
        </div>
      </div>
      <div class="cli-ayuda">El código debe ser igual al que usas en los servicios (cliente para facturación). Días de crédito, detracción e IGV definen el vencimiento y lo que el cliente paga a SSI en Cobranzas. Haz clic en un cliente para corregirlo.</div>
      <table class="tabla-lista cli-tabla" id="tablaClientes">
        <colgroup><col style="width:120px"><col><col style="width:130px"><col style="width:90px"><col style="width:120px"><col style="width:90px"></colgroup>
        <thead><tr><th>Código</th><th>Razón social</th><th>RUC</th><th>Crédito</th><th>Detracción</th><th>IGV</th></tr></thead>
        <tbody></tbody>
      </table>
      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnCerrarCli">Cerrar</button>
      </div>`;

    abrirPanel('Clientes', html, function (raiz) {
      let clientes = r.clientes;
      let filaEditando = 0;
      const $ = function (id) { return raiz.querySelector('#' + id); };
      function pintar() {
        $('tablaClientes').querySelector('tbody').innerHTML = clientes.length
          ? clientes.map(function (c) {
              return '<tr data-fila="' + c.fila + '"><td><b>' + esc(c.codigo) + '</b></td><td>' + esc(c.razonSocial) + '</td><td>' + esc(c.ruc) + '</td><td>' + (c.diasCredito === undefined ? 30 : c.diasCredito) + ' días</td><td>' + (c.detraccion === false ? 'Sin detracción' : 'Con detracción') + '</td><td>' + (c.igv === false ? 'Sin IGV' : 'Con IGV') + '</td></tr>';
            }).join('')
          : '<tr><td colspan="6" style="text-align:center;color:#8b95a1;padding:16px;">Sin clientes.</td></tr>';
      }
      function limpiar() {
        filaEditando = 0;
        ['txtCodigoCli', 'txtRazonCli', 'txtRucCli'].forEach(function (id) { $(id).value = ''; });
        $('txtDiasCli').value = 30; $('selDetrCli').value = 'SI'; $('selIgvCli').value = 'SI';
        $('btnGrabarCli').textContent = 'Agregar';
        _refrescarSnapshotFormulario();
      }
      $('tablaClientes').querySelector('tbody').addEventListener('click', function (ev) {
        const tr = ev.target.closest('tr[data-fila]');
        if (!tr) return;
        const c = clientes.find(function (x) { return String(x.fila) === tr.dataset.fila; });
        if (!c) return;
        filaEditando = c.fila;
        $('txtCodigoCli').value = c.codigo;
        $('txtRazonCli').value = c.razonSocial;
        $('txtRucCli').value = c.ruc;
        $('txtDiasCli').value = c.diasCredito === undefined ? 30 : c.diasCredito;
        $('selDetrCli').value = c.detraccion === false ? 'NO' : 'SI';
        $('selIgvCli').value = c.igv === false ? 'NO' : 'SI';
        $('btnGrabarCli').textContent = 'Guardar cambios';
        _refrescarSnapshotFormulario();
      });
      $('btnNuevoCli').addEventListener('click', limpiar);
      $('btnCerrarCli').addEventListener('click', solicitarCierrePanel);
      protegerClic($('btnGrabarCli'), async function () {
        const resp = await llamarBackend('grabarCliente', {
          fila: filaEditando, codigo: $('txtCodigoCli').value, razonSocial: $('txtRazonCli').value, ruc: $('txtRucCli').value,
          diasCredito: $('txtDiasCli').value, detraccion: $('selDetrCli').value, igv: $('selIgvCli').value
        });
        if (!resp || !resp.ok) { mostrarMensaje((resp && resp.mensaje) || 'No se pudo grabar el cliente.', 'error'); return; }
        const lista = await llamarBackend('listarClientes', {});
        if (lista && Array.isArray(lista.clientes)) clientes = lista.clientes;
        pintar();
        limpiar();
        mostrarMensaje(resp.mensaje, 'exito');
      });
      pintar();
    }, { ancho: true });
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const b = document.getElementById('btn-clientes');
  if (b) b.addEventListener('click', function () { FormClientes.abrir(); });
});
