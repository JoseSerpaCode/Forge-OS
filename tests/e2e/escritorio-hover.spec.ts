import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * En escritorio, los controles discretos siguen siéndolo.
 *
 * La regla que hace visibles los controles de hover en móvil vive dentro de una
 * consulta de ancho máximo, así que no debería tocar el escritorio. Esto lo
 * comprueba en vez de suponerlo: una regla con `!important` mal acotada
 * llenaría cada fila de botones que solo estorban.
 */
const ORIGIN = { Origin: 'http://localhost:4322' };

test('el botón de borrar fila sigue oculto hasta acercarse', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const ESPACIO = 'ws-hover-escritorio';
  await page.request.post('/api/workspaces', { data: { name: 'Hover', sys_tag: ESPACIO }, headers: ORIGIN });
  const base = await page.request.post(`/api/w/${ESPACIO}/db`, {
    data: { name: 'Datos', columns: [{ name: 'Texto', type: 'text' }] }, headers: ORIGIN,
  });
  const baseId = (await base.json()).id;
  const listado = await page.request.get(`/api/w/${ESPACIO}/db`);
  const suya = (await listado.json()).find((d: any) => d.id === baseId);
  const colId = JSON.parse(suya.schemaJson ?? suya.schema_json).columns[0].id;
  await page.request.post(`/api/w/${ESPACIO}/db/${baseId}/entries`, {
    data: { [colId]: 'Fila' }, headers: ORIGIN,
  });

  await page.goto(`/w/${ESPACIO}/db/${baseId}`);
  await page.waitForLoadState('networkidle');

  // Dentro de la tabla, que es de quien habla esta prueba: la ficha de móvil
  // tiene su propio botón de borrar —visible siempre, porque allí no hay ratón
  // que acercar— y va antes en el orden del documento.
  const borrar = page.locator('table .btn-delete-row').first();
  await expect(borrar).toHaveCount(1);

  // Sin el ratón encima: invisible, como estaba pensado.
  const antes = await borrar.evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(antes), 'en escritorio debería estar oculto hasta acercarse').toBeLessThan(0.05);

  // Con el ratón encima de su fila: aparece.
  await borrar.locator('xpath=ancestor::tr[1]').hover();
  await expect.poll(async () => Number(await borrar.evaluate((el) => getComputedStyle(el).opacity)))
    .toBeGreaterThan(0.5);
});
