#!/usr/bin/env python3
"""Genera las maquetas estáticas de la propuesta «Taller».

Uso: python3 docs/rediseno/generar.py docs/rediseno

Escribe cada página con taller.css y las fuentes de fonts/ incrustadas, para
que se vean abiertas solas. Edita taller.css o este script, nunca los HTML.
"""
import os, sys

OUT = sys.argv[1]

# ── Marca: «Fragua» ─────────────────────────────────────────────────────────
from urllib.parse import quote

INK, PAPER, ORANGE = '#171614', '#F8F7F4', '#E8590C'
# La boca de la fragua sobre su hogar (una pieza con hueco) y las brasas dentro,
# que repiten la curva del arco. Rejilla de 64 × 64.
FRAGUA_BODY = "M6 59V53H10V27A22 22 0 0 1 54 27V53H58V59ZM21 53V32A11 11 0 0 1 43 32V53Z"
FRAGUA_EMBER = "M21 53V45A11 8 0 0 1 43 45V53Z"


def mark(h=22):
    """El símbolo en el color del texto, con las brasas siempre en naranja de marca."""
    return (f'<svg viewBox="0 0 64 64" width="{h}" height="{h}" aria-hidden="true">'
            f'<path fill="currentColor" fill-rule="evenodd" d="{FRAGUA_BODY}"/>'
            f'<path fill="var(--brand-orange)" d="{FRAGUA_EMBER}"/></svg>')


def brand(h=22, word=True):
    w = '<span class="brand-word">Forge OS</span>' if word else ''
    return f'<span class="brand">{mark(h)}{w}</span>'


_TILE = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
         f"<rect width='64' height='64' rx='14' fill='{INK}'/>"
         "<g transform='translate(9.6 9.6) scale(0.7)'>"
         f"<path fill='{PAPER}' fill-rule='evenodd' d='{FRAGUA_BODY}'/>"
         f"<path fill='{ORANGE}' d='{FRAGUA_EMBER}'/></g></svg>")
FAVICON = 'data:image/svg+xml,' + quote(_TILE, safe=" '=/:,.()")

_uid = [0]


def _id(p):
    _uid[0] += 1
    return f'{p}{_uid[0]}'


def m_fragua(c, a):
    return (f'<path fill="{c}" fill-rule="evenodd" d="M6 59V53H10V27A22 22 0 0 1 54 27V53H58V59Z'
            f'M21 53V32A11 11 0 0 1 43 32V53Z"/>'
            f'<path fill="{a}" d="M21 53V45A11 8 0 0 1 43 45V53Z"/>')


def m_hierro(c, a):
    return (f'<path d="M20 58V24A12 12 0 0 1 32 12H50" fill="none" stroke="{c}" stroke-width="11"/>'
            f'<rect x="28.5" y="29.5" width="15.5" height="11" fill="{a}"/>')


def m_eslabones(c, a):
    ma, mb = _id('ma'), _id('mb')
    ring_a = 'x="5" y="19" width="34" height="26" rx="13"'
    ring_b = 'x="25" y="19" width="34" height="26" rx="13"'
    return (f'<defs>'
            f'<mask id="{mb}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">'
            f'<rect width="64" height="64" fill="#fff"/><rect {ring_a} fill="none" stroke="#000" stroke-width="13"/>'
            f'<rect y="32" width="64" height="32" fill="#fff"/></mask>'
            f'<mask id="{ma}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">'
            f'<rect width="64" height="64" fill="#fff"/><rect {ring_b} fill="none" stroke="#000" stroke-width="13"/>'
            f'<rect width="64" height="32" fill="#fff"/></mask></defs>'
            f'<rect {ring_b} fill="none" stroke="{a}" stroke-width="7" mask="url(#{mb})"/>'
            f'<rect {ring_a} fill="none" stroke="{c}" stroke-width="7" mask="url(#{ma})"/>')


def m_yunque(c, a):
    return (f'<path fill="{c}" d="M5 20H59V29H49V38L57 45V49H21V45L29 38V29H19C13 29 8 25 5 20Z"/>'
            f'<rect x="30" y="12" width="17" height="5.5" fill="{a}"/>')


def svg(fn, size, c='currentColor', a=ORANGE, label=None):
    lab = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return f'<svg viewBox="0 0 64 64" width="{size}" height="{size}" {lab} style="display:block;flex:none">{fn(c, a)}</svg>'


def app_tile(fn, size, bg, c, a):
    r = 14
    return (f'<svg viewBox="0 0 64 64" width="{size}" height="{size}" aria-hidden="true" style="display:block;flex:none">'
            f'<rect width="64" height="64" rx="{r}" fill="{bg}"/>'
            f'<g transform="translate(9.6 9.6) scale(0.7)">{fn(c, a)}</g></svg>')


def lockup(fn, size, c, a, word_color):
    return (f'<span style="display:inline-flex;align-items:center;gap:{size * 0.38:.0f}px;color:{word_color}">'
            f'{svg(fn, size, c, a)}<span style="font-weight:700;font-size:{size * 0.72:.0f}px;letter-spacing:-0.02em;line-height:1">Forge OS</span></span>')


def grid_overlay():
    lines = ''.join(f'<line x1="{i}" y1="0" x2="{i}" y2="64"/><line x1="0" y1="{i}" x2="64" y2="{i}"/>' for i in range(0, 65, 4))
    return f'<g stroke="var(--border)" stroke-width="0.25">{lines}</g>'



# ── Iconos (un solo juego, trazo 1,5) ───────────────────────────────────────
ICONS = {
    'search': '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    'theme': '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'x': '<path d="M18 6 6 18M6 6l12 12"/>',
    'play': '<path d="M8 5v14l11-7z"/>',
    'link': '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
}


def icon(name):
    return f'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'


HEAD = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="icon" href="{favicon}">
<link rel="stylesheet" href="taller.css">
<script>
  /* Única lógica de la maqueta: alternar tema claro / oscuro. */
  (function () {{
    var r = document.documentElement;
    try {{ var t = localStorage.getItem('taller-tema'); if (t) r.dataset.theme = t; }} catch (e) {{}}
    window.cambiarTema = function () {{
      var n = r.dataset.theme === 'dark' ? 'light' : 'dark';
      r.dataset.theme = n;
      try {{ localStorage.setItem('taller-tema', n); }} catch (e) {{}}
    }};
  }})();
</script>
</head>
"""

THEME_BTN = (f'<button class="btn btn-ghost btn-icon" type="button" onclick="cambiarTema()" '
             f'aria-label="Cambiar entre tema claro y oscuro" title="Cambiar tema">{icon("theme")}</button>')

NAV = [
    ('inicio', 'Inicio', 'inicio.html', ''),
    ('actividad', 'Actividad', 'inicio.html#actividad', ''),
    None,
    ('panel', 'Panel', 'panel.html', ''),
    ('tablero', 'Tablero', 'tablero.html', '9'),
    ('notas', 'Notas', 'notas.html', '6'),
    ('tablas', 'Tablas', 'tablas.html', '3'),
    ('archivos', 'Archivos', 'archivos.html', '14'),
    ('metricas', 'Métricas', 'metricas.html', ''),
    ('ajustes-espacio', 'Ajustes del espacio', '#', ''),
]


def shell(active, crumbs, body, title, overlay=''):
    items = []
    for n in NAV:
        if n is None:
            items.append('<p class="nav-label">Atlas Platform</p>')
            continue
        key, label, href, count = n
        cur = ' aria-current="page"' if key == active else ''
        c = f'<span class="count">{count}</span>' if count else ''
        items.append(f'<a href="{href}"{cur}><span>{label}</span>{c}</a>')
    crumb_html = []
    for i, c in enumerate(crumbs):
        if i:
            crumb_html.append('<span class="sep">/</span>')
        if i == len(crumbs) - 1:
            crumb_html.append(f'<span aria-current="page">{c}</span>')
        else:
            crumb_html.append(f'<a href="panel.html">{c}</a>')
    return HEAD.format(title=f'{title} · Forge OS', favicon=FAVICON) + f"""<body>
<div class="app">
  <aside class="sidebar" aria-label="Navegación principal">
    <div class="sidebar-head"><a href="index.html" aria-label="Índice de la propuesta">{brand(24)}</a></div>
    <button class="ws-switch" type="button" aria-label="Cambiar de espacio">
      <span><strong>Atlas Platform</strong><span class="mono">#atlas</span></span>
    </button>
    <nav class="nav">{''.join(items)}</nav>
    <div class="sidebar-foot">
      <span class="avatar avatar-lg">av</span>
      <a href="ajustes.html"><strong>avery</strong><span>Administración · ajustes</span></a>
    </div>
  </aside>
  <header class="topbar">
    <nav class="crumbs" aria-label="Ruta">{''.join(crumb_html)}</nav>
    <div class="search" role="search">{icon('search')}<span>Buscar en Forge</span><kbd>/</kbd></div>
    <div class="top-actions">
      {THEME_BTN}
      <button class="btn btn-ghost btn-icon" type="button" aria-label="Notificaciones: 2 sin leer">{icon('bell')}</button>
    </div>
  </header>
  <main class="main" id="contenido">
{body}
  </main>
</div>
{overlay}
</body>
</html>
"""


def _inline_css():
    # Cada página tiene que verse sola: los visores de archivos abren un HTML
    # sin los archivos de al lado, así que CSS y fuentes van dentro.
    import base64, re
    css = open(os.path.join(OUT, 'taller.css'), encoding='utf-8').read()
    def data_uri(m):
        path = os.path.join(OUT, m.group(1))
        b64 = base64.b64encode(open(path, 'rb').read()).decode()
        return f"url('data:font/woff2;base64,{b64}')"
    return re.sub(r"url\('(fonts/[^']+)'\)", data_uri, css)


CSS_INLINE = None


def write(name, html):
    global CSS_INLINE
    if CSS_INLINE is None:
        CSS_INLINE = _inline_css()
    html = html.replace('<link rel="stylesheet" href="taller.css">', '<style>\n' + CSS_INLINE + '\n</style>')
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(html)


# ── Datos de la demostración ────────────────────────────────────────────────
TYPES = {'Historia': '#2E7D6B', 'Tarea': '#5F6B7A', 'Error': '#B42318', 'Épica': '#6B3FA0'}
LABELS = {'Búsqueda': '#0E7490', 'Facturación': '#9A3412', 'Interfaz': '#4D7C0F',
          'Incorporación': '#6D28D9', 'API': '#334155', 'Q4': '#A16207'}
STATUS = [('todo', 'Por hacer'), ('progress', 'En curso'), ('review', 'En revisión'), ('done', 'Hecho')]
STATUS_NAME = dict(STATUS)


def chip(name):
    return f'<span class="chip"><span class="sw" style="--c:{LABELS[name]}"></span>{name}</span>'


def status_badge(key):
    return f'<span class="status s-{key}"><span class="sw"></span>{STATUS_NAME[key]}</span>'


def card(title, type_, labels=(), who=None, pts=None, due=None, late=False, timer=None, logged=None, cls=''):
    lab = ''.join(chip(l) for l in labels)
    right = []
    if logged:
        right.append(f'<span class="due">{logged} registradas</span>')
    if due:
        right.append(f'<span class="due{" late" if late else ""}">{due}</span>')
    if who:
        right.append(f'<span class="avatar" title="{who}">{who[:2]}</span>')
    meta = f'{type_}' + (f' · {pts} pts' if pts else '')
    t = ''
    if timer:
        t = (f'<div class="timer"><span class="live">En marcha <b>{timer}</b></span>'
             f'<button class="btn btn-secondary btn-sm" type="button">Parar</button></div>')
    return (f'<article class="card {cls}" style="--type:{TYPES[type_]}">'
            f'<h3>{title}</h3>'
            f'<div class="card-foot"><span class="type">{meta}</span>{lab}'
            f'<span class="push">{"".join(right)}</span></div>{t}</article>')


COLUMNS = {
    'todo': [
        card('Búsqueda de texto completo en páginas', 'Historia', ['Búsqueda'], 'avery', 5),
        card('Ventana de ayuda con los atajos de teclado', 'Tarea', ['Interfaz'], 'noor', 2),
        card('Lista de pasos para espacios nuevos', 'Historia', ['Incorporación'], 'blake', 3, due='24 oct'),
        card('Visor del registro de auditoría', 'Historia', [], None, 8),
    ],
    'progress': [
        card('Facturación por uso', 'Épica', ['Facturación'], 'avery', 13, timer='00:42:13'),
        card('Generar facturas en PDF', 'Historia', ['Facturación'], 'blake', 5, due='Vence hoy', late=True),
        card('La búsqueda pierde resultados después de la página 3', 'Error', ['Búsqueda'], 'noor', 3),
    ],
    'review': [
        card('La subida de avatar rechaza PNG válidos', 'Error', ['Interfaz'], 'avery', 2),
    ],
    'done': [
        card('API de medición de consumo', 'Historia', ['API'], 'blake', 5, logged='6,5 h'),
        card('Límite de peticiones por IP en la API pública', 'Tarea', ['API'], 'noor', 3, logged='4 h'),
        card('Modo oscuro en todos los textos', 'Tarea', ['Interfaz'], 'avery', 2, logged='3 h'),
    ],
}
COUNTS = {'todo': 4, 'progress': 3, 'review': 2, 'done': 3}


def board(drag=True):
    cols = []
    for key, name in STATUS:
        cards = list(COLUMNS[key])
        if key == 'review' and not drag:
            cards.insert(0, card('Selector de plan en ajustes', 'Tarea', ['Facturación'], 'blake', 3))
        if key == 'done' and drag:
            cards.insert(0, card('Selector de plan en ajustes', 'Tarea', ['Facturación'], 'blake', 3, cls='dragging')
                         + '<div class="slot slot-label">Soltar en «Hecho»</div>')
        cols.append(f"""<section class="column s-{key}" aria-label="{name}, {COUNTS[key]} tickets">
  <header class="column-head"><h2>{name}</h2><span class="n">{COUNTS[key]}</span></header>
  <div class="tape"></div>
  <div class="column-body">{''.join(cards)}</div>
</section>""")
    tabs = ''.join(
        f'<a href="#"{" aria-current=\"page\"" if k == "todo" else ""}>{n} {COUNTS[k]}</a>' for k, n in STATUS)
    return f'<nav class="tabs" aria-label="Columnas">{tabs}</nav><div class="board">{"".join(cols)}</div>'


def board_page(drag=True):
    return f"""<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">Sprint 14 — Facturación y búsqueda</h1>
      <div class="board-meta">
        <span>26 sep – 23 oct · quedan 4 días</span>
        <span class="bar" aria-hidden="true"><span style="width:26%;--c:var(--text)"></span></span>
        <span>32 h de 121 h registradas</span>
      </div>
    </div>
  </div>
  <div class="toolbar">
    <div class="toolbar-group">
      <span class="select select-inline" aria-label="Sprint">Sprint 14 (activo)</span>
      <span class="select select-inline" aria-label="Orden">Orden manual</span>
      <span class="select select-inline" aria-label="Etiqueta">Todas las etiquetas</span>
    </div>
    <div class="toolbar-group">
      <button class="btn btn-secondary" type="button">Sprint <span class="select" style="border:0;padding:0;height:auto;background:none"></span></button>
      <button class="btn btn-primary" type="button">{icon('plus')}Nuevo ticket <kbd>C</kbd></button>
    </div>
  </div>
  {board(drag)}
</div>"""


# ── Tablero ─────────────────────────────────────────────────────────────────
write('tablero.html', shell('tablero', ['Atlas Platform', 'Tablero'], board_page(True), 'Tablero'))

# ── Ticket ──────────────────────────────────────────────────────────────────
drawer = f"""<div class="scrim" aria-hidden="true"></div>
<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="t-titulo">
  <div class="drawer-head">
    <span class="select select-inline" style="height:28px">Historia</span>
    <span style="flex:1"></span>
    <button class="btn btn-ghost btn-sm" type="button">{icon('link')}Copiar enlace</button>
    <button class="btn btn-ghost btn-sm" type="button">Duplicar</button>
    <button class="btn btn-ghost btn-sm" type="button" style="color:var(--danger)">Borrar</button>
    <a class="btn btn-ghost btn-icon" href="tablero.html" aria-label="Cerrar">{icon('x')}</a>
  </div>
  <div class="drawer-body">
    <h2 class="drawer-title" id="t-titulo">Generar facturas en PDF</h2>
    <dl class="props">
      <dt>Estado</dt><dd><span class="select select-inline">{status_badge('progress')}</span></dd>
      <dt>Responsable</dt><dd><span class="select select-inline"><span style="display:inline-flex;gap:8px;align-items:center"><span class="avatar">bl</span>blake</span></span></dd>
      <dt>Informador</dt><dd><span class="avatar">av</span>avery</dd>
      <dt>Sprint</dt><dd><span class="select select-inline">Sprint 14 — Facturación y búsqueda</span></dd>
      <dt>Puntos</dt><dd><span class="input" style="width:72px">5</span></dd>
      <dt>Vence</dt><dd><span class="input" style="width:160px">19/10/2026</span><span class="due late">Vence hoy</span></dd>
      <dt>Etiquetas</dt><dd>{chip('Facturación')}{chip('Q4')}<button class="btn btn-ghost btn-sm" type="button">{icon('plus')}Añadir</button></dd>
    </dl>
    <section>
      <h3 class="block-title">Descripción</h3>
      <div class="textarea">Renderizar las facturas en el servidor y guardarlas como adjuntos del espacio. El PDF lleva el número de factura, el periodo y el desglose por consumo que calcula la API de medición.</div>
    </section>
    <section>
      <h3 class="block-title">Tiempo <button class="btn btn-secondary btn-sm" type="button">{icon('plus')}Registrar tiempo</button></h3>
      <div style="display:flex;justify-content:space-between;font-size:var(--t-13);margin-bottom:6px"><span><b>6 h</b> de 16 h estimadas</span><span class="muted">38 %</span></div>
      <div class="bar" aria-hidden="true"><span style="width:38%;--c:var(--text)"></span></div>
      <ul class="log" style="margin-top:10px">
        <li><span class="avatar">bl</span>blake<span class="muted">Plantilla y estilos de impresión</span><span class="push">3 h · 18 oct</span></li>
        <li><span class="avatar">bl</span>blake<span class="muted">Cola de generación</span><span class="push">2 h · 17 oct</span></li>
        <li><span class="avatar">av</span>avery<span class="muted">Revisión del desglose</span><span class="push">1 h · 16 oct</span></li>
      </ul>
    </section>
    <section>
      <h3 class="block-title">Notas enlazadas</h3>
      <ul class="log">
        <li><a class="link" href="notas.html">Arquitectura general</a><span class="push">editada hace 5 min</span></li>
        <li><a class="link" href="notas.html">Acta del sprint 14</a><span class="push">editada el 14 oct</span></li>
      </ul>
    </section>
    <p class="hint">Creado por avery el 3 oct · actualizado hace 2 h</p>
  </div>
</aside>"""
write('ticket.html', shell('tablero', ['Atlas Platform', 'Tablero'], board_page(False), 'Ticket', overlay=drawer))

# ── Panel del espacio ───────────────────────────────────────────────────────
seg = ''.join(f'<span style="width:{w}%;--c:var(--st-{k})"></span>' for k, w in
              [('todo', 33), ('progress', 25), ('review', 17), ('done', 25)])
legend_sprint = ''.join(f'<span>{status_badge(k)} <b>{COUNTS[k]}</b></span>' for k, _ in STATUS)
my_rows = ''.join(f'<tr><td class="title">{t}</td><td class="muted">{ty}</td><td>{status_badge(s)}</td><td class="num"><span class="due{" late" if l else ""}">{d}</span></td></tr>'
                  for t, ty, s, d, l in [
                      ('Facturación por uso', 'Épica', 'progress', '23 oct', False),
                      ('Búsqueda de texto completo en páginas', 'Historia', 'todo', '—', False),
                      ('La subida de avatar rechaza PNG válidos', 'Error', 'review', '21 oct', False),
                      ('Modo oscuro en todos los textos', 'Tarea', 'done', '—', False)])
sprints = ''.join(f'<tr><td class="title">{n}</td><td class="muted">{r}</td><td style="width:38%"><div class="bar"><span style="width:{p}%;--c:var(--{c})"></span></div></td><td class="num">{t}</td></tr>'
                  for n, r, p, c, t in [
                      ('Sprint 14 — Facturación y búsqueda', '26 sep – 23 oct', 25, 'text', '3 de 12'),
                      ('Sprint 13 — Formularios públicos', '12 – 25 sep', 100, 'text', '11 de 11'),
                      ('Sprint 12 — Registro de auditoría', '29 ago – 11 sep', 100, 'text', '12 de 12'),
                      ('Sprint 11 — Adjuntos', '15 – 28 ago', 92, 'text', '11 de 12')])
load = []
for who, c in [('avery', [1, 1, 1, 1]), ('blake', [1, 1, 1, 1]), ('noor', [1, 1, 0, 1]), ('Sin asignar', [1, 0, 0, 0])]:
    total = sum(c)
    parts = ''.join(f'<span style="flex:{n};--c:var(--st-{k})"></span>' for (k, _), n in zip(STATUS, c) if n)
    load.append(f'<li style="display:grid;grid-template-columns:96px 1fr 28px;gap:10px;align-items:center;padding:6px 0">'
                f'<span>{who}</span><span class="bar" style="height:10px;background:none">{parts}</span><span class="muted" style="text-align:right">{total}</span></li>')
activity = ''.join(f'<li style="padding:9px 0;border-bottom:1px solid var(--border);font-size:var(--t-13)"><b>{w}</b> {a}<span class="hint" style="display:block">{t}</span></li>'
                   for w, a, t in [
                       ('blake', 'movió «Selector de plan en ajustes» a En revisión', 'hace 25 min'),
                       ('avery', 'editó la nota «Arquitectura general»', 'hace 5 min'),
                       ('noor', 'registró 2 h en «La búsqueda pierde resultados…»', 'hace 1 h'),
                       ('blake', 'subió <span class="mono">factura-plantilla.pdf</span>', 'ayer, 18:40')])
panel = f"""<div class="page">
  <div class="page-head">
    <div><h1 class="page-title">Atlas Platform</h1><p class="page-sub"><span class="mono">#atlas</span> · 3 personas · 9 tickets abiertos</p></div>
    <div class="page-actions"><a class="btn btn-secondary" href="notas.html">Notas</a><a class="btn btn-primary" href="tablero.html">Abrir tablero</a></div>
  </div>
  <div style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;align-items:start" class="panel-grid">
    <div style="display:flex;flex-direction:column;gap:16px">
      <section class="panel">
        <div class="panel-head"><h2>Sprint 14 — Facturación y búsqueda</h2><span class="muted" style="font-size:var(--t-13)">termina el 23 oct · quedan 4 días</span></div>
        <div class="panel-body">
          <div class="bar" style="height:14px;background:none">{seg}</div>
          <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:12px">{legend_sprint}</div>
          <p class="hint" style="margin-top:10px">32 h registradas de 121 h estimadas. Al ritmo actual quedan 14 puntos sin cerrar el 23 oct.</p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Tus tickets</h2><a class="link" href="tablero.html">Ver en el tablero</a></div>
        <table class="table"><thead><tr><th>Título</th><th>Tipo</th><th>Estado</th><th class="num">Vence</th></tr></thead><tbody>{my_rows}</tbody></table>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Sprints</h2><a class="link" href="metricas.html">Métricas</a></div>
        <table class="table"><thead><tr><th>Sprint</th><th>Fechas</th><th>Avance</th><th class="num">Hechos</th></tr></thead><tbody>{sprints}</tbody></table>
      </section>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <section class="panel">
        <div class="panel-head"><h2>Carga por persona</h2></div>
        <div class="panel-body"><ul>{''.join(load)}</ul><p class="hint" style="margin-top:6px">Tickets abiertos y cerrados del sprint, por estado.</p></div>
      </section>
      <section class="panel" id="actividad">
        <div class="panel-head"><h2>Actividad reciente</h2></div>
        <div class="panel-body"><ul>{activity}</ul></div>
      </section>
    </div>
  </div>
</div>"""
write('panel.html', shell('panel', ['Atlas Platform', 'Panel'], panel, 'Panel'))

# ── Inicio ──────────────────────────────────────────────────────────────────
spaces = ''.join(f'<tr><td class="title"><a href="panel.html">{n}</a></td><td class="mono muted">{tag}</td><td>{rol}</td><td class="num">{p}</td><td class="num">{o}</td></tr>'
                 for n, tag, rol, p, o in [
                     ('Atlas Platform', '#atlas', 'Administración', 3, 9),
                     ('Tesis — Grupo 4', '#tesis-g4', 'Miembro', 5, 14),
                     ('Laboratorio de redes', '#redes-lab', 'Propiedad', 2, 3)])
pending = ''.join(f'<tr><td class="title">{t}</td><td class="muted">{s}</td><td>{status_badge(st)}</td><td class="num"><span class="due{" late" if l else ""}">{d}</span></td></tr>'
                  for t, s, st, d, l in [
                      ('Entregar el informe de laboratorio 4', 'Laboratorio de redes', 'progress', 'Vence hoy', True),
                      ('Facturación por uso', 'Atlas Platform', 'progress', '23 oct', False),
                      ('Revisar el capítulo 2 (marco teórico)', 'Tesis — Grupo 4', 'review', '25 oct', False),
                      ('Búsqueda de texto completo en páginas', 'Atlas Platform', 'todo', '—', False)])
inicio = f"""<div class="page page-narrow">
  <div class="page-head">
    <div><h1 class="page-title">Inicio</h1><p class="page-sub">Lo que tienes abierto en tus tres espacios.</p></div>
    <div class="page-actions"><button class="btn btn-secondary" type="button">{icon('plus')}Crear espacio</button></div>
  </div>
  <div class="notice" style="margin-bottom:20px"><div style="flex:1"><b>noor</b> te invitó a <b>Semillero de robótica</b>.<span class="hint" style="display:block">Entrarías como miembro. Verías su tablero, sus notas y sus archivos.</span></div><button class="btn btn-secondary btn-sm" type="button">Rechazar</button><button class="btn btn-primary btn-sm" type="button">Aceptar</button></div>
  <section style="margin-bottom:28px">
    <h2 class="section-title">Pendiente para ti</h2>
    <div class="panel"><table class="table"><thead><tr><th>Ticket</th><th>Espacio</th><th>Estado</th><th class="num">Vence</th></tr></thead><tbody>{pending}</tbody></table></div>
  </section>
  <section style="margin-bottom:28px">
    <h2 class="section-title">Tus espacios</h2>
    <div class="panel"><table class="table"><thead><tr><th>Espacio</th><th>Etiqueta</th><th>Tu rol</th><th class="num">Personas</th><th class="num">Abiertos</th></tr></thead><tbody>{spaces}</tbody></table></div>
  </section>
  <section id="actividad">
    <h2 class="section-title">Actividad</h2>
    <div class="panel"><div class="panel-body" style="padding-top:6px"><ul>{activity}</ul></div></div>
  </section>
</div>"""
write('inicio.html', shell('inicio', ['Inicio'], inicio, 'Inicio'))

# ── Notas ───────────────────────────────────────────────────────────────────
notas = f"""<div class="notes">
  <nav class="tree" aria-label="Árbol de notas">
    <div class="tree-head"><h2>Notas</h2><button class="btn btn-ghost btn-sm" type="button">{icon('plus')}Nueva</button></div>
    <ul>
      <li><a href="#" aria-current="page">Arquitectura general</a>
        <ul><li><a href="#">Modelo de datos</a></li><li><a href="#">Despliegue en la VM</a></li></ul></li>
      <li><a href="#">Guía de incorporación</a></li>
      <li><a href="#">Actas de sprint</a>
        <ul><li><a href="#">Sprint 13</a></li><li><a href="#">Sprint 14</a></li></ul></li>
    </ul>
  </nav>
  <article class="doc">
    <div class="doc-inner">
      <h1 class="doc-title">Arquitectura general</h1>
      <div class="doc-meta"><span class="avatar">av</span><span><b style="color:var(--text)">avery</b> · editada hace 5 min</span>{chip('API')}{chip('Q4')}<span style="margin-left:auto">Guardado</span></div>
      <div class="prose">
        <p>Forge OS corre como <b>un solo proceso</b> de Astro en modo servidor, sobre un archivo de SQLite. No hay una capa de API aparte: los manejadores de <code>src/pages/api</code> son la API.</p>
        <h2>Cómo encaja todo</h2>
        <p>Cada consulta va filtrada por <code>workspace_id</code>. Ese filtro es la frontera entre espacios, así que se aplica en la capa de datos y no en la interfaz. Lo detalla <span class="ticket-ref"><span class="sw" style="--c:var(--st-todo)"></span>Búsqueda de texto completo en páginas</span>, que es el primer caso que lo cruza.</p>
        <ul>
          <li>Astro en modo servidor con el adaptador de Node.</li>
          <li><code>better-sqlite3</code> para lecturas síncronas en el mismo proceso.</li>
          <li>Socket.IO para las notificaciones en tiempo real.</li>
        </ul>
        <h2>Copias de seguridad</h2>
        <p>La base está en modo WAL. Copiar el archivo da una copia incompleta, así que la copia nocturna pasa por <code>.backup</code> y comprueba el resultado:</p>
        <pre>sqlite3 forge.db ".backup /var/backups/forge-$(date +%F).db"
sqlite3 /var/backups/forge-$(date +%F).db "PRAGMA integrity_check;"</pre>
        <table><thead><tr><th>Pieza</th><th>Dónde vive</th><th>Quién responde</th></tr></thead>
        <tbody><tr><td>Base de datos</td><td><code>/var/lib/forge-os</code></td><td>avery</td></tr>
        <tr><td>Archivos</td><td>Drive de quien conecta el espacio</td><td>blake</td></tr>
        <tr><td>Proxy</td><td>Caddy</td><td>noor</td></tr></tbody></table>
      </div>
    </div>
  </article>
</div>"""
write('notas.html', shell('notas', ['Atlas Platform', 'Notas', 'Arquitectura general'], notas, 'Notas'))

# ── Tablas ──────────────────────────────────────────────────────────────────
STAGES = {'Contacto': '#5F6B7A', 'Propuesta': '#0E7490', 'Negociación': '#A16207', 'Cerrado': '#4D7C0F'}
rows = [('Ferretería Norte', 'Lucía Paredes', 'Propuesta', '4.800', 'propuesta-v2.pdf'),
        ('Clínica San Rafael', 'Andrés Mejía', 'Negociación', '12.500', 'contrato-borrador.pdf'),
        ('Colegio Las Acacias', 'Marta Ruiz', 'Contacto', '2.100', '—'),
        ('Transportes Ébano', 'Iván Soto', 'Cerrado', '7.300', 'contrato-firmado.pdf'),
        ('Panadería La Espiga', 'Rosa Díaz', 'Contacto', '900', '—'),
        ('Estudio Prisma', 'Tomás Vela', 'Propuesta', '3.650', 'alcance.pdf'),
        ('Agroinsumos del Valle', 'Elena Gil', 'Cerrado', '15.200', 'orden-compra.pdf'),
        ('Óptica Central', 'Pablo Rey', 'Negociación', '5.400', '—')]
body_rows = ''.join(
    f'<tr{" class=\"selected\"" if i == 1 else ""}><td class="rowno">{i + 1}</td><td><b>{a}</b></td><td>{b}</td>'
    f'<td><span class="status"><span class="sw" style="--c:{STAGES[c]}"></span>{c}</span></td><td class="num">{d} €</td>'
    f'<td>{"<span class=\"muted\">—</span>" if e == "—" else f"<span class=\"file-kind\">PDF</span> {e}"}</td></tr>'
    for i, (a, b, c, d, e) in enumerate(rows))
tablas = f"""<div class="page">
  <div class="page-head">
    <div><h1 class="page-title">Tablas</h1><p class="page-sub">Datos con columnas propias: contactos, inventario, lecturas.</p></div>
    <div class="page-actions"><button class="btn btn-secondary" type="button">{icon('plus')}Nueva tabla</button></div>
  </div>
  <div class="split">
    <nav class="list-nav" aria-label="Tablas del espacio">
      <a href="#" aria-current="page"><span>Contactos comerciales</span><span class="count">8</span></a>
      <a href="#"><span>Inventario de equipos</span><span class="count">31</span></a>
      <a href="#"><span>Lecturas del sensor</span><span class="count">240</span></a>
    </nav>
    <section>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <div><h2 class="section-title" style="margin:0">Contactos comerciales</h2><p class="hint">Empresas con las que hay una propuesta abierta o cerrada este trimestre.</p></div>
        <div class="toolbar-group"><button class="btn btn-secondary" type="button">Columnas</button><button class="btn btn-primary" type="button">{icon('plus')}Nueva fila</button></div>
      </div>
      <div class="grid-wrap">
        <table class="sheet">
          <thead><tr><th class="rowno">#</th><th>Empresa<small>Texto</small></th><th>Contacto<small>Texto</small></th><th>Etapa<small>Selección</small></th><th class="num">Valor<small>Número</small></th><th>Contrato<small>Archivo</small></th></tr></thead>
          <tbody>{body_rows}</tbody>
        </table>
      </div>
      <p class="hint" style="margin-top:8px">8 filas · suma de «Valor»: 51.850 €</p>
    </section>
  </div>
</div>"""
write('tablas.html', shell('tablas', ['Atlas Platform', 'Tablas', 'Contactos comerciales'], tablas, 'Tablas'))

# ── Archivos ────────────────────────────────────────────────────────────────
files = [('PDF', 'factura-plantilla.pdf', ['Facturación'], 'Generar facturas en PDF', '184 KB', 'blake', 'ayer'),
         ('PNG', 'avatar-rechazado.png', ['Interfaz'], 'La subida de avatar rechaza PNG válidos', '2,1 MB', 'avery', '17 oct'),
         ('CSV', 'consumo-septiembre.csv', ['API', 'Q4'], 'API de medición de consumo', '96 KB', 'blake', '9 oct'),
         ('PDF', 'guia-incorporacion.pdf', ['Incorporación'], '—', '1,4 MB', 'noor', '2 oct'),
         ('ZIP', 'capturas-sprint-13.zip', [], '—', '18 MB', 'avery', '25 sep')]
frows = ''.join(f'<tr><td class="title"><span class="file-kind">{k}</span> {n}</td><td><span style="display:inline-flex;gap:4px;flex-wrap:wrap">{"".join(chip(l) for l in ls) or "<span class=\"muted\">—</span>"}</span></td>'
                f'<td class="muted">{t}</td><td class="num">{s}</td><td>{w}</td><td class="num muted">{d}</td></tr>'
                for k, n, ls, t, s, w, d in files)
archivos = f"""<div class="page">
  <div class="page-head">
    <div><h1 class="page-title">Archivos</h1><p class="page-sub">Se guardan en el Drive de <b>blake</b>, carpeta «Forge — Atlas Platform». Aquí solo quedan los datos.</p></div>
    <div class="page-actions"><button class="btn btn-secondary" type="button">Abrir en Drive</button><button class="btn btn-primary" type="button">{icon('plus')}Subir archivo</button></div>
  </div>
  <div class="toolbar"><div class="toolbar-group"><div class="search" style="margin:0;width:280px">{icon('search')}<span>Buscar por nombre</span></div><span class="select select-inline">Todas las etiquetas</span><span class="select select-inline">Cualquier ticket</span></div><span class="hint" style="align-self:center">14 archivos · 41 MB en Drive</span></div>
  <div class="panel"><table class="table"><thead><tr><th>Nombre</th><th>Etiquetas</th><th>Ticket</th><th class="num">Tamaño</th><th>Subido por</th><th class="num">Fecha</th></tr></thead><tbody>{frows}
  <tr><td class="title"><span class="file-kind">DOC</span> requisitos-cliente.docx</td><td><span class="muted">—</span></td><td colspan="4"><span class="due late">Sin acceso.</span> <span class="muted">El permiso de Drive se revocó. El archivo sigue en ese Drive; vuelve a conectar la cuenta para verlo.</span></td></tr>
  </tbody></table></div>
</div>"""
write('archivos.html', shell('archivos', ['Atlas Platform', 'Archivos'], archivos, 'Archivos'))

# ── Métricas (SVG estático) ────────────────────────────────────────────────
def burndown():
    W, H, l, r, t, b = 560, 250, 34, 64, 10, 26
    days = 28
    real = [40, 40, 38, 38, 37, 35, 35, 33, 30, 30, 29, 27, 27, 25, 24, 22, 22, 21, 19, 18, 17, 17, 15, 14]
    x = lambda d: l + d * (W - l - r) / days
    y = lambda v: t + (40 - v) * (H - t - b) / 40
    grid = ''.join(f'<line x1="{l}" x2="{W - r}" y1="{y(v)}" y2="{y(v)}"/>' for v in (0, 10, 20, 30, 40))
    ylab = ''.join(f'<text x="{l - 8}" y="{y(v) + 4}" text-anchor="end">{v}</text>' for v in (0, 10, 20, 30, 40))
    xlab = ''.join(f'<text x="{x(d)}" y="{H - 6}" text-anchor="middle">{s}</text>' for d, s in [(0, '26 sep'), (7, '3 oct'), (14, '10 oct'), (21, '17 oct'), (28, '23 oct')])
    pts = ' '.join(f'{x(i):.1f},{y(v):.1f}' for i, v in enumerate(real))
    last = len(real) - 1
    return f"""<svg viewBox="0 0 {W} {H}" role="img" aria-label="Burndown del sprint 14: quedan 14 de 40 puntos con 4 días por delante; la línea ideal marcaría unos 6.">
  <g class="grid">{grid}</g>{ylab}{xlab}
  <line class="axis" x1="{l}" x2="{W - r}" y1="{y(0)}" y2="{y(0)}"/>
  <line x1="{x(0)}" y1="{y(40)}" x2="{x(28)}" y2="{y(0)}" stroke="var(--border-strong)" stroke-width="2" stroke-dasharray="5 4"/>
  <polyline points="{pts}" fill="none" stroke="var(--text)" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="{x(last)}" cy="{y(real[-1])}" r="4.5" fill="var(--text)" stroke="var(--surface-1)" stroke-width="2"/>
  <line x1="{x(last)}" x2="{x(last)}" y1="{t}" y2="{y(0)}" stroke="var(--border-strong)" stroke-width="1"/>
  <text x="{x(last) + 8}" y="{t + 12}" class="lbl">Hoy</text>
  <text x="{x(last) + 10}" y="{y(real[-1]) + 4}" class="lbl">14 pts</text>
  <text x="{x(28) + 6}" y="{y(0) - 6}">Ideal</text>
</svg>"""


def workload():
    W, rowh, l, r = 560, 46, 92, 40
    data = [('avery', [1, 1, 1, 1]), ('blake', [1, 1, 1, 1]), ('noor', [1, 1, 0, 1]), ('Sin asignar', [1, 0, 0, 0])]
    scale = (W - l - r) / 4
    out = []
    for i, (who, c) in enumerate(data):
        yy = 6 + i * rowh
        out.append(f'<text x="{l - 10}" y="{yy + 18}" text-anchor="end" class="lbl" style="font-weight:500">{who}</text>')
        xx = l
        for (k, _), n in zip(STATUS, c):
            if not n:
                continue
            w = n * scale - 2
            out.append(f'<rect x="{xx}" y="{yy}" width="{w}" height="26" fill="var(--st-{k})"/>')
            xx += n * scale
        out.append(f'<text x="{xx + 6}" y="{yy + 18}">{sum(c)}</text>')
    H = 6 + len(data) * rowh
    return f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Carga por persona en el sprint 14, por estado.">{"".join(out)}</svg>'


def velocity():
    W, H, l, r, t, b = 560, 220, 34, 16, 18, 26
    data = [('Sprint 11', 21, False), ('Sprint 12', 26, False), ('Sprint 13', 24, False), ('Sprint 14', 9, True)]
    y = lambda v: t + (30 - v) * (H - t - b) / 30
    bw = 64
    step = (W - l - r) / len(data)
    out = [f'<g class="grid">' + ''.join(f'<line x1="{l}" x2="{W - r}" y1="{y(v)}" y2="{y(v)}"/>' for v in (0, 10, 20, 30)) + '</g>']
    out += [f'<text x="{l - 8}" y="{y(v) + 4}" text-anchor="end">{v}</text>' for v in (0, 10, 20, 30)]
    for i, (n, v, cur) in enumerate(data):
        cx = l + step * i + step / 2
        fill = 'none' if cur else 'var(--text)'
        stroke = ' stroke="var(--text)" stroke-width="1.5" stroke-dasharray="4 3"' if cur else ''
        out.append(f'<rect x="{cx - bw / 2}" y="{y(v)}" width="{bw}" height="{y(0) - y(v)}" fill="{fill}"{stroke}/>')
        out.append(f'<text x="{cx}" y="{y(v) - 6}" text-anchor="middle" class="lbl">{v}{" (en curso)" if cur else ""}</text>')
        out.append(f'<text x="{cx}" y="{H - 6}" text-anchor="middle">{n}</text>')
    return f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Puntos cerrados por sprint: 21, 26, 24 y 9 en el sprint en curso.">{"".join(out)}</svg>'


def estimation():
    W, H, l, r, t, b = 560, 220, 34, 16, 18, 26
    data = [('avery', 42, 30), ('blake', 46, 21), ('noor', 33, 12)]
    y = lambda v: t + (50 - v) * (H - t - b) / 50
    step = (W - l - r) / len(data)
    bw = 52
    out = ['<g class="grid">' + ''.join(f'<line x1="{l}" x2="{W - r}" y1="{y(v)}" y2="{y(v)}"/>' for v in (0, 25, 50)) + '</g>']
    out += [f'<text x="{l - 8}" y="{y(v) + 4}" text-anchor="end">{v}</text>' for v in (0, 25, 50)]
    for i, (n, e, g) in enumerate(data):
        cx = l + step * i + step / 2
        out.append(f'<rect x="{cx - bw - 1}" y="{y(e)}" width="{bw}" height="{y(0) - y(e)}" fill="var(--border-strong)"/>')
        out.append(f'<rect x="{cx + 1}" y="{y(g)}" width="{bw}" height="{y(0) - y(g)}" fill="var(--text)"/>')
        out.append(f'<text x="{cx - bw / 2}" y="{y(e) - 6}" text-anchor="middle">{e} h</text>')
        out.append(f'<text x="{cx + bw / 2}" y="{y(g) - 6}" text-anchor="middle" class="lbl">{g} h</text>')
        out.append(f'<text x="{cx}" y="{H - 6}" text-anchor="middle">{n}</text>')
    return f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Horas estimadas frente a registradas por persona.">{"".join(out)}</svg>'


legend_status = ''.join(f'<span><i style="--c:var(--st-{k})"></i>{n}</span>' for k, n in STATUS)
metricas = f"""<div class="page">
  <div class="page-head">
    <div><h1 class="page-title">Métricas</h1><p class="page-sub">Calculadas con el tiempo registrado, no con las estimaciones.</p></div>
    <div class="page-actions"><span class="select select-inline">Sprint 14 — Facturación y búsqueda</span></div>
  </div>
  <div class="charts">
    <section class="panel chart"><div class="panel-head"><h2>Puntos pendientes</h2><span class="hint">va por detrás: 14 pts con 4 días</span></div>
      <div class="panel-body"><div class="legend"><span><i class="line" style="--c:var(--text)"></i>Real</span><span><i class="dash" style="--c:var(--border-strong)"></i>Ideal</span></div>{burndown()}</div></section>
    <section class="panel chart"><div class="panel-head"><h2>Carga por persona</h2><span class="hint">tickets del sprint</span></div>
      <div class="panel-body"><div class="legend">{legend_status}</div>{workload()}</div></section>
    <section class="panel chart"><div class="panel-head"><h2>Puntos cerrados por sprint</h2><span class="hint">últimos 4 sprints</span></div>
      <div class="panel-body">{velocity()}</div></section>
    <section class="panel chart"><div class="panel-head"><h2>Estimado y registrado</h2><span class="hint">horas, sprint 14</span></div>
      <div class="panel-body"><div class="legend"><span><i style="--c:var(--border-strong)"></i>Estimado</span><span><i style="--c:var(--text)"></i>Registrado</span></div>{estimation()}</div></section>
  </div>
</div>"""
write('metricas.html', shell('metricas', ['Atlas Platform', 'Métricas'], metricas, 'Métricas'))

# ── Ajustes ─────────────────────────────────────────────────────────────────
def check(label, on, hint=''):
    h = f'<span class="hint" style="display:block">{hint}</span>' if hint else ''
    return f'<label class="check"><span class="box{" on" if on else ""}"></span><span>{label}{h}</span></label>'


ajustes = f"""<div class="page">
  <div class="page-head">
    <div><h1 class="page-title">Ajustes</h1><p class="page-sub">Tu perfil, tu cuenta y los servicios conectados.</p></div>
    <div class="page-actions"><button class="btn btn-secondary" type="button">Cerrar sesión</button><button class="btn btn-secondary" type="button">Cerrar todas las sesiones</button></div>
  </div>
  <div class="settings">
    <nav class="subnav" aria-label="Secciones de ajustes">
      <a href="#perfil" aria-current="page">Perfil</a><a href="#notificaciones">Notificaciones</a><a href="#servicios">Servicios conectados</a><a href="#seguridad">Contraseña</a><a href="#borrar" class="danger">Borrar la cuenta</a>
    </nav>
    <div>
      <section class="form-section" id="perfil">
        <header><h2>Perfil</h2><p>Lo que ve el resto de personas en tu perfil público.</p></header>
        <div style="display:flex;gap:16px;align-items:center"><span class="avatar avatar-xl">av</span><div><button class="btn btn-secondary" type="button">Cambiar foto</button><p class="hint" style="margin-top:6px">PNG o JPG, hasta 10 MB.</p></div></div>
        <div class="row-2">
          <div class="field"><label>Nombre visible</label><span class="input">Avery Collins</span></div>
          <div class="field"><label>Pronombres</label><span class="select">they/them</span></div>
        </div>
        <div class="field"><label>Biografía</label><span class="textarea">Product lead. Mantiene la hoja de ruta honesta.</span><span class="hint">Hasta 280 caracteres.</span></div>
        {check('Perfil público', True, 'Cualquiera con la dirección puede ver tu nombre, tu biografía y tus espacios públicos.')}
      </section>
      <section class="form-section" id="notificaciones">
        <header><h2>Notificaciones</h2><p>Avisos dentro de Forge. No se envía nada por correo.</p></header>
        {check('Cuando me asignan un ticket', True)}
        {check('Cuando alguien me menciona', True)}
        {check('Cuando cambia el estado de un ticket mío', False)}
        {check('Invitaciones a espacios', True)}
      </section>
      <section class="form-section" id="servicios">
        <header><h2>Servicios conectados</h2><p>Para entrar sin contraseña y para guardar archivos en Drive.</p></header>
        <div>
          <div class="service"><b>Google</b><span class="muted">avery.collins · también guarda los archivos de 1 espacio</span><span class="push"><button class="btn btn-secondary btn-sm" type="button">Desconectar</button></span></div>
          <div class="service"><b>GitHub</b><span class="muted">Sin conectar</span><span class="push"><button class="btn btn-secondary btn-sm" type="button">Conectar</button></span></div>
        </div>
      </section>
      <section class="form-section" id="borrar">
        <header><h2>Borrar la cuenta</h2></header>
        <div class="notice notice-danger"><div style="flex:1">Los tickets, las notas y los archivos que creaste <b>se quedan en sus espacios</b>, a nombre de «Cuenta borrada». Los tickets que tenías asignados pasan a «Sin asignar». No se puede deshacer.<span class="hint" style="display:block;margin-top:6px">Eres la única persona con propiedad en «Laboratorio de redes». Antes de borrar la cuenta, cede la propiedad o borra el espacio.</span></div><button class="btn btn-danger" type="button">Borrar la cuenta</button></div>
      </section>
      <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-ghost" type="button">Descartar</button><button class="btn btn-primary" type="button">Guardar cambios</button></div>
    </div>
  </div>
</div>"""
write('ajustes.html', shell('', ['Ajustes'], ajustes, 'Ajustes'))

# ── Portada ─────────────────────────────────────────────────────────────────
mini = []
for key, name in STATUS[:3]:
    cs = COLUMNS[key][:2]
    mini.append(f'<section class="column s-{key}" style="min-height:0"><header class="column-head"><h2>{name}</h2><span class="n">{COUNTS[key]}</span></header><div class="tape"></div><div class="column-body">{"".join(cs)}</div></section>')
portada = HEAD.format(title='Portada · Forge OS', favicon=FAVICON) + f"""<body>
<div class="site">
  <header class="site-head">
    <a href="index.html" aria-label="Forge OS">{brand(26)}</a>
    <nav>
      <a class="btn btn-ghost" href="#cambios">Cambios</a>
      <a class="btn btn-ghost" href="#">Código</a>
      {THEME_BTN}
      <a class="btn btn-ghost" href="acceso.html">Entrar</a>
      <a class="btn btn-primary" href="acceso.html">Crear cuenta</a>
    </nav>
  </header>
  <section class="hero">
    <div>
      <h1>Tablero, notas y archivos de tu equipo, en un servidor tuyo.</h1>
    </div>
    <div>
      <p>Un tablero por sprint, notas enlazadas a los tickets que describen y archivos que se guardan en tu Drive. Todo en un proceso de Node y un archivo de SQLite. Software libre, sin cuotas por persona.</p>
      <div class="actions"><a class="btn btn-primary" href="tablero.html">Probar sin cuenta</a><a class="btn btn-secondary" href="#">Instalarlo</a></div>
      <p class="hint" style="margin-top:10px">La prueba crea un espacio temporal que dura 30 días. Si luego te registras, te lo llevas.</p>
    </div>
  </section>
  <figure class="figure">
    <div class="board" style="grid-template-columns:repeat(3,minmax(0,1fr))">{''.join(mini)}</div>
  </figure>
  <p class="figcaption">El tablero de la instancia de prueba, tal cual. El temporizador corre en el servidor: cerrar el portátil no pierde la hora registrada.</p>

  <section class="site-section">
    <h2>Qué hace</h2>
    <div class="features">
      <div><h3>Tablero</h3><p>Cuatro columnas, arrastrar y soltar, sprints con fecha de cierre y un temporizador por ticket que se detiene solo al llegar a «Hecho».</p></div>
      <div><h3>Notas</h3><p>Editor por bloques con títulos, listas, tablas y código. Una nota enlazada a un ticket aparece en el ticket, sin un segundo enlace que mantener.</p></div>
      <div><h3>Archivos</h3><p>Se suben directamente al Drive de quien conecta el espacio. El servidor no guarda los bytes ni ve el token de acceso.</p></div>
      <div><h3>Métricas</h3><p>Burndown, velocidad y carga por persona, calculados con el tiempo que se registró de verdad.</p></div>
    </div>
  </section>

  <section class="site-section">
    <h2>Ficha técnica</h2>
    <table class="datasheet">
      <tr><th>Licencia</th><td>MIT. Todas las funciones, sin plan de pago.</td></tr>
      <tr><th>Datos</th><td>Un archivo de SQLite en tu máquina. Copia de seguridad con <span class="mono">scripts/backup.sh</span>.</td></tr>
      <tr><th>Requisitos</th><td>Node 22.12 o superior. Funciona en una e2-micro.</td></tr>
      <tr><th>Personas</th><td>Sin límite por espacio.</td></tr>
      <tr><th>Terceros</th><td>Ninguno en la página. Google solo si conectas Drive o entras con su cuenta.</td></tr>
    </table>
  </section>

  <section class="site-section" id="cambios">
    <h2>Cambios recientes</h2>
    <ul class="changes">
      <li><span><span class="v">1.28.5</span><span class="d">18 oct 2026</span></span><ul><li>«Termina hoy» ya no aparece un día antes al oeste de UTC.</li><li>La foto diaria del burndown se guarda con la fecha local del espacio.</li></ul></li>
      <li><span><span class="v">1.28.4</span><span class="d">18 oct 2026</span></span><ul><li>Las entregas de hoy dejan de salir vencidas por la noche en producción.</li></ul></li>
      <li><span><span class="v">1.28.2</span><span class="d">18 oct 2026</span></span><ul><li>Las fechas de entrega ya no se desplazan un día al oeste de UTC.</li><li>Una entrega de hoy no se pone en rojo al abrir el ticket.</li></ul></li>
    </ul>
  </section>

  <footer class="site-foot">{brand(18)}<span>MIT · hecho en Bogotá</span><span style="margin-left:auto">v1.28.5</span></footer>
</div>
</body>
</html>
"""
write('portada.html', portada)

# ── Acceso ──────────────────────────────────────────────────────────────────
acceso = HEAD.format(title='Entrar · Forge OS', favicon=FAVICON) + f"""<body>
<div class="auth">
  <aside class="auth-brand">
    <a href="portada.html" class="brand" style="color:var(--brand-paper)">{mark(30)}<span class="brand-word">Forge OS</span></a>
    <div>
      <p class="claim">Lo que tu equipo escribe, planifica y registra, en un archivo tuyo.</p>
      <ul><li>Un proceso de Node sobre un archivo de SQLite.</li><li>Nadie más lee tu trabajo.</li><li>Licencia MIT. Instálalo donde quieras.</li></ul>
    </div>
    <span style="font-size:var(--t-12);color:#CFC9BF">v1.28.5</span>
  </aside>
  <div class="auth-form">
    <form aria-labelledby="acc-t" onsubmit="return false">
      <div style="display:flex;justify-content:space-between;align-items:center"><a class="link" href="portada.html">← Portada</a>{THEME_BTN}</div>
      <div><h1 id="acc-t" class="page-title">Entrar</h1><p class="page-sub">En tu cuenta de esta instancia.</p></div>
      <div class="row-2"><button class="btn btn-secondary" type="button" style="justify-content:center">Google</button><button class="btn btn-secondary" type="button" style="justify-content:center">GitHub</button></div>
      <div class="divider">o con usuario</div>
      <div class="field"><label for="u">Usuario</label><span class="input" id="u" style="outline:2px solid var(--focus);outline-offset:2px">avery</span></div>
      <div class="field"><label for="p">Contraseña</label><span class="input" id="p">••••••••••••</span><span class="hint">¿La olvidaste? Pide a quien administra la instancia que la restablezca.</span></div>
      <button class="btn btn-primary" type="button" style="justify-content:center;height:40px">Entrar</button>
      <div class="divider">o</div>
      <a class="btn btn-secondary" href="tablero.html" style="justify-content:center">Probar sin cuenta</a>
      <p class="hint">Crea un espacio temporal de 30 días. Al registrarte, te lo llevas.</p>
      <p style="font-size:var(--t-13)">¿No tienes cuenta? <a class="link" href="#">Crear una</a></p>
    </form>
  </div>
</div>
</body>
</html>
"""
write('acceso.html', acceso)

# ── Índice / hoja de identidad ──────────────────────────────────────────────
def sw(name, var, light, dark, note=''):
    return (f'<div class="swatch"><b style="--c:var({var})"></b><div><strong>{name}</strong>'
            f'<span class="mono">{light} / {dark}</span>{"<br><span class=muted>" + note + "</span>" if note else ""}</div></div>')


SCREENS = [('logo.html', 'Logo', 'Las cuatro propuestas dibujadas desde cero y por qué se eligió «Fragua».'),
           ('tablero.html', 'Tablero', 'Cuatro columnas a 1280 px, tarjeta compacta, una tarjeta en pleno arrastre.'),
           ('ticket.html', 'Ticket', 'Cajón lateral sobre el tablero: propiedades, tiempo y notas enlazadas.'),
           ('panel.html', 'Panel del espacio', 'Estado del sprint, tus tickets, sprints, carga y actividad.'),
           ('inicio.html', 'Inicio', 'Lo pendiente en todos tus espacios, sin banners ni saludo.'),
           ('notas.html', 'Notas', 'Árbol sin caja y medida de lectura de 68 caracteres.'),
           ('tablas.html', 'Tablas', 'Hoja de cálculo con el tipo de cada columna a la vista.'),
           ('archivos.html', 'Archivos', 'Lista de Drive, con el caso de un archivo sin acceso.'),
           ('metricas.html', 'Métricas', 'Cuatro gráficas con los colores de estado y etiquetas directas.'),
           ('ajustes.html', 'Ajustes', 'Formularios con un solo tipo de campo y la zona de borrado.'),
           ('portada.html', 'Portada', 'Sin bento, sin halo, sin ventana falsa: el producto y una ficha técnica.'),
           ('acceso.html', 'Entrar', 'Panel de marca en tinta y formulario.')]
screens = ''.join(f'<a href="{h}"><strong>{t}</strong><span>{d}</span></a>' for h, t, d in SCREENS)
RULES = ['Cada decisión visual se justifica con una frase sobre Forge.',
         'Un color significa una cosa: naranja es acción, los estados son estado, rojo es error.',
         'Sin gradientes, halos, desenfoques ni animaciones perpetuas. La sombra solo indica que algo flota.',
         'El movimiento responde a una acción: arrastrar, abrir, guardar.',
         'Mayúsculas solo en las cabeceras de columna. Mono solo para código, atajos y claves.',
         'Archivo, no la tipografía por defecto de lo generado.',
         'Un juego de iconos, y solo donde la etiqueta no basta.',
         'La portada enseña el producto real, no maquetas de plantilla.',
         'Texto en tipo oración, concreto y sin superlativos.',
         'Un botón, un campo, un modal: sin componentes no hay identidad.']
rules = ''.join(f'<li><span>{r}</span></li>' for r in RULES)
index = HEAD.format(title='Rediseño de Forge OS', favicon=FAVICON) + f"""<body>
<div class="sheet-page">
  <header class="site-head" style="margin-bottom:40px">{brand(22)}<nav><span class="hint">Maqueta estática · 19 oct 2026</span>{THEME_BTN}</nav></header>

  <h1 class="page-title" style="font-size:clamp(2.4rem,5vw,3.6rem)">Propuesta «Taller»</h1>
  <p class="page-sub" style="max-width:70ch;font-size:var(--t-16);line-height:1.6;margin-bottom:40px">Rediseño completo de Forge OS, logo incluido, siguiendo <span class="mono">docs/rediseno-diagnostico.md</span>. Las pantallas no tienen funcionalidad: son para ver cómo queda cada sector. Los datos son los de la demostración. El botón de tema alterna claro y oscuro en todas.</p>

  <section class="site-section" style="padding-top:0;border-top:0">
    <h2>Pantallas</h2>
    <div class="screens">{screens}</div>
  </section>

  <section class="site-section">
    <h2>Logo: Fragua</h2>
    <div style="display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:32px;align-items:center" class="logo-grid">
      <div class="panel" style="padding:28px">
        <svg viewBox="-4 -4 72 72" width="100%" style="max-width:340px;display:block;margin:auto" role="img" aria-label="Fragua sobre su rejilla">{grid_overlay()}{m_fragua("var(--text)", ORANGE)}</svg>
        <p class="hint" style="text-align:center;margin-top:10px">Rejilla de 64 × 64, módulo de 4</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:20px">
        <p style="line-height:1.6">La boca de una fragua sobre su hogar, con las brasas encendidas dentro. Es el sitio donde se trabaja —lo mismo que un espacio de Forge— y «hogar» es a la vez el fuego y la casa. Dos formas: un arco con hueco y un montículo que repite su curva. Funciona en una tinta; el naranja es el único acento. <a class="link" href="logo.html">Ver las cuatro propuestas</a>.</p>
        <div style="display:flex;gap:22px;align-items:flex-end;flex-wrap:wrap">
          {''.join(f'<div style="text-align:center">{svg(m_fragua, n, "var(--text)")}<p class="hint" style="margin-top:6px">{n}</p></div>' for n in (16, 24, 32, 48))}
          <div style="text-align:center">{app_tile(m_fragua, 64, INK, PAPER, ORANGE)}<p class="hint" style="margin-top:6px">app</p></div>
          <div style="text-align:center">{app_tile(m_fragua, 64, ORANGE, INK, PAPER)}<p class="hint" style="margin-top:6px">app, naranja</p></div>
          <div style="text-align:center">{app_tile(m_fragua, 32, INK, PAPER, ORANGE)}<p class="hint" style="margin-top:6px">favicon</p></div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div style="padding:16px 20px;background:{PAPER};border:1px solid #CFCAC0;border-radius:var(--r)">{lockup(m_fragua, 26, INK, ORANGE, INK)}</div>
          <div style="padding:16px 20px;background:{INK};border-radius:var(--r)">{lockup(m_fragua, 26, PAPER, ORANGE, PAPER)}</div>
          <div style="padding:16px 20px;background:{ORANGE};border-radius:var(--r)">{lockup(m_fragua, 26, INK, PAPER, INK)}</div>
        </div>
      </div>
    </div>
  </section>

  <section class="site-section">
    <h2>Color</h2>
    <p class="muted" style="margin-bottom:16px;max-width:70ch">Claro por defecto. Todas las parejas de texto pasan AA (≥ 4,5:1) sobre el fondo y las dos superficies, en los dos temas. Los cuatro estados forman además una paleta validada para daltonismo, que es la que usan las gráficas.</p>
    <div class="swatches">
      {sw('Fondo', '--bg', '#EEECE7', '#1B1A18')}{sw('Superficie 1', '--surface-1', '#F8F7F4', '#232220')}{sw('Superficie 2', '--surface-2', '#E4E1DA', '#2C2A27')}
      {sw('Borde fuerte', '--border-strong', '#7D776C', '#857E74', 'controles · ≥ 3:1')}{sw('Texto', '--text', '#171614', '#ECE9E3')}{sw('Tenue', '--muted', '#57534B', '#ABA59B')}
      {sw('Acción', '--accent', '#E8590C', '#F06A1F', 'relleno, con texto en tinta')}{sw('Texto de acción', '--accent-text', '#A63C00', '#FF9452')}{sw('Peligro', '--danger', '#A61E1E', '#FF7A6E')}
    </div>
    <p class="muted" style="margin:24px 0 12px">Estados: solo para el estado de un ticket, nunca como adorno ni como color de texto.</p>
    <div class="swatches">
      {sw('Por hacer', '--st-todo', '#9C5A0F', '#BF7F28')}{sw('En curso', '--st-progress', '#1E5AA8', '#5A8FE6')}{sw('En revisión', '--st-review', '#A23B72', '#C66BB0')}{sw('Hecho', '--st-done', '#266B2A', '#3FA86A')}
    </div>
  </section>

  <section class="site-section">
    <h2>Tipografía</h2>
    <p class="muted" style="margin-bottom:16px;max-width:70ch">Archivo (Omnibus-Type, OFL), variable en peso y anchura. Estrecha para títulos y cabeceras de columna; normal para todo lo demás. IBM Plex Mono solo para código, atajos y claves. Ambas servidas desde <span class="mono">fonts/</span>, sin Google Fonts. Cifras tabulares en toda la interfaz.</p>
    <div class="specimen">
      <div><span class="hint">34 · estrecha 700</span><span class="page-title">Sprint 14 — Facturación</span></div>
      <div><span class="hint">20 · estrecha 700</span><span class="section-title" style="margin:0">Tus tickets</span></div>
      <div><span class="hint">16 · 700 · columna</span><span style="font-size:var(--t-16);font-weight:750;font-stretch:75%;text-transform:uppercase;letter-spacing:.02em">En revisión</span></div>
      <div><span class="hint">16 · notas</span><span style="font-size:var(--t-16)">Cada consulta va filtrada por <code class="mono">workspace_id</code>.</span></div>
      <div><span class="hint">14 · 600 · tarjeta</span><span style="font-weight:600">Generar facturas en PDF</span></div>
      <div><span class="hint">13 · interfaz</span><span style="font-size:var(--t-13)">32 h de 121 h registradas</span></div>
      <div><span class="hint">12 · mínimo</span><span style="font-size:var(--t-12)" class="muted">Creado por avery el 3 oct</span></div>
    </div>
  </section>

  <section class="site-section">
    <h2>Componentes</h2>
    <div style="display:flex;flex-direction:column;gap:20px">
      <div class="toolbar-group"><button class="btn btn-primary" type="button">{icon('plus')}Nuevo ticket <kbd>C</kbd></button><button class="btn btn-secondary" type="button">Secundario</button><button class="btn btn-ghost" type="button">Fantasma</button><button class="btn btn-danger" type="button">Borrar</button><button class="btn btn-secondary btn-sm" type="button">Pequeño</button></div>
      <div class="row-2" style="max-width:640px"><div class="field"><label>Título</label><span class="input">Generar facturas en PDF</span><span class="hint">Una frase que se entienda fuera del tablero.</span></div><div class="field"><label>Estado</label><span class="select">{status_badge('progress')}</span></div></div>
      <div class="toolbar-group">{''.join(status_badge(k) for k, _ in STATUS)}</div>
      <div class="toolbar-group">{chip('Facturación')}{chip('Búsqueda')}{chip('Interfaz')}<span class="avatar">av</span><span class="avatar avatar-lg">bl</span><span class="due late">Vence hoy</span><span class="due">24 oct</span></div>
      <div style="max-width:300px">{COLUMNS['progress'][0]}</div>
    </div>
  </section>

  <section class="site-section">
    <h2>Reglas</h2>
    <ol class="rules">{rules}</ol>
  </section>
</div>
</body>
</html>
"""
write('index.html', index)
print('ok', sorted(os.listdir(OUT)))

# ═════════════════════════════════════════════════════════════════════════════
# Logo: propuestas
# ═════════════════════════════════════════════════════════════════════════════
CONCEPTS = [
    dict(key='fragua', fn=m_fragua, name='Fragua', rec=True,
         idea='La boca de una fragua sobre su hogar, con las brasas encendidas dentro.',
         why=['Es el lugar donde se trabaja, no una herramienta suelta: lo mismo que un espacio de Forge.',
              '«Hogar» es a la vez el fuego de la fragua y la casa: el sitio donde vive el trabajo del equipo.',
              'Silueta de arco, muy distinta de las letras en cuadrado que abundan. Se reconoce a 16 px por la forma, sin leer nada.',
              'Las brasas repiten la curva del arco: todo el símbolo sale de dos formas. Funciona en una tinta y a dos colores, con el naranja como único acento.'],
         risk='Se probó con una llama dentro y se descartó: la gota simétrica se leía como agua o como un marcador de mapa, y la llama con lengua lateral se parece a la de Tinder. El montículo de brasas es más abstracto y se lee mejor a 16 px. Si se dibuja con detalle, cualquier versión acaba pareciendo una chimenea de salón: tiene que quedarse en geometría pura.'),
    dict(key='hierro', fn=m_hierro, name='Hierro al rojo',
         idea='Una F hecha con una barra doblada, y el brazo del medio todavía al rojo.',
         why=['Es letra, como el monograma de Amplitude: se asocia al nombre desde el primer día.',
              'La esquina curva es la de una barra doblada en caliente; el brazo naranja es la pieza que aún se está forjando.',
              'Dos trazos: el más simple de los cuatro, el más fácil de reproducir en cualquier tamaño.'],
         risk='Una F es una F: hay muchas. Es la menos propia de las cuatro y la que más depende del color para contar su historia.'),
    dict(key='eslabones', fn=m_eslabones, name='Eslabones',
         idea='Dos eslabones forjados, entrelazados de verdad: uno pasa por encima y el otro por debajo.',
         why=['Cuenta lo que hace el producto: una etiqueta en tres sitios, una nota enlazada a su ticket, un archivo que hereda sus etiquetas.',
              'Una cadena es un objeto forjado, así que también habla del nombre.',
              'Dos piezas de dos colores: el equipo y su trabajo, unidos.'],
         risk='Se parece al icono genérico de «enlace» de cualquier editor. Dentro de la aplicación habría que evitar ese icono para no confundirlos.'),
    dict(key='yunque', fn=m_yunque, name='Yunque',
         idea='Un yunque geométrico con una barra al rojo encima.',
         why=['Es el símbolo de la forja por excelencia: la lectura es inmediata, como el gato de GitHub.',
              'Silueta muy clara: cuerno, tabla, cintura y pie.'],
         risk='Es la idea más obvia para algo llamado «Forge»: Minecraft Forge y CurseForge ya usan yunques. La menos propia; se incluye para descartarla con criterio.'),
]


def concept_section(i, k):
    fn = k['fn']
    sizes = ''.join(f'<div style="text-align:center">{svg(fn, s, "var(--text)")}<p class="hint" style="margin-top:6px">{s}</p></div>' for s in (16, 24, 32, 48))
    tiles = (f'<div style="text-align:center">{app_tile(fn, 72, INK, PAPER, ORANGE)}<p class="hint" style="margin-top:6px">app, tinta</p></div>'
             f'<div style="text-align:center">{app_tile(fn, 72, ORANGE, INK, PAPER)}<p class="hint" style="margin-top:6px">app, naranja</p></div>'
             f'<div style="text-align:center">{app_tile(fn, 32, INK, PAPER, ORANGE)}<p class="hint" style="margin-top:6px">favicon 32</p></div>'
             f'<div style="text-align:center">{app_tile(fn, 16, INK, PAPER, ORANGE)}<p class="hint" style="margin-top:6px">16</p></div>')
    locks = (f'<div class="lk" style="background:{PAPER};border:1px solid #CFCAC0">{lockup(fn, 30, INK, ORANGE, INK)}</div>'
             f'<div class="lk" style="background:{INK}">{lockup(fn, 30, PAPER, ORANGE, PAPER)}</div>'
             f'<div class="lk" style="background:{ORANGE}">{lockup(fn, 30, INK, PAPER, INK)}</div>'
             f'<div class="lk" style="background:{PAPER};border:1px solid #CFCAC0">{lockup(fn, 30, INK, INK, INK)}<span class="hint" style="margin-left:12px">una tinta</span></div>')
    why = ''.join(f'<li>{w}</li>' for w in k['why'])
    tag = '<span class="chip" style="border-color:var(--text);font-weight:700">Elegida</span>' if k.get('rec') else ''
    big = (f'<svg viewBox="-4 -4 72 72" width="100%" style="max-width:360px;display:block;margin:auto" role="img" aria-label="Logo {k["name"]} sobre rejilla">'
           f'<g transform="translate(0 0)">{grid_overlay()}{fn("var(--text)", ORANGE)}</g></svg>')
    return f"""<section class="site-section" id="{k['key']}">
  <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px">
    <span class="mono muted">0{i}</span><h2 style="margin:0">{k['name']}</h2>{tag}
  </div>
  <p style="font-size:var(--t-16);margin-bottom:24px;max-width:70ch">{k['idea']}</p>
  <div class="logo-row">
    <div class="panel" style="padding:28px">{big}<p class="hint" style="text-align:center;margin-top:10px">Rejilla de 64 × 64, módulo de 4</p></div>
    <div style="display:flex;flex-direction:column;gap:22px">
      <div><p class="field-label" style="margin-bottom:10px">A tamaño real</p><div class="row-sizes">{sizes}</div></div>
      <div><p class="field-label" style="margin-bottom:10px">Icono de aplicación y favicon</p><div class="row-sizes">{tiles}</div></div>
      <div><p class="field-label" style="margin-bottom:10px">Con el nombre</p><div class="locks">{locks}</div></div>
    </div>
  </div>
  <div class="row-2" style="margin-top:24px;gap:32px">
    <div><p class="field-label" style="margin-bottom:8px">Por qué funciona</p><ul class="why">{why}</ul></div>
    <div><p class="field-label" style="margin-bottom:8px">Riesgo</p><p class="muted" style="line-height:1.6">{k['risk']}</p></div>
  </div>
</section>"""


def sidebar_preview(fn):
    return (f'<div style="width:232px;border:1px solid var(--border);background:var(--bg);border-radius:var(--r)">'
            f'<div style="height:52px;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid var(--border)">'
            f'{lockup(fn, 22, "var(--text)", ORANGE, "var(--text)")}</div>'
            f'<div style="padding:10px 12px;display:flex;flex-direction:column;gap:2px;font-size:var(--t-14)">'
            f'<span style="padding:6px 10px">Inicio</span><span style="padding:6px 10px;background:var(--surface-2);font-weight:650;border-left:3px solid var(--accent)">Tablero</span>'
            f'<span style="padding:6px 10px">Notas</span></div></div>')


def tab_preview(fn):
    return (f'<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:#DEDBD4;border-radius:8px 8px 0 0;font:13px system-ui;color:#171614;width:220px">'
            f'{app_tile(fn, 16, INK, PAPER, ORANGE)}<span>Tablero · Forge OS</span></div>')


REFS = [('Claude', 'Un símbolo orgánico y cálido, sin letra, más un nombre en una tipografía con carácter.'),
        ('GitHub', 'Una silueta que se reconoce sin leer y que vive igual en una tinta, a 16 px o en una camiseta.'),
        ('Figma', 'Construcción geométrica a la vista: formas simples que encajan y cuentan qué hace el producto.'),
        ('Amplitude', 'Un monograma de un color, sin efectos, que funciona igual de pequeño que de grande.')]
refs = ''.join(f'<li><b>{n}.</b> <span class="muted">{d}</span></li>' for n, d in REFS)
take = ''.join(f'<li>{t}</li>' for t in [
    'Una sola silueta, reconocible a 16 px sin leer nada.',
    'Funciona en una tinta. El color es un añadido, no la idea.',
    'Construcción geométrica: un puñado de formas sobre una rejilla.',
    'Símbolo y nombre separables: el símbolo solo sirve como icono.',
    'Ni gradientes, ni halos, ni sombras.'])
avoid = ''.join(f'<li>{t}</li>' for t in [
    '<b>La chispa o asterisco radial</b> (el símbolo de Claude). Además de ser suyo, hoy es <i>la</i> marca visual de «producto con IA»: justo lo que quieres quitarte.',
    '<b>Una F de piezas de colores</b> (Figma). Figma ya es una F modular; cualquier F troceada en colores parecería suya.',
    '<b>Una mascota</b> (el Octocat de GitHub). Necesita ilustración de verdad para no quedar infantil, y envejece peor.',
    '<b>Letra dentro de un cuadrado con gradiente</b>, que es el logo actual y la plantilla de icono más repetida.'])
comp = ''.join(f'<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start"><p class="field-label">{k["name"]}</p>{sidebar_preview(k["fn"])}{tab_preview(k["fn"])}</div>' for k in CONCEPTS)

logo_css = """<style>
.logo-row { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 32px; align-items: start; }
.row-sizes { display: flex; gap: 22px; align-items: flex-end; flex-wrap: wrap; }
.locks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.lk { padding: 18px 20px; border-radius: var(--r); display: flex; align-items: center; }
.why { list-style: square; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; line-height: 1.55; }
.why li::marker { color: var(--accent); }
.compare { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
@media (max-width: 1000px) { .logo-row, .compare, .locks { grid-template-columns: 1fr; } }
</style>"""

logo_page = HEAD.format(title='Logo · Forge OS', favicon=FAVICON).replace('</head>', logo_css + '</head>') + f"""<body>
<div class="sheet-page">
  <header class="site-head" style="margin-bottom:40px"><a href="index.html" class="link">← Índice de la propuesta</a><nav><span class="hint">Logo · 4 propuestas</span>{THEME_BTN}</nav></header>
  <h1 class="page-title" style="font-size:clamp(2.4rem,5vw,3.6rem)">Un logo nuevo para Forge OS</h1>
  <p class="page-sub" style="max-width:72ch;font-size:var(--t-16);line-height:1.6">Cuatro símbolos dibujados desde cero, todos sobre la misma rejilla de 64 × 64. Cada uno se ve a tamaño real, como icono de aplicación y favicon, junto al nombre y en una tinta. Sustituyen al cartucho «FO» de la propuesta anterior.</p>

  <section class="site-section" style="margin-top:32px">
    <h2>Qué se toma de las marcas de referencia</h2>
    <div class="row-2" style="gap:40px">
      <div><ul class="why" style="list-style:none;padding:0;gap:10px">{refs}</ul></div>
      <div><p class="field-label" style="margin-bottom:8px">Lo que tienen en común, y lo que se toma</p><ul class="why">{take}</ul></div>
    </div>
    <div style="margin-top:28px"><p class="field-label" style="margin-bottom:8px">Lo que no se toma</p><ul class="why">{avoid}</ul></div>
  </section>

  {''.join(concept_section(i + 1, k) for i, k in enumerate(CONCEPTS))}

  <section class="site-section">
    <h2>En contexto</h2>
    <p class="muted" style="margin-bottom:20px;max-width:70ch">Barra lateral de la aplicación y pestaña del navegador. Es donde más se va a ver el logo, y donde se decide si funciona.</p>
    <div class="compare">{comp}</div>
  </section>

  <section class="site-section">
    <h2>Elegida: Fragua</h2>
    <div style="max-width:72ch;line-height:1.65;display:flex;flex-direction:column;gap:12px">
      <p><b>Elegida el 19 de octubre de 2026</b> y aplicada ya a todas las maquetas. Era la recomendada: es la única de las cuatro que es propia por partida doble: habla del nombre (la fragua) y del producto (el sitio donde está el trabajo del equipo), y su silueta de arco no se parece a la de ningún producto cercano. «Hierro al rojo» es la alternativa si prefieres un monograma; «Eslabones» cuenta mejor qué hace el producto pero choca con el icono de enlace; «Yunque» queda descartado por ser lo que ya usan otros «Forge».</p>
      <p class="muted">Antes de adoptarla conviene una búsqueda de marcas registradas en la clase 9 (software) y 42 (servicios informáticos) con «Forge» y un arco o una llama. No la he hecho: este documento propone formas, no garantiza que estén libres.</p>
    </div>
  </section>
</div>
</body>
</html>
"""
write('logo.html', logo_page)
print('logo ok')
