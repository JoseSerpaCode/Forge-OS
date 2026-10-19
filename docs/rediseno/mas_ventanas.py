# Se ejecuta desde generar.py (después de mas_sistema.py): ventanas, menús y avisos.

def modal(id_, title, body, foot, lead='', w=560):
    l = f'<p class="modal-lead">{lead}</p>' if lead else ''
    return (f'<div class="modal" role="dialog" aria-labelledby="{id_}-t" style="width:min(100%,{w}px)">'
            f'<div class="modal-head"><h3 id="{id_}-t">{title}</h3>'
            f'<button class="btn btn-ghost btn-icon" type="button" aria-label="Cerrar">{icon("x")}</button></div>'
            f'{l}<div class="modal-body">{body}</div><div class="modal-foot">{foot}</div></div>')


def fl(label, ctl, hint='', opt=False):
    o = ' <span class="muted" style="font-weight:500">· opcional</span>' if opt else ''
    h = f'<span class="hint">{hint}</span>' if hint else ''
    return f'<div class="field"><span class="field-label">{label}{o}</span>{ctl}{h}</div>'


def inp(v, cls='', ph=False):
    v = f'<span class="placeholder">{v}</span>' if ph else v
    return f'<span class="input {cls}">{v}</span>'


def sel(v, cls=''):
    return f'<span class="select {cls}">{v}</span>'


def who(n, full=None):
    return f'<span style="display:inline-flex;gap:8px;align-items:center"><span class="avatar p-{n}">{n[:2]}</span>{full or n}</span>'


def typed(n):
    return f'<span style="display:inline-flex;gap:8px;align-items:center"><span class="sw" style="--c:{TYPES[n]}"></span>{n}</span>'


def foot(primary, secondary='Cancelar', left='', danger=False):
    l = f'<span class="left">{left}</span>' if left else ''
    p = 'btn-danger-solid' if danger else 'btn-primary'
    return f'{l}<button class="btn btn-secondary" type="button">{secondary}</button><button class="btn {p}" type="button">{primary}</button>'


def layer(id_, n, name, note, content, col=False):
    c = ' stage-col' if col else ''
    return (f'<section class="stage-row" id="{id_}"><h2><span class="mono muted">{n:02d}</span> {name}</h2>'
            f'<p>{note}</p><div class="stage{c}">{content}</div></section>')


L = []

# 01 · Nuevo ticket
L.append(('nuevo-ticket', 'Nuevo ticket', 'Se abre con C desde cualquier pantalla del espacio. Solo el título es obligatorio; el resto tiene un valor por defecto razonable.', modal('nt', 'Nuevo ticket',
    fl('Título', inp('Exportar el burndown a CSV<span class="caret"></span>', 'is-focus'))
    + f'<div class="row-3">{fl("Tipo", sel(typed("Historia")))}{fl("Estado", sel(status_badge("todo")))}{fl("Puntos", inp("3"), opt=True)}</div>'
    + f'<div class="row-2">{fl("Responsable", sel(who("noor")))}{fl("Vence", inp("dd/mm/aaaa", ph=True), opt=True)}</div>'
    + fl('Etiquetas', f'<div class="toolbar-group">{chip("Facturación")}{chip("Q4")}<button class="btn btn-ghost btn-sm" type="button">{icon("plus")}Añadir</button></div>')
    + fl('Descripción', '<span class="textarea" style="min-height:84px"><span class="placeholder">Qué hay que hacer y cómo se sabe que está hecho.</span></span>', opt=True),
    foot('Crear ticket <kbd>⌘ ↵</kbd>', left=f'<span class="check"><span class="box"></span>Crear otro</span>'))))

# 02 · Nuevo sprint
L.append(('nuevo-sprint', 'Nuevo sprint', 'Dos semanas por defecto, empezando el día siguiente al cierre del anterior.', modal('ns', 'Nuevo sprint',
    fl('Nombre', inp('Sprint 15 — Formularios públicos'))
    + fl('Objetivo', '<span class="textarea">Publicar los formularios y que las respuestas lleguen a una tabla.</span>', 'Sale en el panel y en la cabecera del tablero.', opt=True)
    + f'<div class="row-2">{fl("Empieza", inp("24/10/2026"))}{fl("Termina", inp("06/11/2026"))}</div>'
    + '<p class="hint">Las fechas usan la zona horaria del espacio: Bogotá (UTC−5). El sprint termina a las 23:59 del último día.</p>',
    foot('Crear sprint'), w=520)))

# 03 · Cerrar sprint
left3 = ''.join(f'<li><span class="sw" style="--c:var(--st-{s})"></span>{t}<span class="push muted">{p} pts</span></li>' for t, s, p in
                [('Facturación por uso', 'progress', 13), ('Búsqueda de texto completo en páginas', 'todo', 5), ('La subida de avatar rechaza PNG válidos', 'review', 2)])
L.append(('cerrar-sprint', 'Cerrar sprint', 'Lo que importa es qué pasa con lo que queda. La ventana lo pregunta una vez y enseña qué tickets son.', modal('cs', 'Cerrar el sprint 14',
    '<div class="figures" style="margin:0"><div><b class="wide fig">9</b><span class="hint">tickets hechos</span></div><div><b class="wide fig">28</b><span class="hint">puntos cerrados</span></div><div><b class="wide fig">3</b><span class="hint">sin terminar</span></div></div>'
    + f'<ul class="mini-list">{left3}</ul>'
    + '<p class="field-label">¿Qué pasa con los 3 sin terminar?</p>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + '<div class="option-card on"><span class="radio on"></span><div><strong>Pasarlos al sprint 15</strong><span class="hint">Se crea si no existe. Conservan su estado y su tiempo registrado.</span></div></div>'
    + '<div class="option-card"><span class="radio"></span><div><strong>Devolverlos a la pila</strong><span class="hint">Se quedan sin sprint hasta que alguien los planifique.</span></div></div></div>',
    foot('Cerrar sprint'), lead='«Facturación y búsqueda» termina hoy, 23 oct.', w=540)))

# 04 · Registrar tiempo
L.append(('registrar-tiempo', 'Registrar tiempo', 'Para lo que no se cronometró. Entiende las formas habituales de escribir una duración.', modal('rt', 'Registrar tiempo',
    f'<div class="toolbar-group">{"".join(f"<button class=\"btn btn-secondary btn-sm\" type=\"button\">{d}</button>" for d in ("15 min", "30 min", "1 h", "2 h"))}</div>'
    + fl('Duración', inp('1 h 30 min<span class="caret"></span>', 'is-focus'), 'También vale 1,5 h, 90 min o 1:30.')
    + f'<div class="row-2">{fl("Día", sel("Hoy, 19 oct"))}{fl("Quién", sel(who("blake")))}</div>'
    + fl('Nota', inp('En qué se fue el tiempo', ph=True), opt=True),
    foot('Registrar 1 h 30 min'), lead='En «Generar facturas en PDF» · 6 h de 16 h estimadas.', w=460)))

# 05 · Menú del sprint
L.append(('menu-sprint', 'Menú del sprint', 'Lo que se hace con un sprint, en el botón «Sprint» del tablero.',
    f"""<div class="anchor"><button class="btn btn-secondary is-active" type="button" aria-expanded="true">{icon('flag')}Sprint 14 {icon('chev-down')}</button>
  <div class="menu" role="menu" aria-label="Sprint 14" style="width:300px">
    <span class="menu-label">Sprint 14 — Facturación y búsqueda</span>
    <span class="menu-item" role="menuitem">{icon('edit')}Editar nombre y fechas</span>
    <span class="menu-item on" role="menuitem">{icon('check')}Cerrar sprint…</span>
    <span class="menu-item" role="menuitem">{icon('plus')}Planificar el siguiente</span>
    <span class="menu-sep" role="separator"></span>
    <span class="menu-item" role="menuitem">{icon('chart')}Ver el burndown</span>
    <span class="menu-item" role="menuitem">{icon('download')}Exportar a CSV</span>
    <span class="menu-sep" role="separator"></span>
    <span class="menu-item danger" role="menuitem">{icon('trash')}Borrar sprint…</span>
  </div></div>"""))

# 06 · Nueva tabla
COLS = [('Equipo', 'Texto', 'título'), ('Número de serie', 'Texto', ''), ('Estado', 'Selección', ''),
        ('Responsable', 'Persona', ''), ('Comprado', 'Fecha', ''), ('Factura', 'Archivo', '')]
colrows = ''.join(
    f'<div class="colrow"><span class="grip" aria-hidden="true">{icon("grip")}</span>'
    f'<span class="input{" is-focus" if i == 2 else ""}">{n}</span><span class="select" aria-label="Tipo de {n}">{t}</span>'
    + (f'<span class="hint" style="white-space:nowrap">{x}</span>' if x else f'<button class="btn btn-ghost btn-icon btn-sm" type="button" aria-label="Quitar la columna {n}">{icon("x")}</button>')
    + '</div>'
    + (f'<div class="opts">{"".join(f"<span class=\"chip\" style=\"--c:{c}\"><span class=\"sw\"></span>{o}</span>" for o, c in (("Disponible", "#4D7C0F"), ("Prestado", "#0E7490"), ("En reparación", "#A16207")))}<button class="btn btn-ghost btn-sm" type="button">{icon("plus")}Opción</button></div>' if t == 'Selección' else '')
    for i, (n, t, x) in enumerate(COLS))
L.append(('nueva-tabla', 'Nueva tabla', 'El constructor de columnas. Cada columna tiene nombre y tipo; las de selección definen sus opciones aquí mismo. Se reordenan arrastrando el asa o con Alt + flechas.', modal('ntb', 'Nueva tabla',
    fl('Nombre', inp('Inventario de equipos'))
    + f'<div><p class="field-label" style="margin-bottom:8px">Columnas</p><div class="colrows">{colrows}</div>'
    + f'<button class="btn btn-ghost btn-sm" type="button" style="margin-top:8px">{icon("plus")}Añadir columna</button></div>',
    foot('Crear tabla'), w=640)))

# 07 · Nueva fila
L.append(('nueva-fila', 'Nueva fila', 'El formulario sale de las columnas de la tabla: cada tipo, su campo.', modal('nf', 'Nueva fila',
    fl('Empresa', inp('Librería Cervantes<span class="caret"></span>', 'is-focus'))
    + f'<div class="row-2">{fl("Contacto", inp("Nombre y apellido", ph=True))}{fl("Etapa", sel("<span class=\"status\" style=\"--c:#5F6B7A;height:22px\"><span class=\"sw\"></span>Contacto</span>"))}</div>'
    + fl('Valor', f'<span class="input" style="justify-content:space-between"><span>1.200</span><span class="muted">€</span></span>', opt=True)
    + fl('Propuesta', f'<span class="dropzone">{icon("upload")}<span><b>Arrastra un archivo</b> o elige uno. Se guarda en el Drive del espacio.</span></span>', opt=True),
    foot('Añadir fila', left='<span class="check"><span class="box on"></span>Añadir otra</span>'), lead='En «Contactos comerciales».', w=520)))

# 08 · Confirmación de borrado
L.append(('borrar', 'Confirmar un borrado', 'Dice qué se pierde y qué se queda. El foco empieza en «Cancelar»: Intro por costumbre no borra nada. Para borrar un espacio entero se pide además escribir su identificador (ver <a class="link" href="ajustes-espacio.html#borrar">Ajustes del espacio</a>).', modal('del', '¿Borrar «Generar facturas en PDF»?',
    '<ul class="why"><li>Se borran el ticket, su descripción y sus <b>6 h registradas</b>: las métricas del sprint 14 bajan.</li><li>Las <b>2 notas enlazadas</b> se quedan; pierden el enlace.</li><li>No se puede deshacer.</li></ul>',
    '<button class="btn btn-secondary is-focus" type="button">Cancelar</button><button class="btn btn-danger-solid" type="button">Borrar ticket</button>', w=480)))

# 09 · Nuevo espacio
L.append(('nuevo-espacio', 'Nuevo espacio', 'Un espacio es un equipo: su tablero, sus notas, sus tablas y sus archivos. Quien lo crea queda con la propiedad.', modal('ne', 'Nuevo espacio',
    fl('Nombre', inp('Semillero de robótica'))
    + fl('Identificador', '<span class="input mono">#semillero-robotica</span>', 'Sale del nombre. Va en los enlaces y no se cambia después.')
    + fl('Descripción', '<span class="textarea"><span class="placeholder">Para qué es este espacio.</span></span>', opt=True)
    + fl('Zona horaria', sel('America/Bogota (UTC−5)'), 'Marca cuándo empieza y termina cada día: vencimientos y burndown.'),
    foot('Crear espacio'), w=520)))

# 10 · Añadir miembro
PEOPLE = [('noor', 'Noor Haddad', '@noor', 'on', ''), ('nora', 'Nora Ibáñez', '@nora', '', ''), ('noel', 'Noel Vidal', '@noel', 'dis', 'Ya es miembro')]
prow = ''.join(f'<div class="person-row {s}"><span class="avatar avatar-lg p-{"noor" if n == "noor" else "blake" if n == "nora" else "avery"}">{n[:2]}</span><span><b>{f}</b><span class="hint" style="display:block">{h}{" · " + x if x else ""}</span></span>'
               + (f'<span class="push">{icon("check")}</span>' if s == 'on' else '') + '</div>' for n, f, h, s, x in PEOPLE)
L.append(('anadir-miembro', 'Añadir miembro', 'Busca por nombre o usuario. El rol se explica en una línea: nadie tiene que adivinar qué puede hacer «Administración».', modal('am', 'Añadir a Atlas Platform',
    fl('Persona', f'<span class="input is-focus">{icon("search")}<span>no<span class="caret"></span></span></span>', 'Los invitados solo aparecen si escribes su usuario completo.')
    + f'<div class="people-list">{prow}</div>'
    + '<p class="field-label">Rol</p><div style="display:flex;flex-direction:column;gap:8px">'
    + '<div class="option-card on"><span class="radio on"></span><div><strong>Miembro</strong><span class="hint">Crea y mueve tickets, escribe notas, sube archivos.</span></div></div>'
    + '<div class="option-card"><span class="radio"></span><div><strong>Administración</strong><span class="hint">Además gestiona miembros, etiquetas, automatizaciones y Drive.</span></div></div>'
    + '<div class="option-card"><span class="radio"></span><div><strong>Invitado</strong><span class="hint">Ve y comenta. No sale en la búsqueda de personas ni recibe solicitudes.</span></div></div></div>',
    foot('Añadir a noor'), w=520)))

# 11 · Automatización
L.append(('automatizacion', 'Automatización', 'Una regla se escribe como una frase: cuando pasa esto, haz aquello. Los huecos son selectores.', modal('au', 'Nueva regla',
    f'<div class="rule"><div class="rule-line"><span class="kw">Cuando</span>{sel("un ticket cambia de estado", "select-inline")}<span class="kw">a</span>{sel(status_badge("done"), "select-inline")}</div>'
    f'<div class="rule-line"><span class="kw">entonces</span>{sel("parar su temporizador", "select-inline")}</div>'
    f'<div class="rule-line"><span class="kw">y</span>{sel("avisar a", "select-inline")}{sel("quien lo informó", "select-inline")}<button class="btn btn-ghost btn-icon btn-sm" type="button" aria-label="Quitar esta acción">{icon("x")}</button></div>'
    f'<button class="btn btn-ghost btn-sm" type="button" style="align-self:flex-start">{icon("plus")}Añadir acción</button></div>'
    '<p class="hint">Se aplica desde ahora; no toca los tickets que ya están en «Hecho».</p>',
    foot('Guardar regla', left='<span class="check"><span class="toggle on"></span>Activa</span>'), w=620)))

# 12 · Paleta de órdenes
hl = lambda s: s.replace('Fact', '<b class="hit">Fact</b>').replace('fact', '<b class="hit">fact</b>')
L.append(('paleta', 'Paleta de órdenes', 'Con ⌘ K o /. Busca en el espacio actual; Tab cambia a todos tus espacios. Mezcla resultados y acciones, con el atajo de cada acción a la vista para que se aprenda.',
    f"""<div class="modal cmdk" role="dialog" aria-label="Buscar o ejecutar una orden">
  <div class="cmdk-input">{icon('search')}<span>fact<span class="caret"></span></span><span class="push hint" style="margin-left:auto">Atlas Platform</span></div>
  <div class="cmdk-list" role="listbox" aria-label="Resultados">
    <span class="menu-label">Tickets</span>
    <span class="menu-item on" role="option" aria-selected="true"><span class="sw" style="--c:var(--st-progress)"></span><span>{hl('Generar facturas en PDF')}</span><span class="push hint">En curso · blake</span></span>
    <span class="menu-item" role="option" aria-selected="false"><span class="sw" style="--c:var(--st-progress)"></span><span>{hl('Facturación por uso')}</span><span class="push hint">En curso · avery</span></span>
    <span class="menu-label">Notas</span>
    <span class="menu-item" role="option" aria-selected="false">{icon('note')}<span>Acta del sprint 14 <span class="hint" style="display:block">…la {hl('fact')}ura sale con el periodo y el desglose…</span></span></span>
    <span class="menu-label">Acciones</span>
    <span class="menu-item" role="option" aria-selected="false">{icon('plus')}Nuevo ticket<kbd>C</kbd></span>
    <span class="menu-item" role="option" aria-selected="false">{icon('clock')}Registrar tiempo<kbd>T</kbd></span>
    <span class="menu-item" role="option" aria-selected="false">{icon('chart')}Ir a Métricas<kbd>G M</kbd></span>
  </div>
  <div class="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> moverse</span><span><kbd>↵</kbd> abrir</span><span><kbd>Tab</kbd> todos los espacios</span><span style="margin-left:auto"><kbd>Esc</kbd> cerrar</span></div>
</div>"""))

# 13 · Notificaciones
NOTIF = [(True, 'blake', 'te mencionó en <b>Acta del sprint 14</b>: «@avery ¿cerramos facturación el jueves?»', 'hace 4 min'),
         (True, 'noor', 'te asignó <b>La búsqueda pierde resultados después de la página 3</b>', 'hace 1 h'),
         (False, 'blake', 'movió <b>Selector de plan en ajustes</b> a En revisión', 'hace 3 h'),
         (False, 'noor', 'te invitó a <b>Semillero de robótica</b>', 'ayer')]
nitems = ''.join(f'<div class="notif-item{" unread" if u else ""}"><span class="avatar p-{w}">{w[:2]}</span><div><b>{w}</b> {t}<span class="hint" style="display:block">{h}{" · sin leer" if u else ""}</span></div></div>' for u, w, t, h in NOTIF)
L.append(('notificaciones', 'Notificaciones', 'Lo sin leer lleva fondo y punto, no solo negrita. El número de la campana cuenta solo lo que te nombra a ti: menciones, asignaciones e invitaciones.',
    f"""<div class="anchor" style="align-items:flex-end"><button class="btn btn-ghost btn-icon is-active" type="button" aria-expanded="true" aria-label="Notificaciones: 2 sin leer" style="position:relative">{icon('bell')}<span class="count-pill" style="position:absolute;top:-6px;right:-8px">2</span></button>
  <div class="menu notif" role="dialog" aria-labelledby="nt-h">
    <div class="notif-head"><h3 id="nt-h">Notificaciones</h3><a class="link" href="#notificaciones" style="font-size:var(--t-13)">Marcar todo como leído</a></div>
    <div style="padding:0 16px 12px">{segmented(['Todas', 'Menciones', 'Asignaciones'], 0, 'Filtrar notificaciones')}</div>
    {nitems}
    <div class="notif-foot"><a class="link" href="ajustes.html#notificaciones">Elegir qué avisos recibo</a></div>
  </div></div>"""))

# 14 · Selector de etiquetas
pick = ''.join(f'<span class="menu-item" role="menuitemcheckbox" aria-checked="{"true" if l in ("Facturación", "Q4") else "false"}"><span class="check"><span class="box{" on" if l in ("Facturación", "Q4") else ""}"></span></span>{chip(l)}<span class="push hint">{n}</span></span>'
               for l, n in [('Facturación', 12), ('Q4', 9), ('Búsqueda', 7), ('Interfaz', 6), ('API', 4), ('Incorporación', 2)])
SW12 = ['#B42318', '#9A3412', '#A16207', '#4D7C0F', '#266B2A', '#0E7490', '#1E5AA8', '#334155', '#6D28D9', '#A23B72', '#5F6B7A', '#171614']
swatch = ''.join(f'<i style="--c:{c}"{" class=\"on\"" if c == "#0E7490" else ""}></i>' for c in SW12)
L.append(('etiquetas', 'Selector de etiquetas', 'Las mismas etiquetas valen para tickets, notas y archivos. Si lo que escribes no existe, la última línea lo crea; el color se elige de 12 ya probados.',
    f"""<div class="anchor"><div class="toolbar-group">{chip('Facturación')}{chip('Q4')}<button class="btn btn-ghost btn-sm is-active" type="button" aria-expanded="true">{icon('plus')}Añadir</button></div>
  <div class="menu" role="menu" aria-label="Etiquetas" style="width:300px">
    <span class="input is-focus" style="margin:4px 4px 8px;width:auto">{icon('search')}<span class="placeholder">Buscar o crear</span></span>
    {pick}
    <span class="menu-sep" role="separator"></span>
    <a class="menu-item" href="ajustes-espacio.html#etiquetas" role="menuitem">{icon('settings')}Gestionar etiquetas</a>
  </div></div>
<div class="anchor"><div class="toolbar-group"><span class="hint">Al escribir algo nuevo</span></div>
  <div class="menu" role="menu" aria-label="Crear etiqueta" style="width:300px">
    <span class="input is-focus" style="margin:4px 4px 8px;width:auto">{icon('search')}<span>Pagos<span class="caret"></span></span></span>
    <span class="menu-label">Sin resultados</span>
    <span class="menu-item on" role="menuitem">{icon('plus')}Crear «Pagos»</span>
    <div style="padding:6px 10px 10px"><p class="hint" style="margin-bottom:8px">Color</p><div class="swatches-row">{swatch}</div></div>
  </div></div>"""))

# 15 · Cambio de espacio
SPACES = [('Atlas Platform', '#atlas', 'Administración', True), ('Tesis — Grupo 4', '#tesis-g4', 'Miembro', False), ('Laboratorio de redes', '#redes-lab', 'Propiedad', False)]
spitems = ''.join(f'<span class="menu-item{" on" if c else ""}" role="menuitemradio" aria-checked="{"true" if c else "false"}"><span><b style="font-weight:650">{n}</b><span class="hint" style="display:block"><span class="mono">{t}</span> · {r}</span></span><span class="push">{icon("check") if c else f"<kbd>⌘ {i + 1}</kbd>"}</span></span>' for i, (n, t, r, c) in enumerate(SPACES))
L.append(('espacios', 'Cambiar de espacio', 'Desde el selector de la barra lateral. Cada espacio con su identificador y tu rol, y un atajo para saltar sin abrir el menú.',
    f"""<div class="anchor" style="width:260px"><span class="ws-switch is-open" style="margin:0"><span><strong>Atlas Platform</strong><span class="mono">#atlas</span></span></span>
  <div class="menu" role="menu" aria-label="Tus espacios" style="width:300px">
    <span class="menu-label">Tus espacios</span>
    {spitems}
    <span class="menu-sep" role="separator"></span>
    <span class="menu-item" role="menuitem">{icon('plus')}Crear espacio</span>
    <a class="menu-item" role="menuitem" href="inicio.html">{icon('home')}Ver todos en Inicio</a>
  </div></div>"""))

# 16 · Avisos
L.append(('avisos', 'Avisos', 'Abajo a la izquierda en el escritorio; encima de la barra inferior en el móvil. Duran 5 segundos y se pausan al pasar el ratón. Los errores no se van solos y se anuncian como alerta; el resto, con aria-live educado.',
    f"""<div class="toast">{icon('check')}Movido a «Hecho». El temporizador se paró.<span class="act">Deshacer</span></div>
<div class="toast">{icon('clock')}1 h 30 min en «Generar facturas en PDF».</div>
<div class="toast">{icon('link')}Enlace copiado.</div>
<div class="toast err" role="alert">{icon('alert')}No se pudo mover el ticket. Volvió a «En curso».<span class="act">Reintentar</span></div>""", ))

# 17 · Adjuntar desde el espacio
DRV = [('PDF', 'factura-plantilla.pdf', 'Ya está en este ticket', 'dis'), ('PDF', 'factura-agosto-ferreteria.pdf', 'blake · 2 sep · 180 KB', 'on'),
       ('PDF', 'contrato-borrador.pdf', 'avery · 28 ago · 1,2 MB', ''), ('CSV', 'facturas-2026.csv', 'noor · 3 oct · 46 KB', '')]
drv = ''.join(f'<span class="menu-item{" on" if st == "on" else ""}{" muted" if st == "dis" else ""}" role="option" aria-selected="{"true" if st == "on" else "false"}"{" aria-disabled=\"true\"" if st == "dis" else ""}><span class="file-kind">{k}</span><span>{n}<small class="hint" style="display:block">{d}</small></span>{"<span class=\"push\">" + icon("check") + "</span>" if st == "dis" else ""}</span>' for k, n, d, st in DRV)
L.append(('adjuntar', 'Adjuntar desde el espacio', 'Desde «Archivos» del ticket. Busca en lo que el espacio ya tiene en Drive; al adjuntar, el archivo hereda las etiquetas del ticket. Lo que ya está adjunto aparece, pero no se puede elegir otra vez.',
    f"""<div class="anchor"><div class="toolbar-group"><button class="btn btn-secondary btn-sm" type="button">{icon('upload')}Subir</button><button class="btn btn-secondary btn-sm is-active" type="button" aria-expanded="true">{icon('cloud')}Elegir del espacio</button></div>
  <div class="menu" role="dialog" aria-label="Archivos del espacio" style="width:340px">
    <span class="input is-focus" style="margin:4px 4px 8px;width:auto">{icon('search')}<span>factura<span class="caret"></span></span></span>
    <div role="listbox" aria-label="Archivos que coinciden" style="display:flex;flex-direction:column">{drv}</div>
    <span class="menu-sep" role="separator"></span>
    <p class="hint" style="padding:4px 10px 6px;line-height:1.5">Se adjuntará con {chip('Facturación')} {chip('Q4')}</p>
  </div></div>"""))

nav = ''.join(f'<a href="#{i}">{n:02d} · {t}</a>' for n, (i, t, *_r) in enumerate(L, 1))
rows = ''.join(layer(i, n, t, d, c, col=(i == 'avisos')) for n, (i, t, d, c) in enumerate(L, 1))

VENT_CSS = """<style>
.stage-row > h2 { font-size: var(--t-26); font-weight: 800; font-stretch: var(--narrow-x); line-height: 1; }
.stage-row > p { color: var(--muted); font-size: var(--t-14); max-width: 72ch; line-height: 1.55; margin-bottom: 10px; }
.stage-col { flex-direction: column; align-items: flex-start; }
.anchor { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.caret { display: inline-block; width: 1.5px; height: 1.1em; background: var(--text); vertical-align: -0.18em; margin-left: 1px; }
.mini-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; }
.mini-list li { display: flex; gap: 10px; align-items: center; padding: 9px 12px; font-size: var(--t-13); }
.mini-list li + li { border-top: 1px solid var(--border); }
.mini-list .push { margin-left: auto; }
.colrows { display: flex; flex-direction: column; gap: 6px; }
.colrow { display: grid; grid-template-columns: 20px minmax(0, 1fr) 150px 64px; gap: 8px; align-items: center; }
.colrow .grip { color: var(--muted); display: grid; place-items: center; }
.colrow > :last-child { justify-self: start; }
.opts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 2px 0 8px 28px; }
.dropzone { display: flex; gap: 12px; align-items: center; padding: 16px; border: 1.5px dashed var(--border-strong); border-radius: 14px; font-size: var(--t-13); color: var(--muted); }
.dropzone b { color: var(--text); }
.people-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; margin-top: -6px; }
.person-row { display: flex; gap: 12px; align-items: center; padding: 10px 12px; font-size: var(--t-14); }
.person-row + .person-row { border-top: 1px solid var(--border); }
.person-row.on { background: var(--surface-2); }
.person-row.dis { color: var(--muted); }
.person-row .push { margin-left: auto; }
.rule { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg); }
.rule-line { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rule .kw { font-weight: 750; }
.rule-line > .kw:first-child { min-width: 64px; }
.cmdk-list { padding: 6px; display: flex; flex-direction: column; }
.cmdk-list .menu-item .push { margin-left: auto; }
.hit { font-weight: 750; text-decoration: underline; text-decoration-color: var(--accent); text-decoration-thickness: 2px; text-underline-offset: 3px; }
.notif-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 14px 16px 10px; }
.notif-head h3 { font-size: var(--t-20); font-weight: 800; font-stretch: var(--narrow-x); }
.notif-foot { padding: 12px 16px; border-top: 1px solid var(--border); font-size: var(--t-13); }
.ws-switch.is-open { border-color: var(--border-strong); background: var(--surface-1); width: 100%; }
@media (max-width: 820px) { .colrow { grid-template-columns: 20px minmax(0, 1fr) 110px 36px; } .colrow .hint { display: none; } }
</style>"""

ventanas = sheet('Ventanas y capas', 'Ventanas, menús, paneles y avisos', 'Ventanas, menús y avisos',
    'Todo lo que se abre encima de una pantalla. Una sola forma de ventana: título estrecho, cuerpo, pie con la acción principal a la derecha. Esc cierra todas; el foco vuelve al botón que la abrió.',
    f'<nav class="gallery-nav" aria-label="Capas">{nav}</nav>{rows}', css=VENT_CSS)
write('ventanas.html', ventanas)
print('ventanas ok')
