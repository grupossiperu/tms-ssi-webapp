/**
 * homeLateral.js — Página de inicio con barra lateral + tablero (13/11/2026).
 * No cambia ningún módulo: arma la barra lateral a partir de los mosaicos que ya existen
 * (clic en un elemento = clic en su mosaico) y un tablero que cambia según el grupo elegido:
 *   Operaciones (inicio) · Finanzas · Almacén · Mantenimiento · Maestros.
 * Para volver al inicio anterior basta con quitar este archivo y home2.css de index.html.
 */
(function () {
  'use strict';
  const GRUPOS = {
    'OPER': { n: 'Operaciones', c: '#2563EB', tit: 'Resumen de operaciones' },
    'FIN DEP': { n: 'Finanzas', c: '#059669', tit: 'Resumen de finanzas' },
    'ALM': { n: 'Almacén', c: '#7C3AED', tit: 'Resumen de almacén' },
    'MANT': { n: 'Mantenimiento', c: '#DC2626', tit: 'Resumen de mantenimiento' },
    'MAE': { n: 'Maestros', c: '#D97706', tit: 'Resumen de maestros' }
  };
  const ORDEN = ['OPER', 'FIN DEP', 'ALM', 'MANT', 'MAE'];
  const EN_CURSO = ['RETIRANDO', 'EN RUTA CLIENTE', 'EN CLIENTE', 'EN RUTA RETORNO', 'COLA PUERTO', 'EN RUTA'];
  const RAPIDOS = {
    'OPER': ['btn-consolidado-servicios', 'btn-registrar-servicio', 'btn-facturar', 'btn-deposito', 'btn-datos-viaje', 'btn-mt-salida', 'btn-incidencias', 'btn-control-mant'],
    'FIN DEP': ['btn-facturar', 'btn-cobranzas', 'btn-consolidado-servicios-completar', 'btn-deposito', 'btn-sobrecostos'],
    'ALM': ['btn-mt-ingreso', 'btn-mt-salida', 'btn-mt-stock', 'btn-mt-reparaciones'],
    'MANT': ['btn-reportar-falla', 'btn-incidencias', 'btn-control-mant', 'btn-mt-mantenimiento', 'btn-historial-reparaciones'],
    'MAE': ['btn-contratos', 'btn-lista-conductores', 'btn-clientes', 'btn-tarifas']
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const visible = el => !!el && el.style.display !== 'none';
  const may = v => String(v == null ? '' : v).trim().toUpperCase();
  const leer = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const puede = m => typeof Sesion !== 'undefined' && Sesion.puede && Sesion.puede(m);
  const clic = id => () => { const b = document.getElementById(id); if (b) b.click(); };
  const nfmt = (v, d) => Number(v || 0).toLocaleString('es-PE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });

  function fecha(v) { const d = v instanceof Date ? v : new Date(v); return isNaN(d) ? null : d; }
  function fechaCorta(v) { const d = fecha(v); return d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : ''; }
  function claseEstado(e) { return 'est-' + sinTildes(e || 'PROGRAMADO').replace(/[^a-z0-9]+/g, '-'); }
  function etiqueta(txt, fondo, color) { return '<span class="hl-tag" style="background:' + fondo + ';color:' + color + '">' + esc(txt) + '</span>'; }
  function dmy(s) { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }

  // ---------------- Datos compartidos (se piden una vez por minuto) ----------------
  const cache = {};
  function dato(clave, fn) {
    const c = cache[clave];
    if (c && Date.now() - c.t < 60000) return c.p;
    const p = (async () => { try { return await fn(); } catch (e) { return null; } })();
    cache[clave] = { t: Date.now(), p: p };
    return p;
  }
  const D = {
    servicios: () => dato('serv', async () => { const r = await llamarBackend('listarServiciosPendientes', { fechaDesde: '', fechaHasta: '' }); return Array.isArray(r) ? r : null; }),
    factura: () => dato('fact', async () => { const r = await llamarBackend('filtrarFacturacionPendiente', { tipo: 'TODOS', texto: '' }); return Array.isArray(r) ? r : null; }),
    noFact: () => dato('nof', async () => { const r = await llamarBackend('noFacturableListar', {}); return r && r.ok ? r.filas || [] : []; }),
    acarreo: () => dato('acar', async () => { const r = await llamarBackend('acarreoListar', {}); return r && r.ok ? r.items || {} : null; }),
    cobranza: () => dato('cob', async () => { const r = await llamarBackend('cobranzaDatos', {}); return r && r.ok ? r : null; }),
    contratos: () => dato('con', async () => { const r = await llamarBackend('contratosListar', {}); return r && r.ok ? r : null; }),
    controlMant: () => dato('cm', async () => { const r = await llamarBackend('mtControlMant', {}); return r && r.ok ? r : null; }),
    incidencias: () => dato('inc', async () => { const r = await llamarBackend('incTablero', {}); return r && r.ok ? r.filas || [] : null; }),
    almacen: () => dato('alm', async () => { if (typeof FormAlmacen === 'undefined') return null; const r = await FormAlmacen._cargar(); return r ? FormAlmacen._alertas() : null; }),
    regDia: () => dato('rd', async () => { const r = await llamarBackend('mtRegistrosDia', {}); return r && r.ok ? r : null; }),
    avisos: () => dato('av', async () => {
      if (window._avisosVenc) return window._avisosVenc;
      const r = await llamarBackend('listarAvisosVencimiento', {});
      return Array.isArray(r) ? r : (r && Array.isArray(r.avisos) ? r.avisos : []);
    })
  };

  function iniciar() {
    const home = $('.home'), grid = $('.home-grid'), top = $('.home-top');
    if (!home || !grid || !top || $('.hl-app')) return;
    document.body.classList.add('hl');

    // ---------- Estructura ----------
    const app = document.createElement('div');
    app.className = 'hl-app';
    app.innerHTML =
      '<aside class="hl-side" id="hlSide">' +
        '<div class="hl-marca"><span class="hl-logo">' + ($('.home-logo') ? $('.home-logo').innerHTML : '') + '</span>' +
          '<span><strong>Transportes SSI</strong><small>Sistema de servicios</small></span></div>' +
        '<label class="hl-buscar"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
          '<input id="hlBuscar" type="search" autocomplete="off" placeholder="Buscar módulo" aria-label="Buscar un módulo"><kbd>/</kbd></label>' +
        '<button type="button" class="hl-item hl-inicio" id="hlInicio"><span class="hl-ico"><svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg></span><span class="hl-txt">Inicio</span></button>' +
        '<nav class="hl-nav" id="hlNav" aria-label="Módulos"></nav>' +
      '</aside>' +
      '<div class="hl-main">' +
        '<div class="hl-topbar"><button type="button" class="hl-menu" id="hlMenu" aria-label="Abrir menú"><svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button></div>' +
        '<section class="hl-tablero" id="hlTablero">' +
          '<div class="hl-saludo"><div><h1 id="hlHola">Buen día</h1><p id="hlFecha"></p></div><div class="hl-vista" id="hlVista"></div></div>' +
          '<div class="hl-kpis" id="hlKpis"></div>' +
          '<div class="hl-sec-tit" id="hlRapTit">Accesos rápidos</div>' +
          '<div class="hl-rapidos" id="hlRapidos"></div>' +
          '<div class="hl-cols">' +
            '<div class="hl-card hl-izq"><div class="hl-card-tit"><span id="hlIzqTit"></span><button type="button" class="hl-link" id="hlIzqLink"></button></div><div id="hlIzq" class="hl-vacio">Cargando…</div></div>' +
            '<div class="hl-card hl-der"><div class="hl-card-tit"><span>Pendientes y alertas</span></div><div id="hlAlertas" class="hl-vacio">Revisando…</div></div>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<div class="hl-velo" id="hlVelo"></div>';
    home.parentNode.insertBefore(app, home);
    const main = $('.hl-main', app);
    $('.hl-topbar', app).appendChild(top);
    main.appendChild(home);
    ['franjaAvisosVencimiento', 'estado-hojas'].forEach(id => { const el = document.getElementById(id); if (el) main.insertBefore(el, $('#hlTablero')); });

    // ---------- Barra lateral ----------
    const nav = $('#hlNav');
    const plegados = leer('tms_hl_plegados') || {};
    let vistaActual = null;
    function gruposVisibles() {
      return ORDEN.filter(function (clave) {
        const sec = grid.querySelector('.home-grupo[data-modulo="' + clave + '"]');
        return sec && visible(sec) && Array.prototype.some.call(sec.querySelectorAll('.tile'), visible);
      });
    }
    function armarNav() {
      nav.innerHTML = '';
      gruposVisibles().forEach(function (clave) {
        const sec = grid.querySelector('.home-grupo[data-modulo="' + clave + '"]');
        const tiles = Array.prototype.filter.call(sec.querySelectorAll('.tile'), visible);
        const G = GRUPOS[clave];
        const g = document.createElement('div');
        g.className = 'hl-grupo' + (plegados[clave] ? ' plegado' : '');
        g.dataset.clave = clave;
        g.style.setProperty('--c', G.c);
        g.innerHTML = '<button type="button" class="hl-grupo-tit" title="Ver el resumen de ' + G.n + '"><span class="hl-punto"></span>' + G.n +
          '<span class="hl-n">' + tiles.length + '</span><svg class="hl-flecha" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button><div class="hl-items"></div>';
        const cont = g.querySelector('.hl-items');
        tiles.forEach(function (t) {
          const nombre = (t.querySelector('.tile-texto strong') || t).textContent.trim();
          const desc = (t.querySelector('.tile-texto small') || {}).textContent || '';
          const ico = t.querySelector('.tile-icono svg');
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'hl-item'; b.title = desc;
          b.dataset.buscar = sinTildes(nombre + ' ' + desc + ' ' + G.n);
          b.innerHTML = '<span class="hl-ico">' + (ico ? ico.outerHTML : '') + '</span><span class="hl-txt">' + esc(nombre) + '</span><span class="hl-badge" data-de="' + t.id + '"></span>';
          b.addEventListener('click', function () { cerrarMenu(); t.click(); });
          cont.appendChild(b);
        });
        // Clic en el grupo: despliega la lista y muestra su resumen; otro clic sobre el grupo ya abierto lo pliega
        g.querySelector('.hl-grupo-tit').addEventListener('click', function () {
          const plegado = g.classList.contains('plegado');
          if (vistaActual === clave && !plegado) g.classList.add('plegado');
          else { g.classList.remove('plegado'); mostrar(clave); }
          plegados[clave] = g.classList.contains('plegado'); guardar('tms_hl_plegados', plegados);
        });
        nav.appendChild(g);
      });
      contadores();
    }
    function contadores() {
      [['btn-mt-stock', 'mtAlertasBadge'], ['btn-control-mant', 'cmBadge']].forEach(function (p) {
        const src = document.getElementById(p[1]), dst = nav.querySelector('.hl-badge[data-de="' + p[0] + '"]');
        if (!dst) return;
        const n = src && src.style.display !== 'none' ? src.textContent.trim() : '';
        dst.textContent = n && n !== '0' ? n : '';
      });
    }
    $('#hlInicio').addEventListener('click', function () { cerrarMenu(); mostrar(vistaInicio()); });

    // ---------- Buscador ----------
    const input = $('#hlBuscar');
    input.addEventListener('input', function () {
      const q = sinTildes(input.value.trim());
      nav.classList.toggle('buscando', !!q);
      nav.querySelectorAll('.hl-grupo').forEach(function (g) {
        let n = 0;
        g.querySelectorAll('.hl-item').forEach(function (b) { const ok = !q || b.dataset.buscar.indexOf(q) >= 0; b.hidden = !ok; if (ok) n++; });
        g.hidden = !!q && !n;
      });
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); input.blur(); }
      if (ev.key === 'Enter') { const b = nav.querySelector('.hl-grupo:not([hidden]) .hl-item:not([hidden])'); if (b) b.click(); }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
      if (document.querySelector('.overlay-modal')) return;
      ev.preventDefault(); abrirMenu(); input.focus();
    });

    // ---------- Menú en celular ----------
    function abrirMenu() { if (window.innerWidth <= 900) document.body.classList.add('hl-menu-abierto'); }
    function cerrarMenu() { document.body.classList.remove('hl-menu-abierto'); }
    $('#hlMenu').addEventListener('click', function () { document.body.classList.toggle('hl-menu-abierto'); });
    $('#hlVelo').addEventListener('click', cerrarMenu);

    // ---------- Saludo ----------
    function saludo() {
      const h = new Date().getHours();
      const s = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
      const n = (($('#homeUsuarioNombre') || {}).textContent || '').trim().split(/\s+/)[0] || '';
      $('#hlHola').textContent = s + (n ? ', ' + n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '');
      const f = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      $('#hlFecha').textContent = f.charAt(0).toUpperCase() + f.slice(1);
    }

    // ---------------- Pintado genérico del tablero ----------------
    let turno = 0;
    function pintarKpis(lista) {
      const c = $('#hlKpis');
      c.innerHTML = lista.map((k, i) => '<button type="button" class="hl-kpi" data-i="' + i + '" style="--c:' + k.c + '"><small>' + esc(k.etq) + '</small><strong>' +
        (k.v == null ? '…' : esc(k.v)) + '</strong><span>' + esc(k.sub || '') + '</span></button>').join('');
      c.querySelectorAll('.hl-kpi').forEach(b => b.addEventListener('click', function () { const k = lista[+b.dataset.i]; if (k.f) k.f(); }));
    }
    function pintarRapidos(clave) {
      const cont = $('#hlRapidos'); cont.innerHTML = '';
      (RAPIDOS[clave] || []).map(id => document.getElementById(id)).filter(t => t && visible(t) && visible(t.closest('.home-grupo'))).slice(0, 4).forEach(function (t) {
        const g = t.closest('.home-grupo'), color = (GRUPOS[g.getAttribute('data-modulo')] || { c: '#2563EB' }).c;
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'hl-rapido'; b.style.setProperty('--c', color);
        const ico = t.querySelector('.tile-icono svg');
        b.innerHTML = '<span class="hl-ico">' + (ico ? ico.outerHTML : '') + '</span><span><strong>' + esc((t.querySelector('.tile-texto strong') || t).textContent) +
          '</strong><small>' + esc((t.querySelector('.tile-texto small') || {}).textContent || '') + '</small></span>';
        b.addEventListener('click', () => t.click());
        cont.appendChild(b);
      });
      $('#hlRapTit').hidden = !cont.children.length;
    }
    function pintarIzq(titulo, link, html, filas) {
      $('#hlIzqTit').textContent = titulo;
      const l = $('#hlIzqLink');
      l.hidden = !link; if (link) { l.textContent = link.txt + ' →'; l.onclick = link.f; }
      const caja = $('#hlIzq');
      caja.className = /^<table/.test(html) ? '' : 'hl-vacio';
      caja.innerHTML = html;
      if (filas) caja.querySelectorAll('tbody tr').forEach((tr, i) => tr.addEventListener('click', () => filas[i] && filas[i]()));
    }
    function tabla(cabeceras, filas, total, mas) {
      return '<table class="hl-tabla"><thead><tr>' + cabeceras.map(c => '<th' + (c[1] ? ' style="width:' + c[1] + 'px"' : '') + '>' + c[0] + '</th>').join('') + '</tr></thead><tbody>' +
        filas.map(f => '<tr>' + f.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>' +
        (total > filas.length ? '<div class="hl-mas">y ' + (total - filas.length) + ' más' + (mas ? ' en ' + mas : '') + '</div>' : '');
    }
    function pintarAlertas(items, vacio) {
      const caja = $('#hlAlertas');
      const L = items.filter(x => x && x.n);
      if (!L.length) { caja.className = 'hl-vacio'; caja.innerHTML = '<span class="hl-ok">✓</span> ' + (vacio || 'Sin pendientes por ahora.'); return; }
      caja.className = '';
      caja.innerHTML = L.map((x, i) => '<button type="button" class="hl-alerta" data-i="' + i + '" style="--c:' + x.c + '"><span class="hl-alerta-n">' + esc(x.n) + '</span><span><strong>' + esc(x.t) + '</strong><small>' + (x.d || '') + '</small></span></button>').join('');
      caja.querySelectorAll('.hl-alerta').forEach(b => b.addEventListener('click', () => { try { L[+b.dataset.i].f(); } catch (e) { /* módulo no cargado */ } }));
    }
    const sub3 = (L, f) => L.slice(0, 3).map(f).join('<br>') + (L.length > 3 ? '<br>y ' + (L.length - 3) + ' más' : '');

    function vistaInicio() { const v = gruposVisibles(); return v.indexOf('OPER') >= 0 ? 'OPER' : (v[0] || 'OPER'); }
    function mostrar(clave) {
      vistaActual = clave;
      const t = ++turno;
      const G = GRUPOS[clave] || GRUPOS.OPER;
      nav.querySelectorAll('.hl-grupo').forEach(g => g.classList.toggle('activo', g.dataset.clave === clave));
      $('#hlInicio').classList.toggle('activo', clave === vistaInicio());
      $('#hlVista').innerHTML = '<span style="--c:' + G.c + '">' + esc(G.tit) + '</span>';
      $('#hlTablero').style.setProperty('--vista', G.c);
      pintarRapidos(clave);
      $('#hlIzqTit').textContent = ''; $('#hlIzqLink').hidden = true;
      $('#hlIzq').className = 'hl-vacio'; $('#hlIzq').textContent = 'Cargando…';
      $('#hlAlertas').className = 'hl-vacio'; $('#hlAlertas').textContent = 'Revisando…';
      const vigente = () => t === turno;
      (VISTAS[clave] || VISTAS.OPER)(vigente);
    }

    // ---------------- Vistas por grupo ----------------
    const est = f => may(f['ESTADO']) || 'PROGRAMADO';

    const VISTAS = {};

    // ===== Operaciones =====
    VISTAS.OPER = async function (vigente) {
      const k = [{ etq: 'En ruta', v: null, sub: 'viajes en curso', c: '#2563EB', f: clic('btn-consolidado-servicios') },
        { etq: 'Programados', v: null, sub: 'por salir', c: '#0891B2', f: clic('btn-consolidado-servicios') },
        { etq: 'Culminados', v: null, sub: 'este mes', c: '#059669', f: clic('btn-consolidado-servicios') },
        { etq: 'Alertas', v: null, sub: 'por revisar', c: '#DC2626', f: () => $('.hl-der').scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }];
      pintarKpis(k);
      alertasGenerales(vigente, k);
      if (!puede('OPER')) { pintarIzq('Viajes en curso y próximos', null, 'No tiene acceso a Operaciones.'); return; }
      const serv = await D.servicios();
      if (!vigente()) return;
      if (!serv) { pintarIzq('Viajes en curso y próximos', null, 'No se pudo cargar la lista de viajes.'); return; }
      const hoy = new Date();
      const tf = f => { const d = fecha(f['FECHA DE PROGRAMACION']); return d ? d.getTime() : 0; };
      const lista = serv.filter(f => EN_CURSO.indexOf(est(f)) >= 0 || est(f) === 'PROGRAMADO' || est(f) === 'REPROGRAMADO')
        .sort((a, b) => (EN_CURSO.indexOf(est(a)) >= 0 ? 0 : 1) - (EN_CURSO.indexOf(est(b)) >= 0 ? 0 : 1) || tf(a) - tf(b));
      k[0].v = serv.filter(f => EN_CURSO.indexOf(est(f)) >= 0).length;
      k[1].v = serv.filter(f => est(f) === 'PROGRAMADO' || est(f) === 'REPROGRAMADO').length;
      k[2].v = serv.filter(f => { const d = fecha(f['FECHA DE PROGRAMACION']); return est(f) === 'CULMINADO' && d && d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear(); }).length;
      pintarKpis(k);
      const v = lista.slice(0, 9);
      pintarIzq('Viajes en curso y próximos', { txt: 'Ver todo en Acarreo', f: clic('btn-consolidado-servicios') },
        lista.length ? tabla([['Fecha', 56], ['Cliente'], ['Conductor'], ['Destino'], ['Estado', 132]], v.map(f => [fechaCorta(f['FECHA DE PROGRAMACION']),
          '<b>' + esc(f['CLIENTE PARA FACTURACIÓN']) + '</b><div class="hl-sub">' + esc(f['BOOKING'] || f['CODIGO SERVICIO'] || '') + '</div>',
          esc(f['CONDUCTOR']) + '<div class="hl-sub">' + esc(f['PLACA TRACTO'] || '') + '</div>',
          esc(f['DESTINO 1']) + '<div class="hl-sub">' + esc(f['PACKING'] || '') + '</div>',
          '<span class="badge-estado ' + claseEstado(est(f)) + '">' + esc(est(f)) + '</span>']), lista.length, 'Acarreo') : 'No hay viajes en curso ni programados.',
        v.map(() => clic('btn-consolidado-servicios')));
    };
    // Alertas del inicio: documentos, contratos, mantenimiento y almacén (lo que ya avisa el sistema)
    function alertasGenerales(vigente, k) {
      const pintar = function () {
        if (!vigente()) return;
        const av = window._avisosVenc || [];
        const doc = av.filter(a => a.tipoEntidad !== 'CONTRATOS'), con = av.filter(a => a.tipoEntidad === 'CONTRATOS');
        const linea = a => esc(a.nombre) + ' · ' + esc(a.documento) + (a.vencido ? ' <b class="r">vencido</b>' : ' (' + a.dias + ' d.)');
        const cm = document.getElementById('cmBadge'), cmN = cm && cm.style.display !== 'none' ? parseInt(cm.textContent, 10) || 0 : 0;
        const al = document.getElementById('mtAlertasBadge'), alN = al && al.style.display !== 'none' ? parseInt(al.textContent, 10) || 0 : 0;
        const items = [
          doc.length && { n: doc.length, t: 'Documentos de flota', d: sub3(doc, linea), c: '#D97706', f: () => FormDocumentos.abrir() },
          con.length && { n: con.length, t: 'Contratos', d: sub3(con, linea), c: '#D97706', f: () => FormContratos.abrir() },
          cmN && { n: cmN, t: 'Mantenimiento preventivo', d: 'Unidades vencidas o por vencer (km / horas)', c: '#DC2626', f: () => FormControlMant.abrir() },
          alN && { n: alN, t: 'Almacén', d: 'Stock bajo, vencimientos y reparaciones atrasadas', c: '#7C3AED', f: () => FormAlmacen.abrirAlertas() }
        ];
        pintarAlertas(items);
        const tot = items.reduce((s, x) => s + (x ? x.n : 0), 0);
        k[3].v = tot; k[3].sub = tot ? 'por revisar' : 'todo al día'; k[3].c = tot ? '#DC2626' : '#64748B';
        pintarKpis(k); contadores();
      };
      pintar();
      let veces = 0; const iv = setInterval(function () { if (!vigente() || ++veces > 8) { clearInterval(iv); return; } pintar(); }, 2500);
    }

    // ===== Finanzas =====
    VISTAS['FIN DEP'] = async function (vigente) {
      const k = [{ etq: 'Por facturar', v: null, sub: 'viajes culminados', c: '#059669', f: clic('btn-facturar') },
        { etq: 'Sobrecostos', v: null, sub: 'por facturar', c: '#0891B2', f: clic('btn-sobrecostos') },
        { etq: 'Acarreo incompleto', v: null, sub: 'culminados sin documentos', c: '#D97706', f: clic('btn-consolidado-servicios') },
        { etq: 'Facturas vencidas', v: null, sub: 'por cobrar', c: '#DC2626', f: clic('btn-cobranzas') }];
      pintarKpis(k);
      const fin = puede('FIN');
      const [serv, fact, nof, acar, cob, con] = await Promise.all([D.servicios(), fin ? D.factura() : null, fin ? D.noFact() : [], D.acarreo(),
        fin ? D.cobranza() : null, puede('MAE') ? D.contratos() : null]);
      if (!vigente()) return;

      // Qué está facturado: consolidados con "FACT." + códigos que aparecen en facturas de Cobranzas
      const facturado = new Set(), conConsol = new Set(), noCobrar = new Set((nof || []).map(x => may(x.codigo)));
      (fact || []).forEach(x => { if (x.origen !== 'CONSOLIDADO') return; const c = may(x.codigo); conConsol.add(c); if (/FACT\./.test(may(x.tipoFact))) facturado.add(c); });
      ((cob && cob.facturas) || []).forEach(f => (f.servicios || []).forEach(s => { const c = may(s.codigo); if (c && f.tipo === 'VIAJE') facturado.add(c); }));
      const sobrePend = (fact || []).filter(x => x.origen === 'SOBRECOSTOS' && !/ F\.$|FACT\./.test(may(x.tipoFact)));
      const culm = (serv || []).filter(f => est(f) === 'CULMINADO' || est(f) === 'FALSO FLETE');
      const tf = f => { const d = fecha(f['FECHA DE PROGRAMACION']); return d ? d.getTime() : 0; };
      const sinFact = fact ? culm.filter(f => { const c = may(f['CODIGO SERVICIO']); return c && !facturado.has(c) && !noCobrar.has(c); }).sort((a, b) => tf(b) - tf(a)) : [];

      // Acarreo: solo desde que existe el cierre del acarreo (primer registro)
      let desde = null;
      if (acar) Object.keys(acar).forEach(c => { const d = dmy(acar[c].fecha); if (d && (!desde || d < desde)) desde = d; });
      if (desde) desde.setDate(desde.getDate() - 7);
      const acarInc = acar ? culm.filter(f => est(f) === 'CULMINADO' && (!desde || tf(f) >= desde.getTime()) && !(acar[f['CODIGO SERVICIO']] && acar[f['CODIGO SERVICIO']].completo)).sort((a, b) => tf(b) - tf(a)) : [];

      const venc = ((cob && cob.facturas) || []).filter(f => f.vencido && Number(f.saldo) > 0.009 && f.estado !== 'PAGADO');
      const porMon = {}; venc.forEach(f => { porMon[f.moneda] = (porMon[f.moneda] || 0) + Number(f.saldo || 0); });
      const montoTxt = Object.keys(porMon).map(m => (m === 'USD' ? 'US$ ' : 'S/ ') + nfmt(porMon[m], 2)).join(' · ');
      const cons = con ? con.items.filter(x => x.estado === 'ACTIVO' && typeof x.dias === 'number' && x.dias <= (con.diasAviso || 10)).sort((a, b) => a.dias - b.dias) : [];

      k[0].v = fact ? sinFact.length : '—'; k[1].v = fact ? sobrePend.length : '—'; k[2].v = acar ? acarInc.length : '—';
      k[3].v = cob ? venc.length : '—'; k[3].sub = montoTxt || 'por cobrar';
      pintarKpis(k);

      const v = sinFact.slice(0, 9);
      pintarIzq('Viajes culminados sin facturar', { txt: 'Ir a Facturar', f: clic('btn-facturar') },
        !fact ? 'No tiene acceso a Facturación.' : sinFact.length ? tabla([['Fecha', 56], ['Cliente'], ['Código / BK'], ['Conductor'], ['Situación', 140]], v.map(f => {
          const c = may(f['CODIGO SERVICIO']), tiene = conConsol.has(c);
          return [fechaCorta(f['FECHA DE PROGRAMACION']), '<b>' + esc(f['CLIENTE PARA FACTURACIÓN']) + '</b>' + (est(f) === 'FALSO FLETE' ? '<div class="hl-sub">Falso flete</div>' : ''),
            esc(c) + '<div class="hl-sub">' + esc(f['BOOKING'] || '') + '</div>', esc(f['CONDUCTOR']),
            tiene ? etiqueta('Listo para facturar', '#DCFCE7', '#166534') : etiqueta('Falta consolidado', '#FEF3C7', '#92400E')];
        }), sinFact.length, 'Facturar') : 'Todos los viajes culminados están facturados.',
        v.map(f => conConsol.has(may(f['CODIGO SERVICIO'])) ? clic('btn-facturar') : clic('btn-consolidado-servicios-completar')));

      pintarAlertas([
        acarInc.length && { n: acarInc.length, t: 'Culminados con acarreo incompleto', d: sub3(acarInc, f => esc(f['CODIGO SERVICIO']) + ' · ' + esc(f['CLIENTE PARA FACTURACIÓN']) + ' (' + (acar[f['CODIGO SERVICIO']] ? acar[f['CODIGO SERVICIO']].n + '/3 doc.' : 'sin documentos') + ')'), c: '#D97706', f: clic('btn-consolidado-servicios') },
        sinFact.length && { n: sinFact.length, t: 'Viajes sin facturar', d: sinFact.filter(f => !conConsol.has(may(f['CODIGO SERVICIO']))).length + ' sin consolidado · ' + sinFact.filter(f => conConsol.has(may(f['CODIGO SERVICIO']))).length + ' listos para facturar', c: '#059669', f: clic('btn-facturar') },
        sobrePend.length && { n: sobrePend.length, t: 'Sobrecostos por facturar', d: sub3(sobrePend, x => esc(x.codigo) + ' · ' + esc(x.tipoFact)), c: '#0891B2', f: clic('btn-sobrecostos') },
        venc.length && { n: venc.length, t: 'Facturas vencidas', d: 'Saldo vencido: ' + montoTxt, c: '#DC2626', f: clic('btn-cobranzas') },
        cons.length && { n: cons.length, t: 'Contratos vencidos o por vencer', d: sub3(cons, x => esc(x.nombre) + (x.dias < 0 ? ' <b class="r">vencido</b>' : ' (' + x.dias + ' d.)')), c: '#D97706', f: () => FormContratos.abrir() }
      ]);
    };

    // ===== Almacén =====
    VISTAS.ALM = async function (vigente) {
      const k = [{ etq: 'Stock bajo', v: null, sub: 'bajo el mínimo', c: '#7C3AED', f: () => FormAlmacen.abrirAlertas() },
        { etq: 'Vencimientos', v: null, sub: 'vencidos o por vencer', c: '#D97706', f: () => FormAlmacen.abrirAlertas() },
        { etq: 'Reparaciones', v: null, sub: 'atrasadas en taller', c: '#DC2626', f: clic('btn-mt-reparaciones') },
        { etq: 'Movimientos hoy', v: null, sub: 'ingresos y salidas', c: '#2563EB', f: () => FormAlmacen.abrirRegistrosDia() }];
      pintarKpis(k);
      const [a, rd] = await Promise.all([D.almacen(), D.regDia()]);
      if (!vigente()) return;
      if (!a) { pintarIzq('Productos bajo el mínimo', null, 'No se pudieron cargar los datos del almacén.'); pintarAlertas([]); return; }
      const hoyIso = (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date());
      const ingHoy = rd ? new Set((rd.ingresos || []).filter(x => String(x.fecha).slice(0, 10) === hoyIso).map(x => x.tipoDoc + '|' + x.documento + '|' + x.proveedor)).size : 0;
      const salHoy = rd ? new Set((rd.salidas || []).filter(x => String(x.fecha).slice(0, 10) === hoyIso).map(x => x.hora + '|' + x.entregadoA + '|' + x.placa)).size : 0;
      k[0].v = a.stock.length; k[1].v = a.venc.length; k[2].v = a.rep.length;
      k[3].v = rd ? ingHoy + salHoy : '—'; k[3].sub = rd ? ingHoy + ' ingreso(s) · ' + salHoy + ' salida(s)' : 'ingresos y salidas';
      pintarKpis(k);
      const u = p => esc(p.unidadStock || p.unidad || '');
      const v = a.stock.slice(0, 9);
      pintarIzq('Productos bajo el mínimo', { txt: 'Ver alertas del almacén', f: () => FormAlmacen.abrirAlertas() },
        a.stock.length ? tabla([['Código', 110], ['Producto'], ['Stock', 90], ['Mínimo', 90]], v.map(p => [esc(p.codigo), '<b>' + esc(p.producto) + '</b><div class="hl-sub">' + esc(p.marca || '') + '</div>',
          '<b style="color:#DC2626">' + nfmt(p.stock, 2).replace(/[.,]00$/, '') + '</b> ' + u(p), nfmt(p.stockMinimo, 2).replace(/[.,]00$/, '') + ' ' + u(p)]), a.stock.length, 'Alertas') : 'Ningún producto está bajo el mínimo.',
        v.map(() => () => FormAlmacen.abrirAlertas()));
      pintarAlertas([
        a.stock.length && { n: a.stock.length, t: 'Stock bajo el mínimo', d: sub3(a.stock, p => esc(p.producto)), c: '#7C3AED', f: () => FormAlmacen.abrirAlertas() },
        a.venc.length && { n: a.venc.length, t: 'Productos por vencer', d: sub3(a.venc, p => esc(p.producto) + (p.dias < 0 ? ' <b class="r">vencido</b>' : ' (' + p.dias + ' d.)')), c: '#D97706', f: () => FormAlmacen.abrirAlertas() },
        a.rep.length && { n: a.rep.length, t: 'Reparaciones atrasadas', d: sub3(a.rep, r => esc(r.producto || r.codigo || '') + ' · ' + r.atraso + ' d. de atraso'), c: '#DC2626', f: clic('btn-mt-reparaciones') },
        (ingHoy + salHoy) && { n: ingHoy + salHoy, t: 'Movimientos de hoy', d: ingHoy + ' ingreso(s) y ' + salHoy + ' salida(s) registrados', c: '#2563EB', f: () => FormAlmacen.abrirRegistrosDia() }
      ]);
    };

    // ===== Mantenimiento =====
    VISTAS.MANT = async function (vigente) {
      const k = [{ etq: 'Mant. vencido', v: null, sub: 'unidades', c: '#DC2626', f: () => FormControlMant.abrir() },
        { etq: 'Por vencer', v: null, sub: 'unidades', c: '#D97706', f: () => FormControlMant.abrir() },
        { etq: 'Incidencias abiertas', v: null, sub: 'reportadas', c: '#2563EB', f: clic('btn-incidencias') },
        { etq: 'Urgentes', v: null, sub: 'incidencias', c: '#B91C1C', f: clic('btn-incidencias') }];
      pintarKpis(k);
      const [cm, inc] = await Promise.all([(puede('MANT') || puede('OPER')) ? D.controlMant() : null, puede('INCV') ? D.incidencias() : null]);
      if (!vigente()) return;
      const U = cm ? cm.unidades || [] : [];
      const venc = U.filter(x => x.estado === 'VENCIDO'), por = U.filter(x => x.estado === 'POR VENCER'), sinBase = U.filter(x => x.estado === 'SIN BASE' || x.estado === 'REVISAR');
      const abiertas = (inc || []).filter(x => x.estado === 'ABIERTA' || x.estado === 'PROGRAMADA').sort((a, b) => (b.puntaje || 0) - (a.puntaje || 0));
      const urg = abiertas.filter(x => x.prioridad === 'URGENTE');
      k[0].v = cm ? venc.length : '—'; k[1].v = cm ? por.length : '—'; k[2].v = inc ? abiertas.length : '—'; k[3].v = inc ? urg.length : '—';
      pintarKpis(k);
      const nom = x => x.tipo === 'GENSET' ? 'Genset ' + esc(x.unidad) : esc(x.unidad);
      const med = x => x.tipo === 'GENSET' ? ' h' : ' km';
      const lista = venc.concat(por).sort((a, b) => (a.falta || 0) - (b.falta || 0));
      const v = lista.slice(0, 9);
      pintarIzq('Mantenimiento preventivo', { txt: 'Abrir control de mantenimiento', f: () => FormControlMant.abrir() },
        !cm ? 'No se pudo cargar el control de mantenimiento.' : lista.length ? tabla([['Unidad'], ['Lectura actual'], ['Último mant.'], ['Situación', 150]], v.map(x => [
          '<b>' + nom(x) + '</b><div class="hl-sub">' + (x.tipo === 'GENSET' ? 'cada 1 000 h' : 'cada 20 000 km') + '</div>',
          nfmt(x.actual) + med(x) + '<div class="hl-sub">' + esc(x.fechaActual || '') + '</div>',
          x.base ? nfmt(x.base.lectura) + med(x) + '<div class="hl-sub">' + esc(x.base.fecha || '') + '</div>' : '—',
          x.estado === 'VENCIDO' ? etiqueta('Vencido +' + nfmt(-x.falta) + med(x), '#FEE2E2', '#991B1B') : etiqueta('Faltan ' + nfmt(x.falta) + med(x), '#FEF3C7', '#92400E')]), lista.length, 'Control de mantenimiento')
          : 'Todas las unidades están al día.', v.map(() => () => FormControlMant.abrir()));
      pintarAlertas([
        urg.length && { n: urg.length, t: 'Incidencias urgentes', d: sub3(urg, x => esc(x.placa) + ' · ' + esc(x.sistema) + ' / ' + esc(x.componente)), c: '#B91C1C', f: clic('btn-incidencias') },
        (abiertas.length - urg.length) && { n: abiertas.length - urg.length, t: 'Otras incidencias abiertas', d: sub3(abiertas.filter(x => x.prioridad !== 'URGENTE'), x => esc(x.placa) + ' · ' + esc(x.componente) + ' (' + esc(x.prioridad) + ')'), c: '#2563EB', f: clic('btn-incidencias') },
        venc.length && { n: venc.length, t: 'Mantenimiento vencido', d: sub3(venc, x => nom(x) + ' · +' + nfmt(-x.falta) + med(x)), c: '#DC2626', f: () => FormControlMant.abrir() },
        sinBase.length && { n: sinBase.length, t: 'Unidades sin último mantenimiento', d: 'Registre el último mantenimiento para que el sistema avise cuándo toca', c: '#64748B', f: () => FormControlMant.abrir() }
      ]);
    };

    // ===== Maestros =====
    VISTAS.MAE = async function (vigente) {
      const k = [{ etq: 'Contratos vencidos', v: null, sub: 'personal activo', c: '#DC2626', f: () => FormContratos.abrir() },
        { etq: 'Contratos por vencer', v: null, sub: 'próximos días', c: '#D97706', f: () => FormContratos.abrir() },
        { etq: 'Documentos vencidos', v: null, sub: 'flota y conductores', c: '#B91C1C', f: () => FormDocumentos.abrir() },
        { etq: 'Documentos por vencer', v: null, sub: 'próximos días', c: '#0891B2', f: () => FormDocumentos.abrir() }];
      pintarKpis(k);
      const [con, av] = await Promise.all([puede('MAE') ? D.contratos() : null, D.avisos()]);
      if (!vigente()) return;
      const dAviso = (con && con.diasAviso) || 10;
      const act = con ? con.items.filter(x => x.estado === 'ACTIVO') : [];
      const cV = act.filter(x => typeof x.dias === 'number' && x.dias < 0), cP = act.filter(x => typeof x.dias === 'number' && x.dias >= 0 && x.dias <= dAviso);
      const sinFecha = act.filter(x => typeof x.dias !== 'number');
      const docs = (av || []).filter(a => a.tipoEntidad !== 'CONTRATOS');
      const dV = docs.filter(a => a.vencido), dP = docs.filter(a => !a.vencido);
      k[0].v = con ? cV.length : '—'; k[1].v = con ? cP.length : '—'; k[2].v = av ? dV.length : '—'; k[3].v = av ? dP.length : '—';
      pintarKpis(k);
      const filas = cV.concat(cP).map(x => ({ n: x.nombre, s: x.cargo || x.area, doc: 'Contrato', vence: x.vencimiento, dias: x.dias, f: () => FormContratos.abrir() }))
        .concat(docs.map(a => ({ n: a.nombre, s: a.tipoEntidad, doc: a.documento, vence: a.fechaVencimiento ? (d => d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() : '')(fecha(a.fechaVencimiento)) : '', dias: a.vencido ? Math.min(-1, a.dias || -1) : a.dias, f: () => FormDocumentos.abrir() })))
        .sort((a, b) => a.dias - b.dias);
      const v = filas.slice(0, 9);
      pintarIzq('Contratos y documentos por renovar', null, filas.length ? tabla([['Persona / unidad'], ['Documento'], ['Vence', 100], ['Situación', 120]], v.map(x => [
        '<b>' + esc(x.n) + '</b><div class="hl-sub">' + esc(x.s || '') + '</div>', esc(x.doc), esc(x.vence || ''),
        x.dias < 0 ? etiqueta('Vencido', '#FEE2E2', '#991B1B') : etiqueta('En ' + x.dias + ' día(s)', '#FEF3C7', '#92400E')]), filas.length) : 'No hay contratos ni documentos por renovar.', v.map(x => x.f));
      pintarAlertas([
        (cV.length + cP.length) && { n: cV.length + cP.length, t: 'Contratos vencidos o por vencer', d: sub3(cV.concat(cP), x => esc(x.nombre) + (x.dias < 0 ? ' <b class="r">vencido</b>' : ' (' + x.dias + ' d.)')), c: '#D97706', f: () => FormContratos.abrir() },
        sinFecha.length && { n: sinFecha.length, t: 'Contratos sin fecha de vencimiento', d: sub3(sinFecha, x => esc(x.nombre)), c: '#64748B', f: () => FormContratos.abrir() },
        docs.length && { n: docs.length, t: 'Documentos de flota y conductores', d: sub3(docs, a => esc(a.nombre) + ' · ' + esc(a.documento) + (a.vencido ? ' <b class="r">vencido</b>' : ' (' + a.dias + ' d.)')), c: '#B91C1C', f: () => FormDocumentos.abrir() }
      ]);
    };

    // ---------- Arranque ----------
    const listo = function () { armarNav(); saludo(); mostrar(vistaInicio()); };
    if (typeof Sesion !== 'undefined' && Sesion.alListo) Sesion.alListo(function () { setTimeout(listo, 60); }); else listo();
    [document.getElementById('cmBadge'), document.getElementById('mtAlertasBadge')].forEach(function (b) {
      if (b && window.MutationObserver) new MutationObserver(contadores).observe(b, { attributes: true, childList: true, characterData: true, subtree: true });
    });
    setInterval(saludo, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
