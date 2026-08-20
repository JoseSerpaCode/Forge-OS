# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> Las entradas entre la 0.6.0 y la 1.4.0 se reconstruyeron a posteriori a partir del historial de git, agrupadas por los saltos de versión que realmente ocurrieron en `package.json`. La 1.1.0 nunca existió: se pasó directamente de la 1.0.0 a la 1.2.0.

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
