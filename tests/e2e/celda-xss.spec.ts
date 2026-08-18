import { test, expect } from '@playwright/test';

/**
 * Una celda con HTML dentro no ejecuta nada.
 *
 * Se quitó el escapado **al guardar** de las bases dinámicas, porque acumulaba
 * —un `<` se guardaba como `&lt;` y al reeditar como `&amp;lt;`— y porque la
 * regla del proyecto dice escapar al pintar.
 *
 * Esa decisión solo es correcta si el camino de pintado escapa de verdad. Astro
 * lo hace con `{val}`, pero eso hay que **comprobarlo**, no suponerlo: es la
 * diferencia entre quitar un doble escapado y abrir un XSS.
 */
const ORIGIN = { Origin: 'http://localhost:4322' };
const ESPACIO = 'ws-celda-xss';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('el HTML escrito en una celda se ve como texto, no se ejecuta', async ({ page }) => {
  const errores: string[] = [];
  page.on('dialog', async (d) => { errores.push('ALERT: ' + d.message()); await d.dismiss(); });

  await entrar(page);
  const ws = await page.request.post('/api/workspaces', {
    data: { name: 'Celda XSS', sys_tag: ESPACIO }, headers: ORIGIN,
  });
  expect([200, 201, 409]).toContain(ws.status());

  // Una base con una columna de texto. El servidor genera los ids de columna,
  // así que hay que leerlos de la respuesta en vez de inventarlos.
  const base = await page.request.post(`/api/w/${ESPACIO}/db`, {
    data: { name: 'Prueba', columns: [{ name: 'Texto', type: 'text' }] },
    headers: ORIGIN,
  });
  expect([200, 201]).toContain(base.status());
  const baseId = (await base.json()).id;

  // La respuesta de creación solo trae el id, así que el de la columna se lee
  // del listado.
  const listado = await page.request.get(`/api/w/${ESPACIO}/db`);
  const suya = (await listado.json()).find((d: any) => d.id === baseId);
  // Drizzle devuelve las claves en camelCase: `schemaJson`, no `schema_json`.
  // Es la misma trampa que ya costó dos fallos en este proyecto.
  const colId = JSON.parse(suya.schemaJson ?? suya.schema_json).columns[0].id;
  expect(colId).toBeTruthy();

  const PELIGROSO = '<img src=x onerror=alert(1)>Hola';
  const fila = await page.request.post(`/api/w/${ESPACIO}/db/${baseId}/entries`, {
    // El cuerpo es el mapa de columnas directamente, sin envolver.
    data: { [colId]: PELIGROSO }, headers: ORIGIN,
  });
  expect([200, 201]).toContain(fila.status());

  await page.goto(`/w/${ESPACIO}/db/${baseId}`);
  await page.waitForLoadState('networkidle');

  // No se ejecutó nada.
  expect(errores, `se ejecutó código desde una celda:\n  ${errores.join('\n')}`).toEqual([]);
  // Y no hay ningún <img> inyectado dentro de la tabla.
  expect(await page.locator('table img[src="x"]').count()).toBe(0);

  // El texto se ve **tal como se escribió**, sin `&lt;`: eso es lo que se
  // arregló al dejar de escapar en el guardado.
  await expect(page.locator('table')).toContainText(PELIGROSO);
});
