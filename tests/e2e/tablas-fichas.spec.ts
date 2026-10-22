import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Tablas en fichas: cada tabla enseña sus columnas y sus primeras filas de
 * verdad, y la lista de siempre sigue a un clic (y se recuerda).
 */
const unico = () => Math.random().toString(36).slice(2, 7);

async function entrarConTabla(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const tag = `ws-fichas-${unico()}`;
  const wsId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(wsId, 'Fichas', tag, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO dynamic_databases (id, workspace_id, name, sys_tag, schema_json) VALUES (?,?,?,?,?)').run(
    id, wsId, 'Verbos', tag,
    JSON.stringify({ columns: [{ id: 'a', name: 'Infinitivo', type: 'text' }, { id: 'b', name: 'Pasado', type: 'text' }] })
  );
  // Las tres primeras filas se ven; la cuarta no cabe en la muestra.
  for (const [a, b] of [['be', 'was'], ['go', 'went'], ['take', 'took'], ['see', 'saw']]) {
    db.prepare('INSERT INTO dynamic_entries (id, database_id, payload_json) VALUES (?,?,?)').run(crypto.randomUUID(), id, JSON.stringify({ a, b }));
  }
  return tag;
}

test('la ficha enseña las columnas y las primeras filas, y la lista se recuerda', async ({ page }) => {
  const tag = await entrarConTabla(page);
  await page.goto(`/w/${tag}/db`);

  const fichas = page.locator('#tablas-fichas');
  await expect(fichas).toBeVisible();
  const ficha = fichas.locator('.ficha-tabla', { hasText: 'Verbos' });
  await expect(ficha).toContainText('Infinitivo');
  await expect(ficha).toContainText('went');
  await expect(ficha.locator('.ficha-hoja .ficha-fila:not(.ficha-cabecera)')).toHaveCount(3);

  // La ficha entera se abre por el enlace del nombre.
  await expect(ficha.getByRole('link', { name: 'Verbos' })).toHaveAttribute('href', /\/db\//);

  await page.getByRole('button', { name: /^(Lista|List)$/ }).click();
  await expect(page.locator('#tablas-lista')).toBeVisible();
  await expect(fichas).toBeHidden();

  await page.reload();
  await expect(page.locator('#tablas-lista')).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Lista|List)$/ })).toHaveAttribute('aria-pressed', 'true');
});
