import { test, expect } from '@playwright/test';

/**
 * El idioma tiene que funcionar **antes** de tener cuenta.
 *
 * El middleware fijaba `locals.lang` después del `return` que atiende a los
 * visitantes sin sesión en rutas públicas, así que la portada, el login y el
 * registro —lo único que ve quien llega por primera vez— salían siempre en
 * inglés, sin importar el navegador ni la cookie. Y el conmutador solo existía
 * dentro de la aplicación: no había forma de cambiarlo.
 */

test('la portada respeta el idioma del navegador', async ({ browser }) => {
  const es = await browser.newContext({ locale: 'es-ES' });
  const en = await browser.newContext({ locale: 'en-US' });

  // Se comprueba `<html lang>`, que es el contrato de verdad, y no una frase
  // concreta: atar el test a la redacción lo rompería cada vez que se retoque
  // una palabra, que no es lo que aquí interesa.
  const pEs = await es.newPage();
  await pEs.goto('/');
  await expect(pEs.locator('html')).toHaveAttribute('lang', 'es');

  const pEn = await en.newPage();
  await pEn.goto('/');
  await expect(pEn.locator('html')).toHaveAttribute('lang', 'en');

  // Y que el contenido cambia de verdad, no solo el atributo.
  const cta = (p: typeof pEs) => p.locator('.lp-btn-primary').first().textContent();
  expect(await cta(pEs)).not.toBe(await cta(pEn));

  await es.close();
  await en.close();
});

test('el conmutador cambia el idioma sin perder la página', async ({ page }) => {
  // Con parámetros, porque perderlos es la forma fácil de romper esto: quien
  // llega al registro por el límite de invitados perdería la explicación.
  await page.goto('/register?reason=guest_limit');
  const antes = await page.locator('h1').first().textContent();

  await page.locator('form[action="/api/lang"] button').click();
  await page.waitForLoadState('networkidle');

  expect(new URL(page.url()).pathname).toBe('/register');
  expect(new URL(page.url()).searchParams.get('reason')).toBe('guest_limit');
  await expect(page.locator('h1').first()).not.toHaveText(antes ?? '');
});

test('el conmutador está en la portada y en el login', async ({ page }) => {
  for (const ruta of ['/', '/login', '/register']) {
    await page.goto(ruta);
    await expect(page.locator('form[action="/api/lang"]'), ruta).toHaveCount(1);
  }
});

test('/api/lang funciona sin sesión', async ({ request, baseURL }) => {
  // Es el visitante que todavía no ha elegido idioma: si el endpoint exige
  // sesión, el botón no hace nada. Devolvía 401.
  const res = await request.post('/api/lang', {
    form: { lang: 'es', current_path: '/' },
    headers: { Origin: baseURL! },
    maxRedirects: 0,
  });
  expect(res.status()).toBeLessThan(400);
});
