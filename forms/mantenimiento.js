/**
 * forms/mantenimiento.js
 * -------------------------------------------------------------------------
 * Módulo MANTENIMIENTO. Copia el flujo del Excel "SISTEMA DE CONTROL DE
 * MANTENIMIENTO":
 *
 *  1. REGISTRAR MANTENIMIENTO
 *     a) Selección: lista las salidas de almacén con motivo MANTENIMIENTO
 *        aún PENDIENTES. Se escribe el nombre de la reparación y se marcan
 *        los repuestos (todos de la misma placa). La fecha inicial es la de
 *        la salida más antigua y los técnicos son los que recibieron los
 *        repuestos. O "Continuar sin repuesto" (taller externo, etc.).
 *     b) Detalle: tipo, sistema, método, lugar, técnico, repuesto usado,
 *        kilometraje (no menor al último de la placa; si sube más de
 *        20 000 km pide confirmación) y costo opcional. Cada detalle es una
 *        fila; el repuesto usado pasa a ASOCIADO.
 *  2. REGISTRAR REPORTE DE FALLAS: placa, km (o PENDIENTE), quien reporta,
 *     documento, código de falla (trae sistema y componente) y detalle.
 *  3. CONTROL DE REPORTE DE FALLAS: lista las fallas pendientes y marca
 *     las elegidas como SOLUCIONADO.
 *
 * Usa los ayudantes MT y MT_ESTILOS de forms/almacen.js.
 * Backend: mtDatosMantenimiento, mtGrabarMantenimiento, mtGrabarFalla,
 * mtSolucionarFallas.
 * -------------------------------------------------------------------------
 */

const MTM_TIPOS = ['CORRECTIVO', 'PREVENTIVO', 'PREDICTIVO'];
const MTM_SISTEMAS = ['MOTOR', 'CAJA', 'TRANSMISIÓN', 'DIRECCIÓN', 'FRENOS', 'ENFRIAMIENTO', 'SUSPENSIÓN', 'ELÉCTRICO', 'LUCES',
  'COMBUSTIBLE', 'ESCAPE', 'EMBRAGUE', 'NEUMÁTICO', 'CHASIS', 'CARRETA', 'CABINA', 'TURBO', 'RADIADOR', 'OTROS'];
const MTM_METODOS = ['AJUSTE', 'CALIBRACIÓN', 'DIAGNÓSTICO', 'ESCANEO', 'INSTALACIÓN', 'LIMPIEZA', 'LUBRICACIÓN', 'MANTENIMIENTO',
  'PRUEBA', 'REAJUSTE', 'RECTIFICADO', 'REEMPLAZO', 'REMAN', 'REPARACIÓN', 'ROTACIÓN', 'SOLDADURA', 'OTROS'];
const MTM_TALLERES = ['TALLER EXTERNO', 'SSI', 'TIMO', 'TURBO 2000', 'COASA'];
const MTM_TIPOS_COSTO = ['SERVICIO', 'MANO DE OBRA', 'OTROS'];

function _mtmAbreviarSistema(s) {
  const t = String(s || '').trim().toUpperCase();
  if (t === 'CABINA Y OTROS COMPONENTES DEL REMOLCADOR') return 'CABINA/REMOLC.';
  if (t === 'OTROS COMPONENTES DEL REMOLCADOR Y/O SEMIRREMOLQUE') return 'OTROS COMP. REM./SEMIR.';
  if (t === 'OTROS COMPONENTES DEL SEMIRREMOLQUE') return 'OTROS COMP. SEMIR.';
  return t;
}

const FormMantenimiento = {

  _datos: null,

  _cargar: async function () {
    const r = await MT.llamar('mtDatosMantenimiento', {});
    if (r && !Array.isArray(r.salidas)) {
      mostrarMensaje('El servidor no devolvió los datos de mantenimiento. Intente de nuevo en unos segundos.', 'error');
      return null;
    }
    if (r) this._datos = r;
    return r;
  },

  /* ============================ 1a. SELECCIÓN DE SALIDAS ============================ */

  abrirRegistrar: async function () {
    if (!(await this._cargar())) return;
    const self = this;
    const salidas = self._datos.salidas;

    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="fila-campos" style="grid-template-columns:repeat(2,minmax(0,1fr));">
          <div class="campo ancho4"><label>Nombre de la reparación</label>
            <input type="text" id="mNombreSel" autocomplete="off" style="text-transform:uppercase" placeholder="Ej.: CAMBIO DE BATERÍA"></div>
        </div>
        <div class="mt-ayuda" style="margin-bottom:6px;">Marque los repuestos (salidas de almacén pendientes de mantenimiento) usados en esta reparación. Deben ser de la misma placa.</div>
        <div class="mt-tabla-wrap">
          <table class="tabla-lista" id="tablaSalidasMant">
            <thead><tr><th style="width:34px"></th><th>Fecha</th><th>Hora</th><th>Técnico</th><th>Placa</th><th>Código</th><th>Producto</th><th>Cantidad</th></tr></thead>
            <tbody>${salidas.length ? salidas.map((s, i) => `
              <tr data-i="${i}">
                <td style="text-align:center"><input type="checkbox" class="chk-sal" data-i="${i}"></td>
                <td>${esc(MT.fechaVista(s.fecha))}</td><td>${esc(s.hora)}</td><td>${esc(s.tecnico)}</td><td>${esc(s.placa)}</td>
                <td>${esc(s.codigo)}</td><td>${esc(s.producto)}</td><td style="text-align:center">${esc(s.cantidad)}</td>
              </tr>`).join('') : '<tr><td colspan="8" style="text-align:center;color:#8b95a1;padding:16px;">No hay salidas pendientes para mantenimiento.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="mt-botones">
          <button class="boton-secundario" id="btnCancelarSel">Cancelar</button>
          <button class="boton-secundario" id="btnSinRepuesto">Continuar sin repuesto</button>
          <button class="boton-primario" id="btnContinuarSel">Continuar</button>
        </div>
      </div>`;

    abrirPanel('Registrar mantenimiento', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      raiz.querySelector('#tablaSalidasMant tbody').addEventListener('click', function (ev) {
        const tr = ev.target.closest('tr[data-i]');
        if (!tr || ev.target.classList.contains('chk-sal')) return;
        const chk = tr.querySelector('.chk-sal');
        chk.checked = !chk.checked;
      });
      $('btnCancelarSel').addEventListener('click', solicitarCierrePanel);
      const nombre = function () {
        const n = $('mNombreSel').value.trim().toUpperCase();
        if (!n) { mostrarMensaje('Ingrese el nombre de la reparación.', 'error'); $('mNombreSel').focus(); }
        return n;
      };
      $('btnContinuarSel').addEventListener('click', function () {
        const n = nombre();
        if (!n) return;
        const elegidas = Array.from(raiz.querySelectorAll('.chk-sal:checked')).map(c => salidas[Number(c.dataset.i)]);
        if (!elegidas.length) { mostrarMensaje('Seleccione al menos una salida para asociarla al mantenimiento.', 'error'); return; }
        const placa = elegidas[0].placa;
        if (elegidas.some(s => s.placa !== placa)) { mostrarMensaje('No puedes mezclar salidas de diferentes placas en una misma reparación.', 'error'); return; }
        const clave = s => String(s.fecha) + ' ' + String(s.hora).padStart(8, '0');
        const primera = elegidas.slice().sort((a, b) => clave(a) < clave(b) ? -1 : 1)[0];
        const tecnicos = Array.from(new Set(elegidas.map(s => s.tecnico).filter(Boolean)));
        self._detalle({
          nombre: n, placa: placa, placaFija: true, fechaInicial: primera.fecha, horaInicial: primera.hora,
          tecnicos: tecnicos, repuestos: elegidas
        });
      });
      $('btnSinRepuesto').addEventListener('click', function () {
        const n = nombre();
        if (!n) return;
        self._detalle({
          nombre: n, placa: '', placaFija: false, fechaInicial: MT.hoy(), horaInicial: MT.ahora(),
          tecnicos: MTM_TALLERES, tecnicoInicial: 'TALLER EXTERNO', repuestos: [], sinRepuesto: true
        });
      });
    }, { clase: 'panel-servicio' });
  },

  /* ============================ 1b. DETALLE ============================ */

  _detalle: function (cfg) {
    const self = this;
    const d = self._datos;
    const horaVista = h => { const m = String(h || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/); return m ? m[1].padStart(2, '0') + ':' + m[2] + ':' + (m[3] || '00') : MT.ahora(); };
    const tecnicoFijo = !cfg.sinRepuesto && cfg.tecnicos.length === 1;
    const opcionesRepuesto = function (lista) {
      return '<option value=""></option>' + lista.map(s => '<option value="' + esc(s.fila) + '">' + esc(s.producto) + '</option>').join('') +
        '<option value="NO">NO APLICA</option>';
    };

    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="mt-seccion"><h3>Reparación</h3>
          <div class="fila-campos">
            <div class="campo ancho2"><label>Nombre de la reparación</label><input type="text" id="dNombre" readonly value="${esc(cfg.nombre)}"></div>
            <div class="campo"><label>Placa</label>${cfg.placaFija
              ? '<input type="text" id="dPlaca" readonly value="' + esc(cfg.placa) + '">'
              : '<input type="text" id="dPlaca" list="dlPlacasM" autocomplete="off" style="text-transform:uppercase">' + MT.datalist('dlPlacasM', d.placas)}</div>
            <div class="campo"><label>Tipo de mantenimiento</label><select id="dTipo">${MT.opciones(MTM_TIPOS, '')}</select></div>
            <div class="campo"><label>Fecha inicial</label><input type="date" id="dFechaIni" value="${esc(cfg.fechaInicial)}"></div>
            <div class="campo"><label>Hora inicial</label><input type="time" step="1" id="dHoraIni" value="${esc(horaVista(cfg.horaInicial))}"></div>
            <div class="campo"><label>Fecha final</label><input type="date" id="dFechaFin" value="${MT.hoy()}"></div>
            <div class="campo"><label>Hora final</label><input type="time" step="1" id="dHoraFin" value="${MT.ahora()}"></div>
            <div class="campo"><label>Lugar</label><input type="text" id="dLugar" list="dlLugares" autocomplete="off" style="text-transform:uppercase">${MT.datalist('dlLugares', d.lugares)}</div>
            <div class="campo"><label>Técnico / taller</label>${tecnicoFijo
              ? '<input type="text" id="dTecnico" readonly value="' + esc(cfg.tecnicos[0]) + '">'
              : '<input type="text" id="dTecnico" list="dlTecnicos" autocomplete="off" style="text-transform:uppercase" value="' + esc(cfg.tecnicoInicial || '') + '">' + MT.datalist('dlTecnicos', cfg.tecnicos)}</div>
            <div class="campo"><label>Kilometraje</label><input type="number" id="dKm" min="0" step="any"><div class="mt-ayuda" id="dKmAyuda"></div></div>
            <div class="campo"><label>Duración</label><input type="text" id="dDuracion" readonly></div>
          </div>
        </div>
        <div class="mt-seccion"><h3>Detalle</h3>
          <div class="fila-campos">
            <div class="campo ancho2"><label>Repuesto utilizado</label><select id="dRepuesto" ${cfg.sinRepuesto ? 'disabled' : ''}>${cfg.sinRepuesto ? '<option value="NO">NO APLICA</option>' : opcionesRepuesto(cfg.repuestos)}</select></div>
            <div class="campo"><label>Sistema reparado</label><select id="dSistema">${MT.opciones(MTM_SISTEMAS, '')}</select></div>
            <div class="campo"><label>Método de reparación</label><input type="text" id="dMetodo" list="dlMetodos" autocomplete="off" style="text-transform:uppercase">${MT.datalist('dlMetodos', MTM_METODOS)}</div>
            <div class="campo ancho4"><label>Observación</label><input type="text" id="dObs" autocomplete="off" style="text-transform:uppercase"></div>
          </div>
        </div>
        <div class="mt-seccion"><h3><label style="display:flex;gap:8px;align-items:center;cursor:pointer;margin:0"><input type="checkbox" id="dTieneCosto" style="width:auto"> ¿Tiene costo?</label></h3>
          <div class="fila-campos">
            <div class="campo"><label>Tipo de costo</label><select id="dTipoCosto" disabled>${MT.opciones(MTM_TIPOS_COSTO, '')}</select></div>
            <div class="campo"><label>Moneda</label><select id="dMoneda" disabled>${MT.opciones(['S/', '$'], '')}</select></div>
            <div class="campo"><label>Cantidad</label><input type="number" id="dCantidad" min="0" step="any" disabled></div>
            <div class="campo"><label>Precio unitario</label><input type="number" id="dPrecio" min="0" step="any" disabled></div>
            <div class="campo"><label>Costo total</label><input type="text" id="dCostoTotal" readonly></div>
            <div class="campo"><label>N° documento</label><input type="text" id="dDocumento" autocomplete="off" style="text-transform:uppercase" disabled></div>
          </div>
        </div>
        <div class="mt-botones">
          <button class="boton-secundario" id="btnInicioMant">Inicio</button>
          <button class="boton-primario" id="btnGrabarMant">Grabar</button>
        </div>
      </div>`;

    actualizarPanel('Registrar mantenimiento — detalle', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      let repuestos = cfg.repuestos.slice();

      function ayudaKm() {
        const placa = $('dPlaca').value.trim().toUpperCase();
        const km = d.kmPorPlaca[placa];
        $('dKmAyuda').textContent = km ? 'Último km registrado: ' + Number(km).toLocaleString('es-PE') : '';
      }
      ayudaKm();
      $('dPlaca').addEventListener('change', ayudaKm);

      function duracion() {
        const a = new Date($('dFechaIni').value + 'T' + ($('dHoraIni').value || '00:00:00'));
        const b = new Date($('dFechaFin').value + 'T' + ($('dHoraFin').value || '00:00:00'));
        if (isNaN(a) || isNaN(b)) { $('dDuracion').value = ''; return; }
        const s = Math.round((b - a) / 1000);
        if (s < 0) { $('dDuracion').value = 'Fecha final menor a la inicial'; return; }
        $('dDuracion').value = [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
      }
      ['dFechaIni', 'dHoraIni', 'dFechaFin', 'dHoraFin'].forEach(id => $(id).addEventListener('change', duracion));
      duracion();

      // Igual que el Excel: si el lugar no es SSI, se vacía el técnico para escribir el del taller.
      $('dLugar').addEventListener('change', function () {
        const l = this.value.trim().toUpperCase();
        if (!tecnicoFijo && l && l !== 'SSI') $('dTecnico').value = '';
      });

      const camposCosto = ['dTipoCosto', 'dMoneda', 'dCantidad', 'dPrecio', 'dDocumento'];
      function habilitarCosto(si) {
        camposCosto.forEach(id => { $(id).disabled = !si; if (!si) $(id).value = ''; });
        if (!si) $('dCostoTotal').value = '';
      }
      $('dTieneCosto').addEventListener('change', function () { habilitarCosto(this.checked); });
      function calcularCosto() {
        const c = MT.num($('dCantidad').value), p = MT.num($('dPrecio').value);
        $('dCostoTotal').value = (!isNaN(c) && !isNaN(p) && c >= 0 && p >= 0) ? MT.dinero(c * p) : '';
      }
      $('dCantidad').addEventListener('input', calcularCosto);
      $('dPrecio').addEventListener('input', calcularCosto);

      $('btnInicioMant').addEventListener('click', solicitarCierrePanel);

      function limpiarDetalle() {
        const doc = $('dDocumento').value, mon = $('dMoneda').value, conCosto = $('dTieneCosto').checked;
        $('dRepuesto').innerHTML = cfg.sinRepuesto ? '<option value="NO">NO APLICA</option>' : opcionesRepuesto(repuestos);
        ['dSistema', 'dMetodo', 'dObs'].forEach(id => { $(id).value = ''; });
        habilitarCosto(conCosto);
        if (conCosto) { $('dDocumento').value = doc; $('dMoneda').value = mon; }
        _refrescarSnapshotFormulario();
        $('dRepuesto').focus();
      }

      async function grabar(confirmarKm) {
        const valRep = $('dRepuesto').value;
        const rep = repuestos.find(s => String(s.fila) === valRep);
        const datos = {
          nombre: $('dNombre').value, fechaInicial: $('dFechaIni').value, horaInicial: $('dHoraIni').value,
          fechaFinal: $('dFechaFin').value, horaFinal: $('dHoraFin').value, tipoMantenimiento: $('dTipo').value,
          tecnico: $('dTecnico').value, placa: $('dPlaca').value, lugar: $('dLugar').value,
          repuesto: valRep === 'NO' ? 'NO APLICA' : (rep ? rep.producto : ''), filaSalida: rep ? rep.fila : 0,
          sistema: $('dSistema').value, metodo: $('dMetodo').value, kilometraje: $('dKm').value, observacion: $('dObs').value,
          tieneCosto: $('dTieneCosto').checked, tipoCosto: $('dTipoCosto').value, monedaCosto: $('dMoneda').value,
          cantidadCosto: $('dCantidad').value, precioCosto: $('dPrecio').value, documentoCosto: $('dDocumento').value,
          confirmarKm: !!confirmarKm
        };
        const r = await MT.llamar('mtGrabarMantenimiento', datos);
        if (!r) return;
        if (r.confirmarKm) {
          if (confirmar('El kilometraje ingresado presenta una variación muy alta.\n\nÚltimo km: ' + r.kmAnterior +
            '\nKm ingresado: ' + datos.kilometraje + '\nDiferencia: ' + r.diferencia + ' km\n\n¿Desea continuar de todas formas?')) {
            return grabar(true);
          }
          $('dKm').focus();
          return;
        }
        d.kmPorPlaca[datos.placa.trim().toUpperCase()] = Number(datos.kilometraje);
        if (rep) repuestos = repuestos.filter(s => s !== rep);
        if (confirmar(r.mensaje + '\n\n¿Deseas registrar otro detalle para esta misma reparación?')) {
          limpiarDetalle();
        } else {
          cerrarPanel();
        }
      }
      protegerClic($('btnGrabarMant'), () => grabar(false));
    });
  },

  /* ============================ 2. REPORTE DE FALLAS ============================ */

  abrirReporteFallas: async function () {
    if (!(await this._cargar())) return;
    const d = this._datos;
    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="mt-seccion"><h3>Reporte</h3>
          <div class="fila-campos">
            <div class="campo"><label>Usuario</label><input type="text" id="fUsuario" value="${esc(MT.usuario())}" autocomplete="off" style="text-transform:uppercase"></div>
            <div class="campo"><label>Fecha</label><input type="date" id="fFecha" value="${MT.hoy()}"></div>
            <div class="campo"><label>Placa</label><select id="fPlaca">${MT.opciones(d.placas, '')}</select></div>
            <div class="campo"><label>Kilometraje</label>
              <div class="mt-buscar"><input type="text" id="fKm" autocomplete="off" style="text-transform:uppercase"><button type="button" id="btnKmPendiente">PENDIENTE</button></div></div>
            <div class="campo ancho2"><label>Personal que reporta</label><select id="fPersonal">${MT.opciones(d.personal, '')}</select></div>
            <div class="campo ancho2"><label>N° documento</label><input type="text" id="fDocumento" autocomplete="off" style="text-transform:uppercase"></div>
          </div>
        </div>
        <div class="mt-seccion"><h3>Falla</h3>
          <div class="fila-campos">
            <div class="campo"><label>Código de falla</label><input type="text" id="fCodigo" list="dlCodFalla" autocomplete="off">
              ${'<datalist id="dlCodFalla">' + d.catalogoFallas.map(c => '<option value="' + esc(c.codigo) + '">' + esc(c.sistema + ' — ' + c.componente) + '</option>').join('') + '</datalist>'}</div>
            <div class="campo"><label>Sistema</label><input type="text" id="fSistema" readonly></div>
            <div class="campo ancho2"><label>Componente</label><input type="text" id="fComponente" readonly></div>
            <div class="campo ancho4"><label>Detalle / ocurrencia</label><textarea id="fDetalle" rows="2" style="text-transform:uppercase"></textarea></div>
          </div>
          <div class="mt-botones">
            <button class="boton-secundario" id="btnInicioFalla">Inicio</button>
            <button class="boton-primario" id="btnGrabarFalla">Grabar falla</button>
          </div>
        </div>
        <div class="mt-seccion"><h3>Fallas registradas en este reporte</h3>
          <table class="tabla-lista" id="tablaFallasReg" style="width:100%;font-size:.8rem;">
            <thead><tr><th>Código</th><th>Sistema</th><th>Componente</th></tr></thead><tbody></tbody>
          </table>
        </div>
      </div>`;

    abrirPanel('Registrar reporte de fallas', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      function buscarCodigo(avisar) {
        const c = $('fCodigo').value.trim();
        const x = d.catalogoFallas.find(f => f.codigo === c);
        $('fSistema').value = x ? x.sistema : '';
        $('fComponente').value = x ? x.componente : '';
        if (!x && c && avisar) mostrarMensaje('Código de falla no encontrado. Verifique la base de componentes.', 'error');
        return !!x;
      }
      $('fCodigo').addEventListener('change', () => buscarCodigo(true));
      $('btnKmPendiente').addEventListener('click', () => { $('fKm').value = 'PENDIENTE'; });
      $('btnInicioFalla').addEventListener('click', solicitarCierrePanel);
      protegerClic($('btnGrabarFalla'), async function () {
        const usuario = $('fUsuario').value.trim();
        if (!usuario) { mostrarMensaje('Ingrese el usuario.', 'error'); return; }
        if ($('fCodigo').value.trim() && !buscarCodigo(true)) return;
        MT.guardarUsuario(usuario);
        const r = await MT.llamar('mtGrabarFalla', {
          usuario: usuario, fecha: $('fFecha').value, placa: $('fPlaca').value, kilometraje: $('fKm').value,
          personal: $('fPersonal').value, documento: $('fDocumento').value, codigo: $('fCodigo').value, detalle: $('fDetalle').value
        });
        if (!r) return;
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + esc($('fCodigo').value) + '</td><td>' + esc(_mtmAbreviarSistema(r.sistema)) + '</td><td>' + esc(r.componente) + '</td>';
        $('tablaFallasReg').querySelector('tbody').appendChild(tr);
        const soloDetalle = confirmar(r.mensaje + '\n\n¿Deseas registrar otra falla para el mismo documento?');
        ['fCodigo', 'fSistema', 'fComponente', 'fDetalle'].forEach(id => { $(id).value = ''; });
        if (!soloDetalle) {
          ['fPlaca', 'fKm', 'fPersonal', 'fDocumento'].forEach(id => { $(id).value = ''; });
          $('fFecha').value = MT.hoy();
          $('tablaFallasReg').querySelector('tbody').innerHTML = '';
        }
        _refrescarSnapshotFormulario();
      });
    }, { clase: 'panel-servicio' });
  },

  /* ============================ 3. CONTROL DE FALLAS ============================ */

  abrirControlFallas: async function () {
    if (!(await this._cargar())) return;
    const self = this;
    const html = MT_ESTILOS + `
      <div class="mt-form">
        <div class="mt-ayuda" id="ctrlCuenta" style="margin-bottom:6px;"></div>
        <div class="mt-tabla-wrap">
          <table class="tabla-lista" id="tablaCtrlFallas">
            <thead><tr><th style="width:34px"></th><th>Fecha</th><th>Placa</th><th>Kilometraje</th><th>N° documento</th><th>Código</th><th>Sistema</th><th>Componente</th><th>Detalle</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="mt-botones">
          <button class="boton-secundario" id="btnInicioCtrl">Inicio</button>
          <button class="boton-primario" id="btnSolucionar" style="background:var(--verde)">Marcar como SOLUCIONADO</button>
        </div>
      </div>`;

    abrirPanel('Control de reporte de fallas', html, function (raiz) {
      const $ = id => raiz.querySelector('#' + id);
      function pintar() {
        const lista = self._datos.fallasPendientes;
        $('ctrlCuenta').textContent = lista.length + ' falla(s) pendiente(s)';
        $('tablaCtrlFallas').querySelector('tbody').innerHTML = lista.length ? lista.map(f => `
          <tr data-fila="${f.fila}">
            <td style="text-align:center"><input type="checkbox" class="chk-falla" value="${f.fila}"></td>
            <td>${esc(MT.fechaVista(f.fecha))}</td><td>${esc(f.placa)}</td><td>${esc(f.km)}</td><td>${esc(f.documento)}</td>
            <td>${esc(f.codigo)}</td><td>${esc(_mtmAbreviarSistema(f.sistema))}</td><td>${esc(f.componente)}</td><td>${esc(f.detalle)}</td>
          </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;color:#8b95a1;padding:16px;">No hay fallas pendientes por solucionar.</td></tr>';
      }
      $('tablaCtrlFallas').querySelector('tbody').addEventListener('click', function (ev) {
        const tr = ev.target.closest('tr[data-fila]');
        if (!tr || ev.target.classList.contains('chk-falla')) return;
        const chk = tr.querySelector('.chk-falla');
        chk.checked = !chk.checked;
      });
      $('btnInicioCtrl').addEventListener('click', cerrarPanel);
      protegerClic($('btnSolucionar'), async function () {
        const filas = Array.from(raiz.querySelectorAll('.chk-falla:checked')).map(c => Number(c.value));
        if (!filas.length) { mostrarMensaje('Seleccione al menos una falla para marcarla como solucionada.', 'error'); return; }
        if (!confirmar('¿Deseas marcar como SOLUCIONADO las fallas seleccionadas?')) return;
        const r = await MT.llamar('mtSolucionarFallas', { filas: filas });
        if (!r) return;
        mostrarMensaje(r.mensaje, 'exito');
        if (await self._cargar()) pintar();
      });
      pintar();
    }, { ancho: true });
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const enlazar = function (id, fn) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', function () { if (!MT._pendientes) fn(); });
  };
  enlazar('btn-mt-mantenimiento', () => FormMantenimiento.abrirRegistrar());
  enlazar('btn-mt-reporte-fallas', () => FormMantenimiento.abrirReporteFallas());
  enlazar('btn-mt-control-fallas', () => FormMantenimiento.abrirControlFallas());
});
