import { test, expect, type Page } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * El árbol de notas: que recuerde lo abierto y que se puedan mover notas.
 *
 * Las dos quejas que lo motivaron, tal cual: «quiero mover Untitled al
 * primero y no puedo» y «entro a una subpágina y se contrae la lista, lo cual
 * es molesto si quiero irme moviendo para ver rápidamente cada una».
 *
 * Cada prueba monta su propio espacio: el orden del árbol es justo lo que se
 * mide, y las notas que crean otras pruebas en paralelo lo ensuciarían.
 */

const ORIGIN = { Origin: 'http://localhost:4322' };

async function espacioConNotas(page: Page, base: string, titulos: string[]) {
  // Un espacio nuevo por ejecución: con `--repeat-each` o reintentos, dos
  // copias de la misma prueba corren a la vez y se pisarían el árbol.
  const tag = `${base}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const db = getTestDb();
  const viejo = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(tag) as any;
  if (viejo) db.prepare('DELETE FROM pages WHERE workspace_id = ?').run(viejo.id);
  db.close();
  if (!viejo) {
    const r = await page.request.post('/api/workspaces', { data: { name: tag, sys_tag: tag }, headers: ORIGIN });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  // `POST /api/pages` necesita que se haya entrado al espacio.
  await page.goto(`/w/${tag}/p`);

  const db2 = getTestDb();
  const ws = (db2.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(tag) as any).id;
  db2.close();

  const ids: Record<string, string> = {};
  for (const titulo of titulos) {
    const r = await page.request.post('/api/pages', { data: { title: titulo, workspace_id: ws }, headers: ORIGIN });
    expect(r.ok(), await r.text()).toBeTruthy();
    ids[titulo] = (await r.json()).id;
  }
  return { ws, ids, tag };
}

/** Los títulos de un nivel del árbol, en orden, leídos de la base. */
const nivel = (ws: string, padre: string | null) => {
  const db = getTestDb();
  const filas = db
    .prepare('SELECT title FROM pages WHERE workspace_id = ? AND parent_page_id IS ? ORDER BY position')
    .all(ws, padre) as Array<{ title: string }>;
  db.close();
  return filas.map((f) => f.title);
};

const fila = (page: Page, titulo: string) =>
  page.locator('li.tree-item', { has: page.locator(':scope > .tree-row .tree-title', { hasText: titulo }) }).first();

/**
 * Arrastrar con el ratón paso a paso. `dragTo` salta al destino de un solo
 * movimiento y Chromium no llega a empezar el arrastre nativo.
 */
async function arrastrar(page: Page, desde: string, hasta: string, zona: 'antes' | 'despues' | 'dentro') {
  const origen = (await fila(page, desde).locator(':scope > .tree-row').boundingBox())!;
  const destino = (await fila(page, hasta).locator(':scope > .tree-row').boundingBox())!;
  const y = zona === 'antes' ? 2 : zona === 'despues' ? destino.height - 2 : destino.height / 2;
  await page.mouse.move(origen.x + 40, origen.y + origen.height / 2);
  await page.mouse.down();
  await page.mouse.move(origen.x + 45, origen.y + origen.height / 2 + 5, { steps: 5 });
  await page.mouse.move(destino.x + 40, destino.y + y, { steps: 10 });
  await page.mouse.up();
  await page.waitForLoadState('load');
}

test('arrastrar una nota la reordena y la mete dentro de otra', async ({ page }) => {
  const { ws, ids, tag } = await espacioConNotas(page, 'arbol-arrastre', ['Uno', 'Dos', 'Untitled']);
  await page.goto(`/w/${tag}/p/${ids.Uno}`);

  // «Untitled» al principio: la queja original.
  await arrastrar(page, 'Untitled', 'Uno', 'antes');
  await expect.poll(() => nivel(ws, null)).toEqual(['Untitled', 'Uno', 'Dos']);
  await expect(page.locator('#page-tree-root > li.tree-item .tree-title').first()).toHaveText('Untitled');

  // «Dos» dentro de «Uno», sin copiar nada a mano.
  await arrastrar(page, 'Dos', 'Uno', 'dentro');
  await expect.poll(() => nivel(ws, ids.Uno)).toEqual(['Dos']);
  // El destino queda abierto: es donde se va a mirar a continuación.
  await expect(fila(page, 'Dos')).toBeVisible();
});

test('soltar una nota sobre su propia subpágina no hace nada', async ({ page }) => {
  const { ws, ids, tag } = await espacioConNotas(page, 'arbol-ciclo', ['Madre', 'Hija']);
  const r = await page.request.fetch(`/api/pages/${ids.Hija}/move`, {
    method: 'PATCH', headers: ORIGIN, data: { parent_id: ids.Madre, index: 0 },
  });
  expect(r.ok()).toBeTruthy();
  await page.goto(`/w/${tag}/p/${ids.Hija}`);

  await arrastrar(page, 'Madre', 'Hija', 'dentro');
  await page.waitForTimeout(500);
  expect(nivel(ws, null)).toEqual(['Madre']);
  expect(nivel(ws, ids.Madre)).toEqual(['Hija']);
});

test('«Mover a…» mueve sin arrastrar y no ofrece destinos imposibles', async ({ page }) => {
  const { ws, ids, tag } = await espacioConNotas(page, 'arbol-mover-a', ['Carpeta', 'Suelta', 'Otra']);
  const previa = await page.request.fetch(`/api/pages/${ids.Otra}/move`, {
    method: 'PATCH', headers: ORIGIN, data: { parent_id: ids.Suelta, index: 0 },
  });
  expect(previa.ok(), await previa.text()).toBeTruthy();
  await page.goto(`/w/${tag}/p/${ids.Carpeta}`);

  await fila(page, 'Suelta').locator(':scope > .tree-row').hover();
  await fila(page, 'Suelta').locator(':scope > .tree-row .move-tree-page-btn').click();
  const dialogo = page.locator('#move-page-dialog');
  await expect(dialogo).toBeVisible();

  // Ni ella ni su subpágina son destinos posibles. Se mira la propiedad y no
  // `toBeDisabled()`, que no tiene en cuenta el `disabled` de un `<option>`.
  const lista = dialogo.locator('#move-page-target');
  await expect(lista.locator(`option[value="${ids.Suelta}"]`)).toHaveJSProperty('disabled', true);
  await expect(lista.locator(`option[value="${ids.Otra}"]`)).toHaveJSProperty('disabled', true);
  await expect(lista.locator(`option[value="${ids.Carpeta}"]`)).toHaveJSProperty('disabled', false);

  await lista.selectOption(ids.Carpeta);
  await dialogo.getByRole('button', { name: /^(Mover|Move)$/ }).click();

  await expect.poll(() => nivel(ws, ids.Carpeta)).toEqual(['Suelta']);
  await expect.poll(() => nivel(ws, ids.Suelta)).toEqual(['Otra']);
});

test('lo abierto sigue abierto al saltar de una nota a otra', async ({ page }) => {
  const { ids, tag } = await espacioConNotas(page, 'arbol-memoria', ['Asignatura', 'Apuntes 1', 'Apuntes 2', 'Aparte']);
  for (const t of ['Apuntes 1', 'Apuntes 2']) {
    await page.request.fetch(`/api/pages/${ids[t]}/move`, {
      method: 'PATCH', headers: ORIGIN, data: { parent_id: ids.Asignatura, index: 99 },
    });
  }

  // Entrar en la carpeta la abre: se ven sus subpáginas.
  await page.goto(`/w/${tag}/p/${ids.Asignatura}`);
  await expect(fila(page, 'Apuntes 1')).toBeVisible();

  // Saltar de una subpágina a otra no la cierra.
  await fila(page, 'Apuntes 1').locator('.tree-title').click();
  await page.waitForURL(`**/p/${ids['Apuntes 1']}`);
  await fila(page, 'Apuntes 2').locator('.tree-title').click();
  await page.waitForURL(`**/p/${ids['Apuntes 2']}`);
  await expect(fila(page, 'Apuntes 1')).toBeVisible();

  // Y al irse a otra nota fuera de ella, sigue abierta: se recuerda, no se
  // abre solo por estar dentro.
  await fila(page, 'Aparte').locator('.tree-title').click();
  await page.waitForURL(`**/p/${ids.Aparte}`);
  await expect(fila(page, 'Apuntes 2')).toBeVisible();

  // Cerrarla a mano también se recuerda.
  await fila(page, 'Asignatura').locator(':scope > .tree-row .tree-toggle').click();
  await page.reload();
  await expect(fila(page, 'Apuntes 2')).toBeHidden();
});
