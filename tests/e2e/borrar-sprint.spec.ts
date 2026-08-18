import { test, expect } from '@playwright/test';

/**
 * Borrar un sprint.
 *
 * No existía: se podían crear y cerrar, pero no quitar. Un sprint creado por
 * error se quedaba para siempre en el desplegable del tablero, que es la única
 * lista por la que se navega el trabajo.
 *
 * Lo que hay que fijar aquí es que **los tickets no se van con él**. Un sprint
 * es una agrupación temporal; el trabajo que contiene existe por su cuenta y
 * puede llevar horas registradas, etiquetas y adjuntos. Borrarlos en cascada
 * convertiría una limpieza en una pérdida irreversible.
 */
const ESPACIO = 'ws-borrar-sprint';

/**
 * Astro rechaza los métodos que escriben sin cabecera `Origin`
 * («Cross-site DELETE form submissions are forbidden»). El navegador la manda
 * sola; `page.request` no, así que hay que ponerla a mano en las pruebas.
 */
const ORIGIN = { Origin: 'http://localhost:4322' };

test.describe.configure({ mode: 'serial' });

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await entrar(page);
  const r = await page.request.post('/api/workspaces', { data: { name: 'Borrar', sys_tag: ESPACIO } });
  expect([200, 201, 409]).toContain(r.status());
  await page.close();
});

test('un sprint vacío se borra sin preguntar', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const ws = await page.locator('.kanban-container').getAttribute('data-workspace');

  const creado = await page.request.post('/api/sprints', { data: { name: 'Vacío', workspaceId: ws } });
  const { id } = await creado.json();

  const res = await page.request.delete(`/api/sprints/${id}`, { headers: ORIGIN });
  expect(res.status()).toBe(200);

  // Y desaparece del desplegable, que es el motivo de todo esto.
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const opciones = await page.locator('#sprint-selector option').allTextContents();
  expect(opciones.join()).not.toContain('Vacío');
});

test('con tickets dentro se niega y dice cuántos son', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const ws = await page.locator('.kanban-container').getAttribute('data-workspace');

  const creado = await page.request.post('/api/sprints', { data: { name: 'Con trabajo', workspaceId: ws } });
  const { id: sprintId } = await creado.json();
  await page.request.post('/api/issues', {
    data: { title: 'No me borres', workspace_id: ws, sprint_id: sprintId, type: 'task' },
  });

  const res = await page.request.delete(`/api/sprints/${sprintId}`, { headers: ORIGIN });
  expect(res.status()).toBe(409);
  const datos = await res.json();
  expect(datos.error_code).toBe('sprint_not_empty');
  expect(datos.pending).toBe(1);
  // Y ofrece a dónde moverlos, no solo que no se puede.
  expect(datos.strategies).toContain('backlog');
});

test('al borrarlo, los tickets van al backlog y siguen existiendo', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const ws = await page.locator('.kanban-container').getAttribute('data-workspace');

  const creado = await page.request.post('/api/sprints', { data: { name: 'Se va', workspaceId: ws } });
  const { id: sprintId } = await creado.json();
  const issue = await page.request.post('/api/issues', {
    data: { title: 'Sobrevivo al sprint', workspace_id: ws, sprint_id: sprintId, type: 'task' },
  });
  const { id: issueId } = await issue.json();

  const res = await page.request.delete(`/api/sprints/${sprintId}`, { data: { strategy: 'backlog' }, headers: ORIGIN });
  expect(res.status()).toBe(200);
  expect((await res.json()).moved).toBe(1);

  // El ticket sigue vivo. Esto es lo que no puede fallar nunca.
  const sigue = await page.request.get(`/api/issues/${issueId}`);
  expect(sigue.status()).toBe(200);
  expect((await sigue.json()).sprint_id).toBeNull();
});

test('quien no es propietario no puede borrar sprints', async ({ page }) => {
  await entrar(page);
  // El botón solo se pinta para propietarios, pero la puerta está en el
  // servidor: esconder el botón no es una comprobación.
  const ajeno = await page.request.delete('/api/sprints/no-existe-jamas', { headers: ORIGIN });
  expect([403, 404]).toContain(ajeno.status());
});
