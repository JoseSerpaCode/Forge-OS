import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Volver al tablero abre lo mismo que se estaba viendo.
 *
 * Al cargar, el navegador apuntaba en la cookie el `?sprint=` de la dirección
 * y, sin él, «backlog». La primera visita enseñaba el sprint activo (lo elige
 * el servidor) y guardaba «backlog»: todas las siguientes abrían un backlog
 * vacío, con las tareas del sprint escondidas.
 */
test('la segunda visita al tablero sigue en el sprint activo', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const tag = `ws-sprint-recordado-${Date.now()}`;
  const wsId = crypto.randomUUID();
  const sprintId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by, feat_sprints) VALUES (?,?,?,?,1)').run(wsId, 'Sprint recordado', tag, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES (?,?,'Sprint vivo','active')").run(sprintId, wsId);
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position, sprint_id)
              VALUES (?, ?, 'task', 'Dentro del sprint', 'todo', ?, 100000, ?)`).run(crypto.randomUUID(), wsId, yo.id, sprintId);

  for (const visita of ['primera', 'segunda']) {
    await page.goto(`/w/${tag}/board`);
    await expect(page.locator('#sprint-selector'), visita).toHaveValue(sprintId);
    await expect(page.locator('.issue-card', { hasText: 'Dentro del sprint' }).first(), visita).toBeVisible();
  }
});
