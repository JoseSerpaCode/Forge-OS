import { test, expect } from '@playwright/test';

/**
 * Renombrarse no puede saltarse las reglas del registro.
 *
 * Era un bypass real: registrarse como `bob` y luego cambiarse a `admin` desde
 * Ajustes. Con `Guest_...` era peor, porque además esconde la cuenta de las
 * sugerencias de búsqueda.
 */
const CASES = ['admin', 'support', 'Guest_ab12_9'];

test('Ajustes rechaza los nombres reservados y disfrazados', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'rename_me');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  for (const name of CASES) {
    const res = await page.request.post('/api/user/settings', {
      data: { username: name },
      headers: { Origin: new URL(page.url()).origin },
    });
    expect(res.status(), `${name} debería rechazarse`).toBeGreaterThanOrEqual(400);
  }

  // Y uno legítimo sigue funcionando.
  const ok = await page.request.post('/api/user/settings', {
    data: { username: 'rename_me' },
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(ok.status()).toBeLessThan(400);
});
