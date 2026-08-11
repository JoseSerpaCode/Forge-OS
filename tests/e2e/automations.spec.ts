import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Las automatizaciones no habían funcionado nunca.
 *
 * Cuatro fallos independientes, cada uno bastaba por sí solo: el script leía
 * ids que no existían y moría antes del `fetch`; el campo de condición nacía
 * oculto y nada se lo quitaba; los valores del formulario no eran los que
 * consulta el motor; y el evento se emitía en snake_case y se leía en camelCase.
 * Nada de esto lo cubría ninguna prueba.
 */

async function entrarComoDueño(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('se puede crear una regla desde la interfaz', async ({ page }) => {
  await entrarComoDueño(page);
  await page.goto('/w/test-workspace/settings');

  await page.click('#btn-add-automation');
  await page.fill('#auto-name', 'Avisar al terminar');
  await page.selectOption('#auto-trigger-cond', 'done');
  await page.fill('#auto-action-payload', 'https://example.com/hook');
  await page.click('#btn-save-automation');
  await page.waitForTimeout(1200);

  const db = getTestDb();
  const rule = db
    .prepare("SELECT * FROM automations WHERE name = 'Avisar al terminar'")
    .get() as any;
  db.close();

  expect(rule, 'la regla no llegó a guardarse').toBeTruthy();

  // Los tres valores tienen que ser los que el motor consulta, no otros.
  expect(rule.trigger_type).toBe('issue_status_changed');
  expect(rule.action_type).toBe('webhook');
  expect(JSON.parse(rule.trigger_condition)).toEqual({ to_status: 'done' });
  expect(JSON.parse(rule.action_payload)).toEqual({ url: 'https://example.com/hook' });
});

test('el formulario no ofrece opciones que no existen', async ({ page }) => {
  // Ofrecía cuatro disparadores y tres acciones; solo una combinación tenía
  // motor detrás. Un desplegable que promete lo que no hace es una mentira.
  await entrarComoDueño(page);
  await page.goto('/w/test-workspace/settings');
  await page.click('#btn-add-automation');

  await expect(page.locator('#auto-trigger')).toHaveCount(0);
  await expect(page.locator('#auto-action')).toHaveCount(0);

  // El campo de condición está visible: antes nacía `hidden` para siempre.
  await expect(page.locator('#auto-trigger-cond')).toBeVisible();
});

test('mover un issue al estado de la regla dispara el webhook', async ({ page }) => {
  await entrarComoDueño(page);
  const origin = new URL(page.url()).origin;

  const db = getTestDb();
  db.prepare("DELETE FROM automations WHERE workspace_id = 'ws-jose-test'").run();
  db.prepare(`
    INSERT INTO automations (id, workspace_id, name, trigger_type, trigger_condition, action_type, action_payload, is_active)
    VALUES ('auto-test-1', 'ws-jose-test', 'e2e', 'issue_status_changed', ?, 'webhook', ?, 1)
  `).run(JSON.stringify({ to_status: 'done' }), JSON.stringify({ url: 'https://127.0.0.1/hook' }));

  const issueId = 'auto-issue-1';
  db.prepare('DELETE FROM issues WHERE id = ?').run(issueId);
  db.prepare(`
    INSERT INTO issues (id, workspace_id, title, status, type, reporter_id, position)
    VALUES (?, 'ws-jose-test', 'Para automatizar', 'todo', 'task', 'test-user-jose', 1)
  `).run(issueId);
  db.close();

  const res = await page.request.patch(`/api/issues/${issueId}/move`, {
    data: { status: 'done', position: 1 },
    headers: { Origin: origin },
  });
  expect(res.ok(), await res.text()).toBeTruthy();

  await page.waitForTimeout(800);

  const db2 = getTestDb();
  const moved = db2.prepare('SELECT status FROM issues WHERE id = ?').get(issueId) as any;
  const fired = db2
    .prepare("SELECT details_json FROM audit_logs WHERE action = 'AUTOMATION_FIRED' AND entity_id = 'auto-test-1'")
    .get() as any;
  db2.close();

  expect(moved.status).toBe('done');

  // Lo que de verdad se comprueba: que la regla **se evaluó**. Antes el evento
  // se emitía en snake_case y el oyente leía camelCase, así que `workspaceId`
  // llegaba como undefined, better-sqlite3 rechazaba el binding y la regla ni
  // se consultaba. El issue se movía igual, sin dejar rastro de nada.
  expect(fired, 'la regla no llegó a dispararse').toBeTruthy();
  expect(JSON.parse(fired.details_json)).toMatchObject({ issueId, newStatus: 'done' });

  // La URL apunta a loopback a propósito: el guard SSRF debe rechazar la
  // llamada. Que la regla se dispare y la petición se bloquee son dos cosas
  // distintas, y las dos tienen que pasar.
});
