import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Plantillas de bases de datos.
 *
 * Lo que hay que comprobar de verdad no es que la galería se vea, sino que lo
 * que se elige llega **hasta el esquema guardado**: las columnas en su orden,
 * los tipos correctos y las opciones del desplegable partidas una a una. El
 * paso de la plantilla al formulario es el sitio donde se pierden cosas, así
 * que se mira el `schema_json` en SQLite y no la pantalla.
 */

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/);
}

/** Lo que quedó guardado de una tabla, por id. */
function guardada(id: string) {
  const db = getTestDb();
  const fila = db.prepare('SELECT schema_json, icon FROM dynamic_databases WHERE id = ?').get(id) as any;
  db.close();
  return fila;
}

function esquemaDe(id: string) {
  return JSON.parse(guardada(id).schema_json).columns as Array<{ id: string; name: string; type: string; options?: string[] }>;
}

function iconoDe(id: string): string | null {
  return guardada(id).icon;
}

test('una plantilla llega entera hasta el esquema guardado', async ({ page }) => {
  await entrar(page);
  await page.goto('/w/test-workspace/db');

  await page.click('#btn-new-db');
  await expect(page.locator('#step-tpl')).toBeVisible();

  // Asignaturas: cuatro columnas de texto/número y una de selección.
  await page.click('[data-tpl="courses"]');
  await expect(page.locator('#step-form')).toBeVisible();

  // El formulario llega relleno, no en blanco.
  await expect(page.locator('#db-name')).not.toHaveValue('');
  await expect(page.locator('.col-def')).toHaveCount(5);

  // El icono de la plantilla queda marcado en el selector, y es un nombre de
  // la tabla de iconos: si aquí llegara un emoji, no se pintaría nada.
  await expect(page.locator('#db-icon')).toHaveValue('graduation-cap');
  await expect(page.locator('.icon-opt[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.icon-opt[data-icon="graduation-cap"]')).toHaveAttribute('aria-pressed', 'true');

  // La columna de selección enseña sus opciones desde el principio: si el
  // contenedor siguiera oculto, quien quisiera cambiarlas no las encontraría.
  const seleccion = page.locator('.col-def').nth(4);
  await expect(seleccion.locator('.col-type')).toHaveValue('select');
  await expect(seleccion.locator('.col-options-container')).toBeVisible();
  await expect(seleccion.locator('.col-options')).not.toHaveValue('');

  // Un nombre propio para no chocar con otras corridas.
  const nombre = `Plantilla ${Date.now()}`;
  await page.fill('#db-name', nombre);

  await page.click('#btn-save-db');
  await page.waitForURL(/\/db\/[0-9a-f-]+$/);

  const id = page.url().split('/').pop()!;
  const columnas = esquemaDe(id);

  expect(iconoDe(id)).toBe('graduation-cap');

  expect(columnas).toHaveLength(5);
  expect(columnas.map((c) => c.type)).toEqual(['text', 'text', 'number', 'text', 'select']);
  // El servidor genera los ids; la plantilla no puede imponerlos.
  for (const c of columnas) expect(c.id).toMatch(/^col_[0-9a-f]+$/);
  // Las opciones llegan partidas y sin espacios de sobra.
  expect(columnas[4].options!.length).toBeGreaterThan(1);
  for (const o of columnas[4].options!) expect(o).toBe(o.trim());
});

test('la tabla en blanco trae una columna vacía y se puede editar', async ({ page }) => {
  await entrar(page);
  await page.goto('/w/test-workspace/db');

  await page.click('#btn-new-db');
  await page.click('[data-tpl="__blank__"]');

  await expect(page.locator('#db-name')).toHaveValue('');
  await expect(page.locator('.col-def')).toHaveCount(1);

  // Quitar la única columna no puede dejar el formulario sin nada donde
  // escribir: se repone una fila en blanco.
  await page.locator('.col-def').first().locator('.btn-rm-col').click();
  await expect(page.locator('.col-def')).toHaveCount(1);
});

test('se puede volver a la galería y cambiar de plantilla', async ({ page }) => {
  await entrar(page);
  await page.goto('/w/test-workspace/db');

  await page.click('#btn-new-db');
  await page.click('[data-tpl="courses"]');
  const primera = await page.locator('#db-name').inputValue();

  await page.click('#btn-tpl-back');
  await expect(page.locator('#step-tpl')).toBeVisible();

  await page.click('[data-tpl="expenses"]');
  const segunda = await page.locator('#db-name').inputValue();

  // Cambiar de plantilla reemplaza lo anterior; no se acumulan las columnas de
  // las dos, que es el fallo típico de rellenar sin vaciar antes.
  expect(segunda).not.toBe(primera);
  await expect(page.locator('.col-def')).toHaveCount(5);
});
