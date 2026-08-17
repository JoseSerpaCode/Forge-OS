import { test, expect } from '@playwright/test';

/**
 * Sugerencias al invitar a alguien al espacio.
 *
 * Esta prueba existe por cómo se «arregló» la primera vez: se escribió el
 * endpoint, se escribió el script que lo consume, pasó el typecheck y se dio
 * por hecho. Faltaba el contenedor donde pintar la lista, así que el script
 * salía por `if (!lista) return` sin un solo error en consola y el campo se
 * comportaba igual que antes de tener buscador.
 *
 * El typecheck no lo veía porque `getElementById` devuelve `HTMLElement | null`
 * y el guard trata el nulo correctamente. Solo se ve escribiendo en el campo.
 */
const ESPACIO = 'ws-invitar';

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
  const r = await page.request.post('/api/workspaces', { data: { name: 'Invitar', sys_tag: ESPACIO } });
  expect([200, 201, 409]).toContain(r.status());
  await page.close();
});

test('escribir en el campo enseña sugerencias de verdad', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/settings`);

  await page.click('#btn-add-member');
  const campo = page.locator('#add-member-username');
  await expect(campo).toBeVisible();

  const lista = page.locator('#add-member-results');
  // El contenedor tiene que existir: sin él el script se sale sin hacer nada.
  await expect(lista).toHaveCount(1);
  await expect(lista).toBeHidden();

  // Con menos de dos letras no se consulta: sería medio padrón.
  await campo.fill('p');
  await expect(lista).toBeHidden();

  await campo.fill('profile_user');
  await expect(lista).toBeVisible();
  await expect(lista.getByRole('option', { name: /profile_user/ })).toBeVisible();
});

test('elegir una sugerencia rellena el campo', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/settings`);
  await page.click('#btn-add-member');

  await page.locator('#add-member-username').fill('profile_us');
  const opcion = page.locator('#add-member-results').getByRole('option').first();
  await expect(opcion).toBeVisible();
  await opcion.click();

  await expect(page.locator('#add-member-username')).toHaveValue('profile_user');
  await expect(page.locator('#add-member-results')).toBeHidden();
});

test('quien ya es miembro no sale entre las sugerencias', async ({ page }) => {
  await entrar(page);
  await page.goto(`/w/${ESPACIO}/settings`);

  // `jose` es el propietario del espacio: ofrecerlo lleva a un error al enviar.
  const res = await page.request.get(`/api/w/${ESPACIO}/members/search?q=jose`);
  expect(res.status()).toBe(200);
  expect((await res.json()).users.map((u: any) => u.username)).not.toContain('jose');
});
