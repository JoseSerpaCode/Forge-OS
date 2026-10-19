# Se ejecuta desde generar.py, con sus nombres a mano (icon, chip, card…).
# Hoja de componentes, estados de sistema y piezas de marca.

def sheet(title, kicker, h1, lead, body, css=''):
    """Página de documentación, fuera de la aplicación (como logo.html)."""
    return HEAD.format(title=f'{title} · Forge OS', favicon=FAVICON).replace('</head>', css + '</head>') + f"""<body>
<div class="sheet-page">
  <header class="site-head" style="margin-bottom:40px"><a href="index.html" class="link">← Índice de la propuesta</a><nav><span class="hint">{kicker}</span>{THEME_BTN}</nav></header>
<main>
  <h1 class="page-title" style="font-size:clamp(2.4rem,5vw,3.6rem)">{h1}</h1>
  <p class="page-sub" style="max-width:72ch;font-size:var(--t-16);line-height:1.6">{lead}</p>
{body}
</main>
</div>
</body>
</html>
"""


def section(id_, h2, lead, body):
    p = f'<p class="muted" style="margin-bottom:18px;max-width:72ch;line-height:1.6">{lead}</p>' if lead else ''
    return f'<section class="site-section" id="{id_}"><h2>{h2}</h2>{p}{body}</section>'


def spec(cols, rows, first='Variante'):
    head = ''.join(f'<th scope="col">{c}</th>' for c in cols)
    body = ''.join(f'<tr><th scope="row">{n}</th>' + ''.join(f'<td>{c}</td>' for c in cells) + '</tr>' for n, cells in rows)
    return f'<div class="spec-wrap" tabindex="0" role="region" aria-label="Estados por {first.lower()} (se desplaza)"><table class="spec"><thead><tr><th scope="col">{first}</th>{head}</tr></thead><tbody>{body}</tbody></table></div>'


# ── Contraste (WCAG 2.x) para la regla de colores del equipo ────────────────
def _rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _mix(c, base, pct):
    """color-mix(in srgb, c pct%, base): interpolación en sRGB codificado."""
    a, b = _rgb(c), _rgb(base)
    return '#' + ''.join(f'{round(x * pct / 100 + y * (100 - pct) / 100):02X}' for x, y in zip(a, b))


def _lum(h):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(v) for v in _rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def fmt(r):
    return f'{r:.1f}'.replace('.', ',')


LIGHT = dict(surface='#F8F7F4', text='#171614', tint=12)
DARK = dict(surface='#232220', text='#ECE9E3', tint=17)
PAPER_T, INK_T = '#F8F7F4', '#171614'


def on_fill(c):
    """Texto sobre un relleno sólido del color elegido: tinta o papel, el que más contraste dé."""
    ri, rp = ratio(c, INK_T), ratio(c, PAPER_T)
    return ('tinta', INK_T, ri) if ri >= rp else ('papel', PAPER_T, rp)


# ═════════════════════════════════════════════════════════════════════════════
# Componentes
# ═════════════════════════════════════════════════════════════════════════════
def btn(cls, label, state='', ic=None):
    i = icon(ic) if ic else ''
    if state == 'disabled':
        return f'<button class="btn {cls}" type="button" disabled>{i}{label}</button>'
    if state == 'loading':
        return f'<button class="btn {cls}" type="button" aria-disabled="true" aria-busy="true"><span class="spin" aria-hidden="true"></span>Guardando…</button>'
    s = f' is-{state}' if state else ''
    return f'<button class="btn {cls}{s}" type="button" tabindex="-1">{i}{label}</button>'


B_STATES = ['', 'hover', 'focus', 'active', 'disabled', 'loading']
buttons = spec(['Reposo', 'Encima', 'Foco (teclado)', 'Pulsado', 'Deshabilitado', 'Cargando'], [
    ('Primario', [btn('btn-primary', 'Crear ticket', s) for s in B_STATES]),
    ('Secundario', [btn('btn-secondary', 'Cancelar', s) for s in B_STATES]),
    ('Fantasma', [btn('btn-ghost', 'Duplicar', s) for s in B_STATES]),
    ('Peligro', [btn('btn-danger', 'Borrar', s) for s in B_STATES]),
    ('Solo icono', [btn('btn-ghost btn-icon', '<span class="sr-only">Más acciones</span>', s, 'more') if s != 'loading' else '<span class="muted">—</span>' for s in B_STATES]),
])


def fld(kind, value, state='', ph=False):
    cls = {'input': 'input', 'select': 'select', 'textarea': 'textarea'}[kind]
    s = f' is-{state}' if state else ''
    v = f'<span class="placeholder">{value}</span>' if ph else value
    return f'<span class="{cls}{s}" style="width:180px">{v}</span>'


F_STATES = ['', 'hover', 'focus', 'error', 'disabled']
fields = spec(['Reposo', 'Encima', 'Foco', 'Con error', 'Deshabilitado'], [
    ('Texto', [fld('input', 'Ej.: Generar facturas', s, ph=(s == '')) if s != 'error' else fld('input', 'avery@', 'error') for s in F_STATES]),
    ('Selector', [fld('select', 'Historia', s) for s in F_STATES]),
], first='Campo')
field_demo = f"""<div class="row-3" style="margin-top:20px;max-width:900px">
  <div class="field"><span class="field-label">Correo</span><span class="input is-error">avery@</span><span class="field-error">{icon('alert')}Falta el dominio: avery@ejemplo.com</span></div>
  <div class="field"><span class="field-label">Puntos <span class="muted" style="font-weight:500">· opcional</span></span><span class="input"><span class="placeholder">Sin estimar</span></span><span class="hint">Fibonacci: 1, 2, 3, 5, 8, 13.</span></div>
  <div class="field"><span class="field-label">Identificador</span><span class="input is-disabled mono">#atlas</span><span class="hint">No cambia: forma parte de los enlaces.</span></div>
</div>
<ul class="why" style="margin-top:18px;max-width:72ch">
  <li>La etiqueta va siempre encima y visible; el texto de ejemplo no la sustituye nunca.</li>
  <li>El error dice cómo arreglarlo, no solo qué falló, y lleva icono además de color.</li>
  <li>Se valida al salir del campo o al enviar, nunca a cada tecla.</li>
  <li>Opcional se marca en los campos que lo son, no con asterisco en los obligatorios.</li>
</ul>"""


def chk(cls, label, hint=''):
    h = f'<span class="hint" style="display:block">{hint}</span>' if hint else ''
    return f'<span class="check"><span class="box {cls}"></span><span>{label}{h}</span></span>'


selection = spec(['Apagado', 'Encendido', 'Mixto / otro', 'Deshabilitado'], [
    ('Casilla', [chk('', 'Asignaciones'), chk('on', 'Menciones'), chk('mixed', 'Todos (2 de 4)'), chk('off-disabled', '<span class="muted">Correo (no disponible)</span>')]),
    ('Opción', ['<span class="check"><span class="radio"></span>Devolver a la pila</span>', '<span class="check"><span class="radio on"></span>Pasar al sprint 15</span>', '<span class="muted">—</span>', '<span class="check muted"><span class="radio" style="border-color:var(--border)"></span>Archivar</span>']),
    ('Interruptor', ['<span class="check"><span class="toggle"></span>Público</span>', '<span class="check"><span class="toggle on"></span>Activa</span>', '<span class="muted">—</span>', '<span class="check muted"><span class="toggle is-disabled"></span>Solo propiedad</span>']),
    ('Segmentado', [segmented(['Gráfica', 'Tabla'], 0, 'Vista de ejemplo'), segmented(['Todas', 'Menciones'], 1, 'Filtro de ejemplo'), segmented(['Día', 'Semana', 'Sprint'], 2, 'Periodo de ejemplo'), '<span class="muted">—</span>']),
], first='Control')

pieces = f"""<div style="display:flex;flex-direction:column;gap:16px">
  <div class="toolbar-group">{''.join(status_badge(k) for k, _ in STATUS)}</div>
  <div class="toolbar-group">{''.join(chip(l) for l in LABELS)}</div>
  <div class="toolbar-group"><span class="avatar p-avery">av</span><span class="avatar p-blake">bl</span><span class="avatar p-noor">no</span><span class="avatar avatar-lg p-avery">av</span><span class="avatar avatar-xl p-noor">no</span>
    <span class="due">24 oct</span><span class="due late">Vence hoy</span><span class="count-pill">3</span><kbd>C</kbd><kbd>⌘ K</kbd><span class="sync-pill">Guardado</span><span class="tooltip">Copiar enlace · <span class="mono">L</span></span></div>
</div>"""

_c = COLUMNS['todo'][0]
card_states = f"""<div class="row-3" style="gap:16px;align-items:start">
  <div><p class="field-label" style="margin-bottom:8px">Reposo</p>{_c}</div>
  <div><p class="field-label" style="margin-bottom:8px">Encima</p>{_c.replace('class="card ', 'class="card is-hover ')}</div>
  <div><p class="field-label" style="margin-bottom:8px">Foco (teclado)</p>{_c.replace('class="card ', 'class="card is-focus ')}<p class="hint" style="margin-top:8px">Espacio la levanta; flechas la mueven; Espacio la suelta. Esc cancela.</p></div>
  <div><p class="field-label" style="margin-bottom:8px">Arrastrando</p>{_c.replace('class="card ', 'class="card dragging ')}</div>
  <div><p class="field-label" style="margin-bottom:8px">Soltando</p><div class="slot slot-label">Soltar en «En curso»</div></div>
  <div><p class="field-label" style="margin-bottom:8px">Solo lectura</p>{_c.replace('class="card ', 'class="card is-read ')}<p class="hint" style="margin-top:8px">Sin asa ni cursor de arrastre; abre el ticket igual.</p></div>
</div>"""

menu_demo = f"""<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
  <div class="menu" role="menu" aria-label="Acciones del ticket">
    <span class="menu-item" role="menuitem">{icon('link')}Copiar enlace<kbd>L</kbd></span>
    <span class="menu-item on" role="menuitem">{icon('copy')}Duplicar<kbd>D</kbd></span>
    <span class="menu-item" role="menuitem">{icon('clock')}Registrar tiempo<kbd>T</kbd></span>
    <span class="menu-item" role="menuitem">{icon('arrow-right')}Mover a otro sprint</span>
    <span class="menu-sep" role="separator"></span>
    <span class="menu-item danger" role="menuitem">{icon('trash')}Borrar ticket…</span>
  </div>
  <ul class="why" style="max-width:52ch">
    <li>El elemento activo se marca con fondo, no solo con color de texto.</li>
    <li>Los atajos van alineados a la derecha, en mono.</li>
    <li>Lo destructivo va al final, separado, y abre confirmación (los «…» lo avisan).</li>
    <li>La ayuda flotante aparece a los 500 ms y repite el nombre accesible; nunca es la única forma de saber qué hace un botón.</li>
  </ul>
</div>"""

# Regla de color del equipo
TEAM = [('Amarillo', '#FACC15'), ('Lima', '#A3E635'), ('Cian', '#22D3EE'), ('Rosa', '#F472B6'),
        ('Blanco', '#FFFFFF'), ('Negro', '#111111'), ('Azul marino', '#1E3A8A'), ('Facturación', LABELS['Facturación'])]
team_rows = []
for n, c in TEAM:
    tl, td = _mix(c, LIGHT['surface'], LIGHT['tint']), _mix(c, DARK['surface'], DARK['tint'])
    rl, rd = ratio(tl, LIGHT['text']), ratio(td, DARK['text'])
    fname, fcol, fr = on_fill(c)
    ring = ratio(c, LIGHT['surface']) < 1.5 or ratio(c, DARK['surface']) < 1.5
    team_rows.append(
        f'<tr><th scope="row"><span style="display:inline-flex;gap:8px;align-items:center"><i class="dot" style="--c:{c}"></i>{n}</span> <span class="mono muted">{c}</span></th>'
        f'<td><span class="chip" style="--c:{c};background:{tl};color:{LIGHT["text"]}"><span class="sw"></span>{n}</span> <b>{fmt(rl)}</b></td>'
        f'<td><span class="chip" style="--c:{c};background:{td};color:{DARK["text"]}"><span class="sw"></span>{n}</span> <b>{fmt(rd)}</b></td>'
        f'<td><span class="chip" style="background:{c};color:{fcol}">{n}</span> {fname} · <b>{fmt(fr)}</b></td>'
        f'<td>{"sí" if ring else "no"}</td></tr>')
team = f"""<div class="spec-wrap" tabindex="0" role="region" aria-label="Colores del equipo (se desplaza)"><table class="spec"><thead><tr><th scope="col">Color elegido</th><th scope="col">Etiqueta, tema claro</th><th scope="col">Etiqueta, tema oscuro</th><th scope="col">Relleno sólido</th><th scope="col">Anillo en el punto</th></tr></thead>
<tbody>{''.join(team_rows)}</tbody></table></div>
<ol class="rules" style="margin-top:20px;max-width:78ch">
  <li><span>El color del equipo <b>nunca colorea texto</b>. Va en el punto y en un tinte de fondo del {LIGHT['tint']} % (claro) o {DARK['tint']} % (oscuro); el texto es siempre el del tema. Con esos tintes, cualquier color —blanco y negro incluidos— deja el texto por encima de 4,5:1. Las cifras de la tabla están calculadas, no estimadas.</span></li>
  <li><span>Si hace falta un <b>relleno sólido</b> (una etiqueta destacada, una portada), el texto se elige entre tinta y papel, el que más contraste dé. Nunca blanco fijo.</span></li>
  <li><span>Si el color queda a menos de 1,5:1 de la superficie, el punto lleva un <b>anillo</b> gris: si no, un amarillo o un blanco desaparecen.</span></li>
  <li><span>El selector ofrece 12 colores ya probados; el campo libre acepta cualquiera, porque las tres reglas lo hacen seguro.</span></li>
</ol>"""

icon_cells = ''.join(
    f'<div><span class="sizes">{icon(n, 16)}{icon(n, 20)}{icon(n, 24)}</span><span class="mono">{n}</span></div>' for n in ICONS if n != 'theme')
icons = f"""<div class="icon-grid">{icon_cells}</div>
<ul class="why" style="margin-top:18px;max-width:78ch">
  <li>Rejilla de 24, trazo de 1,5, puntas y uniones redondeadas. Se dibujan a 16 en la interfaz y a 22 en la barra inferior del móvil.</li>
  <li>Las piezas con forma de columna —inicio, tablero, gráfica, persona— terminan en <b>arco</b>, como el símbolo y las columnas del tablero.</li>
  <li>Un icono solo nunca es el único nombre de nada: o lleva texto al lado, o nombre accesible y ayuda flotante.</li>
  <li>Un solo juego, dibujado aquí. No se mezcla con otra biblioteca: el producto actual combina tres estilos de icono.</li>
</ul>"""

MOTION = [('Abrir el cajón del ticket', '220 ms', 'salida', 'Entra desde la derecha (en el móvil, desde abajo).', 'Aparece sin desplazarse.'),
          ('Ventana', '180 ms', 'salida', 'Escala de 0,96 a 1 y opacidad.', 'Solo opacidad.'),
          ('Menú y ayuda flotante', '120 ms', 'salida', 'Opacidad. La ayuda espera 500 ms antes.', 'Igual (no se desplaza).'),
          ('Levantar una tarjeta', '160 ms', 'salida', 'Sube 4 px, gira −2° y gana sombra.', 'Sombra, sin giro ni subida.'),
          ('Soltar una tarjeta', '200 ms', 'salida', 'Va a su hueco; el hueco se cierra detrás.', 'Salta a su sitio.'),
          ('Aviso', '200 ms', 'salida', 'Sube 12 px desde el borde. Dura 5 s; los errores se quedan.', 'Aparece sin desplazarse.'),
          ('Interruptor, casilla', '140 ms', 'salida', 'El círculo se desliza.', 'Cambia sin deslizar.'),
          ('Esperar al servidor', '—', '—', 'Esqueleto estático; ruedita solo en el botón que se pulsó.', 'La ruedita se para; queda el texto «Guardando…».')]
motion_rows = ''.join(f'<tr><th scope="row">{a}</th><td class="mono">{b}</td><td>{c}</td><td>{d}</td><td>{e}</td></tr>' for a, b, c, d, e in MOTION)
motion = f"""<div class="spec-wrap" tabindex="0" role="region" aria-label="Movimiento (se desplaza)"><table class="spec"><thead><tr><th scope="col">Qué</th><th scope="col">Duración</th><th scope="col">Curva</th><th scope="col">Movimiento</th><th scope="col">Con «reducir movimiento»</th></tr></thead><tbody>{motion_rows}</tbody></table></div>
<p class="hint" style="margin:10px 0 24px">«Salida» es <span class="mono">cubic-bezier(.2, .8, .2, 1)</span>: arranca rápido y frena, porque responde a algo que acabas de hacer. Nada se mueve solo, nada se repite: sin brillos en los esqueletos, sin latidos, sin confeti.</p>
<p class="field-label" style="margin-bottom:10px">Pruébalo: pasa el ratón por encima o llega con el tabulador</p>
<div class="mo-demo">
  <div class="mo mo-drawer" tabindex="0" role="group" aria-label="Demostración: abrir el cajón">{icon('board')}<span class="who">Cajón del ticket</span><div class="d"><div class="skel" style="height:10px;width:70%"></div><div class="skel" style="height:8px;width:90%"></div><div class="skel" style="height:8px;width:60%"></div></div></div>
  <div class="mo mo-card" tabindex="0" role="group" aria-label="Demostración: levantar una tarjeta"><span class="who">Levantar una tarjeta</span>{card('Generar facturas en PDF', 'Historia', ['Facturación'], 'blake', 5)}</div>
  <div class="mo mo-toast" tabindex="0" role="group" aria-label="Demostración: aviso"><span class="who">Aviso</span><div class="t toast">{icon('check')}Movido a Hecho<span class="act">Deshacer</span></div></div>
  <div class="mo mo-modal" tabindex="0" role="group" aria-label="Demostración: ventana"><span class="who">Ventana</span><div class="m"><div class="skel" style="height:12px;width:60%"></div><div class="skel" style="height:28px"></div><div class="skel" style="height:28px"></div></div></div>
</div>
<pre class="code-block" tabindex="0">@media (prefers-reduced-motion: reduce) {{
  *, *::before, *::after {{ transition-duration: .01ms !important; animation-duration: .01ms !important; }}
}}</pre>"""

COMP_CSS = """<style>
.dot { width: 14px; height: 14px; border-radius: 50%; background: var(--c); display: inline-block; box-shadow: inset 0 0 0 1px rgb(128 128 128 / .5); }
.code-block { font-family: var(--mono); font-size: var(--t-13); background: var(--surface-2); border-radius: 14px; padding: 14px 16px; margin-top: 18px; overflow-x: auto; }
.mo-demo { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap: 14px; }
.mo { position: relative; height: 190px; border: 1px solid var(--border); border-radius: 18px; background: var(--surface-1); overflow: hidden; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.mo .who { font-size: var(--t-13); font-weight: 700; }
.mo .icon { color: var(--muted); }
.mo-drawer .d { position: absolute; top: 10px; bottom: 10px; right: 10px; width: 58%; background: var(--surface-2); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; translate: 112% 0; transition: translate .22s var(--ease); }
.mo-drawer:is(:hover, :focus-visible) .d { translate: 0 0; }
.mo-card .card { transition: translate .16s var(--ease), rotate .16s var(--ease), box-shadow .16s var(--ease); }
.mo-card:is(:hover, :focus-visible) .card { translate: 0 -4px; rotate: -2deg; box-shadow: var(--shadow-float); }
.mo-toast .t { position: absolute; left: 12px; right: 12px; bottom: 12px; min-width: 0; translate: 0 calc(100% + 16px); transition: translate .2s var(--ease); }
.mo-toast:is(:hover, :focus-visible) .t { translate: 0 0; }
.mo-modal .m { margin: auto; width: 78%; background: var(--surface-1); border: 1px solid var(--border-strong); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-float); opacity: 0; scale: .96; transition: opacity .18s var(--ease), scale .18s var(--ease); }
.mo-modal:is(:hover, :focus-visible) .m { opacity: 1; scale: 1; }
@media (prefers-reduced-motion: reduce) {
  .mo-drawer .d, .mo-toast .t { translate: 0 0; opacity: 0; transition: opacity .01ms; }
  .mo-drawer:is(:hover, :focus-visible) .d, .mo-toast:is(:hover, :focus-visible) .t { opacity: 1; }
  .mo-card:is(:hover, :focus-visible) .card { translate: none; rotate: none; }
}
</style>"""

componentes = sheet('Componentes', 'Hoja de componentes y estados', 'Componentes y sus estados',
    'Cada pieza en reposo, encima, con foco de teclado, pulsada, deshabilitada, con error y cargando. Más el juego de iconos, el movimiento y la regla para los colores que elige cada equipo.',
    section('botones', 'Botones', 'Un primario por vista. El foco de teclado es un anillo de 2 px en el color del texto, separado 2 px: se ve en los dos temas y sobre el naranja. Deshabilitado no baja la opacidad del texto (regla de accesibilidad del proyecto): cambia el fondo.', buttons)
    + section('campos', 'Campos', 'Un solo alto (36 px), un solo radio, un solo tipo de borde. El error engrosa el borde además de cambiar de color.', fields + field_demo)
    + section('seleccion', 'Selección', 'Interruptor para lo que se aplica al momento; casilla para lo que se guarda con un botón.', selection)
    + section('piezas', 'Piezas pequeñas', '', pieces)
    + section('tarjeta', 'Tarjeta del tablero', 'La tarjeta se puede mover sin ratón. Arrastrar es solo una de las formas.', card_states)
    + section('menus', 'Menús y ayuda flotante', '', menu_demo)
    + section('color-equipo', 'Colores que elige el equipo', 'Las etiquetas y los tipos de ticket los colorea cada equipo. La regla tiene que funcionar con cualquier color, no solo con los de la paleta, porque el campo libre existe.', team)
    + section('iconos', 'Iconos', f'{len(ICONS) - 1} iconos a 16, 20 y 24 px.', icons)
    + section('movimiento', 'Movimiento', 'El movimiento responde a una acción: arrastrar, abrir, guardar. Todo se puede apagar con la preferencia del sistema.', motion),
    css=COMP_CSS)
write('componentes.html', componentes)


# ═════════════════════════════════════════════════════════════════════════════
# Estados del sistema
# ═════════════════════════════════════════════════════════════════════════════
def skel_col(n):
    cards = ''.join(f'<div class="skel-card"><div class="skel" style="height:10px;width:{w}%"></div><div class="skel" style="height:8px;width:40%"></div></div>' for w in (86, 64, 76)[:n])
    return f'<div class="skel-col"><div class="skel" style="height:12px;width:46%;margin:6px 0 14px"></div>{cards}</div>'


skel_board = f'<div class="skel-board" role="status" aria-busy="true" aria-label="Cargando el tablero">{skel_col(3)}{skel_col(2)}{skel_col(1)}{skel_col(2)}</div>'
skel_table = '<div class="panel" role="status" aria-busy="true" aria-label="Cargando la tabla" style="padding:6px 16px">' + ''.join(
    f'<div style="display:grid;grid-template-columns:2fr 1fr 1fr 60px;gap:16px;padding:12px 0;border-bottom:1px solid var(--border)"><div class="skel" style="height:10px;width:{w}%"></div><div class="skel" style="height:10px;width:60%"></div><div class="skel" style="height:18px;width:70%;border-radius:999px"></div><div class="skel" style="height:10px"></div></div>'
    for w in (80, 62, 90, 55)) + '</div>'
skel_note = '<div class="panel" role="status" aria-busy="true" aria-label="Cargando la nota" style="padding:24px">' + '<div class="skel" style="height:26px;width:55%;margin-bottom:18px"></div>' + ''.join(
    f'<div class="skel" style="height:10px;width:{w}%;margin-bottom:10px"></div>' for w in (96, 92, 88, 40)) + '<div class="skel" style="height:16px;width:35%;margin:18px 0 12px"></div>' + ''.join(
    f'<div class="skel" style="height:10px;width:{w}%;margin-bottom:10px"></div>' for w in (94, 70)) + '</div>'

form_errors = f"""<div class="row-2" style="gap:32px;align-items:start">
  <form class="panel" style="padding:24px;display:flex;flex-direction:column;gap:16px" aria-labelledby="fe-t" onsubmit="return false">
    <h3 id="fe-t" class="section-title" style="margin:0">Crear cuenta</h3>
    <div class="error-summary" role="alert"><strong>Hay 2 cosas que corregir</strong><ul style="list-style:none;display:flex;flex-direction:column;gap:2px"><li><a href="#fe-correo">El correo no tiene dominio</a></li><li><a href="#fe-suma">La suma no es correcta</a></li></ul></div>
    <div class="field"><span class="field-label">Usuario</span><span class="input">avery</span><span class="hint" style="color:var(--st-done);font-weight:600">{icon('check')} Disponible</span></div>
    <div class="field" id="fe-correo"><span class="field-label">Correo</span><span class="input is-error">avery@</span><span class="field-error">{icon('alert')}Falta el dominio: avery@ejemplo.com</span></div>
    <div class="field"><span class="field-label">Contraseña</span><span class="input">••••••••••</span><span class="hint">8 caracteres o más.</span></div>
    <div class="field" id="fe-suma"><span class="field-label">¿Cuánto es 9 + 6?</span><span class="input is-error" style="width:120px">14</span><span class="field-error">{icon('alert')}No es 14. Prueba con la suma nueva.</span></div>
    <button class="btn btn-primary" type="button" style="justify-content:center">Crear cuenta</button>
  </form>
  <ul class="why">
    <li>Al enviar con errores, el foco va al <b>resumen</b>; cada línea enlaza a su campo.</li>
    <li>El servidor devuelve <span class="mono">{{ error_field, error_code }}</span>; la frase la pone el cliente con las claves <span class="mono">err.*</span>. Así el resumen y el campo dicen lo mismo.</li>
    <li>Con la suma fallida llega <b>una suma nueva</b>, y el mensaje lo dice: «prueba con la suma nueva».</li>
    <li>Lo que está bien también se dice («Disponible»), pero solo donde había duda.</li>
    <li>Nunca se borra lo escrito al fallar, salvo la contraseña si el servidor lo exige.</li>
  </ul>
</div>"""

mini_cards = card('Búsqueda de texto completo en páginas', 'Historia', ['Búsqueda'], 'avery', 5).replace('class="card ', 'class="card is-read ') + card('Generar facturas en PDF', 'Historia', ['Facturación'], 'blake', 5, due='Vence hoy', late=True).replace('class="card ', 'class="card is-read ')
permission = f"""<div style="display:flex;flex-direction:column;gap:28px">
  <div><p class="field-label" style="margin-bottom:10px">Acceso de lectura</p>
    <div class="frame">
      <div class="banner banner-read">{icon('eye')}<span>Tienes <b>acceso de lectura</b> en Atlas Platform. Puedes abrir y comentar; para mover o editar, pide a <b>avery</b> que te cambie el rol.</span><span class="push"><button class="btn btn-secondary btn-sm" type="button">Pedir permiso</button></span></div>
      <div class="toolbar" style="margin:14px 0"><div class="toolbar-group"><span class="select select-inline">Sprint 14 (activo)</span></div><div class="toolbar-group"><button class="btn btn-primary" type="button" disabled>{icon('plus')}Nuevo ticket</button></div></div>
      <div class="row-2" style="gap:12px">{mini_cards}</div>
    </div>
    <p class="hint" style="margin-top:8px">Los botones que no puedes usar se ven deshabilitados, no desaparecen: así sabes que existen y a quién pedirlos.</p></div>
  <div><p class="field-label" style="margin-bottom:10px">Prueba sin cuenta</p>
    <div class="banner banner-guest">{icon('clock')}<span>Estás probando Forge sin cuenta. Este espacio dura <b>27 días más</b>; al registrarte, te lo llevas.</span><span class="push"><a class="btn btn-sm" href="registro.html">Crear cuenta</a></span></div></div>
  <div><p class="field-label" style="margin-bottom:10px">Invitado en un espacio</p>
    <div class="banner banner-read">{icon('user')}<span>Entras como <b>invitado</b>: ves y comentas lo que se comparte contigo. No apareces en la búsqueda de personas ni recibes solicitudes.</span></div></div>
  <div><p class="field-label" style="margin-bottom:10px">Un espacio que no es tuyo</p>
    <div class="frame" style="padding:clamp(20px,4vw,48px)">
      <p class="mono muted" style="margin-bottom:12px">403</p>
      <h3 class="denied">Este espacio es privado.</h3>
      <p class="muted" style="max-width:52ch;line-height:1.6;margin:12px 0 20px">«Semillero de robótica» solo lo ven sus miembros. Puedes pedir entrar: le llega a quien lo administra, con tu nombre y tu perfil.</p>
      <div class="toolbar-group"><button class="btn btn-primary" type="button">Pedir acceso</button><a class="btn btn-secondary" href="inicio.html">Volver al inicio</a></div>
    </div>
    <p class="hint" style="margin-top:8px">Solo se muestra a quien llega con un enlace de invitación o de solicitud. A cualquier otra persona se le responde 404, para no confirmar que el espacio existe.</p></div>
</div>"""

offline = f"""<div style="display:flex;flex-direction:column;gap:20px">
  <div class="banner banner-offline">{icon('wifi-off')}<span><b>Sin conexión.</b> No cierres esta pestaña: lo que escribas se envía al volver la red.</span><span class="push" style="font-size:var(--t-13)">Reintentando en 8 s</span></div>
  <div class="frame"><div class="doc-meta" style="margin:0 0 12px"><span class="avatar p-avery">av</span><span><b style="color:var(--text)">avery</b> · editando</span><span style="margin-left:auto" class="sync-pill off">Sin enviar · 3 cambios</span></div>
    <p style="font-size:var(--t-16);line-height:1.7;max-width:68ch">La copia nocturna pasa por <code>.backup</code> y comprueba el resultado con <code>integrity_check</code>. Si falla, el aviso llega al canal de operaciones antes de las 7:00.</p></div>
  <div class="toolbar-group" style="gap:20px"><span class="sync-pill ok">Guardado</span><span class="sync-pill busy">Guardando…</span><span class="sync-pill off">Sin enviar · 3 cambios</span><span class="sync-pill err">No se pudo guardar</span></div>
  <div class="toolbar-group" style="gap:12px"><div class="toast">{icon('check')}Conexión recuperada. 3 cambios enviados.</div></div>
  <ul class="why" style="max-width:72ch"><li>El tablero se queda en modo lectura sin conexión: mover una tarjeta que no se puede guardar engaña.</li><li>Las notas siguen editables y guardan un borrador local; si la app no lo hiciera, el aviso tendría que decir «no se guardará».</li><li>El indicador de guardado vive siempre en el mismo sitio, a la derecha de la cabecera de la nota.</li></ul>
</div>"""

server_error = f"""<div class="banner banner-error">{icon('alert')}<span><b>No se pudo cargar el tablero.</b> El servidor no respondió. Tus datos no se han tocado.</span><span class="push"><span class="mono muted" style="font-size:var(--t-12);align-self:center">503 · 7f3a2c</span><button class="btn btn-secondary btn-sm" type="button">{icon('refresh')}Reintentar</button></span></div>
<p class="hint" style="margin-top:8px">El código y el identificador de la petición van en mono, para copiarlos en una incidencia. Nunca se muestra la traza del servidor.</p>"""

EMPTIES = [('Tablero', 'Este sprint aún no tiene tickets.', 'Crea el primero o trae los que quedaron en la pila.', [('btn-primary', f'{icon("plus")}Nuevo ticket <kbd>C</kbd>'), ('btn-secondary', 'Traer de la pila')]),
           ('Notas', 'Ninguna nota todavía.', 'Las notas sirven para lo que no cabe en un ticket: actas, decisiones, guías. Se enlazan a los tickets con #.', [('btn-primary', f'{icon("plus")}Nueva nota')]),
           ('Tablas', 'Sin tablas.', 'Una tabla es una hoja con columnas propias: contactos, inventario, lecturas de un sensor.', [('btn-secondary', f'{icon("plus")}Nueva tabla')]),
           ('Archivos', 'Conecta un Drive para guardar archivos.', 'Los archivos no se guardan en este servidor: viven en el Drive de quien conecta el espacio, en una carpeta propia.', [('btn-primary', 'Conectar Google Drive')]),
           ('Búsqueda', 'Nada con «facturas 2025».', 'Busca en títulos de tickets, notas y tablas de Atlas Platform. Prueba con menos palabras o en todos tus espacios.', [('btn-secondary', 'Buscar en todos los espacios')]),
           ('Notificaciones', 'Al día.', 'Aquí llegan las asignaciones, las menciones y las invitaciones.', []),
           ('Métricas', 'Las gráficas empiezan mañana.', 'El burndown guarda una foto al cerrar cada día del sprint. Hoy es el primero.', []),
           ('Filtro sin resultados', 'Ningún ticket con «API» en «En revisión».', '', [('btn-ghost', 'Quitar el filtro')])]
empties = '<div class="empties">' + ''.join(
    f'<div class="empty"><span class="mono muted" style="font-size:var(--t-12)">{w}</span><strong>{t}</strong>{f"<p>{p}</p>" if p else ""}'
    + (f'<div class="toolbar-group">{"".join(f"<button class=\"btn {c}\" type=\"button\">{l}</button>" for c, l in acts)}</div>' if acts else '') + '</div>'
    for w, t, p, acts in EMPTIES) + '</div>'

STATE_CSS = """<style>
.skel-board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.skel-col { background: var(--surface-2); border-radius: 46px 46px 16px 16px; padding: 22px 10px 10px; display: flex; flex-direction: column; gap: 8px; min-height: 260px; }
.skel-card { background: var(--surface-1); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.frame { border: 1px solid var(--border); border-radius: 22px; padding: 16px; background: var(--bg); }
.denied { font-size: clamp(2rem, 4.4vw, 3.4rem); font-weight: 800; font-stretch: 64%; line-height: .95; }
@media (max-width: 820px) { .skel-board { grid-template-columns: minmax(0, 1fr); } .skel-col:not(:first-child) { display: none; } }
</style>"""

estados = sheet('Estados', 'Carga, errores, permisos, sin conexión, vacío', 'Lo que pasa cuando algo no está',
    'Cargando, con errores, sin permiso, sin red o sin nada que enseñar. Son las pantallas que más se ven y las que menos se diseñan. Los estados vacíos son tipográficos: sin ilustraciones.',
    section('carga', 'Cargando', 'Esqueleto con la forma de lo que va a llegar, estático. Aparece solo si la espera pasa de 300 ms; por debajo, parpadear es peor que esperar.', f'<div style="display:flex;flex-direction:column;gap:16px">{skel_board}<div class="row-2" style="gap:16px">{skel_table}{skel_note}</div></div>')
    + section('errores', 'Errores en formularios', '', form_errors)
    + section('permisos', 'Sin permiso', '', permission)
    + section('conexion', 'Sin conexión y guardado', '', offline)
    + section('servidor', 'Error del servidor', '', server_error)
    + section('vacios', 'Vacío', 'Una frase que dice qué hay aquí cuando hay algo, una explicación y como mucho dos acciones. Sin dibujos: la frase tiene que bastar.', empties),
    css=STATE_CSS)
write('estados.html', estados)


# ═════════════════════════════════════════════════════════════════════════════
# Marca: imagen para redes y favicons
# ═════════════════════════════════════════════════════════════════════════════
os.makedirs(os.path.join(OUT, 'marca'), exist_ok=True)


def tile_svg(size, bleed=False, maskable=False):
    """Icono de aplicación. `bleed`: sin esquinas (iOS las redondea solo).
    `maskable`: el símbolo dentro de la zona segura del 80 % (Android recorta)."""
    rx = 0 if (bleed or maskable) else 14
    k = 0.52 if maskable else 0.7
    off = (64 - 64 * k) / 2
    return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='{size}' height='{size}'>"
            f"<rect width='64' height='64' rx='{rx}' fill='{INK}'/>"
            f"<g transform='translate({off:.2f} {off:.2f}) scale({k})'>"
            f"<path fill='{PAPER}' fill-rule='evenodd' d='{FRAGUA_BODY}'/>"
            f"<path fill='{ORANGE}' d='{FRAGUA_EMBER}'/></g></svg>")


with open(os.path.join(OUT, 'marca', 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(tile_svg(64))
with open(os.path.join(OUT, 'marca', 'icono-maskable.svg'), 'w', encoding='utf-8') as f:
    f.write(tile_svg(512, maskable=True))
with open(os.path.join(OUT, 'marca', 'icono-apple.svg'), 'w', encoding='utf-8') as f:
    f.write(tile_svg(180, bleed=True))

OG = HEAD.format(title='Imagen para redes · Forge OS', favicon=FAVICON).replace('<link rel="stylesheet" href="taller.css">', '<link rel="stylesheet" href="taller.css">') + f"""<body style="margin:0;background:{INK}">
<div class="og">
  <div class="og-text">
    <span class="og-brand">{mark(54).replace('currentColor', PAPER).replace('var(--brand-orange)', ORANGE)}<span>Forge OS</span></span>
    <p class="og-claim">Tablero, notas y horas de tu equipo, <span>en un archivo tuyo.</span></p>
    <p class="og-meta">MIT · SQLite · sin scripts de terceros</p>
  </div>
  <svg class="og-arch" viewBox="0 0 64 64" aria-hidden="true"><path fill="#2C2A27" fill-rule="evenodd" d="{FRAGUA_BODY}"/><path fill="{ORANGE}" d="{FRAGUA_EMBER}"/></svg>
</div>
<style>
.og {{ width: 1200px; height: 630px; position: relative; overflow: hidden; background: {INK}; color: {PAPER}; font-family: var(--font); }}
.og-text {{ position: absolute; left: 80px; top: 72px; bottom: 72px; width: 700px; display: flex; flex-direction: column; justify-content: space-between; }}
.og-brand {{ display: flex; align-items: center; gap: 18px; font-size: 44px; font-weight: 750; letter-spacing: -0.02em; }}
.og-claim {{ font-size: 92px; line-height: .9; font-weight: 800; font-stretch: 64%; letter-spacing: -0.02em; }}
.og-claim span {{ display: block; margin-top: 14px; font-size: 40px; line-height: 1.1; font-stretch: 125%; font-weight: 700; color: {ORANGE}; letter-spacing: -0.01em; }}
.og-meta {{ font-family: var(--mono); font-size: 22px; color: #ABA59B; }}
.og-arch {{ position: absolute; right: -70px; bottom: -40px; width: 560px; height: 560px; }}
</style>
</body>
</html>
"""
write('marca/og.html', OG.replace('href="taller.css"', 'href="taller.css"'))


def _data(path, mime):
    import base64
    p = os.path.join(OUT, path)
    if not os.path.exists(p):
        return None
    return f'data:{mime};base64,' + base64.b64encode(open(p, 'rb').read()).decode()


og_png = _data('marca/og.png', 'image/png')
og_view = (f'<img src="{og_png}" alt="Imagen para redes: el símbolo de la fragua a la derecha y el texto «Tablero, notas y horas de tu equipo, en un archivo tuyo»." style="width:100%;max-width:900px;border-radius:16px;display:block">'
           if og_png else '<p class="hint">Falta exportar <span class="mono">marca/og.png</span>.</p>')
ICON_SIZES = [('favicon-16.png', 16, 'Pestaña del navegador'), ('favicon-32.png', 32, 'Pestaña en pantallas densas'),
              ('apple-touch-icon.png', 180, 'iPhone y iPad: sin esquinas, las pone iOS'),
              ('icono-192.png', 192, 'Android y manifiesto'), ('icono-512.png', 512, 'Manifiesto, pantalla de carga'),
              ('icono-maskable-512.png', 512, 'Android adaptable: el símbolo en la zona segura')]
ic_cells = []
for fn, px, use in ICON_SIZES:
    d = _data('marca/' + fn, 'image/png')
    show = min(px, 128)
    img = f'<img src="{d}" alt="" width="{show}" height="{show}" style="image-rendering:{"pixelated" if px < 64 else "auto"};display:block{";border-radius:50%" if "maskable" in fn else ""}">' if d else '<span class="hint">sin exportar</span>'
    ic_cells.append(f'<div class="ic-cell"><div class="ic-box">{img}</div><b class="mono">{fn}</b><span class="hint">{px} × {px} · {use}</span></div>')

head_snippet = """&lt;link rel="icon" href="/favicon.svg" type="image/svg+xml"&gt;
&lt;link rel="icon" href="/favicon-32.png" sizes="32x32"&gt;
&lt;link rel="apple-touch-icon" href="/apple-touch-icon.png"&gt;
&lt;link rel="manifest" href="/manifest.webmanifest"&gt;
&lt;meta name="theme-color" content="#171614"&gt;
&lt;meta property="og:image" content="https://forge.example/og.png"&gt;
&lt;meta property="og:image:width" content="1200"&gt;
&lt;meta property="og:image:height" content="630"&gt;
&lt;meta property="og:image:alt" content="Forge OS: tablero, notas y horas de tu equipo, en un archivo tuyo."&gt;"""
manifest = """{
  "name": "Forge OS",
  "short_name": "Forge",
  "background_color": "#EEECE7",
  "theme_color": "#171614",
  "display": "standalone",
  "icons": [
    { "src": "/icono-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icono-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icono-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}"""
MARCA_CSS = """<style>
.ic-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.ic-cell { display: flex; flex-direction: column; gap: 6px; padding: 16px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface-1); }
.ic-box { height: 136px; display: grid; place-items: center; background: var(--surface-2); border-radius: 12px; }
.code-block { font-family: var(--mono); font-size: var(--t-13); background: var(--surface-2); border-radius: 14px; padding: 14px 16px; overflow-x: auto; white-space: pre; }
</style>"""
marca = sheet('Marca en uso', 'Imagen para redes, favicons, manifiesto', 'La marca fuera de la aplicación',
    'Lo que se ve cuando alguien comparte un enlace, guarda Forge en la pantalla de inicio o tiene veinte pestañas abiertas. Todo sale del mismo trazado de «Fragua»; nada usa texto dentro de un SVG, que es lo que hacía cambiar de forma el favicon actual.',
    section('og', 'Imagen para redes (1200 × 630)', 'Fondo en tinta, porque las vistas previas de Slack, WhatsApp y X ponen su propio marco claro. La fragua, enorme y cortada por el borde: se reconoce aunque la recorten a cuadrado. El texto está dentro del 80 % central.', og_view)
    + section('iconos', 'Favicons e iconos de aplicación', 'Exportados del mismo SVG. El de 16 px va con el símbolo al 70 %, como el resto; a ese tamaño el hueco del arco sigue abierto (2 px).', f'<div class="ic-grid">{"".join(ic_cells)}</div>')
    + section('codigo', 'En el &lt;head&gt; y en el manifiesto', 'Sustituirían a <span class="mono">public/forge-icon.svg</span> y al trazado de <span class="mono">Logo.astro</span>, que tienen que seguir siendo el mismo dibujo.', f'<div class="row-2" style="gap:16px;align-items:start"><pre class="code-block" tabindex="0">{head_snippet}</pre><pre class="code-block" tabindex="0">{manifest}</pre></div>'),
    css=MARCA_CSS)
write('marca.html', marca)
print('sistema ok')
