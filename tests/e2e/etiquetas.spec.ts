import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Etiquetas: endpoints y pantalla.
 *
 * La frontera que importa es la del espacio, y en dos sitios a la vez: la
 * etiqueta y la cosa etiquetada tienen que ser **las dos** de aquí. Con una
 * sola de las dos comprobaciones se podría colgar una etiqueta propia de un
 * ticket ajeno —y saldría en el tablero de otro equipo— o usar la etiqueta de
 * otro equipo en un ticket propio.
 *
 * En serie: todos los casos usan el mismo espacio de auditoría y la limpieza de
 * uno borraría las etiquetas que otro acaba de crear.
 */

test.describe.configure({ mode: 'serial' });

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const ORIGIN = { Origin: 'http://localhost:4322' };
const API = '/api/w/auditoria-ws/labels';

async function sesion(browser: any, usuario: string) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post('/api/auth/login', { data: { username: usuario, password: PW }, headers: ORIGIN });
  expect(r.ok(), `no pude entrar como ${usuario}`).toBeTruthy();
  return ctx.request;
}

function limpiar() {
  const db = getTestDb();
  db.prepare("DELETE FROM labels WHERE workspace_id IN ('ws-auditoria', (SELECT id FROM workspaces WHERE sys_tag='test-workspace'))").run();
  db.close();
}

test.afterEach(() => limpiar());

test('crear, listar, renombrar y borrar', async ({ browser }) => {
  const api = await sesion(browser, 'aud_editor');

  const creada = await api.post(API, { data: { name: 'Parcial 2', color: '#0091FF' }, headers: ORIGIN });
  expect(creada.status(), await creada.text()).toBe(201);
  const { id } = await creada.json();

  const lista = await (await api.get(API, { headers: ORIGIN })).json();
  expect(lista.find((e: any) => e.id === id)).toMatchObject({ name: 'Parcial 2', color: '#0091FF', usos: 0 });

  const cambiada = await api.fetch(API, { method: 'PATCH', data: { id, name: 'Parcial II' }, headers: ORIGIN });
  expect(cambiada.status()).toBe(200);

  const borrada = await api.fetch(API, { method: 'DELETE', data: { id }, headers: ORIGIN });
  expect(borrada.status()).toBe(200);
  expect((await (await api.get(API, { headers: ORIGIN })).json())).toHaveLength(0);
});

test('el mismo nombre dos veces se rechaza con un motivo', async ({ browser }) => {
  const api = await sesion(browser, 'aud_editor');
  await api.post(API, { data: { name: 'Repetida' }, headers: ORIGIN });

  const otra = await api.post(API, { data: { name: 'repetida' }, headers: ORIGIN });
  expect(otra.status()).toBe(400);
  expect((await otra.json()).error_code).toBe('duplicate');
});

test('un color que no es de la paleta no entra', async ({ browser }) => {
  const api = await sesion(browser, 'aud_editor');
  const r = await api.post(API, { data: { name: 'Rara', color: 'red;background:url(x)' }, headers: ORIGIN });
  expect(r.status()).toBe(400);
  expect((await r.json()).error_code).toBe('bad_color');
});

test('quien solo mira, lee pero no escribe', async ({ browser }) => {
  const editor = await sesion(browser, 'aud_editor');
  await editor.post(API, { data: { name: 'Visible' }, headers: ORIGIN });

  const viewer = await sesion(browser, 'aud_viewer');
  expect((await viewer.get(API, { headers: ORIGIN })).status()).toBe(200);
  expect((await viewer.post(API, { data: { name: 'No debería' }, headers: ORIGIN })).status()).toBe(403);
});

test('quien no es miembro recibe 404, no 403', async ({ browser }) => {
  const api = await sesion(browser, 'aud_fuera');
  for (const metodo of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
    const r = await api.fetch(API, { method: metodo, data: { name: 'x', id: 'x' }, headers: ORIGIN });
    expect(r.status(), metodo).toBe(404);
  }
});

test('no se puede etiquetar un ticket de otro espacio', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const { id } = await (await api.post(API, { data: { name: 'Mía' }, headers: ORIGIN })).json();

  const db = getTestDb();
  const otro = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  db.prepare(
    "INSERT OR IGNORE INTO issues (id, workspace_id, title, type, status, reporter_id) VALUES ('i-ajeno-lbl', ?, 'Ajeno', 'task', 'todo', 'test-user-jose')"
  ).run(otro.id);
  db.close();

  const r = await api.post(`${API}/assign`, {
    data: { label_id: id, entity_type: 'issue', entity_id: 'i-ajeno-lbl' }, headers: ORIGIN,
  });
  expect(r.status()).toBe(400);
  expect((await r.json()).error_code).toBe('entity_not_here');
});

test('no se puede usar la etiqueta de otro espacio en un ticket propio', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');

  const db = getTestDb();
  const otro = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES ('lbl-ajena', ?, 'Ajena', '#8B8D98')").run(otro.id);
  db.close();

  const r = await api.post(`${API}/assign`, {
    data: { label_id: 'lbl-ajena', entity_type: 'issue', entity_id: 'i-auditoria' }, headers: ORIGIN,
  });
  expect(r.status()).toBe(400);
  expect((await r.json()).error_code).toBe('label_not_here');
});

test('poner y quitar devuelve la lista que queda', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const { id } = await (await api.post(API, { data: { name: 'Puesta' }, headers: ORIGIN })).json();

  const puesta = await api.post(`${API}/assign`, {
    data: { label_id: id, entity_type: 'issue', entity_id: 'i-auditoria' }, headers: ORIGIN,
  });
  expect(puesta.status()).toBe(200);
  expect((await puesta.json()).labels.map((e: any) => e.name)).toEqual(['Puesta']);

  // La misma etiqueta también vale para una página: ese es el punto de que
  // sean del espacio y no del tablero.
  const enPagina = await api.post(`${API}/assign`, {
    data: { label_id: id, entity_type: 'page', entity_id: 'p-auditoria' }, headers: ORIGIN,
  });
  expect(enPagina.status()).toBe(200);

  const quitada = await api.fetch(`${API}/assign`, {
    method: 'DELETE', data: { label_id: id, entity_type: 'issue', entity_id: 'i-auditoria' }, headers: ORIGIN,
  });
  expect(quitada.status()).toBe(200);
  expect((await quitada.json()).labels).toEqual([]);
});

test('un tipo de entidad inventado no pasa', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const { id } = await (await api.post(API, { data: { name: 'X' }, headers: ORIGIN })).json();

  for (const tipo of ['users', 'workspaces', 'constructor', '']) {
    const r = await api.post(`${API}/assign`, {
      data: { label_id: id, entity_type: tipo, entity_id: 'i-auditoria' }, headers: ORIGIN,
    });
    expect(r.status(), tipo).toBe(400);
    expect((await r.json()).error_code).toBe('bad_entity_type');
  }
});

test('el tablero filtra por etiqueta, y una etiqueta ajena no vacía el tablero', async ({ browser, page }) => {
  const api = await sesion(browser, 'aud_owner');
  const { id } = await (await api.post(API, { data: { name: 'Filtrable' }, headers: ORIGIN })).json();
  await api.post(`${API}/assign`, {
    data: { label_id: id, entity_type: 'issue', entity_id: 'i-auditoria' }, headers: ORIGIN,
  });

  await page.goto('/login');
  await page.fill('input[name="username"]', 'aud_owner');
  await page.fill('input[name="password"]', PW);
  await page.click('button.af-submit');
  await page.waitForURL(/\/$/);

  // Con el filtro puesto se ve el ticket etiquetado.
  await page.goto(`/w/auditoria-ws/board?label=${id}`);
  await expect(page.locator('#i-auditoria')).toBeVisible();
  await expect(page.locator('#i-auditoria .card-labels')).toContainText('Filtrable');

  // Con un id que no es de este espacio, el filtro se ignora en vez de fingir
  // un tablero vacío.
  await page.goto('/w/auditoria-ws/board?label=lbl-que-no-existe');
  await expect(page.locator('#i-auditoria')).toBeVisible();
});
