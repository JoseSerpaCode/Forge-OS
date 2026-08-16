import { test, expect } from '@playwright/test';

/**
 * Cerrar un sprint con trabajo dentro, y volver al backlog.
 *
 * Los dos fallos que se reportaron desde producción:
 *
 *  - Al elegir «Backlog» en el selector no pasaba nada: se volvía al sprint.
 *  - Al cerrar un sprint con tareas sin terminar, salía un aviso con el JSON
 *    del servidor: `{"error_code":"unfinished_issues","pending":1,...}`.
 *
 * Espacio propio para no chocar con las otras suites, que comparten la base.
 */
const ESPACIO = 'ws-cierre-sprint';

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
  const r = await page.request.post('/api/workspaces', {
    data: { name: 'Cierre de sprint', sys_tag: ESPACIO },
  });
  // 409 si ya existe de una corrida anterior: sirve igual.
  expect([200, 201, 409]).toContain(r.status());
  await page.close();
});

test('el selector puede volver al backlog', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board`);

  // El sprint se crea por API: montarlo por la interfaz mete en la prueba el
  // modal de crear, que no es lo que se está comprobando aquí.
  const ws = await page.locator('.kanban-container').getAttribute('data-workspace');
  await page.request.post('/api/sprints', {
    data: { name: 'Sprint de prueba', workspaceId: ws },
  });

  await page.goto(`/w/${ESPACIO}/board`);
  const opciones = await page.locator('#sprint-selector option').count();
  expect(opciones).toBeGreaterThan(1);

  // Se entra a un sprint —así queda en la cookie— y luego se pide el backlog.
  await Promise.all([
    page.waitForURL(/sprint=[0-9a-f-]{36}/),
    page.locator('#sprint-selector').selectOption({ index: 1 }),
  ]);
  await Promise.all([
    page.waitForURL(/sprint=backlog/),
    page.locator('#sprint-selector').selectOption('backlog'),
  ]);

  // Antes: la URL perdía el parámetro, el servidor redirigía por cookie y se
  // acababa de vuelta en el sprint.
  expect(page.url()).toContain('sprint=backlog');
  const elegida = await page.locator('#sprint-selector option:checked').textContent();
  expect(elegida?.trim()).toBe('Backlog');
});

test('cerrar con trabajo pendiente pregunta en vez de escupir JSON', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board`);
  const ws = await page.locator('.kanban-container').getAttribute('data-workspace');

  // Sprint propio de esta prueba: reutilizar el de la anterior la ataría a que
  // aquella lo dejara abierto, y ya lo cierra.
  const creado = await page.request.post('/api/sprints', {
    data: { name: `Cerrar ${Date.now()}`, workspaceId: ws },
  });
  const sprintId = (await creado.json()).id;

  // El campo es `workspace_id`; con `workspaceId` el servicio responde 400 y el
  // sprint se quedaría vacío, que es justo el caso que aquí no se prueba.
  const issue = await page.request.post('/api/issues', {
    data: { title: 'Queda a medias', workspace_id: ws, sprint_id: sprintId, type: 'task' },
  });
  expect(issue.status()).toBe(201);

  await page.goto(`/w/${ESPACIO}/board?sprint=${sprintId}`);

  // Arrancar el sprint: solo se cierra lo que está en marcha.
  const toggle = page.locator('#btn-toggle-sprint');
  if ((await toggle.getAttribute('data-current-status')) === 'planned') {
    await toggle.click();
    await page.click('#btn-forge-confirm-ok');
    await page.waitForLoadState('networkidle');
  }

  await page.locator('#btn-toggle-sprint').click();

  const dialogo = page.locator('#close-sprint-modal');
  await expect(dialogo).toBeVisible();

  // Lo que se veía antes, y no debe volver a verse.
  const texto = await dialogo.textContent();
  expect(texto).not.toContain('error_code');
  expect(texto).not.toContain('unfinished_issues');
  expect(texto).toMatch(/sin terminar|unfinished/i);

  // Las tres salidas, con la de devolver al backlog marcada por defecto.
  await expect(dialogo.locator('input[name="close-strategy"]')).toHaveCount(3);
  await expect(dialogo.locator('input[value="backlog"]')).toBeChecked();

  // Se espera al PATCH, no a que la red se calme: `networkidle` se cumple
  // antes de que la petición salga, y el `goto` de después la abortaba.
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/sprints/${sprintId}`) && r.request().method() === 'PATCH'),
    page.click('#btn-close-sprint-confirm'),
  ]);
  expect(respuesta.status()).toBe(200);
  await page.waitForLoadState('load');

  // El ticket sobrevive, fuera del sprint.
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  await expect(page.locator('.issue-card', { hasText: 'Queda a medias' }).first()).toBeVisible();
});
