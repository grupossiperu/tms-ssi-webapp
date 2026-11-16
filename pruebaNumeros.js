/**
 * pruebaNumeros.js — Prueba de "mismos números" (solo MAESTRO, no cambia nada).
 * -------------------------------------------------------------------------
 * Antes de publicar un cambio:   await PruebaNumeros.guardar()
 * Después de publicarlo:         await PruebaNumeros.comparar()
 *
 * guardar()  pide las consultas de solo lectura del sistema y guarda la
 *            respuesta completa en este navegador (IndexedDB).
 * comparar() las vuelve a pedir y dice cuáles salieron IGUAL y cuáles DIFERENTE
 *            (con las primeras rutas donde cambió el dato) y cuánto tardó cada una.
 *
 * Solo llama acciones de LECTURA: no graba nada en las hojas.
 * Si alguien registró algo entre una foto y la otra, esa consulta saldrá
 * DIFERENTE con razón: las rutas indican qué cambió.
 * -------------------------------------------------------------------------
 */
const PruebaNumeros = {
  ACCIONES: [
    ['listarServiciosPendientes', { fechaDesde: '', fechaHasta: '' }],
    ['listarConSeguimiento', {}],
    ['cobranzaDatos', {}],
    ['reporteFacturacion', {}],
    ['liqDatos', {}],
    ['liquidacionConductores', {}],
    ['liqHistorial', {}],
    ['filtrarFacturacionPendiente', { tipo: 'TODOS', texto: '' }],
    ['noFacturableListar', {}],
    ['sobrecostosListar', {}],
    ['resumenDepositos', {}],
    ['listarDepositosAdicionales', {}],
    ['descuentosListar', {}],
    ['polizasListar', {}],
    ['contratosListar', {}],
    ['acarreoListar', {}],
    ['consolidadoExportar', {}],
    ['nvListar', {}],
    ['repsolListar', {}],
    ['cierreListar', {}],
    ['resultadosDatos', {}],
    ['resultadosEstado', {}],
    ['resultadosRendimiento', {}],
    ['resultadosAlmacen', {}],
    ['mtDatosAlmacen', {}],
    ['mtDatosMantenimiento', {}],
    ['mtRegistrosDia', {}],
    ['mtControlMant', {}],
    ['mtHistorialReparaciones', {}],
    ['incTablero', {}],
    ['listarClientes', {}],
    ['listarTarifas', {}],
    ['listarPeajes', {}],
    ['listarConductores', {}],
    ['listarAvisosVencimiento', {}],
    ['listarDocumentos', { tipoEntidad: 'CONDUCTORES' }],
    ['listarDocumentos', { tipoEntidad: 'TRACTOS' }],
    ['listarDocumentos', { tipoEntidad: 'SEMIRREMOLQUES' }]
  ],

  _clave: function (a, d) { return a + (d && Object.keys(d).length ? ' ' + JSON.stringify(d) : ''); },

  _bd: function () {
    return new Promise(function (ok, mal) {
      const p = indexedDB.open('tms_prueba_numeros', 1);
      p.onupgradeneeded = function () { p.result.createObjectStore('fotos'); };
      p.onsuccess = function () { ok(p.result); };
      p.onerror = function () { mal(p.error); };
    });
  },
  _poner: async function (k, v) {
    const bd = await this._bd();
    return new Promise(function (ok, mal) {
      const t = bd.transaction('fotos', 'readwrite'); t.objectStore('fotos').put(v, k);
      t.oncomplete = function () { ok(); }; t.onerror = function () { mal(t.error); };
    });
  },
  _leer: async function (k) {
    const bd = await this._bd();
    return new Promise(function (ok, mal) {
      const p = bd.transaction('fotos').objectStore('fotos').get(k);
      p.onsuccess = function () { ok(p.result); }; p.onerror = function () { mal(p.error); };
    });
  },

  /** Pide todas las consultas. Devuelve { clave: { txt, ms } }. */
  _pedir: async function (alAvanzar) {
    const out = {};
    for (let i = 0; i < this.ACCIONES.length; i++) {
      const a = this.ACCIONES[i][0], d = this.ACCIONES[i][1], k = this._clave(a, d);
      const t0 = performance.now();
      let txt;
      try { txt = JSON.stringify(await llamarBackend(a, JSON.parse(JSON.stringify(d)))); }
      catch (e) { txt = JSON.stringify({ __error: String(e && e.message) }); }
      out[k] = { txt: txt, ms: Math.round(performance.now() - t0) };
      if (alAvanzar) alAvanzar(i + 1, this.ACCIONES.length, k, out[k].ms);
    }
    return out;
  },

  /** Primeras rutas donde a y b difieren (máx. `tope`). */
  _diferencias: function (a, b, tope) {
    const dif = [];
    const ver = function (x, y, ruta) {
      if (dif.length >= tope) return;
      if (x === y) return;
      const ox = x !== null && typeof x === 'object', oy = y !== null && typeof y === 'object';
      if (!ox || !oy || Array.isArray(x) !== Array.isArray(y)) {
        dif.push(ruta + ': ' + JSON.stringify(x === undefined ? '(no estaba)' : x).slice(0, 80) + '  →  ' + JSON.stringify(y === undefined ? '(ya no está)' : y).slice(0, 80));
        return;
      }
      if (Array.isArray(x) && x.length !== y.length) dif.push(ruta + ': tenía ' + x.length + ' elementos, ahora ' + y.length);
      const ks = Array.isArray(x) ? null : Array.from(new Set(Object.keys(x).concat(Object.keys(y))));
      const n = Array.isArray(x) ? Math.min(x.length, y.length) : ks.length;
      for (let i = 0; i < n && dif.length < tope; i++) {
        const k = ks ? ks[i] : i;
        ver(x[k], y[k], ruta + (ks ? '.' + k : '[' + i + ']'));
      }
    };
    ver(a, b, '');
    return dif;
  },

  /** Toma la foto "antes". nombre opcional (por defecto 'base'). */
  guardar: async function (nombre) {
    nombre = nombre || 'base';
    const fotos = await this._pedir(function (i, n, k, ms) { console.log('[foto ' + i + '/' + n + '] ' + k + ' · ' + ms + ' ms'); });
    await this._poner(nombre, { fecha: new Date().toLocaleString('es-PE'), version: window.__VERSION_APP, fotos: fotos });
    const total = Object.keys(fotos).length, errores = Object.keys(fotos).filter(function (k) { return fotos[k].txt.indexOf('{"__error"') === 0; });
    console.log('Foto "' + nombre + '" guardada: ' + total + ' consultas' + (errores.length ? ' (' + errores.length + ' con error: ' + errores.join(', ') + ')' : '') + '.');
    return { nombre: nombre, consultas: total, conError: errores };
  },

  /** Compara lo de ahora contra la foto guardada. Devuelve el resumen y lo muestra en una ventana. */
  comparar: async function (nombre) {
    nombre = nombre || 'base';
    const base = await this._leer(nombre);
    if (!base) { console.log('No hay foto "' + nombre + '". Primero: await PruebaNumeros.guardar()'); return null; }
    const ahora = await this._pedir(function (i, n, k, ms) { console.log('[comparar ' + i + '/' + n + '] ' + k + ' · ' + ms + ' ms'); });
    const self = this, filas = [];
    Object.keys(ahora).forEach(function (k) {
      const b = base.fotos[k], a = ahora[k];
      if (!b) { filas.push({ consulta: k, resultado: 'NUEVA', msAntes: '', msAhora: a.ms, cambios: [] }); return; }
      const igual = b.txt === a.txt;
      filas.push({ consulta: k, resultado: igual ? 'IGUAL' : 'DIFERENTE', msAntes: b.ms, msAhora: a.ms,
        kb: Math.round(a.txt.length / 1024), cambios: igual ? [] : self._diferencias(JSON.parse(b.txt), JSON.parse(a.txt), 6) });
    });
    const res = { foto: nombre, tomada: base.fecha, iguales: filas.filter(function (f) { return f.resultado === 'IGUAL'; }).length,
      diferentes: filas.filter(function (f) { return f.resultado === 'DIFERENTE'; }).length, total: filas.length, filas: filas };
    this._ultimo = res;
    this._mostrar(res);
    return res;
  },

  _mostrar: function (res) {
    const e = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    const velo = document.createElement('div');
    velo.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:5000;display:flex;align-items:center;justify-content:center;padding:16px';
    velo.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:900px;width:100%;max-height:90vh;overflow:auto;padding:16px;font-size:.82rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:1rem">Prueba de mismos números</b><button id="pnCerrar" class="boton-secundario">Cerrar</button></div>' +
      '<div style="margin:6px 0 10px;color:#475569">Foto "' + e(res.foto) + '" del ' + e(res.tomada) + ' · <b style="color:#15803d">' + res.iguales + ' iguales</b> · <b style="color:' + (res.diferentes ? '#b91c1c' : '#15803d') + '">' + res.diferentes + ' diferentes</b> de ' + res.total + '</div>' +
      '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;border-bottom:1px solid #cbd5e1"><th>Consulta</th><th>Resultado</th><th style="text-align:right">Antes</th><th style="text-align:right">Ahora</th></tr></thead><tbody>' +
      res.filas.map(function (f) {
        return '<tr style="border-bottom:1px solid #f1f5f9"><td>' + e(f.consulta) + (f.cambios.length ? '<div style="color:#b91c1c;font-size:.72rem">' + f.cambios.map(e).join('<br>') + '</div>' : '') + '</td>' +
          '<td><b style="color:' + (f.resultado === 'IGUAL' ? '#15803d' : '#b91c1c') + '">' + f.resultado + '</b></td>' +
          '<td style="text-align:right">' + (f.msAntes === '' ? '' : (f.msAntes / 1000).toFixed(1) + ' s') + '</td><td style="text-align:right">' + (f.msAhora / 1000).toFixed(1) + ' s</td></tr>';
      }).join('') + '</tbody></table></div>';
    document.body.appendChild(velo);
    velo.querySelector('#pnCerrar').addEventListener('click', function () { velo.remove(); });
  }
};
