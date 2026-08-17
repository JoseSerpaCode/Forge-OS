import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * La tabla de tareas pinta el estado traducido, no la clave.
 *
 * `TaskTable.astro` arma la clave desde el dato: `t(\`status.${task.status}\`)`.
 * La base guarda 'review' y la clave se llamaba 'status.in_review', así que
 * pedía una que no existe. `useTranslations` devuelve la clave cuando no la
 * encuentra, y como una clave es una cadena no vacía, el `|| respaldo` de detrás
 * nunca entraba: en el hub y en el panel del espacio salía el texto
 * `status.review` a la cara del usuario.
 *
 * No lo veía nadie: ni el typecheck —el argumento es `string`, no una de las
 * claves literales— ni la prueba de paridad, porque faltaba en los dos idiomas.
 */
const ESPACIO = 'ws-estado-tabla';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('una tarea en revisión no muestra la clave cruda', async ({ page }) => {
  await entrar(page);
  const r = await page.request.post('/api/workspaces', { data: { name: 'Estado', sys_tag: ESPACIO } });
  expect([200, 201, 409]).toContain(r.status());

  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const ws = await page.locator('.kanban-container').getAttribute('data-workspace');

  // El panel lista `assignee_id = <quien mira>`, así que la tarea nace asignada.
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;

  const creado = await page.request.post('/api/issues', {
    data: { title: 'En revisión', workspace_id: ws, type: 'task', assignee_id: yo.id },
  });
  expect(creado.status()).toBe(201);
  const { id } = await creado.json();
  await page.request.patch(`/api/issues/${id}`, { data: { status: 'review', workspaceId: ws } });

  await page.goto(`/w/${ESPACIO}`);
  const tabla = page.locator('.task-table-container').filter({ hasText: 'En revisión' }).first();
  await expect(tabla).toBeVisible();

  // Lo que se veía antes, y no debe volver a verse.
  await expect(tabla).not.toContainText('status.review');
  await expect(tabla).not.toContainText('status.');
});

test('ningún estado ni tipo se pinta como clave en la tabla', async ({ page }) => {
  await entrar(page);
  await page.goto('/');
  const tablas = page.locator('.task-table-container');
  if (await tablas.count() === 0) test.skip(true, 'sin tareas pendientes');

  const texto = (await tablas.allTextContents()).join(' ');
  // Cualquier `prefijo.clave` sin espacios delatando una traducción sin resolver.
  expect(texto).not.toMatch(/\b(status|type)\.[a-z_]+/);
});
