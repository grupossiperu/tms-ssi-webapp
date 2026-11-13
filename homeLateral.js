/**
 * homeLateral.js — Página de inicio con barra lateral + tablero del día (13/11/2026, opción A).
 * No cambia ningún módulo: arma la barra lateral a partir de los mosaicos que ya existen
 * (clic en un elemento = clic en su mosaico) y un tablero con lo del día.
 * Para volver al inicio anterior basta con quitar este archivo y home2.css de index.html.
 */
(function () {
  'use strict';
  const GRUPOS = { 'OPER': ['Operaciones', '#2563EB'], 'FIN DEP': ['Finanzas', '#059669'], 'ALM': ['Almacén', '#7C3AED'], 'MANT': ['Mantenimiento', '#DC2626'], 'MAE': ['Maestros', '#D97706'] };
  const ORDEN = ['OPER', 'FIN DEP', 'ALM', 'MANT', 'MAE'];
  const EN_CURSO = ['RETIRANDO', 'EN RUTA CLIENTE', 'EN CLIENTE', 'EN RUTA RETORNO', 'COLA PUERTO', 'EN RUTA'];
  const RAPIDOS = ['btn-consolidado-servicios', 'btn-registrar-servicio', 'btn-facturar', 'btn-deposito', 'btn-sobrecostos', 'btn-mt-salida', 'btn-incidencias', 'btn-control-mant'];

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const visible = el => el && el.style.display !== 'none';
  const may = v => String(v == null ? '' : v).trim().toUpperCase();
  const leer = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

  function fechaCorta(v) {
    const d = new Date(v); if (isNaN(d)) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function claseEstado(e) { return 'est-' + sinTildes(e || 'PROGRAMADO').replace(/[^a-z0-9]+/g, '-'); }

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
        '<nav class="hl-nav" id="hlNav" aria-label="Módulos"></nav>' +
      '</aside>' +
      '<div class="hl-main">' +
        '<div class="hl-topbar"><button type="button" class="hl-menu" id="hlMenu" aria-label="Abrir menú"><svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button></div>' +
        '<section class="hl-tablero" id="hlTablero">' +
          '<div class="hl-saludo"><div><h1 id="hlHola">Buen día</h1><p id="hlFecha"></p></div></div>' +
          '<div class="hl-kpis" id="hlKpis"></div>' +
          '<div class="hl-sec-tit">Accesos rápidos</div>' +
          '<div class="hl-rapidos" id="hlRapidos"></div>' +
          '<div class="hl-cols">' +
            '<div class="hl-card hl-viajes"><div class="hl-card-tit"><span>Viajes en curso y próximos</span><button type="button" class="hl-link" id="hlVerAcarreo">Ver todo en Acarreo →</button></div><div id="hlViajes" class="hl-vacio">Cargando…</div></div>' +
            '<div class="hl-card hl-alertas"><div class="hl-card-tit"><span>Pendientes y alertas</span></div><div id="hlAlertas" class="hl-vacio">Revisando…</div></div>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<div class="hl-velo" id="hlVelo"></div>';
    home.parentNode.insertBefore(app, home);
    const main = $('.hl-main', app);
    $('.hl-topbar', app).appendChild(top);          // barra superior (usuario, hora, botones)
    main.appendChild(home);                         // mosaicos originales (ocultos, siguen funcionando)
    ['franjaAvisosVencimiento', 'estado-hojas'].forEach(id => { const el = document.getElementById(id); if (el) main.insertBefore(el, $('#hlTablero')); });

    // ---------- Barra lateral ----------
    const nav = $('#hlNav');
    const plegados = leer('tms_hl_plegados') || {};
    function armarNav() {
      nav.innerHTML = '';
      ORDEN.forEach(function (clave) {
        const sec = grid.querySelector('.home-grupo[data-modulo="' + clave + '"]');
        if (!sec || !visible(sec)) return;
        const tiles = Array.prototype.filter.call(sec.querySelectorAll('.tile'), visible);
        if (!tiles.length) return;
        const g = document.createElement('div');
        g.className = 'hl-grupo' + (plegados[clave] ? ' plegado' : '');
        g.style.setProperty('--c', GRUPOS[clave][1]);
        g.innerHTML = '<button type="button" class="hl-grupo-tit"><span class="hl-punto"></span>' + GRUPOS[clave][0] +
          '<span class="hl-n">' + tiles.length + '</span><svg class="hl-flecha" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button><div class="hl-items"></div>';
        const cont = g.querySelector('.hl-items');
        tiles.forEach(function (t) {
          const nombre = (t.querySelector('.tile-texto strong') || t).textContent.trim();
          const desc = (t.querySelector('.tile-texto small') || {}).textContent || '';
          const ico = t.querySelector('.tile-icono svg');
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'hl-item'; b.title = desc;
          b.dataset.buscar = sinTildes(nombre + ' ' + desc + ' ' + GRUPOS[clave][0]);
          b.innerHTML = '<span class="hl-ico">' + (ico ? ico.outerHTML : '') + '</span><span class="hl-txt">' + esc(nombre) + '</span>' +
            '<span class="hl-badge" data-de="' + t.id + '"></span>';
          b.addEventListener('click', function () { cerrarMenu(); t.click(); });
          cont.appendChild(b);
        });
        g.querySelector('.hl-grupo-tit').addEventListener('click', function () {
          g.classList.toggle('plegado'); plegados[clave] = g.classList.contains('plegado'); guardar('tms_hl_plegados', plegados);
        });
        nav.appendChild(g);
      });
      contadores();
    }

    // Contadores de los mosaicos (alertas de stock y de mantenimiento) también en la barra
    function contadores() {
      [['btn-mt-stock', 'mtAlertasBadge'], ['btn-control-mant', 'cmBadge']].forEach(function (p) {
        const src = document.getElementById(p[1]), dst = nav.querySelector('.hl-badge[data-de="' + p[0] + '"]');
        if (!dst) return;
        const n = src && src.style.display !== 'none' ? src.textContent.trim() : '';
        dst.textContent = n && n !== '0' ? n : '';
      });
    }

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

    // ---------- Accesos rápidos ----------
    function rapidos() {
      const cont = $('#hlRapidos'); cont.innerHTML = '';
      RAPIDOS.map(id => document.getElementById(id)).filter(t => t && visible(t) && visible(t.closest('.home-grupo'))).slice(0, 4).forEach(function (t) {
        const g = t.closest('.home-grupo'), color = (GRUPOS[g.getAttribute('data-modulo')] || ['', '#2563EB'])[1];
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'hl-rapido'; b.style.setProperty('--c', color);
        const ico = t.querySelector('.tile-icono svg');
        b.innerHTML = '<span class="hl-ico">' + (ico ? ico.outerHTML : '') + '</span><span><strong>' + esc((t.querySelector('.tile-texto strong') || t).textContent) +
          '</strong><small>' + esc((t.querySelector('.tile-texto small') || {}).textContent || '') + '</small></span>';
        b.addEventListener('click', () => t.click());
        cont.appendChild(b);
      });
      $('.hl-sec-tit').hidden = !cont.children.length;
    }

    // ---------- KPIs + viajes ----------
    function kpi(etq, valor, sub, color, accion) {
      return '<button type="button" class="hl-kpi" style="--c:' + color + '" data-acc="' + (accion || '') + '"><small>' + etq + '</small><strong>' + valor + '</strong><span>' + sub + '</span></button>';
    }
    let servicios = null;
    async function viajes() {
      const caja = $('#hlViajes');
      if (typeof Sesion === 'undefined' || !Sesion.puede('OPER')) { $('.hl-viajes').hidden = true; return; }
      try {
        const filas = await llamarBackend('listarServiciosPendientes', { fechaDesde: '', fechaHasta: '' });
        servicios = Array.isArray(filas) ? filas : [];
      } catch (e) { servicios = null; caja.textContent = 'No se pudo cargar la lista de viajes.'; pintarKpis(); return; }
      const est = f => may(f['ESTADO']) || 'PROGRAMADO';
      const t = f => { const d = new Date(f['FECHA DE PROGRAMACION']); return isNaN(d) ? 0 : d.getTime(); };
      const lista = servicios.filter(f => EN_CURSO.indexOf(est(f)) >= 0 || est(f) === 'PROGRAMADO' || est(f) === 'REPROGRAMADO')
        .sort((a, b) => (EN_CURSO.indexOf(est(a)) >= 0 ? 0 : 1) - (EN_CURSO.indexOf(est(b)) >= 0 ? 0 : 1) || t(a) - t(b));
      if (!lista.length) caja.innerHTML = '<div class="hl-vacio">No hay viajes en curso ni programados.</div>';
      else {
        caja.className = '';
        caja.innerHTML = '<table class="hl-tabla"><thead><tr><th style="width:56px">Fecha</th><th>Cliente</th><th>Conductor</th><th>Destino</th><th style="width:132px">Estado</th></tr></thead><tbody>' +
          lista.slice(0, 9).map(f => '<tr><td>' + fechaCorta(f['FECHA DE PROGRAMACION']) + '</td><td><b>' + esc(f['CLIENTE PARA FACTURACIÓN']) + '</b><div class="hl-sub">' + esc(f['BOOKING'] || f['CODIGO SERVICIO'] || '') + '</div></td>' +
            '<td>' + esc(f['CONDUCTOR']) + '<div class="hl-sub">' + esc(f['PLACA TRACTO'] || '') + '</div></td><td>' + esc(f['DESTINO 1']) + '<div class="hl-sub">' + esc(f['PACKING'] || '') + '</div></td>' +
            '<td><span class="badge-estado ' + claseEstado(est(f)) + '">' + esc(est(f)) + '</span></td></tr>').join('') +
          '</tbody></table>' + (lista.length > 9 ? '<div class="hl-mas">y ' + (lista.length - 9) + ' más en Acarreo</div>' : '');
        caja.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('click', abrirAcarreo));
      }
      pintarKpis();
    }
    function abrirAcarreo() { const b = document.getElementById('btn-consolidado-servicios'); if (b) b.click(); }

    function pintarKpis() {
      const c = $('#hlKpis'); let h = '';
      if (servicios) {
        const est = f => may(f['ESTADO']) || 'PROGRAMADO';
        const hoy = new Date(), mes = hoy.getMonth(), anio = hoy.getFullYear();
        const enRuta = servicios.filter(f => EN_CURSO.indexOf(est(f)) >= 0).length;
        const prog = servicios.filter(f => est(f) === 'PROGRAMADO' || est(f) === 'REPROGRAMADO').length;
        const delMes = servicios.filter(f => { const d = new Date(f['FECHA DE PROGRAMACION']); return est(f) === 'CULMINADO' && d.getMonth() === mes && d.getFullYear() === anio; }).length;
        h += kpi('En ruta', enRuta, 'viajes en curso', '#2563EB', 'acarreo') + kpi('Programados', prog, 'por salir', '#0891B2', 'acarreo') + kpi('Culminados', delMes, 'este mes', '#059669', 'acarreo');
      }
      h += kpi('Alertas', totalAlertas, totalAlertas ? 'por revisar' : 'todo al día', totalAlertas ? '#DC2626' : '#64748B', 'alertas');
      c.innerHTML = h;
      c.querySelectorAll('.hl-kpi').forEach(b => b.addEventListener('click', function () {
        if (b.dataset.acc === 'acarreo') abrirAcarreo(); else { const a = $('.hl-alertas'); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      }));
    }

    // ---------- Alertas (documentos, contratos, mantenimiento, almacén) ----------
    let totalAlertas = 0;
    function alertas() {
      const items = [];
      const av = window._avisosVenc || [];
      const doc = av.filter(a => a.tipoEntidad !== 'CONTRATOS'), con = av.filter(a => a.tipoEntidad === 'CONTRATOS');
      const resumen = L => L.slice(0, 3).map(a => esc(a.nombre) + ' · ' + esc(a.documento) + (a.vencido ? ' <b class="r">vencido</b>' : ' (' + a.dias + ' d.)')).join('<br>') + (L.length > 3 ? '<br>y ' + (L.length - 3) + ' más' : '');
      if (doc.length) items.push({ n: doc.length, t: 'Documentos de flota', d: resumen(doc), c: '#D97706', f: () => FormDocumentos.abrir() });
      if (con.length) items.push({ n: con.length, t: 'Contratos', d: resumen(con), c: '#D97706', f: () => FormContratos.abrir() });
      const cm = document.getElementById('cmBadge'), cmN = cm && cm.style.display !== 'none' ? parseInt(cm.textContent, 10) || 0 : 0;
      if (cmN) items.push({ n: cmN, t: 'Mantenimiento preventivo', d: 'Unidades vencidas o por vencer (km / horas)', c: '#DC2626', f: () => FormControlMant.abrir() });
      const al = document.getElementById('mtAlertasBadge'), alN = al && al.style.display !== 'none' ? parseInt(al.textContent, 10) || 0 : 0;
      if (alN) items.push({ n: alN, t: 'Almacén', d: 'Stock bajo, vencimientos y reparaciones atrasadas', c: '#7C3AED', f: () => FormAlmacen.abrirAlertas() });
      totalAlertas = items.reduce((s, x) => s + x.n, 0);
      const caja = $('#hlAlertas');
      if (!items.length) { caja.className = 'hl-vacio'; caja.innerHTML = '<span class="hl-ok">✓</span> Sin pendientes por ahora.'; }
      else {
        caja.className = '';
        caja.innerHTML = items.map((x, i) => '<button type="button" class="hl-alerta" data-i="' + i + '" style="--c:' + x.c + '"><span class="hl-alerta-n">' + x.n + '</span><span><strong>' + x.t + '</strong><small>' + x.d + '</small></span></button>').join('');
        caja.querySelectorAll('.hl-alerta').forEach(b => b.addEventListener('click', () => { try { items[+b.dataset.i].f(); } catch (e) { /* módulo no cargado */ } }));
      }
      pintarKpis(); contadores();
    }

    // ---------- Arranque ----------
    const listo = function () {
      armarNav(); saludo(); rapidos(); pintarKpis(); viajes(); alertas();
      // Las alertas llegan después (documentos, mantenimiento, almacén): se revisan unos segundos
      let veces = 0; const iv = setInterval(function () { alertas(); if (++veces >= 8) clearInterval(iv); }, 2500);
    };
    if (typeof Sesion !== 'undefined' && Sesion.alListo) Sesion.alListo(function () { setTimeout(listo, 60); }); else listo();
    [document.getElementById('cmBadge'), document.getElementById('mtAlertasBadge')].forEach(function (b) {
      if (b && window.MutationObserver) new MutationObserver(alertas).observe(b, { attributes: true, childList: true, characterData: true, subtree: true });
    });
    setInterval(saludo, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
