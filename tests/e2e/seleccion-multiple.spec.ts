import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Elegir varias tarjetas y moverlas, etiquetarlas o borrarlas de una vez.
 * Antes solo se podía tarea a tarea, desde el panel de cada una.
 */
const unico = () => Math.random().toString(36).slice(2, 7);

async function conTablero(page: any, n = 3) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const tag = `ws-seleccion-${unico()}`;
  const wsId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(wsId, 'Selección', tag, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  const etiqueta = crypto.randomUUID();
  db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES (?,?,'Física','#0091FF')").run(etiqueta, wsId);
  const ids = Array.from({ length: n }, (_, i) => {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position) VALUES (?,?,'task',?,'todo',?,?)`)
      .run(id, wsId, `Tarea ${i + 1}`, yo.id, (i + 1) * 100000);
    return id;
  });
  await page.goto(`/w/${tag}/board`);
  await expect(page.locator('body')).toHaveAttribute('data-tablero-listo', 'true');
  return { db, wsId, ids, etiqueta };
}

const tarjeta = (page: any, id: string) => page.locator(`.issue-card[data-issue-id="${id}"]`);
const estados = (db: any, ids: string[]) => ids.map((id) => (db.prepare('SELECT status FROM issues WHERE id = ?').get(id) as any)?.status ?? null);

test('elegir con clic y Mayús+clic, y moverlas de estado de una vez', async ({ page }) => {
  const { db, ids } = await conTablero(page);
  await page.locator('#btn-seleccionar').click();
  await expect(page.locator('#barra-seleccion')).toBeVisible();

  // Pulsar elige, no abre el panel.
  await tarjeta(page, ids[0]).click();
  await expect(tarjeta(page, ids[0])).toHaveClass(/elegida/);
  await expect(page.locator('#issue-details-modal')).toHaveClass(/translate-x-full/);
  await tarjeta(page, ids[2]).click({ modifiers: ['Shift'] });
  await expect(page.locator('.issue-card.elegida')).toHaveCount(3);

  await page.locator('#sel-mover').click();
  await page.locator('.sel-estado[data-estado="in_progress"]').click();
  await expect.poll(() => estados(db, ids)).toEqual(['in_progress', 'in_progress', 'in_progress']);
  await page.waitForLoadState('load');
  await expect(page.locator('#barra-seleccion')).toBeHidden();
});

test('poner una etiqueta y borrar varias, con confirmación', async ({ page }) => {
  const { db, ids, etiqueta } = await conTablero(page);
  await page.locator('#btn-seleccionar').click();
  await tarjeta(page, ids[0]).click();
  await tarjeta(page, ids[1]).click();

  await page.locator('#sel-etiqueta').click();
  await page.locator(`.sel-etiqueta[data-id="${etiqueta}"]`).click();
  await expect.poll(() => (db.prepare('SELECT COUNT(*) AS n FROM issue_labels WHERE label_id = ?').get(etiqueta) as any).n).toBe(2);
  await page.waitForLoadState('load');

  await page.locator('#btn-seleccionar').click();
  await tarjeta(page, ids[0]).click();
  await tarjeta(page, ids[1]).click();
  // Escape cancela la confirmación y la selección sigue ahí.
  await page.locator('#sel-borrar').click();
  await expect(page.locator('#forge-confirm-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#forge-confirm-modal')).toBeHidden();
  await expect(page.locator('.issue-card.elegida')).toHaveCount(2);

  await page.locator('#sel-borrar').click();
  await expect(page.locator('#forge-confirm-msg')).toContainText('2');
  await page.locator('#btn-forge-confirm-ok').click();
  await expect.poll(() => estados(db, ids)).toEqual([null, null, 'todo']);
});

test('Escape sale de la selección sin tocar nada', async ({ page }) => {
  const { db, ids } = await conTablero(page, 2);
  await page.locator('#btn-seleccionar').click();
  await tarjeta(page, ids[0]).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#barra-seleccion')).toBeHidden();
  await expect(page.locator('.issue-card.elegida')).toHaveCount(0);
  // Y pulsar vuelve a abrir la tarea.
  await tarjeta(page, ids[0]).locator('h4').click();
  await expect(page.locator('#issue-details-modal')).not.toHaveClass(/translate-x-full/);
  expect(estados(db, ids)).toEqual(['todo', 'todo']);
});
