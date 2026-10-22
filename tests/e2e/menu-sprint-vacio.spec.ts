import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * «Mover a otro sprint» solo sale si hay otro sprint al que ir.
 *
 * Con la tarea en el backlog y ningún sprint abierto, el único destino era el
 * propio backlog, que se esconde por ser donde ya está: los tres puntos abrían
 * un menú vacío.
 */
test('sin otro sprint al que ir no hay botón; con uno abierto, sí', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const tag = `ws-sprint-vacio-${Math.random().toString(36).slice(2, 7)}`;
  const wsId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by, feat_sprints) VALUES (?,?,?,?,1)').run(wsId, 'Sprints', tag, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES (?,?,'Viejo','completed')").run(crypto.randomUUID(), wsId);
  const tarea = crypto.randomUUID();
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position) VALUES (?,?,'task','En el backlog','todo',?,100000)`).run(tarea, wsId, yo.id);

  await page.goto(`/w/${tag}/board?sprint=backlog`);
  const tarjeta = page.locator(`.issue-card[data-issue-id="${tarea}"]`);
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.locator('.btn-mover-sprint')).toHaveCount(0);

  db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES (?,?,'Sprint 1','planned')").run(crypto.randomUUID(), wsId);
  await page.reload();
  await tarjeta.hover();
  await tarjeta.locator('.btn-mover-sprint').click();
  await expect(page.locator('#menu-sprint-tarjeta .sprint-destino:visible')).toHaveText(['Sprint 1']);
});
