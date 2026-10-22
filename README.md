<a name="readme-top"></a>

<div align="center">

<img width="90px" src="./public/forge-icon.svg" alt="Forge OS" />

## Forge OS • Self-hosted multi-tenant workspace

[![Version][version-shield]][version-url]
[![CI][ci-shield]][ci-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]

**A Kanban board, a Notion-style notes editor, Airtable-style tables and
files in one self-hosted workspace.** Astro SSR over a single SQLite file: no
client-side framework, no database server, and nothing external required —
Google and GitHub sign-in, Google Drive and Web Push are optional and switch on
only when configured.

[Live instance](https://forge-os.online) · [Report a bug](https://github.com/JoseSerpaCode/Forge-OS/issues) · [Request a feature](https://github.com/JoseSerpaCode/Forge-OS/issues) · [Changelog](./CHANGELOG.md)

**English** · [Español](./README.es.md)

<img src="./public/screenshots/board-dark.png#gh-dark-mode-only" alt="Kanban board with its four status columns" width="900" />
<img src="./public/screenshots/board-light.png#gh-light-mode-only" alt="Kanban board with its four status columns" width="900" />

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
  - [Optional integrations](#optional-integrations)
- [Tech stack](#tech-stack)
- [Deployment](#deployment)
- [Security](#security)
- [Accessibility](#accessibility)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

</details>

<br/>

## Why Forge OS

Tasks, notes and files usually live in three tools that know nothing about
each other. In Forge OS they share one workspace and one set of labels: tag a
task, a note and a PDF with «Midterm 2» and filtering by it brings back all
three. A task links the notes it needs from its own panel.

It works for a team that plans in sprints and for one person organising a
semester. Sprints, time tracking and story points are **per-workspace
switches**: new workspaces start with all three off, and turning one off hides
it without deleting its data.

It runs as a **single Node process against a local SQLite file**. There is no
database server, no queue and no cache tier to operate.

## Features

**Board**

- Four statuses — To do, In progress, In review, Done — with persistent drag &
  drop. Done shows the last ten, with «Show more».
- **Quick add**: «Hand in lab report friday 18:00 #Physics !1 [[Topic 3]]
  @sam» creates the task with its due date and time, label, priority, linked
  note and assignee. What was recognised shows up as removable chips. Press
  `C` anywhere in a workspace.
- **Today** and **Upcoming** views, a work date separate from the due date,
  subtasks, repeating tasks («every monday», «on the 15th of each month»),
  saved views and custom issue types per workspace.
- **Task templates**, written in the workspace settings or saved from any task,
  plus six built-in ones. Picking one in the new-task form fills it in to
  adjust before creating, and its steps become subtasks.
- **Files attached when creating a task**, and labels and task types edited
  (name and colour) from the workspace settings.
- **Select several cards** to move them to another status or sprint, label
  them or delete them in one go.
- **On a phone**, one column at a time with the status tabs pinned on top:
  press and hold a card and drop it on a tab to move it, swipe sideways to
  change tab, or use the card's move sheet.
- **Reminders** before a due date, in each person's own time zone, as in-app
  notifications and — if configured — Web Push, so they arrive with Forge
  closed.
- Swimlanes by label, one-click complete with undo, and a read-only `.ics`
  calendar to subscribe from Google Calendar.
- Optional sprints, time tracking (the timer stops when a task reaches review
  or Done) and story points: with points on, columns add them up, the board
  says how many are done, and Metrics measures sprint progress and velocity in
  points.

**Notes**

- A Tiptap editor: Markdown shortcuts as you type, a `/` menu, a floating
  format toolbar, a drag handle on every block, tables and code blocks.
- `@` mentions of members and contacts.
- A page tree you can reorder and nest by dragging, or with «Move to…» from
  the keyboard or a phone.
- A notes index: the last note you opened, the three most recent ones, and a
  table of every note with its labels, last editor and how many tasks link to
  it.

**Tables and files**

- **Tables** built from the UI, Airtable-style, from scratch or from a
  template, including a file column that points to the workspace's files.
- **Files** live in the Google Drive of whoever connected the workspace, in
  folders mirrored on both sides. Labels, name search across the whole
  workspace, and labels inherited when a file is attached to a task.

**Metrics**

- Workload per person, sprint progress, tasks closed per sprint, and estimated
  versus logged time — only the charts the workspace can actually fill. Every
  chart has a «Chart | Table» switch with the same data as text.

**People and workspaces**

- Owner, editor and viewer roles, enforced on the server. Invitations with a
  people search.
- **Contacts**: people without a Forge account can be assignees and be
  mentioned in notes. They belong to your account, so they work in every
  workspace.
- Public profiles; friends and blocking, opt-in per account.
- Guest accounts that can later become a real account and keep their
  workspaces.
- Automations and an audit log, switched on per workspace.

**Everywhere**

- **Home**: what is pending for you across every workspace, grouped by
  workspace, with overdue tasks counted apart.
- `Cmd/Ctrl+K` to jump to any workspace, person, note or task by title.
- English and Spanish, detected automatically. The landing page also has a
  Spanish address of its own (`/es`), so search engines index both.
- Light and dark themes, a dedicated phone layout with bottom navigation, and
  installable as an app.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Screenshots

Every image comes from `npm run seed` and is regenerated with
`npm run screenshots`.

**Metrics** — workload, sprint progress, tasks closed per sprint and estimated
versus logged time, from real work logs.

<img src="./public/screenshots/metrics-dark.png#gh-dark-mode-only" alt="Metrics page" width="900" />
<img src="./public/screenshots/metrics-light.png#gh-light-mode-only" alt="Metrics page" width="900" />

**Notes** — the editor next to the page tree.

<img src="./public/screenshots/knowledge-base-dark.png#gh-dark-mode-only" alt="Notes editor with the page tree" width="900" />
<img src="./public/screenshots/knowledge-base-light.png#gh-light-mode-only" alt="Notes editor with the page tree" width="900" />

**Home** — your pending tasks grouped by workspace, and your workspaces.

<img src="./public/screenshots/dashboard-dark.png#gh-dark-mode-only" alt="Home page" width="900" />
<img src="./public/screenshots/dashboard-light.png#gh-light-mode-only" alt="Home page" width="900" />

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting started

### Requirements

**Node.js 22.12 or newer.** CI runs on Node 26.

Nothing else. `better-sqlite3` ships prebuilt binaries for linux-x64,
linux-arm64, macOS and Windows, so there is no compiler step.

### Install

```sh
git clone https://github.com/JoseSerpaCode/Forge-OS.git
cd Forge-OS
npm install
```

Populate a demo workspace — sprints, time tracking and points switched on, a
board spread across all four columns, work logs and a few notes:

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

| Command               | What it does                                           |
| --------------------- | ------------------------------------------------------ |
| `npm run dev`         | Dev server on port 4321                                |
| `npm run build`       | Production build (Node adapter)                        |
| `npm run seed`        | Seed a demo workspace (`-- --force` to overwrite)      |
| `npm test`            | Unit tests (Vitest)                                    |
| `npm run test:e2e`    | End-to-end tests (Playwright, desktop and phone)       |
| `npm run typecheck`   | `astro check`                                          |
| `npm run lint`        | Biome over `src` and `tests` (`lint:fix` to apply)     |
| `npm run screenshots` | Regenerate the README images against a production build |

### Optional integrations

Copy `.env.example` to `.env`. Every variable has a development default, so
the app starts without it. Each integration below turns on only when its
variables are set; without them its button is disabled or its option does not
appear, and nothing breaks.

| Integration              | Variables                                          |
| ------------------------ | -------------------------------------------------- |
| Sign in with Google      | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`         |
| Sign in with GitHub      | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`         |
| Files in Google Drive    | The Google pair above, plus `DRIVE_TOKEN_KEY`      |
| Web Push for reminders   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

The comments in `.env.example` say how to create each one.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Tech stack

[![Astro][astro-badge]][astro-url] [![TypeScript][typescript-badge]][typescript-url] [![Node.js][node-badge]][node-url] [![SQLite][sqlite-badge]][sqlite-url] [![Tailwind CSS][tailwind-badge]][tailwind-url] [![Playwright][playwright-badge]][playwright-url]

- **Frontend** — Astro 7 with vanilla TypeScript and Tailwind 4. No virtual DOM
  and no framework runtime shipped to the browser. Notes use Tiptap 3, charts
  Chart.js.
- **Backend** — Astro SSR on the Node adapter behind a small Express 5 server,
  with its own middleware chain. Realtime over Socket.IO.
- **Database** — SQLite through `better-sqlite3`, synchronous and in-process,
  with versioned migrations.
- **Testing** — Vitest for units, Playwright for end-to-end flows on a desktop
  and a phone profile, Biome as linter. All of it runs in CI.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Deployment

Full walkthrough in **[deploy/README.md](./deploy/README.md)** — a VM with a
persistent disk, Caddy in front and systemd keeping the process alive. It is
what runs [forge-os.online](https://forge-os.online) on a free-tier `e2-micro`.

Things worth knowing before you open it:

- **Data lives outside the checkout** (`/var/lib/forge-os`, via `DATABASE_URL`
  and `STORAGE_DIR`), so a deploy that wipes the directory cannot take the
  database or the uploads with it.
- **`PUBLIC_SITE_URL` is required in production.** Without it the app
  advertises itself as `localhost:4321` in the canonical URL and the OpenGraph
  tags, even while serving a real domain.
- **The service sets its time zone** (`TZ` in the systemd unit). Due dates and
  reminders use each person's own zone, but the server's zone still decides a
  few daily jobs.
- **Never `cp forge.db`.** The database runs in WAL mode, so copying the file
  gives you an incomplete or corrupt snapshot. Use `scripts/backup.sh`, which
  goes through `sqlite3 .backup` and verifies the result with
  `integrity_check`. It can also copy each backup to a bucket.

Once installed, updates are one command:

```sh
sudo /opt/forge-os/scripts/deploy.sh
```

It backs up the database, sets `dist/` aside, builds, restarts, and waits for
`/healthz` — which does a real read against SQLite — before calling the deploy
good. If any step fails it returns to the previous commit and leaves the
service running the version that worked.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Security

- **Tenant isolation at the data layer** — every query is scoped by
  `workspace_id`, and an end-to-end suite checks roles, IDOR, privilege
  escalation, sessions and injection, each case with a control request from
  someone who *is* allowed.
- **RBAC** — owner, editor and viewer, enforced server-side.
- **Attack surface** — active mitigations for SQL injection, XSS, SSRF and path
  traversal, behind a strict CSP. Session cookies are `HttpOnly` and
  `SameSite=Lax`, and no `GET` changes state.
- **Drive** — the app asks only for the `drive.file` scope (files it created
  itself). File bytes never pass through the server: the browser gets a
  single-use upload URL, never an access token. Refresh tokens are encrypted
  with AES-256-GCM.
- **Web Push** — the server only sends to the browsers' real push services and
  caps each account at 10 devices, so a subscription cannot point it at an
  internal address.
- **Rate limiting** — persistent across restarts, applied to auth and public
  endpoints, keyed on `CF-Connecting-IP` so it cannot be bypassed by forging
  `X-Forwarded-For`.
- **Registration** — usernames are checked against reserved and abusive names
  (with leetspeak and separator evasion folded in), and a signed arithmetic
  challenge served by this app keeps generic bots out. No third-party captcha.
- **No third-party scripts** — no analytics, no trackers, fonts served from the
  app itself. The CSP allows `'self'` plus the Google endpoints that Drive
  uploads need.
- **Guest accounts are socially inert** — they cannot send friend requests,
  block anyone, or be the target of either, and they stay out of search
  suggestions.

Found something? See [SECURITY.md](./SECURITY.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Accessibility

Colours pass WCAG AA in both themes, every control has an accessible name, and
every chart has a table view. Tests guard the rules that are easy to break by
accident: no opacity on text, no text under 12 px, and labels that point to the
control they wrap.

## Roadmap

- [x] Identity and workspaces — login, sessions, multi-tenant isolation
- [x] Sign in with Google and GitHub
- [x] Kanban — quick add, Today and Upcoming, subtasks, repeating tasks,
      reminders, labels and swimlanes
- [x] Optional sprints, time tracking and story points per workspace
- [x] Notes on Tiptap — mentions, drag-to-nest page tree, notes index
- [x] Dynamic tables (phase 1) — tables built from the UI, file columns
- [x] Files in Google Drive, with labels shared with tasks and notes
- [x] Metrics with a table view for every chart
- [x] Web Push and a `.ics` calendar feed
- [x] Phone layout for the in-app screens
- [x] Production deployment with automated rollback and verified backups
- [x] «Taller» design (2.0) — one set of components and tokens, WCAG AA
- [ ] From a note, see and open the tasks that link to it (today the index
      only shows how many)
- [ ] Dynamic tables (phase 2) — relations, formulas and saved views
- [ ] Full-text search inside notes and tasks (`Cmd/Ctrl+K` searches titles)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are welcome.

1. [Fork](https://github.com/JoseSerpaCode/Forge-OS/fork) the project
2. Create your branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat(scope): add AmazingFeature'`)
4. Push the branch (`git push origin feature/AmazingFeature`)
5. Open a [Pull Request](https://github.com/JoseSerpaCode/Forge-OS/pulls)

Please read the [contribution guidelines](./CONTRIBUTING.md) first, and
[docs/desarrollo.md](./docs/desarrollo.md) (in Spanish) before touching an area
it covers: it holds the rules that are not visible in the code. Pull requests
that change critical flows are expected to come with Playwright tests.

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
[tailwind-badge]: https://img.shields.io/badge/Tailwind_CSS-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8
[tailwind-url]: https://tailwindcss.com/
[playwright-badge]: https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white
[playwright-url]: https://playwright.dev/
