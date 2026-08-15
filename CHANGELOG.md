# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> Las entradas entre la 0.6.0 y la 1.4.0 se reconstruyeron a posteriori a partir del historial de git, agrupadas por los saltos de versión que realmente ocurrieron en `package.json`. La 1.1.0 nunca existió: se pasó directamente de la 1.0.0 a la 1.2.0.

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
- **Fotos diarias del sprint** (`sprint_snapshots`) para el burndown. Se recalculaba desde los datos actuales en cada carga, así que la curva de la semana pasada se redibujaba distinta hoy si a un ticket le cambiaban los puntos. La foto de hoy se refresca; las de días anteriores no se tocan.
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
