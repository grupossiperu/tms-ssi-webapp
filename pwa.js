/**
 * pwa.js (v135, 24/11/2026) — App instalable en el celular.
 * - Registra sw.js.
 * - Android / Chrome / Edge: botón "📲 Instalar app" (evento beforeinstallprompt).
 * - iPhone (Safari): aviso con los pasos (Compartir → Agregar a inicio), una vez.
 * - Si ya se abrió como app instalada, no muestra nada.
 */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* sin app instalable */ }); });
  }
  const instalada = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (instalada) { document.documentElement.classList.add('modo-app'); return; }
  let aviso = null;
  const css = document.createElement('style');
  css.textContent = '#pwaBtn{position:fixed;right:14px;bottom:14px;z-index:9000;background:#1c3a5e;color:#fff;border:none;border-radius:999px;padding:12px 18px;font-size:1rem;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,.25);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}' +
    '#pwaBtn small{font-weight:600;opacity:.8;margin-left:6px}#pwaX{position:fixed;right:10px;bottom:62px;z-index:9001;background:#fff;border:1px solid #cbd5e1;border-radius:999px;width:26px;height:26px;font-size:.8rem;line-height:1}' +
    '#pwaIos{position:fixed;left:10px;right:10px;bottom:12px;z-index:9000;background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;font-size:.98rem;color:#0f172a}' +
    '#pwaIos b{color:#1c3a5e}#pwaIos button{margin-top:10px;width:100%;border:none;border-radius:12px;padding:10px;background:#1c3a5e;color:#fff;font-weight:800;font-size:1rem}';
  document.head.appendChild(css);
  const cerrado = function () { try { return localStorage.getItem('tms_pwa_no') === '1'; } catch (e) { return false; } };
  const noMostrar = function () { try { localStorage.setItem('tms_pwa_no', '1'); } catch (e) { /* no-op */ } };

  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault(); aviso = ev;
    if (cerrado() || document.getElementById('pwaBtn')) return;
    const b = document.createElement('button'); b.id = 'pwaBtn'; b.type = 'button'; b.innerHTML = '📲 Instalar app<small>TMS SSI</small>';
    const x = document.createElement('button'); x.id = 'pwaX'; x.type = 'button'; x.title = 'No mostrar'; x.textContent = '✕';
    b.addEventListener('click', async function () {
      if (!aviso) return;
      aviso.prompt();
      try { await aviso.userChoice; } catch (e) { /* no-op */ }
      aviso = null; b.remove(); x.remove();
    });
    x.addEventListener('click', function () { noMostrar(); b.remove(); x.remove(); });
    document.body.appendChild(b); document.body.appendChild(x);
  });
  window.addEventListener('appinstalled', function () { ['pwaBtn', 'pwaX'].forEach(function (id) { const e = document.getElementById(id); if (e) e.remove(); }); });

  // iPhone / iPad con Safari: no hay botón automático, se explican los pasos.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !cerrado()) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        const d = document.createElement('div'); d.id = 'pwaIos';
        d.innerHTML = '📲 <b>Instala la app TMS SSI</b> en tu iPhone:<br>1. Toca el botón <b>Compartir</b> (cuadrado con flecha ↑) abajo en Safari.<br>2. Elige <b>"Agregar a inicio"</b>.<br>3. Abre la app desde el ícono <b>TMS SSI</b>.<button type="button">Entendido</button>';
        d.querySelector('button').addEventListener('click', function () { noMostrar(); d.remove(); });
        document.body.appendChild(d);
      }, 2500);
    });
  }
})();
