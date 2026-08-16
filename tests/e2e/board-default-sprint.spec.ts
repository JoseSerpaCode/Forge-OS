import { test, expect } from '@playwright/test';

/**
 * La primera visita al tablero abre el sprint activo, no el backlog.
 *
 * Caía en el backlog, que en un espacio bien llevado está casi siempre vacío:
 * un tablero con un sprint en marcha y doce issues dentro recibía al usuario
 * con «Tu tablero kanban está vacío».
 */
test('el tablero abre en el sprint activo cuando no hay elección previa', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  // Sin cookie de sprint recordado: la visita de alguien que llega por primera vez.
  await page.context().clearCookies({ name: 'forge_last_sprint_ws-jose-test' });
  await page.goto('/w/test-workspace/board');

    // Por id y no `select.first()`: la barra tiene tres desplegables —sprint,
  // orden y etiqueta— y cuál es el primero depende del maquetado.
  const selected = page.locator('#sprint-selector');
  const label = (await selected.locator('option:checked').textContent())?.trim() ?? '';

  // El espacio de pruebas puede no tener sprint activo; entonces backlog es lo
  // correcto. Lo que no puede pasar es abrir en backlog **habiendo** uno activo.
  const hasActive = await page.locator('select option', { hasText: '(Active)' }).count();
  if (hasActive > 0) {
    expect(label).toContain('(Active)');
  } else {
    expect(label).toBe('Backlog');
  }
});
