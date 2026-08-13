import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Cierre de sprint y reordenado del backlog.
 *
 * Dos reglas que antes no existían:
 *
 *  - Cerrar un sprint con trabajo sin terminar era silencioso: el sprint pasaba
 *    a completado y los tickets se quedaban dentro, invisibles para el
 *    siguiente. Ahora hay que decir qué se hace con ellos.
 *  - La posición en el backlog la calculaba el cliente. Eso es dejarle escribir
 *    en la columna que gobierna el orden.
 */
test.describe.configure({ mode: 'serial' });

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const ORIGIN = { Origin: 'http://localhost:4322' };

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

function montarSprint(sufijo: string) {
  const db = getTestDb();
  const ws = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  const sid = 'sp-plan-' + sufijo;
  const destino = 'sp-dest-' + sufijo;
  db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES (?, ?, 'Cierre', 'planned')").run(sid, ws.id);
  db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES (?, ?, 'Siguiente', 'planned')").run(destino, ws.id);
  for (const [n, estado] of [['a', 'todo'], ['b', 'done']] as const) {
    db.prepare(
      "INSERT INTO issues (id, workspace_id, sprint_id, title, type, status, reporter_id) VALUES (?, ?, ?, ?, 'task', ?, 'test-user-jose')"
    ).run(`i-${sufijo}-${n}`, ws.id, sid, `Ticket ${n}`, estado);
  }
  db.close();
  return { sid, destino };
}

test('cerrar con trabajo pendiente exige decir qué hacer con él', async ({ page }) => {
  const { sid } = montarSprint('a');
  await entrar(page);

  const res = await page.request.patch(`/api/sprints/${sid}`, { data: { status: 'completed' }, headers: ORIGIN });
  expect(res.status(), 'cerrar en silencio deja el trabajo escondido').toBe(409);
  const cuerpo = await res.json();
  expect(cuerpo.error_code).toBe('unfinished_issues');
  // La cuenta va en la respuesta para que la pantalla pueda preguntar con el
  // número delante, no con un «hay tickets sin terminar» a secas.
  expect(cuerpo.pending).toBe(1);

  const db = getTestDb();
  const s = db.prepare('SELECT status FROM sprints WHERE id = ?').get(sid) as any;
  db.close();
  expect(s.status, 'un 409 no debe haber cerrado nada').toBe('planned');
});

test('devolver al backlog saca los pendientes del sprint', async ({ page }) => {
  const { sid } = montarSprint('b');
  await entrar(page);

  const res = await page.request.patch(`/api/sprints/${sid}`, {
    data: { status: 'completed', strategy: 'backlog' }, headers: ORIGIN,
  });
  expect(res.status(), await res.text()).toBe(200);

  const db = getTestDb();
  const pendiente = db.prepare("SELECT sprint_id FROM issues WHERE id = 'i-b-a'").get() as any;
  const terminado = db.prepare("SELECT sprint_id FROM issues WHERE id = 'i-b-b'").get() as any;
  const s = db.prepare('SELECT status, completed_at FROM sprints WHERE id = ?').get(sid) as any;
  db.close();

  expect(pendiente.sprint_id).toBeNull();
  // Lo terminado se queda: es la historia de ese sprint.
  expect(terminado.sprint_id).toBe(sid);
  expect(s.status).toBe('completed');
  expect(s.completed_at, 'cerrar debe dejar fecha').toBeTruthy();
});

test('mover al siguiente sprint, y solo a uno del mismo espacio', async ({ page }) => {
  const { sid, destino } = montarSprint('c');
  await entrar(page);

  // Un destino de otro espacio no vale, aunque exista.
  const dbPrev = getTestDb();
  const otroWs = dbPrev.prepare("SELECT id FROM workspaces WHERE sys_tag != 'test-workspace' LIMIT 1").get() as any;
  dbPrev.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('sp-ajeno', ?, 'Ajeno', 'planned')").run(otroWs.id);
  dbPrev.close();

  const malo = await page.request.patch(`/api/sprints/${sid}`, {
    data: { status: 'completed', strategy: 'next', target_sprint_id: 'sp-ajeno' }, headers: ORIGIN,
  });
  expect(malo.status(), 'no se puede empujar trabajo al sprint de otro equipo').toBe(400);

  const bueno = await page.request.patch(`/api/sprints/${sid}`, {
    data: { status: 'completed', strategy: 'next', target_sprint_id: destino }, headers: ORIGIN,
  });
  expect(bueno.status(), await bueno.text()).toBe(200);

  const db = getTestDb();
  const movido = db.prepare("SELECT sprint_id FROM issues WHERE id = 'i-c-a'").get() as any;
  db.prepare("DELETE FROM sprints WHERE id = 'sp-ajeno'").run();
  db.close();
  expect(movido.sprint_id).toBe(destino);
});

test('la posición del backlog la decide el servidor', async ({ page }) => {
  const db = getTestDb();
  const ws = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  for (const [n, pos] of [['x', 100000], ['y', 200000], ['z', 300000]] as const) {
    db.prepare(
      "INSERT INTO issues (id, workspace_id, sprint_id, title, type, status, reporter_id, position) VALUES (?, ?, NULL, ?, 'task', 'todo', 'test-user-jose', ?)"
    ).run(`i-rank-${n}`, ws.id, `Rank ${n}`, pos);
  }
  db.close();

  await entrar(page);
  // Se mueve «z» entre «x» e «y». El cliente no manda ningún número.
  const res = await page.request.patch('/api/issues/i-rank-z/rank', {
    data: { before_id: 'i-rank-x', after_id: 'i-rank-y' }, headers: ORIGIN,
  });
  expect(res.status(), await res.text()).toBe(200);
  const { position } = await res.json();
  expect(position).toBeGreaterThan(100000);
  expect(position).toBeLessThan(200000);

  const db2 = getTestDb();
  const orden = db2.prepare(
    "SELECT id FROM issues WHERE id LIKE 'i-rank-%' ORDER BY position ASC"
  ).all() as Array<{ id: string }>;
  db2.prepare("DELETE FROM issues WHERE id LIKE 'i-rank-%'").run();
  db2.close();
  expect(orden.map((o) => o.id)).toEqual(['i-rank-x', 'i-rank-z', 'i-rank-y']);
});
