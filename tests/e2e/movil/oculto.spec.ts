import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * Lo que el código esconde, se queda escondido.
 *
 * La regla que garantiza 44 px de área táctil pone `display: inline-flex` a
 * todo `a` y `button` por debajo de 768 px. `.hidden` de Tailwind es
 * `display: none` con menos especificidad y en la misma capa, así que perdía:
 * en un teléfono aparecían los cinco controles de la barra superior que llevan
 * `hidden sm:block` —los que se esconden justamente por no caber—.
 *
 * No daba ningún error. `hidden` simplemente dejaba de significar nada en móvil
 * en toda la aplicación, y cada `hidden sm:*` que alguien escribiera a partir de
 * ahí habría hecho lo mismo.
 */
test('un botón con .hidden no se ve en móvil', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  // Dos casos reales, no un elemento de mentira: los dos llevan `hidden sm:block`.
  await expect(page.locator('#btn-show-docs')).toBeHidden();
  await expect(page.locator('#btn-toggle-theme')).toBeHidden();
});

test('una tarjeta que es enlace no se convierte en fila', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const nuevo = crypto.randomUUID();
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(nuevo, 'Tarjeta enlace', 'ws-tarjeta-enlace', yo.id);
  const ws = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'ws-tarjeta-enlace'").get() as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);

  await page.goto('/w/ws-tarjeta-enlace');

  /*
   * La regla de área táctil ponía `display: inline-flex; align-items: center` a
   * todo `<a>`, y ganaba a la utilidad `block` por especificidad. Las tarjetas
   * del panel son enlaces con el rótulo encima y la cifra debajo: pasaban a ser
   * una fila y salía «ISSUES PENDIENTES 1» pegado en una línea.
   */
  await page.waitForLoadState('networkidle');
  // Por estructura y no por texto: la suite corre con la interfaz en inglés y
  // atar la prueba al idioma la haría fallar al traducir una cadena.
  const tarjeta = page.locator('a[href*="/board"]:has(.text-4xl)').first();
  await expect(tarjeta).toBeVisible();

  const filas = await tarjeta.evaluate((el: HTMLElement) => {
    const hijos = Array.from(el.children).map((c) => c.getBoundingClientRect());
    // Los hijos tienen que ir uno debajo de otro, no en línea.
    return hijos.length >= 2 ? hijos[1].top >= hijos[0].bottom - 1 : true;
  });
  expect(filas, 'el contenido de la tarjeta se ha puesto en fila').toBe(true);
});
