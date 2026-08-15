import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Columna de tipo archivo en las bases dinámicas.
 *
 * La idea es **no duplicar**: en vez de un sistema de archivos dentro del
 * módulo de bases de datos, una columna que apunta a un archivo de la sección
 * de Archivos. Los archivos viven en un sitio y la tabla los referencia.
 *
 * Lo que hay que vigilar es el id que se guarda: si no se comprueba contra el
 * espacio, una fila podría apuntar a un archivo de otro equipo y la tabla
 * enseñaría su nombre a quien no debería verlo.
 */

test.describe.configure({ mode: 'serial' });

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const ORIGIN = { Origin: 'http://localhost:4322' };
const WS = 'ws-tablas';

async function sesion(browser: any, usuario: string) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post('/api/auth/login', { data: { username: usuario, password: PW }, headers: ORIGIN });
  expect(r.ok()).toBeTruthy();
  return ctx.request;
}

function preparar() {
  const db = getTestDb();
  const otro = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;

  db.prepare(`INSERT OR REPLACE INTO drive_files (id, workspace_id, drive_id, name, web_view_link, uploaded_by)
              VALUES ('f-col', ?, 'd-col', 'Anexo.pdf', 'https://drive.google.com/file/d/d-col/view', 'aud-owner')`).run(WS);
  db.prepare(`INSERT OR REPLACE INTO drive_files (id, workspace_id, drive_id, name, uploaded_by)
              VALUES ('f-col-ajeno', ?, 'd-col-ajeno', 'Ajeno.pdf', 'test-user-jose')`).run(otro.id);
  db.close();
}

function limpiar() {
  const db = getTestDb();
  db.prepare("DELETE FROM drive_files WHERE id IN ('f-col','f-col-ajeno')").run();
  db.prepare("DELETE FROM dynamic_databases WHERE workspace_id = ?").run(WS);
  db.close();
}

test.beforeEach(() => preparar());
test.afterEach(() => limpiar());

async function crearTabla(api: any) {
  const r = await api.post('/api/w/tablas-ws/db', {
    data: {
      name: `Entregas ${Date.now()}`,
      columns: [
        { name: 'Título', type: 'text' },
        { name: 'Adjunto', type: 'file' },
      ],
    },
    headers: ORIGIN,
  });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()).id;
}

test('el tipo archivo se guarda en el esquema', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const dbId = await crearTabla(api);

  const db = getTestDb();
  const fila = db.prepare('SELECT schema_json FROM dynamic_databases WHERE id = ?').get(dbId) as any;
  db.close();

  const columnas = JSON.parse(fila.schema_json).columns;
  expect(columnas.map((c: any) => c.type)).toEqual(['text', 'file']);
});

test('una fila puede apuntar a un archivo del espacio', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const dbId = await crearTabla(api);

  const db = getTestDb();
  const esquema = JSON.parse((db.prepare('SELECT schema_json FROM dynamic_databases WHERE id = ?').get(dbId) as any).schema_json);
  db.close();
  const colArchivo = esquema.columns.find((c: any) => c.type === 'file').id;

  const r = await api.post(`/api/w/tablas-ws/db/${dbId}/entries`, {
    data: { [colArchivo]: 'f-col' }, headers: ORIGIN,
  });
  expect(r.status(), await r.text()).toBe(201);
  expect((await r.json()).payload[colArchivo]).toBe('f-col');
});

test('no puede apuntar a un archivo de otro espacio', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const dbId = await crearTabla(api);

  const db = getTestDb();
  const esquema = JSON.parse((db.prepare('SELECT schema_json FROM dynamic_databases WHERE id = ?').get(dbId) as any).schema_json);
  db.close();
  const colArchivo = esquema.columns.find((c: any) => c.type === 'file').id;

  // El ataque concreto: guardar el id de un archivo ajeno para que la tabla
  // enseñe su nombre.
  for (const valor of ['f-col-ajeno', 'no-existe', '../../etc/passwd']) {
    const r = await api.post(`/api/w/tablas-ws/db/${dbId}/entries`, {
      data: { [colArchivo]: valor }, headers: ORIGIN,
    });
    expect(r.status(), valor).toBe(400);
  }
});

test('la tabla enseña el nombre del archivo, enlazado a Drive', async ({ browser, page }) => {
  const api = await sesion(browser, 'aud_owner');
  const dbId = await crearTabla(api);

  const db = getTestDb();
  const esquema = JSON.parse((db.prepare('SELECT schema_json FROM dynamic_databases WHERE id = ?').get(dbId) as any).schema_json);
  db.close();
  const colArchivo = esquema.columns.find((c: any) => c.type === 'file').id;
  const colTexto = esquema.columns.find((c: any) => c.type === 'text').id;

  await api.post(`/api/w/tablas-ws/db/${dbId}/entries`, {
    data: { [colTexto]: 'Práctica 1', [colArchivo]: 'f-col' }, headers: ORIGIN,
  });

  await page.goto('/login');
  await page.fill('input[name="username"]', 'aud_owner');
  await page.fill('input[name="password"]', PW);
  await page.click('button.af-submit');
  await page.waitForURL(/\/$/);

  await page.goto(`/w/tablas-ws/db/${dbId}`);
  // El id guardado no se enseña nunca: eso no le dice nada a nadie.
  await expect(page.locator('tbody')).toContainText('Anexo.pdf');
  await expect(page.locator('tbody')).not.toContainText('f-col');
  await expect(page.locator('tbody a[href^="https://drive.google.com"]')).toBeVisible();
});
