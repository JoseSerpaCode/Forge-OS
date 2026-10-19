# Se ejecuta desde generar.py (después de mas_ventanas.py): pantallas que faltaban.

def toggle(on, label, hint=''):
    h = f'<span class="hint" style="display:block">{hint}</span>' if hint else ''
    return f'<span class="check"><span class="toggle{" on" if on else ""}"></span><span>{label}{h}</span></span>'


def more_btn(what):
    return f'<button class="btn btn-ghost btn-icon btn-sm" type="button" aria-label="Más acciones para {what}">{icon("more")}</button>'


# ── Ajustes del espacio ─────────────────────────────────────────────────────
MEMBERS = [('avery', 'Avery Collins', 'Propiedad', '3 oct 2025', 'tú'), ('blake', 'Blake Moreno', 'Administración', '3 oct 2025', ''),
           ('noor', 'Noor Haddad', 'Miembro', '12 ene 2026', ''), ('kai', 'Kai Ortega', 'Invitado', '2 oct 2026', '')]
mrows = ''.join(
    f'<tr><td><span style="display:flex;gap:10px;align-items:center"><span class="avatar avatar-lg p-{"blake" if n == "kai" else n}">{n[:2]}</span><span><b>{f}</b>{" <span class=\"hint\">(" + y + ")</span>" if y else ""}<span class="hint" style="display:block">@{n}</span></span></span></td>'
    f'<td>{"<span class=\"select select-inline is-disabled\" aria-label=\"Rol de " + n + "\">" + r + "</span>" if y else "<span class=\"select select-inline\" aria-label=\"Rol de " + n + "\">" + r + "</span>"}</td>'
    f'<td class="muted">{d}</td><td class="num">{"" if y else more_btn(n)}</td></tr>' for n, f, r, d, y in MEMBERS)
type_rows = ''.join(
    f'<li><span class="grip" aria-hidden="true">{icon("grip")}</span><span class="sw" style="--c:{c};width:12px;height:12px"></span><b>{t}</b><span class="muted">{n} tickets</span>'
    f'<span class="push"><button class="btn btn-ghost btn-sm" type="button">{icon("edit")}Editar</button></span></li>'
    for (t, c), n in zip(TYPES.items(), (21, 34, 9, 3)))
LBL_USE = {'Búsqueda': (7, 2, 0), 'Facturación': (12, 3, 4), 'Interfaz': (6, 0, 1), 'Incorporación': (2, 4, 0), 'API': (4, 1, 0), 'Q4': (9, 0, 0)}
lbl_rows = []
for l, (t, p, a) in LBL_USE.items():
    if l == 'Facturación':
        sw12 = ''.join(f'<i style="--c:{c}"{" class=\"on\"" if c == "#9A3412" else ""}></i>' for c in SW12)
        lbl_rows.append(f'<li class="editing"><div style="display:flex;flex-direction:column;gap:12px;width:100%">'
                        f'<div class="row-2" style="align-items:end"><div class="field"><span class="field-label">Nombre</span><span class="input is-focus">Facturación<span class="caret"></span></span></div>'
                        f'<div class="field"><span class="field-label">Vista previa</span><span style="display:flex;gap:8px;align-items:center;height:36px">{chip("Facturación")}</span></div></div>'
                        f'<div class="field"><span class="field-label">Color</span><div class="swatches-row">{sw12}</div></div>'
                        f'<div class="toolbar-group"><button class="btn btn-primary btn-sm" type="button">Guardar</button><button class="btn btn-ghost btn-sm" type="button">Cancelar</button>'
                        f'<button class="btn btn-ghost btn-sm" type="button" style="margin-left:auto;color:var(--danger)">{icon("trash")}Borrar etiqueta…</button></div></div></li>')
    else:
        pl = lambda n, w: f'{n} {w}' + ('' if n == 1 else 's')
        uses = ' · '.join(x for x in (pl(t, 'ticket') if t else '', pl(p, 'nota') if p else '', pl(a, 'archivo') if a else '') if x)
        lbl_rows.append(f'<li>{chip(l)}<span class="muted">{uses}</span><span class="push"><button class="btn btn-ghost btn-sm" type="button">{icon("edit")}Editar</button></span></li>')
RULES_A = [(True, f'Cuando un ticket pasa a {status_badge("done")}, <b>parar su temporizador</b>.', 'Viene activada. Corrió 41 veces este mes.'),
           (True, 'Cuando se crea un ticket, <b>avisar en el canal general</b>.', 'Corrió 18 veces este mes.'),
           (False, f'Cuando un ticket vence sin estar en {status_badge("done")}, <b>avisar a su responsable</b>.', 'Desactivada por avery el 2 oct.')]
rule_rows = ''.join(f'<li><span class="toggle{" on" if on else ""}" role="img" aria-label="{"Activa" if on else "Desactivada"}"></span><div style="flex:1;min-width:0"><p class="rule-text">{t}</p><span class="hint">{h}</span></div>{more_btn("esta regla")}</li>' for on, t, h in RULES_A)

ajustes_esp = f"""<div class="page">
  <div class="page-head">
    <div><h1 class="page-title">Ajustes del espacio</h1><p class="page-sub">Atlas Platform · <span class="mono">#atlas</span> · tienes rol de administración</p></div>
  </div>
  <div class="settings">
    <nav class="subnav" aria-label="Secciones de ajustes del espacio">
      <a href="#general" aria-current="page">General</a><a href="#miembros">Miembros <span class="count">4</span></a><a href="#solicitudes">Invitaciones <span class="count">2</span></a><a href="#tipos">Tipos de ticket</a><a href="#etiquetas">Etiquetas</a><a href="#automatizaciones">Automatizaciones</a><a href="#drive">Drive</a><a href="#borrar" class="danger">Borrar el espacio</a>
    </nav>
    <div>
      <section class="form-section" id="general">
        <header><h2>General</h2><p>Nombre, identificador y la zona horaria con la que se cuentan los días.</p></header>
        <div class="row-2"><div class="field"><span class="field-label">Nombre</span><span class="input">Atlas Platform</span></div>
          <div class="field"><span class="field-label">Identificador</span><span class="input is-disabled mono">#atlas</span><span class="hint">Va en los enlaces; no se puede cambiar.</span></div></div>
        <div class="field"><span class="field-label">Descripción <span class="muted" style="font-weight:500">· opcional</span></span><span class="textarea">Producto principal: facturación, búsqueda e incorporación de clientes.</span></div>
        <div class="field" style="max-width:420px"><span class="field-label">Zona horaria</span><span class="select">America/Bogota (UTC−5)</span><span class="hint">Decide cuándo vence «hoy» y cuándo se guarda la foto diaria del burndown.</span></div>
        {toggle(False, 'Espacio público', 'Cualquiera puede ver su nombre y pedir entrar. El contenido sigue siendo solo para miembros.')}
        <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-primary" type="button">Guardar cambios</button></div>
      </section>
      <section class="form-section" id="miembros">
        <header class="head-row"><div><h2>Miembros</h2><p>4 personas. Solo quien tiene la propiedad puede cederla.</p></div><a class="btn btn-secondary" href="ventanas.html#anadir-miembro">{icon('plus')}Añadir miembro</a></header>
        <div class="panel"><table class="table"><thead><tr><th>Persona</th><th>Rol</th><th>Desde</th><th class="num"><span class="sr-only">Acciones</span></th></tr></thead><tbody>{mrows}</tbody></table></div>
      </section>
      <section class="form-section" id="solicitudes">
        <header><h2>Invitaciones y solicitudes</h2><p>Quien pide entrar y a quien se ha invitado.</p></header>
        <div class="panel"><ul class="rows">
          <li><span class="avatar avatar-lg p-noor">rí</span><div style="flex:1;min-width:0"><b>Río Paz</b> <span class="hint">@rio</span><span class="hint" style="display:block">Pidió entrar hace 2 h: «Llevo la parte de facturación en el cliente.»</span></div><button class="btn btn-secondary btn-sm" type="button">Rechazar</button><button class="btn btn-primary btn-sm" type="button">Aceptar</button></li>
          <li><span class="avatar avatar-lg p-blake">lu</span><div style="flex:1;min-width:0"><b>Lu Méndez</b> <span class="hint">@lu</span><span class="hint" style="display:block">Invitación enviada por blake · caduca en 6 días</span></div><button class="btn btn-ghost btn-sm" type="button">Retirar</button></li>
        </ul></div>
      </section>
      <section class="form-section" id="tipos">
        <header class="head-row"><div><h2>Tipos de ticket</h2><p>El orden es el del selector al crear un ticket. Un tipo en uso no se puede borrar: se fusiona con otro.</p></div><button class="btn btn-secondary" type="button">{icon('plus')}Añadir tipo</button></header>
        <div class="panel"><ul class="rows">{type_rows}</ul></div>
      </section>
      <section class="form-section" id="etiquetas">
        <header class="head-row"><div><h2>Etiquetas</h2><p>Las mismas en tickets, notas y archivos. Al borrar una se quita de todos, sin borrar nada más.</p></div><button class="btn btn-secondary" type="button">{icon('plus')}Nueva etiqueta</button></header>
        <div class="panel"><ul class="rows">{''.join(lbl_rows)}</ul></div>
      </section>
      <section class="form-section" id="automatizaciones">
        <header class="head-row"><div><h2>Automatizaciones</h2><p>Reglas que corren solas en este espacio. Cada una dice cuántas veces actuó.</p></div><a class="btn btn-secondary" href="ventanas.html#automatizacion">{icon('plus')}Nueva regla</a></header>
        <div class="panel"><ul class="rows">{rule_rows}</ul></div>
      </section>
      <section class="form-section" id="drive">
        <header><h2>Drive</h2><p>Los archivos del espacio no se guardan en este servidor: viven en el Drive de quien lo conecta.</p></header>
        <div class="panel" style="padding:18px 20px;display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">{icon('cloud', 28)}<div style="flex:1;min-width:200px"><b>Conectado con la cuenta de blake</b><span class="hint" style="display:block">Carpeta «Forge — Atlas Platform» · 14 archivos · 212 MB</span></div><button class="btn btn-secondary btn-sm" type="button">Cambiar de cuenta</button><button class="btn btn-ghost btn-sm" type="button" style="color:var(--danger)">Desconectar</button></div>
          <ul class="why"><li>Forge solo ve los archivos que crea él mismo (permiso <span class="mono">drive.file</span>), no el resto de ese Drive.</li><li>Si se desconecta, los archivos siguen en ese Drive. Aquí se marcan «sin acceso»; no desaparecen de la lista.</li></ul>
        </div>
      </section>
      <section class="form-section" id="borrar">
        <header><h2>Borrar el espacio</h2></header>
        <div class="notice notice-danger" style="flex-direction:column;align-items:stretch;gap:14px">
          <div>Se borran sus <b>41 tickets</b>, <b>18 notas</b> y <b>3 tablas</b>, y sale de los inicios de sus 4 miembros. Los <b>14 archivos</b> siguen en el Drive de blake. No se puede deshacer.</div>
          <div class="field" style="max-width:360px"><span class="field-label">Escribe <span class="mono">atlas</span> para confirmar</span><span class="input mono">atl<span class="caret"></span></span></div>
          <div><button class="btn btn-danger-solid" type="button" disabled>Borrar Atlas Platform</button></div>
        </div>
      </section>
    </div>
  </div>
</div>"""
AJ_CSS = """<style>
.head-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.rows li { display: flex; gap: 12px; align-items: center; padding: 12px 16px; font-size: var(--t-14); flex-wrap: wrap; }
.rows li + li { border-top: 1px solid var(--border); }
.rows .grip { color: var(--muted); display: grid; }
.rows .push { margin-left: auto; }
.rows li.editing { background: var(--bg); }
.rule-text { line-height: 1.9; }
.rule-text .status { height: 22px; vertical-align: middle; }
.caret { display: inline-block; width: 1.5px; height: 1.1em; background: var(--text); vertical-align: -0.18em; margin-left: 1px; }
.subnav .count { margin-left: 4px; font-size: var(--t-12); color: var(--muted); }
</style>"""
write('ajustes-espacio.html', shell('ajustes-espacio', ['Atlas Platform', 'Ajustes del espacio'], ajustes_esp, 'Ajustes del espacio', extra_head=AJ_CSS))

# ── Registro ────────────────────────────────────────────────────────────────
# Sin la escena de figuras a propósito: de momento solo vive en «Entrar».
registro = HEAD.format(title='Crear cuenta · Forge OS', favicon=FAVICON) + f"""<body>
<div class="auth">
  <aside class="auth-brand">
    <a href="portada.html" class="brand" style="color:var(--brand-paper)">{mark(30)}<span class="brand-word">Forge OS</span></a>
    <div class="auth-copy">
      <p class="claim">Tu cuenta, <span class="claim-wide">y en dos minutos, tu primer sprint.</span></p>
      <ol class="steps">
        <li><b>1</b><span>Crea la cuenta. Usuario, correo y contraseña; nada más.</span></li>
        <li><b>2</b><span>Abre un espacio o acepta la invitación de tu equipo.</span></li>
        <li><b>3</b><span>Escribe tickets, arrástralos, cronometra. Es tuyo: un archivo de SQLite.</span></li>
      </ol>
    </div>
    <ul class="auth-facts"><li>Sin tarjeta</li><li>Sin scripts de terceros</li><li>Licencia MIT</li></ul>
  </aside>
  <main class="auth-form">
    <form aria-labelledby="reg-t" onsubmit="return false">
      <div style="display:flex;justify-content:space-between;align-items:center"><a class="link" href="acceso.html">← Entrar</a>{THEME_BTN}</div>
      <div><h1 id="reg-t" class="page-title">Crear cuenta</h1><p class="page-sub">En esta instancia de Forge OS.</p></div>
      <div class="row-2"><button class="btn btn-secondary" type="button" style="justify-content:center">Google</button><button class="btn btn-secondary" type="button" style="justify-content:center">GitHub</button></div>
      <div class="divider">o con usuario</div>
      <div class="field"><span class="field-label">Usuario</span><span class="input">avery</span><span class="hint">Letras, números y guiones. Es tu dirección: <span class="mono">/u/avery</span>.</span></div>
      <div class="field"><span class="field-label">Correo</span><span class="input">avery@ejemplo.com</span><span class="hint">Solo para recuperar la cuenta. No se envía publicidad.</span></div>
      <div class="field"><span class="field-label">Contraseña</span><span class="input is-focus" style="justify-content:space-between"><span>•••••••••<span class="caret"></span></span><span class="hint">Mostrar</span></span>
        <span class="hint pw-rule"><span class="sw" style="--c:var(--st-done)"></span>9 caracteres: cumple el mínimo de 8.</span></div>
      <div class="field"><span class="field-label">¿Cuánto es 7 + 5?</span>
        <div style="display:flex;gap:8px"><span class="input" style="width:96px"><span class="placeholder">12</span></span><button class="btn btn-ghost btn-sm" type="button" style="height:36px">{icon('refresh')}Otra suma</button></div>
        <span class="hint">Comprueba que no eres un programa sin mandar tus datos a nadie: es una suma, no un servicio externo.</span></div>
      <button class="btn btn-primary" type="button" style="justify-content:center;height:40px">Crear cuenta</button>
      <p class="hint">Al crearla aceptas la licencia MIT de este software y las normas de quien administra esta instancia.</p>
      <p style="font-size:var(--t-13)">¿Ya tienes cuenta? <a class="link" href="acceso.html">Entrar</a></p>
    </form>
  </main>
</div>
<style>
.caret {{ display: inline-block; width: 1.5px; height: 1.1em; background: var(--text); vertical-align: -0.18em; margin-left: 1px; }}
.steps {{ display: flex; flex-direction: column; gap: 18px; counter-reset: none; }}
.steps li {{ display: grid; grid-template-columns: 56px 1fr; gap: 16px; align-items: baseline; color: #CFC9BF; font-size: var(--t-16); line-height: 1.5; }}
.steps li::before {{ display: none; }}
.steps b {{ font-size: 3.4rem; font-weight: 800; font-stretch: 64%; line-height: .8; color: var(--brand-orange); }}
.pw-rule {{ display: flex; gap: 8px; align-items: center; }}
.auth-brand {{ justify-content: space-between; }}
</style>
</body>
</html>
"""
write('registro.html', registro)

# ── Personas ────────────────────────────────────────────────────────────────
PEOPLE_C = [('noor', 'Noor Haddad', 'she/her', 'Backend. Le gustan las migraciones aburridas y los índices que se explican solos.', ['Atlas Platform', 'Semillero de robótica'], 'conn'),
            ('blake', 'Blake Moreno', 'he/him', 'Diseño y facturación. Escribe las actas del sprint.', ['Atlas Platform'], 'conn'),
            ('avery', 'Marta Ruiz', '', 'Coordina el laboratorio de redes de 5.º semestre.', ['Laboratorio de redes'], 'sent'),
            ('noor', 'Tomás Vela', 'he/him', 'Estudio Prisma. Interfaces para equipos pequeños.', [], 'none'),
            ('blake', 'Kai Ortega', '', 'Invitado en Atlas Platform.', ['Atlas Platform'], 'guest'),
            ('avery', 'Lucía Paredes', 'she/her', 'Compras en Ferretería Norte. Sin perfil público más allá de esto.', [], 'none')]


def person_card(c, name, pron, bio, spaces, st):
    import unicodedata
    user = unicodedata.normalize('NFKD', name.split()[0].lower()).encode('ascii', 'ignore').decode()
    act = {'conn': f'<span class="hint" style="display:flex;gap:6px;align-items:center">{icon("check")}Conectados</span>',
           'sent': '<button class="btn btn-secondary btn-sm" type="button">Retirar solicitud</button><span class="hint">Enviada hace 2 días</span>',
           'none': '<button class="btn btn-primary btn-sm" type="button">Enviar solicitud</button>',
           'guest': '<button class="btn btn-secondary btn-sm" type="button" disabled>Enviar solicitud</button><span class="hint">Los invitados no reciben solicitudes</span>'}[st]
    sp = ''.join(f'<span class="chip" style="--c:var(--muted)">{s}</span>' for s in spaces)
    guest = ' <span class="chip" style="--c:var(--accent)">Invitado</span>' if st == 'guest' else ''
    return (f'<article class="person"><header><span class="avatar avatar-lg p-{c}">{name[:2]}</span><div><strong><a href="perfil.html">{name}</a></strong>'
            f'<span class="hint">@{user}{" · " + pron if pron else ""}</span></div>{guest}</header><p>{bio}</p>'
            f'{"<div class=\"toolbar-group\" style=\"gap:6px\">" + sp + "</div>" if sp else ""}<footer>{act}</footer></article>')


personas = f"""<div class="page page-narrow">
  <div class="page-head">
    <div><h1 class="page-title">Personas</h1><p class="page-sub">Quien comparte espacio contigo y los perfiles públicos de esta instancia.</p></div>
  </div>
  <div class="toolbar">
    <div class="toolbar-group"><span class="input" style="width:min(100%,340px)">{icon('search')}<span class="placeholder">Nombre o usuario</span></span></div>
    <div class="toolbar-group">{segmented(['En tus espacios', 'Todas las públicas', 'Solicitudes 1'], 0, 'Qué personas ver')}</div>
  </div>
  <div class="notice" style="margin-bottom:20px"><span class="avatar avatar-lg p-blake">sa</span><div style="flex:1"><b>Sam Ibarra</b> quiere conectar contigo.<span class="hint" style="display:block">Compartís «Tesis — Grupo 4». Conectar os deja escribiros y veros en las sugerencias.</span></div><button class="btn btn-secondary btn-sm" type="button">Ignorar</button><button class="btn btn-primary btn-sm" type="button">Aceptar</button></div>
  <div class="people">{''.join(person_card(*p) for p in PEOPLE_C)}</div>
  <p class="hint" style="margin-top:16px">Los invitados no aparecen al buscar por parte del nombre: solo si escribes su usuario exacto.</p>
</div>"""
write('personas.html', shell('personas', ['Personas'], personas, 'Personas'))

# ── Perfil público ──────────────────────────────────────────────────────────
perfil = f"""<div class="page page-narrow">
  <div class="profile-banner" style="--c:var(--p-noor)" aria-hidden="true"></div>
  <div class="profile-head">
    <span class="avatar avatar-xl p-noor">no</span>
    <div style="flex:1;min-width:220px;padding-bottom:6px"><h1 class="page-title" style="font-size:clamp(2rem,4vw,2.8rem)">Noor Haddad</h1><p class="page-sub">@noor · she/her · en Forge desde enero de 2026</p></div>
    <div class="toolbar-group" style="padding-bottom:8px"><span class="hint" style="display:flex;gap:6px;align-items:center">{icon('check')}Conectados</span>
      <button class="btn btn-secondary" type="button">{icon('link')}Copiar enlace</button>
      <button class="btn btn-ghost btn-icon" type="button" aria-label="Más acciones: silenciar o bloquear a noor">{icon('more')}</button></div>
  </div>
  <div class="profile-grid">
    <div style="display:flex;flex-direction:column;gap:20px">
      <p class="bio">Backend. Le gustan las migraciones aburridas y los índices que se explican solos. Mantiene la copia nocturna de Atlas.</p>
      <div class="figures" style="margin:0"><div><b class="wide fig">2</b><span class="hint">espacios en común</span></div><div><b class="wide fig">31</b><span class="hint">tickets cerrados este trimestre</span></div></div>
      <section><h2 class="section-title">Espacios públicos</h2>
        <div class="panel"><ul class="rows">
          <li><b><a href="panel.html">Atlas Platform</a></b><span class="mono muted">#atlas</span><span class="push muted">Miembro · en común</span></li>
          <li><b>Semillero de robótica</b><span class="mono muted">#semillero</span><span class="push muted">Administración · en común</span></li>
          <li><b>Club de lectura técnica</b><span class="mono muted">#lectura</span><span class="push"><button class="btn btn-secondary btn-sm" type="button">Pedir entrar</button></span></li>
        </ul></div></section>
    </div>
    <aside class="panel" style="padding:18px 20px;display:flex;flex-direction:column;gap:10px;align-self:start">
      <h2 class="field-label">Lo que ves aquí</h2>
      <p class="hint" style="line-height:1.55">El nombre, la biografía y los espacios que noor ha hecho públicos. Su actividad dentro de cada espacio solo la ven los miembros.</p>
      <p class="hint" style="line-height:1.55">Bloquear a noor le impide enviarte solicitudes y mencionarte. No le avisa.</p>
    </aside>
  </div>
</div>
<style>
.profile-grid {{ display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 24px; margin-top: 28px; }}
.bio {{ font-size: var(--t-20); line-height: 1.45; max-width: 46ch; text-wrap: pretty; }}
.rows li {{ display: flex; gap: 12px; align-items: center; padding: 12px 16px; font-size: var(--t-14); flex-wrap: wrap; }}
.rows li + li {{ border-top: 1px solid var(--border); }}
.rows .push {{ margin-left: auto; }}
@media (max-width: 820px) {{ .profile-grid {{ grid-template-columns: minmax(0, 1fr); }} .profile-banner {{ height: 120px; }} }}
</style>"""
write('perfil.html', shell('personas', ['Personas', 'Noor Haddad'], perfil, 'Noor Haddad'))

# ── Actividad ───────────────────────────────────────────────────────────────
FEED = [('Hoy', [('blake', f'movió <b>Selector de plan en ajustes</b> a {status_badge("review")}', 'Atlas Platform · Tablero', '10:42'),
                 ('avery', 'editó la nota <a class="link" href="notas.html">Arquitectura general</a>', 'Atlas Platform · Notas · 6 cambios', '10:37'),
                 ('noor', 'registró <b>2 h</b> en <b>La búsqueda pierde resultados después de la página 3</b>', 'Atlas Platform · Tiempo', '09:15'),
                 ('blake', f'cerró 3 tickets: <b>API de medición de consumo</b>, <b>Límite de peticiones…</b> y 1 más <button class="btn btn-ghost btn-sm" type="button" style="height:24px">Ver los 3</button>', 'Atlas Platform · Tablero', '08:50')]),
        ('Ayer', [('blake', 'subió <span class="mono">factura-plantilla.pdf</span> y le puso la etiqueta ' + chip('Facturación'), 'Atlas Platform · Archivos', '18:40'),
                  ('noor', 'añadió a <b>kai</b> como invitado', 'Atlas Platform · Miembros', '16:02'),
                  ('avery', 'creó el sprint <b>Sprint 15 — Formularios públicos</b>', 'Atlas Platform · Sprints', '11:20')]),
        ('Jueves 16 de octubre', [('noor', 'añadió 8 filas a <b>Contactos comerciales</b>', 'Atlas Platform · Tablas', '17:31'),
                                  ('avery', f'creó <b>Búsqueda de texto completo en páginas</b> {chip("Búsqueda")}', 'Atlas Platform · Tablero', '12:04')])]
feed = ''.join(f'<h2 class="feed-day">{d}</h2><ul class="feed">' + ''.join(
    f'<li><span class="avatar p-{w}">{w[:2]}</span><div><b>{w}</b> {t}<span class="hint where">{wh}</span></div><time class="when">{h}</time></li>' for w, t, wh, h in items) + '</ul>'
    for d, items in FEED)
actividad = f"""<div class="page page-narrow" style="max-width:860px">
  <div class="page-head">
    <div><h1 class="page-title">Actividad</h1><p class="page-sub">Lo que ha pasado en Atlas Platform, de lo más reciente a lo más antiguo.</p></div>
  </div>
  <div class="toolbar">
    <div class="toolbar-group">{segmented(['Todo', 'Tickets', 'Notas', 'Archivos', 'Miembros'], 0, 'Qué actividad ver')}</div>
    <div class="toolbar-group"><span class="select select-inline" aria-label="Persona">Todas las personas</span></div>
  </div>
  {feed}
  <div style="display:flex;justify-content:center;margin-top:24px"><button class="btn btn-secondary" type="button">Cargar la semana anterior</button></div>
  <p class="hint" style="margin-top:14px;text-align:center">Las acciones seguidas de una misma persona sobre lo mismo se agrupan: «cerró 3 tickets».</p>
</div>"""
write('actividad.html', shell('actividad', ['Atlas Platform', 'Actividad'], actividad, 'Actividad'))

# ── Índice de notas ─────────────────────────────────────────────────────────
PINNED = [('Arquitectura general', 'Forge OS corre como un solo proceso de Astro en modo servidor, sobre un archivo de SQLite…', 'avery', 'hace 5 min', ['API', 'Q4']),
          ('Guía de incorporación', 'Lo primero: pide acceso al espacio y al Drive. Después, lee el acta del último sprint…', 'blake', 'el 12 oct', ['Incorporación']),
          ('Acta del sprint 14', '@avery ¿cerramos facturación el jueves? La factura sale con el periodo y el desglose…', 'blake', 'ayer', ['Facturación'])]
pins = ''.join(f'<a class="note-card" href="notas.html"><strong>{t}</strong><p>{x}</p><div class="toolbar-group" style="gap:6px">{"".join(chip(l) for l in ls)}</div><span class="hint">{w} · {when}</span></a>' for t, x, w, when, ls in PINNED)
NOTES_ALL = [('Arquitectura general', '', ['API', 'Q4'], 'avery', 'hace 5 min', 2),
             ('Modelo de datos', 'Arquitectura general /', ['API'], 'noor', 'hoy, 09:02', 1),
             ('Despliegue en la VM', 'Arquitectura general /', [], 'noor', 'el 14 oct', 0),
             ('Acta del sprint 14', 'Actas de sprint /', ['Facturación'], 'blake', 'ayer', 3),
             ('Acta del sprint 13', 'Actas de sprint /', [], 'blake', 'el 26 sep', 4),
             ('Guía de incorporación', '', ['Incorporación'], 'blake', 'el 12 oct', 0)]
nrows = ''.join(f'<tr><td class="title"><span class="hint">{p} </span><a href="notas.html">{t}</a></td><td>{"".join(chip(l) for l in ls) or "<span class=\"muted\">—</span>"}</td>'
                f'<td><span style="display:flex;gap:8px;align-items:center"><span class="avatar p-{w}">{w[:2]}</span><span class="muted">{when}</span></span></td><td class="num">{n or "—"}</td></tr>'
                for t, p, ls, w, when, n in NOTES_ALL)
notas_idx = f"""<div class="page">
  <div class="page-head">
    <div><h1 class="page-title">Notas</h1><p class="page-sub">18 notas en Atlas Platform. Las que se enlazan a tickets salen también en el ticket.</p></div>
    <div class="page-actions"><button class="btn btn-primary" type="button">{icon('plus')}Nueva nota</button></div>
  </div>
  <div class="toolbar">
    <div class="toolbar-group"><span class="input" style="width:min(100%,320px)">{icon('search')}<span class="placeholder">Buscar en títulos y texto</span></span><span class="select select-inline" aria-label="Etiqueta">Todas las etiquetas</span></div>
    <div class="toolbar-group">{segmented(['Recientes', 'Árbol', 'Por etiqueta'], 0, 'Cómo ordenar las notas')}</div>
  </div>
  <h2 class="section-title">Fijadas</h2>
  <div class="note-cards">{pins}</div>
  <h2 class="section-title" style="margin-top:28px">Todas</h2>
  <div class="panel"><table class="table"><thead><tr><th>Título</th><th>Etiquetas</th><th>Última edición</th><th class="num">Tickets</th></tr></thead><tbody>{nrows}</tbody></table></div>
</div>
<style>
.note-cards {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }}
.note-card {{ display: flex; flex-direction: column; gap: 10px; padding: 18px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 46px 46px 18px 18px; padding-top: 26px; }}
.note-card:hover {{ border-color: var(--border-strong); }}
.note-card strong {{ font-size: var(--t-20); font-weight: 800; font-stretch: var(--narrow-x); line-height: 1.05; }}
.note-card p {{ color: var(--muted); font-size: var(--t-13); line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }}
@media (max-width: 1000px) {{ .note-cards {{ grid-template-columns: minmax(0, 1fr); }} }}
</style>"""
write('notas-indice.html', shell('notas', ['Atlas Platform', 'Notas'], notas_idx, 'Notas'))

# ── 404 ─────────────────────────────────────────────────────────────────────
lost = HEAD.format(title='No encontrado · Forge OS', favicon=FAVICON) + f"""<body>
<div class="sheet-page">
  <header class="site-head"><a href="portada.html" aria-label="Forge OS, portada">{brand(22)}</a><nav>{THEME_BTN}</nav></header>
  <main class="lost">
    <div>
      <h1><span aria-hidden="true">404</span><span class="sr-only">Error 404: no encontrado</span></h1>
      <p class="lost-line">La fragua está apagada.</p>
      <p class="muted" style="max-width:46ch;line-height:1.6;margin:14px 0 24px">Esta dirección no existe, o lo que había se borró. Si te pasaron un enlace a un espacio privado, entra primero con tu cuenta: sin entrar, todo lo privado responde así.</p>
      <div class="toolbar-group"><a class="btn btn-primary" href="inicio.html">Ir al inicio</a><a class="btn btn-secondary" href="ventanas.html#paleta">{icon('search')}Buscar en Forge</a></div>
      <p class="hint mono" style="margin-top:28px">/atlas/tickets/412</p>
    </div>
    <div class="lost-forge" aria-hidden="true"><div class="mouth"><div class="ash"></div></div></div>
  </main>
</div>
<style>
.lost {{ min-height: calc(100dvh - 140px); }}
.lost-line {{ font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 800; font-stretch: 64%; line-height: 1; margin-top: 8px; }}
</style>
</body>
</html>
"""
write('404.html', lost)
print('pantallas ok')
