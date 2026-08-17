import { test, expect } from '@playwright/test';

/**
 * La paleta de comandos, que era una carcasa.
 *
 * Tenía un `<input>`, un contenedor de resultados y dos enlaces fijos en
 * inglés. `#cmd-k-input` no llevaba **ni un listener** en todo el proyecto
 * —solo un `.focus()` al abrirla—, así que escribir no hacía nada. Y la
 * búsqueda global ya existía: `/api/sys/state`, que la barra superior ya usa.
 */
async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

const abrir = async (page: any) => {
  /**
   * Se pulsa sobre el documento antes del atajo.
   *
   * El atajo llega al elemento que tiene el foco, y justo después de cerrar el
   * diálogo ese foco está en tránsito hacia el `<body>`. Sin este punto de
   * partida fijo, la prueba fallaba una de cada cuatro corridas — no por el
   * código, sino por el momento en que se pulsaba.
   */
  // Se pulsa **sobre el `<body>`** en vez de con `keyboard.press`, que va a lo
  // que tenga el foco en ese instante. Justo después de cerrar el diálogo el
  // foco está en tránsito, y bajo la carga de la suite completa esa ventana se
  // ensancha lo suficiente para que la tecla se pierda: fallaba una de cada
  // tres corridas del conjunto y ninguna en solitario.
  await page.locator('body').press('Control+k');
  await expect(page.locator('#cmd-k-palette')).toBeVisible();
};

test('escribir en la paleta busca de verdad', async ({ page }) => {
  await entrar(page);

  const espacio = `ws-paleta-${Date.now().toString(36)}`;
  const r = await page.request.post('/api/workspaces', { data: { name: 'Paleta Buscable', sys_tag: espacio } });
  expect([200, 201, 409]).toContain(r.status());

  await page.goto('/');
  await abrir(page);

  // Con menos de dos letras no se consulta.
  await page.fill('#cmd-k-input', 'P');
  await expect(page.locator('#cmd-k-hits')).toBeHidden();

  await page.fill('#cmd-k-input', 'Paleta Buscable');
  const hits = page.locator('#cmd-k-hits');
  await expect(hits).toBeVisible();
  await expect(hits.getByRole('option').first()).toContainText('Paleta Buscable');

  // Las acciones rápidas se apartan mientras hay resultados.
  await expect(page.locator('#cmd-k-quick')).toBeHidden();
});

test('se navega con flechas y se abre con Enter', async ({ page }) => {
  await entrar(page);
  await page.goto('/');
  await abrir(page);

  await page.fill('#cmd-k-input', 'jose');
  await expect(page.locator('#cmd-k-hits').getByRole('option').first()).toBeVisible();

  // Una paleta que obliga a soltar el teclado para elegir no es una paleta.
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#cmd-k-hits [aria-selected="true"]')).toHaveCount(1);

  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.pathname !== '/');
});

test('al cerrarla se limpia', async ({ page }) => {
  await entrar(page);
  await page.goto('/');
  await abrir(page);
  await page.fill('#cmd-k-input', 'jose');
  await expect(page.locator('#cmd-k-hits')).toBeVisible();

  await page.keyboard.press('Escape');
  // Se espera el cierre antes de reabrir: el atajo va al elemento con el foco,
  // y mientras el diálogo se cierra ese foco está en tránsito.
  await expect(page.locator('#cmd-k-palette')).toBeHidden();
  await abrir(page);
  // Reabrirla con la búsqueda de hace dos horas dentro es confuso.
  await expect(page.locator('#cmd-k-input')).toHaveValue('');
  await expect(page.locator('#cmd-k-hits')).toBeHidden();
});

test('un título con HTML no se ejecuta', async ({ page }) => {
  await entrar(page);
  // El título lo escribe otra persona y aquí se arma HTML, así que se escapa.
  const espacio = `ws-xss-${Date.now().toString(36)}`;
  await page.request.post('/api/workspaces', {
    data: { name: '<img src=x onerror=alert(1)>Paleta', sys_tag: espacio },
  });

  await page.goto('/');
  await abrir(page);
  await page.fill('#cmd-k-input', 'onerror');

  const hits = page.locator('#cmd-k-hits');
  await expect(hits).toBeVisible();
  // Si no se escapara, habría un <img> real dentro de los resultados.
  await expect(hits.locator('img')).toHaveCount(0);
});
