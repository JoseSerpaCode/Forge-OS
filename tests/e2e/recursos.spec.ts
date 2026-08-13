import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Endpoints de Recursos.
 *
 * Lo que hay que vigilar aquí es la frontera entre espacios. El espacio sale de
 * la **ruta**, nunca del cuerpo: aceptarlo del cuerpo sería dejar escribir en
 * el espacio de otro equipo mandando su id. Y un recurso solo puede colgarse de
 * una entidad del mismo espacio, o aparecería en el panel de gente que no lo
 * puso.
 */

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const ORIGIN = { Origin: 'http://localhost:4322' };

async function sesion(browser: any, usuario: string) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post('/api/auth/login', { data: { username: usuario, password: PW }, headers: ORIGIN });
  expect(r.ok(), `no pude entrar como ${usuario}`).toBeTruthy();
  return ctx.request;
}

test('crear, listar y archivar un recurso', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const url = `https://ejemplo.com/doc-${Date.now()}`;

  const creado = await api.post('/api/w/auditoria-ws/resources', {
    data: { type: 'link', title: 'Documentación', url }, headers: ORIGIN,
  });
  expect(creado.status(), await creado.text()).toBe(201);
  const { id } = await creado.json();

  const lista = await api.get('/api/w/auditoria-ws/resources');
  expect((await lista.json()).some((r: any) => r.id === id)).toBeTruthy();

  const borrado = await api.fetch('/api/w/auditoria-ws/resources', {
    method: 'DELETE', data: { id }, headers: ORIGIN,
  });
  expect(borrado.status()).toBe(200);

  const db = getTestDb();
  const fila = db.prepare('SELECT archived_at FROM resources WHERE id = ?').get(id) as any;
  db.close();
  // Archivado, no borrado: si desapareciera de la tabla, la próxima ingesta
  // automática lo recrearía y quitarlo no habría servido de nada.
  expect(fila.archived_at).toBeTruthy();
});

test('el mismo enlace dos veces no crea un duplicado, y se dice', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const url = `https://ejemplo.com/repetido-${Date.now()}`;

  const a = await api.post('/api/w/auditoria-ws/resources', { data: { type: 'link', title: 'Uno', url }, headers: ORIGIN });
  expect(a.status()).toBe(201);

  // La misma URL con envoltura distinta: www, barra final y parámetro de rastreo.
  const b = await api.post('/api/w/auditoria-ws/resources', {
    data: { type: 'link', title: 'Otra vez', url: url.replace('https://', 'https://www.') + '/?utm_source=slack' },
    headers: ORIGIN,
  });
  // 200 y no 201: no se ha creado nada, y la pantalla necesita saberlo para
  // avisar en vez de fingir un alta.
  expect(b.status()).toBe(200);
  const cuerpo = await b.json();
  expect(cuerpo.already_existed).toBe(true);
  expect(cuerpo.id).toBe((await a.json()).id);
});

test('nadie de fuera lee ni escribe recursos del espacio', async ({ browser }) => {
  const dentro = await sesion(browser, 'aud_owner');
  const fuera = await sesion(browser, 'aud_fuera');
  const viewer = await sesion(browser, 'aud_viewer');

  // Control: quien está dentro sí puede.
  expect((await dentro.get('/api/w/auditoria-ws/resources')).status()).toBe(200);

  expect((await fuera.get('/api/w/auditoria-ws/resources')).status()).toBe(404);
  expect((await fuera.post('/api/w/auditoria-ws/resources', {
    data: { type: 'note', title: 'Intruso' }, headers: ORIGIN,
  })).status()).toBe(404);

  // Quien solo mira, mira.
  expect((await viewer.get('/api/w/auditoria-ws/resources')).status()).toBe(200);
  expect((await viewer.post('/api/w/auditoria-ws/resources', {
    data: { type: 'note', title: 'No debería' }, headers: ORIGIN,
  })).status()).toBe(403);
});

test('no se puede colgar un recurso de una entidad de otro espacio', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');

  const db = getTestDb();
  const otro = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  db.prepare(
    "INSERT OR IGNORE INTO issues (id, workspace_id, title, type, status, reporter_id) VALUES ('i-ajeno-res', ?, 'Ajeno', 'task', 'todo', 'test-user-jose')"
  ).run(otro.id);
  db.close();

  const res = await api.post('/api/w/auditoria-ws/resources', {
    data: { type: 'note', title: 'Colado', entity_type: 'issue', entity_id: 'i-ajeno-res' },
    headers: ORIGIN,
  });
  expect(res.status(), 'un issue de otro espacio no es sitio para esto').toBe(400);
  expect((await res.json()).error_code).toBe('entity_not_here');
});

test('rechaza tipos y URLs que no valen', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const malo = (data: any) => api.post('/api/w/auditoria-ws/resources', { data, headers: ORIGIN });

  expect((await malo({ type: 'invento', title: 'X' })).status()).toBe(400);
  expect((await malo({ type: 'link', title: '' })).status()).toBe(400);
  expect((await malo({ type: 'link', title: 'Sin url' })).status()).toBe(400);
  // Un esquema ejecutable no es un enlace: además de no normalizarse, no debe
  // llegar nunca a una cola que lo vaya a pedir.
  expect((await malo({ type: 'link', title: 'Trampa', url: 'javascript:alert(1)' })).status()).toBe(400);
});
