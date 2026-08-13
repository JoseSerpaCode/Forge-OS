import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Borrado permanente de la cuenta, de punta a punta.
 *
 * La lógica está cubierta a fondo en `tests/account-deletion.test.ts`, contra
 * el esquema real. Aquí se comprueba lo que aquella no puede ver: que el
 * endpoint exige las dos confirmaciones, que la sesión se cierra de verdad y
 * que la pantalla enseña las consecuencias con cifras antes de preguntar.
 *
 * En serie y con usuario propio: la prueba destruye su propia cuenta, así que
 * no puede compartirla con nadie.
 */
test.describe.configure({ mode: 'serial' });

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'del_user');
  await page.fill('input[name="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('la pantalla avisa de las consecuencias con cifras reales', async ({ page }) => {
  await entrar(page);

  const db = getTestDb();
  const ws = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, 'test-user-del', 'editor')").run(ws.id);
  db.prepare(`INSERT INTO issues (id, workspace_id, title, type, reporter_id, status)
              VALUES ('i-del-1', ?, 'Ticket del que se va', 'task', 'test-user-del', 'todo')`).run(ws.id);
  db.close();

  await page.goto('/settings');
  await page.click('#btn-open-delete');

  const caja = page.locator('#delete-consequences');
  // Un texto genérico de «no se puede deshacer» no ayuda a decidir; el número sí.
  await expect(caja).toContainText('1');
  await expect(page.locator('#delete-confirm-username')).toBeVisible();
});

test('no borra sin el nombre y la contraseña correctos', async ({ page }) => {
  await entrar(page);
  const origin = new URL(page.url()).origin;

  const intentar = (data: any) =>
    page.request.fetch('/api/user/account', { method: 'DELETE', data, headers: { Origin: origin } });

  expect((await intentar({ confirm_username: 'otro', password: PW })).status()).toBe(400);
  expect((await intentar({ confirm_username: 'del_user', password: 'mal' })).status()).toBe(401);
  expect((await intentar({ confirm_username: 'del_user' })).status()).toBe(401);

  const db = getTestDb();
  const vivo = db.prepare("SELECT 1 FROM users WHERE id = 'test-user-del'").get();
  db.close();
  expect(vivo, 'un rechazo no debe borrar nada').toBeTruthy();
});

test('borra la cuenta, cierra la sesión y deja el trabajo compartido al equipo', async ({ page }) => {
  await entrar(page);
  const origin = new URL(page.url()).origin;

  const res = await page.request.fetch('/api/user/account', {
    method: 'DELETE',
    data: { confirm_username: 'del_user', password: PW },
    headers: { Origin: origin },
  });
  expect(res.status(), await res.text()).toBe(200);

  const db = getTestDb();
  expect(db.prepare("SELECT 1 FROM users WHERE id = 'test-user-del'").get()).toBeFalsy();
  expect(db.prepare("SELECT 1 FROM sessions WHERE user_id = 'test-user-del'").get()).toBeFalsy();

  // El ticket del espacio compartido sigue ahí, con lápida.
  const issue = db.prepare("SELECT * FROM issues WHERE id = 'i-del-1'").get() as any;
  db.close();
  expect(issue?.reporter_id).toBe('deleted-user');

  // Y la sesión ya no vale: lo privado redirige a la portada.
  await page.goto('/settings');
  expect(page.url()).not.toContain('/settings');
});
