# Notas de desarrollo

Lo que no se ve en el código: reglas que se rompen con facilidad, decisiones
que parecen errores y no lo son, y trampas en las que ya se cayó una vez. Si vas
a tocar una de las zonas de abajo, lee su apartado antes.

## Nombre y stack

**El producto se llama «Forge OS»; el paquete de npm sigue siendo `forge-js`.**
El repositorio se renombró a `Forge-OS`. La diferencia es deliberada: renombrar
el paquete no aporta nada y rompería instalaciones.

Astro en modo SSR (la versión, en `package.json`). Requiere Node >= 22.12.

- **Astro 7** con `@astrojs/node` (adapter standalone), servido por el
  `server.mjs` de la raíz con Express 5.
- **`better-sqlite3` v13**, con migraciones versionadas en `src/lib/db.ts`.
  Hay además una configuración de Drizzle (`drizzle.config.ts`) y el esquema en
  SQL plano (`schema.sql`, `schema-v1.1-social.sql`).
- **Tiptap 3** (sobre ProseMirror) para las notas. Ver «Notas: Tiptap».
- **Tailwind 4** vía `@tailwindcss/vite` (no el plugin de PostCSS) + typography.
- Auth con `bcryptjs` + `cookie` **v2**.
- Gráficas con `chart.js`. Tiempo real con `socket.io`.

> **`cookie` v2 renombró la API**: es `parseCookie`/`stringifyCookie`, no
> `parse`/`serialize`, y ya no hay export por defecto. Astro >= 7.1 exige
> `cookie@^2`, así que mantener aquí una versión vieja rompe el arranque del
> servidor con `does not provide an export named 'parseCookie'`. Único uso
> propio: `src/lib/sockets.mjs`.

## Comandos

```bash
npm run dev          # astro dev
npm run build        # astro build
npm test             # unitarias (Vitest)
npm run test:e2e     # e2e (Playwright: escritorio y teléfono)
npm run lint         # Biome
npm run typecheck    # astro check
```

La primera vez, Playwright necesita sus navegadores: `npx playwright install`.
Las pruebas de `tests/e2e/movil/` solo corren en el perfil de teléfono
(Pixel 5, 393 px de ancho): los fallos de este proyecto aparecen por debajo de
400 px.

## Bases de datos locales

`forge.db` y `forge_test.db` (con sus `-shm`/`-wal`) se crean en la raíz del
repo y están ignorados por git (`*.db`). `forge.db` es tu base de trabajo: no
la borres para «empezar limpio»; `npm run seed -- --force` con otro
`DATABASE_URL` sirve para eso.

`forge_test.db` **acumula páginas libres a lo largo de muchas corridas** porque
los tests insertan y borran pero nunca hacen `VACUUM`. Una ejecución suelta no
lo infla (se queda en ~400 KB), pero con el tiempo llegó a 534 MB siendo 99,9 %
espacio vacío. Si lo ves crecer: `sqlite3 forge_test.db "VACUUM;"`.

## Vulnerabilidades conocidas (no accionables)

`npm audit` reporta **6 moderadas**, en dos cadenas, y **ninguna tiene arreglo
real**: en las dos, lo que npm propone es *retroceder*.

- **4 en `drizzle-kit → @esbuild-kit/esm-loader → esbuild`.** `drizzle-kit@0.31.x`
  ya es la última y sigue arrastrando esa dependencia; npm sugiere
  `drizzle-kit@0.18.1`, trece versiones menores atrás. El aviso de esbuild
  solo afecta a su dev server, que aquí no se expone.
- **2 en `@tailwindcss/typography → postcss-selector-parser`.** npm sugiere
  bajar a `typography@0.5.4`. Solo corre al compilar el CSS, con selectores
  nuestros, no con entrada de nadie.

**No ejecutes `npm audit fix --force`** en este repo. Cualquier otro aviso que
aparezca **sí** es accionable: en octubre de 2026 había 22, dos críticos, en
`astro`, `@astrojs/node` y `engine.io`, que llegan a producción. Se arreglaron
subiendo de versión menor (1.28.1). Se acumularon porque las alertas de
Dependabot estaban apagadas en el repositorio; desde la 2.0.1 están activas,
junto con sus PR de seguridad.

## Accesibilidad: no lo deshagas sin querer

Los colores están calibrados para pasar WCAG AA en ambos temas (auditoría a 0
fallos). Tres reglas que se rompen con facilidad:

- **No apliques opacidad al texto** (`text-forge-muted/70` y similares). Los
  tokens ya están al filo del umbral; bajarles la opacidad los saca de AA. Fue
  la causa de 6 de los 24 fallos originales.
- **El naranja de relleno (`forge-primary`) no es para texto.** Para texto
  naranja usa **`--forge-accent-text`**, que sí cumple; sobre tinta (un aviso
  emergente), `--forge-accent-inverse`. Están separados justo porque
  unificarlos obliga a elegir entre marca apagada o texto ilegible.
- **Texto sobre fondo naranja va con `text-forge-on-accent`**, nunca
  `text-forge-bg`: ese se invierte con el tema y el naranja no.

**Todo control lleva nombre accesible**: 89 de 89 en las nueve pantallas
principales, comprobado en el navegador. Al enlazar las etiquetas en bloque
salió el fallo que hay que evitar repetir: cuando un `<label>` **envuelve** su
control ya está asociado, y añadirle un `for` que apunte a otro sitio hace que
el navegador **ignore** el control que envuelve. Las casillas de notificaciones
quedaron una fila desplazadas —pulsar «silenciar asignaciones» cambiaba
«menciones»— y eso es peor que no tener etiqueta, porque falla en silencio. Lo
fija `tests/e2e/a11y-etiquetas.spec.ts`.

Los controles que se **repiten** (columnas de una base dinámica, rol de cada
miembro) van con `aria-label`, nunca con `id` fijo: dos elementos con el mismo
id rompen `for` igual, y gana el primero.

La variante `dark:` de Tailwind está atada a `[data-theme]` con
`@custom-variant`, no a `prefers-color-scheme`. Sin eso, `dark:prose-invert` no
se activa con el conmutador de la app.

## Reglas de cuentas: no las repartas por los endpoints

Estos módulos concentran reglas que antes estaban copiadas en varios sitios con
redacciones distintas. Si necesitas una de ellas, **impórtala; no la
reescribas**.

- **`src/lib/social.ts`** — `canInteractSocially(a, b)` decide si dos cuentas
  pueden dirigirse una acción social. Es falso si cualquiera de las dos es
  invitado, **en los dos sentidos**: un invitado no manda solicitudes ni
  bloquea, y tampoco se le puede mandar ni bloquear a él. Ver perfiles no pasa
  por aquí — mirar no es interactuar. La regla estaba escrita tres veces y la
  cuarta acción (bloquear) se había quedado sin ella.

- **`src/lib/accountValidation.ts`** — nombres y correos. La lista negra va en
  **dos** listas a propósito: `BANNED_ANYWHERE` (subcadena libre) y
  `BANNED_TOKEN` (solo en límite de palabra). Unificarlas en una sola con
  búsqueda de subcadena rechaza «Scunthorpe», «disputa» y «analyst». Hay tests
  que lo comprueban; si añades un término, decide en cuál va.

- **`src/lib/captcha.ts`** — suma firmada con HMAC, **sin estado en servidor**.
  No lo cambies por reCAPTCHA ni hCaptcha: la portada promete «sin scripts de
  terceros» y el registro es justo donde más se notaría el desmentido.

- **`src/lib/accountDeletion.ts`** — el borrado permanente. `DELETE FROM users`
  a secas **no funciona**: ocho tablas apuntan a `users` con `NO ACTION`, así
  que con `foreign_keys` activo revienta para cualquier cuenta que haya
  trabajado algo. La solución no es poner CASCADE en todas —eso borra los
  tickets y las páginas del equipo cuando alguien se va—, sino reatribuirlos a
  la cuenta lápida `deleted-user`. Tres reglas que no se ven en el código:
  el `assignee_id` va a **NULL** y no a la lápida (sin asignar se ve en los
  filtros, asignado a un fantasma no); la lápida nace con `is_public = 0`
  porque el valor por defecto de la columna es 1 y saldría en la búsqueda de
  personas; y si la cuenta es la **única propietaria** de un espacio con más
  gente dentro, el borrado se detiene, porque un espacio sin dueño no lo puede
  administrar ni borrar nadie.

Los invitados tampoco salen en las sugerencias de búsqueda
(`src/pages/api/sys/state.ts`): la consulta esconde `is_guest = 1` del `LIKE`
pero deja pasar la coincidencia **exacta**, para que dos invitados del mismo
espacio puedan llegar a su perfil. Si tocas ese SQL, mira
`tests/guest-search.test.ts`.

## Diseño «Taller» (2.0)

El diseño está en `docs/rediseno/` (maquetas estáticas, `index.html` las
enlaza) y las razones en `docs/rediseno-diagnostico.md`. Se aplicó en diez
fases (1.36.0 a 2.0.0). Lo que no se ve en el código:

- **Las piezas viven en `src/styles/taller.css`**: `.btn`, `.campo`,
  `.panel`, `.chip`, `.avatar`, `.segmentado`, `.menu`, `.ventana`, `.aviso`,
  `.tabla`, `.columna`/`.tarjeta`… Una pantalla nueva se arma con ellas; si
  falta una, se añade ahí, no como cadena de utilidades en la página.
- **Tokens en `src/styles/themes.css`.** El foco va en tinta
  (`forge-focus`), no en naranja; el realce al pasar, en `forge-text` o
  `forge-surface-2`. No hay color «secundario»: en la 2.0 se retiraron
  `forge-secondary`, `forge-accent` y `forge-danger`, que duplicaban otros.
- **El `<main>` del armazón es el que se desplaza** (`overflow-auto`), no el
  documento: `<body>` es `overflow-hidden`. Un elemento absoluto cuyo bloque
  contenedor sea el `<main>` escapa del recorte de cualquier contenedor con
  desplazamiento que no esté posicionado, y ensancha la página entera en el
  teléfono. Fue lo que pasó en Inicio con un `sr-only` en la cabecera de una
  tabla (2.0.1); por eso `.tabla` es `relative`. La prueba
  `tests/e2e/movil/desbordamiento.spec.ts` mide el `<main>`, no solo el
  documento.
- **Las páginas públicas** (portada, acceso, registro, 404) usan el CSS de la
  maqueta casi tal cual, en `src/styles/portada.css` con alcance `.portada`:
  `/` sirve también Inicio, y sin alcance sus `.card` o `.btn` pisarían los de
  la app. Ese archivo repite el orden de capas de Tailwind a propósito; sin
  él, si llega antes que Tailwind, el reset gana y los títulos salen a 14 px.
- **Los textos de la portada** están en `textosPortada.ts`, no en `i18n/`, y
  **todo lo que afirman tiene que existir**. La maqueta prometía que una nota
  enlazada aparece en su tarea; no existe, así que no se dice. Lo mismo vale
  para el README.
- **Los estados salen de `src/lib/status.ts`** (nombre en i18n, color
  `--forge-st-*`). Su color es marca gráfica —punto, cinta, barra, serie—,
  nunca color de texto; el texto va en tinta (`.estado-chip`).
- **Las gráficas leen los colores del tema** (`src/lib/client/temaGraficas.ts`)
  y se repintan al cambiarlo. Nada de hexadecimales en Chart.js.
- **`tests/barandillas-diseno.test.ts` no admite ninguna huella** del diseño
  anterior: paleta de Tailwind, letra de menos de 12 px, texto en blanco fijo,
  desenfoque, halos, gradientes radiales, elevar al pasar el ratón, rebotes.
  Durante el rediseño había una lista de excepciones que fue bajando; llegó a
  cero y se borró. No la vuelvas a crear: si algo lo necesita, afina el patrón.
- **Nada de letra por debajo de 12 px**, tampoco en móvil.
- **Las capturas del README** salen de `npm run screenshots` contra una
  compilación de producción (`node server.mjs`), no contra `astro dev`: en
  desarrollo las gráficas y el editor a veces no llegan a pintarse. La semilla
  enciende sprints, tiempo y puntos en el espacio de demo.
- **Las fuentes se sirven desde `public/fonts`** (Archivo variable y Plex
  Mono). No vuelvas a Google Fonts: la CSP ya no lo permite.

## Navegación: lo mismo en todas las páginas

- **La sección del espacio de la barra lateral sale siempre**, también en
  Inicio, Actividad o los ajustes de la cuenta (con el último espacio
  visitado). La resuelve **una** función, `espacioDeNavegacion()` en
  `src/lib/consultas.ts`, que usan la barra lateral y la inferior. Si un
  componente decide por su cuenta qué enseñar fuera de un espacio, pasar de
  Inicio al tablero vuelve a mover la barra. Lo fija
  `tests/e2e/navegacion-estable.spec.ts`, que compara la posición de cada
  enlace en las dos páginas.
- **Perfil y ajustes de la cuenta son una página** (`/settings`). El perfil
  público (`/u/<usuario>`) es la vista de los demás y enlaza de vuelta.

## Tablero en el teléfono

- **Las pestañas de estado son `sticky`**, y para eso los contenedores del
  tablero van con `overflow-clip`, **no** `overflow-hidden`: este último crea
  un contenedor de desplazamiento y el `sticky` deja de pegarse al `<main>`,
  que es quien se desplaza. Sin pestañas fijas, al bajar por una columna larga
  desaparecían por arriba, y son el destino del arrastre.
- **El arrastre con el dedo es propio** (`touchstart/move/end` en
  `KanbanBoard.astro`), porque el de HTML5 no funciona con el dedo. La espera
  (380 ms) separa levantar de desplazar. Al tocar una tarjeta se le quita
  `draggable` mientras dura el toque: Chrome para Android arranca también su
  arrastre nativo y competirían.
- **Mover de estado no recarga**, salvo al salir de Hecho o con un cronómetro en
  marcha, porque esas tarjetas las tiene que repintar el servidor. A Hecho va
  siempre por `completar()`, que sabe de repeticiones.
- **La pestaña va en `?estado=`**, que el servidor lee al pintar.
- **El sprint que se recuerda es el que se está viendo** (`selector.value`), no
  el de la dirección: sin `?sprint=` se guardaba «backlog» y desde la segunda
  visita el tablero abría vacío. Lo fija `tests/e2e/sprint-recordado.spec.ts`.

## Buscadores

- **`/` y `/es` son la portada en cada idioma**, enlazadas con `hreflang`
  (`ALTERNATIVAS_PORTADA` en `textosPortada.ts`, que usan la página y el
  sitemap). `/` negocia el idioma; `/es` no, porque un buscador no manda cookie
  ni idioma y sin ella Google solo veía el inglés. `/api/lang` cambia de una a
  otra y solo redirige a rutas del propio sitio.
- **Las páginas salen con `Cache-Control: private, no-cache, no-transform`**
  (`src/middleware.ts`). `no-transform` impide que Cloudflare inyecte su
  analítica, que la CSP bloqueaba con un error en la consola. No lo quites
  pensando que es solo caché.
- **`www.` redirige** al dominio de `PUBLIC_SITE_URL` desde `server.mjs`.
- **El sitemap no lleva `lastmod`**: ponía la fecha de hoy en cada petición, y
  Google deja de fiarse de un `lastmod` que nunca es cierto.

## Plantillas de tareas

Se crean desde una tarea (`desdeTarea`) o escritas en los ajustes (`crear`,
`actualizar`), y las dos pasan por `limpiarContenido()`: una plantilla no puede
llevar nada que el alta no admita. Las de serie (`plantillasDeSerie.ts`) van
en los dos idiomas dentro del propio archivo porque, como las de las tablas,
se convierten en datos al guardarse; una prueba comprueba que pasan la lista
blanca sin perder nada.

## La marca va en un solo componente

`src/components/brand/Logo.astro`, logo «Fragua»: la boca de una fragua con
las brasas dentro. El trazado está duplicado a propósito en el componente y en
`public/forge-icon.svg`. **Si cambias uno, cambia el otro.** El arco va en
`currentColor` y las brasas siempre en `#E8590C`, que no cambia con el tema.
Los PNG de `public/icons` y `public/og.png` salen del mismo trazado
(`docs/rediseno/marca/`).

El nombre se escribe **«Forge OS»**, nunca «FORGE OS».

## Registro: el formulario y el servidor tienen que decir lo mismo

El formulario anunciaba contraseñas de 6 caracteres y el servidor exigía 8.
Ahora el mínimo está en `PASSWORD_MIN` (`src/pages/api/auth/register.ts`) y en
`auth.password.hint`; si mueves uno, mueve el otro.

El endpoint devuelve `{ error_field, error_code }`, no frases: la traducción la
pone el cliente desde las claves `err.*`. Y ante un captcha fallido devuelve
**un reto nuevo**, porque el mensaje dice «prueba con la suma nueva».

Los tests e2e que se registran usan `tests/e2e/helpers/register.ts`, que
resuelve la suma leyendo la página. No se puentea el captcha en pruebas.

## Notas: Tiptap

Las notas se guardan como `{"format":"tiptap","doc":{…}}` en `pages.content_json`.
Cuatro cosas que no se ven en el código:

- **Un solo esquema.** `src/lib/notes/schema.ts` lo usan el editor y la
  validación del servidor (`validateNoteDoc`). Si añades un tipo de bloque solo
  en el cliente, el servidor rechazará cada guardado que lo lleve: fue lo que
  pasó con las tablas en Editor.js, que se borraban al guardar sin avisar.
- **Las notas de Editor.js se convierten al leerlas** (`loadNote`). Si al
  convertir se pierde algún bloque, la nota se enseña pero **no se guarda**:
  el primer autoguardado sobrescribiría el original.
- **El asa de arrastre es propia** (`components/notion/editor/dragHandle.ts`).
  `@tiptap/extension-drag-handle` arrastra `yjs` y una segunda copia de
  ProseMirror; no la reinstales.
- **El texto ya no viaja como HTML**, así que no hay DOMPurify: la defensa es
  el esquema de ProseMirror más `isSafeHref` para los enlaces.

## Tablas reservadas: no están rotas, están sin construir

Hay **5** tablas en el esquema que no consulta ningún código. **No son restos ni
un error**: son alcance declarado por adelantado. Se mantienen porque crear una
tabla vacía en SQLite cuesta unos bytes, mientras que borrarlas obliga a
escribir la migración dos veces cuando llegue la función.

| Tabla | Función prevista |
|---|---|
| `entry_relations`, `dynamic_views` | Tablas dinámicas fase 2 (en el roadmap del README) |
| `document_chunks` | Búsqueda semántica / RAG |
| `public_forms` | Formularios públicos |

**`labels` ya no está en esa lista.** Estuvo mucho tiempo como esquema muerto
y ahora la usan tickets, páginas y archivos; ver `src/lib/labels.ts`.

**`channels` y `messages` no están en esa lista**, aunque el chat siga sin
interfaz: las consulta `IssueService.ts` —publica un aviso en el canal
`general` al crear un ticket— y la limpieza de adjuntos de
`WorkspaceService.ts`, que las une para saber qué archivos cuelgan de un
mensaje. Borrar esas dos rompería dos caminos vivos.

Antes de dar por muerta cualquiera de ellas, comprueba si su función sigue en
el roadmap.

## Lo que ya está auditado (y cómo se comprobó)

`tests/e2e/seguridad.spec.ts` fija permisos por rol, IDOR, escalada de
privilegios, sesiones e inyección. Dos cosas que conviene saber antes de
ampliarlo:

- **Un 404 no demuestra que algo esté denegado.** Probando «¿puede un extraño
  mover este ticket?» salía 404 y parecía correcto; la ruta que se estaba
  llamando no existía —es `PATCH` y pide `position`—, así que la prueba habría
  pasado igual sin ninguna comprobación detrás. Cada caso lleva su **control**:
  la misma petición desde quien sí tiene permiso.
- **El modo cambia las defensas.** `checkRateLimit` se desactiva solo con
  `NODE_ENV=test`, que es el modo de la suite e2e: allí veinte intentos
  fallidos pasan sin bloqueo y parece que no hay protección. La hay, y se
  comprueba en `tests/rate-limit.test.ts` forzando `NODE_ENV=production`.

Comprobado y correcto: cookie `SameSite=Lax` + `HttpOnly` (bloquea CSRF en
métodos que escriben) y **ningún GET que modifique estado** salvo el callback de
OAuth, que va firmado con HMAC. La biografía se pinta dentro de
`<meta content="...">` y Astro escapa las comillas, así que no se puede salir
del atributo.

## Archivos en Drive

Los archivos de un espacio **no se guardan en el servidor**: viven en el Drive
de quien conectó la cuenta. El motivo es la salida de red —1 GB al mes en la
`e2-micro`— y condiciona todo el diseño. Cuatro cosas que no se ven en el
código:

- **El ámbito es `drive.file`**, no acceso completo. El completo es un ámbito
  restringido y Google exige para ellos una auditoría anual de pago. A cambio,
  Forge solo ve lo que crea la propia aplicación.
- **Los bytes nunca pasan por el servidor.** El servidor abre una sesión de
  subida en Drive y le da al navegador **solo la URL de esa sesión**, que vale
  para una subida. Darle el token de acceso sería darle permiso para borrar los
  archivos de los demás en ese Drive.
- **No se cree al navegador cuando dice «ya lo subí».** El id se comprueba
  contra Drive: que exista, que no esté en la papelera y que esté dentro de la
  carpeta del espacio.
- **El token de refresco va cifrado** (`src/lib/secretBox.ts`, AES-256-GCM) con
  `DRIVE_TOKEN_KEY`. Es una llave permanente al Drive de una persona y la base
  se copia entera a un bucket cada noche. Si esa clave cambia, hay que volver a
  conectar cada espacio.

Cuando se pierde el acceso —permiso revocado, cuenta borrada— **los metadatos no
se borran**: se marcan. Una lista que encoge sola parece pérdida de datos, y no
lo es: los archivos siguen en su Drive.

## Tablero: lo que no se ve en el código

- **Sprints, tiempo y puntos son funciones del espacio** (`workspaces.feat_sprints`,
  `feat_time`, `feat_points`). Se leen **solo** con `src/lib/funcionesEspacio.ts`;
  no escribas `if (ws.feat_time)` en un endpoint. Apagar no borra datos. Los
  endpoints de una función apagada responden **403 `feature_disabled`** al
  escribir (arrancar el cronómetro, registrar horas, crear o cambiar sprints);
  parar un cronómetro o borrar un sprint sí se deja, porque es limpiar. Los tests
  que usan una de esas funciones tienen que encenderla al crear el espacio.
- **La consulta del tablero está en `src/lib/tablero.ts`**, no en `board.astro`:
  la usan la página y el parcial de «ver más» (`w/[sys_tag]/board/hechas.astro`).
  Hecho va por `done_at` y se recorta a diez; las demás columnas, por `position`.
- **`done_at` se mantiene con `SET_DONE_AT`** (`src/lib/IssueService.ts`) en los
  dos caminos que cambian el estado: `IssueService.update` y `move.ts`. Un tercer
  camino tiene que usarlo, o una tarea reabierta conservaría su fecha de cierre.
- **Ordenar reescribe `position`** (`api/w/[sys_tag]/board/reorder.ts`) y devuelve
  las posiciones de antes para deshacer. Ya no hay `?sort=`.
- **El alta rápida se interpreta solo en el navegador** (`src/lib/altaRapida.ts`,
  función pura con tests). El servidor recibe campos (`due_date`, `label_ids`…) y
  no vuelve a leer la frase.
- **`due_time` es hora de pared, sin zona**, en su propia columna. No la metas en
  `due_date`: `fechas.ts` lee las cadenas de SQLite como UTC y la hora saldría
  corrida.
- **Con carriles, una tarjeta puede salir dos veces**, así que el `id` del DOM
  lleva el carril. Busca tarjetas por `data-issue-id`, nunca por
  `getElementById(issueId)`.
- **Los eventos del tablero van delegados** en `.kanban-container`: las tarjetas
  que llegan con «ver más» no tienen oyentes propios.
- **Borrar tareas pasa por `IssueService.borrarSinComprobar`**: `attachments`,
  `drive_file_links` y `resource_links` no tienen clave foránea hacia `issues`.
- **«Hoy» es el de quien mira**: `hoyEn(user.timezone)` (`src/lib/fechas.ts`), no
  `new Date()` en el servidor, que corre en UTC. La zona la guarda el navegador
  solo (`/api/user/timezone`); `null` cuenta como UTC.
- **Las subtareas no son tarjetas.** Toda lista de tareas lleva
  `parent_issue_id IS NULL` (en `tablero.ts` va dentro de `filtros()`); una lista
  nueva que se olvide de eso las enseña sueltas. Un solo nivel y `sprint_id` NULL.
- **Repetir y reabrir pasan por `IssueService.trasCambioDeEstado`**, que llaman
  `update()` y `move.ts` dentro de su transacción. `next_issue_id` es lo que
  impide crear dos siguientes con un doble clic.
- **`planned_date` es el día de trabajo; `due_date`, la entrega.** Arrastrar en
  «Próximos» cambia el primero, nunca el segundo.
- **Recordatorios**: el planificador (`lib/recordatorios.ts`) corre cada minuto
  dentro del servidor, arrancado desde el middleware; en `NODE_ENV=test` no
  arranca. `reminded_at` vuelve a NULL si cambian la fecha, la hora o la
  antelación.
- **Web Push** (`lib/push.ts`, `public/sw.js`) solo existe con `VAPID_*` en el
  entorno; sin ellas no se ofrece ni se manda nada. Sale **después** de la
  transacción del recordatorio (es red) y solo si `NotificationService.notify`
  devolvió `true`, para que los silencios valgan también fuera de la app. El
  service worker no cachea nada: una caché con sesión enseñaría datos viejos.
  El endpoint de cada suscripción lo manda el navegador y el servidor le hará
  peticiones: por eso solo se aceptan los servicios de push reales
  (`SERVICIOS_PUSH` en `lib/push.ts`), no «cualquier https que no parezca
  interno». Como mucho `MAX_SUSCRIPCIONES` dispositivos por cuenta.
- **El calendario `.ics` (`/cal/<token>.ics`) es una ruta pública**: la llave es
  el token, del que solo se guarda el hash.
- **Responsable: persona con cuenta o contacto** (`assignee_id` o
  `assignee_contact_id`, nunca los dos). Se resuelve **solo** con
  `resolver()` de `src/lib/responsables.ts`: comprueba que la cuenta sea del
  espacio y que el contacto sea de quien asigna. En los desplegables, un
  contacto es el valor `c:<id>` del mismo `<select>`, no otro campo. Los
  contactos son de la cuenta (`src/lib/contactos.ts`), no del espacio.
- **Las menciones `@` de las notas** son el nodo `mention` del esquema
  compartido (`src/lib/notes/mention.ts`). `page_mentions` las indexa al
  guardar, pero solo las de contactos de quien guarda.

## Despliegue

Guía completa en `deploy/README.md`. Tres cosas que conviene saber sin abrirla:

- **Los datos viven fuera del checkout** (`/var/lib/forge-os`), vía
  `DATABASE_URL` y `STORAGE_DIR`. Un despliegue que limpie el directorio no
  puede llevarse por delante la base de datos ni los archivos subidos.
- **`PUBLIC_SITE_URL` es obligatoria en producción.** Sin ella la app se anuncia
  como `localhost:4321` en la URL canónica y en las etiquetas OpenGraph. Va de
  la mano de `trust proxy` en `server.mjs`: detrás de Caddy, sin ambas cosas,
  `Astro.url` miente.
- **Nunca `cp forge.db`.** La base está en WAL, así que copiar el archivo da una
  copia incompleta o corrupta. Usa `scripts/backup.sh`, que va por
  `sqlite3 .backup` y verifica la copia con `integrity_check`.
