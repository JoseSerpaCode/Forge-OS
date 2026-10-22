import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Editar etiquetas y tipos desde los ajustes del espacio: nombre y color en la
 * misma ventana. Antes la etiqueta se editaba en la fila tras un botón que
 * decía «Renombrar», y el tipo solo se renombraba con el `prompt()` del
 * navegador, sin poder cambiarle el color.
 */
test('editar el nombre y el color de una etiqueta, y el color de un tipo de serie', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const tag = `ws-catalogo-${Math.random().toString(36).slice(2, 7)}`;
  const wsId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(wsId, 'Catálogo', tag, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  const etiquetaId = crypto.randomUUID();
  db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES (?,?,'Física','#0091FF')").run(etiquetaId, wsId);

  await page.goto(`/w/${tag}/settings`);
  const ventana = page.locator('#editar-catalogo');

  // Etiqueta: nombre y color, y la fila cambia sin recargar.
  await page.locator(`.fila-etiqueta[data-id="${etiquetaId}"] .btn-editar-etiqueta`).click();
  await expect(ventana).toBeVisible();
  await expect(ventana.locator('#editar-catalogo-nombre')).toHaveValue('Física');
  await ventana.locator('#editar-catalogo-nombre').fill('Física II');
  const otroColor = await ventana.locator('.color-opt[aria-pressed="false"]').first().getAttribute('data-color');
  await ventana.locator(`.color-opt[data-color="${otroColor}"]`).click();
  await ventana.locator('button[type="submit"]').click();
  await expect(ventana).toBeHidden();
  await expect(page.locator(`.fila-etiqueta[data-id="${etiquetaId}"]`)).toContainText('Física II');
  expect(db.prepare('SELECT name, color FROM labels WHERE id = ?').get(etiquetaId)).toEqual({ name: 'Física II', color: otroColor });

  // Tipo de serie: solo el color. El nombre no viaja, así que sigue traduciéndose.
  const bug = db.prepare("SELECT id, name, color FROM issue_types WHERE workspace_id = ? AND key = 'bug'").get(wsId) as any;
  await page.locator(`.fila-tipo[data-id="${bug.id}"] .btn-editar-tipo`).click();
  await expect(ventana).toBeVisible();
  const colorTipo = await ventana.locator('.color-opt[aria-pressed="false"]').first().getAttribute('data-color');
  await ventana.locator(`.color-opt[data-color="${colorTipo}"]`).click();
  const guardado = page.waitForResponse((r) => r.url().includes(`/issue-types/${bug.id}`) && r.request().method() === 'PATCH');
  await ventana.locator('button[type="submit"]').click();
  expect((await guardado).status()).toBe(200);
  expect(db.prepare('SELECT name, color FROM issue_types WHERE id = ?').get(bug.id)).toEqual({ name: bug.name, color: colorTipo });
});
