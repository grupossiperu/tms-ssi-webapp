/**
 * forms/resultados.js
 * -------------------------------------------------------------------------
 * Módulo "Resultados": dashboards del negocio armados con la hoja SERVICIOS
 * (acción listarServiciosPendientes) y el último tipo de cambio registrado
 * (acción validarTipoCambioRegistrado). Se actualiza solo cada 60 segundos
 * mientras está abierto.
 *
 * Indicadores (para el período elegido, comparados con el período anterior
 * de la misma duración):
 *   - Servicios (sin contar cancelados), falsos fletes y cancelados.
 *   - Ingresos por tarifa en S/ (los dólares se convierten con el último
 *     tipo de cambio registrado) y su detalle en S/ y US$.
 *   - Gastos de viaje (columna TOTAL POR VIAJE: combustible + viático +
 *     peaje + cochera) y margen bruto (ingresos - gastos de viaje).
 *   - Galones de combustible (tracto + genset) y promedio por viaje.
 * En vivo (sin importar el período): viajes en curso por etapa.
 *
 * También maneja el reloj de la página principal y el botón "Resultados".
 * -------------------------------------------------------------------------
 */
const FormResultados = {

  _graficos: {},
  _intervalo: null,
  _filas: [],
  _tc: 0,
  _fechaTc: '',

  ETAPAS: ['PROGRAMADO', 'RETIRANDO', 'EN RUTA CLIENTE', 'EN CLIENTE', 'EN RUTA RETORNO', 'COLA PUERTO'],

  _token: null,

  /**
   * Pantalla de acceso: usuario y contraseña (validados en el backend) y
   * luego el código de 6 dígitos que llega por correo. Se pide cada vez que
   * se abre el módulo.
   */
  abrir: function () {
    const self = this;
    self._token = null;
    if (self._intervalo) { clearInterval(self._intervalo); self._intervalo = null; }
    Object.keys(self._graficos).forEach(function (k) { try { self._graficos[k].destroy(); } catch (e) { /* no-op */ } });
    self._graficos = {};

    const html = `
      <div class="res-login">
        <div class="res-login-caja">
          <div class="res-login-icono">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2"></rect>
              <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
            </svg>
          </div>
          <h3>Acceso a Resultados</h3>
          <p class="res-login-ayuda" id="resLoginAyuda">Ingrese su usuario y contraseña.</p>

          <div id="resPaso1">
            <div class="campo"><label>Usuario</label><input type="text" id="resUsuario" autocomplete="off" autocapitalize="characters"></div>
            <div class="campo"><label>Contraseña</label><input type="password" id="resClave" autocomplete="off"></div>
            <button class="boton-primario res-login-btn" id="resBtnIngresar" type="button">Continuar</button>
          </div>

          <div id="resPaso2" style="display:none;">
            <div class="campo"><label>Código de verificación</label>
              <input type="text" id="resCodigo" inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="res-codigo" placeholder="••••••">
            </div>
            <button class="boton-primario res-login-btn" id="resBtnVerificar" type="button">Verificar e ingresar</button>
            <button class="boton-secundario res-login-btn" id="resBtnReenviar" type="button">Volver a enviar código</button>
          </div>

          <div class="res-login-error" id="resLoginError"></div>
        </div>
      </div>`;

    abrirPanel('Resultados', html, (raiz) => self._wireLogin(raiz), { clase: 'panel-res' });
  },

  _wireLogin: function (raiz) {
    const self = this;
    let desafio = null;
    const error = function (txt) { raiz.querySelector('#resLoginError').textContent = txt || ''; };
    const ayuda = function (txt) { raiz.querySelector('#resLoginAyuda').textContent = txt; };
    const btnIngresar = raiz.querySelector('#resBtnIngresar');
    const btnVerificar = raiz.querySelector('#resBtnVerificar');

    const pedirCodigo = async function () {
      const usuario = raiz.querySelector('#resUsuario').value.trim();
      const clave = raiz.querySelector('#resClave').value;
      if (!usuario || !clave) { error('Ingrese usuario y contraseña.'); return; }
      error('');
      btnIngresar.disabled = true; btnIngresar.textContent = 'Validando…';
      try {
        const r = await llamarBackend('resultadosLogin', { usuario: usuario, clave: clave });
        if (!r || !r.ok) { error((r && r.mensaje) || 'No se pudo validar el acceso.'); return; }
        desafio = r.desafio;
        raiz.querySelector('#resPaso1').style.display = 'none';
        raiz.querySelector('#resPaso2').style.display = '';
        ayuda(r.mensaje + ' El código vence en 10 minutos.');
        raiz.querySelector('#resCodigo').value = '';
        raiz.querySelector('#resCodigo').focus();
      } catch (e) {
        error('Error de conexión: ' + e.message);
      } finally {
        btnIngresar.disabled = false; btnIngresar.textContent = 'Continuar';
      }
    };

    const verificar = async function () {
      const codigo = raiz.querySelector('#resCodigo').value.replace(/\D/g, '');
      if (codigo.length !== 6) { error('El código tiene 6 dígitos.'); return; }
      error('');
      btnVerificar.disabled = true; btnVerificar.textContent = 'Verificando…';
      try {
        const r = await llamarBackend('resultadosVerificar', { desafio: desafio, codigo: codigo });
        if (!r || !r.ok) {
          error((r && r.mensaje) || 'Código no válido.');
          if (r && r.vencido) {
            raiz.querySelector('#resPaso2').style.display = 'none';
            raiz.querySelector('#resPaso1').style.display = '';
            raiz.querySelector('#resClave').value = '';
            ayuda('Ingrese su usuario y contraseña.');
          }
          return;
        }
        self._token = r.token;
        self._mostrarDashboard();
      } catch (e) {
        error('Error de conexión: ' + e.message);
      } finally {
        btnVerificar.disabled = false; btnVerificar.textContent = 'Verificar e ingresar';
      }
    };

    btnIngresar.addEventListener('click', pedirCodigo);
    btnVerificar.addEventListener('click', verificar);
    raiz.querySelector('#resBtnReenviar').addEventListener('click', pedirCodigo);
    raiz.querySelector('#resClave').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') pedirCodigo(); });
    raiz.querySelector('#resUsuario').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') raiz.querySelector('#resClave').focus(); });
    raiz.querySelector('#resCodigo').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') verificar(); });
    setTimeout(function () { const u = raiz.querySelector('#resUsuario'); if (u) u.focus(); }, 50);
  },

  _mostrarDashboard: function () {
    const html = `
      <div class="res-barra">
        <div class="campo"><label>Período</label>
          <select id="resPeriodo">
            <option value="7">Últimos 7 días</option>
            <option value="30" selected>Últimos 30 días</option>
            <option value="mes">Este mes</option>
            <option value="mesAnt">Mes anterior</option>
            <option value="anio">Este año</option>
            <option value="todo">Todo el historial</option>
            <option value="rango">Rango personalizado</option>
          </select>
        </div>
        <div class="campo" id="resCampoDesde" style="display:none;"><label>Desde</label><input type="date" id="resDesde"></div>
        <div class="campo" id="resCampoHasta" style="display:none;"><label>Hasta</label><input type="date" id="resHasta"></div>
        <div class="campo"><label>Cliente</label>
          <select id="resCliente"><option value="">Todos</option></select>
        </div>
        <button class="boton-secundario" id="resActualizar" type="button">Actualizar</button>
        <div class="res-actualizado"><span class="res-vivo"></span><span id="resHoraAct">Cargando…</span></div>
      </div>

      <div class="res-kpis" id="resKpis"></div>

      <div class="res-vivo-caja">
        <h3>Viajes en curso ahora <span id="resTotalCurso" style="color:#64748b; font-weight:600;"></span></h3>
        <div class="res-pipeline" id="resPipeline"></div>
      </div>

      <div class="res-graficos">
        <div class="res-card ancho2"><h3>Tendencia: servicios e ingresos</h3><div class="res-canvas"><canvas id="gTendencia"></canvas></div></div>
        <div class="res-card"><h3>Servicios por estado</h3><div class="res-canvas"><canvas id="gEstados"></canvas></div></div>
        <div class="res-card ancho2"><h3>Ingresos y gastos de viaje por cliente (S/)</h3><div class="res-canvas"><canvas id="gClientes"></canvas></div></div>
        <div class="res-card"><h3>Margen bruto por cliente</h3><div class="res-canvas"><canvas id="gMargen"></canvas></div></div>
        <div class="res-card"><h3>Top destinos</h3><div class="res-canvas"><canvas id="gDestinos"></canvas></div></div>
        <div class="res-card"><h3>Viajes por conductor</h3><div class="res-canvas"><canvas id="gConductores"></canvas></div></div>
        <div class="res-card"><h3>Viajes por unidad (tracto)</h3><div class="res-canvas"><canvas id="gUnidades"></canvas></div></div>
        <div class="res-card"><h3>Galones promedio por destino</h3><div class="res-canvas"><canvas id="gGalones"></canvas></div></div>
        <div class="res-card"><h3>Tipo de carga</h3><div class="res-canvas"><canvas id="gTipoCarga"></canvas></div></div>
        <div class="res-card"><h3>Top plantas (packing)</h3><div class="res-canvas"><canvas id="gPlantas"></canvas></div></div>
        <div class="res-card ancho3"><h3>Detalle de viajes en curso</h3><div id="resTablaCurso"></div></div>
      </div>`;

    actualizarPanel('Resultados', html, (raiz) => this._wire(raiz));
  },

  _cargarChartJs: function () {
    if (window.Chart) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('No se pudo cargar la librería de gráficos.')); };
      document.head.appendChild(s);
    });
  },

  _wire: function (raiz) {
    const self = this;
    if (self._intervalo) clearInterval(self._intervalo);

    const selPeriodo = raiz.querySelector('#resPeriodo');
    selPeriodo.addEventListener('change', function () {
      const rango = this.value === 'rango';
      raiz.querySelector('#resCampoDesde').style.display = rango ? '' : 'none';
      raiz.querySelector('#resCampoHasta').style.display = rango ? '' : 'none';
      self._render(raiz);
    });
    ['resDesde', 'resHasta', 'resCliente'].forEach(function (id) {
      raiz.querySelector('#' + id).addEventListener('change', function () { self._render(raiz); });
    });
    raiz.querySelector('#resActualizar').addEventListener('click', function () { self._cargar(raiz); });

    self._cargar(raiz);
    // Actualización automática cada 60 s mientras el módulo esté abierto.
    self._intervalo = setInterval(function () {
      if (!document.body.contains(raiz) || !raiz.querySelector('#resKpis')) {
        self._token = null;
        clearInterval(self._intervalo);
        self._intervalo = null;
        Object.keys(self._graficos).forEach(function (k) { try { self._graficos[k].destroy(); } catch (e) { /* no-op */ } });
        self._graficos = {};
        return;
      }
      self._cargar(raiz, true);
    }, 60000);
  },

  _cargar: async function (raiz, silencioso) {
    const self = this;
    const etiqueta = raiz.querySelector('#resHoraAct');
    if (!silencioso && etiqueta) etiqueta.textContent = 'Actualizando…';
    try {
      const promesas = [llamarBackend('resultadosDatos', { token: self._token }), self._cargarChartJs()];
      if (!self._tc) promesas.push(llamarBackend('validarTipoCambioRegistrado', {}).catch(function () { return null; }));
      const res = await Promise.all(promesas);
      if (!res[0] || !res[0].ok) {
        if (self._intervalo) { clearInterval(self._intervalo); self._intervalo = null; }
        mostrarMensaje((res[0] && res[0].mensaje) || 'La sesión de Resultados venció. Vuelva a ingresar.', 'error');
        if (document.body.contains(raiz)) self.abrir();
        return;
      }
      self._filas = Array.isArray(res[0].filas) ? res[0].filas : [];
      if (res[2] && res[2].tipoCambio) {
        self._tc = Number(res[2].tipoCambio) || 0;
        self._fechaTc = res[2].fecha ? self._ddmm(new Date(res[2].fecha)) : '';
      }
      if (!document.body.contains(raiz)) return;
      self._llenarClientes(raiz);
      self._render(raiz);
      if (etiqueta) {
        etiqueta.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
          ' · se actualiza solo cada minuto' + (self._tc ? ' · TC ' + self._tc.toFixed(3) + (self._fechaTc ? ' (' + self._fechaTc + ')' : '') : '');
      }
    } catch (e) {
      if (etiqueta) etiqueta.textContent = 'Error al actualizar: ' + e.message;
    }
  },

  /* ----------------------------- utilidades ----------------------------- */
  _num: function (v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(/S\//g, '').replace(/\$/g, '').replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
  },
  _fecha: function (v) {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  },
  _ddmm: function (d) {
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  },
  _soles: function (n) {
    return 'S/ ' + (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },
  _esc: function (t) {
    return String(t === null || t === undefined ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  },
  _estado: function (f) { return String(f['ESTADO'] || 'PROGRAMADO').trim().toUpperCase() || 'PROGRAMADO'; },
  _ingresoSoles: function (f) {
    const t = this._num(f['TARIFA 1']);
    const esDolar = String(f['MONEDA TARIFA 1'] || '').trim().toUpperCase() === 'D';
    return esDolar ? t * (this._tc || 0) : t;
  },

  _rango: function (raiz) {
    const hoy = new Date();
    const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const p = raiz.querySelector('#resPeriodo').value;
    let desde = null, hasta = h;
    if (p === '7' || p === '30') {
      desde = new Date(h); desde.setDate(h.getDate() - (Number(p) - 1));
    } else if (p === 'mes') {
      desde = new Date(h.getFullYear(), h.getMonth(), 1);
    } else if (p === 'mesAnt') {
      desde = new Date(h.getFullYear(), h.getMonth() - 1, 1);
      hasta = new Date(h.getFullYear(), h.getMonth(), 0);
    } else if (p === 'anio') {
      desde = new Date(h.getFullYear(), 0, 1);
    } else if (p === 'rango') {
      const d = raiz.querySelector('#resDesde').value;
      const a = raiz.querySelector('#resHasta').value;
      desde = d ? new Date(d + 'T00:00:00') : null;
      hasta = a ? new Date(a + 'T00:00:00') : h;
    }
    if (p === 'todo' || !desde) {
      const fechas = this._filas.map(f => this._fecha(f['FECHA DE PROGRAMACION'])).filter(Boolean).sort((x, y) => x - y);
      desde = fechas.length ? fechas[0] : h;
      if (p === 'todo' && fechas.length) hasta = fechas[fechas.length - 1] > h ? fechas[fechas.length - 1] : h;
    }
    return { desde: desde, hasta: hasta };
  },

  _llenarClientes: function (raiz) {
    const sel = raiz.querySelector('#resCliente');
    const actual = sel.value;
    const clientes = Array.from(new Set(this._filas.map(f => String(f['CLIENTE PARA FACTURACIÓN'] || '').trim().toUpperCase()).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">Todos</option>' + clientes.map(c => '<option value="' + this._esc(c) + '">' + this._esc(c) + '</option>').join('');
    if (clientes.indexOf(actual) !== -1) sel.value = actual;
  },

  _metricas: function (filas) {
    const self = this;
    const validos = filas.filter(f => self._estado(f) !== 'CANCELADO');
    let ingresos = 0, ingS = 0, ingD = 0, gastos = 0, galones = 0, viajesConGl = 0;
    validos.forEach(function (f) {
      const t = self._num(f['TARIFA 1']);
      if (String(f['MONEDA TARIFA 1'] || '').trim().toUpperCase() === 'D') ingD += t; else ingS += t;
      ingresos += self._ingresoSoles(f);
      gastos += self._num(f['TOTAL POR VIAJE']);
      const g = self._num(f['GL TRACTO']) + self._num(f['GL GENERADOR']);
      if (g > 0) { galones += g; viajesConGl++; }
    });
    return {
      servicios: validos.length,
      falsos: filas.filter(f => self._estado(f) === 'FALSO FLETE').length,
      cancelados: filas.filter(f => self._estado(f) === 'CANCELADO').length,
      culminados: filas.filter(f => self._estado(f) === 'CULMINADO').length,
      ingresos: ingresos, ingS: ingS, ingD: ingD, gastos: gastos,
      margen: ingresos - gastos,
      galones: galones, glProm: viajesConGl ? galones / viajesConGl : 0
    };
  },

  _delta: function (actual, anterior, invertir) {
    if (!anterior) return '<div class="k-delta igual">Sin datos del período anterior</div>';
    const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
    const sube = pct > 0.5, baja = pct < -0.5;
    let clase = sube ? 'sube' : (baja ? 'baja' : 'igual');
    if (invertir && clase !== 'igual') clase = clase === 'sube' ? 'baja' : 'sube';
    const flecha = sube ? '▲' : (baja ? '▼' : '■');
    return '<div class="k-delta ' + clase + '">' + flecha + ' ' + Math.abs(pct).toFixed(0) + '% vs período anterior</div>';
  },

  /* ------------------------------- render ------------------------------- */
  _render: function (raiz) {
    const self = this;
    if (typeof _refrescarSnapshotFormulario === 'function') {
      // Los filtros de este módulo no son "datos sin guardar".
      setTimeout(_refrescarSnapshotFormulario, 0);
    }
    const cliente = raiz.querySelector('#resCliente').value;
    const r = self._rango(raiz);
    const dias = Math.round((r.hasta - r.desde) / 86400000) + 1;
    const antHasta = new Date(r.desde); antHasta.setDate(antHasta.getDate() - 1);
    const antDesde = new Date(antHasta); antDesde.setDate(antDesde.getDate() - (dias - 1));

    const base = self._filas.filter(f => !cliente || String(f['CLIENTE PARA FACTURACIÓN'] || '').trim().toUpperCase() === cliente);
    const enRango = function (f, d, h) {
      const x = self._fecha(f['FECHA DE PROGRAMACION']);
      return x && x >= d && x <= h;
    };
    const filas = base.filter(f => enRango(f, r.desde, r.hasta));
    const previas = base.filter(f => enRango(f, antDesde, antHasta));
    const m = self._metricas(filas);
    const mp = self._metricas(previas);

    // ---------------- KPIs ----------------
    const pctMargen = m.ingresos ? (m.margen / m.ingresos) * 100 : 0;
    raiz.querySelector('#resKpis').innerHTML =
      '<div class="res-kpi"><div class="k-tit">Servicios</div><div class="k-val">' + m.servicios + '</div>' +
        '<div class="k-sub">' + m.culminados + ' culminados · ' + self._ddmm(r.desde) + ' al ' + self._ddmm(r.hasta) + '</div>' + self._delta(m.servicios, mp.servicios) + '</div>' +
      '<div class="res-kpi k-verde"><div class="k-tit">Ingresos (tarifas)</div><div class="k-val">' + self._soles(m.ingresos) + '</div>' +
        '<div class="k-sub">US$ ' + m.ingD.toLocaleString('es-PE', { maximumFractionDigits: 0 }) + ' + S/ ' + m.ingS.toLocaleString('es-PE', { maximumFractionDigits: 0 }) + '</div>' + self._delta(m.ingresos, mp.ingresos) + '</div>' +
      '<div class="res-kpi k-rojo"><div class="k-tit">Gastos de viaje</div><div class="k-val">' + self._soles(m.gastos) + '</div>' +
        '<div class="k-sub">Combustible, viáticos, peajes y cochera</div>' + self._delta(m.gastos, mp.gastos, true) + '</div>' +
      '<div class="res-kpi k-morado"><div class="k-tit">Margen bruto</div><div class="k-val">' + self._soles(m.margen) + '</div>' +
        '<div class="k-sub">' + pctMargen.toFixed(1) + '% de los ingresos</div>' + self._delta(m.margen, mp.margen) + '</div>' +
      '<div class="res-kpi k-naranja"><div class="k-tit">Ticket promedio</div><div class="k-val">' + self._soles(m.servicios ? m.ingresos / m.servicios : 0) + '</div>' +
        '<div class="k-sub">Ingreso por servicio</div>' + self._delta(m.servicios ? m.ingresos / m.servicios : 0, mp.servicios ? mp.ingresos / mp.servicios : 0) + '</div>' +
      '<div class="res-kpi k-cian"><div class="k-tit">Combustible</div><div class="k-val">' + m.galones.toLocaleString('es-PE', { maximumFractionDigits: 0 }) + ' gl</div>' +
        '<div class="k-sub">' + m.glProm.toFixed(1) + ' gl por viaje · ' + m.falsos + ' falsos fletes · ' + m.cancelados + ' cancelados</div>' + self._delta(m.galones, mp.galones, true) + '</div>';

    // --------------- En curso (en vivo, sin filtro de fechas) ---------------
    const enCurso = base.filter(f => self.ETAPAS.indexOf(self._estado(f)) !== -1 || self._estado(f) === 'EN RUTA');
    const conteo = {};
    enCurso.forEach(f => { const e = self._estado(f) === 'EN RUTA' ? 'EN RUTA CLIENTE' : self._estado(f); conteo[e] = (conteo[e] || 0) + 1; });
    raiz.querySelector('#resPipeline').innerHTML = self.ETAPAS.map(function (e, i) {
      return '<div class="res-etapa e' + (i + 1) + '"><div class="e-num">' + (conteo[e] || 0) + '</div><div class="e-tit">' + e.toLowerCase() + '</div></div>';
    }).join('');
    raiz.querySelector('#resTotalCurso').textContent = '(' + enCurso.length + ' en total)';

    const colorEstado = { 'PROGRAMADO': ['#e2e8f0', '#334155'], 'RETIRANDO': ['#fef3c7', '#92400e'], 'EN RUTA CLIENTE': ['#dbeafe', '#1e40af'], 'EN RUTA': ['#dbeafe', '#1e40af'], 'EN CLIENTE': ['#ede9fe', '#5b21b6'], 'EN RUTA RETORNO': ['#cffafe', '#155e75'], 'COLA PUERTO': ['#ffedd5', '#9a3412'] };
    const ordenados = enCurso.slice().sort((a, b) => (self._fecha(a['FECHA DE PROGRAMACION']) || 0) - (self._fecha(b['FECHA DE PROGRAMACION']) || 0));
    raiz.querySelector('#resTablaCurso').innerHTML = ordenados.length
      ? '<table class="res-tabla"><thead><tr><th>Fecha</th><th>Cliente</th><th>Conductor</th><th>Tracto</th><th>Booking</th><th>Destino</th><th>Planta</th><th>Observación</th><th>Estado</th></tr></thead><tbody>' +
        ordenados.map(function (f) {
          const e = self._estado(f); const c = colorEstado[e] || ['#f1f5f9', '#334155'];
          const fe = self._fecha(f['FECHA DE PROGRAMACION']);
          return '<tr><td>' + (fe ? self._ddmm(fe) : '') + '</td><td>' + self._esc(f['CLIENTE PARA FACTURACIÓN']) + '</td><td>' + self._esc(f['CONDUCTOR']) +
            '</td><td>' + self._esc(f['PLACA TRACTO']) + '</td><td>' + self._esc(f['BOOKING']) + '</td><td>' + self._esc(f['DESTINO 1']) +
            '</td><td>' + self._esc(f['PACKING']) + '</td><td>' + self._esc(f['OBSERVACION']) + '</td><td><span class="res-badge" style="background:' + c[0] + ';color:' + c[1] + ';">' + self._esc(e) + '</span></td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="res-vacio">No hay viajes en curso en este momento.</div>';

    if (!window.Chart) return;

    // ---------------------------- Gráficos ----------------------------
    const azul = '#1c3a5e', verde = '#1f9d55', rojo = '#d33a3a', morado = '#7c3aed';
    const paleta = ['#1c3a5e', '#2c6bd6', '#1f9d55', '#e8890c', '#7c3aed', '#0891b2', '#d33a3a', '#ca8a04', '#db2777', '#64748b'];
    const validos = filas.filter(f => self._estado(f) !== 'CANCELADO');

    const agrupar = function (lista, clave, valor) {
      const mapa = {};
      lista.forEach(function (f) {
        const k = String(typeof clave === 'function' ? clave(f) : (f[clave] || '')).trim().toUpperCase() || '(SIN DATO)';
        mapa[k] = (mapa[k] || 0) + (valor ? valor(f) : 1);
      });
      return mapa;
    };
    const top = function (mapa, n) {
      return Object.keys(mapa).map(k => [k, mapa[k]]).sort((a, b) => b[1] - a[1]).slice(0, n);
    };
    const opcionesBase = function (extra) {
      return Object.assign({
        responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
        plugins: { legend: { display: false } }
      }, extra || {});
    };
    const dibujar = function (id, config) {
      const canvas = raiz.querySelector('#' + id);
      if (!canvas) return;
      if (self._graficos[id]) {
        self._graficos[id].data = config.data;
        self._graficos[id].options = config.options;
        self._graficos[id].update();
        return;
      }
      self._graficos[id] = new Chart(canvas.getContext('2d'), config);
    };
    const horizontal = function (id, pares, color, formatoSoles) {
      dibujar(id, {
        type: 'bar',
        data: { labels: pares.map(p => p[0].length > 30 ? p[0].slice(0, 29) + '…' : p[0]), datasets: [{ data: pares.map(p => Math.round(p[1] * 10) / 10), backgroundColor: color, borderRadius: 5 }] },
        options: opcionesBase({
          indexAxis: 'y',
          scales: { x: { beginAtZero: true, ticks: { callback: v => formatoSoles ? 'S/ ' + Number(v).toLocaleString('es-PE') : v } }, y: { ticks: { font: { size: 10 } } } }
        })
      });
    };

    // 1) Tendencia: por día (≤ 62 días) o por semana.
    const porSemana = dias > 62;
    const claveTiempo = function (d) {
      if (!porSemana) return d.getTime();
      const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime();
    };
    const buckets = [];
    const cursor = new Date(r.desde);
    while (cursor <= r.hasta) {
      const k = claveTiempo(cursor);
      if (buckets.indexOf(k) === -1) buckets.push(k);
      cursor.setDate(cursor.getDate() + 1);
    }
    const servPorT = {}, ingPorT = {};
    validos.forEach(function (f) {
      const k = claveTiempo(self._fecha(f['FECHA DE PROGRAMACION']));
      servPorT[k] = (servPorT[k] || 0) + 1;
      ingPorT[k] = (ingPorT[k] || 0) + self._ingresoSoles(f);
    });
    dibujar('gTendencia', {
      type: 'bar',
      data: {
        labels: buckets.map(k => { const d = new Date(k); return (porSemana ? 'Sem ' : '') + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }),
        datasets: [
          { type: 'bar', label: 'Servicios', data: buckets.map(k => servPorT[k] || 0), backgroundColor: '#93b4dd', borderRadius: 4, yAxisID: 'y' },
          { type: 'line', label: 'Ingresos S/', data: buckets.map(k => Math.round(ingPorT[k] || 0)), borderColor: verde, backgroundColor: verde, tension: .3, pointRadius: 2, yAxisID: 'y1' }
        ]
      },
      options: opcionesBase({
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Servicios' }, ticks: { precision: 0 } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => 'S/ ' + Number(v).toLocaleString('es-PE') } }
        }
      })
    });

    // 2) Estados
    const est = top(agrupar(filas, f => self._estado(f)), 10);
    const colorDona = { 'PROGRAMADO': '#94a3b8', 'RETIRANDO': '#f59e0b', 'EN RUTA CLIENTE': '#3b82f6', 'EN RUTA': '#3b82f6', 'EN CLIENTE': '#8b5cf6', 'EN RUTA RETORNO': '#06b6d4', 'COLA PUERTO': '#f97316', 'CULMINADO': '#22c55e', 'FALSO FLETE': '#ec4899', 'CANCELADO': '#ef4444' };
    dibujar('gEstados', {
      type: 'doughnut',
      data: { labels: est.map(p => p[0]), datasets: [{ data: est.map(p => p[1]), backgroundColor: est.map((p, i) => colorDona[p[0]] || paleta[i % paleta.length]) }] },
      options: opcionesBase({ cutout: '58%', plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } })
    });

    // 3) Ingresos y gastos por cliente
    const ingCli = agrupar(validos, 'CLIENTE PARA FACTURACIÓN', f => self._ingresoSoles(f));
    const gasCli = agrupar(validos, 'CLIENTE PARA FACTURACIÓN', f => self._num(f['TOTAL POR VIAJE']));
    const cliTop = top(ingCli, 10).map(p => p[0]);
    dibujar('gClientes', {
      type: 'bar',
      data: {
        labels: cliTop,
        datasets: [
          { label: 'Ingresos', data: cliTop.map(c => Math.round(ingCli[c] || 0)), backgroundColor: verde, borderRadius: 4 },
          { label: 'Gastos de viaje', data: cliTop.map(c => Math.round(gasCli[c] || 0)), backgroundColor: rojo, borderRadius: 4 }
        ]
      },
      options: opcionesBase({
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => 'S/ ' + Number(v).toLocaleString('es-PE') } } }
      })
    });

    // 4) Margen por cliente (%)
    const margenCli = cliTop.map(c => [c, ingCli[c] ? ((ingCli[c] - (gasCli[c] || 0)) / ingCli[c]) * 100 : 0]);
    dibujar('gMargen', {
      type: 'bar',
      data: { labels: margenCli.map(p => p[0]), datasets: [{ data: margenCli.map(p => Math.round(p[1] * 10) / 10), backgroundColor: margenCli.map(p => p[1] >= 0 ? morado : rojo), borderRadius: 5 }] },
      options: opcionesBase({ indexAxis: 'y', scales: { x: { ticks: { callback: v => v + '%' } }, y: { ticks: { font: { size: 10 } } } } })
    });

    // 5) a 9)
    horizontal('gDestinos', top(agrupar(validos, 'DESTINO 1'), 10), azul);
    horizontal('gConductores', top(agrupar(validos, 'CONDUCTOR'), 10), '#2c6bd6');
    horizontal('gUnidades', top(agrupar(validos, 'PLACA TRACTO'), 10), '#0891b2');
    horizontal('gPlantas', top(agrupar(validos, 'PACKING'), 10), '#e8890c');

    const conGl = validos.filter(f => self._num(f['GL TRACTO']) + self._num(f['GL GENERADOR']) > 0);
    const glDest = agrupar(conGl, 'DESTINO 1', f => self._num(f['GL TRACTO']) + self._num(f['GL GENERADOR']));
    const nDest = agrupar(conGl, 'DESTINO 1');
    const glProm = top(agrupar(conGl, 'DESTINO 1'), 10).map(p => [p[0], glDest[p[0]] / nDest[p[0]]]);
    horizontal('gGalones', glProm, '#ca8a04');

    const tc = top(agrupar(validos, f => (String(f['TIPO DE CARGA'] || '').trim() || 'SIN DATO') + ' · ' + (String(f['REEFER O DRY'] || '').trim().toUpperCase() === 'DRY' ? 'SECO' : 'REEFER')), 8);
    dibujar('gTipoCarga', {
      type: 'doughnut',
      data: { labels: tc.map(p => p[0]), datasets: [{ data: tc.map(p => p[1]), backgroundColor: tc.map((p, i) => paleta[i % paleta.length]) }] },
      options: opcionesBase({ cutout: '55%', plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } } })
    });
  }
};

/* ---------------- Página principal: reloj y botón Resultados ---------------- */
(function () {
  const btn = document.getElementById('btn-resultados');
  if (btn) btn.addEventListener('click', function () { FormResultados.abrir(); });

  const elFecha = document.getElementById('homeFecha');
  const elHora = document.getElementById('homeHora');
  if (!elFecha || !elHora) return;
  const tic = function () {
    const ahora = new Date();
    elFecha.textContent = ahora.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    elHora.textContent = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  };
  tic();
  setInterval(tic, 15000);
})();
