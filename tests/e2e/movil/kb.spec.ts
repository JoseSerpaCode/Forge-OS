import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * La base de conocimiento en un teléfono.
 *
 * Era la pantalla más rota del producto: el árbol de páginas es un `w-64` con
 * `m-4` —288 px fijos— así que en una pantalla de 360 dejaba 72 px para el
 * editor, y menos su propio padding, **ocho píxeles de área de escritura**.
 * Ni el árbol, ni el editor, ni las dos páginas que los alojan tenían una sola
 * utilidad responsive.
 */
const ORIGIN = { Origin: 'http://localhost:4322' };
const ESPACIO = 'ws-kb-movil';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

async function unaPagina(page: any) {
  await page.request.post('/api/workspaces', { data: { name: 'KB móvil', sys_tag: ESPACIO }, headers: ORIGIN });

  /**
   * Hay que visitar el espacio antes de crear una página.
   *
   * `api/pages` exige `last_workspace_id` en la sesión y lo pone el middleware
   * al navegar a un espacio, no la petición. Sin la visita responde 400 y la
   * prueba muere por el motivo equivocado.
   */
  await page.goto(`/w/${ESPACIO}/p`);
  const wsId = getTestDb().prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;

  const r = await page.request.post('/api/pages', {
    // El campo es `workspace_id`, con el UUID: el `sys_tag` da 400.
    data: { title: 'Apuntes de prueba', workspace_id: wsId.id },
    headers: ORIGIN,
  });
  expect(r.ok(), `crear página: ${r.status()} ${await r.text()}`).toBe(true);
  return (await r.json()).id;
}

test('el editor tiene sitio para escribir', async ({ page }) => {
  await entrar(page);
  const pageId = await unaPagina(page);
  await page.goto(`/w/${ESPACIO}/p/${pageId}`);
  await page.waitForLoadState('networkidle');

  const ancho = await page.evaluate(() => {
    // El contenedor de Editor.js se llama `page-editor` (ver `holder:`).
    const ed = document.getElementById('page-editor');
    return ed ? Math.round(ed.getBoundingClientRect().width) : -1;
  });

  expect(ancho, 'no se encontró el editor').toBeGreaterThan(0);
  // Antes: 8 px. El umbral es deliberadamente bajo —solo hay que poder
  // escribir— pero por debajo de la mitad de la pantalla no se puede.
  expect(
    ancho,
    `el editor mide ${ancho}px en una pantalla de 393: el árbol se lo está comiendo`
  ).toBeGreaterThan(250);
});

test('el árbol de páginas se abre y se cierra', async ({ page }) => {
  await entrar(page);
  const pageId = await unaPagina(page);
  await page.goto(`/w/${ESPACIO}/p/${pageId}`);

  const arbol = page.locator('#page-tree-aside');
  const abrir = page.locator('#btn-open-tree');

  // Fuera de pantalla por defecto: el editor necesita el ancho entero.
  await expect(abrir).toBeVisible();
  await expect(arbol).not.toBeInViewport();

  await abrir.tap();
  await expect(arbol).toBeInViewport();

  // Y se cierra pulsando fuera, sin tener que acertar con un botón.
  await page.locator('#page-tree-backdrop').tap();
  await expect(arbol).not.toBeInViewport();
});

test('se puede borrar una página sin ratón', async ({ page }) => {
  await entrar(page);
  const pageId = await unaPagina(page);
  await page.goto(`/w/${ESPACIO}/p/${pageId}`);

  // Estaba en `-right-12` con `opacity-0 group-hover`: fuera del viewport **y**
  // solo con el ratón encima. En un teléfono no existía.
  const borrar = page.locator('#btn-delete-page');
  await expect(borrar).toBeVisible();
  await expect(borrar).toBeInViewport();
});
