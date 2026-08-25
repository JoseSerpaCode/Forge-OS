import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Renombrar un tipo de fábrica se ve en toda la aplicación.
 *
 * Antes solo se veía en el diálogo de renombrar, que lee el nombre de un
 * `data-name`. Los cinco sitios que lo pintan usaban la traducción de la clave
 * e ignoraban el nombre escrito, así que el tablero, la tabla del hub y los
 * desplegables seguían diciendo «Task» para siempre.
 *
 * Se comprueba en las pantallas, no en la función: la unidad ya está cubierta
 * en `tests/nombre-visible-tipo.test.ts`, y lo que falló aquí fue que cinco
 * copias no llamaran a nadie.
 */
const ESPACIO = 'ws-renombrar-tipo';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('el nombre nuevo de un tipo de fábrica llega al tablero y al modal', async ({ page }) => {
  await entrar(page);

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(crypto.randomUUID(), 'Renombrar', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);

  // Los cuatro de fábrica se siembran al primer listado; se fuerza aquí.
  await page.goto(`/w/${ESPACIO}/board`);

  // Y se renombra «Task» directamente, que es el caso del reporte.
  db.prepare("UPDATE issue_types SET name = 'Incidencia' WHERE workspace_id = ? AND key = 'task'")
    .run(ws.id);

  db.prepare('DELETE FROM issues WHERE workspace_id = ?').run(ws.id);
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position)
              VALUES (?, ?, 'task', 'Ticket de prueba', 'todo', ?, 100000)`)
    .run(crypto.randomUUID(), ws.id, yo.id);

  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);

  // 1. La insignia de la tarjeta.
  const tarjeta = page.locator('.issue-card', { hasText: 'Ticket de prueba' }).first();
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.locator('.issue-type-badge')).toContainText('Incidencia');

  // 2. El desplegable del modal de crear.
  await expect(page.locator('#new-issue-type option').first()).toHaveText('Incidencia');

  // Y lo que no puede romperse: los que nadie tocó siguen traduciéndose.
  await expect(page.locator('#new-issue-type')).toContainText('Bug');
});
