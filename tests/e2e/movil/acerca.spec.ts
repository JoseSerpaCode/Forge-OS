import { test, expect } from '@playwright/test';

/**
 * El modal «Acerca de», en un teléfono.
 *
 * Eran 650 px fijos sobre 360 —se salía por los dos lados—, con la columna de
 * pestañas a un tercio que dejaba «Documentación» cortada a media palabra, una
 * pestaña de atajos de teclado ofrecida a quien no tiene teclado, y tres de sus
 * cadenas escritas en inglés dentro de una interfaz en español.
 */
async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

async function abrirAcercaDe(page: any) {
  // El botón de la barra superior está oculto en móvil a propósito; la puerta
  // es la hoja «Más».
  await page.locator('#btn-nav-mas').click();
  await page.locator('#btn-acerca-movil').click();
  const modal = page.locator('#docs-modal');
  await expect(modal).toBeVisible();
  return modal;
}

test('cabe en la pantalla y no ofrece atajos de teclado', async ({ page }) => {
  await entrar(page);
  const modal = await abrirAcercaDe(page);

  const caja = await modal.boundingBox();
  expect(caja!.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  // Ninguna pestaña recortada: iban a un tercio del ancho y «Documentación» se
  // cortaba a media palabra.
  const cortadas = await page.locator('#docs-modal .about-tab-btn:visible').evaluateAll((ns) =>
    ns.filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent?.trim())
  );
  expect(cortadas, 'pestañas cortadas').toEqual([]);

  // Y la de atajos no se ofrece: no hay ni ⌘, ni Ctrl, ni Esc que pulsar.
  await expect(page.locator('#docs-modal [data-target="about-shortcuts"]')).toBeHidden();
});

test('sus textos están en el idioma de la interfaz', async ({ page }) => {
  await entrar(page);

  // La suite corre en inglés; se cambia a español para poder ver lo que veía el
  // usuario: tres cadenas escritas a mano que no pasaban por el diccionario.
  await page.request.post('/api/lang', {
    form: { lang: 'es', current_path: '/' },
    headers: { Origin: 'http://localhost:4322' },
  });
  // La cookie solo surte efecto en la siguiente carga.
  await page.goto('/');

  const modal = await abrirAcercaDe(page);

  /*
   * `textContent` y no `innerText`: la pestaña de atajos está oculta, así que su
   * texto no cuenta como visible y el primer intento pasaba con las tres
   * cadenas en inglés todavía dentro. Que no se vean no las traduce.
   */
  const texto = (await modal.evaluate((el: HTMLElement) => el.textContent ?? '')).toLowerCase();
  for (const suelto of ['command palette', 'create new issue', 'close modal']) {
    expect(texto, `«${suelto}» sigue en inglés`).not.toContain(suelto);
  }
});

test('el tablero vacío no ofrece una tecla que no existe', async ({ page }) => {
  await entrar(page);

  const db = (await import('../test-utils')).getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(crypto.randomUUID(), 'Vacío', 'ws-vacio-movil', yo.id);
  const ws = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'ws-vacio-movil'").get() as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);
  db.prepare('DELETE FROM issues WHERE workspace_id = ?').run(ws.id);

  await page.goto('/w/ws-vacio-movil/board');

  /*
   * «Presiona [C] para crear una nueva tarea» es la única indicación que ve
   * quien abre un tablero vacío, y en un teléfono señala una tecla que no
   * existe. Se comprueba que ahí se señala el botón, no la tecla.
   */
  const vacio = page.locator('.tablero-vacio');
  await expect(vacio).toBeVisible();

  /*
   * Se mide la caja, no `toBeHidden()`.
   *
   * `toBeHidden` pasaba con la pista puesta: el bloque está dentro de un
   * contenedor absoluto que se sale del viewport, y para Playwright «visible»
   * no es lo mismo que «se ve en pantalla». Una tecla dibujada con 20 px de
   * ancho es una tecla dibujada, esté donde esté.
   */
  const pistas = await vacio.locator('kbd').evaluateAll((ns) =>
    ns.map((n) => n.getBoundingClientRect().width).filter((w) => w > 0)
  );
  expect(pistas, 'se dibuja un atajo de teclado en un teléfono').toEqual([]);
  // Y en su lugar se señala el botón, que sí está a un dedo de distancia.
  await expect(vacio.locator('p.sm\\:hidden')).toBeVisible();
});
