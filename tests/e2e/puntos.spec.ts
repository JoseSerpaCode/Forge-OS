import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Los puntos sirven para algo: cada columna los suma, la cabecera dice cuántos
 * van hechos y la velocidad de Métricas se mide en puntos. Antes solo salían en
 * la tarjeta y para ordenar.
 */
test('las columnas y la cabecera suman puntos, y completar los mueve', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const tag = `ws-puntos-${Math.random().toString(36).slice(2, 7)}`;
  const wsId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by, feat_points, feat_sprints) VALUES (?,?,?,?,1,1)').run(wsId, 'Puntos', tag, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  const pendiente = crypto.randomUUID();
  const insertar = db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position, story_points, sprint_id)
                               VALUES (?, ?, 'task', ?, ?, ?, 100000, ?, ?)`);
  insertar.run(pendiente, wsId, 'Pendiente', 'todo', yo.id, 3, null);
  insertar.run(crypto.randomUUID(), wsId, 'Hecha', 'done', yo.id, 5, null);

  await page.goto(`/w/${tag}/board?sprint=backlog`);
  await expect(page.locator('body')).toHaveAttribute('data-tablero-listo', 'true');
  await expect(page.locator('.board-column[data-status="todo"] .columna-pts')).toContainText('3');
  await expect(page.locator('.board-column[data-status="done"] .columna-pts')).toContainText('5');
  await expect(page.locator('#puntos-vista')).toHaveText(/^5\D+8\D/);

  // Completar la pendiente: la columna y la cabecera siguen sin recargar.
  await page.locator(`.issue-card[data-issue-id="${pendiente}"] .btn-completar`).click();
  await expect(page.locator('.board-column[data-status="done"] .columna-pts')).toContainText('8');
  await expect(page.locator('#puntos-vista')).toHaveText(/^8\D+8\D/);

  // Velocidad: un sprint cerrado con 5 puntos hechos.
  const sprint = crypto.randomUUID();
  db.prepare("INSERT INTO sprints (id, workspace_id, name, status, start_date) VALUES (?,?,'Cerrado','completed','2026-10-01')").run(sprint, wsId);
  insertar.run(crypto.randomUUID(), wsId, 'En el sprint', 'done', yo.id, 5, sprint);
  const velocidad = await (await page.request.get(`/api/w/${tag}/metrics/velocity`)).json();
  expect(velocidad).toEqual([{ sprint_name: 'Cerrado', velocity: 1, points: 5 }]);
});
