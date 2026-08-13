import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Notificaciones.
 *
 * No llegaba **ninguna**, nunca. La causa no era un fallo del servicio —que
 * estaba bien— sino que casi nadie lo llamaba: en todo el producto había un
 * único punto que creaba una notificación, asignar un ticket a otra persona
 * **al editarlo**. Crear el ticket ya asignado, que es el camino normal porque
 * el formulario de nuevo ticket tiene el campo, no avisaba a nadie. Y para
 * quien trabaja solo no había ningún camino: el aviso se salta cuando te
 * asignas a ti mismo.
 *
 * Mientras tanto Ajustes ofrecía silenciar menciones y sprints, dos cosas que
 * no existían. Los sprints ya avisan; las menciones se retiraron de la pantalla
 * hasta que haya comentarios que mencionar.
 */

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const ORIGIN = { Origin: 'http://localhost:4322' };

async function entrar(page: any, usuario: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', usuario);
  await page.fill('input[name="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('crear un ticket ya asignado avisa a quien lo recibe', async ({ page }) => {
  const db = getTestDb();
  const ws = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, 'aud-viewer', 'editor')").run(ws.id);
  db.prepare("DELETE FROM notifications WHERE user_id = 'aud-viewer'").run();
  db.close();

  await entrar(page, 'jose');
  const titulo = 'Revisar el informe ' + Date.now();
  const res = await page.request.post('/api/w/test-workspace/issues', {
    data: { title: titulo, type: 'task', assignee_id: 'aud-viewer' },
    headers: ORIGIN,
  });
  expect(res.ok(), await res.text()).toBeTruthy();

  const db2 = getTestDb();
  // Se busca **esta** notificación por su título, no «la primera de tipo
  // assign»: al repetir la prueba se acumulan varias para la misma persona y
  // la consulta devolvía una de una corrida anterior.
  const n = db2.prepare(
    "SELECT * FROM notifications WHERE user_id = 'aud-viewer' AND type = 'assign' AND message LIKE ?"
  ).get(`%${titulo}%`) as any;
  db2.close();

  expect(n, 'no llegó ninguna notificación al asignar en la creación').toBeTruthy();
  // El título, no un trozo del identificador: el mensaje tiene que decir qué
  // hay que hacer sin abrir el enlace.
  expect(n.message).toContain(titulo);
  expect(n.link_url).toContain('/w/test-workspace/board');
});

test('no me aviso a mí mismo al asignarme un ticket', async ({ page }) => {
  const db = getTestDb();
  db.prepare("DELETE FROM notifications WHERE user_id = 'test-user-jose' AND type = 'assign'").run();
  db.close();

  await entrar(page, 'jose');
  await page.request.post('/api/w/test-workspace/issues', {
    data: { title: 'Mío ' + Date.now(), type: 'task', assignee_id: 'test-user-jose' },
    headers: ORIGIN,
  });

  const db2 = getTestDb();
  const n = db2.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'test-user-jose' AND type = 'assign'").get() as any;
  db2.close();
  expect(n.n, 'avisarte de tu propia acción es ruido').toBe(0);
});

test('arrancar un sprint avisa al resto del equipo, no a quien lo arranca', async ({ page }) => {
  const db = getTestDb();
  const ws = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, 'aud-viewer', 'editor')").run(ws.id);
  const sprintId = 'sp-notif-' + Date.now();
  db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES (?, ?, 'Sprint de prueba', 'planned')").run(sprintId, ws.id);
  db.prepare("DELETE FROM notifications WHERE type = 'sprint'").run();
  db.close();

  await entrar(page, 'jose');
  const res = await page.request.patch(`/api/sprints/${sprintId}`, {
    data: { status: 'active' },
    headers: ORIGIN,
  });
  expect(res.ok(), await res.text()).toBeTruthy();

  const db2 = getTestDb();
  const paraOtro = db2.prepare("SELECT * FROM notifications WHERE user_id = 'aud-viewer' AND type = 'sprint'").get() as any;
  const paraMi = db2.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'test-user-jose' AND type = 'sprint'").get() as any;
  db2.prepare('DELETE FROM sprints WHERE id = ?').run(sprintId);
  db2.close();

  expect(paraOtro, 'el equipo debería enterarse de que arranca un sprint').toBeTruthy();
  expect(paraOtro.message).toContain('Sprint de prueba');
  expect(paraMi.n, 'quien pulsa el botón ya sabe lo que ha hecho').toBe(0);
});

test('silenciar una categoría la calla de verdad', async ({ page }) => {
  // Cuenta propia: este caso **apaga** una categoría, y hacerlo sobre la misma
  // persona que usa el caso de «sí llega» lo dejaba sin aviso cuando los dos
  // coincidían en paralelo.
  const db = getTestDb();
  const ws = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, 'test-user-mute', 'editor')").run(ws.id);
  db.prepare("UPDATE users SET notif_mute_assign = 1 WHERE id = 'test-user-mute'").run();
  db.prepare("DELETE FROM notifications WHERE user_id = 'test-user-mute'").run();
  db.close();

  await entrar(page, 'jose');
  await page.request.post('/api/w/test-workspace/issues', {
    data: { title: 'Silenciado ' + Date.now(), type: 'task', assignee_id: 'test-user-mute' },
    headers: ORIGIN,
  });

  const db2 = getTestDb();
  const n = db2.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'test-user-mute' AND type = 'assign'").get() as any;
  db2.close();
  expect(n.n).toBe(0);
});
