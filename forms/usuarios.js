/**
 * forms/usuarios.js  (v73)
 * -------------------------------------------------------------------------
 * - Usuarios y permisos (solo rol MAESTRO): crear usuarios, cambiar nombre,
 *   rol y estado (activo/desactivado), desbloquear y poner una contraseña
 *   temporal (el usuario deberá cambiarla al ingresar).
 * - Cambiar mi contraseña (cualquier usuario).
 * Las contraseñas nunca se guardan ni se muestran: el backend guarda solo
 * un hash. Backend: usuariosListar, usuariosGrabar, usuariosResetClave,
 * cambiarMiClave.
 * -------------------------------------------------------------------------
 */
const FormUsuarios = {

  ROLES_TEXTO: {
    MAESTRO: 'Maestro — todo el sistema, Resultados y usuarios',
    TRANSPORTE: 'Transporte — Operaciones, Almacén, Mantenimiento y Maestros',
    FACTURACION: 'Facturación — Finanzas y Maestros',
    MANTENIMIENTO: 'Mantenimiento — solo Mantenimiento'
  },

  _lista: [],
  _roles: [],

  abrir: async function () {
    const self = this;
    const html = `
      <div class="usr-caja">
        <h3 id="usrTitulo" style="margin:0 0 10px;color:var(--azul-marino-oscuro);font-size:1rem;">Nuevo usuario</h3>
        <div class="usr-form">
          <div class="campo"><label>Usuario</label><input type="text" id="usrUsuario" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ej. jperez"></div>
          <div class="campo"><label>Nombre de la persona</label><input type="text" id="usrNombre" autocomplete="off" style="text-transform:uppercase"></div>
          <div class="campo"><label>Rol</label><select id="usrRol"></select></div>
          <div class="campo"><label id="usrClaveLbl">Contraseña temporal</label><input type="text" id="usrClave" autocomplete="off" placeholder="mín. 6 caracteres"></div>
        </div>
        <div class="usr-checks" id="usrChecks" style="display:none;margin-top:10px;">
          <label><input type="checkbox" id="usrActivo"> Activo (puede ingresar)</label>
          <label><input type="checkbox" id="usrDesbloquear"> Desbloquear (intentos fallidos)</label>
        </div>
        <p id="usrRolAyuda" style="font-size:.8rem;color:#64748b;margin:8px 0 0;"></p>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="boton-primario" id="usrGrabar" type="button">Crear usuario</button>
          <button class="boton-secundario" id="usrCancelar" type="button" style="display:none;">Cancelar edición</button>
        </div>
      </div>
      <table class="usr-tabla">
        <colgroup><col style="width:13%"><col style="width:24%"><col style="width:15%"><col style="width:14%"><col style="width:17%"><col style="width:17%"></colgroup>
        <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
        <tbody id="usrCuerpo"><tr><td colspan="6">Cargando…</td></tr></tbody>
      </table>`;
    abrirPanel('Usuarios y permisos', html, function (raiz) { self._wire(raiz); }, { ancho: true });
  },

  _wire: function (raiz) {
    const self = this;
    const $ = function (id) { return raiz.querySelector('#' + id); };
    let editando = null;

    const ayudaRol = function () { $('usrRolAyuda').textContent = self.ROLES_TEXTO[$('usrRol').value] || ''; };
    $('usrRol').addEventListener('change', ayudaRol);

    const limpiar = function () {
      editando = null;
      $('usrTitulo').textContent = 'Nuevo usuario';
      $('usrUsuario').value = ''; $('usrUsuario').disabled = false;
      $('usrNombre').value = ''; $('usrClave').value = '';
      $('usrClaveLbl').textContent = 'Contraseña temporal';
      $('usrClave').placeholder = 'mín. 6 caracteres';
      $('usrChecks').style.display = 'none';
      $('usrGrabar').textContent = 'Crear usuario';
      $('usrCancelar').style.display = 'none';
      if ($('usrRol').options.length) $('usrRol').value = 'TRANSPORTE';
      ayudaRol();
      _refrescarSnapshotFormulario();
    };

    const editar = function (u) {
      editando = u;
      $('usrTitulo').textContent = 'Editar usuario: ' + u.usuario;
      $('usrUsuario').value = u.usuario; $('usrUsuario').disabled = true;
      $('usrNombre').value = u.nombre;
      $('usrRol').value = u.rol;
      $('usrClave').value = '';
      $('usrClaveLbl').textContent = 'Nueva contraseña temporal (opcional)';
      $('usrClave').placeholder = 'déjelo vacío para no cambiarla';
      $('usrActivo').checked = u.activo;
      $('usrDesbloquear').checked = false;
      $('usrChecks').style.display = '';
      $('usrGrabar').textContent = 'Guardar cambios';
      $('usrCancelar').style.display = '';
      ayudaRol();
      raiz.scrollTop = 0;
      _refrescarSnapshotFormulario();
    };

    const pintar = function () {
      const cuerpo = $('usrCuerpo');
      if (!self._lista.length) { cuerpo.innerHTML = '<tr><td colspan="6">Sin usuarios.</td></tr>'; return; }
      cuerpo.innerHTML = self._lista.map(function (u, i) {
        const estado = !u.activo ? '<span class="usr-badge usr-no">Desactivado</span>'
          : u.bloqueado ? '<span class="usr-badge usr-no">Bloqueado</span>'
          : u.cambiarClave ? '<span class="usr-badge usr-warn">Clave por crear</span>'
          : '<span class="usr-badge usr-ok">Activo</span>';
        return '<tr><td><strong>' + esc(u.usuario) + '</strong></td><td>' + esc(u.nombre) + '</td><td>' + esc(u.rol) + '</td><td>' + estado +
          '</td><td>' + esc(u.ultimoIngreso || '—') + '</td><td><button class="boton-secundario" type="button" data-i="' + i + '" style="padding:4px 10px;font-size:.78rem;">Editar</button></td></tr>';
      }).join('');
      cuerpo.querySelectorAll('button[data-i]').forEach(function (b) {
        b.addEventListener('click', function () { editar(self._lista[Number(b.dataset.i)]); });
      });
    };

    const cargar = async function () {
      const r = await llamarBackend('usuariosListar', {});
      if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo cargar la lista de usuarios.', 'error'); return; }
      self._lista = r.usuarios || [];
      self._roles = r.roles || [];
      if (!$('usrRol').options.length) {
        $('usrRol').innerHTML = self._roles.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
        limpiar();
      }
      pintar();
    };

    protegerClic($('usrGrabar'), async function () {
      const usuario = $('usrUsuario').value.trim().toLowerCase();
      const nombre = $('usrNombre').value.trim().toUpperCase();
      const rol = $('usrRol').value;
      const clave = $('usrClave').value.trim();
      if (!editando) {
        const r = await llamarBackend('usuariosGrabar', { nuevo: true, usuario: usuario, nombre: nombre, rol: rol, clave: clave, activo: true });
        if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo crear el usuario.', 'error'); return; }
        mostrarMensaje(r.mensaje + '\nEntréguele su usuario y la contraseña temporal.', 'exito');
      } else {
        if (clave && clave.length < 6) { mostrarMensaje('La contraseña temporal debe tener al menos 6 caracteres.', 'error'); return; }
        const r = await llamarBackend('usuariosGrabar', { usuario: editando.usuario, nombre: nombre, rol: rol, activo: $('usrActivo').checked, desbloquear: $('usrDesbloquear').checked });
        if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo guardar.', 'error'); return; }
        let msg = r.mensaje;
        if (clave) {
          const r2 = await llamarBackend('usuariosResetClave', { usuario: editando.usuario, clave: clave });
          if (!r2 || !r2.ok) { mostrarMensaje(msg + '\n\nPero la contraseña NO se cambió: ' + ((r2 && r2.mensaje) || 'error'), 'error'); await cargar(); return; }
          msg += '\n' + r2.mensaje;
        }
        mostrarMensaje(msg, 'exito');
      }
      limpiar();
      await cargar();
    });
    $('usrCancelar').addEventListener('click', limpiar);
    cargar();
  },

  /** Cambiar mi contraseña (cualquier usuario con sesión). */
  cambiarMiClave: function () {
    const d = Sesion.datos() || {};
    const html = `
      <div style="max-width:380px;margin:0 auto;">
        <p style="font-size:.85rem;color:#64748b;margin-top:0;">Usuario: <strong>${esc(d.usuario || '')}</strong>. La contraseña nueva debe tener mínimo 8 caracteres, con letras y números, y no contener su usuario.</p>
        <div class="campo"><label>Contraseña actual</label><input type="password" id="mcActual" autocomplete="current-password"></div>
        <div class="campo"><label>Contraseña nueva</label><input type="password" id="mcNueva" autocomplete="new-password"></div>
        <div class="campo"><label>Repita la contraseña nueva</label><input type="password" id="mcRepite" autocomplete="new-password"></div>
        <button class="boton-primario" id="mcGrabar" type="button" style="width:100%;">Cambiar contraseña</button>
      </div>`;
    abrirPanel('Cambiar mi contraseña', html, function (raiz) {
      const $ = function (id) { return raiz.querySelector('#' + id); };
      protegerClic($('mcGrabar'), async function () {
        if ($('mcNueva').value !== $('mcRepite').value) { mostrarMensaje('Las contraseñas nuevas no coinciden.', 'error'); return; }
        const r = await llamarBackend('cambiarMiClave', { actual: $('mcActual').value, nueva: $('mcNueva').value });
        if (!r || !r.ok) { mostrarMensaje((r && r.mensaje) || 'No se pudo cambiar la contraseña.', 'error'); return; }
        cerrarPanel();
        mostrarMensaje('Contraseña cambiada. Se cerraron sus otras sesiones abiertas.', 'exito');
      });
      setTimeout(function () { $('mcActual').focus(); }, 50);
    });
  }
};
