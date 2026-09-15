/**
 * forms/consolidadoServicios.js
 * -------------------------------------------------------------------------
 * Modulo "Consolidado de Servicios" (boton dedicado de la pantalla
 * principal). Lista los servicios de SERVICIOS cuyo ESTADO es 'CULMINADO'
 * con: Fecha, Cliente, Booking, Conductor, Tracto, Tipo de carga,
 * Posicionamiento 1, Destino 1, Estado y Datos finales (Completo /
 * Incompleto), igual que "Servicios Culminados", pero aca ademas hay un
 * boton explicito "Completar" en cada fila (en vez de depender de un
 * doble clic) para dejar claro el paso que falta antes de poder usar
 * el boton "Facturar": mientras "Datos finales" no diga Completo, ese
 * servicio no va a aparecer como pendiente de facturar.
 *
 * "Datos finales" refleja si ya se grabo el detalle del Consolidado para
 * ese servicio (columna SERVICIOS['CONSOLIDADO REGISTRADO']). El boton
 * "Completar" abre el mismo formulario de detalle que usa "Servicios
 * Culminados" (FormConsolidadoServicio), que autorellena lo que ya existe
 * en SERVICIOS y deja en blanco lo que falta.
 * -------------------------------------------------------------------------
 */
const FormConsolidadoServicios = {

    abrir: async function () {
          const html = `
                <div class="barra-filtros">
                        <div class="campo"><label>Desde</label><input type="text" id="filtroConsDesde" placeholder="dd/mm/yyyy"></div>
                                <div class="campo"><label>Hasta</label><input type="text" id="filtroConsHasta" placeholder="dd/mm/yyyy"></div>
                                        <div class="campo"><label>Datos finales</label>
                                                  <select id="filtroConsDatos">
                                                              <option value="">Todos</option>
                                                                          <option value="completo">Completo</option>
                                                                                      <option value="incompleto">Datos incompletos</option>
                                                                                                </select>
                                                                                                        </div>
                                                                                                                <button class="boton-secundario" id="btnBorrarFiltroCons">Borrar filtro</button>
                                                                                                                      </div>
                                                                                                                            <div style="max-height:460px; overflow:auto;">
                                                                                                                                    <table class="tabla-lista" id="tablaConsolidadoServicios">
                                                                                                                                              <thead><tr>
                                                                                                                                                          <th>Fecha</th><th>Cliente</th><th>Booking</th><th>Conductor</th><th>Tracto</th>
                                                                                                                                                                      <th>Tipo de carga</th><th>Posicionamiento 1</th><th>Destino 1</th>
                                                                                                                                                                                  <th>Estado</th><th>Datos finales</th><th></th>
                                                                                                                                                                                            </tr></thead>
                                                                                                                                                                                                      <tbody></tbody>
                                                                                                                                                                                                              </table>
                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                          <div class="panel-footer" style="padding-top:10px; justify-content:flex-end;">
                                                                                                                                                                                                                                  <button class="boton-secundario" id="btnCerrarConsolidadoServicios">Cerrar</button>
                                                                                                                                                                                                                                        </div>`;

      abrirPanel('Consolidado de Servicios', html, (raiz) => this._wire(raiz), { ancho: true });
    },

    _wire: function (raiz) {

      function formatoFecha(v) {
              if (!v) return '';
              const d = new Date(v);
              if (isNaN(d.getTime())) return String(v);
              return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
      }

      function esVerdadero(v) {
              return v === true || String(v).trim().toUpperCase() === 'TRUE' || String(v).trim().toUpperCase() === 'SI';
      }

      function datosFinalesCompletos(f) {
              return esVerdadero(f['CONSOLIDADO REGISTRADO']);
      }

      async function cargar() {
              const filtros = {
                        estado: 'CULMINADO',
                        fechaDesde: raiz.querySelector('#filtroConsDesde').value.trim(),
                        fechaHasta: raiz.querySelector('#filtroConsHasta').value.trim()
              };
              let filas = await llamarBackend('listarServiciosPendientes', filtros);

            const datos = raiz.querySelector('#filtroConsDatos').value;
              if (datos === 'completo') filas = filas.filter(f => datosFinalesCompletos(f));
              if (datos === 'incompleto') filas = filas.filter(f => !datosFinalesCompletos(f));

            filas = filas.slice().sort(function (a, b) {
                      const da = new Date(a['FECHA DE PROGRAMACION']);
                      const db = new Date(b['FECHA DE PROGRAMACION']);
                      const ta = isNaN(da.getTime()) ? -Infinity : da.getTime();
                      const tb = isNaN(db.getTime()) ? -Infinity : db.getTime();
                      return tb - ta;
            });

            const tbody = raiz.querySelector('#tablaConsolidadoServicios tbody');
              tbody.innerHTML = '';
              filas.forEach(function (f) {
                        const completo = datosFinalesCompletos(f);
                        const tr = document.createElement('tr');
                        tr.dataset.fila = f._fila;
                        tr.innerHTML = `
                                  <td>${formatoFecha(f['FECHA DE PROGRAMACION'])}</td>
                                            <td>${f['CLIENTE PARA FACTURACIÓN'] || ''}</td>
                                                      <td>${f['BOOKING'] || ''}</td>
                                                                <td>${f['CONDUCTOR'] || ''}</td>
                                                                          <td>${f['PLACA TRACTO'] || ''}</td>
                                                                                    <td>${f['TIPO DE CARGA'] || ''}</td>
                                                                                              <td>${f['LUGAR DE POSICIONAMIENTO 1'] || ''}</td>
                                                                                                        <td>${f['DESTINO 1'] || ''}</td>
                                                                                                                  <td>${f['ESTADO'] || ''}</td>
                                                                                                                            <td style="text-align:center;">
                                                                                                                                        ${completo
                                                                                                                                                        ? '<span class="badge-datos completo">Completo</span>'
                                                                                                                                                        : '<span class="badge-datos incompleto">Datos incompletos</span>'}
                                                                                                                                                                  </td>
                                                                                                                                                                            <td style="text-align:center;">
                                                                                                                                                                                        <button type="button" class="boton-primario boton-chico btn-completar-consolidado">${completo ? 'Revisar' : 'Completar'}</button>
                                                                                                                                                                                                  </td>`;

                                    tr.querySelector('.btn-completar-consolidado').addEventListener('click', function (ev) {
                                                ev.stopPropagation();
                                                FormConsolidadoServicio.abrir(f._fila, 'CULMINADO');
                                    });

                                    tbody.appendChild(tr);
              });

            if (!filas.length) {
                      const tr = document.createElement('tr');
                      tr.innerHTML = '<td colspan="11" style="text-align:center; color:#8b95a1; padding:18px;">No hay servicios culminados con estos filtros.</td>';
                      tbody.appendChild(tr);
            }
      }

      ['filtroConsDesde', 'filtroConsHasta', 'filtroConsDatos'].forEach(function (id) {
              raiz.querySelector('#' + id).addEventListener('change', cargar);
      });

      raiz.querySelector('#btnBorrarFiltroCons').addEventListener('click', function () {
              raiz.querySelector('#filtroConsDesde').value = '';
              raiz.querySelector('#filtroConsHasta').value = '';
              raiz.querySelector('#filtroConsDatos').value = '';
              cargar();
      });

      raiz.querySelector('#btnCerrarConsolidadoServicios').addEventListener('click', cerrarPanel);

      cargar();
    }
};
