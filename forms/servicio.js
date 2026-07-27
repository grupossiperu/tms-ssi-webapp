/**
 * forms/servicio.js
 * -------------------------------------------------------------------------
 * Equivalente HTML de frmServicio.frm (VBA) - "Registrar Servicio".
 * Réplica 1:1 de la lógica: combos con valores fijos + valores únicos de
 * SERVICIOS, validación de conductor contra PERSONAL, búsqueda automática
 * de costos por destino en BD_SERVICIOS (con alta de destino nuevo si no
 * existe), cálculo de combustible y total por viaje, validación de hora y
 * de número de contenedor, y todas las validaciones obligatorias de
 * btnGrabarServicio_Click en el mismo orden.
 * -------------------------------------------------------------------------
 */
const FormServicio = {

  _tipoAbastecimiento: '',
  _modoEdicion: false,
  _filaEdicion: null,

  abrir: async function (filaEdicion) {
    const datos = await llamarBackend('datosIniciales_Servicio', {});
    this._modoEdicion = !!filaEdicion;
    this._filaEdicion = filaEdicion || null;
    this._tipoAbastecimiento = '';

    const opciones = function (lista) {
      return '<option value=""></option>' + lista.map(function (v) {
        return `<option value="${v}">${v}</option>`;
      }).join('');
    };

    const html = `
      <div class="fila-campos">
        <div class="campo">
          <label>Fecha de registro</label>
          <input type="text" id="txtFechaServicioRegistro" placeholder="dd/mm/yyyy">
        </div>
        <div class="campo">
          <label>Cliente para facturación</label>
          <input list="lst-clientes" id="cboClienteFacturacion">
          <datalist id="lst-clientes">${datos.clientesFacturacion.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Empresa que dio el servicio</label>
          <input list="lst-empresas" id="cboEmpresaServicio">
          <datalist id="lst-empresas">${datos.empresas.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Conductor</label>
          <div class="fila-combo-mas">
            <select id="cboConductorServicio"><option value=""></option>${datos.conductores.map(v => `<option value="${v}">${v}</option>`).join('')}</select>
            <button type="button" id="btnAgregarConductor" class="boton-mas" title="Agregar conductor nuevo">+</button>
          </div>
        </div>
        <div class="campo">
          <label>Placa tracto</label>
          <div class="fila-combo-mas">
            <select id="cboPlacaTractoServicio">${opciones(datos.placasTracto)}</select>
            <button type="button" id="btnAgregarTracto" class="boton-mas" title="Agregar placa de tracto nueva">+</button>
          </div>
        </div>
        <div class="campo">
          <label>Placa carreta</label>
          <div class="fila-combo-mas">
            <select id="cboPlacaCarretaServicio">${opciones(datos.placasCarreta)}</select>
            <button type="button" id="btnAgregarCarreta" class="boton-mas" title="Agregar placa de carreta nueva">+</button>
          </div>
        </div>
        <div class="campo">
          <label>Tipo de carga</label>
          <select id="cboTipoCarga">${opciones(datos.tipoCarga)}</select>
        </div>
        <div class="campo">
          <label>Booking</label>
          <input type="text" id="txtBookingServicio">
        </div>
        <div class="campo">
          <label>N° Contenedor (ABCU1234567)</label>
          <input type="text" id="txtContenedorServicio">
        </div>
        <div class="campo">
          <label>Destino 1</label>
          <input list="lst-destinos" id="cboDestino1Servicio">
        </div>
        <div class="campo">
          <label>Tarifa 1</label>
          <input type="text" id="txtTarifa1Servicio">
        </div>
        <div class="campo">
          <label>Destino 2 (solo carga consolidado)</label>
          <input list="lst-destinos" id="cboDestino2Servicio" disabled>
          <datalist id="lst-destinos">${datos.destinos.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Tarifa 2 (solo carga consolidado)</label>
          <input type="text" id="txtTarifa2Servicio" disabled>
        </div>
        <div class="campo">
          <label>Depósito de retiro</label>
          <input list="lst-depRetiro" id="cboDepositoRetiro">
          <datalist id="lst-depRetiro">${datos.depositosRetiro.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Fecha de retiro</label>
          <input type="text" id="txtFechaRetiroServicio" placeholder="dd/mm/yyyy">
        </div>
        <div class="campo">
          <label>Hora de retiro</label>
          <input type="text" id="txtHoraRetiroServicio" placeholder="08:00">
        </div>
        <div class="campo">
          <label>Depósito de devolución</label>
          <input list="lst-depDevolucion" id="cboDepositoDevolucion">
          <datalist id="lst-depDevolucion">${datos.depositosDevolucion.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Fecha de devolución</label>
          <input type="text" id="txtFechaDevolucion" placeholder="dd/mm/yyyy o -">
        </div>
        <div class="campo">
          <label>Hora de devolución</label>
          <input type="text" id="txtHoraDevolucion" placeholder="hh:mm o -">
        </div>
        <div class="campo">
          <label>Fecha de posicionamiento</label>
          <input type="text" id="txtFechaPosicionamiento" placeholder="dd/mm/yyyy">
        </div>
        <div class="campo">
          <label>Hora de posicionamiento</label>
          <input type="text" id="txtHoraPosicionamiento" placeholder="hh:mm">
        </div>
        <div class="campo">
          <label>Tipo de producto</label>
          <input list="lst-tipoProd" id="cboTipoProductoServicio">
          <datalist id="lst-tipoProd">${datos.tipoProducto.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Tipo de tratamiento</label>
          <input list="lst-tipoTrat" id="cboTipoTratamiento">
          <datalist id="lst-tipoTrat">${datos.tipoTratamiento.map(v => `<option value="${v}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label>Costo del petróleo x galón</label>
          <input type="text" id="txtCostoPetroleoGalon">
        </div>
        <div class="campo">
          <label>Galones tracto</label>
          <input type="text" id="txtGlTracto">
        </div>
        <div class="campo">
          <label>Total tracto</label>
          <input type="text" id="txtTotalTracto" disabled>
        </div>
        <div class="campo">
          <label>Galones generador</label>
          <input type="text" id="txtGlGenerador">
        </div>
        <div class="campo">
          <label>Total generador</label>
          <input type="text" id="txtTotalGenerador" disabled>
        </div>
        <div class="campo">
          <label>Viático</label>
          <input type="text" id="txtViaticoServicio">
        </div>
        <div class="campo">
          <label>Peaje</label>
          <input type="text" id="txtPeajeServicio">
        </div>
        <div class="campo">
          <label>Cochera</label>
          <input type="text" id="txtCocheraServicio">
        </div>
        <div class="campo">
          <label>Monto depositado</label>
          <input type="text" id="txtMontoDepositadoServicio" disabled>
        </div>
        <div class="campo">
          <label>Total por viaje</label>
          <input type="text" id="txtTotalViaje" disabled>
        </div>
      </div>
      <div class="panel-footer" style="padding-top:10px; justify-content:space-between;">
        <button class="boton-secundario" id="btnInicioServicio">Inicio</button>
        <div style="display:flex; gap:10px;">
          <button class="boton-secundario" id="btnCalcularServicio">Calcular</button>
          <button class="boton-primario" id="btnGrabarServicio">Grabar</button>
        </div>
      </div>`;

    abrirPanel('Registrar Servicio', html, (raiz) => this._wire(raiz));

    if (filaEdicion) {
      // Carga los datos de la fila para edición (equivalente a
      // CargarServicioEdicion en el VBA original).
      const registro = await llamarBackend('cargarDatosServicioParaConsolidado', {}); // no aplica aquí directamente
    } else {
      document.getElementById('txtFechaServicioRegistro').value = this._fechaHoy();
    }
  },

  _fechaHoy: function () {
    const hoy = new Date();
    return String(hoy.getDate()).padStart(2, '0') + '/' + String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear();
  },

  _numero: function (texto) {
    if (texto === null || texto === undefined) return 0;
    let t = String(texto).trim().replace(/S\//g, '').replace(/\$/g, '').replace(/\s/g, '');
    if (t === '') return 0;
    const n = parseFloat(t.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  },

  _wire: function (raiz) {
    const self = this;
    document.getElementById('txtFechaServicioRegistro').value = this._fechaHoy();

    // Botones "+" para dar de alta conductor / placa tracto / placa carreta
    // sin salir del formulario (equivalente a mantener PERSONAL/TRACTO/
    // CARRETAS actualizadas desde la propia app, en vez de solo desde Excel).
    raiz.querySelector('#btnAgregarConductor').addEventListener('click', async function () {
      const nombre = prompt('Nombre completo del conductor:');
      if (nombre === null || nombre.trim() === '') return;
      const dni = prompt('N° de DNI del conductor:');
      if (dni === null || dni.trim() === '') return;
      const resp = await llamarBackend('agregarConductor', { conductor: nombre, dni: dni });
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      const select = raiz.querySelector('#cboConductorServicio');
      const opt = document.createElement('option');
      opt.value = resp.conductor; opt.textContent = resp.conductor;
      select.appendChild(opt);
      select.value = resp.conductor;
      mostrarMensaje(resp.mensaje, 'exito');
    });

    raiz.querySelector('#btnAgregarTracto').addEventListener('click', async function () {
      const placa = prompt('Placa del tracto nuevo:');
      if (placa === null || placa.trim() === '') return;
      const resp = await llamarBackend('agregarTracto', { placa: placa });
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      const select = raiz.querySelector('#cboPlacaTractoServicio');
      const opt = document.createElement('option');
      opt.value = resp.placa; opt.textContent = resp.placa;
      select.appendChild(opt);
      select.value = resp.placa;
      mostrarMensaje(resp.mensaje, 'exito');
    });

    raiz.querySelector('#btnAgregarCarreta').addEventListener('click', async function () {
      const placa = prompt('Placa de la carreta nueva:');
      if (placa === null || placa.trim() === '') return;
      const resp = await llamarBackend('agregarCarreta', { placa: placa });
      if (!resp.ok) { mostrarMensaje(resp.mensaje, 'error'); return; }
      const select = raiz.querySelector('#cboPlacaCarretaServicio');
      const opt = document.createElement('option');
      opt.value = resp.placa; opt.textContent = resp.placa;
      select.appendChild(opt);
      select.value = resp.placa;
      mostrarMensaje(resp.mensaje, 'exito');
    });

    function actualizarTotalViaje() {
      const viatico = self._numero(raiz.querySelector('#txtViaticoServicio').value);
      const peaje = self._numero(raiz.querySelector('#txtPeajeServicio').value);
      const cochera = self._numero(raiz.querySelector('#txtCocheraServicio').value);
      const tracto = self._numero(raiz.querySelector('#txtTotalTracto').value);
      const generador = self._numero(raiz.querySelector('#txtTotalGenerador').value);
      raiz.querySelector('#txtTotalViaje').value = (viatico + peaje + cochera + tracto + generador).toFixed(2);
    }

    function calcularMontoDepositado() {
      const viatico = self._numero(raiz.querySelector('#txtViaticoServicio').value);
      const peaje = self._numero(raiz.querySelector('#txtPeajeServicio').value);
      const cochera = self._numero(raiz.querySelector('#txtCocheraServicio').value);
      raiz.querySelector('#txtMontoDepositadoServicio').value = (viatico + peaje + cochera).toFixed(2);
    }

    function calcularCombustible() {
      const costoGalon = self._numero(raiz.querySelector('#txtCostoPetroleoGalon').value);
      const glTracto = self._numero(raiz.querySelector('#txtGlTracto').value);
      const glGenerador = self._numero(raiz.querySelector('#txtGlGenerador').value);
      raiz.querySelector('#txtTotalTracto').value = (costoGalon * glTracto).toFixed(2);
      raiz.querySelector('#txtTotalGenerador').value = (costoGalon * glGenerador).toFixed(2);
      calcularMontoDepositado();
      actualizarTotalViaje();
    }

    ['txtViaticoServicio', 'txtPeajeServicio', 'txtCocheraServicio'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('input', actualizarTotalViaje);
    });
    ['txtCostoPetroleoGalon', 'txtGlTracto', 'txtGlGenerador'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', calcularCombustible);
    });

    // Tarifa 1 / Tarifa 2: pregunta moneda al salir del campo, igual que
    // el InputBox "S = Soles / D = Dólares" del VBA original.
    function preguntarMoneda(input) {
      // Importante: nunca abrir un prompt()/alert()/confirm() de forma
      // síncrona dentro del propio manejador de "blur". Chrome, al cerrar
      // un diálogo nativo abierto desde blur, reintenta devolver el foco al
      // campo que lo disparó, lo que vuelve a lanzar "blur" y reabre el
      // diálogo en bucle (parece que "no cierra"). Por eso se difiere con
      // setTimeout, para que el diálogo se abra ya fuera del evento blur.
      setTimeout(function () {
        const valorTxt = input.value.trim();
        if (valorTxt === '') return;
        const monto = self._numero(valorTxt);
        let opcion = window.prompt('Ingrese:\nS = Soles\nD = Dólares', 'S');
        if (opcion === null) return;
        opcion = opcion.trim().toUpperCase();
        if (opcion === 'S') input.value = 'S/ ' + monto.toFixed(2);
        else if (opcion === 'D') input.value = '$ ' + monto.toFixed(2);
        else { mostrarMensaje('Ingrese S o D.', 'error'); input.focus(); }
      }, 0);
    }
    raiz.querySelector('#txtTarifa1Servicio').addEventListener('blur', function () { preguntarMoneda(this); });
    raiz.querySelector('#txtTarifa2Servicio').addEventListener('blur', function () { preguntarMoneda(this); });

    // Tipo de carga: habilita/bloquea Destino 2 y Tarifa 2.
    raiz.querySelector('#cboTipoCarga').addEventListener('change', function () {
      const esConsolidado = this.value.trim().toUpperCase() === 'CARGA CONSOLIDADO';
      raiz.querySelector('#cboDestino2Servicio').disabled = !esConsolidado;
      raiz.querySelector('#txtTarifa2Servicio').disabled = !esConsolidado;
      if (!esConsolidado) {
        raiz.querySelector('#cboDestino2Servicio').value = '';
        raiz.querySelector('#txtTarifa2Servicio').value = '';
      }
    });

    // Destino 1 / Destino 2: busca costos automáticamente (Viático/Peaje/Cochera).
    async function alCambiarDestino(numero) {
      const idCampo = numero === 1 ? '#cboDestino1Servicio' : '#cboDestino2Servicio';
      const destino = raiz.querySelector(idCampo).value.trim();
      if (destino === '') return;

      const resp = await llamarBackend('buscarCostosPorDestino', { destino: destino });

      if (resp.encontrado) {
        if (numero === 1) {
          raiz.querySelector('#txtViaticoServicio').value = resp.viatico.toFixed(2);
          raiz.querySelector('#txtPeajeServicio').value = resp.peaje.toFixed(2);
          raiz.querySelector('#txtCocheraServicio').value = resp.cochera.toFixed(2);
          raiz.querySelector('#txtTarifa1Servicio').value = '';
          calcularMontoDepositado();
        } else {
          raiz.querySelector('#txtTarifa2Servicio').value = '';
        }
        return;
      }

      if (!confirmar(`El destino '${destino}' no existe en la base de costos.\n¿Desea agregarlo ahora con viático, peaje y cochera?`)) return;

      const viatico = self._numero(window.prompt('Ingrese el VIÁTICO para ' + destino, '0'));
      const peaje = self._numero(window.prompt('Ingrese el PEAJE para ' + destino, '0'));
      const cochera = self._numero(window.prompt('Ingrese la COCHERA para ' + destino, '0'));

      await llamarBackend('agregarDestinoConCostos', { destino: destino, viatico: viatico, peaje: peaje, cochera: cochera });

      if (numero === 1) {
        raiz.querySelector('#txtViaticoServicio').value = viatico.toFixed(2);
        raiz.querySelector('#txtPeajeServicio').value = peaje.toFixed(2);
        raiz.querySelector('#txtCocheraServicio').value = cochera.toFixed(2);
        raiz.querySelector('#txtTarifa1Servicio').value = '';
        calcularMontoDepositado();
      } else {
        raiz.querySelector('#txtTarifa2Servicio').value = '';
      }
      mostrarMensaje('Destino agregado correctamente a la base de costos.', 'exito');
    }
    // Se difiere con setTimeout por la misma razón que preguntarMoneda: el
    // evento "change" de un campo de texto se procesa junto con "blur", y
    // abrir confirm()/prompt() de forma síncrona ahí puede dejar el diálogo
    // reabriéndose en bucle en Chrome.
    raiz.querySelector('#cboDestino1Servicio').addEventListener('change', function () { setTimeout(function () { alCambiarDestino(1); }, 0); });
    raiz.querySelector('#cboDestino2Servicio').addEventListener('change', function () {
      if (raiz.querySelector('#cboTipoCarga').value.trim().toUpperCase() === 'CARGA CONSOLIDADO') setTimeout(function () { alCambiarDestino(2); }, 0);
    });

    // Validación de horas (equivalente a HoraValidaServicio / ConvertirHoraServicio).
    function validarHora(input, opcional) {
      // Ver nota en preguntarMoneda: el alert() debe diferirse fuera del
      // manejador de "blur" para no quedar en bucle al cerrar el diálogo.
      setTimeout(function () {
        const v = input.value.trim();
        if (v === '' || (opcional && v === '-')) return;
        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](\s?(AM|PM|am|pm))?$/.test(v)) {
          mostrarMensaje('Ingrese una hora válida. Ejemplo: 08:00, 13:00, 12:00 PM.', 'error');
          input.value = '';
          input.focus();
        }
      }, 0);
    }
    raiz.querySelector('#txtHoraRetiroServicio').addEventListener('blur', function () { validarHora(this, false); });
    raiz.querySelector('#txtHoraDevolucion').addEventListener('blur', function () { validarHora(this, true); });
    raiz.querySelector('#txtHoraPosicionamiento').addEventListener('blur', function () { validarHora(this, true); });

    // Validación de contenedor (equivalente a txtContenedorServicio_Exit).
    raiz.querySelector('#txtContenedorServicio').addEventListener('input', function () {
      this.value = this.value.toUpperCase();
    });
    raiz.querySelector('#txtContenedorServicio').addEventListener('blur', function () {
      const campo = this;
      // Ver nota en preguntarMoneda: se difiere fuera de "blur".
      setTimeout(function () {
        const v = campo.value.trim().toUpperCase();
        if (v === '') return;
        if (!/^[A-Z]{3}U[0-9]{7}$/.test(v)) {
          mostrarMensaje('Número de contenedor inválido.\nFormato correcto: ABCU1234567', 'error');
          campo.value = '';
          campo.focus();
        }
      }, 0);
    });

    // Botón Calcular: pregunta si el abastecimiento fue por proveedor.
    raiz.querySelector('#btnCalcularServicio').addEventListener('click', function () {
      const viatico = self._numero(raiz.querySelector('#txtViaticoServicio').value);
      const peaje = self._numero(raiz.querySelector('#txtPeajeServicio').value);
      const cochera = self._numero(raiz.querySelector('#txtCocheraServicio').value);
      const tracto = self._numero(raiz.querySelector('#txtTotalTracto').value);
      const generador = self._numero(raiz.querySelector('#txtTotalGenerador').value);

      const esProveedor = confirmar('¿El abastecimiento fue por proveedor?\n(Aceptar = Sí / Cancelar = No)');
      let montoDepositado;
      if (esProveedor) {
        self._tipoAbastecimiento = 'PROVEEDOR';
        montoDepositado = viatico + peaje + cochera;
      } else {
        self._tipoAbastecimiento = 'CONTADO';
        montoDepositado = viatico + peaje + cochera + tracto + generador;
      }
      raiz.querySelector('#txtMontoDepositadoServicio').value = montoDepositado.toFixed(2);
      mostrarMensaje('Monto depositado calculado correctamente.', 'exito');
    });

    raiz.querySelector('#btnInicioServicio').addEventListener('click', cerrarPanel);

    raiz.querySelector('#btnGrabarServicio').addEventListener('click', async function () {
      const v = function (id) { return raiz.querySelector('#' + id).value; };

      const payload = {
        fechaServicioRegistro: v('txtFechaServicioRegistro'),
        clienteFacturacion: v('cboClienteFacturacion'),
        empresaServicio: v('cboEmpresaServicio'),
        conductor: v('cboConductorServicio'),
        placaTracto: v('cboPlacaTractoServicio'),
        placaCarreta: v('cboPlacaCarretaServicio'),
        tipoCarga: v('cboTipoCarga'),
        destino1: v('cboDestino1Servicio'),
        destino2: v('cboDestino2Servicio'),
        booking: v('txtBookingServicio'),
        contenedor: v('txtContenedorServicio'),
        depositoRetiro: v('cboDepositoRetiro'),
        fechaRetiro: v('txtFechaRetiroServicio'),
        horaRetiro: v('txtHoraRetiroServicio'),
        depositoDevolucion: v('cboDepositoDevolucion'),
        fechaDevolucion: v('txtFechaDevolucion'),
        horaDevolucion: v('txtHoraDevolucion'),
        fechaPosicionamiento: v('txtFechaPosicionamiento'),
        horaPosicionamiento: v('txtHoraPosicionamiento'),
        tipoProducto: v('cboTipoProductoServicio'),
        tipoTratamiento: v('cboTipoTratamiento'),
        costoPetroleoGalon: v('txtCostoPetroleoGalon'),
        glTracto: v('txtGlTracto'),
        totalTracto: v('txtTotalTracto'),
        glGenerador: v('txtGlGenerador'),
        totalGenerador: v('txtTotalGenerador'),
        viatico: v('txtViaticoServicio'),
        peaje: v('txtPeajeServicio'),
        cochera: v('txtCocheraServicio'),
        montoDepositado: v('txtMontoDepositadoServicio'),
        totalViaje: v('txtTotalViaje'),
        tarifa1: v('txtTarifa1Servicio'),
        tarifa2: v('txtTarifa2Servicio'),
        tipoAbastecimiento: self._tipoAbastecimiento,
        modoEdicion: self._modoEdicion,
        filaEdicion: self._filaEdicion
      };

      const resp = await llamarBackend('grabarServicio', payload);

      if (!resp.ok) {
        mostrarMensaje(resp.mensaje, 'error');
        if (resp.foco && raiz.querySelector('#' + (idsMapeo[resp.foco] || resp.foco))) {
          raiz.querySelector('#' + (idsMapeo[resp.foco] || resp.foco)).focus();
        }
        return;
      }

      mostrarMensaje(resp.mensaje, 'exito');
      cerrarPanel();
    });

    const idsMapeo = {
      clienteFacturacion: 'cboClienteFacturacion', empresaServicio: 'cboEmpresaServicio',
      conductor: 'cboConductorServicio', placaTracto: 'cboPlacaTractoServicio',
      placaCarreta: 'cboPlacaCarretaServicio', tipoCarga: 'cboTipoCarga',
      destino1: 'cboDestino1Servicio', destino2: 'cboDestino2Servicio',
      depositoRetiro: 'cboDepositoRetiro', fechaRetiro: 'txtFechaRetiroServicio',
      horaRetiro: 'txtHoraRetiroServicio', depositoDevolucion: 'cboDepositoDevolucion',
      fechaDevolucion: 'txtFechaDevolucion', horaDevolucion: 'txtHoraDevolucion',
      contenedor: 'txtContenedorServicio', tipoProducto: 'cboTipoProductoServicio',
      tipoTratamiento: 'cboTipoTratamiento', btnCalcular: 'btnCalcularServicio'
    };
  }
};
