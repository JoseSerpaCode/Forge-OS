# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> Las entradas entre la 0.6.0 y la 1.4.0 se reconstruyeron a posteriori a partir del historial de git, agrupadas por los saltos de versión que realmente ocurrieron en `package.json`. La 1.1.0 nunca existió: se pasó directamente de la 1.0.0 a la 1.2.0.

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
