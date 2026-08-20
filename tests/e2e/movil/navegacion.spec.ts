import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * La barra inferior.
 *
 * Antes, en un teléfono, todo el movimiento pasaba por una hamburguesa en la
 * esquina superior izquierda —la más lejos del pulgar— que abría un cajón con
 * once entradas. Saltar del tablero a las páginas eran tres gestos.
 *
 * Lo que se comprueba aquí no es que la barra exista, sino que **navega**: que
 * la pestaña lleva a su sitio, que «Más» abre el resto y que se cierra con
 * Escape. Una barra bonita que no lleva a ninguna parte pasaría un `toBeVisible`
 * sin problema.
 */
const ESPACIO = 'ws-nav-movil';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

function conEspacio() {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const nuevo = crypto.randomUUID();
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(nuevo, 'Navegación móvil', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);
  return ws.id;
}

test('la barra inferior lleva a las secciones del espacio', async ({ page }) => {
  await entrar(page);
  conEspacio();
  await page.goto(`/w/${ESPACIO}`);

  const barra = page.locator('nav.nav-movil');
  await expect(barra).toBeVisible();
  await expect(barra.locator('.tab-movil')).toHaveCount(4);

  // La pestaña de la página en la que estamos se marca, y solo esa.
  await expect(barra.locator('[aria-current="page"]')).toHaveCount(1);

  await barra.getByRole('link').nth(1).click();
  await page.waitForURL(`**/w/${ESPACIO}/board**`);
  await expect(page.locator('nav.nav-movil [aria-current="page"]')).toHaveCount(1);
});

test('«Más» abre el resto de secciones y se cierra con Escape', async ({ page }) => {
  await entrar(page);
  conEspacio();
  await page.goto(`/w/${ESPACIO}`);

  const boton = page.locator('#btn-nav-mas');
  const hoja = page.locator('#nav-mas');

  await expect(boton).toHaveAttribute('aria-expanded', 'false');
  await expect(hoja).toBeHidden();

  await boton.click();
  await expect(hoja).toBeVisible();
  await expect(boton).toHaveAttribute('aria-expanded', 'true');

  // Lo que no cabe en cuatro pestañas tiene que estar aquí, no en ningún sitio.
  await expect(hoja.locator(`a[href="/w/${ESPACIO}/db"]`)).toBeVisible();
  await expect(hoja.locator(`a[href="/w/${ESPACIO}/files"]`)).toBeVisible();
  await expect(hoja.locator(`a[href="/w/${ESPACIO}/metrics"]`)).toBeVisible();
  await expect(hoja.locator(`a[href="/w/${ESPACIO}/settings"]`)).toBeVisible();

  await page.locator('body').press('Escape');
  await expect(hoja).toBeHidden();
  await expect(boton).toHaveAttribute('aria-expanded', 'false');
});

test('la barra no desaparece al salir del espacio', async ({ page }) => {
  await entrar(page);
  await page.goto('/people');

  const barra = page.locator('nav.nav-movil');
  await expect(barra).toBeVisible();
  await expect(barra.locator('.tab-movil')).toHaveCount(4);

  /*
   * Se comprueba que sigue ahí y con las cuatro pestañas, no *cuáles* son.
   *
   * Los destinos dependen de si hay un espacio en contexto —el de la URL o el
   * último visitado, igual que en el menú lateral—, así que fijar aquí los
   * globales hacía que la prueba pasara sola y fallara junto a las demás, que
   * dejan un `last_workspace_id` puesto. Lo que importa de verdad es que una
   * barra intermitente obliga a mirar antes de tocar; eso es lo que se fija.
   */
  await expect(page.locator('#btn-nav-mas')).toBeVisible();
});

test('las etiquetas de las pestañas caben en su hueco', async ({ page }) => {
  await entrar(page);
  conEspacio();
  await page.goto(`/w/${ESPACIO}`);

  /*
   * Se reusaban las etiquetas del menú lateral —«Panel Principal», «Tablero
   * Kanban», «Base de Conocimiento»—, que en un hueco de 90 px se desbordaban y
   * se pisaban unas a otras. Aquí se comprueba lo que se ve, no la cadena: que
   * ningún texto está recortado y que ninguna pestaña invade a la siguiente.
   */
  const recortadas = await page.locator('nav.nav-movil .tab-texto').evaluateAll((nodos) =>
    nodos.filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent)
  );
  expect(recortadas, 'etiquetas que no caben en su pestaña').toEqual([]);

  const cajas = await page.locator('nav.nav-movil .tab-movil').evaluateAll((nodos) =>
    nodos.map((n) => n.getBoundingClientRect()).map((r) => [r.left, r.right])
  );
  for (let i = 1; i < cajas.length; i++) {
    expect(cajas[i][0], 'una pestaña empieza antes de que acabe la anterior')
      .toBeGreaterThanOrEqual(cajas[i - 1][1] - 1);
  }
});

test('en móvil no hay dos menús: la hamburguesa se retira', async ({ page }) => {
  await entrar(page);
  conEspacio();
  await page.goto(`/w/${ESPACIO}`);

  // Tener a la vez la barra inferior y el cajón lateral obliga a aprenderse dos
  // mapas de la misma aplicación.
  await expect(page.locator('#sidebar-toggle')).toBeHidden();
  await expect(page.locator('nav.nav-movil')).toBeVisible();
});
