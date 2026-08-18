import { test, expect } from '@playwright/test';

/**
 * Socket.IO no está en el camino crítico de cada carga.
 *
 * Se cargaba en todas las páginas con sesión y abría su conexión de inmediato,
 * solo para recibir notificaciones. Eso cuesta en los dos extremos: en la
 * `e2-micro` cada conexión abierta es memoria del proceso hasta que la pestaña
 * se cierra, y en un móvil una conexión persistente mantiene la radio despierta.
 */
async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('el script no está en el HTML: se pide después', async ({ page }) => {
  /**
   * Se comprueba sobre el HTML servido y no con un cronómetro.
   *
   * La primera versión miraba si el socket se había pedido al llegar
   * `domcontentloaded`, y fallaba: en una página local el navegador queda
   * inactivo tan pronto que el `requestIdleCallback` ya ha disparado. Medía la
   * velocidad de la máquina, no el comportamiento.
   *
   * Lo que importa es que **no venga en el HTML**: una etiqueta `<script src>`
   * ahí es una descarga que bloquea el análisis del documento, mientras que
   * inyectarla después no lo hace, tarde lo que tarde en dispararse.
   */
  await entrar(page);
  const res = await page.request.get('/');
  const html = await res.text();

  expect(
    html,
    'el HTML trae la etiqueta del socket: vuelve a estar en el camino crítico'
  ).not.toMatch(/<script[^>]+src="[^"]*socket\.io/);

  // Y sí trae el arranque diferido, que es quien lo pide luego.
  expect(html).toContain('socket.io.min.js');
  expect(html).toMatch(/requestIdleCallback|visibilitychange/);
});

test('pero acaba conectándose, que es para lo que está', async ({ page }) => {
  await entrar(page);
  await page.goto('/');

  // Retrasarlo no puede significar no hacerlo: las notificaciones en vivo
  // dependen de esta conexión.
  await expect.poll(
    async () => page.evaluate(() => typeof (window as any).socket !== 'undefined'),
    { timeout: 15_000, message: 'el socket nunca llegó a conectarse' }
  ).toBe(true);
});
