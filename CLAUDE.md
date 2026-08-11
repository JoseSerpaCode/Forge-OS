# Forge OS

Workspace empresarial multi-tenant: Kanban, bases de datos dinámicas y base de
conocimiento tipo Notion. Versión 1.8.3, Astro en modo SSR. Requiere Node >=22.12
(tienes 26 vía mise).

**El producto se llama "Forge OS"; el paquete de npm sigue siendo `forge-js`.**
El repositorio se renombró a `Forge-OS`. La diferencia es deliberada: renombrar
el paquete no aporta nada y rompería instalaciones.

## Stack

- **Astro 7.2** con `@astrojs/node` (adapter standalone) — hay además un `server.mjs`
  con Express 5 en la raíz.
- **Drizzle ORM 0.45** sobre `better-sqlite3` **v13**. Config en `drizzle.config.ts`,
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

## Accesibilidad: no lo deshagas sin querer

Los colores están calibrados para pasar WCAG AA en ambos temas (auditoría a 0
fallos). Tres reglas que se rompen con facilidad:

- **No apliques opacidad al texto** (`text-forge-muted/70` y similares). Los
  tokens ya están al filo del umbral; bajarles la opacidad los saca de AA. Fue
  la causa de 6 de los 24 fallos originales.
- **`--forge-accent-secondary` es color de marca** (logos, gradientes, adornos).
  Para texto naranja usa **`--forge-accent-text`**, que sí cumple. Están
  separados justo porque unificarlos obliga a elegir entre marca apagada o texto
  ilegible.
- **Texto sobre fondo naranja va con `text-forge-on-accent`**, nunca
  `text-forge-bg`: ese se invierte con el tema y el naranja no.

La variante `dark:` de Tailwind está atada a `[data-theme]` con
`@custom-variant`, no a `prefers-color-scheme`. Sin eso, `dark:prose-invert` no
se activa con el conmutador de la app.

## Reglas de cuentas: no las repartas por los endpoints

Tres módulos concentran reglas que antes estaban copiadas en varios sitios con
redacciones distintas. Si necesitas una de ellas, **impórtala; no la reescribas**.

- **`src/lib/social.ts`** — `canInteractSocially(a, b)` decide si dos cuentas
  pueden dirigirse una acción social. Es falso si cualquiera de las dos es
  invitado, **en los dos sentidos**: un invitado no manda solicitudes ni
  bloquea, y tampoco se le puede mandar ni bloquear a él. Ver perfiles no pasa
  por aquí — mirar no es interactuar. La regla estaba escrita tres veces y la
  cuarta acción (bloquear) se había quedado sin ella.

- **`src/lib/accountValidation.ts`** — nombres y correos. La lista negra va en
  **dos** listas a propósito: `BANNED_ANYWHERE` (subcadena libre) y
  `BANNED_TOKEN` (solo en límite de palabra). Unificarlas en una sola con
  búsqueda de subcadena rechaza «Scunthorpe», «disputa» y «analyst». Hay tests
  que lo comprueban; si añades un término, decide en cuál va.

- **`src/lib/captcha.ts`** — suma firmada con HMAC, **sin estado en servidor**.
  No lo cambies por reCAPTCHA ni hCaptcha: la portada promete «sin scripts de
  terceros» y el registro es justo donde más se notaría el desmentido.

Los invitados tampoco salen en las sugerencias de búsqueda
(`src/pages/api/sys/state.ts`): la consulta esconde `is_guest = 1` del `LIKE`
pero deja pasar la coincidencia **exacta**, para que dos invitados del mismo
espacio puedan llegar a su perfil. Si tocas ese SQL, mira
`tests/guest-search.test.ts`.

## La marca va en un solo componente

`src/components/brand/Logo.astro`. Había cuatro dibujos distintos de la misma F
—barra lateral, pie, hub y el SVG— con cuatro proporciones y dos letras, porque
`public/forge-icon.svg` usaba `<text font-family="Arial">` y un SVG no incrusta
fuentes: el favicon cambiaba de forma según la máquina. Ahora la F es un
trazado, duplicado a propósito en el componente y en el archivo SVG. **Si
cambias uno, cambia el otro.**

El nombre se escribe **«Forge OS»**, nunca «FORGE OS».

## Registro: el formulario y el servidor tienen que decir lo mismo

El formulario anunciaba contraseñas de 6 caracteres y el servidor exigía 8.
Ahora el mínimo está en `PASSWORD_MIN` (`src/pages/api/auth/register.ts`) y en
`auth.password.hint`; si mueves uno, mueve el otro.

El endpoint devuelve `{ error_field, error_code }`, no frases: la traducción la
pone el cliente desde las claves `err.*`. Y ante un captcha fallido devuelve
**un reto nuevo**, porque el mensaje dice «prueba con la suma nueva».

Los tests e2e que se registran usan `tests/e2e/helpers/register.ts`, que
resuelve la suma leyendo la página. No se puentea el captcha en pruebas.

## Tablas reservadas: no están rotas, están sin construir

Hay 7 tablas en el esquema que no consulta ningún código. **No son restos ni un
error**: son alcance declarado por adelantado. Se mantienen porque crear una
tabla vacía en SQLite cuesta unos bytes, mientras que borrarlas obliga a
escribir la migración dos veces cuando llegue la feature.

| Tabla | Feature prevista |
|---|---|
| `entry_relations`, `dynamic_views` | Bases de datos dinámicas fase 2 (está en el roadmap del README) |
| `document_chunks` | Búsqueda semántica / RAG |
| `public_forms` | Formularios públicos |
| `labels` | Etiquetas de issues y páginas |
| `channels`, `messages` | Chat de equipo (tiene esquema, sin interfaz) |

Antes de dar por muerta cualquiera de ellas, comprueba si su feature sigue en el
roadmap.

## Despliegue

Guía completa en `deploy/README.md`. Tres cosas que conviene saber sin abrirla:

- **Los datos viven fuera del checkout** (`/var/lib/forge-os`), vía
  `DATABASE_URL` y `STORAGE_DIR`. Un despliegue que limpie el directorio no
  puede llevarse por delante la base de datos ni los archivos subidos.
- **`PUBLIC_SITE_URL` es obligatoria en producción.** Sin ella la app se anuncia
  como `localhost:4321` en la URL canónica y en las etiquetas OpenGraph. Va de
  la mano de `trust proxy` en `server.mjs`: detrás de Caddy, sin ambas cosas,
  `Astro.url` miente.
- **Nunca `cp forge.db`.** La base está en WAL, así que copiar el archivo da una
  copia incompleta o corrupta. Usa `scripts/backup.sh`, que va por
  `sqlite3 .backup` y verifica la copia con `integrity_check`.

## Estado

Remote: `git@github.com:JoseSerpaCode/Forge-OS.git`. Sin PRs ni issues abiertos.
