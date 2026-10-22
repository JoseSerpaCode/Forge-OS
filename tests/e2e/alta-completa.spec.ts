import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * El alta de tareas con todo a la vista: hora de una cifra, plantillas que
 * rellenan el formulario, archivos y puntos.
 */
const unico = () => Math.random().toString(36).slice(2, 7);

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

/** Un espacio de jose, con puntos encendidos, y el alta abierta en su tablero. */
async function conAlta(page: any) {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  const tag = `ws-alta-${unico()}`;
  const wsId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by, feat_points) VALUES (?,?,?,?,1)').run(wsId, 'Alta', tag, yo.id);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(wsId, yo.id);
  await entrar(page);
  await page.goto(`/w/${tag}/board`);
  await page.locator('#btn-new-issue').click();
  await expect(page.locator('#nueva-tarea')).toBeVisible();
  return { db, wsId };
}

const fila = (db: any, wsId: string, titulo: string) =>
  db.prepare('SELECT id, due_time, story_points FROM issues WHERE workspace_id = ? AND title = ?').get(wsId, titulo) as any;

test('una hora de una cifra se acepta y se guarda con dos', async ({ page }) => {
  const { db, wsId } = await conAlta(page);
  // Sin «Más opciones»: la fecha y la hora están a la vista.
  await expect(page.locator('#nt-hora')).toBeVisible();
  await page.fill('#nt-linea', 'Parcial final');
  await page.fill('#nt-fecha-texto', '09/11/2026');
  await page.locator('#nt-fecha-texto').blur();
  await page.fill('#nt-hora', '9:00');
  await page.locator('#nt-crear').click();
  await expect.poll(() => fila(db, wsId, 'Parcial final')?.due_time ?? null).toBe('09:00');
});

test('una hora que no es hora se dice junto al campo y no se crea nada', async ({ page }) => {
  const { db, wsId } = await conAlta(page);
  await page.fill('#nt-linea', 'Hora rota');
  await page.fill('#nt-fecha-texto', '09/11/2026');
  await page.locator('#nt-fecha-texto').blur();
  await page.fill('#nt-hora', '25:00');
  await page.locator('#nt-crear').click();
  await expect(page.locator('#nt-hora-error')).toBeVisible();
  await expect(page.locator('#nueva-tarea')).toBeVisible();
  expect(fila(db, wsId, 'Hora rota')).toBeUndefined();
});

test('una plantilla de serie rellena el formulario, y sus pasos llegan como subtareas', async ({ page }) => {
  const { db, wsId } = await conAlta(page);
  // Las de serie están aunque el espacio no tenga ninguna guardada.
  await page.selectOption('#nt-plantilla', 's:entrega');
  await expect(page.locator('#nt-linea')).not.toHaveValue('');
  await expect(page.locator('#nt-hora')).toHaveValue('23:59');
  await expect(page.locator('#nt-fecha')).not.toHaveValue('');
  await expect(page.locator('#nt-plantilla-resumen')).toBeVisible();

  // Se ajusta antes de crear: el título es de quien crea.
  const titulo = `Taller ${unico()}`;
  await page.fill('#nt-linea', titulo);
  await page.locator('#nt-crear').click();

  await expect.poll(() => fila(db, wsId, titulo)?.id ?? null).not.toBeNull();
  const { id } = fila(db, wsId, titulo);
  await expect.poll(() => (db.prepare('SELECT COUNT(*) AS n FROM issues WHERE parent_issue_id = ?').get(id) as any).n).toBe(4);
});

test('los archivos elegidos al crear se suben a la tarea, y los puntos se guardan', async ({ page }) => {
  const { db, wsId } = await conAlta(page);
  const titulo = `Con archivo ${unico()}`;
  await page.fill('#nt-linea', titulo);
  await page.fill('#nt-puntos', '3');
  await page.setInputFiles('#nt-archivos', { name: 'enunciado.txt', mimeType: 'text/plain', buffer: Buffer.from('Leer los capítulos 3 y 4.') });
  await expect(page.locator('#nt-archivos-lista li')).toHaveCount(1);
  await page.locator('#nt-crear').click();

  await expect.poll(() => fila(db, wsId, titulo)?.id ?? null).not.toBeNull();
  const tarea = fila(db, wsId, titulo);
  expect(tarea.story_points).toBe(3);
  await expect.poll(() => (db.prepare("SELECT COUNT(*) AS n FROM attachments WHERE entity_type = 'issue' AND entity_id = ?").get(tarea.id) as any).n).toBe(1);
});
