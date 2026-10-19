# Se ejecuta desde generar.py (al final): el editor en edición y las vistas de móvil.

# ── Notas en edición ────────────────────────────────────────────────────────
def tb(label, text, on=False):
    return f'<button type="button" aria-label="{label}"{" aria-pressed=\"true\" class=\"on\"" if on else ""}>{text}</button>'


BUBBLE = (tb('Negrita', 'B', True) + tb('Cursiva', '<i>I</i>') + tb('Tachado', '<s>S</s>') + tb('Código', '<span class="mono">&lt;/&gt;</span>')
          + tb('Enlace', icon('link')) + '<span class="sepv" aria-hidden="true"></span>' + tb('Convertir en título', 'T2')
          + tb('Convertir en lista', icon('menu')) + '<span class="sepv" aria-hidden="true"></span>' + tb('Enlazar un ticket', '#'))
SLASH = [('T', 'Texto', 'Párrafo normal', False), ('T2', 'Título 2', 'Sección', True), ('T3', 'Título 3', 'Subsección', False),
         ('▦', 'Tabla', '3 × 3, con cabecera', False), ('#', 'Ticket', 'Enlace a un ticket del espacio', False), ('☐', 'Tareas', 'Lista con casillas', False)]
slash = ''.join(f'<span class="menu-item{" on" if on else ""}" role="option" aria-selected="{"true" if on else "false"}"><span class="glyph" aria-hidden="true">{g}</span><span>{t}<small>{d}</small></span></span>' for g, t, d, on in SLASH)
TK = [('progress', 'Generar facturas en PDF', 'En curso', True), ('progress', 'Facturación por uso', 'En curso', False), ('done', 'Selector de plan en ajustes', 'Hecho', False)]
tk = ''.join(f'<span class="menu-item{" on" if on else ""}" role="option" aria-selected="{"true" if on else "false"}"><span class="sw" style="--c:var(--st-{s})"></span><span>{t}</span><span class="push hint">{k}</span></span>' for s, t, k, on in TK)
FORMAT = (tb('Negrita', 'B') + tb('Cursiva', '<i>I</i>') + tb('Enlace', icon('link')) + tb('Título', 'T2', True) + tb('Lista', icon('menu'))
          + tb('Tareas', '☐') + tb('Enlazar un ticket', '#') + tb('Insertar bloque', '/') + tb('Cerrar el teclado', icon('chev-down')))
KB_ROWS = ['qwertyuiop', 'asdfghjklñ', '⇧zxcvbnm⌫', ['123', 'espacio', 'intro']]
kb = ''.join('<div class="kb-row">' + ''.join(f'<span class="{"w" if len(k) > 1 else ""}">{k}</span>' for k in row) + '</div>' for row in KB_ROWS)

editor = f"""<div class="notes">
  <nav class="tree" aria-label="Árbol de notas">
    <div class="tree-head"><h2>Notas</h2><button class="btn btn-ghost btn-sm" type="button">{icon('plus')}Nueva</button></div>
    <ul>
      <li><a href="#" aria-current="page">Arquitectura general</a>
        <ul><li><a href="#">Modelo de datos</a></li><li><a href="#">Despliegue en la VM</a></li></ul></li>
      <li><a href="#">Guía de incorporación</a></li>
      <li><a href="#">Actas de sprint</a></li>
    </ul>
  </nav>
  <article class="doc">
    <div class="doc-inner">
      <h1 class="doc-title">Arquitectura general</h1>
      <div class="doc-meta"><span class="avatar p-avery">av</span><span><b style="color:var(--text)">avery</b> · editando</span>{chip('API')}{chip('Q4')}<span style="margin-left:auto" class="sync-pill busy">Guardando…</span></div>
      <div class="prose">
        <p>Forge OS corre como <b>un solo proceso</b> de Astro en modo servidor, sobre un archivo de SQLite.</p>
        <div class="blk hover"><button class="drag-handle" type="button" aria-label="Mover el bloque o abrir su menú">{icon('grip')}</button>
          <p>Cada consulta va filtrada por <code>workspace_id</code>. Ese filtro es la frontera entre espacios, así que se aplica en la capa de datos y no en la interfaz.</p></div>
        <div class="blk sel-blk">
          <div class="bubble" role="toolbar" aria-label="Formato del texto seleccionado">{BUBBLE}</div>
          <p>Los manejadores de <code>src/pages/api</code> son la API: <span class="sel"><b>no hay una capa aparte</b></span> que mantener en sincronía.</p></div>
        <h2>Piezas</h2>
        <div class="blk tbl-edit">
          <table><thead><tr><th>Pieza</th><th class="on">Dónde vive</th><th>Quién responde</th></tr></thead>
          <tbody><tr><td>Base de datos</td><td><code>/var/lib/forge-os</code></td><td>avery</td></tr>
          <tr><td>Archivos</td><td>Drive de quien conecta el espacio</td><td>blake</td></tr>
          <tr><td>Proxy</td><td>Caddy<span class="caret"></span></td><td>noor</td></tr></tbody></table>
          <button class="add-col" type="button" aria-label="Añadir columna">{icon('plus')}</button>
        </div>
        <button class="add-row" type="button" aria-label="Añadir fila">{icon('plus')}</button>
        <div class="blk tick-blk"><p>Lo detalla <span class="ticket-ref"><span class="sw" style="--c:var(--st-todo)"></span>Búsqueda de texto completo en páginas</span> y, para las facturas, <span class="typing" style="white-space:nowrap"><b>#fact</b><span class="caret"></span></span></p>
          <div class="menu pop" role="listbox" aria-label="Tickets que coinciden" style="top:calc(100% - 8px);left:min(240px,30%);width:320px"><span class="menu-label">Enlazar un ticket</span>{tk}</div></div>
        <div class="blk"><p class="typing"><b>/t</b><span class="caret"></span> <span class="placeholder">Escribe para filtrar bloques</span></p>
          <div class="menu pop slash" role="listbox" aria-label="Insertar un bloque" style="top:100%;left:0"><span class="menu-label">Bloques</span>{slash}<div class="cmdk-foot" style="padding:8px 10px 2px;border-top:1px solid var(--border);margin-top:4px"><span><kbd>↵</kbd> insertar</span><span><kbd>Esc</kbd> cerrar</span></div></div></div>
      </div>
    </div>
  </article>
</div>
<div class="format-bar" role="toolbar" aria-label="Formato">{FORMAT}</div>
<div class="fake-kb" aria-hidden="true">{kb}</div>"""

ED_CSS = """<style>
.doc-inner { position: relative; }
.prose .blk { margin-bottom: 14px; }
.prose .blk > p { margin: 0; }
.sel-blk { margin-top: 64px; }
.bubble { top: -54px; left: 290px; }
.tick-blk { margin-bottom: 200px !important; }
@media (max-width: 820px) { .tick-blk { margin-bottom: 14px !important; } }
.bubble > button, .format-bar > button { background: none; border: 0; color: inherit; font: inherit; cursor: pointer; }
.bubble > button { min-width: 32px; height: 32px; padding: 0 8px; display: grid; place-items: center; border-radius: 8px; font-size: var(--t-13); font-weight: 750; }
.bubble > button.on { background: color-mix(in srgb, var(--bg) 20%, var(--text)); }
.bubble .icon, .format-bar .icon { width: 16px; height: 16px; }
.pop { position: absolute; z-index: 4; }
.slash { width: 300px; }
.caret { display: inline-block; width: 1.5px; height: 1.1em; background: var(--text); vertical-align: -0.18em; margin-left: 1px; }
.tbl-edit table { margin: 0; }
.tbl-edit .add-col { border: 0; cursor: pointer; }
.add-row { display: grid; place-items: center; width: 100%; height: 22px; border: 0; border-radius: 8px; background: var(--surface-2); color: var(--muted); margin: 6px 0 22px; cursor: pointer; }
.prose .drag-handle { border: 0; cursor: grab; }
.prose { padding-bottom: 300px; }
.fake-kb { display: none; }
@media (max-width: 820px) {
  .bubble, .drag-handle, .pop { display: none; }
  .sel-blk { margin-top: 0; }
  body:has(.fake-kb) .bottom-nav { display: none; }
  .format-bar { bottom: 236px; }
  .format-bar > button { min-width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; font-weight: 750; flex: none; }
  .format-bar > button.on { background: color-mix(in srgb, var(--bg) 20%, var(--text)); }
  .fake-kb { display: flex; flex-direction: column; gap: 9px; position: fixed; left: 0; right: 0; bottom: 0; height: 228px; padding: 10px 4px 30px; background: var(--surface-2); z-index: 20; }
  .kb-row { display: flex; gap: 5px; justify-content: center; }
  .kb-row span { flex: 1; max-width: 34px; height: 40px; border-radius: 6px; background: var(--surface-1); display: grid; place-items: center; font-size: 17px; box-shadow: 0 1px 0 rgb(0 0 0 / .18); }
  .kb-row span.w { max-width: none; font-size: 13px; }
  .kb-row:last-child span:nth-child(2) { flex: 4; }
  .main { padding-bottom: 300px; }
}
</style>"""
write('notas-edicion.html', shell('notas', ['Atlas Platform', 'Notas', 'Arquitectura general'], editor, 'Editando una nota', extra_head=ED_CSS))

# ── Hoja «Más» del móvil ────────────────────────────────────────────────────
MAS = [('home', 'Inicio', 'inicio.html'), ('activity', 'Actividad', 'actividad.html'), ('table', 'Tablas', 'tablas.html'),
       ('folder', 'Archivos', 'archivos.html'), ('chart', 'Métricas', 'metricas.html'), ('users', 'Personas', 'personas.html'),
       ('settings', 'Ajustes del espacio', 'ajustes-espacio.html'), ('user', 'Tu cuenta', 'ajustes.html')]
mas_links = ''.join(f'<a href="{h}">{icon(i, 22)}<span>{t}</span></a>' for i, t, h in MAS)
sheet_more = f"""<div class="sheet-scrim" aria-hidden="true"></div>
<div class="sheet" role="dialog" aria-labelledby="mas-t">
  <div class="grab" aria-hidden="true"></div>
  <h2 id="mas-t" class="sr-only">Más</h2>
  <a class="ws-switch" href="ventanas.html#espacios" style="margin:0 0 14px" aria-label="Cambiar de espacio: Atlas Platform"><span><strong>Atlas Platform</strong><span class="mono">#atlas · cambiar de espacio</span></span></a>
  <nav class="more-grid" aria-label="Más secciones">{mas_links}</nav>
  <div class="more-foot">
    <button class="btn btn-ghost" type="button" onclick="cambiarTema()">{icon('theme')}Cambiar tema</button>
    <button class="btn btn-ghost" type="button">{icon('logout')}Cerrar sesión</button>
  </div>
</div>"""
MAS_CSS = """<style>
.more-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.more-grid a { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; padding: 14px 12px; border-radius: 16px; background: var(--bg); font-size: var(--t-13); font-weight: 650; min-height: 82px; }
.more-grid a .icon { color: var(--muted); }
.more-foot { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.sheet { z-index: 30; }
.sheet-scrim { z-index: 25; }
</style>"""
write('movil-mas.html', shell('mas', ['Atlas Platform', 'Panel'], panel, 'Más', overlay=sheet_more, extra_head=MAS_CSS))

# ── Móvil: cuatro pantallas en un teléfono ──────────────────────────────────
PHONES = [('tablero.html', 'Tablero', 'Una columna cada vez, pestañas arriba con el recuento y la barra de cuatro destinos abajo.'),
          ('ticket.html', 'Ticket como hoja', 'El cajón lateral sube desde abajo y ocupa casi toda la pantalla; el asa dice que se puede bajar para cerrarlo.'),
          ('notas-edicion.html', 'Editor con teclado', 'Con el teclado abierto, la barra inferior se esconde y la de formato se apoya encima del teclado.'),
          ('movil-mas.html', 'Más', 'Todo lo que no cabe en cuatro botones, en una hoja: secciones, cambio de espacio, tema y salir.')]
phones = ''.join(f'<figure class="phone"><div class="phone-frame"><iframe src="{s}" title="{t}, a 390 px de ancho" loading="lazy" tabindex="-1"></iframe></div>'
                 f'<figcaption><b>{t}</b><span class="hint" style="display:block;margin-top:4px">{d}</span><a class="link" href="{s}" style="font-size:var(--t-13)">Abrir sola</a></figcaption></figure>' for s, t, d in PHONES)
MOV_CSS = """<style>
.phone-frame iframe { height: 825px; }
.phone figcaption { width: 300px; font-size: var(--t-14); line-height: 1.5; }
</style>"""
movil = sheet('Móvil', 'Teléfono a 390 px', 'Forge en el teléfono',
    'Las mismas pantallas, sin versión aparte: debajo de 820 px la barra lateral se convierte en una barra inferior de cuatro destinos. Cada teléfono es la página real cargada a 390 px de ancho; se puede desplazar dentro.',
    f'<div class="phones" style="margin-top:32px">{phones}</div>'
    + section('reglas-movil', 'Reglas', '', '<ul class="why" style="max-width:78ch">'
      '<li>Cuatro destinos fijos abajo: Panel, Tablero, Notas y Más. Son los que se abren a diario; el resto está a dos toques.</li>'
      '<li>Toda zona que se toca mide al menos 44 × 44 px, aunque el dibujo sea más pequeño.</li>'
      '<li>Las capas suben desde abajo, con asa: el ticket, el menú Más, los selectores. Se cierran bajándolas o con el botón de cerrar, que sigue ahí.</li>'
      '<li>Los avisos aparecen encima de la barra inferior, nunca tapándola.</li>'
      '<li>El arrastre del tablero también funciona con el dedo, pero no es la única forma: el estado se cambia desde el ticket.</li>'
      '<li>La barra respeta la zona segura de la pantalla (<span class="mono">env(safe-area-inset-bottom)</span>).</li></ul>'),
    css=MOV_CSS)
write('movil.html', movil)
print('movil ok')
