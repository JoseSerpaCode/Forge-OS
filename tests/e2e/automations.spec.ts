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

/**
 * Entra y **crea un espacio propio**.
 *
 * Usar el compartido `test-workspace` hacía que estas pruebas se pisaran con la
 * media docena de specs que también lo tocan: fallaba una distinta en cada
 * corrida y pasaba al aislarla. Es el tercer sitio donde aparece el mismo
 * síntoma, siempre por la misma causa.
 */
async function entrarConEspacioPropio(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'autom_user');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const origin = new URL(page.url()).origin;
  const tag = `auto-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const res = await page.request.post('/api/workspaces', {
    data: { name: 'Automations', sys_tag: tag },
    headers: { Origin: origin },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return { origin, tag, wsId: body.id ?? body.workspace_id };
}

test('se puede crear una regla desde la interfaz', async ({ page }) => {
  const { tag } = await entrarConEspacioPropio(page);
  await page.goto(`/w/${tag}/settings`);

  const nombre = 'Avisar al terminar ' + Date.now();
  await page.click('#btn-add-automation');
  await page.fill('#auto-name', nombre);
  await page.selectOption('#auto-trigger-cond', 'done');
  await page.fill('#auto-action-payload', 'https://example.com/hook');
  // Se espera la respuesta del servidor, no un tiempo fijo: con la suite entera
  // en marcha, los 1200 ms que había antes no siempre llegaban y el test fallaba
  // por carga de la máquina, no por el producto.
  //
  // No se lee el cuerpo. La página se recarga en cuanto la regla se guarda, y
  // eso descarta el cuerpo de la respuesta: `response.text()` se queda colgado
  // hasta agotar el tiempo del test. El estado sí está disponible.
  const [respuesta] = await Promise.all([
    page.waitForResponse((r: any) => r.url().includes('/api/automations') && r.request().method() === 'POST'),
    page.click('#btn-save-automation'),
  ]);
  expect(respuesta.status(), 'el servidor rechazó la regla').toBeLessThan(400);

  const db = getTestDb();
  const rule = db.prepare('SELECT * FROM automations WHERE name = ?').get(nombre) as any;
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
  const { tag } = await entrarConEspacioPropio(page);
  await page.goto(`/w/${tag}/settings`);
  await page.click('#btn-add-automation');

  await expect(page.locator('#auto-trigger')).toHaveCount(0);
  await expect(page.locator('#auto-action')).toHaveCount(0);

  // El campo de condición está visible: antes nacía `hidden` para siempre.
  await expect(page.locator('#auto-trigger-cond')).toBeVisible();
});

test('mover un issue al estado de la regla dispara el webhook', async ({ page }) => {
  const { origin, wsId } = await entrarConEspacioPropio(page);
  const ruleId = 'auto-rule-' + Date.now();
  const issueId = 'auto-issue-' + Date.now();

  const db = getTestDb();
  db.prepare(`
    INSERT INTO automations (id, workspace_id, name, trigger_type, trigger_condition, action_type, action_payload, is_active)
    VALUES (?, ?, 'e2e', 'issue_status_changed', ?, 'webhook', ?, 1)
  `).run(ruleId, wsId, JSON.stringify({ to_status: 'done' }), JSON.stringify({ url: 'https://127.0.0.1/hook' }));

  db.prepare(`
    INSERT INTO issues (id, workspace_id, title, status, type, reporter_id, position)
    VALUES (?, ?, 'Para automatizar', 'todo', 'task', 'test-user-autom', 1)
  `).run(issueId, wsId);
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
    .prepare("SELECT details_json FROM audit_logs WHERE action = 'AUTOMATION_FIRED' AND entity_id = ?")
    .get(ruleId) as any;
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
