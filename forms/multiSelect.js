/**
 * forms/multiSelect.js
 * -------------------------------------------------------------------------
 * Filtro de selección múltiple reutilizable (Acarreo, Depósito, etc.).
 * Muestra un botón con el resumen de lo elegido ("Todos", un valor o
 * "N seleccionados") y, al hacer clic, una lista con casillas y buscador.
 * Sin nada marcado equivale a "Todos".
 *
 * Uso:
 *   const ms = crearMultiSelect(divContenedor, { textoTodos: 'Todos', onChange: fn });
 *   ms.setOpciones(['A', 'B']);   // lista de valores
 *   ms.valores();                 // ['A'] (vacío = todos)
 *   ms.cumple('A');               // true si pasa el filtro
 *   ms.limpiar();
 * -------------------------------------------------------------------------
 */
function crearMultiSelect(contenedor, opciones) {
  opciones = opciones || {};
  const textoTodos = opciones.textoTodos || 'Todos';
  let lista = [];
  const seleccion = new Set();

  const esc = function (t) {
    return String(t === null || t === undefined ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  contenedor.classList.add('ms');
  contenedor.innerHTML =
    '<button type="button" class="ms-boton"><span class="ms-texto"></span><span class="ms-flecha">▾</span></button>' +
    '<div class="ms-panel" style="display:none;">' +
      '<input type="text" class="ms-buscar" placeholder="Buscar…" autocomplete="off">' +
      '<div class="ms-lista"></div>' +
      '<div class="ms-pie"><button type="button" class="ms-limpiar">Quitar selección</button><button type="button" class="ms-listo">Listo</button></div>' +
    '</div>';

  const boton = contenedor.querySelector('.ms-boton');
  const panel = contenedor.querySelector('.ms-panel');
  const buscar = contenedor.querySelector('.ms-buscar');
  const cajaLista = contenedor.querySelector('.ms-lista');
  const texto = contenedor.querySelector('.ms-texto');

  const actualizarTexto = function () {
    const n = seleccion.size;
    texto.textContent = n === 0 ? textoTodos : (n === 1 ? Array.from(seleccion)[0] : n + ' seleccionados');
    contenedor.classList.toggle('ms-activo', n > 0);
    boton.title = n === 0 ? textoTodos : Array.from(seleccion).join(', ');
  };

  const pintar = function () {
    const q = buscar.value.trim().toUpperCase();
    const visibles = lista.filter(function (v) { return !q || String(v).toUpperCase().indexOf(q) !== -1; });
    cajaLista.innerHTML = visibles.length
      ? visibles.map(function (v) {
          return '<label class="ms-op"><input type="checkbox" data-v="' + esc(v) + '"' + (seleccion.has(v) ? ' checked' : '') + '> <span>' + esc(v) + '</span></label>';
        }).join('')
      : '<div class="ms-vacio">Sin resultados</div>';
  };

  const notificar = function () {
    actualizarTexto();
    if (typeof opciones.onChange === 'function') opciones.onChange(Array.from(seleccion));
  };

  const cerrar = function () { panel.style.display = 'none'; };

  boton.addEventListener('click', function (ev) {
    ev.stopPropagation();
    const abierto = panel.style.display !== 'none';
    document.querySelectorAll('.ms-panel').forEach(function (p) { p.style.display = 'none'; });
    if (!abierto) {
      panel.style.display = '';
      buscar.value = '';
      pintar();
      setTimeout(function () { buscar.focus(); }, 0);
    }
  });
  panel.addEventListener('click', function (ev) { ev.stopPropagation(); });
  buscar.addEventListener('input', pintar);
  cajaLista.addEventListener('change', function (ev) {
    const chk = ev.target;
    if (!chk || chk.type !== 'checkbox') return;
    const v = lista.find(function (x) { return String(x) === chk.dataset.v; });
    if (v === undefined) return;
    if (chk.checked) seleccion.add(v); else seleccion.delete(v);
    notificar();
  });
  contenedor.querySelector('.ms-limpiar').addEventListener('click', function () {
    seleccion.clear();
    pintar();
    notificar();
  });
  contenedor.querySelector('.ms-listo').addEventListener('click', cerrar);

  const alHacerClicAfuera = function (ev) {
    if (!document.body.contains(contenedor)) {
      document.removeEventListener('click', alHacerClicAfuera);
      return;
    }
    if (!contenedor.contains(ev.target)) cerrar();
  };
  document.addEventListener('click', alHacerClicAfuera);

  actualizarTexto();

  return {
    setOpciones: function (nuevas) {
      lista = Array.from(new Set((nuevas || []).map(function (v) { return String(v); }))).filter(Boolean);
      // Lo ya marcado que todavía exista se conserva.
      Array.from(seleccion).forEach(function (v) { if (lista.indexOf(v) === -1) seleccion.delete(v); });
      if (panel.style.display !== 'none') pintar();
      actualizarTexto();
    },
    valores: function () { return Array.from(seleccion); },
    cumple: function (valor) {
      if (seleccion.size === 0) return true;
      return seleccion.has(String(valor === null || valor === undefined ? '' : valor).trim().toUpperCase()) ||
        seleccion.has(String(valor === null || valor === undefined ? '' : valor).trim());
    },
    limpiar: function () { seleccion.clear(); actualizarTexto(); if (panel.style.display !== 'none') pintar(); }
  };
}
