import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * Lo que solo aparece al pasar el ratón, en un móvil no existe.
 *
 * Diecinueve controles se pintaban con `opacity-0 group-hover:opacity-100` —o
 * `invisible`, o `hidden`— y en táctil no hay hover. Entre ellos: **borrar una
 * página**, **borrar una fila** de una base dinámica, cambiar el avatar,
 * cambiar el banner y las acciones del árbol. No eran incómodos: no se podían
 * usar.
 *
 * Se comprueban los que borran o cambian algo, no los decorativos: un tooltip
 * que no aparece es una molestia; un botón de borrar que no aparece es una
 * función que no existe.
 */
const ORIGIN = { Origin: 'http://localhost:4322' };

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('cambiar el avatar y el banner es alcanzable', async ({ page }) => {
  await entrar(page);
  await page.goto('/settings');

  // Los dos overlays estaban en `opacity-0 group-hover`, así que en un teléfono
  // no había forma de saber que la imagen era pulsable.
  for (const id of ['#avatar-file-input', '#banner-file-input']) {
    const control = page.locator(id);
    await expect(control, `${id} no existe`).toHaveCount(1);
    // El `<input type=file>` va superpuesto y transparente a propósito; lo que
    // importa es que ocupe sitio y se pueda tocar.
    const caja = await control.boundingBox();
    expect(caja, `${id} no ocupa sitio en la pantalla`).toBeTruthy();
    expect(caja!.width, `${id} mide ${caja!.width}px de ancho`).toBeGreaterThan(30);
  }
});

test('las acciones de una página del árbol se ven', async ({ page }) => {
  await entrar(page);

  const ESPACIO = 'ws-tactil';
  await page.request.post('/api/workspaces', { data: { name: 'Táctil', sys_tag: ESPACIO }, headers: ORIGIN });
  await page.goto(`/w/${ESPACIO}/p`);
  const ws = getTestDb().prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  await page.request.post('/api/pages', {
    data: { title: 'Página con acciones', workspace_id: ws.id }, headers: ORIGIN,
  });

  await page.goto(`/w/${ESPACIO}/p`);
  await page.waitForLoadState('networkidle');

  // El árbol está en el cajón: hay que abrirlo, que es lo esperable.
  const abrir = page.locator('#btn-open-tree');
  if (await abrir.count()) await abrir.tap();

  const acciones = page.locator('#page-tree-aside button[title], #page-tree-aside button[aria-label]');
  const n = await acciones.count();
  expect(n, 'el árbol no tiene ni un botón').toBeGreaterThan(0);

  // Ninguno puede estar a opacidad cero esperando un ratón.
  for (let i = 0; i < Math.min(n, 6); i++) {
    const op = await acciones.nth(i).evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(op), `un botón del árbol está a opacidad ${op}`).toBeGreaterThan(0.05);
  }
});

test('borrar una fila de una base dinámica es posible', async ({ page }) => {
  await entrar(page);

  const ESPACIO = 'ws-tactil-db';
  await page.request.post('/api/workspaces', { data: { name: 'Táctil DB', sys_tag: ESPACIO }, headers: ORIGIN });
  const base = await page.request.post(`/api/w/${ESPACIO}/db`, {
    data: { name: 'Datos', columns: [{ name: 'Texto', type: 'text' }] }, headers: ORIGIN,
  });
  const baseId = (await base.json()).id;

  const listado = await page.request.get(`/api/w/${ESPACIO}/db`);
  const suya = (await listado.json()).find((d: any) => d.id === baseId);
  const colId = JSON.parse(suya.schemaJson ?? suya.schema_json).columns[0].id;
  await page.request.post(`/api/w/${ESPACIO}/db/${baseId}/entries`, {
    data: { [colId]: 'Una fila' }, headers: ORIGIN,
  });

  await page.goto(`/w/${ESPACIO}/db/${baseId}`);
  await page.waitForLoadState('networkidle');

  const borrar = page.locator('.btn-delete-row').first();
  await expect(borrar).toHaveCount(1);
  const op = await borrar.evaluate((el) => getComputedStyle(el).opacity);
  expect(
    Number(op),
    `el botón de borrar fila está a opacidad ${op}: en táctil no hay hover que lo revele`
  ).toBeGreaterThan(0.05);
});
