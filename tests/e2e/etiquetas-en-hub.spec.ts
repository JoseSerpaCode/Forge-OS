import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Las etiquetas de una tarea también se ven en el hub.
 *
 * La misma tarea las enseñaba en el tablero y ninguna en «Mis Tareas», que es
 * justo donde se mira para decidir qué tocar. Faltaban las dos mitades: la
 * consulta no las traía y la tabla no tenía dónde ponerlas.
 */
const ESPACIO = 'ws-etiquetas-hub';

test('una tarea asignada enseña sus etiquetas en Mis Tareas', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(crypto.randomUUID(), 'Etiquetas hub', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);

  db.prepare("DELETE FROM issues WHERE title = 'Tarea con etiqueta'").run();
  const issueId = crypto.randomUUID();
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, assignee_id, position)
              VALUES (?, ?, 'task', 'Tarea con etiqueta', 'todo', ?, ?, 100000)`)
    .run(issueId, ws.id, yo.id, yo.id);

  db.prepare("DELETE FROM labels WHERE workspace_id = ? AND name = 'Parcial 2'").run(ws.id);
  const labelId = crypto.randomUUID();
  db.prepare('INSERT INTO labels (id, workspace_id, name, color) VALUES (?,?,?,?)')
    .run(labelId, ws.id, 'Parcial 2', '#FF5D00');
  db.prepare("INSERT OR IGNORE INTO issue_labels (label_id, issue_id) VALUES (?,?)").run(labelId, issueId);

  await page.goto('/');

  const fila = page.locator('.task-row', { hasText: 'Tarea con etiqueta' }).first();
  await expect(fila).toBeVisible();
  await expect(fila, 'la etiqueta no llega al hub').toContainText('Parcial 2');
});
