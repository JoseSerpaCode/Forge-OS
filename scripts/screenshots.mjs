#!/usr/bin/env node
/**
 * Regenerates the README screenshots.
 *
 * Needs a running instance with seeded data. The whole flow:
 *
 *   DATABASE_URL=$PWD/forge_demo.db npm run seed -- --force
 *   DATABASE_URL=$PWD/forge_demo.db npm run build
 *   DATABASE_URL=$PWD/forge_demo.db PORT=4330 node server.mjs &
 *   npm run screenshots
 *
 * Point it elsewhere with BASE. Never run it against a database with real
 * content — whatever is on screen ends up in the README.
 *
 * Each page is captured in both themes, named <page>-<theme>.png, because the
 * README serves one or the other through GitHub's #gh-dark-mode-only fragment.
 */
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE || 'http://localhost:4330';
const OUT = process.env.OUT || 'public/screenshots';
const USER = process.env.DEMO_USER || 'avery';
const PASS = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const WS = process.env.DEMO_WS || 'atlas';

// Viewport shared by every shot so they line up when stacked in the README.
const VIEWPORT = { width: 1440, height: 900 };

// `expect` must be content that only appears when the page has real data —
// column headers and nav labels render fine on an empty board, so they prove
// nothing.
const PAGES = [
  { name: 'board',          url: null,               expect: 'Invoice PDF generation' },
  { name: 'knowledge-base', url: null,               expect: 'Architecture' },
  { name: 'dashboard',      url: '/',                expect: 'Atlas Platform' },
  {
    name: 'metrics',
    url: `/w/${WS}/metrics`,
    expect: null,
    // The charts stay empty until a sprint is picked: the selector is
    // client-side and there is no URL parameter to preselect one.
    setup: async () => {
      const picked = await page.evaluate(() => {
        const sel = document.getElementById('global-sprint-selector');
        if (!sel) return false;
        // 'all' is the "Global (Historical)" option and 'backlog' is not a
        // sprint — burndown only renders for a specific one.
        const real = Array.from(sel.options).find(
          (o) => o.value && o.value !== 'all' && o.value !== 'backlog'
        );
        if (!real) return false;
        sel.value = real.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      });
      if (!picked) throw new Error('no sprint available in the metrics selector');
      await page.waitForTimeout(2500); // let the fetches land and charts draw
    },
  },
];

// Empty states. If any of these show up the page rendered, but with nothing in
// it — which is exactly the screenshot we must not ship.
const EMPTY_MARKERS = [
  'Welcome to your new board',
  'currently empty',
  'No issues',
  'No pages yet',
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2, // retina-ish, so the images stay sharp when scaled down
});

const page = await context.newPage();

async function signIn() {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#username', USER);
  await page.fill('#password', PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

/**
 * First knowledge base page in the workspace, so the shot lands on real
 * content. Read from the index page rather than the API: /api/pages only
 * exposes POST, there is no listing endpoint.
 */
async function findKbPage() {
  await page.goto(`${BASE}/w/${WS}/p/`, { waitUntil: 'networkidle' });
  const href = await page
    .locator(`a[href*="/w/${WS}/p/"]`)
    .first()
    .getAttribute('href')
    .catch(() => null);
  return href && !href.endsWith('/p/') ? href : null;
}

/**
 * The board defaults to the Backlog view, and seeded issues all belong to a
 * sprint — so the default URL renders an empty board. Resolve the first real
 * sprint from the selector rather than hardcoding the seed's id.
 */
async function findBoardUrl() {
  await page.goto(`${BASE}/w/${WS}/board`, { waitUntil: 'networkidle' });
  const sprintId = await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll('select option'));
    const real = opts.find((o) => o.value && o.value !== 'backlog');
    return real ? real.value : null;
  });
  return sprintId ? `/w/${WS}/board?sprint=${sprintId}` : `/w/${WS}/board`;
}

await signIn();
console.log(`signed in as ${USER}`);

const kbUrl = process.env.KB_URL || (await findKbPage());
if (!kbUrl) {
  console.error('Could not find a knowledge base page. Seed the database first, or set KB_URL.');
  await browser.close();
  process.exit(1);
}
PAGES.find((p) => p.name === 'knowledge-base').url = kbUrl;
PAGES.find((p) => p.name === 'board').url = process.env.BOARD_URL || (await findBoardUrl());

let failures = 0;

for (const theme of ['dark', 'light']) {
  // The app reads localStorage.forge_theme on load and overrides the
  // server-rendered data-theme — the same path its own toggle uses.
  await context.addInitScript((t) => {
    try { window.localStorage.setItem('forge_theme', t); } catch {}
  }, theme);

  for (const p of PAGES) {
    const file = path.join(OUT, `${p.name}-${theme}.png`);
    await page.goto(BASE + p.url, { waitUntil: 'networkidle' });

    // Let chart.js animations and Editor.js hydration settle.
    await page.waitForTimeout(2500);

    if (p.setup) await p.setup();

    const applied = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const text = ((await page.textContent('body')) || '').trim();

    // Ask Playwright whether each empty-state marker is actually rendered.
    // Scraping textContent does not work: these panels stay in the DOM behind a
    // `hidden` class, and every visible ancestor's textContent still contains
    // their text.
    const visibleMarkers = [];
    for (const m of EMPTY_MARKERS) {
      if (await page.getByText(m, { exact: false }).first().isVisible().catch(() => false)) {
        visibleMarkers.push(m);
      }
    }

    const problems = [];
    if (applied !== theme) problems.push(`theme is "${applied}", expected "${theme}"`);
    if (text.length < 200) problems.push(`page looks empty (${text.length} chars)`);
    if (p.expect && !text.includes(p.expect)) problems.push(`missing expected content "${p.expect}"`);
    if (visibleMarkers.length) {
      problems.push(`empty state rendered ("${visibleMarkers.join('", "')}")`);
    }

    const raw = await page.screenshot({ animations: 'disabled' });

    // Re-encode as a palette PNG. UI screenshots are flat colour, so
    // quantisation is invisible while cutting roughly 70% of the bytes —
    // worth it for files that live in the repository forever. Resolution is
    // untouched, so they stay crisp on high-DPI displays.
    const optimised = await sharp(raw).png({ compressionLevel: 9, palette: true }).toBuffer();
    fs.writeFileSync(file, optimised);

    const kb = (optimised.length / 1024).toFixed(0);

    if (problems.length) {
      failures++;
      console.error(`  !! ${file}  ${kb}KB  — ${problems.join('; ')}`);
    } else {
      console.log(`  ok ${file}  ${kb}KB`);
    }
  }
}

await browser.close();

if (failures) {
  console.error(`\n${failures} screenshot(s) captured something unexpected. Check them before committing.`);
  process.exit(1);
}
console.log('\nAll screenshots captured.');
