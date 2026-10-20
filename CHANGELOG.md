# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> Las entradas entre la 0.6.0 y la 1.4.0 se reconstruyeron a posteriori a partir del historial de git, agrupadas por los saltos de versión que realmente ocurrieron en `package.json`. La 1.1.0 nunca existió: se pasó directamente de la 1.0.0 a la 1.2.0.

## [1.44.0] - 2026-10-19

Fase 8 del rediseño «Taller»: portada, acceso, registro, pie y 404.

### Changed

- **Portada nueva**, la de la maqueta: el titular enseña el producto con sus propias piezas, un tablero de muestra bajo el arco de la fragua, «Qué hace» en cuatro bloques (tablero, notas, archivos, métricas) con cifras comprobables, ficha técnica y los últimos cambios sacados del CHANGELOG.
- **Acceso y registro**: panel de marca en tinta con la escena de la fragua, y el formulario con los campos y botones del sistema. Etiquetas en tipo oración, no en mono y mayúsculas.
- **404**: «La fragua está apagada», con la ruta que se pidió y, sin sesión, la salida para entrar.
- **El pie de la aplicación** es una línea: licencia, cuatro enlaces y la versión. Antes eran tres columnas con títulos en mayúsculas y un degradado debajo de cada pantalla.
- Los textos de la maqueta se corrigieron donde prometían más de lo que hay: el reloj de una tarea se para al pasar a revisión o a «Hecho» (no solo en «Hecho»), los sprints son opcionales, y una nota no «aparece en la tarea» —ese enlace no existe en la interfaz—; lo que sí comparten es la etiqueta.

### Removed

- Los cuatro componentes de la portada anterior (vitrina de capturas, rejilla de funciones, demostración tecleada y novedades) y 118 textos que solo usaban ellos.

### Fixed

- El conmutador de tema de las páginas públicas enseñaba la luna en oscuro y el sol en claro, al revés que el de la aplicación.
- El conmutador de idioma llevaba una bandera para un idioma.

## [1.43.0] - 2026-10-19

Fase 7 del rediseño «Taller»: ajustes, actividad, perfil y personas.

### Changed

- **Perfil** como en la maqueta: una banda del tono de la persona con el arco de la fragua, el avatar con sus iniciales montado encima y la biografía en grande. Sin degradados, sin iconos dentro de cajas; los espacios públicos, en una lista.
- **Actividad**: cabecera de página, pestañas segmentadas y listas sin tarjetas. Las fechas, relativas («hace 5 minutos»), y el estado de cada solicitud con su nombre en vez de la clave (`pending`).
- **Ajustes de la cuenta y del espacio**: botones, campos y paneles del sistema. La zona de borrado va en un panel con borde de error, y los títulos de sección sin icono.
- Textos en tipo oración en ajustes, perfil y actividad («Guardar perfil público», «Ajustes del espacio», «Zona de peligro»…). En español, «espacio» en lugar de «workspace».

### Fixed

- **El aviso del tablero vacío se montaba sobre las columnas** y se pisaba con su «Nada por aquí». Ahora va en una línea encima, y las columnas no repiten el mensaje cuando todo el tablero está vacío (llegó con la fase 1).
- **El perfil salía siempre en el idioma por defecto**: leía una cookie `lang` que no existe en vez del idioma que resuelve el middleware.
- La pestaña y la miga del tablero decían «Board» con la interfaz en español.
- El diálogo de borrar un espacio, los avisos para invitados y varias etiquetas de ajustes del espacio («Remove User», «Delete Rule», «Expired»…) estaban en inglés fijo.
- El selector de estado de las automatizaciones usaba las claves de Métricas en mayúsculas: ahora usa los nombres de estado.

## [1.42.0] - 2026-10-19

Fase 6 del rediseño «Taller»: Métricas.

### Added

- **Cada gráfica tiene su tabla**: un conmutador «Gráfica | Tabla» enseña los mismos datos en texto, para un lector de pantalla o para copiar las cifras.

### Changed

- **Solo las gráficas que el espacio puede llenar**: sin sprints no salen el avance ni la velocidad, y sin medición de tiempo no sale estimado y registrado. Antes salían vacías.
- Las gráficas usan los colores de estado. «Registrado» va en tinta y «Estimado» en neutro: el naranja queda para la acción.
- Textos sin tipo título ni «Alcance:» delante: «Carga por persona», «Avance del sprint», «Tareas cerradas por sprint», «Estimado y registrado». La página se llama «Métricas» (antes «Dashboard & Métricas»).

### Fixed

- **«Carga por persona» no contaba las tareas en revisión**: las tres series eran Por hacer, En curso y Hecho, y lo que estaba en revisión no aparecía en ningún sitio.
- La página de Métricas tenía todos sus mensajes en inglés fijo: «Scope: Historical Total», «Select a specific sprint above to view», «Completed», «Remaining», «No time tracking data found»…

## [1.41.0] - 2026-10-19

Fase 5 del rediseño «Taller»: tablas y archivos.

### Changed

- **Tablas**: lista en una tabla con las columnas y las filas de cada una, en lugar de tarjetas que se levantaban al pasar el ratón. La descripción dice para qué sirven, sin compararse con otro producto.
- **Una tabla abierta** enseña el tipo de cada columna debajo de su nombre. Cada opción de una columna de selección va en una píldora con un tono que no cambia de fila a fila.
- **Archivos**: dónde viven de verdad (el Drive de quien conectó el espacio) dicho arriba, y en la lista una etiqueta con el formato de cada archivo (PDF, PNG…) en vez del mismo icono para todos.
- Ventanas, campos y botones de estas pantallas, con las piezas del sistema.
- Textos en tipo oración: «Nueva tabla», «Tablas» (antes «Bases de Datos & Tablas»), y los tipos de columna sin mayúsculas.

## [1.40.0] - 2026-10-19

Fase 4 del rediseño «Taller»: las notas.

### Added

- **Índice de notas** en «Notas»: la última que abriste a un clic («Seguir con…»), las tres más recientes con su resumen y una tabla con todas, con su ruta en el árbol, etiquetas, quién la editó y cuándo, y cuántas tareas la enlazan. Antes esta página saltaba directamente a la última nota.

### Changed

- **El árbol de notas va sin caja**: una columna con su línea, filas en píldora y la nota abierta en un tinte. Sin el icono de documento repetido en cada fila; el emoji propio de una nota se conserva.
- **La nota se lee a 68 caracteres de ancho**, con el título en Archivo estrecho y, debajo, quién la escribió, cuándo y el estado de guardado. «Guardado» ya no flota abajo a la derecha encima del texto.
- **Prosa nueva**: viñetas cuadradas en naranja, código y bloques de código sobre un tinte, citas con una raya a la izquierda y tablas con la cabecera teñida.
- El resaltado de texto lleva el texto en tinta sobre un tinte naranja: el blanco sobre naranja no llegaba al contraste mínimo.

### Fixed

- «Draft», «Copy Link to Page» y «Toggle Sidebar» salían en inglés con la interfaz en español. El árbol vacío decía «EMPTY_SPACE».

## [1.39.0] - 2026-10-19

Fase 3 del rediseño «Taller»: Panel e Inicio.

### Changed

- **Panel del espacio** sin tarjetas de cifras sueltas. Arriba, el estado del trabajo: del sprint activo si se usan sprints, o de la semana si no. Son tres cifras que sirven para decidir y una barra con el color de cada estado. Debajo, tus tareas, los sprints o las próximas entregas, y a la derecha la carga por persona (en colores de estado, nunca en rojo) y la actividad. La carga solo aparece si hay más de una persona en el espacio.
- **Inicio** sin saludo ni banner. Lo pendiente para ti, agrupado por espacio, y tus espacios en una tabla con rol, personas y tareas abiertas. Con lo social encendido, una línea que dice cómo invitar a alguien, en vez de «Forge es mejor con amigos».
- Las tablas de tareas ya no enseñan el id hexadecimal y sus cabeceras van en tipo oración.
- Textos en tipo oración: «Abrir tablero», «Actividad reciente», «Tus tareas», «Crear espacio», «Tus espacios»… («Workspace» ya no aparece en la interfaz en español).

## [1.38.0] - 2026-10-19

Fase 2 del rediseño «Taller»: el armazón.

### Changed

- **Barra lateral nueva**: mismo fondo que la página, enlaces en píldora sin iconos y el activo en tinta con el punto naranja. El espacio lleva su nombre y su `#etiqueta`, y debajo su sección. Tablero y Notas dicen cuántas tareas quedan y cuántas notas hay.
- **Nombres que ya no se pisan**: «Inicio» (antes «Mi Hub»), «Panel» (antes «Panel Principal»), «Tablero», «Notas», «Tablas», «Archivos», «Métricas» y «Ajustes del espacio». Las mismas palabras en la barra lateral y en la del móvil.
- **Barra superior** sin desenfoque ni sombra. La raya naranja que latía arriba en modo administración es ahora una etiqueta «Administración».
- **Navegación del móvil**: la pestaña activa en tinta sobre un tinte, y la hoja «Más» con asa y velo.
- Avisos y búsqueda con las mismas piezas que el resto, sin parpadeos y con la letra a 12 px como mínimo.

### Fixed

- La barra superior tenía texto en inglés fijo: «Searching…», «No results found», «Search error», «Accept», «Reject», «Delete notification», «SILENT_COMM» y los atajos de la búsqueda. Ahora sale en el idioma elegido, como el tipo de cada resultado.
- El cambio de idioma enseñaba una bandera. Una bandera no es un idioma: ahora dice «ES» o «EN».

## [1.37.0] - 2026-10-19

Fase 1 del rediseño «Taller»: el tablero.

### Changed

- **Columnas con forma de arco**, como la boca de la fragua del logo. Cada una va teñida del color de su estado y lleva el rótulo y la cifra grandes. Caben cuatro columnas a 1280 px sin desplazar de lado.
- **Tarjeta compacta**: título, tipo, etiquetas, señales (prioridad, repetición, subtareas, notas), fecha y responsable. La descripción y el id hexadecimal se quedan en el panel. El color del tipo va en una muesca arriba, no en una franja lateral, y nada se mueve al pasar el ratón.
- **Responsable en arco** con iniciales y el tono de cada persona. Los contactos sin cuenta llevan borde discontinuo.
- **Cabecera y barra nuevas**: el título entero, y debajo dos grupos: a la izquierda lo que cambia qué se ve (vista, sprint, etiqueta, filtros, carriles) y a la derecha lo que hace algo (ordenar, sprint, nueva tarea con su atajo C).
- **El panel del ticket es un cajón** que flota sobre el tablero, con el título grande y campos, botones y ventanas iguales en todas partes.
- **Alta rápida**, vistas Hoy y Próximos y carriles por etiqueta con el mismo lenguaje. En Próximos, un día sin tareas ocupa una sola línea.
- Etiquetas como píldoras teñidas de su color, con el texto siempre en tinta.

### Fixed

- La barra de tiempo del panel pasaba por verde y naranja antes del rojo. Ahora va en tinta y solo se pone roja al pasarse de lo estimado.
- «Points saved» salía en inglés al cambiar los puntos.

## [1.36.0] - 2026-10-19

Primera fase del rediseño «Taller», camino de la 2.0. El diseño aprobado y sus razones están en `docs/rediseno/` y `docs/rediseno-diagnostico.md`.

### Changed

- **Colores nuevos**: tinta sobre papel gris cálido en claro y grafito cálido en oscuro, con el naranja solo para la acción. Todo el texto pasa AA en los dos temas.
- **Tipografía propia**: Archivo para la interfaz y IBM Plex Mono para código y atajos, servidas desde el propio servidor. Ya no se pide nada a Google Fonts.
- **Logo nuevo, «Fragua»**: la boca de una fragua con las brasas dentro. También son nuevos el favicon, los iconos para instalar la aplicación y la imagen para redes.
- **Los estados se llaman igual en todas partes**: «Por hacer», «En curso», «En revisión» y «Hecho». Cada uno tiene su color, que comparten el tablero, las tablas y las gráficas.
- Las gráficas de Métricas toman los colores del tema y se repintan al cambiarlo.
- El anillo de foco del teclado es de tinta, no naranja.

### Fixed

- Siete textos tenían opacidad y quedaban por debajo del contraste mínimo.

## [1.35.0] - 2026-10-19

### Added

- **Contactos: personas sin cuenta en Forge** (migración 54). Un compañero de clase al que le toca una parte del trabajo puede ser responsable de una tarea sin registrarse. Están en el mismo desplegable de responsable que los miembros —en el panel, en el alta y en el filtro del tablero— y «Nuevo contacto…» los crea sin salir de donde estás. En la tarjeta salen con sus iniciales y un borde discontinuo.
- **`@nombre` en el alta rápida** asigna la tarea a un miembro o a un contacto. Vale el primer nombre si nadie más lo comparte. Un `@algo` que no es nadie se queda en el título: puede ser un correo.
- **Menciones `@` en las notas**, a miembros y contactos. El nombre se guarda dentro de la nota, así que quien la comparte lo ve aunque no tenga acceso a tus contactos.
- **La libreta de contactos** (`/contacts`, en el menú de la cuenta): crear, renombrar y borrar contactos. La ficha de cada uno enseña sus tareas y las notas donde aparece. Es de tu cuenta, no de un espacio, así que sirve en todos tus espacios. Borrar un contacto deja sus tareas sin asignar y sus menciones como texto.

### Security

- **Al editar una tarea se podía asignar a cualquier cuenta de Forge**, aunque no fuera del espacio, y esa cuenta recibía una notificación con el título de la tarea. Al crearla sí se comprobaba. Ahora las dos rutas pasan por la misma regla (`lib/responsables.ts`).
- Solo puedes asignar o mencionar a tus propios contactos. Un id ajeno metido a mano en la petición o en el documento de la nota no sirve. Quien comparte el espacio puede editar una tarea asignada a tu contacto sin quitárselo.

## [1.34.0] - 2026-10-19

### Added

- **Avisos Web Push**: los recordatorios llegan aunque Forge esté cerrado. Se activan en Ajustes → «Activar avisos», y el navegador pide el permiso solo al pulsarlo. Hace falta configurar unas claves VAPID en el servidor (ver `deploy/README.md`); sin ellas, la opción no aparece. Los silencios de notificaciones valen también para estos avisos. El *service worker* no guarda nada en caché.

### Security

- El servidor solo manda avisos a los servicios de push de los navegadores: Google, Mozilla, Apple y Microsoft. La dirección de cada suscripción la manda el navegador, y sin esa lista el servidor haría peticiones a donde le dijeran, incluida su propia red interna.
- Como mucho 10 dispositivos por cuenta, para que una cuenta no pueda multiplicar las peticiones que el servidor hace por cada recordatorio.
- Al pulsar un aviso solo se abren direcciones del propio sitio: `//otro-sitio` también empieza por «/» y antes se colaba.

## [1.33.0] - 2026-10-19

### Changed

- **Automatizaciones y auditoría se encienden por espacio** (migración 51), como ya pasaba con sprints, tiempo y puntos. Están pensadas para equipos y, en un espacio de una sola persona, solo ocupaban sitio en Ajustes. Vienen apagadas, salvo en los espacios que ya tenían reglas (automatizaciones) o más de un miembro (auditoría). Con las automatizaciones apagadas, las reglas se conservan pero no se ejecutan, y crearlas o reactivarlas responde 403. La auditoría se sigue registrando aunque esté apagada: solo se esconde.
- **Amigos y solicitudes se encienden por cuenta** (migración 52), en Ajustes, junto al perfil público. Apagados, desaparecen «Personas» y el banner «Forge es mejor con amigos» del Hub, y nadie puede mandarte solicitudes ni bloquearte: `canInteractSocially` lo trata igual que a un invitado, en los dos sentidos. Mirar perfiles sigue funcionando. Vienen apagados, salvo para quien ya tenía amistades, solicitudes enviadas o bloqueos puestos. Recibir una solicitud o un bloqueo no cuenta como usarlo.

### Fixed

- **El Hub le decía «Lector» al dueño de todos sus espacios.** Fuera de un espacio no hay papel que tener, y el valor por defecto era «lector». Ahora se ve tu `@usuario`.
- **Al añadir dos subtareas seguidas, la segunda podía perderse.** El campo se vaciaba al volver la respuesta del servidor y borraba lo que ya se estaba escribiendo. Además, una subtarea añadida antes de que llegara la lista al abrir el panel desaparecía de la vista.
- Los textos de la auditoría que seguían en inglés («Filter by user...», «All Actions») pasan por el diccionario.
- **Tests que fallaban a veces con la suite entera en marcha.** Compartían espacios, tareas o ids fijos con otros que corrían en paralelo, o pulsaban antes de que el tablero estuviera listo. Ahora cada ejecución usa sus propios espacios, y el tablero avisa cuando ya responde a los clics.

## [1.32.0] - 2026-10-19

### Added

- **Recordatorios** antes de una entrega («recordar 1 h antes»), como notificación de la aplicación, en la zona horaria de quien los recibe. Los recibe quien tiene la tarea asignada, o quien la creó si no tiene responsable, y solo mientras siga siendo miembro del espacio. Migración 50.

## [1.31.0] - 2026-10-19

Vistas por fecha, subtareas, repeticiones y lo que hace falta para organizarse sin sprints.

### Added

- **Vistas «Hoy» y «Próximos»** junto al tablero. «Hoy» enseña lo vencido y lo de hoy; «Próximos», una agenda de catorce días (ampliable). Ninguna enseña las hechas, y las dos ignoran los sprints.
- **La zona horaria de cada persona** (`users.timezone`, migración 43), que el navegador manda sola. «Hoy» y «vencida» se calculaban en el servidor, que corre en UTC: en Bogotá, a partir de las siete de la tarde, el servidor ya creía que era mañana.
- **Subtareas** dentro del panel de una tarea: se añaden con Enter, se marcan y la tarjeta enseña «2/5». No son tarjetas del tablero ni cuentan en ningún total. Al terminar la última se ofrece completar la tarea. Migración 44.
- **Tareas que se repiten** («cada lunes», «cada 2 semanas», «el día 15 de cada mes», «cada fin de mes»), desde el alta rápida o el panel. Al completarla se crea la siguiente con sus etiquetas, apuntes y subtareas pendientes; la base es la fecha prevista y no el día en que se completa, y un retraso de varias semanas crea una sola. «Hoy» es el de quien completa, no el del servidor. Reabrir la deshace solo si nadie ha tocado la siguiente: ni el título, las horas, el estado, las etiquetas, los apuntes o las subtareas, ni le ha colgado adjuntos, archivos de Drive o registros de horas. Migración 45.
- **Fecha de trabajo** aparte de la de entrega («hacer el martes»). «Próximos» coloca cada tarea en el día en que se hace y arrastrar cambia ese día, nunca la entrega. Migración 46.
- **Vistas guardadas**: filtros por prioridad, «vence en los próximos N días» y responsable, guardados con nombre en la barra lateral. Son personales. Migración 47.
- **Plantillas de tareas** («Guardar como plantilla» en el panel, «Desde plantilla» o `/nombre` en el alta), con su entrega relativa. Las etiquetas que ya no existen se saltan y se dice. El botón no sale a quien solo puede mirar. Migración 48.
- **Calendario `.ics`** de solo lectura para suscribirse desde Google Calendar (Ajustes de la cuenta): solo entregas pendientes, sin descripción, con el token guardado como hash y la pertenencia a cada espacio comprobada en cada petición. Migración 49.
- **El resumen de un espacio sin sprints** enseña la semana —terminadas en los últimos siete días y vencidas— y las próximas entregas, en vez del sprint activo y el roadmap.

## [1.30.0] - 2026-10-19

Un tablero que también sirve para usarlo a solas.

### Added

- **Sprints, medición de tiempo y puntos son funciones que se encienden por espacio** (Ajustes del espacio → Tablero). Forge se pensó para equipos que planifican por sprints; usado a solas —para la universidad, por ejemplo— el selector de sprint, el cronómetro de cada tarjeta y el campo de puntos solo estorbaban. Apagar no borra nada: `sprint_id`, los registros de horas y los puntos se quedan en la base y vuelven al encender. Los espacios nuevos nacen con todo apagado; los que ya existían encienden solo lo que ya usaban. Con los sprints apagados, el tablero enseña todas las tareas a la vez. Migración 40.
- **Alta rápida.** «Entregar taller viernes 18:00 #Cálculo !1 [[Tema 3]]» crea la tarea con su fecha, hora, etiqueta, prioridad y apunte vinculado. Lo reconocido sale como chips que se pueden quitar, y quitar uno devuelve sus palabras al título. La prioridad se escribe con `!1`–`!4` o por su nombre (`!urgente`, `!alta`, `!normal`, `!baja`, y en inglés). Una etiqueta que no existe no se crea sola: se ofrece. Se abre con `C` desde cualquier página del espacio, no solo desde el tablero.
- **El formulario de alta deja poner etiquetas, apuntes, prioridad y hora** al crear la tarea, en la misma transacción. «Crear y abrir» abre el panel de la tarea nueva para adjuntarle archivos.
- **Prioridad visible.** La columna existía desde el principio y solo servía para ordenar. Ahora se pone en el panel y en el alta, y la tarjeta lleva una bandera con texto cuando no es la normal.
- **Hora de entrega**, aparte de la fecha y como hora de pared (sin zona): una entrega «a las 18:00» vence a las 18:01 de ese día, no al siguiente. Migración 42.
- **Completar con un clic**, con un círculo en cada tarjeta y «Deshacer» en el aviso.
- **Agrupar el tablero por etiqueta**: un carril por etiqueta con sus cuatro columnas. Una tarea con dos etiquetas sale en los dos carriles; arrastrar entre carriles no cambia etiquetas.
- **Apuntes vinculados en el panel de la tarea**, con buscador. La tarjeta enseña cuántos tiene.
- **Mover una tarea a otro sprint desde la propia tarjeta**, y **borrar un sprint decidiendo qué pasa con cada tarea**: al backlog, a otro sprint o borrarla. Antes solo se podía mandarlas todas al mismo sitio. «Gestionar sprints…» lista los sprints para borrarlos también desde el backlog.

### Changed

- **«Hecho» enseña las diez últimas terminadas**, con «Ver más». Crecía sin límite y cargaba cien tarjetas que casi nunca se miran. Para saber cuándo terminó cada una hay una columna nueva, `done_at` (migración 41).
- **Ordenar es una acción, no una vista.** Elegir «por prioridad» reescribe el orden de las columnas una vez, con «Deshacer», y se puede seguir arrastrando. Antes cambiaba solo la consulta y el arrastre quedaba bloqueado hasta volver al orden manual. Con un filtro de etiqueta se ordenan solo las filtradas, en los huecos que ya ocupaban: las demás no se mueven y, al quitar el filtro, la columna no sale entremezclada.
- En español, la tarea se llama «tarea» en todo el tablero: el modal decía «Crear Issue» y el botón «Nuevo ticket».
- El aviso flotante admite un botón de acción («Deshacer», «Ver») y ya no se esconde antes de tiempo cuando llegan dos seguidos.
- El puerto del servidor de pruebas e2e se puede cambiar con `E2E_PORT`, para que dos ejecuciones a la vez no choquen.

### Fixed

- **El backlog no se podía dejar como vista por defecto.** La cookie `backlog` no redirigía, pero el tablero abría igualmente el sprint activo porque la URL seguía sin `sprint=`.
- **Las fechas salían en mm/dd/yyyy con la aplicación en español.** El `<input type="date">` nativo usa el idioma del navegador, no el de la página, y ningún atributo lo cambia. Ahora es un campo de texto en el formato del idioma de la app (`dd/mm/aaaa`) con el calendario nativo detrás de un botón.
- **Cambiar el tipo de una tarea en el panel la dejaba mal pintada hasta recargar**: la insignia enseñaba la clave cruda («task», «incidencia-critica»), la franja no cambiaba de color y salía «Type saved» en inglés aunque el servidor lo hubiera rechazado.
- **La insignia del tipo salía en mayúsculas** («HISTORIA»). Enseña el nombre visible del tipo tal como lo dice el panel.
- **«Borrar» y «Duplicar» salían en el panel a quien solo puede mirar.** Se comprobaba `body[data-user-role]`, que nunca vale «viewer»; el servidor sí lo denegaba.
- **El nombre del espacio se recortaba en la cabecera del tablero** («Atlas Platform Boa…»). Ahora se parte en líneas y se lee entero en cualquier ancho.
- **Borrar una tarea dejaba huérfanos** sus adjuntos (filas y ficheros en disco) y sus vínculos a archivos de Drive y a recursos.
- Textos que estaban en inglés a mano en el tablero: los botones del cronómetro, «(Active)», «(Completed)», «Name required», la ayuda de los puntos y el aviso al cambiar de sprint.

## [1.29.0] - 2026-10-18

### Added

- **Las notas se pueden mover.** Antes, para meter una nota dentro de otra había que crear una subpágina vacía y copiar el contenido a mano, y no había forma de cambiar el orden: las notas salían por fecha de creación. Ahora:
  - **Arrastrando en el árbol.** Si sueltas la nota en el borde superior o inferior de otra, se coloca antes o después de ella. Si la sueltas en el centro, entra como subpágina.
  - **Con «Mover a…»**, en las acciones de cada nota, para moverla sin arrastrar: con teclado o en el teléfono. La lista no ofrece los destinos imposibles: la propia nota y sus subpáginas.
- El servidor comprueba que el destino es del mismo espacio y que una nota no acaba dentro de sí misma ni de una de sus subpáginas. Eso la desengancharía del árbol entero junto con todo lo que cuelga de ella.
- Migración 39: `pages.position`. Conserva el orden que se veía hasta ahora: por fecha de creación dentro de cada nivel.

### Fixed

- **El árbol de notas se cerraba al cambiar de página.** Cada nota se carga entera y el árbol olvidaba qué carpetas habías abierto, así que para repasar varias notas de una carpeta había que abrirla una y otra vez. Ahora lo recuerda el navegador, y al entrar en una nota se abren su carpeta y las de encima.
- Las acciones de cada nota en el árbol solo aparecían al pasar el ratón. Ahora también salen con el foco del teclado y siempre en pantallas táctiles. Quien solo puede leer el espacio ya no las ve, porque el servidor se las rechazaba igualmente.

## [1.28.5] - 2026-10-18

> La 1.28.3 no existió: este cambio llevaba ese número en su PR, pero entró en `main` después de la 1.28.4.

### Fixed

- **«Termina hoy» llegaba un día antes.** El resumen del espacio contaba los días que le quedan al sprint activo restando horas a un `new Date(end_date)`, que para una fecha solo-día es la medianoche UTC. En Bogotá decía «termina hoy» desde las siete de la tarde del día anterior, y en Tokio, el último día por la mañana, todavía decía «termina en 1 día». Ahora cuenta días del calendario con `diasHasta()`, que tampoco se equivoca en los días de 23 o 25 horas del cambio de hora. Hoy la interfaz crea los sprints sin fechas, así que solo se veía en los que las reciben por la API o por el seed.
- **La foto diaria del burndown se guardaba con la fecha de mañana por la tarde.** El día de la foto salía en UTC, así que desde las siete de la tarde en Bogotá la de hoy se guardaba como la de mañana, y la del día real se quedaba como estaba a las 18:59. Ahora usa el día en la zona del servidor, igual que `vencida()`.
- **Elegir una fecha de entrega justo al abrir un ticket a veces no se quedaba en el campo.** Al abrir el modal, los datos del ticket se cargan dos veces, y si la segunda respuesta llegaba después de elegir la fecha, el campo volvía a la anterior aunque la nueva ya se hubiera guardado. Ahora el campo no se toca mientras se está editando, como ya pasaba con las horas estimadas. Era también la causa de que `fecha-y-cancelar.spec.ts` fallara de vez en cuando con la suite entera.
- La línea de tiempo de sprints del resumen lee las fechas con `deSQLite()`, como el resto, en vez de `new Date()`, que leía una fecha solo-día como UTC y una marca de SQLite como hora local.

## [1.28.4] - 2026-10-18

### Fixed

- **En producción, las entregas de hoy salían vencidas por la noche.** La app decide qué día es hoy con la zona del proceso —el rojo de «vencida» en las tarjetas servidas, el contador del Hub, el día de la foto del burndown— y el servicio no fijaba ninguna, así que en la VM corría en UTC: desde las siete de la tarde en Bogotá ya creía que era mañana. El unit de systemd fija ahora `TZ=America/Bogota`, la misma zona con la que corren las pruebas e2e. Las fechas guardadas no cambian.
- Una instancia ya desplegada tiene que copiar el unit una vez, porque `deploy.sh` reinicia el servicio pero no lo reinstala. Los pasos están en `deploy/README.md`, en «La zona horaria».

## [1.28.2] - 2026-10-18

### Fixed

- **Las fechas de entrega salían un día antes al oeste de UTC.** Una entrega puesta para el 9 de septiembre se veía «8 sept 2026» en Colombia. `due_date` se guarda como `'2026-09-09'` —un día del calendario, sin hora ni zona— y `deSQLite()` le añadía la `Z` que sí necesitan las marcas de `CURRENT_TIMESTAMP`, así que pasaba a medianoche UTC, que en Bogotá son las siete de la tarde del día anterior. Ahora una fecha solo-día se lee como ese día en la zona de quien mira, tanto en la tarjeta que pinta el servidor como en el modal del navegador, y también en la lista de «Mis Tareas» y en cualquier otra fecha guardada solo con el día que pase por `fecha()`. Las marcas de tiempo siguen leyéndose en UTC.
- **Una entrega de hoy se ponía en rojo al tocar el ticket.** El modal recalculaba «vencida» con su propia comparación —medianoche del día de entrega contra la hora actual—, que la daba por vencida desde las 00:00 de ese mismo día, mientras la tarjeta servida decía que no. Ahora los dos usan `vencida()`.
- Al abrir un ticket, el campo de fecha del modal se rellena con el día guardado tal cual, en vez de pasarlo por `toISOString()`, que da el día en UTC.
- Las pruebas e2e corren el servidor y el navegador en `America/Bogota`. En UTC, que es la zona de CI, este fallo no se veía.

## [1.28.1] - 2026-10-18

### Security

- **Dependencias con avisos de seguridad que llegan a producción.** `npm audit` contaba 22 avisos, dos de ellos críticos, y Dependabot llevaba parado desde agosto, así que nadie los había propuesto. Los que importaban:
  - `@astrojs/node` ≤ 11.1.2: una cabecera `Host` con un puerto malformado podía tumbar el servidor. Pasa a 11.1.8.
  - `astro` ≤ 7.2.7 (crítico): pasa a 7.4.0.
  - `engine.io` (a través de `socket.io`), `devalue`, `proxy-addr`, `undici` y otros transitivos.

  Todo se queda dentro de la misma versión mayor. Quedan 6 avisos moderados sin arreglo real, en `drizzle-kit` y `@tailwindcss/typography`; ver CLAUDE.md.
- Astro 7.4 deja de rechazar los POST que no traen ni `Origin` ni `Sec-Fetch-Site`. Son peticiones de clientes que no son un navegador (`curl`), que no llevan las cookies de nadie y por tanto no son un vector de CSRF. Un POST hecho desde otro sitio con un navegador sigue recibiendo 403. El test que daba por hecho lo primero ahora simula el ataque real.

## [1.28.0] - 2026-10-18

### Changed

- **Las notas pasan de Editor.js a Tiptap.** Escribir en la base de conocimiento iba en contra de todo lo que uno espera de un editor, y casi todo venía de la misma raíz: Editor.js pinta cada párrafo como un bloque aparte. Por eso seleccionar, copiar o cortar varios párrafos no funcionaba, «1. » no creaba una lista (había que ir al menú del «+») y las líneas en blanco desaparecían al recargar, porque al guardar se descartaban los párrafos vacíos. Con Tiptap (sobre ProseMirror) el documento es uno solo:
  - Atajos al escribir: «1. », «- », «[] », «# », «> », «```» y «---».
  - Selección, copia y pegado normales entre párrafos, también desde otras páginas.
  - Un menú flotante al seleccionar texto (negrita, cursiva, subrayado, tachado, resaltado, código y enlace) y un menú «/» para insertar bloques.
  - Un asa a la izquierda de cada bloque para arrastrarlo, y un menú propio para añadir o quitar filas y columnas de las tablas.
  - Las líneas en blanco se guardan.
- **Las notas existentes se convierten al abrirlas.** Cada bloque de Editor.js tiene su equivalente, salvo dos que se acercan: los títulos de nivel 4 a 6 pasan a nivel 3, y los avisos pasan a una cita con el título en negrita. Si una nota tiene algún bloque que no se puede convertir, se enseña sin él, con un aviso, y **no se guarda**: el primer autoguardado habría sobrescrito el original.
- **El servidor valida las notas con el mismo esquema con el que escribe el editor** (`src/lib/notes/schema.ts`). Con Editor.js eran dos listas separadas —la del editor y la del sanitizador— y por esa diferencia las tablas se borraban al guardar sin que nadie se enterara. Como el texto ya no viaja como HTML, desaparecen el sanitizador y DOMPurify; los enlaces siguen pasando la misma regla de protocolos.
- Un cliente viejo que intente guardar en formato de Editor.js recibe un 400: escribirlo otra vez desharía la conversión.
- La cifra de la portada sobre lo que llega al navegador pasa de 199 a 252 KB. Ya estaba desfasada antes de este cambio (`main` medía 210 KB), y el editor nuevo pesa más que el anterior.

### Removed

- Los 14 paquetes de Editor.js y sus plugins, `isomorphic-dompurify` y `src/lib/sanitizer.ts`.

## [1.27.1] - 2026-09-08

### Fixed

- **La fecha de entrega cambiaba de formato al editarla.** La tarjeta la pinta el servidor con el idioma de la aplicación —«9 sept 2026»— y al cambiarla desde el modal se reescribía **dentro de la propia tarjeta** con un `toLocaleDateString()` sin argumentos, que usa el idioma del navegador: «9/09/26». Es el mismo fallo que se corrigió en la 1.25.0 para la tarjeta, del que quedó una copia suelta en el modal. Ahora las dos llaman a `fecha()`.
- **«Cancelar» al crear una base de datos hacía lo mismo que la equis.** El alta tiene dos pasos —elegir plantilla y rellenar el formulario— y cancelar en el segundo cerraba el diálogo entero, así que «me he equivocado de plantilla» se convertía en «empieza de cero». Ahora vuelve a la galería, y solo cierra si ya estabas en ella.

## [1.27.0] - 2026-08-23

### Security

- **Rechazar una solicitud de amistad que no existe devolvía la fila entera de la tabla.** El 404 incluía un `dbState` con el `SELECT *` de la amistad —`action_user_id`, el id de la otra persona, las marcas de tiempo— a quien acababa de fallar la comprobación de permisos, y había además un `console.log` de cada intento. Era depuración que se quedó puesta, y convertía un «no puedes» en un volcado de la tabla. Sus dos hermanos, aceptar y cancelar, responden con la frase a secas: este era el único de los tres que se salía del patrón.

### Fixed

- **El hub marcaba como vencida una tarea que vence hoy.** El contador comparaba con `new Date().toISOString()`, que da el día en UTC: en Bogotá, a partir de las siete de la tarde, el servidor ya cree que es mañana. `lib/fechas.ts` documenta ese caso exacto en su comentario y expone `vencida()` desde entonces —la tarjeta del tablero ya la usa—, pero este contador reimplementó la comparación por su cuenta y se trajo el fallo de vuelta. No falla nunca por la mañana, así que es de los que se descartan como manía de uno.
- **Renombrar un tipo de ticket de fábrica no se veía en ninguna parte.** La regla que decide qué nombre enseñar estaba copiada **cinco veces** —tarjeta, tabla del hub, modal, desplegable del tablero y ajustes— y las cinco ignoraban el nombre escrito cuando el tipo era de fábrica: siempre ganaba la traducción de la clave. Llamar «Incidencia» a «Task» solo se veía al volver a abrir el diálogo de renombrar, que lo lee de otro sitio.
- La regla buena es la que el proyecto ya aplica a las etiquetas y a los tipos propios: **lo que escribe una persona no se traduce**. Ahora se traduce mientras el tipo esté intacto —quien nunca renombra, que es casi todo el mundo, sigue viendo «Tarea» y «Task» según el idioma— y en cuanto alguien le cambia el nombre gana el suyo en los dos. Se decide comparando contra el nombre con el que nació, no mirando solo `is_builtin`.
- Las cinco copias pasan a una sola función, `nombreVisible()`, junto a `mapaPorClave()` que ya existía para esto mismo. Cinco copias de la misma expresión es exactamente cómo se llegó aquí.
- **No se podían poner horas estimadas al crear un ticket**, y el hueco estaba en las dos capas: el formulario no tenía el campo y `IssueService.create()` ni siquiera incluía la columna en su `INSERT`, mientras `update()` sí la tenía entre sus campos permitidos. La única forma de estimar era crear el ticket y volver a abrirlo. `due_date`, un campo idéntico en dificultad, sí estaba: fue un olvido, no una decisión.
- El número se limpia en el servidor. Llega de fuera, así que un texto, un negativo o un `Infinity` habrían entrado tal cual en una columna `REAL` y habrían salido después en los totales del sprint.
- Dos mensajes del formulario que estaban escritos en inglés a mano —«Title is required» y «Creating...»— pasan por el diccionario.

- **Las etiquetas de una tarea no salían en «Mis Tareas» del hub**, aunque la misma tarea sí las enseñara en el tablero — y el hub es justo donde se mira para decidir qué tocar. Faltaban las dos mitades: la consulta no las traía y la tabla no tenía dónde ponerlas. Se leen con `deVarias()`, el mismo lector en lote que ya usa el tablero.
- **El panel de atajos de la base de conocimiento prometía teclas que el navegador se queda.** Listaba `Ctrl+K` para insertar un enlace —que va a la barra de búsqueda del navegador— y `Ctrl+U` para subrayar, que abre «ver código fuente»; ningún `preventDefault()` de la página los recupera de forma fiable, así que quien los probaba concluía que la aplicación falla. Se quitan los dos y se dejan los que sí funcionan. Sus cinco textos estaban además escritos en inglés a mano: solo el título pasaba por el diccionario.

## [1.26.2] - 2026-08-20

### Fixed

- **La página se podía empujar de lado, y se quedaba así.** `overflow: hidden` frena el dedo pero **no** al código, y Editor.js llama a un `scrollIntoView()` por cada bloque que enfoca. El contenedor se corría en horizontal y ahí se quedaba: texto cortado por la izquierda y la barra inferior arrastrada con él. Ahora el armazón lleva `overflow-x: clip`, que no admite desplazamiento de ninguna de las dos formas.
- **El menú lateral de escritorio seguía en el DOM en móvil**, con `-translate-x-full`: 240 px de contenido plantados en `left: -240`. Desde que la barra inferior sustituyó a la hamburguesa ya no había forma de abrirlo, así que era peso muerto que además ensanchaba la región desplazable del documento. Ahora no se renderiza por debajo de `md`.

## [1.26.1] - 2026-08-20

### Fixed

- **La barra de navegación de móvil no se veía en un teléfono real.** Era el último hijo de una columna de `100vh`, y `100vh` en un navegador móvil **no es la altura visible**: es la que habría con las barras del navegador retraídas. El contenedor era más alto que la pantalla y la barra caía por debajo del corte. En el emulador no pasaba, porque allí el viewport y `innerHeight` coinciden — por eso las pruebas estaban en verde. Ahora la barra va `fixed`, anclada a lo que se ve, y el armazón mide `100dvh`.
- **Al cerrar el teclado, la página se quedaba corrida hacia un lado**, con el texto cortado por la izquierda. Faltaba `interactive-widget=resizes-content` en la etiqueta `viewport`: sin eso el navegador no encoge la maqueta al abrir el teclado, la deja igual y desplaza el viewport visual por encima.
- **El menú del sprint se salía de la pantalla.** Se ancló primero a la derecha del botón y luego a la izquierda, y cada versión fallaba en la mitad de los tableros: en qué columna de la rejilla cae el botón depende de si el espacio tiene etiquetas, porque el filtro «Todas las etiquetas» solo se pinta entonces. Ahora se fija a los dos bordes de la pantalla y deja de depender del botón.
- **El botón que abre el índice de la base de conocimiento pasa a la fila del título.** Flotando chocaba con el contenido las dos veces que se intentó — abajo quedaba fuera del área visible, arriba tapaba el título de la página. Dos colisiones seguidas eran la señal de que el sitio equivocado era «flotando», no «arriba» o «abajo».
- **No se podía crear la primera página desde un teléfono.** Consecuencia del cambio anterior: el botón se movió a la fila del título del editor, y el índice de la base de conocimiento **no tiene editor**. Esa pantalla se quedó sin ninguna forma de abrir el árbol, mientras su propio texto seguía señalando un botón que ya no existía. Ahora tiene el suyo, y una prueba fija que desde el índice se pueda llegar a crear una página — no dónde está el botón, para que se pueda volver a mover sin romperlo en silencio.
- El botón «Crear Workspace» del hub apilaba el icono encima del texto, así que en móvil ocupaba una tarjeta de 140 px de alto para dos palabras. En horizontal cabe en una fila.

## [1.26.0] - 2026-08-19

### Added

- **Rediseño móvil del espacio de trabajo, fase 4 del plan.** Móvil deja de ser el escritorio encogido: barra inferior de cuatro pestañas (Panel, Tablero, Páginas, Más) que sustituye a la hamburguesa, con una hoja para lo que no cabe.
- **Tablero en móvil.** Una columna a ancho completo con un conmutador de estado, en vez de cuatro columnas de 320px en 360 de pantalla. Mover un ticket se hace desde un desplegable en la tarjeta, porque el arrastre HTML5 del tablero no dispara con eventos táctiles.
- **Modal de ticket en móvil.** Los cuatro pares de campos se apilan en vez de partirse en columnas de 150px, y la cabecera se envuelve en vez de abrir un desplazamiento horizontal.
- **Tabla dinámica en móvil.** Cada fila pasa a ficha, con el campo principal de título y el resto plegado tras «N campos más».

### Fixed

- **La regla que garantiza el área táctil resucitaba `.hidden`.** `a, button { display: inline-flex }` en `themes.css` ganaba a las utilidades de Tailwind por especificidad, así que por debajo de 768px `.hidden` dejaba de esconder nada: en el móvil aparecían los controles de información, tema, idioma y registro que el código manda ocultar por no caber. La misma regla forzaba `display` sobre enlaces que ya traían el suyo, y las tarjetas del panel que son enlaces —rótulo arriba, cifra debajo— se volvían filas.
- **Varios `z-50` puestos para ganar a un tooltip también ganaban al panel de notificaciones y al cajón lateral.** El botón «+ Nuevo ticket» se pintaba encima del panel de avisos abierto, y el botón que abre el árbol de páginas quedaba por delante de su propio cajón.
- **El modal «Acerca de» estaba a 650px fijos**, se salía de una pantalla de 360, ofrecía una pestaña de atajos de teclado a quien no tiene teclado, y tres de sus cadenas seguían en inglés dentro de una interfaz en español.
- **Un intermitente real en la paleta de comandos**: una búsqueda que llegaba después de cerrar el diálogo lo repintaba con la consulta anterior. Fallaba una de cada ocho corridas de la suite completa; con la protección puesta, cinco corridas seguidas en verde.
- El menú del sprint se desplegaba fuera de la pantalla al anclarse a un botón que ahora vive en la columna izquierda de una rejilla en móvil.
- El tablero vacío ofrecía «Presiona [C] para crear una nueva tarea» en un teléfono sin teclado.
- «1 campos más», «Ajustes del Workspace» junto a «Espacio» en otra pantalla, y «Knowledge Base» sin traducir dentro del modal «Acerca de».

## [1.25.0] - 2026-08-17

### Fixed

- **El burndown llevaba doce versiones sin arreglarse, y el changelog decía que sí.** La entrada de la 1.12.0 anunciaba que se dejaba de recalcular la curva desde el estado actual. El módulo que hace eso se escribió y se probó, pero **no lo llamaba nadie**: la tabla de fotos estaba permanentemente vacía y el endpoint seguía con su `COUNT(*)` y su comentario «mock … for MVP purposes». Ahora el endpoint lee la serie real y algo la alimenta a diario.
- El motivo de fondo no era el coste de recalcular, era que **la historia cambiaba**: si a un ticket le subían los puntos, la curva de la semana pasada se redibujaba distinta hoy. Una gráfica de progreso que cambia hacia atrás no sirve para mirar atrás.
- **Toda tarea en revisión mostraba el texto `status.review`** en el hub y en el panel del espacio: la base guarda `review` y la clave se llamaba `status.in_review`.
- **Un ticket de tipo Epic mostraba `type.epic`.** Es uno de los cuatro tipos de fábrica y se siembra en cada espacio, pero no tenía traducción.
- **La misma notificación mostraba dos horas distintas**, una en el HTML servido y otra tras refrescarse: se leía la fecha de cinco maneras y solo cuatro trataban bien el UTC de SQLite.
- **Las fechas y los tiempos relativos salían siempre en inglés** («Aug 17, 2026», «5m ago») aunque la interfaz estuviera en español, y las acciones de la actividad reciente estaban escritas a mano.
- **La tabla de tareas pintaba la clave del tipo** en vez de su nombre, y **la franja de color de la tarjeta** seguía con el mapa fijo de antes de los tipos propios: un tipo morado salía azul.

### Performance

- **Caddy prohibía cachear los avatares.** El endpoint pone `private, max-age=86400` —correcto: `private` ya impide que un CDN los guarde— y el Caddyfile lo pisaba con `no-store` sobre todo `/api/*`, así que se redescargaban en cada carga. Con 1 GB de salida al mes, eso se paga.
- **El avatar subido desde el perfil no se redimensionaba**: iba la foto del móvil entera para servirse a 24×24 píxeles.
- Once imágenes sin `loading="lazy"`, incluida la de cada tarjeta del tablero.
- **Cinco `data-*` menos por tarjeta.** Tres no los leía nadie y dos eran la misma cadena repetida hasta cuatrocientas veces por tablero.

### Added

- `src/lib/fechas.ts`: una sola forma de leer lo que guarda SQLite, con formato y tiempo relativo traducidos.
- Comprobaciones que enumeran las claves construidas sobre la marcha, los contratos entre navegador y API, y un proyecto de Playwright para teléfono.
- Linter (Biome) en CI.

### Changed

- `src/i18n/ui.ts` queda partido en nueve dominios por idioma. Era el segundo fichero que más cambiaba del repositorio y el punto donde chocaba cualquier trabajo en paralelo.

## [1.24.0] - 2026-08-16

### Added

- **Personas tiene página propia** (`/people`) con lo que le faltaba para servir de algo. Existían cinco endpoints para pedir, aceptar, rechazar, cancelar y quitar amistades, y ninguna pantalla donde **ver** ninguna de las tres listas: la única forma de enterarte de que alguien te había mandado una solicitud era entrar a su perfil por casualidad.
- **Buscador de personas.** Hasta ahora una solicitud solo se podía enviar desde el perfil de la otra persona, y a ese perfil solo se llegaba escribiendo su nombre exacto: para encontrar a alguien había que saber ya quién era. Solo salen las cuentas con perfil público, y cada resultado dice en qué estado está para no ofrecer un botón que el servidor rechazaría.
- **Los bloqueos se pueden deshacer.** Bloquear se podía; desbloquear, en la práctica no: el botón vive en el perfil de la persona bloqueada, y a ese perfil se llega escribiendo su nombre. Bloquear a alguien y olvidar cómo se llamaba dejaba el bloqueo puesto para siempre.
- **Menú de la cuenta en la barra lateral.** El bloque de usuario llevaba directo a los ajustes, así que a tu propio perfil no apuntaba **ningún** enlace de la aplicación. Lleva un distintivo con las solicitudes sin responder: una solicitud sin aviso es una solicitud que caduca por olvido.
- **El banner del perfil se cambia desde los ajustes.** Antes solo se podía pasando el ratón por encima de la imagen en el perfil público, sin que nada anunciara que era pulsable.
- **Duplicar un ticket.** Lo interesante es lo que **no** copia: las horas registradas se quedan a cero —son el registro de un tiempo que alguien trabajó de verdad, y el tablero las suma para el total del sprint—, el estado vuelve a «Por hacer» y, si el sprint está cerrado, la copia va al backlog en vez de descuadrar lo que ese sprint dice que se hizo.
- **Tipos de ticket propios, por espacio.** Eran tres, escritos a mano en cuatro sitios y en una restricción de la base de datos. Un equipo de mantenimiento no tiene «historias»; tiene incidencias y preventivos. Se les pone nombre, color y orden.
- **Ordenar el tablero** por prioridad, fecha de entrega, puntos, título o fecha. Es una **vista**: no toca el orden manual que se colocó arrastrando tarjetas, así que volver a «manual» devuelve el tablero tal como estaba. Con un orden activo el arrastre se apaga y se dice por qué —soltar una tarjeta escribiría una posición que la vista ignora, y volvería sola a su sitio.
- **Las tareas pendientes del hub se agrupan por espacio**, con la cuenta de cada uno y las vencidas aparte. Eran diez filas seguidas con los espacios mezclados y sin decir de cuál era cada una.

### Changed

- **La landing decía «dos órdenes» donde su propio bloque de código muestra tres líneas.** Aparecía en dos textos distintos. Ahora dice «tres comandos» en los dos, que es lo que hay que escribir de verdad.
- El bloque de etiquetas de la landing no se entendía: «al filtrar por ella vuelven las tres cosas juntas» no decía dónde se filtra ni qué vuelve. Ahora nombra el caso —la misma «Parcial 2» en una tarea, unos apuntes y un archivo— y qué pasa al buscarla.
- «Sí exige un sitio donde correr» pasa a «Hace falta una máquina donde ejecutarlo», y los tres titulares de «Por qué una herramienta más» pierden el punto final que llevaban.
- La banda de cifras de la landing centra el contenido de cada columna. Alineada a la izquierda, la última —«MIT», tres letras— dejaba un hueco enorme a su derecha y la fila parecía descuadrada hacia un lado aunque las cuatro columnas midieran lo mismo. Y llevaba el aire de una sección entera arriba, así que flotaba entre dos vacíos sin verse a qué pertenecía.
- Todo lo anterior, en **los dos idiomas**: la copia inglesa arrastraba las mismas contradicciones.
- En los ajustes de la cuenta, las secciones de debajo de las notificaciones quedaban pegadas unas a otras. El contenedor que reparte el espacio cierra mucho antes, así que a partir de ahí el espaciado hay que ponerlo a mano.

- Las pendientes del hub ordenan por **urgencia** y no por lo último tocado: lo que vence antes va primero. Ordenar por la última modificación subía justo lo que se acababa de mirar.
- El desplegable de tipo del modal se rellenaba comparando el **texto** de la insignia con `task`, `bug` y `story`. En español «Tarea» no casa con nada, así que enseñaba el tipo equivocado. Ahora la clave viaja en un atributo.
- Renombrar un tipo no cambia su clave, que es lo que llevan escrito todos los tickets. Regenerarla al renombrar dejaría cada ticket apuntando a un tipo que ya no existe, sin un solo error por ninguna parte.

### Fixed

- **Borrar un tipo de ticket pregunta a dónde van los tickets que lo llevan**, con el número delante. Las otras salidas eran borrarlos —perder trabajo por reorganizar un desplegable— o dejarlos apuntando a una clave muerta, que no da ningún error y solo se descubre cuando alguien filtra por tipo.
- La migración que rehace la tabla `issues` renombra **al final**, no al principio. Renombrar primero corrompe la base en silencio: desde SQLite 3.25 el renombrado reescribe las cláusulas `REFERENCES` de las demás tablas, así que las cinco que apuntan a `issues` acababan apuntando a una tabla que se soltaba a continuación. No falla al migrar; falla semanas después al borrar un espacio.
- Los índices de `issues` se rehacen tras la reconstrucción. Perderlos no da ningún error, solo un tablero cada vez más lento sin explicación.

## [1.23.1] - 2026-08-16

### Fixed

- **No se podía volver al backlog.** Al elegirlo en el selector, la página quitaba `sprint` de la dirección. El servidor entiende esa ausencia como «no ha elegido nada» y aplica el último sprint recordado, así que devolvía justo al sprint del que se acababa de salir. Con un sprint creado, el backlog era inalcanzable. Ahora la elección viaja explícita.
- **Al cerrar un sprint con trabajo dentro salía un aviso con `{"error_code":"unfinished_issues",...}`.** El servidor hacía lo correcto: negarse a cerrarlo en silencio y devolver las tres salidas posibles. Nadie las enseñaba, y la respuesta se pintaba tal cual. Ahora se pregunta qué hacer con lo que queda: devolverlo al backlog, pasarlo a otro sprint o dejarlo dentro.
- La cuenta de tareas pendientes la da el servidor, no la pantalla. El tablero solo dibuja cien tarjetas por columna, así que contarlas ahí decía «100» cuando eran 743.
- Otros dos botones —crear tarea y devolver un sprint a planificación— también enseñaban el cuerpo de la respuesta del servidor al usuario. Va al registro; a la pantalla, una frase.
- **El icono del espacio salía como un churro de letras.** La columna guarda cuatro cosas distintas (una ruta, un data URI, una letra o nada) y la pantalla solo sabía dibujar el data URI. Al subir una imagen se guardaba una ruta, y la ruta se pintaba **como texto**. Ahora hay un solo componente que lo resuelve, usado en los tres sitios que antes tenían su propia copia.
- **No se podía subir ningún archivo.** La subida va del navegador a Google directamente, y la política de contenidos no permitía ese destino, así que el `PUT` moría antes de salir. El mensaje era «No se ha podido subir el archivo», sin más.
- **Al invitar a alguien no salía ninguna sugerencia**: era un campo de texto libre donde había que escribir el nombre exacto de memoria, y el error llegaba después de enviar.

### Added

- Buscador de personas al invitar. Solo lo puede pedir quien puede invitar; no salen las cuentas de invitado, que caducan, ni quienes ya están dentro.
- Las frases del tablero relacionadas con sprints estaban escritas a mano en inglés. Ahora pasan por traducción, en los dos idiomas.

## [1.23.0] - 2026-08-15

### Changed

- **Una sola sección de archivos en el ticket, no dos.** Había una para los del Drive conectado y otra para los subidos al disco de la máquina. La separación era real por dentro —distinto sitio, distinto tope, distinto efecto al borrar— pero es una distinción de fontanería: quien abre un ticket quiere poner un archivo, y se encontraba dos cajas sin saber cuál era la suya. Ahora hay una lista con las dos cosas y un distintivo «Drive» solo donde cambia algo para quien mira.
- Lo que sí siguen siendo dos cosas, y por eso quedan dos botones, es **traer uno nuevo** y **elegir uno que ya está en el espacio**. Eso son dos intenciones distintas; dónde acaben los bytes lo decide el sistema.
- El tope de tamaño y el destino se dicen debajo de los botones, en vez de descubrirse chocándose contra ellos.
- El aviso al quitar dice qué pasa en cada caso: el de Drive se desvincula y sigue en los archivos del espacio, el del servidor se borra y no está en ninguna otra parte.

### Fixed

- Los estados del botón de subir estaban en inglés a mano («Processing...», «Uploading...»), y además **no volvían a su sitio**: si la subida fallaba, el botón se quedaba diciendo «Uploading...» para siempre.
- El botón de borrar un adjunto tenía un `title` con el texto literal `{t('modal.delete_file')}`. Es el mismo fallo de las columnas de las bases dinámicas: dentro de una cadena de JavaScript, Astro no sustituye nada.

### Added

- Una prueba comprueba que **el script del modal llega a ejecutarse**. Un `</div>` de más en el componente hace que Astro deje de emitir su `<script>` entero: la página carga, el modal se abre y nada dentro funciona, sin un solo error en consola. Pasó al hacer este cambio. Verificada contra el marcado roto: falla.

## [1.22.0] - 2026-08-15

### Changed

- **La portada dejó de hablar de la implementación en la primera frase.** Antes empezaba por «un proceso de Node sobre un único archivo SQLite», que a quien llega buscando cómo organizar sus asignaturas no le dice nada. Ahora abre con lo que hace: un tablero, un editor, tablas y archivos. La ficha técnica sigue estando, más abajo, donde sirve de prueba en vez de de presentación.
- **Todo el texto pasa a tercera persona.** «Tus tareas» y «puedes copiarlo» se leían como publicidad; la ficha de producto es más creíble y envejece mejor.
- Reescrito para quitarle el tic: cada párrafo acababa en un giro ingenioso y la página iba llena de rayas. Ahora hay frases que simplemente afirman algo y se paran.
- Los apartados hablan de **archivos**, que la portada no mencionaba pese a llevar tres versiones existiendo.

### Added

- **Sección «Una etiqueta, tres sitios»**, que enseña la misma etiqueta puesta sobre una tarea, un apunte y un PDF. Es la diferencia real frente a tener tres herramientas sueltas, y era lo único de lo que la página hablaba sin enseñarlo. Va en HTML y CSS: sin JavaScript, sin imágenes y sin coste apreciable de carga.
- Un apartado **«Por qué una herramienta más»** con las tres razones, cada una con su contrapartida dicha. Una lista de ventajas sin ningún «pero» se lee como folleto.

## [1.21.4] - 2026-08-15

### Fixed

- **El backup fuera de la máquina apuntaba a un bucket escrito a fuego.** `forge-backup:forge-os` no significa «la carpeta forge-os de mi almacenamiento»: en Cloud Storage —y en S3, y en B2— la primera parte de la ruta **es el nombre del bucket**. Con cualquier bucket que no se llamara exactamente `forge-os`, la copia fallaba. Ahora el destino sale de `BACKUP_REMOTE`, que se pone en `/etc/forge-os.env`.
- **Un fallo de la copia fuera de la máquina no se veía.** Iba con `--quiet` y sin comprobar el resultado, así que un bucket mal escrito o sin permisos daba exactamente el mismo aspecto que una copia correcta: ninguno. Ahora se dice, y se sale con código 3 para que systemd marque el temporizador como fallido.
- Ese código 3 es distinto de 1 a propósito: la copia **local** sí se ha hecho, y es la que protege del escenario que motiva el backup previo a un despliegue. Bloquear el despliegue por un fallo del bucket empujaría a desactivar la comprobación entera.
- El temporizador no leía `/etc/forge-os.env`, así que la variable no le habría llegado nunca. El script la lee ahora por su cuenta, y la unidad de systemd la carga también.

### Changed

- La guía de despliegue explica cómo configurar rclone **sin el asistente** —`rclone config create ... env_auth true` ignora el `env_auth` y se queda pidiendo un login por navegador que en un servidor sin pantalla no lleva a ninguna parte— y por qué `bucket_policy_only = true` no es opcional: los buckets nuevos traen acceso uniforme y ahí no se admiten permisos por objeto.
## [1.21.3] - 2026-08-15

### Fixed

- **Un arreglo en el script de despliegue no se aplicaba al despliegue que lo traía**, sino al siguiente. El script vive dentro del repositorio que él mismo actualiza: cuando `git pull` lo reescribe, el que está corriendo sigue siendo el viejo. Pasó justo el día que hacía falta — el refresco de `/usr/local/bin` se quedó sin hacer y el cortafuegos siguió ejecutando la versión rota. Ahora el script se saca una copia en `/tmp` y se ejecuta desde ahí, así que lo que corre no cambia bajo sus pies.
- Eso cierra además un fallo latente peor: bash lee el fichero **a medida que lo ejecuta**, así que reescribirlo a mitad puede dejarlo leyendo desde un desplazamiento que ya no significa lo mismo. Raro, silencioso y difícil de reproducir.

## [1.21.2] - 2026-08-15

### Fixed

- **El cortafuegos borraba las reglas antiguas antes de poner las nuevas, y murió en medio.** Pasó al aplicarlo por primera vez en producción. Con la política por defecto en «denegar» eso es el sitio caído; con «permitir», el servidor abierto de par en par. Ahora **primero pone y después quita**: permitir de más unos segundos es reversible, quedarse sin ninguna de las dos no.
- La causa: el fichero de rangos IPv4 de Cloudflare **no termina en salto de línea**, así que `cat v4 v6` pegaba el último rango IPv4 con el primero IPv6 —`131.0.72.0/222400:cb00::/32`— y `ufw` respondía «Bad source address». Se validaban los dos ficheros por separado; nadie validaba **lo que de verdad se le pasaba a ufw**. Ahora se normaliza en una sola lista y se valida esa, línea por línea.
- El borrado de reglas usaba un patrón que solo miraba el puerto, así que al invertir el orden habría borrado también las de Cloudflare recién puestas. Ahora quita únicamente las que abrían a **todo el mundo**, dejando en pie SSH y las del CDN.
- **Los scripts instalados en `/usr/local/bin` no se actualizaban nunca.** Son copias, no enlaces, y los ejecutan temporizadores de systemd que no saben nada del checkout: un arreglo se desplegaba, se daba por bueno, y el temporizador seguía corriendo la versión rota. El despliegue refresca ahora las que ya estén instaladas.

### Added

- Pruebas del cortafuegos contra un `ufw` de mentira que rechaza direcciones inválidas igual que el real: comprueban el orden, que no se borre lo que no toca, y que una lista truncada o con basura **no cambie nada**. Verificadas contra el script viejo: fallan, que es lo único que hace válida a una prueba de regresión.

## [1.21.1] - 2026-08-15

### Security

- **El backup fuera de la máquina usaba `rclone sync`, que es un espejo y no una copia de seguridad.** `sync` deja el destino idéntico al origen, así que borraba en el bucket lo que ya no estuviera en el disco: la rotación local de 30 días se propagaba, y sobre todo, quien entrara en la máquina y borrara `/var/backups` habría vaciado el bucket en la siguiente pasada — el backup habría muerto con el servidor, que es justo lo que no puede pasar. Ahora es `rclone copy`, que solo añade, y la retención se decide en el bucket.

### Changed

- La guía de despliegue explica que el remoto de rclone hay que crearlo **como root**, porque el temporizador corre como root y rclone busca su configuración en el `HOME` de quien lo ejecuta. Un remoto creado con el usuario normal no lo ve el temporizador, y el aviso de «rclone sin configurar» sigue saliendo sin que se entienda por qué.

## [1.21.0] - 2026-08-15

### Added

- **Columna de tipo archivo en las bases dinámicas.** Una columna que **apunta** a un archivo de la sección de Archivos, en vez de meter un sistema de archivos dentro del módulo de bases de datos. Los archivos viven en un solo sitio y la tabla los referencia: así no hay dos verdades sobre el mismo archivo ni dos sitios donde borrarlo.
- En la tabla se ve el nombre, enlazado a Drive. Al crear una fila se elige buscando entre los archivos del espacio; no se sube desde ahí.

### Security

- El id que se guarda en una celda de tipo archivo **se comprueba contra el espacio**. Sin eso, una fila podría apuntar a un archivo de otro equipo y la tabla enseñaría su nombre a quien no debería verlo. Hay una prueba que lo intenta.

### Fixed

- Dos ficheros de prueba compartían espacio de trabajo, y la limpieza de uno borraba los archivos que el otro acababa de crear: fallaba una de cada tres corridas, y siempre en una prueba distinta. Cada uno tiene ahora el suyo.

## [1.20.0] - 2026-08-15

### Added

- **Adjuntar un archivo del espacio desde el propio ticket.** La herencia de etiquetas ya funcionaba por API, pero no había forma de usarla con el ratón. Ahora el detalle del ticket tiene su sección: se busca un archivo del espacio, se adjunta, y **se dice cuántas etiquetas ha heredado** — sin eso, lo más útil de la función es invisible.
- Va **separada** de los adjuntos de siempre, a propósito: aquéllos se suben al disco de esta máquina y son de ese ticket; éstos están en el Drive conectado, se comparten con todo el espacio y heredan etiquetas. Mezclarlos en una lista haría imposible saber cuál es cuál cuando importa.

## [1.19.0] - 2026-08-15

### Added

- **Etiquetas en los archivos**, las mismas del espacio que llevan los tickets y las páginas. Ese era el punto de que fueran del espacio: filtrar «Parcial 2» y que salgan la tarea, los apuntes y el PDF.
- **Herencia.** Adjuntar un archivo a una tarea le pasa las etiquetas de la tarea, sin que nadie las ponga a mano. Se **añaden**, nunca se quitan: adjuntarlo es decir «esto también es de aquí», no «esto ahora es solo de aquí». Descolgarlo tampoco se las quita — ya son suyas, y no hay forma de saber cuáles vinieron de dónde sin guardarlo, así que quitarlas borraría trabajo de quien organizó.
- **Búsqueda por nombre en todo el espacio**, no solo en la carpeta abierta: quien busca «laboratorio» no sabe en qué carpeta lo dejó, y por eso lo busca. Los resultados salen con sus etiquetas.
- **Historial de búsqueda**, de cada persona y cada espacio. Sirve para repetir una consulta de ayer sin volver a escribirla: se guardan diez, lo repetido sube en vez de duplicarse, y hay un botón para olvidarlo. No es un registro de lo que la gente busca.

### Fixed

- **Volver de una búsqueda dejaba muertos los selectores de etiqueta.** Se reescribía el contenido de la lista para restaurarla, y con ello se perdían los escuchadores de cada fila: los botones seguían pintados y ya no hacían nada. Ahora los resultados van en su propia lista y la de la carpeta se esconde, sin tocarla.

### Security

- El texto de la búsqueda escapa `%` y `_` antes de llegar al `LIKE`. Sin eso, buscar `%` devolvía **todos** los archivos del espacio en vez de los que llevan un `%` en el nombre.

## [1.18.0] - 2026-08-15

### Added

- **Subir archivos a Drive, con carpetas.** La sección de Archivos ya no es solo la conexión: se sube, se crean carpetas —que se crean también en el Drive, para que el árbol de allí sea el mismo— y se quitan. Cada archivo enseña su tamaño, quién lo subió y cuándo, y se abre en Drive.
- **Los bytes no pasan por el servidor.** El servidor abre una sesión de subida en Drive y le pasa al navegador **solo la URL de esa sesión**; el archivo va del navegador a Google directamente. Con 1 GB de salida al mes, hacer de intermediario para los archivos de todo el mundo se lo come en dos tardes.
- Quitar un archivo lo manda a la **papelera** de Drive, no lo destruye: es el Drive de una persona y ahí puede recuperarlo.

### Security

- **Al navegador no se le da nunca el token de acceso.** Sería una llave que abre todo lo que la aplicación ha creado en ese Drive —incluidos los archivos de los demás—. La URL de sesión que sí recibe sirve para una subida y para nada más, y caduca sola.
- **No se le cree cuando dice «ya lo he subido».** El id que manda se comprueba contra Drive: que exista, que no esté en la papelera y que esté **dentro de la carpeta de este espacio**. Sin eso, cualquiera podría meter en la lista el id de un archivo que no salió de aquí. El nombre y el tamaño también se toman de Drive, no de lo que diga el navegador.
- El tope de 500 MB por archivo se comprueba **antes** de abrir la sesión: no tiene sentido empezar una subida que no va a poder terminar. No es por coste nuestro, sino por el de quien presta su Drive.

### Fixed

- **La lista de archivos desaparecía si al servidor le faltaban las credenciales de Google.** Un espacio con cien archivos subidos enseñaba «no configurado» y nada más. Los archivos siguen en su Drive y sus nombres siguen aquí: ahora el aviso es un aviso, no un muro.
- **Un despliegue se paraba por el `package-lock.json`.** `npm ci` lo deja tocado a veces, y `git pull` se niega a seguir. Ahora el despliegue descarta los cambios locales de los ficheros que toca npm —y solo esos—, y si queda algo más sucio dice qué es en vez de dejar que git lo cuente a su manera en mitad del proceso.
- Crear una carpeta usaba el `prompt()` del navegador, que tiene el mismo problema que el `confirm()` que ya se quitó: tras el primero, el navegador ofrece bloquear los diálogos y el botón se queda mudo. Ahora el nombre se escribe en la propia lista.

## [1.17.0] - 2026-08-15

### Added

- **Etiquetas por espacio de trabajo.** Se crean en los ajustes del espacio, con nombre y color de una paleta cerrada, y se ponen en **tickets y en páginas**: la misma «Parcial 2» sirve para la tarea y para los apuntes, que es justo lo que permite cruzar las dos cosas. Las tablas existían desde el principio pero no las usaba nadie; lo que faltaba era todo lo demás.
- **Filtro por etiqueta en el tablero**, y en la consulta, no en el navegador: el tablero solo trae cien tarjetas por columna, así que filtrar en pantalla buscaría dentro de esas cien y diría que no hay nada más. El filtro va en la URL, así que el enlace de «solo Parcial 2» se puede pegar en un mensaje.
- Se pueden **crear sobre la marcha** desde el propio ticket o la página, escribiendo el nombre en el buscador del selector. Ir a los ajustes del espacio en mitad de otra cosa y volver es lo que hace que una función así no se use.
- Los ajustes dicen **en cuántos sitios está puesta cada etiqueta** antes de borrarla, y el borrado la quita de todo lo que la lleva sin tocar nada más.

### Fixed

- **Peticiones que morían de vez en cuando con `ECONNRESET`.** Node cierra una conexión persistente ociosa a los cinco segundos; si quien está delante la reutiliza en ese preciso instante, la petición se escribe sobre un socket que ya se cierra. No dejaba rastro en los registros. Se vio en las pruebas —una prueba cualquiera fallaba una de cada tres corridas— pero detrás del proxy el mismo caso es un 502 esporádico para alguien de verdad. Ahora el servidor espera más que quien le habla.
- El color de una etiqueta se comprueba **dos veces**: al guardarlo, contra la paleta, y al pintarlo, contra el formato. Acaba dentro de un atributo `style`, y aunque no se pueda salir de él, dentro cabría colar más propiedades CSS.

### Changed

- Nombres de etiqueta únicos por espacio, sin distinguir mayúsculas: «Urgente» y «urgente» son la misma para cualquiera que las lea, y tenerlas separadas solo reparte lo mismo en dos sitios.

## [1.16.0] - 2026-08-15

### Added

- **Sección de Archivos, sobre el Drive de quien la conecta.** Un propietario conecta una cuenta de Google y Forge crea dentro `Forge OS / <espacio>`. Los archivos vivirán ahí, no en el disco de la máquina: son 1 GB de salida de red al mes y unos pocos PDF se lo comen. Esta versión trae la conexión —conectar, ver de quién es, desconectar—; la subida viene después.
- El ámbito pedido es `drive.file`, que da acceso **solo a lo que crea la propia aplicación**. El acceso completo a Drive es un ámbito restringido y exige una auditoría de seguridad anual de pago; a cambio, Forge no ve el resto del Drive de nadie, que además es lo correcto.
- **La carpeta se comparte por enlace**, para que el equipo abra los archivos sin cuenta de Google. Eso significa que el enlace es la llave, y la pantalla lo dice **antes** del botón de conectar, junto con la otra consecuencia que no se puede esconder: los archivos gastan el almacenamiento de esa cuenta y se quedan en ella.
- **Conectar es cosa de un propietario**, no de cualquiera que pueda editar: lo que se ata al espacio es el Drive personal de alguien, con efectos fuera de Forge.

### Security

- **El token de refresco se guarda cifrado** con AES-256-GCM y una clave que no está en la base (`DRIVE_TOKEN_KEY`, o derivada de `SESSION_SECRET`). Es una llave permanente al Drive de una persona y esta base se copia entera a un bucket cada noche: en claro, quien llegue a una copia llega a los archivos de todo el mundo. Cifrado y autenticado, un byte retocado hace que el descifrado falle en vez de devolver basura.
- El `state` de la conexión va firmado y **lleva dentro el espacio y la persona**. Sin eso, el permiso que estás concediendo podría acabar atado a un espacio distinto del que estás mirando, o completarse desde otra sesión.
- **Borrar la cuenta corta la conexión.** La columna estaba en `SET NULL`, así que la fila sobrevivía y Forge habría seguido escribiendo en el Drive personal de alguien que ya no está en la aplicación y no tiene dónde verlo. Los archivos no se tocan: son suyos. El aviso previo al borrado ahora enumera los espacios que se quedan sin ellos.
- Perder el acceso —permiso revocado, cuenta borrada— **no borra metadatos**: la conexión se marca y la pantalla ofrece volver a conectar. Una lista vacía parecería que el trabajo se ha perdido.

### Fixed

- Las pruebas de punta a punta abrían la base sin `busy_timeout`, así que un bloqueo momentáneo lanzaba en el acto y el fallo salía en una prueba cualquiera —la que tuviera mala suerte— en vez de en la que estaba escribiendo.

## [1.15.0] - 2026-08-14

### Added

- **Plantillas para las bases de datos.** Al crear una tabla ya no se empieza mirando un formulario vacío: hay seis puntos de partida —Asignaturas, Lecturas, Gastos, Contactos, Inventario y Solicitudes— con sus columnas, sus tipos y las opciones de los desplegables ya escritas. Todo queda editable antes de crear, y la tabla en blanco sigue a un clic, arriba del todo. No hacen falta tablas ni endpoints nuevos: una plantilla es un esquema ya escrito que sale por el mismo alta de siempre, con la misma validación y con los identificadores de columna generados en el servidor.
- Los nombres de columna y las opciones **se traducen al idioma de quien crea la tabla** y ahí se quedan: son datos desde el momento en que hay filas debajo, y cambiar el idioma de la interfaz no puede renombrar una columna con contenido.
- **Iconos de verdad en vez de emoji.** El icono de una tabla se elegía escribiendo un emoji en una caja de texto; ahora se elige de una lista de catorce iconos de línea, los mismos que usa el resto de la interfaz. Un emoji no hereda el color del tema, se dibuja distinto en cada sistema operativo y desentonaba con todo lo demás. Lo que se guarda es el nombre del icono, y solo se pinta si está en la tabla de iconos conocidos. Las tablas que ya tenían un emoji lo conservan y se siguen viendo.

### Fixed

- **Las columnas añadidas a mano tenían `aria-label` sin traducir.** Literalmente `{t('db.col_name')}`: el marcado se construía dentro de una cadena de JavaScript, donde Astro no sustituye nada, así que lo que oía un lector de pantalla era el nombre de la clave. La primera fila venía del servidor y las demás de esa cadena; ahora todas salen del mismo molde.
- Quitar la última columna dejaba el formulario sin ningún sitio donde escribir y el botón de crear solo devolvía un error. Ahora se repone una fila en blanco.
- El módulo de bases de datos **hablaba en inglés a medias**: el estado vacío, los tipos de dato, los avisos de error, el aviso de borrar una tabla y el de borrar una fila. Los errores que se enseñaban eran además los del servidor tal cual, en inglés y con detalles internos.
- El alta de una tabla aceptaba esquemas sin columnas, con miles de ellas o con columnas sin nombre; lo último acababa en un 500. Ahora son 400 con su motivo.
- El árbol de la base de conocimiento dibujaba un emoji de documento delante de cada página, por lo mismo: era el único sitio del árbol que no usaba un icono de línea.
- El título de la pestaña del navegador llevaba el emoji de la tabla delante del nombre.

## [1.14.0] - 2026-08-14

### Fixed

- **«Guardo y no se guarda».** El guardado funcionaba siempre; lo que no ocurría era que la pantalla lo reflejara. La tarjeta del tablero seguía enseñando el texto y la fecha viejos hasta recargar, así que la conclusión razonable era que no se había guardado — y a base de reintentos salían duplicados. Ahora hay **una sola función que repinta la tarjeta** y la llaman todos los guardados; antes cada campo actualizaba un trozo distinto, o ninguno.
- El botón de guardar la descripción escribía sus estados en inglés a mano, así que «GUARDAR» se convertía en «SAVE» al pulsarlo. Y el «Guardado» **nunca llegaba a verse**: se escribía y en la línea siguiente se sobrescribía sin esperar nada.
- **Borrar una página parecía no hacer nada.** Usaba el `confirm()` del navegador; tras el primer aviso, el navegador ofrece bloquear más diálogos y a partir de ahí devuelve «no» al instante, dejando el botón mudo. Ahora usa el diálogo de la aplicación, y sale de la página **siempre** — antes, si la URL no casaba con un patrón, la página quedaba borrada y el navegador se quedaba en su dirección, que ya no existía.
- **La F del logo salía casi negra.** Usaba `--forge-on-accent`, que es el token del texto sobre botón naranja y vale lo mismo en los dos temas. El archivo de referencia ya la tenía blanca: el componente se había desviado. El token no se toca — ahí el valor oscuro es el que cumple AA.
- El emblema llevaba un resplandor naranja que sobre fondo claro se leía como una mancha; ahora solo aparece en oscuro.

### Added

- **Modo claro en la portada, y por defecto.** Con conmutador en la cabecera, memoria compartida con la aplicación y sin parpadeo al cargar. Las capturas siguen al tema: las claras ya estaban en el repositorio sin usarse. Las cuentas nuevas nacen en claro para que registrarse no sea un salto de página clara a aplicación oscura.

### Changed

- Traducidas las columnas del tablero, los tipos de ticket, el detalle de un ticket, la barra lateral y el hub. Buena parte era cablear claves que ya existían: `status.todo` y compañía llevaban tiempo definidas mientras el tablero escribía «To Do» a mano.
- El icono de «cerrar sesión en todas partes» era **una campana** —el de notificaciones—, que sugiere justo lo contrario de lo que hace el botón.

## [1.13.1] - 2026-08-13

### Fixed

- **Entrar con un proveedor no vinculado creaba una cuenta en silencio.** Es el comportamiento correcto de «entrar con GitHub» —el proveedor ya ha comprobado quién eres— pero hacerlo sin decir nada asusta: quien acababa de borrar su cuenta pulsaba el botón esperando entrar, aterrizaba en un hub vacío y creía haber perdido su trabajo. Ahora se avisa en el hub, diciendo de qué proveedor viene y que el trabajo anterior no está ahí.
- El aviso de build `INEFFECTIVE_DYNAMIC_IMPORT`: el endpoint de Recursos importaba su propio módulo dos veces, una estática y otra dinámica.

### Changed

- **El conmutador de idioma sube a la cabecera de la portada.** Al fondo del pie no lo encontraba quien llega y no lee en inglés, que es exactamente a quien sirve.
- Fuera la frase «Autoalojado sobre un único archivo SQLite» del pie: lo mismo ya lo dicen el titular y la ficha de datos, tres veces en la misma página.

## [1.13.0] - 2026-08-13

### Added

- **Módulo de Recursos, primera capa.** Tablas propias (`resources`, `resource_links`, `resource_tags`), deduplicación por URL normalizada y CRUD con permisos. Un recurso es material que se comparte: la misma URL citada en cinco issues es **un** recurso con cinco vínculos, no cinco copias que mantener a la vez.
- **Normalización de URL** como clave de deduplicación: minúsculas en el host, sin `www.`, sin puerto por defecto, sin parámetros de rastreo, con el resto ordenado, sin barra final y sin fragmento. La ruta **no** se toca, porque sí distingue mayúsculas.
- El borrado es lógico. Si se borrara de verdad y la URL siguiera citada en un issue, la próxima ingesta la recrearía; y como el índice de deduplicación solo mira lo no archivado, archivar no impide volver a darla de alta.

### Changed

- La zona de eliminar cuenta se separa del resto con una línea y bastante aire. Pegada a la lista de espacios parecía una sección más, cuando es la única de la pantalla que no tiene vuelta atrás.

### Fixed

- La prueba de guardados repetidos de la base de conocimiento se caía a veces con `ECONNRESET`: veinte peticiones seguidas mientras el resto de la suite corre en paralelo. Lleva un reintento acotado — lo que mide es si el contenido se degrada, no el transporte.

## [1.12.0] - 2026-08-13

### Added

- **Un solo sprint activo por espacio, garantizado por la base de datos.** La regla vivía solo en la aplicación, y una regla que solo vive en el código se salta con dos peticiones a la vez: las dos pasan la comprobación antes de que ninguna escriba. Ahora lo impide un índice único parcial. La migración deja los datos en paz consigo mismos antes de crearlo: si ya había varios activos, conserva el más reciente.
- **Cerrar un sprint obliga a decir qué pasa con lo que no se terminó**: moverlo al siguiente, devolverlo al backlog o dejarlo donde está. Antes se cerraba en silencio y el trabajo pendiente se quedaba dentro, invisible para el sprint siguiente. Sin decidir, el servidor responde 409 con **cuántos** tickets hay pendientes, para poder preguntar con el número delante.
- **Reordenar el backlog con la posición calculada en el servidor.** El cliente dice entre qué dos tickets quiere dejar el suyo; el número lo pone el servidor. Y cuando el hueco entre dos posiciones se queda sin precisión de coma flotante, se reindexa la lista y se sigue, sin que nadie vea nada moverse.
- **Fotos diarias del sprint** (`sprint_snapshots`) para el burndown. *(Corrección: esto se quedó a medias. Se creó la tabla y el módulo, pero nada los llamaba y el endpoint siguió recalculando. Enchufado de verdad en la 1.25.0.)* Se recalculaba desde los datos actuales en cada carga, así que la curva de la semana pasada se redibujaba distinta hoy si a un ticket le cambiaban los puntos. La foto de hoy se refresca; las de días anteriores no se tocan.
- `sprints` gana `completed_at`, `created_by`, `created_at` y `updated_at`.

## [1.11.1] - 2026-08-13

### Fixed

- **La prueba de arrastrar tarjetas vuelve a estar activa.** Llevaba desactivada con `test.skip` porque `dragTo` emite el gesto de un tirón y la librería del tablero necesita ver el puntero moverse: no se disparaba ningún guardado y la prueba esperaba en vano. Con el ratón paso a paso pasa siempre.
- `CLAUDE.md` daba por muertas **siete** tablas del esquema. Son cinco: `channels` y `messages` las consultan `IssueService` —publica un aviso en el canal general al crear un ticket— y la limpieza de adjuntos de `WorkspaceService`. Borrarlas siguiendo esa nota habría roto dos caminos vivos.

## [1.11.0] - 2026-08-13

### Fixed

- **Se acabó el inglés a medias.** El diálogo de confirmación global, la barra superior, la campana, la base de conocimiento («Escrita por», «Actualizada», «Guardado») y el perfil público estaban escritos a mano en inglés sobre una interfaz en español. Las fechas relativas también: ahora «hoy a las 15:47» en vez de «today at 3:47 PM».
- **La ficha de usuario del lateral y los formularios de Ajustes iban apretados.** Más aire entre campos, entre grupos y alrededor del avatar.

### Changed

- **El desenfoque de fondo se apaga por debajo de 768px.** `backdrop-filter` obliga a rehacer el desenfoque de la zona en cada fotograma: en una barra fija eso es durante todo el scroll, y en el tablero se multiplica por cada columna. Se conserva intacto en escritorio, y los fondos translúcidos que dependían de él pasan a opacos para no perder contraste.
- Quien pide **menos movimiento** en su sistema ya no ve las animaciones que laten sin parar.

## [1.10.0] - 2026-08-13

### Fixed

- **Las notificaciones no llegaban nunca, y con razón.** En todo el producto había **un solo** punto que creaba una: asignar un ticket a otra persona *al editarlo*. Crear el ticket ya asignado —que es el camino normal, el formulario tiene el campo— no avisaba a nadie, y quien trabaja solo no tenía ningún camino posible porque el aviso se salta cuando te asignas a ti mismo. Ahora avisa también al crear, y el mensaje lleva el **título** del ticket en vez de ocho caracteres del identificador.
- **Los sprints ya avisan al equipo** cuando arrancan y cuando se cierran. Ajustes ofrecía «silenciar actualizaciones de sprint» desde el principio, pero no había nada que silenciar.
- **Los errores salían en crudo**: el aviso enseñaba `Failed: {"error_field":"username","error_code":"charset"}`. Las traducciones ya existían —las usa el registro—; Ajustes simplemente no las llamaba.
- **Al crear un espacio, la etiqueta de URL solo seguía a lo primero que se escribía.** Se adivinaba comparando la etiqueta con el nombre *menos su última letra*, así que solo acertaba tecleando al final: al pegar, borrar o editar por el medio se congelaba sin manera de reengancharla. Y su error salía como aviso flotante en la esquina opuesta; ahora se ve junto al campo, en vivo.
- **«Buscar personas» no mostraba sugerencias.** El botón abría el desplegable y el mismo clic, al seguir subiendo hasta `document`, lo cerraba: había que escribir y reescribir a mano para que reapareciera.
- **La tabla y el bloque de código del editor se pintaban sobre fondo blanco en tema oscuro** — contraste medido de **1.17:1**, texto ilegible. No se había visto nunca porque el sanitizador borraba los bloques `table` antes de guardarlos; al arreglar aquella pérdida de datos, las tablas aparecieron y el fallo de estilo salió con ellas.
- **El conmutador de idioma del login se dibujaba abajo del todo**, no arriba a la derecha: la regla que lo posiciona tiene ámbito de componente y no alcanzaba al elemento de otro componente.
- En automatizaciones, el campo del nombre de la regla estaba etiquetado **«Nombre del workspace»**.

### Security

- **OAuth: emparejar por correo exigía que el proveedor lo diera por verificado.** Quien entra sin sesión y sin proveedor vinculado se empareja con una cuenta existente por su correo, y ese emparejamiento entrega la cuenta sin pedir contraseña. Google devuelve `email_verified` y no se estaba mirando; GitHub no lo dice en `/user`, así que ahora se consulta `/user/emails`. Sin verificación se crea una cuenta nueva, que es recuperable; una cuenta entregada, no.

### Changed

- **«Silenciar menciones» sale de Ajustes.** No hay tabla de comentarios, así que nada puede crear una notificación de mención: la casilla ofrecía apagar algo que no existe.
- El borrado de cuenta: singular cuando toca («1 ticket reportado», no «1 tickets»), el nombre a teclear se enseña en pantalla, y el botón rojo nace apagado hasta que el nombre coincide exactamente.

## [1.9.1] - 2026-08-11

### Security

- **Cambiar la contraseña no echaba a las demás sesiones.** Si alguien te robaba la sesión, cambiar la contraseña —que es la reacción natural y la que todo el mundo da por buena— no servía de nada: la cookie del intruso seguía siendo válida los treinta días de su `Max-Age`. Peor que no hacer nada, porque daba por resuelto lo que seguía abierto. Ahora se revocan todas menos la sesión desde la que se hace el cambio.

### Added

- **Suite de auditoría** (`tests/e2e/seguridad.spec.ts`): permisos por rol con su control, IDOR sobre tickets y páginas, escalada de privilegios, revocación de sesiones e inyección por el editor y por el perfil.
- **Prueba del limitador de intentos en modo producción.** Se desactiva solo con `NODE_ENV=test`, que es el modo de la suite e2e, así que allí veinte intentos fallidos pasan sin bloqueo y parece que no hay protección. La hay —bloquea en el intento 16, por IP—, pero no había nada que lo demostrara.

### Fixed

- La prueba del captcha comparaba la **suma visible** para verificar que llegaba un reto nuevo. Los sumandos van de 1 a 9, así que una de cada 81 veces salía la misma y la prueba fallaba sola. Ahora compara el token firmado, que lleva caducidad dentro.

## [1.9.0] - 2026-08-11

### Fixed

- **49 de 62 etiquetas de formulario no estaban asociadas a su campo**: ni las anunciaba un lector de pantalla ni funcionaba pulsar el texto para enfocar. Ahora **89 de 89 controles** de las nueve pantallas principales tienen nombre accesible.
- **Los avisos emergentes eran mudos.** Son el canal principal de respuesta de la aplicación —cada «guardado» y cada error pasan por ahí— y no tenían `aria-live`, así que quien no ve la pantalla no se enteraba de nada.
- Tres botones de solo icono sin nombre («cerrar» dos veces y «quitar columna»), dos imágenes decorativas sin `alt`, y el campo de la paleta de comandos —que sale en **todas** las pantallas— sin etiqueta ninguna.
- «Adjuntos», en el detalle de un ticket, era un `<label>` que no etiquetaba ningún campo. Un lector de pantalla lo anunciaba como el nombre de un control inexistente; ahora es un `<span>`.

### Changed

- Los controles que se repiten —las columnas de una base de datos dinámica, el rol de cada miembro— llevan `aria-label` en vez de `id`, porque un `id` fijo se duplicaría en cada fila y un id repetido rompe la asociación igual que no tenerla.

## [1.8.4] - 2026-08-11

### Added

- **Eliminar la cuenta de forma permanente**, desde Ajustes. Pide escribir el nombre de usuario y la contraseña —un «¿estás seguro?» se pulsa dos veces sin leer—, y antes de preguntar enseña las consecuencias **con cifras reales** pedidas al servidor: qué espacios se borran enteros, cuáles impiden el borrado y cuánto trabajo se queda con el equipo.
- El borrado **se detiene** si la cuenta es la única propietaria de un espacio en el que queda más gente, y dice cuál. Un espacio sin propietario no lo puede administrar ni borrar nadie.

### Changed

- El trabajo compartido **no se destruye** al borrar la cuenta: los tickets reportados, las páginas escritas y las horas registradas se quedan en sus espacios a nombre de una cuenta eliminada. Poner CASCADE en todo habría sido más corto, pero significa que quien se va de un equipo se lleva por delante la historia de los demás. Los espacios donde no queda nadie sí se borran enteros.
- Los tickets que tuviera asignados quedan **sin asignar**, no asignados a la cuenta lápida: sin asignar se ven en los filtros de trabajo huérfano, a nombre de un fantasma no.

## [1.8.3] - 2026-08-11

### Fixed

- **Los ajustes de un espacio leían todas las invitaciones pendientes de la instancia entera** —de cualquier espacio y de cualquier persona— para quedarse con las suyas parseando el JSON de cada fila en el servidor. El coste de abrir tus ajustes crecía con el uso global del producto. Ahora el filtro va en el SQL.
- Al llevar ese filtro a SQL apareció un fallo peor de lo que se arreglaba: `link_url` es una columna de texto libre, y `json_extract` sobre algo que no es JSON **aborta la consulta entera**. Una sola notificación de tipo `invite` con una ruta normal en esa columna dejaba los ajustes del espacio dando 500. La guarda `json_valid` va delante, y hay una prueba que lo fija.

### Added

- **Índices que no existían.** `pages` no tenía ninguno, y el árbol del lateral lee todas las páginas del espacio en cada renderizado: es la consulta que más veces se ejecuta de todo el producto, y hasta ahora recorría la tabla completa. Igual `notifications`, que se consulta en cada carga de la campana, y `workspace_join_requests`.

### Changed

- El hub de un sysadmin enumeraba **todos** los espacios de la instancia sin límite. Acotado a los 100 más recientes: es una portada, no un panel de administración.

## [1.8.2] - 2026-08-11

### Fixed

- **El perfil no se guardaba nunca.** La biografía, los pronombres y el correo público se enviaban junto a `avatar_url: null` cuando no se había subido una foto nueva, y el servidor rechaza la petición entera porque `null` no es una URL válida. El único guardado que funcionaba era el que incluía una imagen nueva; en cualquier otro caso el formulario decía que sí y no se escribía nada.
- **El correo público no se podía cambiar.** El `<select>` no tenía `id` ni oyente: era un adorno. Ahora ofrece de verdad la elección entre enseñar el correo de la cuenta y ocultarlo.
- **Las columnas visibles de una vista guardada no se aplicaban jamás**, y el contador de columnas de una base de datos dinámica marcaba siempre 0. Los dos leían `visible_columns_json` y `schema_json` de objetos que Drizzle devuelve en camelCase (`visibleColumnsJson`, `schemaJson`), así que obtenían `undefined` y caían al valor por defecto.

### Added

- **Cerrar la sesión en todos los dispositivos**, desde Ajustes. El endpoint que revoca todas las sesiones existía desde hacía versiones y no lo llamaba nadie: quien perdiera un portátil no tenía forma de echar a esa sesión.

### Changed

- El README decía que los enlaces bidireccionales estaban terminados. El servidor lo está —`linked-pages.ts` y `backlinks.ts`—, pero ninguna pantalla los llama todavía. Corregido para que no prometa lo que no hay.
- Tres pruebas de extremo a extremo fallaban de forma intermitente, una distinta en cada corrida, y pasaban al aislarlas. Ninguna era un fallo del producto: dos esperaban un tiempo fijo más corto que la recarga que la propia aplicación programa, y la tercera compartía usuario y espacio de trabajo con media docena de specs más. Ahora esperan al suceso, no al reloj, y cada grupo tiene su usuario y su espacio.

## [1.8.1] - 2026-08-11

### Fixed

- **Las automatizaciones no habían funcionado nunca.** Cuatro fallos independientes, cada uno suficiente por sí solo: el script leía los ids `auto-trigger-type` y `auto-action-type`, que no existían —los `<select>` eran `auto-trigger` y `auto-action`—, así que el botón «Guardar regla» lanzaba una excepción y moría antes de enviar nada; el campo de condición nacía `hidden` y nada se lo quitaba; el formulario ofrecía `issue.moved` mientras el motor consultaba `issue_status_changed`; y el evento se emitía en snake_case y el oyente lo leía en camelCase, así que `workspaceId` llegaba como `undefined` y ninguna regla llegaba siquiera a consultarse.
- Los dos campos libres pedían **JSON escrito a mano** con marcadores que sugerían texto plano («e.g. In Progress»). Ahora se pregunta el estado y la URL, y el JSON lo compone la aplicación.

### Changed

- El formulario ofrece **un disparador y una acción**, que son los que existen. Ofrecía cuatro y tres, y de las doce combinaciones solo una tenía motor detrás.
- **Un disparo de automatización queda en el registro de actividad**, con quién lo provocó. «¿Se ejecutó mi regla?» solo podía responderse mirando los logs del servidor.

## [1.8.0] - 2026-08-11

### Fixed

- **La base de conocimiento destruía contenido en cada guardado, en silencio.** Cuatro pérdidas distintas en el mismo camino: cada ítem de lista se guardaba como cadena vacía —el texto y el anidamiento— porque el sanitizador daba por hecho el formato v1 de `@editorjs/list` y el paquete instalado es v2, que devuelve objetos; los bloques `table` se descartaban enteros por no estar contemplados; los bloques de código se re-escapaban en cada autoguardado, acumulando `&amp;lt;` una vez por segundo; y el subrayado y los saltos suaves se borraban del texto. El servidor respondía 200 y el indicador decía «Saved»: solo se descubría al recargar.
- **Un JSON ilegible sobrescribía el documento.** El editor caía a un contenido vacío y la primera tecla lo guardaba encima. Ahora se niega a guardar: un documento ilegible se recupera, uno sobrescrito no.
- **El idioma no funcionaba para quien no ha entrado.** El middleware fijaba el idioma después de atender a los visitantes anónimos en rutas públicas, así que la portada, el login y el registro salían siempre en inglés, sin importar el navegador ni la cookie. Y el conmutador solo existía dentro de la aplicación.
- **Métricas mostraba dos idiomas a la vez**: la etiqueta de «sin asignar» venía escrita en el SQL, en español en una gráfica y en inglés en la de al lado.
- **El endpoint de solicitudes de amistad respondía prosa en español a todo el mundo**, y el perfil la enseñaba cruda con un `alert()`.

### Added

- Conmutador de idioma en la portada, el login y el registro.
- Test unitario del sanitizador —no existía ninguno— alimentado con la salida real de cada plugin de Editor.js, y pruebas de extremo a extremo que comprueban la fila de SQLite en vez de la pantalla, porque la pérdida era invisible desde la interfaz.

## [1.7.0] - 2026-08-10

### Added

- **Portada nueva, con el producto en movimiento.** Rejilla bento con un tablero en miniatura que mueve una tarjeta entre columnas, una demo que escribe una página sola —título, menú de `/`, lista que se marca y enlace a un issue— y las cuatro capturas juntas en un carrusel con pestañas que rota solo y se detiene al elegir una.
- **Se puede volver a la portada estando dentro.** `/welcome` la sirve con sesión iniciada, adaptando los botones: quien ya tiene cuenta ve «Abrir Forge OS» en lugar de «Crear cuenta». Antes, una vez creada la cuenta, no había ninguna forma de volver a verla.
- **Correo en el registro**, con índice único parcial: dos cuentas no pueden compartirlo, pero las cuentas antiguas y los invitados conviven sin él.
- **Validación de nombres de usuario**: formato, reservados del producto y lista de términos inapropiados que contempla el leetspeak y los separadores como evasión.
- **Captcha propio en el registro**, una suma firmada con HMAC y sin estado en servidor. No se usa reCAPTCHA ni hCaptcha a propósito: la portada promete no cargar scripts de terceros.
- **Entrar con Google y GitHub**, por redirección completa y con `state` firmado. Cada proveedor se activa solo si tiene credenciales; sin ellas su ruta responde 404 y el botón sale deshabilitado explicándolo.
- **`robots.txt` y `sitemap.xml` generados**, además de datos estructurados `SoftwareApplication`. No existía ninguno de los tres.
- **Script de despliegue con vuelta atrás** (`scripts/deploy.sh`) y **cortafuegos limitado a las redes de Cloudflare** (`scripts/cloudflare-firewall.sh`).

### Fixed

- **El build de producción horneaba `http://localhost:4321` como sitio público.** Astro fija `site` en tiempo de compilación y el despliegue construía sin cargar `/etc/forge-os.env`, así que la URL canónica y las etiquetas OpenGraph apuntaban a un host inexistente. Es lo que impedía que la web apareciera en las búsquedas.
- **El avatar por defecto se pedía a `api.dicebear.com`.** Cada visita a un perfil enviaba el nombre de usuario y la IP del visitante a un tercero, en un producto cuya portada promete lo contrario. Ahora lo sirve la propia aplicación y la CSP ya no permite dominios externos.
- **El diálogo que decide qué espacios de invitado se borran para siempre estaba sin traducir**, en inglés fijo, en una aplicación con dos idiomas.
- **El formulario de registro anunciaba contraseñas de 6 caracteres y el servidor exigía 8.**
- **`?reason=guest_limit` no lo leía nadie**: quien agotaba el límite de invitados aterrizaba en el registro sin ninguna explicación.
- Login y registro no cargaban las fuentes, no tenían `autocomplete`, fijaban `<html lang="en">` aunque calculaban el idioma, y no bloqueaban el botón al enviar.
- La tarjeta que viaja en el tablero de la portada aterrizaba sobre el borde de la columna: el salto usaba el ancho de la tarjeta y la distancia entre columnas es el de la columna, que incluye su relleno.

### Changed

- **Los invitados quedan aislados socialmente.** No pueden enviar solicitudes ni bloquear, ni ser objeto de ninguna de las dos cosas, y no aparecen en las sugerencias de búsqueda —solo se les encuentra escribiendo el nombre entero—, para que el directorio de usuarios no acabe siendo el registro de visitas.
- **Un solo logotipo.** Había cuatro dibujos distintos de la misma F con cuatro proporciones, y el SVG usaba `<text font-family="Arial">`, así que el favicon cambiaba de forma según la máquina. Ahora es un trazado, en un componente único.
- Login y registro comparten armazón y formulario: eran 125 líneas cada uno con el 80% duplicado.

## [1.6.0] - 2026-08-09

### Changed

- **El Hub deja de ser mitad red social.** La columna derecha (perfil, contadores de conexiones, notificaciones, invitaciones y Tu Red) desaparece; Workspaces y Tareas pendientes pasan a ancho completo. Lo social ya vivía en `/u/[usuario]` y las notificaciones ya estaban completas en la campana de la barra superior, así que no se pierde nada: el bloque del Hub las duplicaba.
- **Navegación global en la barra lateral:** «Mi Hub» y «Actividad», visibles siempre, no solo con un workspace seleccionado. Era imprescindible: `/activity` solo era alcanzable desde la columna que se ha retirado.
- Los colores de texto crudos de Tailwind (38 usos de `text-red-*`, `text-orange-*`, `text-yellow-*`, `text-green-*`) pasan a los tokens del tema.

### Added

- **Cabeceras de seguridad que faltaban**, verificadas con `curl -D-`: `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` negando geolocalización, cámara, micrófono y pago, y `Cross-Origin-Opener-Policy: same-origin`.

### Fixed

- **`/favicon.ico` daba 404** en login y registro, que no usan `MainLayout` y por tanto no heredaban la declaración del icono. Era el error de consola que dejaba «buenas prácticas» en 96.
- **Faltaba el landmark `<main>`** en el Hub, login y registro. Era lo que dejaba accesibilidad en 97.
- **`socket.io.js` se servía sin minificar** (37 KB). Se pasa a `socket.io.min.js`: 18 KB y 150 ms menos, medido con Lighthouse.
- **Cuatro consultas SQL muertas** seguían ejecutándose en cada carga del Hub (amistades, total de amigos, invitaciones y solicitudes pendientes) después de que sus consumidores desaparecieran.

### Removed

- Tres scripts de depuración sin ninguna referencia en el repositorio: `scripts/capture-timer.ts`, `debug-metrics.ts` y `debug-worklogs.ts`.
- Doce claves i18n del Hub que quedaron huérfanas, en los dos idiomas.

### Medido

Lighthouse 13 sobre una instancia con datos de seed, antes → después:

| | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| `/login` | 100 → **100** | 97 → **100** | 96 → **100** | 100 → **100** |
| `/` (Hub) | 92 → 92 | 100 | 100 | 100 |

El Hub baja de 303 KB a 276 KB y Lighthouse ya no detecta ninguna oportunidad de optimización; el 92 lo marca el FCP de un servidor local en frío, con TBT y CLS en 0.

## [1.5.0] - 2026-08-08

### Added

- **Seed de desarrollo:** nuevo `npm run seed` que puebla un espacio de trabajo de demostración (sprint activo, 12 issues repartidos por las cuatro columnas, registros de trabajo y base de conocimiento con enlaces). Se niega a sobrescribir una base con datos salvo que se le pase `--force`, y respeta `DATABASE_URL`. El README llevaba documentando este script desde la 0.6.0 sin que existiera.
- **Scripts de npm:** `test`, `test:e2e` y `typecheck`. Hasta ahora los tests solo podían lanzarse invocando `npx` a mano.
- **README bilingüe:** `README.md` pasa a inglés y se añade `README.es.md` con la versión en español, enlazados entre sí.
- **Capturas de pantalla** del tablero, las métricas, la base de conocimiento y el hub, en tema claro y oscuro, servidas según el tema del visitante. Se generan con el nuevo `npm run screenshots`, que valida que ninguna pantalla salga vacía antes de guardar y reencoda a PNG con paleta (ocupan un 70% menos sin perder resolución).
- **Histórico de sprints en el seed:** tres sprints completados además del activo, para que la gráfica de velocity tenga tendencia que dibujar.

### Fixed

- **Arranque del servidor con Astro ≥7.1:** `cookie` v2 renombró su API (`parse`/`serialize` → `parseCookie`/`stringifyCookie`) y eliminó el export por defecto. La dependencia directa `cookie@^0.6.0` se hoisteaba a la raíz de `node_modules` y eclipsaba la que Astro resuelve, provocando `does not provide an export named 'parseCookie'` al arrancar. Bloqueaba la actualización de Astro desde el 26 de julio.
- **Imagen principal del README:** apuntaba a `./public/screenshot.png`, un archivo que nunca llegó a subirse al repositorio.
- **Contradicción del roadmap:** las bases de datos dinámicas (fase 1) figuraban como pendientes pese a estar implementadas.
- **Ruido en `git status`:** `.gitignore` no cubría `*.log`.

### Changed

- Astro 7.0.6 → 7.2.0 y `cookie` 0.6.0 → 2.0.1. Eliminado `@types/cookie`, redundante porque `cookie` v2 ya incluye sus propios tipos.
- `npm audit fix` resuelve 8 de 12 vulnerabilidades, todas en `undici`.
- CI: `actions/checkout` y `actions/setup-node` de v4 a v7 (v4 apunta a Node 20, deprecado), y los tests unitarios pasan a ejecutarse antes que los e2e para fallar rápido.
- El README ya no recomienda NVM y declara el requisito real de Node (≥22.12, el que fija `engines`).

## [1.4.0] - 2026-07-26

### Added

- **`ApiError` compartido:** manejo de errores unificado en los endpoints, con migraciones versionadas y un rate limiter persistente entre reinicios.

### Fixed

- **Auditoría de seguridad:** saneado de HTML, path traversal en adjuntos, límites de tasa en websockets y parseo estricto de URLs.
- **E2E:** los tests esquivan el rate limiter para no bloquearse entre sí.

### Changed

- CSP más restrictiva.

## [1.3.0] - 2026-07-17

### Added

- Footer global en `MainLayout`, tarjeta punteada de nuevo espacio de trabajo en la cuadrícula y acceso directo a ajustes desde la sección de workspace del hub.

### Fixed

- Mensajes de los toasts del footer alineados con las funcionalidades que existen de verdad.
- Errores de TypeScript remanentes en componentes de traducción e interfaz.

## [1.2.0] - 2026-07-17

### Added

- **Red social (fase 1):** esquema social, endpoints protegidos contra IDOR y bloqueo de usuarios.
- Botones de inicio de sesión y registro para usuarios invitados en la barra superior y la barra lateral, con sus traducciones.

### Fixed

- Restricciones de invitado refactorizadas de forma global y sincronización de las preferencias de tema.
- La búsqueda global ya no devuelve el usuario `system`.
- Tablas `friendships` y `user_blocks` añadidas a la inicialización para entornos de CI limpios.
- Los usuarios no invitados ya no provocan un `0` suelto en las plantillas.

## [1.0.0] - 2026-07-17

### Fixed

- Los 12 errores de TypeScript pendientes de la auditoría de código.
- Los 29 tests e2e pasan: carrera en la cookie de sprint, test de errores de JS, selector del menú slash de la base de conocimiento.

## [0.8.0] - 2026-07-15

### Added

- **Editor avanzado:** tablas, drag & drop de bloques, subrayado, delimitador, avisos y bloques de código en Editor.js.
- `editorjs-undo` para deshacer y rehacer con `Ctrl+Z` / `Ctrl+Y`.
- Tooltip de ayuda con los atajos del editor.

### Fixed

- Numerosas correcciones de estilo del editor: menú slash roto, solapamiento de la barra flotante, tipografía de los bloques, contraste de la selección y del toolbox.

## [0.7.0] - 2026-07-12

Incluye las versiones 0.7.1 a 0.7.7.

### Added

- **Bloque 4 — Métricas:** APIs de distribución, burndown, velocity y precisión, con sus widgets de gráficas sobre Chart.js y enlace en la barra lateral.
- **Control de tiempo en servidor:** temporizador con auto-parada, límite de 12 horas y registro de trabajo, que se detiene solo al mover un issue a Done.
- Modal unificado de creación de issues, botón de compartir en el detalle y fechas de vencimiento.
- Invitaciones pendientes con TTL de 7 días y lógica de reenvío.

### Fixed

- IDOR en burndown, filtro de precisión por sprint y respuestas 404 correctas en métricas.
- Bloqueo por CSP al importar Chart.js.
- Precisión del temporizador a 4 decimales y umbral de descarte más bajo.
- Sincronización del estado de las tarjetas del Kanban al arrastrarlas.
- Validación entre espacios de trabajo del `assignee_id`.
- CI: puertos y URLs codificados a mano, `NODE_ENV` ausente, y los e2e excluidos del runner de Vitest.

## [0.6.0] - 2026-07-12

### Added

- **Infraestructura de GitHub:** workflow de CI, plantillas de issue y pull request, y Dependabot.
- `TaskTable` compartida con ordenación, reutilizada desde el dashboard.
- Ajustes del espacio de trabajo: registros de auditoría y subida de icono.
- Tabla `time_tracking_sessions`.

### Changed

- README reescrito con plantilla profesional y badges.
- Node 26 en CI para aprovechar la ejecución nativa de TypeScript.

### Fixed

- Handler `GET` ausente en la ruta de detalle de issue.
- Referencias al rol `commenter` que habían quedado rotas en ajustes y tipos.

## [0.5.0] - 2026-07-11

### Added

- **Guest Workspace Transfer:** Nueva funcionalidad que escanea las sesiones de invitados locales durante el proceso de registro o inicio de sesión. Si el usuario invitado posee uno o varios Workspaces provisionales, el sistema interrumpe el flujo principal para desplegar un panel modal interactivo. Este panel permite al usuario migrar selectivamente cualquier Workspace huésped a su cuenta permanente real, con destrucción en cascada automática para aquellos que sean descartados (liberando basura en la base de datos).

## [0.4.1] - 2026-07-11

### Fixed

- **TypeScript Strictness:** Resueltos todos los errores de tipos remanentes en el proyecto (100% Type Safe).
- **EditorJS:** Corregido un bug en la inicialización donde faltaba la estructura `blocks` requerida.
- **Base de Datos:** Migración para inyectar automáticamente la columna `type` faltante en bases de datos locales legacy en la tabla `notifications`.
- **UI:** Añadidas las traducciones faltantes para notificaciones y eliminadas las llaves duplicadas.
- **Refactor:** `IssueService` tipado seguro para el ciclo de updates parciales, previniendo index signatures implícitos.

## [0.4.0] - 2026-07-10

### Added

- **Core de Autenticación y Base de Datos:** Implementación del sistema de usuarios, sesiones y bases de datos dinámicas con SQLite (`better-sqlite3`).
- **Tablero Kanban & Sprints:** Sistema de tickets interactivo para bugs, tareas e historias, agrupado por Sprints iterativos.
- **Knowledge Base (Documentos):** Editor estilo Notion avanzado para la redacción de documentación colaborativa.
- **Motor de Internacionalización (i18n):** Traducción total de la interfaz al Inglés y Español con detección automática del navegador o selección manual.
- **Bases de Datos Dinámicas:** Módulo para la creación de esquemas y tablas dinámicas por usuario (estilo Airtable).

### Changed

- **Rediseño "Orion's Forge":** Toda la interfaz ha sido reconstruida visualmente con estilos modernos, glassmorphism, modo oscuro unificado y menús nativos estilizados.
- Configuración de selectores nativos forzando `color-scheme: dark` para mayor coherencia visual.

### Fixed

- **Seguridad (Path Traversal):** Se corrigió la vulnerabilidad del sistema de almacenamiento de archivos para prevenir escalada de directorios (`../`).
- **Seguridad (IDOR):** Guardias estrictos en todos los endpoints para garantizar que ningún usuario acceda a datos de Workspaces ajenos.
- **Webhooks (SSRF):** Bloqueo y sanitización en las automatizaciones para impedir que los webhooks apunten a IPs internas o locales.
