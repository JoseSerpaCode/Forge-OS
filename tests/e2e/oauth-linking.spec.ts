import { test, expect } from '@playwright/test';

/**
 * Conectar y desconectar proveedores desde Ajustes.
 *
 * Sin credenciales configuradas —el estado de este entorno y el de producción
 * hoy— lo que hay que comprobar es que la interfaz **no miente**: ni ofrece un
 * botón que lleva a un 404, ni deja desvincular lo que no está vinculado.
 */

test('Ajustes no ofrece conectar un proveedor sin configurar', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  await page.goto('/settings');

  // Antes eran botones que lanzaban un toast de «coming soon». Ahora, sin
  // credenciales, se dice que no está configurado y no hay nada que pulsar.
  await expect(page.locator('a[href="/api/auth/oauth/github"]')).toHaveCount(0);
  await expect(page.locator('a[href="/api/auth/oauth/google"]')).toHaveCount(0);
  await expect(page.getByText(/Not configured on this server|No configurado en este servidor/).first()).toBeVisible();
});

test('un POST sin Origin lo para el CSRF antes que nada', async ({ request }) => {
  // Astro comprueba el Origin antes de que el endpoint vea la petición. Es la
  // primera barrera y conviene que esté fijada: sin ella, cualquier página
  // podría desvincular proveedores de quien la visite.
  const res = await request.post('/api/auth/oauth/github/unlink', { maxRedirects: 0 });
  expect(res.status()).toBe(403);
});

test('desvincular sin sesión no hace nada', async ({ request, baseURL }) => {
  const res = await request.post('/api/auth/oauth/github/unlink', {
    maxRedirects: 0,
    headers: { Origin: baseURL! },
  });
  expect(res.status()).toBe(401);
});

test('un proveedor inventado no se puede desvincular', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const res = await page.request.post('/api/auth/oauth/facebook/unlink', {
    maxRedirects: 0,
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(res.status()).toBe(404);
});
