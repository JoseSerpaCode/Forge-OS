# forge-js ("Forge OS")

Workspace empresarial multi-tenant: Kanban, bases de datos dinámicas y base de
conocimiento tipo Notion. Versión 1.4.0, Astro en modo SSR. Requiere Node >=22.12
(tienes 26 vía mise). El servidor se autodenomina **"Forge OS"** en los logs de
arranque, aunque el repo y el paquete se llamen `forge-js`.

## Stack

- **Astro 7.2** con `@astrojs/node` (adapter standalone) — hay además un `server.mjs`
  con Express 5 en la raíz.
- **Drizzle ORM 0.45** sobre `better-sqlite3`. Config en `drizzle.config.ts`,
  esquema versionado también como SQL plano (`schema.sql`, `schema-v1.1-social.sql`).
- **Editor.js** con un montón de plugins (checklist, code, table, quote, undo,
  drag-drop) — es el núcleo de la UI de edición.
- **Tailwind 4** vía `@tailwindcss/vite` (no el plugin de PostCSS) + typography.
- Auth con `bcryptjs` + `cookie` **v2**. Sanitización con `isomorphic-dompurify`.
- Gráficas con `chart.js`. Realtime con `socket.io-client`.

> **`cookie` v2 renombró la API**: es `parseCookie`/`stringifyCookie`, no
> `parse`/`serialize`, y ya no hay export por defecto. Astro ≥7.1 exige `cookie@^2`,
> así que mantener aquí una versión vieja rompe el arranque del servidor con
> `does not provide an export named 'parseCookie'`. Único uso propio:
> `src/lib/sockets.mjs`.

## Comandos

```bash
npm run dev       # astro dev
npm run build     # astro build
npm run preview
```

**Los tests no están en `package.json`.** Se ejecutan directamente:

```bash
npx vitest              # unitarios, config en vitest.config.ts
npx playwright test     # e2e, config en playwright.config.ts
```

Los navegadores de Playwright ya están descargados en `~/.cache/ms-playwright`.
Vale la pena añadir `"test"` y `"test:e2e"` a los scripts.

## Bases de datos locales

`forge.db` y `forge_test.db` (con sus `-shm`/`-wal`) están en la raíz del repo,
ignorados por git (`*.db`). **No los borres ni los sobrescribas** sin avisar:
`forge.db` tiene datos de desarrollo reales.

`forge_test.db` **acumula páginas libres a lo largo de muchas corridas** porque los
tests insertan y borran pero nunca hacen `VACUUM`. Una ejecución suelta no lo infla
(se queda en ~400 KB), pero con el tiempo llegó a 534 MB siendo 99,9% espacio vacío.
Si lo ves crecer: `sqlite3 forge_test.db "VACUUM;"`.

## Vulnerabilidades conocidas (no accionables)

`npm audit` reporta **4 moderadas** en la cadena
`drizzle-kit → @esbuild-kit/esm-loader → esbuild`. **No tienen arreglo**:
`drizzle-kit@0.31.10` ya es la última y sigue arrastrando esa dependencia. npm
sugiere "arreglarlo" con `drizzle-kit@0.18.1`, que es retroceder 13 versiones
menores — **no lo hagas**. El aviso de esbuild solo afecta a su dev server, que
aquí no se expone. No ejecutes `npm audit fix --force` en este repo.

## Estado

Remote: `git@github.com:JoseSerpaCode/Forge-js.git`. La rama
`fix/guest-ui-and-ci-fixes` ya está mergeada (PR #21, 26 de julio de 2026) — no
trabajes sobre ella.

Quedan PRs de Dependabot abiertos desde julio (tailwind, dompurify, playwright).
El de astro (#20) queda obsoleto: la subida a 7.2 + `cookie@2` ya está hecha.
