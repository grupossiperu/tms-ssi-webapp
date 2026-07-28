/**
 * forms/tarifas.js
 * -------------------------------------------------------------------------
 * Matriz de Tarifas. Pantalla nueva (no existía en el VBA original).
 *
 * Registra el precio acordado para una ruta completa:
 *   Fecha + Cliente + Ciudad de retiro + Destino 1 + Destino 2 +
 *   Ciudad de devolución + Tarifa (S/ o $)
 *
 * Todos los combos son de texto libre con lista sugerida (<datalist>), así
 * que se puede elegir un valor existente o escribir uno nuevo sin pasos
 * extra: al grabar, el valor nuevo queda disponible para la próxima vez.
 *
 * El histórico se conserva completo; Registrar Servicio usa siempre la
 * tarifa más reciente de cada ruta.
 * -------------------------------------------------------------------------
 */
const FormTarifas = {

  abrir: async function () {
    const datos = await llamarBackend('datosIniciales_Tarifas', {});

    const opciones = function (lista) {
      return (lista || []).map(function (v) { return `<option value="${v}">`; }).join('');
    };

    const html = `
      <div class="aviso-caja">
        Registre aquí el precio acordado por ruta. Al registrar un servicio con la
        misma combinación de cliente, ciudad de retiro, destinos y ciudad de devolución,
        la tarifa se completará automáticamente. Si vuelve a registrar la misma ruta
        con otro precio, se conserva el historial y se usará siempre la más reciente.
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label>Fecha</label>
          <input type="text" id="txtFechaTarifa" placeholder="dd/mm/yyyy">
        </div>
        <div class="campo">
          <label>Cliente</label>
          <input list="lst-tarClientes" id="cboClienteTarifa" placeholder="Escriba o elija">
          <datalist id="lst-tarClientes">${opciones(datos.clientes)}</datalist>
        </div>
        <div class="campo">
          <label>Ciudad de retiro</label>
          <input list="lst-tarRetiro" id="cboCiudadRetiroTarifa" placeholder="Escriba o elija">
          <datalist id="lst-tarRetiro">${opciones(datos.ciudadesRetiro)}</datalist>
        </div>
        <div class="campo">
          <label>Destino 1</label>
          <input list="lst-tarDestinos" id="cboDestino1Tarifa" placeholder="Escriba o elija">
        </div>
        <div class="campo">
          <label>Destino 2 (opcional)</label>
          <input list="lst-tarDestinos" id="cboDestino2Tarifa" placeholder="Escriba o elija">
          <datalist id="lst-tarDestinos">${opciones(datos.destinos)}</datalist>
        </div>
        <div class="campo">
          <label>Ciudad de devolución</label>
          <input list="lst-tarDevolucion" id="cboCiudadDevolucionTarifa" placeholder="Escriba o elija">
          <datalist id="lst-tarDevolucion">${opciones(datos.ciudadesDevolucion)}</datalist>
        </div>
        <div class="campo">
          <label>Tarifa</label>
          <div class="fila-combo-mas">
            <input type="text" id="txtTarifaValor" placeholder="0.00">
            <button type="button" class="boton-moneda activo" data-moneda="S">S/</button>
            <button type="button" class="boton-moneda" data-moneda="D">$</button>
          </div>
        </div>
        <div class="campo" style="display:flex; align-items:flex-end;">
          <button class="boton-primario" id="btnGuardarTarifa" style="width:100%;">Guardar tarifa</button>
        </div>
      </div>

      <div class="barra-filtros">
        <div class="campo"><label>Estado</label>
          <select id="filtroEstadoTarifa">
            <option value="">Todas</option>
            <option value="vigente">Vigentes</option>
            <option value="vencida">Vencidas</option>
          </select>
        </div>
      </div>

      <div style="max-height:340px; overflow:auto; margin-top:6px;">
        <table class="tabla-lista" id="tablaTarifas">
          <thead><tr>
            <th>Fecha</th><th>Cliente</th><th>Ciudad de retiro</th><th>Destino 1</th>
            <th>Destino 2</th><th>Ciudad de devolución</th><th>Tarifa</th><th></th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="panel-footer" style="padding-top:10px;">
        <button class="boton-secundario" id="btnCerrarTarifas">Cerrar</button>
      </div>`;

    abrirPanel('Tarifas', html, (raiz) => this._wire(raiz), { ancho: true });
  },

  _moneda: 'S',

  _wire: function (raiz) {
    const self = this;
    self._moneda = 'S';

    const hoy = new Date();
    raiz.querySelector('#txtFechaTarifa').value =
      String(hoy.getDate()).padStart(2, '0') + '/' +
      String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear();

    // Botones de moneda: solo marcan cuál está activa; el valor se escribe
    // limpio en el campo y el símbolo se muestra al listar.
    raiz.querySelectorAll('.boton-moneda').forEach(function (boton) {
      boton.addEventListener('click', function () {
        self._moneda = boton.dataset.moneda;
        raiz.querySelectorAll('.boton-moneda').forEach(function (b) { b.classList.remove('activo'); });
        boton.classList.add('activo');
      });
    });

    function simbolo(m) {
      return String(m || '').trim().toUpperCase() === 'D' ? '$ ' : 'S/ ';
    }

    function formatoFecha(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return String(d.getDate()).padStart(2, '0') + '/' +
        String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    async function cargar() {
      const resp = await llamarBackend('listarTarifas', {});
      const tbody = raiz.querySelector('#tablaTarifas tbody');
      tbody.innerHTML = '';

      const filtro = raiz.querySelector('#filtroEstadoTarifa').value;

      // Marca cuál es la tarifa vigente de cada ruta (la primera que
      // aparece de cada combinación, porque vienen ordenadas de más
      // reciente a más antigua). El resto de esa ruta queda vencida.
      const vistas = {};

      (resp.tarifas || []).forEach(function (t) {
        const clave = [t['CLIENTE'], t['CIUDAD DE RETIRO'], t['DESTINO 1'], t['DESTINO 2'], t['CIUDAD DE DEVOLUCION']]
          .map(function (v) { return String(v || '').trim().toUpperCase(); }).join('|');
        const vigente = !vistas[clave];
        vistas[clave] = true;

        if (filtro === 'vigente' && !vigente) return;
        if (filtro === 'vencida' && vigente) return;

        const tr = document.createElement('tr');
        if (!vigente) tr.style.opacity = '.55';
        tr.innerHTML = `
          <td>${formatoFecha(t['FECHA'])}</td>
          <td>${t['CLIENTE'] || ''}</td>
          <td>${t['CIUDAD DE RETIRO'] || ''}</td>
          <td>${t['DESTINO 1'] || ''}</td>
          <td>${t['DESTINO 2'] || ''}</td>
          <td>${t['CIUDAD DE DEVOLUCION'] || ''}</td>
          <td>${simbolo(t['MONEDA'])}${(Number(t['TARIFA']) || 0).toFixed(2)}</td>
          <td>${vigente
            ? '<span class="badge-datos completo">Vigente</span>'
            : '<span class="badge-datos historico">Vencida</span>'}</td>`;
        tbody.appendChild(tr);
      });
    }

    raiz.querySelector('#filtroEstadoTarifa').addEventListener('change', cargar);

    raiz.querySelector('#btnGuardarTarifa').addEventListener('click', async function () {
      const v = function (id) { return raiz.querySelector('#' + id).value.trim(); };

      const resp = await llamarBackend('agregarTarifa', {
        fecha: v('txtFechaTarifa'),
        cliente: v('cboClienteTarifa'),
        ciudadRetiro: v('cboCiudadRetiroTarifa'),
        destino1: v('cboDestino1Tarifa'),
        destino2: v('cboDestino2Tarifa'),
        ciudadDevolucion: v('cboCiudadDevolucionTarifa'),
        tarifa: v('txtTarifaValor'),
        moneda: self._moneda
      });

      if (!resp.ok) {
        mostrarMensaje(resp.mensaje, 'error');
        return;
      }

      mostrarMensaje(resp.mensaje, 'exito');
      raiz.querySelector('#txtTarifaValor').value = '';
      cargar();
    });

    raiz.querySelector('#btnCerrarTarifas').addEventListener('click', cerrarPanel);

    cargar();
  }
};
