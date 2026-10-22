<a name="readme-top"></a>

<div align="center">

<img width="90px" src="./public/forge-icon.svg" alt="Forge OS" />

## Forge OS • Espacio de trabajo multi-inquilino autoalojado

[![Version][version-shield]][version-url]
[![CI][ci-shield]][ci-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]

**Un tablero Kanban, un editor de notas tipo Notion, tablas tipo Airtable y
archivos en un solo espacio de trabajo autoalojado.** Astro SSR sobre un único
archivo SQLite: sin framework en el cliente, sin servidor de base de datos y sin
depender de nada externo. Entrar con Google o GitHub, Google Drive y los avisos
Web Push son opcionales y solo se activan si se configuran.

[Instancia en producción](https://forge-os.online) · [Reportar un fallo](https://github.com/JoseSerpaCode/Forge-OS/issues) · [Sugerir una función](https://github.com/JoseSerpaCode/Forge-OS/issues) · [Changelog](./CHANGELOG.md)

[English](./README.md) · **Español**

<img src="./public/screenshots/board-dark.png#gh-dark-mode-only" alt="Tablero Kanban con sus cuatro columnas de estado" width="900" />
<img src="./public/screenshots/board-light.png#gh-light-mode-only" alt="Tablero Kanban con sus cuatro columnas de estado" width="900" />

</div>

<details>
<summary><b>Tabla de contenidos</b></summary>

- [Por qué Forge OS](#por-qué-forge-os)
- [Funciones](#funciones)
- [Capturas](#capturas)
- [Empezar](#empezar)
  - [Requisitos](#requisitos)
  - [Instalación](#instalación)
  - [Scripts](#scripts)
  - [Integraciones opcionales](#integraciones-opcionales)
- [Stack tecnológico](#stack-tecnológico)
- [Despliegue](#despliegue)
- [Seguridad](#seguridad)
- [Accesibilidad](#accesibilidad)
- [Roadmap](#roadmap)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

</details>

<br/>

## Por qué Forge OS

Las tareas, los apuntes y los archivos suelen vivir en tres herramientas que no
saben nada unas de otras. En Forge OS comparten espacio y etiquetas: si una
tarea, una nota y un PDF llevan «Parcial 2», filtrar por esa etiqueta devuelve
las tres cosas. Una tarea enlaza las notas que necesita desde su propio panel.

Sirve a un equipo que planifica por sprints y a una persona que organiza su
semestre. Sprints, medición de tiempo y puntos son **interruptores de cada
espacio**: los espacios nuevos nacen con los tres apagados, y apagar uno lo
esconde sin borrar sus datos.

Funciona como **un solo proceso de Node contra un archivo SQLite local**. No hay
servidor de base de datos, ni colas, ni capa de caché que mantener.

## Funciones

**Tablero**

- Cuatro estados —Por hacer, En curso, En revisión y Hecho— con arrastrar y
  soltar persistente. Hecho enseña las diez últimas, con «Ver más».
- **Alta rápida**: «Entregar informe viernes 18:00 #Física !1 [[Tema 3]]
  @sam» crea la tarea con su fecha y hora de entrega, etiqueta, prioridad, nota
  vinculada y responsable. Lo reconocido sale como chips que se pueden quitar.
  Se abre con `C` desde cualquier página del espacio.
- Vistas **Hoy** y **Próximos**, fecha de trabajo aparte de la de entrega,
  subtareas, tareas que se repiten («cada lunes», «el día 15 de cada mes»),
  vistas guardadas y tipos de tarea propios de cada espacio.
- **Plantillas de tareas**, escritas en los ajustes del espacio o guardadas
  desde cualquier tarea, y seis de serie. Elegir una en el alta rellena el
  formulario para ajustarlo antes de crear, y sus pasos llegan como subtareas.
- **Archivos adjuntos al crear la tarea**, y etiquetas y tipos de tarea que se
  crean desde el propio alta y se editan (nombre y color) desde los ajustes.
- **Seleccionar varias tarjetas** para moverlas de estado o de sprint,
  ponerles una etiqueta o borrarlas de una vez.
- **En el teléfono**, una columna cada vez con las pestañas de estado fijas
  arriba: mantener pulsada una tarjeta y soltarla en una pestaña la mueve,
  deslizar a los lados cambia de pestaña, y cada tarjeta tiene su hoja de
  «mover».
- **Recordatorios** antes de una entrega, en la zona horaria de cada persona,
  como notificación dentro de la app y —si está configurado— por Web Push, para
  que lleguen con Forge cerrado.
- Carriles por etiqueta, completar con un clic y «Deshacer», y un calendario
  `.ics` de solo lectura para suscribirse desde Google Calendar.
- Sprints, medición de tiempo (el cronómetro se para cuando la tarea pasa a
  revisión o a Hecho) y puntos, opcionales. Con puntos, cada columna los suma,
  el tablero dice cuántos van hechos y Métricas mide el avance del sprint y la
  velocidad en puntos.

**Notas**

- Editor sobre Tiptap: atajos de Markdown al escribir, menú «/», barra de
  formato al seleccionar, un asa para arrastrar cada bloque, tablas y bloques de
  código.
- Menciones `@` a miembros y contactos.
- Un árbol de notas que se ordena y anida arrastrando, o con «Mover a…» desde
  el teclado o el teléfono.
- Un índice de notas: la última que abriste, las tres más recientes y una tabla
  con todas, con sus etiquetas, quién la editó y cuántas tareas la enlazan.

**Tablas y archivos**

- **Tablas** creadas desde la interfaz, al estilo de Airtable, desde cero, con
  una plantilla o **importadas desde Excel o CSV**, incluida una columna de tipo
  archivo que apunta a los archivos del espacio.
- **Los archivos** viven en el Drive de quien conectó el espacio, en carpetas
  que se reflejan a los dos lados. Etiquetas, búsqueda por nombre en todo el
  espacio y etiquetas heredadas al adjuntar un archivo a una tarea.

**Métricas**

- Carga por persona, avance del sprint, tareas cerradas por sprint y tiempo
  estimado frente a registrado; solo las gráficas que el espacio puede llenar.
  Cada gráfica tiene un conmutador «Gráfica | Tabla» con los mismos datos en
  texto.

**Personas y espacios**

- Roles de dueño, editor y lector, aplicados en el servidor. Invitaciones con
  buscador de personas.
- **Contactos**: personas sin cuenta en Forge pueden ser responsables de una
  tarea y aparecer mencionadas en las notas. Son de tu cuenta, así que sirven
  en todos tus espacios.
- Perfiles públicos; amistades y bloqueos, que cada cuenta enciende si quiere.
- Cuentas de invitado que luego pueden pasar a cuenta real conservando sus
  espacios.
- Automatizaciones y registro de auditoría, que se encienden por espacio.

**En toda la app**

- **Inicio**: lo que tienes pendiente en todos tus espacios, agrupado por
  espacio y con las vencidas contadas aparte.
- `Cmd/Ctrl+K` para saltar a cualquier espacio, persona, nota o tarea por su
  título.
- Inglés y español, detectados automáticamente. La portada tiene además una
  dirección en español (`/es`), para que los buscadores indexen las dos.
- Tema claro y oscuro, una disposición propia para el teléfono con navegación
  inferior, e instalable como aplicación.

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Capturas

Todas las imágenes salen de `npm run seed` y se regeneran con
`npm run screenshots`.

**Métricas**: carga, avance del sprint, tareas cerradas por sprint y tiempo
estimado frente a registrado, a partir de las horas reales.

<img src="./public/screenshots/metrics-dark.png#gh-dark-mode-only" alt="Página de Métricas" width="900" />
<img src="./public/screenshots/metrics-light.png#gh-light-mode-only" alt="Página de Métricas" width="900" />

**Notas**: el editor junto al árbol de notas.

<img src="./public/screenshots/knowledge-base-dark.png#gh-dark-mode-only" alt="Editor de notas con el árbol" width="900" />
<img src="./public/screenshots/knowledge-base-light.png#gh-light-mode-only" alt="Editor de notas con el árbol" width="900" />

**Inicio**: tus tareas pendientes agrupadas por espacio, y tus espacios.

<img src="./public/screenshots/dashboard-dark.png#gh-dark-mode-only" alt="Página de Inicio" width="900" />
<img src="./public/screenshots/dashboard-light.png#gh-light-mode-only" alt="Página de Inicio" width="900" />

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Empezar

### Requisitos

**Node.js 22.12 o superior.** La CI corre en Node 26.

Nada más. `better-sqlite3` trae binarios precompilados para linux-x64,
linux-arm64, macOS y Windows, así que no hace falta compilar nada.

### Instalación

```sh
git clone https://github.com/JoseSerpaCode/Forge-OS.git
cd Forge-OS
npm install
```

Siembra un espacio de demostración, con sprints, medición de tiempo y puntos
encendidos, un tablero repartido en las cuatro columnas, horas registradas y
unas cuantas notas:

```sh
npm run seed
```

Y arranca el servidor de desarrollo:

```sh
npm run dev
```

La app queda en **http://localhost:4321**. Entra como `avery` con la contraseña
de la semilla (`LocalDevPass123!` por defecto; cámbiala exportando
`TEST_PASSWORD` antes de sembrar).

> `npm run seed` se niega a tocar una base de datos que ya tenga datos. Pasa
> `-- --force` para borrarla y volver a sembrar. Apúntalo a otro archivo con
> `DATABASE_URL` si quieres conservar tu base de trabajo.

### Scripts

| Comando               | Qué hace                                                      |
| --------------------- | ------------------------------------------------------------- |
| `npm run dev`         | Servidor de desarrollo en el puerto 4321                      |
| `npm run build`       | Compilación de producción (adaptador de Node)                 |
| `npm run seed`        | Siembra un espacio de demostración (`-- --force` para pisar)  |
| `npm test`            | Pruebas unitarias (Vitest)                                    |
| `npm run test:e2e`    | Pruebas de extremo a extremo (Playwright, escritorio y móvil) |
| `npm run typecheck`   | `astro check`                                                 |
| `npm run lint`        | Biome sobre `src` y `tests` (`lint:fix` para aplicar)         |
| `npm run screenshots` | Regenera las imágenes del README contra una compilación de producción |

### Integraciones opcionales

Copia `.env.example` a `.env`. Todas las variables tienen un valor por defecto
para desarrollo, así que la app arranca sin él. Cada integración se activa solo
si tiene sus variables; sin ellas, su botón sale deshabilitado o su opción no
aparece, y nada se rompe.

| Integración                    | Variables                                          |
| ------------------------------ | -------------------------------------------------- |
| Entrar con Google              | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`         |
| Entrar con GitHub              | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`         |
| Archivos en Google Drive       | El par de Google de arriba, más `DRIVE_TOKEN_KEY`  |
| Web Push para los recordatorios | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

Los comentarios de `.env.example` explican cómo crear cada una.

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Stack tecnológico

[![Astro][astro-badge]][astro-url] [![TypeScript][typescript-badge]][typescript-url] [![Node.js][node-badge]][node-url] [![SQLite][sqlite-badge]][sqlite-url] [![Tailwind CSS][tailwind-badge]][tailwind-url] [![Playwright][playwright-badge]][playwright-url]

- **Frontend**: Astro 7 con TypeScript sin framework y Tailwind 4. Sin virtual
  DOM y sin runtime de framework en el navegador. Las notas usan Tiptap 3; las
  gráficas, Chart.js.
- **Backend**: Astro SSR con el adaptador de Node detrás de un servidor
  Express 5 pequeño, con su propia cadena de middleware. Tiempo real con
  Socket.IO.
- **Base de datos**: SQLite con `better-sqlite3`, síncrono y dentro del mismo
  proceso, con migraciones versionadas.
- **Pruebas**: Vitest para las unitarias, Playwright para los flujos de extremo
  a extremo con un perfil de escritorio y otro de teléfono, y Biome como linter.
  Todo corre en la CI.

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Despliegue

Guía completa en **[deploy/README.md](./deploy/README.md)**: una VM con disco
persistente, Caddy delante y systemd manteniendo vivo el proceso. Es lo que
sirve [forge-os.online](https://forge-os.online) en una `e2-micro` de la capa
gratuita.

Conviene saber antes de abrirla:

- **Los datos viven fuera del checkout** (`/var/lib/forge-os`, vía
  `DATABASE_URL` y `STORAGE_DIR`), así que un despliegue que limpie el
  directorio no puede llevarse por delante la base de datos ni los archivos
  subidos.
- **`PUBLIC_SITE_URL` es obligatoria en producción.** Sin ella la app se
  anuncia como `localhost:4321` en la URL canónica y en las etiquetas
  OpenGraph, aunque esté sirviendo un dominio real.
- **El servicio fija su zona horaria** (`TZ` en el unit de systemd). Las
  entregas y los recordatorios usan la zona de cada persona, pero la del
  servidor sigue decidiendo algunas tareas diarias.
- **Nunca `cp forge.db`.** La base de datos funciona en modo WAL, así que copiar
  el archivo da una copia incompleta o corrupta. Usa `scripts/backup.sh`, que
  va por `sqlite3 .backup` y verifica el resultado con `integrity_check`.
  También puede copiar cada respaldo a un bucket.

Una vez instalado, actualizar es un comando:

```sh
sudo /opt/forge-os/scripts/deploy.sh
```

Hace un respaldo de la base de datos, aparta `dist/`, compila, reinicia y espera
a `/healthz` —que hace una lectura real contra SQLite— antes de dar el
despliegue por bueno. Si algún paso falla, vuelve al commit anterior y deja el
servicio corriendo la versión que funcionaba.

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Seguridad

- **Aislamiento entre espacios en la capa de datos**: toda consulta va acotada
  por `workspace_id`, y una suite de extremo a extremo comprueba roles, IDOR,
  escalada de privilegios, sesiones e inyección, cada caso con su petición de
  control desde alguien que *sí* tiene permiso.
- **RBAC**: dueño, editor y lector, aplicados en el servidor.
- **Superficie de ataque**: mitigaciones activas contra inyección SQL, XSS,
  SSRF y path traversal, detrás de una CSP estricta. Las cookies de sesión son
  `HttpOnly` y `SameSite=Lax`, y ningún `GET` cambia el estado.
- **Drive**: la app pide solo el ámbito `drive.file` (los archivos que ella
  misma crea). Los bytes no pasan por el servidor: el navegador recibe una URL
  de subida de un solo uso, nunca un token de acceso. Los tokens de refresco se
  guardan cifrados con AES-256-GCM.
- **Web Push**: el servidor solo manda avisos a los servicios de push reales de
  los navegadores y admite como mucho 10 dispositivos por cuenta, así que una
  suscripción no puede dirigirlo a una dirección interna.
- **Límite de peticiones**: persistente entre reinicios, aplicado a la
  autenticación y a los endpoints públicos, y basado en `CF-Connecting-IP` para
  que no se pueda saltar falsificando `X-Forwarded-For`.
- **Registro**: los nombres de usuario se comprueban contra nombres reservados
  y ofensivos (también escritos con leetspeak o separadores), y un reto
  aritmético firmado que sirve la propia app deja fuera a los bots genéricos.
  Sin captcha de terceros.
- **Sin scripts de terceros**: sin analítica, sin rastreadores y con las
  fuentes servidas por la propia app. La CSP permite `'self'` y los endpoints de
  Google que necesitan las subidas a Drive.
- **Las cuentas de invitado son socialmente inertes**: no pueden enviar
  solicitudes de amistad ni bloquear a nadie, tampoco recibirlas, y no aparecen
  en las sugerencias de búsqueda.

¿Encontraste algo? Mira [SECURITY.md](./SECURITY.md).

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Accesibilidad

Los colores pasan WCAG AA en los dos temas, todo control tiene nombre
accesible y cada gráfica tiene su vista en tabla. Hay pruebas que vigilan las
reglas fáciles de romper sin querer: nada de opacidad sobre el texto, nada de
letra por debajo de 12 px y etiquetas que apuntan al control que envuelven.

## Roadmap

- [x] Identidad y espacios: inicio de sesión, sesiones, aislamiento multi-inquilino
- [x] Entrar con Google y GitHub
- [x] Tablero: alta rápida, Hoy y Próximos, subtareas, tareas que se repiten,
      recordatorios, etiquetas y carriles
- [x] Sprints, medición de tiempo y puntos opcionales por espacio
- [x] Notas sobre Tiptap: menciones, árbol que se anida arrastrando, índice de notas
- [x] Tablas dinámicas (fase 1): tablas creadas desde la interfaz, columnas de archivo
- [x] Archivos en Google Drive, con etiquetas compartidas con tareas y notas
- [x] Métricas con vista en tabla para cada gráfica
- [x] Web Push y calendario `.ics`
- [x] Disposición para teléfono de las pantallas de la app
- [x] Despliegue en producción con vuelta atrás automática y respaldos verificados
- [x] Diseño «Taller» (2.0): un solo juego de piezas y tokens, WCAG AA
- [ ] Desde una nota, ver y abrir las tareas que la enlazan (hoy el índice
      solo dice cuántas)
- [ ] Tablas dinámicas (fase 2): relaciones, fórmulas y vistas guardadas
- [ ] Búsqueda de texto completo dentro de notas y tareas (`Cmd/Ctrl+K` busca
      por título)

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Contribuir

Las contribuciones son bienvenidas.

1. Haz un [fork](https://github.com/JoseSerpaCode/Forge-OS/fork) del proyecto
2. Crea tu rama (`git checkout -b feature/AmazingFeature`)
3. Haz commit de tus cambios (`git commit -m 'feat(scope): add AmazingFeature'`)
4. Sube la rama (`git push origin feature/AmazingFeature`)
5. Abre un [Pull Request](https://github.com/JoseSerpaCode/Forge-OS/pulls)

Lee antes las [pautas de contribución](./CONTRIBUTING.md), y
[docs/desarrollo.md](./docs/desarrollo.md) antes de tocar una zona que
mencione: recoge las reglas que no se ven en el código. Los pull requests que
cambian flujos críticos deben venir con pruebas de Playwright.

## Licencia

Distribuido bajo la Licencia MIT. Mira [LICENSE](./LICENSE).

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->

[version-shield]: https://img.shields.io/github/package-json/v/JoseSerpaCode/Forge-OS?style=for-the-badge&color=2563eb
[version-url]: https://github.com/JoseSerpaCode/Forge-OS
[stars-shield]: https://img.shields.io/github/stars/JoseSerpaCode/Forge-OS.svg?style=for-the-badge
[stars-url]: https://github.com/JoseSerpaCode/Forge-OS/stargazers
[issues-shield]: https://img.shields.io/github/issues/JoseSerpaCode/Forge-OS.svg?style=for-the-badge
[issues-url]: https://github.com/JoseSerpaCode/Forge-OS/issues
[license-shield]: https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge
[license-url]: ./LICENSE
[ci-shield]: https://img.shields.io/github/actions/workflow/status/JoseSerpaCode/Forge-OS/ci.yml?style=for-the-badge&label=CI
[ci-url]: https://github.com/JoseSerpaCode/Forge-OS/actions/workflows/ci.yml
[astro-badge]: https://img.shields.io/badge/Astro-fff?style=for-the-badge&logo=astro&logoColor=bd303a&color=352563
[astro-url]: https://astro.build/
[typescript-badge]: https://img.shields.io/badge/Typescript-007ACC?style=for-the-badge&logo=typescript&logoColor=white&color=blue
[typescript-url]: https://www.typescriptlang.org/
[node-badge]: https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white
[node-url]: https://nodejs.org/
[sqlite-badge]: https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white
[sqlite-url]: https://sqlite.org/
[tailwind-badge]: https://img.shields.io/badge/Tailwind_CSS-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8
[tailwind-url]: https://tailwindcss.com/
[playwright-badge]: https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white
[playwright-url]: https://playwright.dev/
