import { test, expect, type Page } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Lo que hacía insoportable escribir notas con Editor.js, comprobado con
 * teclado y ratón de verdad:
 *
 * - «1. » no creaba la lista: había que ir al menú del «+».
 * - Enter + Enter dejaba una línea en blanco que desaparecía al recargar.
 * - Seleccionar, copiar y pegar varios párrafos no funcionaba, porque cada
 *   párrafo era un bloque aparte.
 * - Formatear obligaba a buscar la herramienta en la barra del bloque.
 *
 * Cada prueba crea su propia nota y mira lo guardado **en SQLite** además de
 * la pantalla: con Editor.js la pantalla enseñaba lo correcto y la base no.
 */

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function abrirNotaNueva(page: Page, titulo: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
  // `POST /api/pages` necesita que se haya entrado al espacio antes.
  await page.goto('/w/test-workspace/board');
  const origin = new URL(page.url()).origin;

  const created = await page.request.post('/api/pages', {
    data: { workspace_id: 'ws-jose-test', title: titulo },
    headers: { Origin: origin },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const id = (await created.json()).id as string;

  const db = getTestDb();
  const tag = (db.prepare('SELECT w.sys_tag FROM pages p JOIN workspaces w ON w.id = p.workspace_id WHERE p.id = ?').get(id) as any).sys_tag;
  db.close();

  await page.goto(`/w/${tag}/p/${id}`);
  const editor = page.locator('#page-editor .ProseMirror');
  await editor.click();
  return { id, editor };
}

const guardado = (id: string) => {
  const db = getTestDb();
  const fila = db.prepare('SELECT content_json FROM pages WHERE id = ?').get(id) as any;
  db.close();
  return JSON.parse(fila.content_json).doc;
};

const esperarGuardado = (page: Page) =>
  expect(page.locator('#save-status')).toHaveText(/^(Saved|Guardado)$/, { timeout: 6000 });

test('«1. », «- » y «[] » crean listas al escribir', async ({ page }) => {
  const { id, editor } = await abrirNotaNueva(page, 'Atajos');

  await page.keyboard.type('1. uno');
  await page.keyboard.press('Enter');
  await page.keyboard.type('dos');
  // Enter en un ítem vacío sale de la lista, como en cualquier editor.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- viñeta');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('[] tarea');

  await expect(editor.locator('ol > li')).toHaveCount(2);
  await expect(editor.locator('ul:not([data-type]) > li')).toHaveCount(1);
  await expect(editor.locator('ul[data-type="taskList"] > li')).toHaveCount(1);

  await esperarGuardado(page);
  // Detrás de una lista final siempre queda un párrafo vacío para salir de ella.
  const tipos = guardado(id).content.filter((b: any) => b.type !== 'paragraph' || b.content).map((b: any) => b.type);
  expect(tipos).toEqual(['orderedList', 'bulletList', 'taskList']);
});

test('las líneas en blanco siguen ahí después de recargar', async ({ page }) => {
  const { id, editor } = await abrirNotaNueva(page, 'Huecos');

  await page.keyboard.type('arriba');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('abajo');
  await esperarGuardado(page);

  await page.reload();
  // arriba, dos líneas vacías, abajo.
  await expect(editor.locator('p')).toHaveCount(4);
  await expect(editor.locator('p').nth(0)).toHaveText('arriba');
  await expect(editor.locator('p').nth(3)).toHaveText('abajo');
  expect(guardado(id).content).toHaveLength(4);
});

test('seleccionar varios párrafos, copiarlos y pegarlos funciona', async ({ page }) => {
  const { id, editor } = await abrirNotaNueva(page, 'Copiar');

  for (const linea of ['uno', 'dos', 'tres']) {
    await page.keyboard.type(linea);
    await page.keyboard.press('Enter');
  }
  // Seleccionar de «uno» a «tres» con el ratón —clic al principio y
  // mayúsculas + clic al final—, cruzando párrafos: con Editor.js la
  // selección no pasaba de un bloque a otro.
  await editor.locator('p', { hasText: 'uno' }).click({ position: { x: 1, y: 5 } });
  const tres = (await editor.locator('p', { hasText: 'tres' }).boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.click(tres.x + tres.width - 2, tres.y + tres.height / 2);
  await page.keyboard.up('Shift');
  expect(await page.evaluate(() => window.getSelection()?.toString().replace(/\n+/g, '|'))).toBe('uno|dos|tres');
  await page.keyboard.press('ControlOrMeta+c');
  // Esperar a que el portapapeles tenga lo copiado: con la suite entera en
  // paralelo, pegar enseguida a veces llegaba antes y no pegaba nada.
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('tres');

  // Pegar en la línea vacía del final.
  await editor.locator('p').last().click();
  await page.keyboard.press('ControlOrMeta+v');
  await expect(editor.locator('p', { hasText: 'dos' })).toHaveCount(2);
  await esperarGuardado(page);

  const textos = guardado(id).content.filter((b: any) => b.content).map((b: any) => b.content[0].text);
  expect(textos).toEqual(['uno', 'dos', 'tres', 'uno', 'dos', 'tres']);
});

test('el menú de formato aparece al seleccionar y pone negrita', async ({ page }) => {
  const { id, editor } = await abrirNotaNueva(page, 'Formato');

  await page.keyboard.type('una palabra importante');
  await editor.locator('p').first().dblclick({ position: { x: 5, y: 5 } });
  // Con doble clic sobre la primera palabra queda seleccionada «una».
  const menu = page.locator('#note-format-menu');
  await expect(menu).toBeVisible();

  await menu.getByRole('button', { name: /Negrita|Bold/ }).click();
  await expect(editor.locator('strong')).toHaveText('una');
  await esperarGuardado(page);

  const marcas = guardado(id).content[0].content[0].marks;
  expect(marcas).toEqual([{ type: 'bold' }]);
});

test('el menú «/» inserta una tabla, y se puede seguir escribiendo debajo', async ({ page }) => {
  const { id, editor } = await abrirNotaNueva(page, 'Tabla');

  await page.keyboard.type('/tabl');
  await expect(page.locator('.note-slash-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('celda');
  await expect(editor.locator('table th').first()).toHaveText('celda');

  // Siempre hay un párrafo después de la tabla para salir de ella.
  await editor.locator('p').last().click();
  await page.keyboard.type('después');
  await esperarGuardado(page);

  const tipos = guardado(id).content.map((b: any) => b.type);
  expect(tipos[0]).toBe('table');
  expect(tipos.at(-1)).toBe('paragraph');
});

test('un bloque se puede arrastrar con el asa', async ({ page }) => {
  const { id, editor } = await abrirNotaNueva(page, 'Arrastrar');

  for (const linea of ['primero', 'segundo', 'tercero']) {
    await page.keyboard.type(linea);
    await page.keyboard.press('Enter');
  }
  await esperarGuardado(page);

  // Pasar el ratón por «primero» enseña el asa a su izquierda.
  await editor.locator('p', { hasText: 'primero' }).hover();
  const asa = page.locator('.note-drag-handle.is-visible');
  await expect(asa).toBeVisible();

  // Soltarlo en la línea vacía del final lo coloca detrás de «tercero».
  //
  // Con el ratón paso a paso y no con `dragTo`: `dragTo` salta al destino de
  // un solo movimiento y Chromium no llega a empezar el arrastre nativo.
  const destino = (await editor.locator('p').last().boundingBox())!;
  const origen = (await asa.boundingBox())!;
  await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
  await page.mouse.down();
  await page.mouse.move(origen.x + 30, origen.y + 20, { steps: 5 });
  await page.mouse.move(destino.x + 10, destino.y + destino.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('#save-status')).toHaveText(/^(Unsaved|Cambios sin)/, { timeout: 3000 });
  await esperarGuardado(page);

  const textos = guardado(id).content.filter((b: any) => b.content).map((b: any) => b.content[0].text);
  expect(textos).toEqual(['segundo', 'tercero', 'primero']);
});
