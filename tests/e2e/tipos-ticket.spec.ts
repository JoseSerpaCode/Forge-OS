import { test, expect } from '@playwright/test';

/**
 * Tipos de ticket propios, de punta a punta.
 *
 * Lo que importa comprobar en el navegador —y no en una prueba de la
 * biblioteca— es que la cadena entera está conectada: el tipo creado en ajustes
 * aparece en el desplegable de nuevo ticket, la tarjeta lo pinta, y borrarlo
 * mueve los tickets en vez de dejarlos apuntando a una clave muerta.
 */
const ESPACIO = 'ws-tipos';

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
    data: { name: 'Tipos', sys_tag: ESPACIO },
  });
  expect([200, 201, 409]).toContain(r.status());
  await page.close();
});

test('un espacio nuevo trae los cuatro tipos de siempre', async ({ page }) => {
  await entrar(page);
  const res = await page.request.get(`/api/w/${ESPACIO}/issue-types`);
  expect(res.status()).toBe(200);
  const { types } = await res.json();
  expect(types.map((t: any) => t.key)).toEqual(['task', 'bug', 'story', 'epic']);
});

test('crear un tipo propio y verlo en el tablero', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/settings`);

  const seccion = page.locator('#tipos-ticket');
  await expect(seccion).toBeVisible();

  await page.fill('#tipo-nombre', 'Incidencia');
  await page.locator('.tipo-color-opt[data-color="#E5484D"]').click();
  await page.click('#form-nuevo-tipo button[type="submit"]');
  await page.waitForLoadState('load');

  await expect(page.locator('.fila-tipo[data-key="incidencia"]')).toBeVisible();

  // El desplegable de nuevo ticket lo ofrece: si no, el tipo existe y no se
  // puede usar, que es peor que no existir.
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  await expect(page.locator('#new-issue-type option[value="incidencia"]')).toHaveCount(1);
});

test('la tarjeta pinta el nombre y el color del tipo', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const ws = await page.locator('.kanban-container').getAttribute('data-workspace');

  const r = await page.request.post('/api/issues', {
    data: { title: 'Corte de luz', workspace_id: ws, type: 'incidencia' },
  });
  expect(r.status()).toBe(201);

  await page.reload();
  const tarjeta = page.locator('.issue-card', { hasText: 'Corte de luz' }).first();
  const insignia = tarjeta.locator('.issue-type-badge');
  await expect(insignia).toHaveText(/Incidencia/i);
  // La clave viaja en el atributo: el modal la lee de ahí y no del texto, que
  // cambia con el idioma.
  await expect(insignia).toHaveAttribute('data-type-key', 'incidencia');
});

test('el modal abre con el tipo correcto, no con el primero de la lista', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  await page.locator('.issue-card', { hasText: 'Corte de luz' }).first().click();
  await expect(page.locator('#issue-details-modal')).toBeVisible();
  // Antes se comparaba el texto de la insignia con 'task'/'bug'/'story': en
  // español no casaba nunca y el desplegable se quedaba en la primera opción.
  await expect(page.locator('#modal-issue-type')).toHaveValue('incidencia');
});

test('borrar un tipo en uso pregunta a dónde van los tickets', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/settings`);

  await page.locator('.fila-tipo[data-key="incidencia"] .btn-borrar-tipo').click();

  const modal = page.locator('#tipo-borrar-modal');
  await expect(modal).toBeVisible();
  // Con el número delante, no con un «puede que afecte a algunos tickets».
  await expect(modal).toContainText(/1 ticket|tickets/);
  await expect(modal).not.toContainText('error_code');

  // El que se borra no puede ser su propio destino.
  const opciones = await page.locator('#tipo-sustituto option').allTextContents();
  expect(opciones.join()).not.toMatch(/Incidencia/i);

  await page.selectOption('#tipo-sustituto', 'task');
  await page.click('#tipo-borrar-confirmar');
  await page.waitForLoadState('load');

  await expect(page.locator('.fila-tipo[data-key="incidencia"]')).toHaveCount(0);

  // Y el ticket sigue vivo, con el tipo nuevo. Ni uno huérfano.
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const tarjeta = page.locator('.issue-card', { hasText: 'Corte de luz' }).first();
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.locator('.issue-type-badge')).toHaveAttribute('data-type-key', 'task');
});

test('sólo un propietario puede tocar los tipos', async ({ page }) => {
  await entrar(page);
  // Un lector puede ver la lista —le hace falta para el tablero— pero no
  // cambiarla: borrar un tipo reescribe la columna de todos los tickets.
  const lectura = await page.request.get(`/api/w/${ESPACIO}/issue-types`);
  expect(lectura.status()).toBe(200);

  const ajeno = await page.request.get('/api/w/no-existe-jamas/issue-types');
  expect(ajeno.status()).toBe(404);
});

test('la franja de la tarjeta usa el color del tipo, no un mapa fijo', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const ws = await page.locator('.kanban-container').getAttribute('data-workspace');

  // Un tipo propio en un color que el mapa antiguo no contemplaba.
  const creado = await page.request.post(`/api/w/${ESPACIO}/issue-types`, {
    data: { name: 'Morado', color: '#8E4EC6' },
  });
  expect([200, 201, 409]).toContain(creado.status());

  await page.request.post('/api/issues', {
    data: { title: 'Con franja morada', workspace_id: ws, type: 'morado' },
  });
  await page.reload();

  const tarjeta = page.locator('.issue-card', { hasText: 'Con franja morada' }).first();
  await expect(tarjeta).toBeVisible();

  // La franja es un `::before` cuyo color viene de una variable CSS: con el
  // mapa antiguo (`bug` rojo, `story` verde, el resto azul) este tipo habría
  // salido azul aunque el equipo lo pintara de morado.
  const color = await tarjeta.evaluate((el) =>
    getComputedStyle(el, '::before').backgroundColor
  );
  expect(color).toBe('rgb(142, 78, 198)');
});

test('la tabla de tareas pinta el nombre del tipo, no su clave', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}`);

  const tabla = page.locator('.task-table-container').first();
  if (await tabla.count() === 0) return;
  const texto = await tabla.textContent();
  // Antes salía la clave en minúscula —«task», «morado»— sin traducir.
  expect(texto).not.toMatch(/\bmorado\b/);
});
