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
  const cta = (p: typeof pEs) => p.locator('.hero-cta .btn-primary').first().textContent();
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

/*
 * La portada en español tiene dirección propia. `/` negocia el idioma con la
 * cookie o el navegador, y un buscador no manda ninguno de los dos: Google solo
 * conocía la versión en inglés.
 */
test('/es es la portada en español, para cualquiera, enlazada con hreflang', async ({ browser }) => {
  const en = await browser.newContext({ locale: 'en-US' });
  const p = await en.newPage();
  await p.goto('/es');
  await expect(p.locator('html')).toHaveAttribute('lang', 'es');
  await expect(p.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/es$/);
  for (const idioma of ['en', 'es', 'x-default']) {
    await expect(p.locator(`link[rel="alternate"][hreflang="${idioma}"]`)).toHaveCount(1);
  }

  // Y la de `/` enlaza a la española.
  await p.goto('/');
  await expect(p.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute('href', /\/es$/);
  await en.close();
});

test('el sitemap lleva las dos portadas con sus alternativas', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toContain('/es</loc>');
  expect(xml).toContain('hreflang="es"');
  expect(xml, 'un lastmod de «hoy» en cada petición no es cierto').not.toContain('<lastmod>');
});

test('cambiar de idioma no redirige fuera del sitio, y en la portada cambia de dirección', async ({ request, baseURL }) => {
  const pedir = (current_path: string, lang: string) => request.post('/api/lang', {
    form: { lang, current_path }, headers: { Origin: baseURL! }, maxRedirects: 0,
  });
  for (const fuera of ['//otro-sitio.example/x', '/\\otro-sitio.example', 'https://otro-sitio.example']) {
    expect((await pedir(fuera, 'es')).headers().location, fuera).toBe('/es');
  }
  expect((await pedir('/es', 'en')).headers().location).toBe('/');
  expect((await pedir('/register?reason=x', 'es')).headers().location).toBe('/register?reason=x');
});

test('las páginas piden que nadie las reescriba por el camino', async ({ request }) => {
  // `no-transform`: sin él, Cloudflare inyectaba su analítica en cada página
  // y la CSP la bloqueaba con un error en la consola.
  const res = await request.get('/');
  expect(res.headers()['cache-control']).toContain('no-transform');
});
