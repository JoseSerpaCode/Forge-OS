import { test, expect } from '@playwright/test';

/**
 * Arrastrar una tarjeta entre columnas.
 *
 * Estaba desactivado con `test.skip`. La razón era el propio arrastre:
 * `dragTo` emite el gesto de un tirón y el tablero usa una librería que
 * necesita ver el puntero **moverse** para reconocerlo, así que no se disparaba
 * ningún PATCH y la prueba se quedaba esperando. Con el ratón paso a paso
 * —bajar, mover en varios tramos, pausa, soltar— el gesto se parece al de una
 * mano y la librería lo reconoce. Es la misma técnica que arregló el arrastre
 * del ómnibus.
 */
test.describe('Kanban UI Flow', () => {
  test('Debe permitir arrastrar una tarjeta a In Progress y persistir en la DB', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    await page.goto('/login');
    await page.fill('input[name="username"]', 'jose');
    await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
    await page.click('button[type="submit"]');
    
    // Redirects to / and then we go to the board
    await page.waitForURL('**/');
    await page.goto('/w/test-workspace/board');
    
    // Simular Drag & Drop
    const card = page.locator('.issue-card').first();
    const targetColumn = page.locator('.board-column[data-status="in_progress"] .column-content');
    
    // Setup request promise BEFORE dragging
    const requestPromise = page.waitForRequest(req => req.url().includes('/move') && req.method() === 'PATCH');
    
    const origen = await card.boundingBox();
    const destino = await targetColumn.boundingBox();
    if (!origen || !destino) throw new Error('no encuentro la tarjeta o la columna destino');

    await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
    await page.mouse.down();
    await page.mouse.move(destino.x + destino.width / 2, destino.y + 40, { steps: 12 });
    await page.waitForTimeout(120);
    await page.mouse.up();
    
    // Validar que la UI refleja el cambio (Optimistic UI)
    await expect(targetColumn.locator('.issue-card').first()).toBeVisible();
    
    // Validar la red (El PATCH debió devolver 200)
    const request = await requestPromise;
    const response = await request.response();
    expect(response?.status()).toBe(200);
  });
});
