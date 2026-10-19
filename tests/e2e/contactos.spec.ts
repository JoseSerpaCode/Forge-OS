import { test, expect, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getTestDb } from './test-utils';

/**
 * Contactos sin cuenta: asignar una tarea a alguien que no está en Forge, verlo
 * en la tarjeta y en su ficha, y que nadie pueda usar los contactos de otro.
 *
 * Cuentas nuevas en cada prueba, sin administrador del sistema: `jose` entra en
 * todos los espacios y taparía los fallos de permisos.
 */
const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const PUERTO = process.env.E2E_PORT || 4322;
const ORIGIN = { Origin: `http://localhost:${PUERTO}` };
const RUN = Math.random().toString(36).slice(2, 8);

function escenario() {
  const db = getTestDb();
  const sufijo = `${RUN}${Math.random().toString(36).slice(2, 6)}`;
  const crear = (n: string) => {
    const id = `u-${n}-${sufijo}`;
    db.prepare('INSERT INTO users (id, username, password_hash, is_sysadmin) VALUES (?, ?, ?, 0)').run(id, `${n}_${sufijo}`, bcrypt.hashSync(PW, 4));
    return { id, username: `${n}_${sufijo}` };
  };
  const duena = crear('duena');
  const companero = crear('comp');
  const fuera = crear('fuera');
  const ws = { id: crypto.randomUUID(), sysTag: `e2e-contactos-${sufijo}` };
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(ws.id, ws.sysTag, ws.sysTag, duena.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner'), (?,?,'editor')").run(ws.id, duena.id, ws.id, companero.id);
  const tarea = crypto.randomUUID();
  db.prepare("INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, position) VALUES (?, ?, 'task', 'Póster del proyecto', ?, 'todo', 1000)").run(tarea, ws.id, duena.id);
  db.close();
  return { duena, companero, fuera, ws, tarea };
}

async function entrar(page: Page, usuario: string) {
  await page.context().addCookies([{ name: 'forge_lang', value: 'es', url: `http://localhost:${PUERTO}` }]);
  await page.goto('/login');
  await page.fill('input[name="username"]', usuario);
  await page.fill('input[name="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('asignar a un contacto nuevo desde el panel; sale en la tarjeta y en su ficha', async ({ page }) => {
  const e = escenario();
  await entrar(page, e.duena.username);
  await page.goto(`/w/${e.ws.sysTag}/board`);
  await expect(page.locator('body[data-tablero-listo="true"]')).toHaveCount(1);
  await page.locator(`.issue-card[data-issue-id="${e.tarea}"] h4`).click();

  await page.locator('#modal-issue-assignee').selectOption('__nuevo');
  await page.locator('#contacto-rapido-nombre').fill('Juan Camilo Luna');
  await page.locator('#contacto-rapido-form button[type="submit"]').click();

  const tarjeta = page.locator(`.issue-card[data-issue-id="${e.tarea}"]`).first();
  await expect(tarjeta.locator('.card-responsable')).toHaveAttribute('aria-label', 'Juan Camilo Luna');
  await expect(tarjeta.locator('.card-responsable')).toContainText('JC');

  const db = getTestDb();
  const fila = db.prepare('SELECT assignee_id, assignee_contact_id FROM issues WHERE id = ?').get(e.tarea) as any;
  db.close();
  expect(fila.assignee_id).toBeNull();
  expect(fila.assignee_contact_id).toBeTruthy();

  // Tras recargar sigue ahí: lo pinta el servidor, no solo el navegador.
  await page.reload();
  await expect(page.locator(`.issue-card[data-issue-id="${e.tarea}"] .card-responsable`).first()).toHaveAttribute('aria-label', 'Juan Camilo Luna');

  await page.goto('/contacts');
  await page.getByRole('link', { name: /Juan Camilo Luna/ }).click();
  await expect(page.getByRole('link', { name: /Póster del proyecto/ })).toBeVisible();
});

test('@nombre en el alta rápida asigna al contacto', async ({ page }) => {
  const e = escenario();
  const ctx = page.context();
  await entrar(page, e.duena.username);
  const res = await ctx.request.post('/api/contacts', { data: { name: 'Lucía Prieto' }, headers: ORIGIN });
  expect(res.status()).toBe(201);
  const lucia = await res.json();

  await page.goto(`/w/${e.ws.sysTag}/board`);
  await expect(page.locator('body[data-tablero-listo="true"]')).toHaveCount(1);
  await page.locator('#btn-new-issue').click();
  await page.locator('#nt-linea').fill('Maqueta @lucia');
  await expect(page.locator('#nt-responsable')).toHaveValue(`c:${lucia.id}`);
  await page.locator('#nt-crear').click();
  await expect.poll(() => {
    const db = getTestDb();
    const r = db.prepare("SELECT assignee_contact_id FROM issues WHERE workspace_id = ? AND title = 'Maqueta'").get(e.ws.id) as any;
    db.close();
    return r?.assignee_contact_id ?? null;
  }).toBe(lucia.id);
});

test('nadie asigna con los contactos de otro ni a cuentas de fuera del espacio', async ({ browser }) => {
  const e = escenario();
  const sesion = async (u: string) => {
    const ctx = await browser.newContext();
    const r = await ctx.request.post('/api/auth/login', { data: { username: u, password: PW }, headers: ORIGIN });
    expect(r.ok()).toBeTruthy();
    return ctx;
  };
  const duena = await sesion(e.duena.username);
  const companero = await sesion(e.companero.username);
  const patch = (ctx: any, data: unknown) => ctx.request.patch(`/api/issues/${e.tarea}`, { data, headers: ORIGIN });

  const deLaDuena = await (await duena.request.post('/api/contacts', { data: { name: 'Privado' }, headers: ORIGIN })).json();

  // El compañero no puede usar el contacto de la dueña...
  expect((await patch(companero, { assignee_contact_id: deLaDuena.id })).status()).toBe(400);
  // ...ni leer su ficha ni su libreta.
  expect((await companero.request.get(`/api/contacts/${deLaDuena.id}`)).status()).toBe(404);
  expect(((await (await companero.request.get('/api/contacts')).json()) as any[]).some((c) => c.id === deLaDuena.id)).toBe(false);
  // Control: la dueña sí.
  expect((await patch(duena, { assignee_contact_id: deLaDuena.id })).status()).toBe(200);
  expect((await duena.request.get(`/api/contacts/${deLaDuena.id}`)).status()).toBe(200);

  // Al editar tampoco se asigna a una cuenta que no es del espacio.
  expect((await patch(duena, { assignee_id: e.fuera.id })).status()).toBe(400);
  // Control: a un miembro sí.
  expect((await patch(duena, { assignee_id: e.companero.id })).status()).toBe(200);

  await duena.close();
  await companero.close();
});

test('@ en una nota menciona al contacto y la nota sale en su ficha', async ({ page }) => {
  const e = escenario();
  const pagina = crypto.randomUUID();
  const db = getTestDb();
  db.prepare("INSERT INTO pages (id, workspace_id, title, created_by, content_json) VALUES (?, ?, 'Acta de grupo', ?, ?)")
    .run(pagina, e.ws.id, e.duena.id, JSON.stringify({ format: 'tiptap', doc: { type: 'doc', content: [{ type: 'paragraph' }] } }));
  db.close();

  await entrar(page, e.duena.username);
  const c = await (await page.context().request.post('/api/contacts', { data: { name: 'Sofía Ríos' }, headers: ORIGIN })).json();

  await page.goto(`/w/${e.ws.sysTag}/p/${pagina}`);
  const editor = page.locator('#page-editor .ProseMirror');
  await editor.click();
  await page.keyboard.type('Repartir con @sof');
  await expect(page.locator('.note-slash-menu [role="option"]')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(editor.locator('.note-mention')).toHaveText('@Sofía Ríos');
  await expect(page.locator('#save-status')).toHaveText(/^(Saved|Guardado)$/, { timeout: 6000 });

  await page.goto(`/contacts/${c.id}`);
  await expect(page.getByRole('link', { name: /Acta de grupo/ })).toBeVisible();
});
