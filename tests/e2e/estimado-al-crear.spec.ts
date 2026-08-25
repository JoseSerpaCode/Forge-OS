import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Las horas estimadas se pueden poner al crear el ticket.
 *
 * El hueco estaba en las dos capas: el formulario no tenía el campo, y
 * `IssueService.create()` ni siquiera incluía la columna en su `INSERT`,
 * mientras `update()` sí la tenía entre sus `allowedFields`. La única forma de
 * estimar era crear el ticket y volver a abrirlo.
 *
 * `due_date`, un campo idéntico en dificultad, sí estaba — fue un olvido.
 */
const ESPACIO = 'ws-estimado';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

function conEspacio() {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(crypto.randomUUID(), 'Estimado', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);
  return ws.id;
}

test('el formulario guarda las horas estimadas', async ({ page }) => {
  await entrar(page);
  const wsId = conEspacio();
  const db = getTestDb();
  db.prepare("DELETE FROM issues WHERE title = 'Con estimación'").run();

  await page.goto(`/w/${ESPACIO}/board`);
  await page.locator('#btn-new-issue').click();

  await page.fill('#new-issue-title', 'Con estimación');
  await page.fill('#new-issue-estimated', '3.5');
  await page.locator('#btn-save-issue').click();

  await expect
    .poll(() => {
      const fila = db
        .prepare("SELECT estimated_hours FROM issues WHERE workspace_id = ? AND title = 'Con estimación'")
        .get(wsId) as any;
      return fila?.estimated_hours ?? null;
    }, { message: 'las horas no llegaron a la base' })
    .toBe(3.5);
});

test('sin estimación se guarda cero, no basura', async ({ page }) => {
  await entrar(page);
  const wsId = conEspacio();
  const db = getTestDb();
  db.prepare("DELETE FROM issues WHERE title = 'Sin estimación'").run();

  // El número llega de fuera, así que un texto no puede entrar en la columna.
  const res = await page.request.post(`/api/w/${ESPACIO}/issues`, {
    data: { title: 'Sin estimación', type: 'task', estimated_hours: 'muchas' },
    headers: { Origin: 'http://localhost:4322' },
  });
  expect([200, 201]).toContain(res.status());

  const fila = db
    .prepare("SELECT estimated_hours FROM issues WHERE workspace_id = ? AND title = 'Sin estimación'")
    .get(wsId) as any;
  expect(fila.estimated_hours).toBe(0);
});
