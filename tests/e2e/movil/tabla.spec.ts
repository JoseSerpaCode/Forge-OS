import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * Una tabla dinámica, en un teléfono.
 *
 * La tabla vivía dentro de un `overflow-auto`, así que se podía leer
 * desplazando en horizontal —columna a columna, perdiendo de vista a qué fila
 * pertenecía cada valor en cuanto la primera salía por la izquierda—. Se podía
 * usar y aun así no servía, que es el peor sitio donde estar: nada falla, así
 * que nada avisa.
 */
const ESPACIO = 'ws-tabla-movil';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

/**
 * Seis columnas: las suficientes para que la tabla no quepa y sobren campos.
 *
 * Cada prueba trae su propio nombre de tabla. Con uno compartido y
 * `fullyParallel`, el `DELETE` de una borraba la tabla que la otra acababa de
 * crear y la página se quedaba sin filas —sin error, solo vacía—.
 */
function conUnaTabla(nombre: string) {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;

  const nuevo = crypto.randomUUID();
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(nuevo, 'Tabla móvil', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);

  db.prepare('DELETE FROM dynamic_databases WHERE workspace_id = ? AND name = ?').run(ws.id, nombre);

  const cols = [
    { id: 'c1', name: 'Empresa', type: 'text' },
    { id: 'c2', name: 'Estado', type: 'select', options: ['Activo', 'Pendiente'] },
    { id: 'c3', name: 'Contacto', type: 'text' },
    { id: 'c4', name: 'Valor', type: 'number' },
    { id: 'c5', name: 'Sector', type: 'text' },
    { id: 'c6', name: 'Notas', type: 'text' },
  ];
  const dbId = crypto.randomUUID();
  db.prepare('INSERT INTO dynamic_databases (id, workspace_id, name, sys_tag, schema_json) VALUES (?,?,?,?,?)')
    .run(dbId, ws.id, nombre, nombre.toLowerCase().replace(/\s+/g, '-'), JSON.stringify({ columns: cols }));

  db.prepare('INSERT INTO dynamic_entries (id, database_id, payload_json, created_by) VALUES (?,?,?,?)')
    .run(crypto.randomUUID(), dbId, JSON.stringify({
      c1: 'Acme Corp', c2: 'Activo', c3: 'marta@acme.io', c4: 12400, c5: 'Industria', c6: 'Renueva en marzo',
    }), yo.id);

  return dbId;
}

test('cada fila se lee como una ficha, no desplazándose de lado', async ({ page }) => {
  await entrar(page);
  const dbId = conUnaTabla('Contactos ficha');
  await page.goto(`/w/${ESPACIO}/db/${dbId}`);

  // La tabla existe —es lo correcto en escritorio— pero aquí no se enseña.
  await expect(page.locator('table')).toBeHidden();

  const ficha = page.locator('article', { hasText: 'Acme Corp' }).first();
  await expect(ficha).toBeVisible();

  // La primera columna identifica la fila: va de título.
  await expect(ficha.locator('h3')).toHaveText(/Acme Corp/);

  // Y la ficha cabe en la pantalla, sin desplazamiento horizontal.
  const caja = await ficha.boundingBox();
  expect(caja!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('los campos que sobran se pliegan en vez de alargar la ficha', async ({ page }) => {
  await entrar(page);
  const dbId = conUnaTabla('Contactos plegado');
  await page.goto(`/w/${ESPACIO}/db/${dbId}`);

  const ficha = page.locator('article', { hasText: 'Acme Corp' }).first();
  const plegados = ficha.locator('details');
  await expect(plegados).toHaveCount(1);

  // Seis columnas: título + tres a la vista + dos plegadas.
  await expect(plegados.locator('summary')).toContainText('2');
  await expect(ficha.getByText('Renueva en marzo')).toBeHidden();

  await plegados.locator('summary').click();
  await expect(ficha.getByText('Renueva en marzo')).toBeVisible();
});
