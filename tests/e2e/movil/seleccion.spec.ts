import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * Elegir varias tarjetas con el dedo. En el teléfono «Seleccionar» se queda en
 * la fila principal —solo el icono— y la barra de acciones va encima de la
 * navegación de abajo, sin salirse de la pantalla.
 */
test('se eligen varias con toques y se mueven de una vez', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const tag = `ws-seleccion-movil-${Math.random().toString(36).slice(2, 7)}`;
  const wsId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(wsId, 'Selección móvil', tag, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  // Con etiquetas la barra lleva un botón más y «Mover a» queda a la
  // izquierda: anclado a él, su menú se salía de la pantalla.
  db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES (?,?,'Física','#0091FF')").run(crypto.randomUUID(), wsId);
  const ids = [1, 2].map((i) => {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position) VALUES (?,?,'task',?,'todo',?,?)`)
      .run(id, wsId, `Con el dedo ${i}`, yo.id, i * 100000);
    return id;
  });
  await page.goto(`/w/${tag}/board`);
  await expect(page.locator('body')).toHaveAttribute('data-tablero-listo', 'true');

  // A la vista sin abrir «Filtros y orden».
  await expect(page.locator('#btn-seleccionar')).toBeVisible();
  await page.locator('#btn-seleccionar').tap();
  for (const id of ids) await page.locator(`.issue-card[data-issue-id="${id}"] h4`).tap();
  await expect(page.locator('.issue-card.elegida')).toHaveCount(2);
  await expect(page.locator('#issue-details-modal')).toHaveClass(/translate-x-full/);

  const barra = page.locator('#barra-seleccion');
  await expect(barra).toBeInViewport({ ratio: 1 });
  const ancho = page.viewportSize()!.width;
  const caja = (await barra.boundingBox())!;
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(ancho);

  await page.locator('#sel-mover').tap();
  await expect(page.locator('#sel-menu-mover')).toBeInViewport({ ratio: 1 });
  await page.locator('.sel-estado[data-estado="review"]').tap();
  await expect.poll(() => ids.map((id) => (db.prepare('SELECT status FROM issues WHERE id = ?').get(id) as any).status))
    .toEqual(['review', 'review']);
});
