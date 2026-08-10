import { test, expect } from '@playwright/test';

/**
 * Las guardas del flujo de proveedores.
 *
 * El intercambio de código por token no se puede probar sin credenciales
 * reales, pero sí todo lo que lo rodea — que es donde están los fallos que
 * importan: un `state` que no se comprueba deja que alguien te meta en su
 * cuenta sin que lo notes.
 */

test('sin credenciales configuradas, la ruta no existe', async ({ request }) => {
  // Es el estado actual de producción: los botones salen deshabilitados y la
  // ruta responde 404 en vez de un error a medias que parezca una avería.
  for (const p of ['google', 'github']) {
    const res = await request.get(`/api/auth/oauth/${p}`, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  }
});

test('un proveedor inventado no existe', async ({ request }) => {
  const res = await request.get('/api/auth/oauth/facebook', { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test('el retorno sin estado no abre sesión', async ({ page }) => {
  await page.context().clearCookies();
  const res = await page.goto('/api/auth/oauth/github/callback?code=robado');

  // Sin credenciales da 404; con ellas daría /login?error=oauth_state. Lo que
  // no puede pasar en ninguno de los dos casos es acabar dentro.
  expect(page.url()).not.toMatch(/\/w\//);
  expect([404, 200]).toContain(res?.status() ?? 0);
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'forge_session')).toBeUndefined();
});

test('las rutas de proveedor son públicas: no redirigen al login', async ({ request }) => {
  // Si el middleware no las dejara pasar, quien vuelve de Google —que aún no
  // tiene sesión— sería expulsado justo en el paso que iba a creársela.
  const res = await request.get('/api/auth/oauth/github/callback?code=x', { maxRedirects: 0 });
  expect(res.status()).not.toBe(401);
});
