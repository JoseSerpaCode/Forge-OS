import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Plantillas desde los ajustes del espacio: crear una de cero, partir de una de
 * serie y editarla. Antes solo se podían crear desde el panel de una tarea, y
 * en los ajustes no había nada que pulsar.
 */
const ESPACIO = `ws-plantillas-${Date.now()}`;

test('crear, partir de una de serie y editar una plantilla', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const wsId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(wsId, 'Plantillas', ESPACIO, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES (?,?,'Física','#3B82F6')").run(crypto.randomUUID(), wsId);

  await page.goto(`/w/${ESPACIO}/settings`);
  const dialogo = page.locator('#dialogo-plantilla');

  // De cero.
  await page.locator('#plantillas-espacio .nueva-plantilla').click();
  await expect(dialogo).toBeVisible();
  await dialogo.locator('#pl-nombre').fill('Repaso');
  await dialogo.locator('#pl-titulo').fill('Repasar el tema');
  await dialogo.locator('#pl-entrega').fill('3');
  await dialogo.locator('#pl-pasos').fill('Leer\nResumir');

  // Una etiqueta elegida se distingue sin depender del color: lleva la marca.
  const etiqueta = dialogo.locator('.pl-etiqueta').first();
  await expect(etiqueta.locator('.marca')).toBeHidden();
  await etiqueta.click();
  await expect(etiqueta).toHaveAttribute('aria-pressed', 'true');
  await expect(etiqueta.locator('.marca')).toBeVisible();

  await dialogo.locator('button[type="submit"]').click();
  await page.waitForLoadState('load');
  await expect(page.locator('#plantillas-espacio li', { hasText: 'Repaso' })).toBeVisible();

  const guardada = db.prepare('SELECT payload_json FROM task_templates WHERE workspace_id = ? AND name = ?').get(wsId, 'Repaso') as any;
  expect(JSON.parse(guardada.payload_json)).toMatchObject({ title: 'Repasar el tema', due_offset: 3, subtareas: ['Leer', 'Resumir'] });
  expect(JSON.parse(guardada.payload_json).label_ids).toHaveLength(1);

  // De serie: el formulario llega relleno.
  await page.locator('#plantillas-espacio .base-plantilla').first().click();
  await expect(dialogo.locator('#pl-nombre')).not.toHaveValue('');
  await expect(dialogo.locator('#pl-titulo')).not.toHaveValue('');
  await expect(dialogo.locator('#pl-pasos')).not.toHaveValue('');
  await dialogo.locator('.cerrar-plantilla').click();
  await expect(dialogo).toBeHidden();

  // Editar la creada.
  await page.locator('#plantillas-espacio li', { hasText: 'Repaso' }).locator('.editar-plantilla').click();
  await expect(dialogo.locator('#pl-titulo')).toHaveValue('Repasar el tema');
  await dialogo.locator('#pl-nombre').fill('Repaso final');
  await dialogo.locator('button[type="submit"]').click();
  await page.waitForLoadState('load');
  await expect(page.locator('#plantillas-espacio li', { hasText: 'Repaso final' })).toBeVisible();

  // Sin título no se guarda, y se dice por qué.
  await page.locator('#plantillas-espacio .nueva-plantilla').click();
  await dialogo.locator('#pl-nombre').fill('Vacía');
  await dialogo.locator('button[type="submit"]').click();
  await expect(dialogo.locator('#pl-error')).toBeVisible();
});
