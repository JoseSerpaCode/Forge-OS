import { test, expect } from '@playwright/test';

/**
 * Ordenar el tablero es una **vista**, no un cambio.
 *
 * Lo que hay que fijar aquí es que `position` —el orden que la gente colocó a
 * mano arrastrando tarjetas— no se toca al ordenar. Si se reescribiera, volver
 * a «manual» no devolvería nada porque no quedaría a qué volver, y eso no da
 * ningún error: simplemente el trabajo de colocar el tablero desaparece.
 */
const ESPACIO = 'ws-orden';

test.describe.configure({ mode: 'serial' });

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

let ws = '';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await entrar(page);
  const r = await page.request.post('/api/workspaces', { data: { name: 'Orden', sys_tag: ESPACIO } });
  expect([200, 201, 409]).toContain(r.status());

  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  ws = (await page.locator('.kanban-container').getAttribute('data-workspace'))!;

  const existentes = await page.locator('.issue-card').count();
  if (existentes === 0) {
    // Se crean en un orden y con prioridades cruzadas, para que el orden manual
    // y el de prioridad no coincidan por casualidad.
    for (const t of [
      { title: 'Zeta sin prioridad', priority: 'low' },
      { title: 'Alfa urgente', priority: 'highest' },
      { title: 'Media tarea', priority: 'medium' },
    ]) {
      const res = await page.request.post('/api/issues', {
        data: { title: t.title, workspace_id: ws, type: 'task' },
      });
      const { id } = await res.json();
      await page.request.patch(`/api/issues/${id}`, {
        data: { priority: t.priority, workspaceId: ws },
      });
    }
  }
  await page.close();
});

const titulos = async (page: any) =>
  (await page.locator('.board-column[data-status="todo"] .issue-card h4').allTextContents())
    .map((s: string) => s.trim());

test('sin parámetro, el orden es el manual', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const t = await titulos(page);
  expect(t).toEqual(['Zeta sin prioridad', 'Alfa urgente', 'Media tarea']);
  await expect(page.locator('#board-sort')).toHaveValue('manual');
});

test('ordenar por prioridad usa la urgencia, no el alfabeto', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog&sort=priority`);
  // Alfabéticamente 'high' va antes que 'low' y 'medium' antes que ninguno:
  // ordenar por el texto dejaría lo urgente en medio de la columna.
  expect(await titulos(page)).toEqual(['Alfa urgente', 'Media tarea', 'Zeta sin prioridad']);
});

test('ordenar por título', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog&sort=title`);
  expect(await titulos(page)).toEqual(['Alfa urgente', 'Media tarea', 'Zeta sin prioridad']);
});

test('un orden inventado cae al manual en vez de reventar', async ({ page }) => {
  await entrar(page);
  // `?sort=toString` es el caso que buscar la clave con `in` en vez de con
  // `hasOwn` colaría: devolvería una función donde tiene que ir SQL.
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog&sort=toString`);
  expect(await titulos(page)).toEqual(['Zeta sin prioridad', 'Alfa urgente', 'Media tarea']);

  await page.goto(`/w/${ESPACIO}/board?sprint=backlog&sort=' OR 1=1--`);
  expect(await titulos(page)).toHaveLength(3);
});

test('ordenar NO reescribe el orden manual', async ({ page }) => {
  await entrar(page);
  // Se mira el tablero ordenado y se vuelve: lo manual tiene que seguir igual.
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog&sort=priority`);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog&sort=title`);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  expect(await titulos(page)).toEqual(['Zeta sin prioridad', 'Alfa urgente', 'Media tarea']);
});

test('con un orden activo, arrastrar ofrece volver al orden manual', async ({ page }) => {
  await entrar(page);

  /**
   * Antes esto era una banda de aviso permanente encima del tablero y las
   * tarjetas con `draggable="false"`. Ocupaba sitio todo el rato para algo que
   * solo importa en el instante en que alguien intenta mover una tarjeta —y si
   * lo intenta, ya ha dicho lo que quiere: colocarla a mano.
   *
   * Ahora las tarjetas siguen siendo arrastrables, el arrastre se corta al
   * empezar y se ofrece volver al orden manual.
   */
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog&sort=priority`);

  // Ya no hay banda de aviso ocupando la cabecera.
  await expect(page.locator('#board-sort-notice')).toHaveCount(0);

  const tarjeta = page.locator('.issue-card').first();
  await expect(tarjeta).toHaveAttribute('draggable', 'true');

  // Se dispara el arrastre a mano: Playwright no simula el gesto completo sin
  // un destino, y lo que se comprueba es la reacción al **empezar**.
  await tarjeta.dispatchEvent('dragstart', { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });

  const dialogo = page.locator('#forge-confirm-modal');
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText(/orden manual|manual order/i);

  // Y confirmar lleva de vuelta al orden manual, donde sí se puede colocar.
  await Promise.all([
    page.waitForURL((u) => !u.search.includes('sort=')),
    page.click('#btn-forge-confirm-ok'),
  ]);
});

test('el selector cambia la URL, y volver a manual la limpia', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);

  await Promise.all([
    page.waitForURL(/sort=due/),
    page.selectOption('#board-sort', 'due'),
  ]);
  await Promise.all([
    page.waitForURL((u) => !u.search.includes('sort=')),
    page.selectOption('#board-sort', 'manual'),
  ]);
});
