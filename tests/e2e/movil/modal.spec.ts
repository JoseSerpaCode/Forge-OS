import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * El modal de un ticket, en un teléfono.
 *
 * El ancho no era el problema —el panel ya es `max-w-full`—, sino lo de dentro:
 * `p-8` se comía 64 de los 393 px de pantalla y cuatro rejillas de dos columnas
 * partían lo que quedaba en campos de unos 150. Un desplegable de personas o un
 * selector de fecha en 150 px no se lee: se adivina.
 *
 * En `sm` y por encima siguen siendo dos columnas, que es donde tienen sentido.
 */
const ESPACIO = 'ws-modal-movil';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

async function conUnTicket(titulo: string) {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;

  db.prepare('DELETE FROM issues WHERE title = ?').run(titulo);
  const nuevo = crypto.randomUUID();
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(nuevo, 'Modal móvil', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);

  const issueId = crypto.randomUUID();
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position)
              VALUES (?, ?, 'task', ?, 'todo', ?, 100000)`)
    .run(issueId, ws.id, titulo, yo.id);
  return issueId;
}

async function abrirElModal(page: any, titulo: string) {
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const tarjeta = page.locator('.issue-card', { hasText: titulo }).first();
  await expect(tarjeta).toBeVisible();
  // Por el título: pulsar el desplegable de mover no abre el modal, a propósito.
  await tarjeta.locator('h4').click();
  const modal = page.locator('#issue-details-modal');
  await expect(modal).not.toHaveClass(/translate-x-full/);
  return modal;
}

test('los campos del modal ocupan el ancho, no la mitad', async ({ page }) => {
  await entrar(page);
  await conUnTicket('Modal ancho');
  await abrirElModal(page, 'Modal ancho');

  const ventana = page.viewportSize()!.width;
  const asignado = page.locator('#modal-issue-assignee');
  await expect(asignado).toBeVisible();

  const caja = await asignado.boundingBox();
  // Con dos columnas y `p-8` salían ~150 px. A ancho completo pasa de 300.
  expect(caja!.width).toBeGreaterThan(ventana * 0.75);
});

test('los pares de campos se apilan en vez de partirse', async ({ page }) => {
  await entrar(page);
  await conUnTicket('Modal apilado');
  await abrirElModal(page, 'Modal apilado');

  const asignado = await page.locator('#modal-issue-assignee').boundingBox();
  const reporta = await page.locator('#modal-issue-reporter').boundingBox();

  // Uno debajo del otro, no uno al lado del otro.
  expect(reporta!.y).toBeGreaterThan(asignado!.y + asignado!.height);
  expect(Math.abs(reporta!.width - asignado!.width)).toBeLessThan(2);
});

test('el modal no se desplaza de lado', async ({ page }) => {
  await entrar(page);
  await conUnTicket('Modal sin desbordar');
  const modal = await abrirElModal(page, 'Modal sin desbordar');

  /*
   * La cabecera llevaba seis controles en una fila. En 360 px eso no se
   * apretaba: abría una barra de desplazamiento horizontal dentro del modal, y
   * «Eliminar» y la equis quedaban fuera de la pantalla. Cerrar el modal exigía
   * descubrir antes que se podía arrastrar de lado.
   */
  const medidas = await modal.evaluate((el: HTMLElement) => ({
    contenido: el.scrollWidth,
    caja: el.clientWidth,
  }));
  expect(medidas.contenido).toBeLessThanOrEqual(medidas.caja + 1);

  // Y lo que importa de verdad: se puede cerrar sin buscarlo.
  await expect(page.locator('#close-modal-btn')).toBeInViewport();
});
