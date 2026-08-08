# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> Las entradas entre la 0.6.0 y la 1.4.0 se reconstruyeron a posteriori a partir del historial de git, agrupadas por los saltos de versión que realmente ocurrieron en `package.json`. La 1.1.0 nunca existió: se pasó directamente de la 1.0.0 a la 1.2.0.

## [1.5.0] - 2026-08-08

### Added

- **Seed de desarrollo:** nuevo `npm run seed` que puebla un espacio de trabajo de demostración (sprint activo, 12 issues repartidos por las cuatro columnas, registros de trabajo y base de conocimiento con enlaces). Se niega a sobrescribir una base con datos salvo que se le pase `--force`, y respeta `DATABASE_URL`. El README llevaba documentando este script desde la 0.6.0 sin que existiera.
- **Scripts de npm:** `test`, `test:e2e` y `typecheck`. Hasta ahora los tests solo podían lanzarse invocando `npx` a mano.
- **README bilingüe:** `README.md` pasa a inglés y se añade `README.es.md` con la versión en español, enlazados entre sí.

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
