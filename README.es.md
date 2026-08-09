<a name="readme-top"></a>

<div align="center">

<img width="90px" src="./public/forge-icon.svg" alt="Forge OS" />

## Forge OS • Espacio de trabajo empresarial multi-inquilino

[![Version][version-shield]][version-url]
[![CI][ci-shield]][ci-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]

**Tableros Kanban, bases de datos dinámicas y una base de conocimiento tipo
Notion en un único espacio de trabajo autoalojado.** Construido sobre Astro SSR
con un núcleo SQLite síncrono: sin virtual DOM, sin framework en el cliente, sin
servicios externos.

[Reportar un bug](https://github.com/JoseSerpaCode/Forge-OS/issues) · [Sugerir una funcionalidad](https://github.com/JoseSerpaCode/Forge-OS/issues) · [Changelog](./CHANGELOG.md)

[English](./README.md) · **Español**

<img src="./public/screenshots/board-dark.png#gh-dark-mode-only" alt="Tablero Kanban con columnas de sprint" width="900" />
<img src="./public/screenshots/board-light.png#gh-light-mode-only" alt="Tablero Kanban con columnas de sprint" width="900" />

</div>

<details>
<summary><b>Tabla de contenidos</b></summary>

- [Por qué Forge OS](#por-qué-forge-os)
- [Características](#características)
- [Capturas](#capturas)
- [Empezar](#empezar)
  - [Requisitos](#requisitos)
  - [Instalación](#instalación)
  - [Scripts](#scripts)
- [Stack tecnológico](#stack-tecnológico)
- [Seguridad](#seguridad)
- [Roadmap](#roadmap)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

</details>

<br/>

## Por qué Forge OS

Casi todos los espacios de trabajo en equipo te obligan a elegir: un tablero
rápido sin documentación, o un wiki que no sabe seguir el trabajo. Forge OS pone
ambos detrás de la misma frontera multi-inquilino, de modo que un issue puede
enlazar a una página y la página sabe qué issues la referencian.

Funciona como **un solo proceso de Node contra un archivo SQLite local**. No hay
servidor de base de datos que mantener, ni colas, ni capa de caché. Clonar el
repositorio y ejecutar dos comandos te deja una instancia funcionando.

## Características

- **Aislamiento multi-inquilino estricto**: los espacios de trabajo se separan en
  la capa de datos, no en la interfaz. Toda consulta va acotada por
  `workspace_id`, con protección IDOR exhaustiva en cada endpoint.
- **Kanban y sprints**: épicas, historias, tareas y bugs repartidos en cuatro
  columnas con drag & drop persistente, más control de tiempo en servidor que se
  detiene solo cuando un issue llega a Done.
- **Base de conocimiento**: editor tipo Notion sobre Editor.js con tablas,
  bloques de código, deshacer/rehacer y enlaces bidireccionales entre páginas e
  issues.
- **Bases de datos dinámicas**: crea tablas tipo Airtable desde la interfaz, sin
  tocar ningún archivo de esquema.
- **Métricas de sprint**: gráficas de velocity, burndown, distribución y
  precisión renderizadas con Chart.js a partir de registros de trabajo reales.
- **Forge Hub**: perfiles públicos con banner, avatar y biografía, edición en
  línea, sistema de amistades y bloqueo de usuarios.
- **Cuentas de invitado**: sesiones restringidas y aisladas que luego pueden
  promocionarse a una cuenta real, arrastrando sus espacios provisionales.
- **Paleta de comandos**: `Cmd/Ctrl+K` para navegación global, más atajos de una
  sola tecla por toda la aplicación.
- **Interfaz bilingüe**: inglés y español, detectados automáticamente.

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Capturas

Todas las imágenes salen de `npm run seed` — puedes regenerarlas con
`npm run screenshots`.

**Métricas de sprint**: velocity, burndown, distribución de carga y precisión de
estimación, calculadas a partir de registros de trabajo reales.

<img src="./public/screenshots/metrics-dark.png#gh-dark-mode-only" alt="Panel de métricas de sprint" width="900" />
<img src="./public/screenshots/metrics-light.png#gh-light-mode-only" alt="Panel de métricas de sprint" width="900" />

**Base de conocimiento**: editor tipo Notion con árbol de páginas y enlaces
bidireccionales entre páginas e issues.

<img src="./public/screenshots/knowledge-base-dark.png#gh-dark-mode-only" alt="Editor de la base de conocimiento" width="900" />
<img src="./public/screenshots/knowledge-base-light.png#gh-light-mode-only" alt="Editor de la base de conocimiento" width="900" />

**Hub**: todos tus espacios de trabajo, tareas pendientes y notificaciones en un
único sitio.

<img src="./public/screenshots/dashboard-dark.png#gh-dark-mode-only" alt="Hub personal" width="900" />
<img src="./public/screenshots/dashboard-light.png#gh-light-mode-only" alt="Hub personal" width="900" />

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Empezar

### Requisitos

**Node.js 22.12 o superior.** CI corre sobre Node 26. `better-sqlite3` compila un
módulo nativo durante la instalación, así que hace falta un toolchain de C++ —
en la mayoría de sistemas ya está presente.

### Instalación

```sh
git clone https://github.com/JoseSerpaCode/Forge-OS.git
cd Forge-OS
npm install
```

Puebla un espacio de trabajo de demostración: un sprint, un tablero repartido
por las cuatro columnas, registros de trabajo y una pequeña base de conocimiento:

```sh
npm run seed
```

Después levanta el servidor de desarrollo:

```sh
npm run dev
```

La aplicación queda en **http://localhost:4321**. Entra como `avery` con la
contraseña del seed (`LocalDevPass123!` por defecto; cámbiala exportando
`TEST_PASSWORD` antes de sembrar).

> `npm run seed` se niega a tocar una base de datos que ya tenga contenido. Pasa
> `-- --force` para borrarla y volver a sembrar. Con `DATABASE_URL` puedes
> apuntarlo a otro archivo si quieres dejar intacta tu base de trabajo.

### Scripts

| Comando             | Qué hace                                                       |
| ------------------- | -------------------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo en el puerto 4321                       |
| `npm run build`     | Build de producción (adaptador de Node)                        |
| `npm run seed`      | Siembra datos de demostración (`-- --force` para sobrescribir) |
| `npm test`          | Tests unitarios (Vitest)                                       |
| `npm run test:e2e`  | Tests end-to-end (Playwright)                                  |
| `npm run typecheck` | `astro check`                                                  |

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Stack tecnológico

[![Astro][astro-badge]][astro-url] [![TypeScript][typescript-badge]][typescript-url] [![Node.js][node-badge]][node-url] [![SQLite][sqlite-badge]][sqlite-url] [![Playwright][playwright-badge]][playwright-url]

- **Frontend**: Astro 7 con JavaScript y CSS vanilla. Sin virtual DOM y sin
  runtime de framework enviado al navegador.
- **Backend**: Astro SSR sobre el adaptador de Node, como servidor monolítico con
  su propia cadena de middlewares. Tiempo real con Socket.IO.
- **Base de datos**: SQLite mediante `better-sqlite3`, síncrona y en proceso.
- **Testing**: Playwright para los flujos end-to-end, Vitest para unitarios.

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Seguridad

- **RBAC**: roles owner, editor, commenter y viewer, aplicados en servidor.
- **Superficie de ataque**: mitigaciones activas contra inyección SQL, XSS, SSRF
  y path traversal en el manejo de adjuntos, tras una CSP estricta.
- **Subidas**: límite de 10 MB, verificación de tipo MIME, identificadores UUIDv4.
- **Rate limiting**: persistente entre reinicios, aplicado a autenticación y
  endpoints públicos.

¿Has encontrado algo? Consulta [SECURITY.md](./SECURITY.md).

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Roadmap

- [x] Identidad y espacios de trabajo: login, sesiones, aislamiento multi-inquilino
- [x] Base de conocimiento: documentos, parseo seguro de Markdown, enlaces bidireccionales
- [x] Kanban y sprints: drag & drop, métricas de velocity/distribución/precisión, control de tiempo
- [x] Dashboard: resumen entre espacios de trabajo y notificaciones globales
- [x] UI/UX y paleta de comandos: atajos globales, modales, feedback con toasts
- [x] Bases de datos dinámicas (fase 1): tablas tipo Airtable desde la interfaz
- [ ] Bases de datos dinámicas (fase 2): relaciones, fórmulas y vistas guardadas
- [ ] Búsqueda de texto completo sobre páginas e issues

<p align="right">(<a href="#readme-top">volver arriba</a>)</p>

## Contribuir

Las contribuciones son bienvenidas.

1. Haz un [fork](https://github.com/JoseSerpaCode/Forge-OS/fork) del proyecto
2. Crea tu rama (`git checkout -b feature/CaracteristicaIncreible`)
3. Haz commit de tus cambios (`git commit -m 'feat(scope): añadir CaracteristicaIncreible'`)
4. Sube la rama (`git push origin feature/CaracteristicaIncreible`)
5. Abre un [Pull Request](https://github.com/JoseSerpaCode/Forge-OS/pulls)

Por favor, lee antes las [normas de contribución](./CONTRIBUTING.md). Se espera
que los pull requests que toquen flujos críticos vengan con tests de Playwright.

## Licencia

Distribuido bajo licencia MIT. Consulta [LICENSE](./LICENSE).

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
[playwright-badge]: https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white
[playwright-url]: https://playwright.dev/
