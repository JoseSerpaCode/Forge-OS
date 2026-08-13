import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Las invitaciones pendientes de los ajustes de un espacio.
 *
 * La consulta leía **todas las invitaciones de la instancia** y se quedaba con
 * las del espacio parseando el JSON de cada fila en JavaScript. Dos problemas
 * distintos, y el segundo es el grave:
 *
 *  1. El coste de abrir los ajustes crecía con el uso global del producto.
 *  2. Al filtrar en SQL con `json_extract`, una sola fila con `link_url` que no
 *     sea JSON aborta la consulta entera —«malformed JSON»— y la página pasa a
 *     dar 500. `link_url` es texto libre y otras partes del código guardan ahí
 *     rutas normales, así que esa fila puede existir perfectamente.
 *
 * De ahí la guarda `json_valid` antes del `json_extract`. Este test la fija:
 * sin ella, el segundo caso deja el espacio inaccesible.
 */

async function entrarYCrearEspacio(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'invit_user');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const origin = new URL(page.url()).origin;
  const tag = `inv-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const res = await page.request.post('/api/workspaces', {
    data: { name: 'Invitaciones', sys_tag: tag },
    headers: { Origin: origin },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return { tag, wsId: body.id ?? body.workspace_id };
}

test('los ajustes del espacio sobreviven a una invitación con link_url que no es JSON', async ({ page }) => {
  const { tag, wsId } = await entrarYCrearEspacio(page);

  const db = getTestDb();
  // La fila envenenada: tipo 'invite', pero `link_url` es una ruta, no JSON.
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, link_url)
    VALUES (?, 'test-user-invit', 'x', 'x', 'invite', ?)
  `).run(`inv-basura-${Date.now()}`, '/w/otro/algo');
  // Y una invitación legítima de **otro** espacio, que no debe aparecer aquí.
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, link_url)
    VALUES (?, 'test-user-invit', 'x', 'x', 'invite', ?)
  `).run(`inv-ajena-${Date.now()}`, JSON.stringify({ ws_id: 'espacio-ajeno', role: 'admin' }));
  db.close();

  const res = await page.goto(`/w/${tag}/settings`);
  expect(res?.status(), 'la fila con JSON inválido tumbó la página').toBe(200);

  // Y no se cuela la invitación del otro espacio.
  await expect(page.locator('body')).not.toContainText('espacio-ajeno');

  const db2 = getTestDb();
  db2.prepare("DELETE FROM notifications WHERE id LIKE 'inv-basura-%' OR id LIKE 'inv-ajena-%'").run();
  db2.close();
  expect(wsId).toBeTruthy();
});
