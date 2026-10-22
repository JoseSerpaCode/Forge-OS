import { test, expect } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { getTestDb } from './test-utils';

/**
 * Tablas: borrarlas desde la lista e importarlas desde un CSV o un Excel.
 *
 * Antes la única forma de borrar era una papelera sin texto dentro de cada
 * tabla —«no se pueden borrar tablas»—, y una tabla que ya existía en Excel
 * había que volver a escribirla fila a fila.
 */
const unico = () => Math.random().toString(36).slice(2, 7);

async function conEspacio(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
  return espacio();
}

/** Un espacio de jose, sin volver a entrar. */
function espacio() {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const tag = `ws-tablas-${unico()}`;
  const wsId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(wsId, 'Tablas', tag, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  return { db, tag, wsId };
}

function tabla(db: any, wsId: string, tag: string, nombre: string) {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO dynamic_databases (id, workspace_id, name, sys_tag, schema_json) VALUES (?,?,?,?,?)')
    .run(id, wsId, nombre, tag, JSON.stringify({ columns: [{ id: 'col_a', name: 'Nombre', type: 'text' }] }));
  db.prepare("INSERT INTO dynamic_entries (id, database_id, payload_json) VALUES (?,?,'{\"col_a\":\"x\"}')").run(crypto.randomUUID(), id);
  return id;
}

const existe = (db: any, id: string) => Boolean(db.prepare('SELECT 1 FROM dynamic_databases WHERE id = ?').get(id));

test('se borra una tabla desde la lista, con sus filas', async ({ page }) => {
  const { db, tag, wsId } = await conEspacio(page);
  const borrar = tabla(db, wsId, tag, 'Inventario viejo');
  const queda = tabla(db, wsId, tag, 'Contactos');
  await page.goto(`/w/${tag}/db`);

  await page.getByRole('button', { name: /Inventario viejo/ }).click();
  await expect(page.locator('#forge-confirm-msg')).toContainText('Inventario viejo');
  await page.locator('#btn-forge-confirm-ok').click();

  await expect(page.getByRole('link', { name: 'Inventario viejo' })).toHaveCount(0);
  expect(existe(db, borrar)).toBe(false);
  expect((db.prepare('SELECT COUNT(*) AS n FROM dynamic_entries WHERE database_id = ?').get(borrar) as any).n).toBe(0);
  expect(existe(db, queda)).toBe(true);
});

test('no se puede borrar la tabla de otro espacio por su id', async ({ page }) => {
  const { db, tag } = await conEspacio(page);
  const otro = espacio();
  const ajena = tabla(db, otro.wsId, otro.tag, 'De otro espacio');
  const res = await page.request.delete(`/api/w/${tag}/db/${ajena}`);
  expect(res.status()).toBe(404);
  expect(existe(db, ajena)).toBe(true);
});

test('importar un CSV de Excel en español: punto y coma, coma decimal y tildes en Windows-1252', async ({ page }) => {
  const { db, tag, wsId } = await conEspacio(page);
  await page.goto(`/w/${tag}/db`);
  await page.locator('#btn-importar-db').click();

  const csv = 'Alumno;Nota;Estado\nÁngela;4,5;Aprobado\nLuis;2,8;Suspenso\nMarta;3;Aprobado\nNicolás;3,9;Aprobado\n';
  await page.setInputFiles('#importar-archivo', { name: 'Notas del curso.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'latin1') });

  await expect(page.locator('#importar-resumen')).toHaveText(/^4\D+3\D/);
  await expect(page.locator('#importar-nombre')).toHaveValue('Notas del curso');
  await expect(page.locator('.imp-tipo').nth(1)).toHaveValue('number');
  await expect(page.locator('.imp-tipo').nth(2)).toHaveValue('select');
  await expect(page.locator('#importar-tabla tbody tr').first()).toContainText('Ángela');

  await page.locator('#importar-confirmar').click();
  await page.waitForURL(/\/db\/[0-9a-f-]{36}$/);

  const creada = db.prepare('SELECT id, schema_json FROM dynamic_databases WHERE workspace_id = ? AND name = ?').get(wsId, 'Notas del curso') as any;
  const columnas = JSON.parse(creada.schema_json).columns;
  expect(columnas.map((c: any) => [c.name, c.type, c.options])).toEqual([
    ['Alumno', 'text', undefined], ['Nota', 'number', undefined], ['Estado', 'select', ['Aprobado', 'Suspenso']],
  ]);
  const notas = (db.prepare('SELECT payload_json FROM dynamic_entries WHERE database_id = ? ORDER BY rowid').all(creada.id) as any[])
    .map((f) => JSON.parse(f.payload_json)[columnas[1].id]);
  expect(notas).toEqual([4.5, 2.8, 3, 3.9]);

  // En la tabla, en el orden del archivo.
  await expect(page.locator('table.tabla tbody tr').first()).toContainText('Ángela');
  await expect(page.locator('table.tabla tbody tr').last()).toContainText('Nicolás');
});

test('importar un Excel con dos hojas: se elige la hoja', async ({ page }) => {
  const { db, tag, wsId } = await conEspacio(page);
  const hoja = (filas: string) => `<worksheet><sheetData>${filas}</sheetData></worksheet>`;
  const celda = (ref: string, texto: string) => `<c r="${ref}" t="inlineStr"><is><t>${texto}</t></is></c>`;
  const libro = zipSync(Object.fromEntries(Object.entries({
    'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Resumen" sheetId="1" r:id="rId1"/><sheet name="Lecturas" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': hoja(`<row r="1">${celda('A1', 'Total')}</row>`),
    'xl/worksheets/sheet2.xml': hoja(`<row r="1">${celda('A1', 'Libro')}${celda('B1', 'Páginas')}</row><row r="2">${celda('A2', 'Rayuela')}<c r="B2"><v>600</v></c></row>`),
  }).map(([k, v]) => [k, strToU8(v)])));

  await page.goto(`/w/${tag}/db`);
  await page.locator('#btn-new-db').click();
  // También desde la galería de «Nueva tabla».
  await page.locator('#btn-tpl-importar').click();
  await expect(page.locator('#importar-db')).toBeVisible();
  await page.setInputFiles('#importar-archivo', {
    name: 'lecturas.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(libro),
  });
  // «Resumen» no tiene filas: abre directamente en «Lecturas».
  await expect(page.locator('#importar-hoja')).toBeVisible();
  await expect(page.locator('#importar-hoja option:checked')).toHaveText('Lecturas');
  await expect(page.locator('#importar-tabla tbody')).toContainText('Rayuela');
  // Y volver a la vacía lo dice sin esconder el selector.
  await page.selectOption('#importar-hoja', { label: 'Resumen' });
  await expect(page.locator('#importar-error')).toBeVisible();
  await expect(page.locator('#importar-confirmar')).toBeDisabled();
  await page.selectOption('#importar-hoja', { label: 'Lecturas' });
  await page.fill('#importar-nombre', 'Lecturas 2026');
  await page.locator('#importar-confirmar').click();
  await page.waitForURL(/\/db\/[0-9a-f-]{36}$/);

  const creada = db.prepare('SELECT schema_json FROM dynamic_databases WHERE workspace_id = ? AND name = ?').get(wsId, 'Lecturas 2026') as any;
  expect(JSON.parse(creada.schema_json).columns.map((c: any) => [c.name, c.type])).toEqual([['Libro', 'text'], ['Páginas', 'number']]);
});

test('un archivo que no es una tabla se dice, sin crear nada', async ({ page }) => {
  const { db, tag, wsId } = await conEspacio(page);
  await page.goto(`/w/${tag}/db`);
  await page.locator('#btn-importar-db').click();
  await page.setInputFiles('#importar-archivo', { name: 'roto.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('esto no es un zip') });
  await expect(page.locator('#importar-error')).toBeVisible();
  await expect(page.locator('#importar-confirmar')).toBeDisabled();
  expect((db.prepare('SELECT COUNT(*) AS n FROM dynamic_databases WHERE workspace_id = ?').get(wsId) as any).n).toBe(0);
});
