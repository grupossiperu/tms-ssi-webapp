/**
 * forms/sobrecostos.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmSobrecostos.frm (VBA): un simple menú con dos
 * botones (Sobreestadía / Pernocte) que abren frmSeleccionSobrecosto con
 * el tipo correspondiente, igual que btnSobreestadia_Click/btnPernocte_Click.
 * -------------------------------------------------------------------------
 */
const FormSobrecostos = {
  abrir: function () {
    const html = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <button class="boton-modulo" id="btnSobreestadia" style="justify-content:center;">SOBREESTADÍA</button>
        <button class="boton-modulo" id="btnPernocte" style="justify-content:center;">PERNOCTE</button>
      </div>`;

    abrirPanel('Sobrecostos', html, function (raiz) {
      raiz.querySelector('#btnSobreestadia').addEventListener('click', function () {
        FormSeleccionSobrecosto.abrir('SOBREESTADIA');
      });
      raiz.querySelector('#btnPernocte').addEventListener('click', function () {
        FormSeleccionSobrecosto.abrir('PERNOCTE');
      });
    });
  }
};
