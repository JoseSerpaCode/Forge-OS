<a name="readme-top"></a>

<div align="center">

<img width="90px" src="./public/forge-icon.svg" alt="Forge OS" />

## Forge OS • Enterprise Multi-Tenant Workspace

[![Version][version-shield]][version-url]
[![CI][ci-shield]][ci-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]

**Kanban boards, dynamic databases and a Notion-style knowledge base in one
self-hosted workspace.** Built on Astro SSR with a synchronous SQLite core — no
virtual DOM, no client-side framework, no external services.

[Report a bug](https://github.com/JoseSerpaCode/Forge-OS/issues) · [Request a feature](https://github.com/JoseSerpaCode/Forge-OS/issues) · [Changelog](./CHANGELOG.md)

**English** · [Español](./README.es.md)

<img src="./public/screenshots/board-dark.png#gh-dark-mode-only" alt="Kanban board with sprint columns" width="900" />
<img src="./public/screenshots/board-light.png#gh-light-mode-only" alt="Kanban board with sprint columns" width="900" />

</div>

<details>
<summary><b>Table of contents</b></summary>

- [Why Forge OS](#why-forge-os)
- [Features](#features)
- [Screenshots](#screenshots)
- [Getting started](#getting-started)
  - [Requirements](#requirements)
  - [Install](#install)
  - [Scripts](#scripts)
- [Tech stack](#tech-stack)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

</details>

<br/>

## Why Forge OS

Most team workspaces make you choose: a fast board with no documentation, or a
wiki that cannot track work. Forge OS puts both behind the same multi-tenant
boundary, so an issue can link to a page and the page knows which issues
reference it.

It runs as a **single Node process against a local SQLite file**. There is no
database server to operate, no queue, no cache tier. Cloning the repo and
running two commands gives you a working instance.

## Features

- **Strict multi-tenant isolation** — workspaces are separated at the data
  layer, not the UI. Every query is scoped by `workspace_id`, with exhaustive
  IDOR protection on each endpoint.
- **Kanban and sprints** — epics, stories, tasks and bugs across four columns
  with persistent drag & drop, plus server-side time tracking that auto-stops
  when an issue reaches Done.
- **Knowledge base** — a Notion-style editor built on Editor.js with tables,
  code blocks, undo/redo and bidirectional links between pages and issues.
- **Dynamic databases** — build Airtable-style tables from the UI, without
  touching a schema file.
- **Sprint metrics** — velocity, burndown, distribution and precision charts
  rendered with Chart.js from real work logs.
- **Forge Hub** — public profiles with banner, avatar and bio, inline editing,
  friendships and user blocking.
- **Guest accounts** — restricted, isolated sessions that can be promoted to a
  real account later, carrying their provisional workspaces across.
- **Command palette** — `Cmd/Ctrl+K` for global navigation, plus single-key
  shortcuts throughout the app.
- **Bilingual UI** — English and Spanish, detected automatically.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Screenshots

Every image below comes from `npm run seed` — regenerate them all with
`npm run screenshots`.

**Sprint metrics** — velocity, burndown, workload distribution and estimation
precision, drawn from real work logs.

<img src="./public/screenshots/metrics-dark.png#gh-dark-mode-only" alt="Sprint metrics dashboard" width="900" />
<img src="./public/screenshots/metrics-light.png#gh-light-mode-only" alt="Sprint metrics dashboard" width="900" />

**Knowledge base** — a Notion-style editor with a page tree and bidirectional
links between pages and issues.

<img src="./public/screenshots/knowledge-base-dark.png#gh-dark-mode-only" alt="Knowledge base editor" width="900" />
<img src="./public/screenshots/knowledge-base-light.png#gh-light-mode-only" alt="Knowledge base editor" width="900" />

**Hub** — every workspace, your pending tasks and notifications in one place.

<img src="./public/screenshots/dashboard-dark.png#gh-dark-mode-only" alt="Personal hub" width="900" />
<img src="./public/screenshots/dashboard-light.png#gh-light-mode-only" alt="Personal hub" width="900" />

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting started

### Requirements

**Node.js 22.12 or newer.** CI runs on Node 26. `better-sqlite3` compiles a
native module on install, so a working C++ toolchain is required — on most
systems it is already present.

### Install

```sh
git clone https://github.com/JoseSerpaCode/Forge-OS.git
cd Forge-OS
npm install
```

Populate a demo workspace — a sprint, a board spread across all four columns,
work logs and a small knowledge base:

```sh
npm run seed
```

Then start the dev server:

```sh
npm run dev
```

The app is served at **http://localhost:4321**. Sign in as `avery` with the
seed password (`LocalDevPass123!` by default; override it by exporting
`TEST_PASSWORD` before seeding).

> `npm run seed` refuses to touch a database that already has data. Pass
> `-- --force` to wipe and reseed. Point it elsewhere with `DATABASE_URL` if you
> want to keep your working database untouched.

### Scripts

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Dev server on port 4321                           |
| `npm run build`     | Production build (Node adapter)                   |
| `npm run seed`      | Seed a demo workspace (`-- --force` to overwrite) |
| `npm test`          | Unit tests (Vitest)                               |
| `npm run test:e2e`  | End-to-end tests (Playwright)                     |
| `npm run typecheck` | `astro check`                                     |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Tech stack

[![Astro][astro-badge]][astro-url] [![TypeScript][typescript-badge]][typescript-url] [![Node.js][node-badge]][node-url] [![SQLite][sqlite-badge]][sqlite-url] [![Playwright][playwright-badge]][playwright-url]

- **Frontend** — Astro 7 with vanilla JS and CSS. No virtual DOM and no
  framework runtime shipped to the browser.
- **Backend** — Astro SSR on the Node adapter, running as a single monolithic
  server with its own middleware chain. Realtime over Socket.IO.
- **Database** — SQLite through `better-sqlite3`, synchronous and in-process.
- **Testing** — Playwright for end-to-end flows, Vitest for units.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Security

- **RBAC** — owner, editor, commenter and viewer roles, enforced server-side.
- **Attack surface** — active mitigations for SQL injection, XSS, SSRF and path
  traversal in attachment handling, behind a strict CSP.
- **Uploads** — 10 MB ceiling, MIME type verification, UUIDv4 identifiers.
- **Rate limiting** — persistent across restarts, applied to auth and public
  endpoints.

Found something? See [SECURITY.md](./SECURITY.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] Identity and workspaces — login, sessions, multi-tenant isolation
- [x] Knowledge base — documents, safe Markdown parsing, bidirectional links
- [x] Kanban and sprints — drag & drop, velocity/distribution/precision metrics, time tracking
- [x] Dashboard — cross-workspace summary and global notifications
- [x] UI/UX and command palette — global shortcuts, modals, toast feedback
- [x] Dynamic databases (phase 1) — Airtable-style tables from the UI
- [ ] Dynamic databases (phase 2) — relations, formulas and saved views
- [ ] Full-text search across pages and issues

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are welcome.

1. [Fork](https://github.com/JoseSerpaCode/Forge-OS/fork) the project
2. Create your branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat(scope): add AmazingFeature'`)
4. Push the branch (`git push origin feature/AmazingFeature`)
5. Open a [Pull Request](https://github.com/JoseSerpaCode/Forge-OS/pulls)

Please read the [contribution guidelines](./CONTRIBUTING.md) first. Pull
requests that change critical flows are expected to come with Playwright tests.

## License

Distributed under the MIT License. See [LICENSE](./LICENSE).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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
