import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Archivos sobre Drive: endpoints.
 *
 * Lo que hay que vigilar es qué se le entrega al navegador y qué se le cree.
 *
 *  - **No se le entrega el token de acceso.** Sería una llave que abre todo lo
 *    que la aplicación ha creado en ese Drive, incluidos los archivos de los
 *    demás. Se le entrega la URL de una sesión de subida, que sirve para una
 *    subida y para nada más.
 *  - **No se le cree cuando dice «ya lo he subido».** El id que manda se
 *    comprueba contra Drive antes de darlo de alta; si no, cualquiera metería
 *    en la lista el id de un archivo que no salió de aquí.
 *
 * El ida y vuelta con Google no se prueba aquí: exige credenciales reales. Lo
 * que sí se prueba entero es el permiso, la frontera del espacio y que sin
 * conexión la respuesta sea clara en vez de un error a medias.
 */

test.describe.configure({ mode: 'serial' });

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const ORIGIN = { Origin: 'http://localhost:4322' };
const API = '/api/w/archivos-ws/files';
const WS = 'ws-archivos';

async function sesion(browser: any, usuario: string) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post('/api/auth/login', { data: { username: usuario, password: PW }, headers: ORIGIN });
  expect(r.ok(), `no pude entrar como ${usuario}`).toBeTruthy();
  return ctx.request;
}

function conectarAMano() {
  const db = getTestDb();
  db.prepare(`
    INSERT INTO workspace_drive (workspace_id, google_email, folder_id, folder_link, refresh_token_enc, connected_by)
    VALUES (?, 'cuenta@ejemplo.com', 'carpeta-del-espacio', 'https://drive.google.com/x', 'v1.no.es.real', 'aud-owner')
    ON CONFLICT(workspace_id) DO UPDATE SET folder_id = excluded.folder_id
  `).run(WS);
  db.close();
}

function limpiar() {
  const db = getTestDb();
  db.prepare('DELETE FROM workspace_drive WHERE workspace_id = ?').run(WS);
  db.prepare('DELETE FROM drive_files WHERE workspace_id = ?').run(WS);
  db.prepare('DELETE FROM drive_folders WHERE workspace_id = ?').run(WS);
  db.close();
}

test.afterEach(() => limpiar());

test('sin Drive conectado, subir dice que no hay conexión', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const r = await api.post(`${API}/upload`, {
    data: { name: 'apuntes.pdf', size: 1024, mime_type: 'application/pdf' }, headers: ORIGIN,
  });
  expect(r.status()).toBe(409);
  expect((await r.json()).error_code).toBe('not_connected');
});

test('quien solo mira, lista pero no sube ni crea carpetas', async ({ browser }) => {
  conectarAMano();
  const api = await sesion(browser, 'aud_viewer');

  expect((await api.get(API, { headers: ORIGIN })).status()).toBe(200);
  expect((await api.post(API, { data: { name: 'Mía' }, headers: ORIGIN })).status()).toBe(403);
  expect((await api.post(`${API}/upload`, { data: { name: 'x.pdf', size: 1 }, headers: ORIGIN })).status()).toBe(403);
});

test('quien no es miembro recibe 404, no 403', async ({ browser }) => {
  conectarAMano();
  const api = await sesion(browser, 'aud_fuera');
  for (const ruta of [API, `${API}/upload`]) {
    const r = await api.get(ruta, { headers: ORIGIN });
    expect(r.status(), ruta).toBe(404);
  }
});

test('un archivo demasiado grande se rechaza antes de empezar', async ({ browser }) => {
  conectarAMano();
  const api = await sesion(browser, 'aud_owner');

  // Se rechaza por el tamaño declarado, sin abrir sesión en Drive: no tiene
  // sentido empezar una subida que no va a poder terminar.
  const r = await api.post(`${API}/upload`, {
    data: { name: 'enorme.zip', size: 600 * 1024 * 1024 }, headers: ORIGIN,
  });
  expect(r.status()).toBe(413);
  expect((await r.json()).error_code).toBe('too_large');
});

test('un nombre que es solo barras no vale', async ({ browser }) => {
  conectarAMano();
  const api = await sesion(browser, 'aud_owner');
  for (const nombre of ['///', '..', '   ', '']) {
    const r = await api.post(`${API}/upload`, { data: { name: nombre, size: 10 }, headers: ORIGIN });
    expect(r.status(), JSON.stringify(nombre)).toBe(400);
    expect((await r.json()).error_code).toBe('bad_name');
  }
});

test('no se puede subir a una carpeta de otro espacio', async ({ browser }) => {
  conectarAMano();

  const db = getTestDb();
  const otro = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  db.prepare(
    "INSERT INTO drive_folders (id, workspace_id, name, drive_id) VALUES ('carpeta-ajena', ?, 'Ajena', 'd-ajena')"
  ).run(otro.id);
  db.close();

  const api = await sesion(browser, 'aud_owner');
  const r = await api.post(`${API}/upload`, {
    data: { name: 'x.pdf', size: 10, folder_id: 'carpeta-ajena' }, headers: ORIGIN,
  });
  expect(r.status()).toBe(404);
  expect((await r.json()).error_code).toBe('folder_not_found');

  const db2 = getTestDb();
  db2.prepare("DELETE FROM drive_folders WHERE id = 'carpeta-ajena'").run();
  db2.close();
});

test('el alta de un archivo no se fía del navegador', async ({ browser }) => {
  conectarAMano();
  const api = await sesion(browser, 'aud_owner');

  // Sin poder hablar con Drive no se da nada de alta. Lo que **no** puede pasar
  // es que un id inventado entre en la lista por decirlo el cliente.
  const r = await api.fetch(`${API}/upload`, {
    method: 'PUT', data: { drive_id: 'id-inventado' }, headers: ORIGIN,
  });
  expect([400, 502]).toContain(r.status());

  const db = getTestDb();
  const filas = db.prepare('SELECT COUNT(*) AS n FROM drive_files WHERE workspace_id = ?').get(WS) as any;
  db.close();
  expect(filas.n).toBe(0);
});

test('listar no filtra por carpeta ajena', async ({ browser }) => {
  conectarAMano();
  const api = await sesion(browser, 'aud_owner');

  const r = await api.get(`${API}?folder=no-existe`, { headers: ORIGIN });
  expect(r.status()).toBe(404);
  expect((await r.json()).error_code).toBe('folder_not_found');
});

test('quitar un archivo que no es de este espacio da 404', async ({ browser }) => {
  conectarAMano();

  const db = getTestDb();
  const otro = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'test-workspace'").get() as any;
  db.prepare(
    "INSERT INTO drive_files (id, workspace_id, drive_id, name) VALUES ('f-ajeno', ?, 'd-ajeno', 'Ajeno.pdf')"
  ).run(otro.id);
  db.close();

  const api = await sesion(browser, 'aud_owner');
  const r = await api.fetch(API, { method: 'DELETE', data: { id: 'f-ajeno' }, headers: ORIGIN });
  expect(r.status()).toBe(404);

  const db2 = getTestDb();
  const sigue = db2.prepare("SELECT 1 FROM drive_files WHERE id='f-ajeno'").get();
  db2.prepare("DELETE FROM drive_files WHERE id='f-ajeno'").run();
  db2.close();
  expect(sigue, 'no debería haberse tocado el archivo del otro espacio').toBeTruthy();
});

test('la lista enseña los archivos, y el token no sale por ningún lado', async ({ browser, page }) => {
  conectarAMano();

  const db = getTestDb();
  db.prepare(`
    INSERT INTO drive_files (id, workspace_id, drive_id, name, mime_type, size_bytes, web_view_link, uploaded_by)
    VALUES ('f-1', ?, 'd-1', 'Apuntes.pdf', 'application/pdf', 2048, 'https://drive.google.com/file/d/d-1/view', 'aud-owner')
  `).run(WS);
  db.close();

  const api = await sesion(browser, 'aud_owner');
  const cuerpo = await (await api.get(API, { headers: ORIGIN })).text();
  expect(JSON.parse(cuerpo).files[0]).toMatchObject({ name: 'Apuntes.pdf', driveId: 'd-1' });
  expect(cuerpo).not.toContain('refresh');
  expect(cuerpo).not.toContain('v1.no.es.real');

  await page.goto('/login');
  await page.fill('input[name="username"]', 'aud_owner');
  await page.fill('input[name="password"]', PW);
  await page.click('button.af-submit');
  await page.waitForURL(/\/$/);

  await page.goto('/w/archivos-ws/files');
  await expect(page.getByText('Apuntes.pdf')).toBeVisible();
  // El enlace lleva a Drive, no a este servidor: los bytes no pasan por aquí.
  await expect(page.locator('a[href^="https://drive.google.com"]').first()).toBeVisible();
  // Y en el HTML no viaja nada que parezca una credencial.
  const html = await page.content();
  expect(html).not.toContain('v1.no.es.real');
  expect(html).not.toMatch(/ya29\./);
});

test('crear una carpeta no usa un diálogo del navegador', async ({ page }) => {
  conectarAMano();

  await page.goto('/login');
  await page.fill('input[name="username"]', 'aud_owner');
  await page.fill('input[name="password"]', PW);
  await page.click('button.af-submit');
  await page.waitForURL(/\/$/);
  await page.goto('/w/archivos-ws/files');

  // Si apareciera un `prompt()` del navegador, esto lo cazaría: sin manejador,
  // Playwright los descarta y el flujo se quedaría a medias en silencio —que es
  // exactamente lo que le pasa a alguien que ya le dijo al navegador que no
  // quiere más diálogos de esta página.
  let hubo = false;
  page.on('dialog', (d) => { hubo = true; d.dismiss(); });

  const boton = page.locator('#btn-nueva-carpeta');
  if (!(await boton.count())) return; // sin credenciales de Google no se ofrece

  await boton.click();
  await expect(page.locator('#form-carpeta')).toBeVisible();
  await page.fill('#nombre-carpeta', 'Apuntes');
  expect(hubo, 'no debería salir un diálogo del navegador').toBe(false);
});

test('la búsqueda encuentra por trozo del nombre y recuerda la consulta', async ({ browser }) => {
  conectarAMano();

  const db = getTestDb();
  db.prepare(`
    INSERT INTO drive_files (id, workspace_id, drive_id, name, uploaded_by)
    VALUES ('f-lab', ?, 'd-lab', 'Guía de laboratorio 4.pdf', 'aud-owner')
  `).run(WS);
  db.prepare(`
    INSERT INTO drive_files (id, workspace_id, drive_id, name, uploaded_by)
    VALUES ('f-otro', ?, 'd-otro', 'Presentación.pptx', 'aud-owner')
  `).run(WS);
  db.close();

  const api = await sesion(browser, 'aud_owner');

  const r = await api.get(`${API}/search?q=laboratorio`, { headers: ORIGIN });
  expect(r.status()).toBe(200);
  const datos = await r.json();
  expect(datos.files.map((f: any) => f.name)).toEqual(['Guía de laboratorio 4.pdf']);
  expect(datos.history).toContain('laboratorio');

  // Sin texto se devuelve el historial, que es lo que hace falta para enseñar
  // sugerencias nada más abrir el buscador.
  const vacia = await api.get(`${API}/search`, { headers: ORIGIN });
  const sinTexto = await vacia.json();
  expect(sinTexto.files).toEqual([]);
  expect(sinTexto.history).toContain('laboratorio');

  // El historial es de cada quien: otra persona no ve el mío.
  const otra = await sesion(browser, 'aud_editor');
  expect((await (await otra.get(`${API}/search`, { headers: ORIGIN })).json()).history).toEqual([]);

  // Y se puede olvidar.
  expect((await api.fetch(`${API}/search`, { method: 'DELETE', headers: ORIGIN })).status()).toBe(200);
  expect((await (await api.get(`${API}/search`, { headers: ORIGIN })).json()).history).toEqual([]);

  const db2 = getTestDb();
  db2.prepare('DELETE FROM file_searches').run();
  db2.close();
});

test('adjuntar un archivo a una tarea le pasa sus etiquetas', async ({ browser }) => {
  conectarAMano();

  const db = getTestDb();
  db.prepare(`INSERT INTO drive_files (id, workspace_id, drive_id, name, uploaded_by)
              VALUES ('f-guia', ?, 'd-guia', 'Guia.pdf', 'aud-owner')`).run(WS);
  db.prepare(`INSERT INTO issues (id, workspace_id, title, type, status, reporter_id)
              VALUES ('i-arch', ?, 'Práctica', 'task', 'todo', 'aud-owner')`).run(WS);
  db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES ('l-arch', ?, 'Parcial 2', '#0091FF')").run(WS);
  db.prepare("INSERT INTO issue_labels (issue_id, label_id) VALUES ('i-arch', 'l-arch')").run();
  db.close();

  const api = await sesion(browser, 'aud_owner');
  const r = await api.post(`${API}/link`, {
    data: { file_id: 'f-guia', entity_type: 'issue', entity_id: 'i-arch' }, headers: ORIGIN,
  });
  expect(r.status()).toBe(200);

  const datos = await r.json();
  expect(datos.inherited).toBe(1);
  expect(datos.labels.map((e: any) => e.name)).toEqual(['Parcial 2']);
  expect(datos.files.map((f: any) => f.id)).toEqual(['f-guia']);

  const db2 = getTestDb();
  db2.prepare("DELETE FROM issues WHERE id='i-arch'").run();
  db2.prepare("DELETE FROM labels WHERE id='l-arch'").run();
  db2.close();
});

test('no se puede colgar un archivo de un ticket de otro espacio', async ({ browser }) => {
  conectarAMano();

  const db = getTestDb();
  db.prepare(`INSERT INTO drive_files (id, workspace_id, drive_id, name, uploaded_by)
              VALUES ('f-mio', ?, 'd-mio', 'Mio.pdf', 'aud-owner')`).run(WS);
  db.close();

  const api = await sesion(browser, 'aud_owner');
  const r = await api.post(`${API}/link`, {
    data: { file_id: 'f-mio', entity_type: 'issue', entity_id: 'i-auditoria' }, headers: ORIGIN,
  });
  expect(r.status()).toBe(400);
  expect((await r.json()).error_code).toBe('entity_not_here');
});

test('buscar y volver no deja muertos los selectores de etiqueta', async ({ page }) => {
  conectarAMano();

  const db = getTestDb();
  db.prepare(`INSERT INTO drive_files (id, workspace_id, drive_id, name, uploaded_by)
              VALUES ('f-vivo', ?, 'd-vivo', 'Guía de laboratorio.pdf', 'aud-owner')`).run(WS);
  db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES ('l-vivo', ?, 'Prácticas', '#30A46C')").run(WS);
  db.close();

  await page.goto('/login');
  await page.fill('input[name="username"]', 'aud_owner');
  await page.fill('input[name="password"]', PW);
  await page.click('button.af-submit');
  await page.waitForURL(/\/$/);
  await page.goto('/w/archivos-ws/files');

  const picker = page.locator('.forge-label-picker').first();
  await expect(picker).toBeVisible();

  // Buscar y volver. Antes esto reescribía el contenido de la lista, y los
  // selectores quedaban pintados pero sin escuchadores: parecían funcionar y
  // no hacían nada.
  await page.fill('#buscador-archivos', 'laboratorio');
  await expect(page.locator('#resultados-busqueda .archivo-fila')).toHaveCount(1);
  await page.fill('#buscador-archivos', '');
  await expect(page.locator('#lista-archivos')).toBeVisible();

  await picker.locator('.lp-toggle').click();
  await expect(picker.locator('.lp-option')).toHaveCount(1);
  await picker.locator('.lp-option').first().click();
  await expect(picker.locator('.lp-chips')).toContainText('Prácticas');

  const db2 = getTestDb();
  db2.prepare("DELETE FROM labels WHERE id='l-vivo'").run();
  db2.close();
});

test('adjuntar desde la tarea, con el ratón, y ver la herencia', async ({ page }) => {
  conectarAMano();

  const db = getTestDb();
  db.prepare(`INSERT INTO drive_files (id, workspace_id, drive_id, name, web_view_link, uploaded_by)
              VALUES ('f-ui', ?, 'd-ui', 'Guía de laboratorio.pdf', 'https://drive.google.com/file/d/d-ui/view', 'aud-owner')`).run(WS);
  db.prepare(`INSERT INTO issues (id, workspace_id, title, type, status, reporter_id, position)
              VALUES ('i-ui', ?, 'Práctica con archivo', 'task', 'todo', 'aud-owner', 1000)`).run(WS);
  db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES ('l-ui', ?, 'Parcial 2', '#0091FF')").run(WS);
  db.prepare("INSERT INTO issue_labels (issue_id, label_id) VALUES ('i-ui', 'l-ui')").run();
  db.close();

  await page.goto('/login');
  await page.fill('input[name="username"]', 'aud_owner');
  await page.fill('input[name="password"]', PW);
  await page.click('button.af-submit');
  await page.waitForURL(/\/$/);

  await page.goto('/w/archivos-ws/board');
  await page.locator('#i-ui').click();

  // Una sola lista para los dos orígenes: los adjuntos del servidor y los del
  // Drive. Antes eran dos secciones, y elegir entre ellas no era asunto de
  // quien usa la aplicación.
  await expect(page.locator('#issue-files')).toContainText(/No files yet|Todavía no hay archivos/);

  await page.locator('#btn-drive-attach').click();
  await page.fill('#drive-attach-search', 'laboratorio');
  await expect(page.locator('#drive-attach-results button')).toHaveCount(1);
  await page.locator('#drive-attach-results button').first().click();

  await expect(page.locator('#issue-files')).toContainText('Guía de laboratorio.pdf');
  // Y el distintivo que dice de dónde sale, que es lo único que cambia para
  // quien mira: ese se abre en Drive y lo ve todo el espacio.
  await expect(page.locator('#issue-files')).toContainText(/Drive/i);

  // Lo que importa: la etiqueta del ticket ha pasado al archivo.
  await expect(async () => {
    const db2 = getTestDb();
    const heredadas = db2.prepare("SELECT label_id FROM file_labels WHERE file_id = 'f-ui'").all() as any[];
    db2.close();
    expect(heredadas.map((f) => f.label_id)).toEqual(['l-ui']);
  }).toPass({ timeout: 5000 });

  const db3 = getTestDb();
  db3.prepare("DELETE FROM issues WHERE id='i-ui'").run();
  db3.prepare("DELETE FROM labels WHERE id='l-ui'").run();
  db3.close();
});

test('el script del modal del ticket llega a ejecutarse', async ({ page }) => {
  // Guarda contra un fallo que no da la cara: si el marcado del componente
  // queda descompensado —un `</div>` de más—, Astro deja de emitir su
  // `<script>` **por completo**. La página carga, el modal se abre, y nada
  // dentro funciona: ni etiquetas, ni archivos, ni cronómetro. Sin un solo
  // error en consola, porque el código sencillamente no está.
  await page.goto('/login');
  await page.fill('input[name="username"]', 'aud_owner');
  await page.fill('input[name="password"]', PW);
  await page.click('button.af-submit');
  await page.waitForURL(/\/$/);
  await page.goto('/w/archivos-ws/board');

  const vivas = await page.evaluate(() => ({
    archivos: typeof (window as any).loadIssueAttachments,
    etiquetas: typeof (window as any).forgeLabelsOpen,
    drive: typeof (window as any).forgeDriveFilesOpen,
  }));
  expect(vivas).toEqual({ archivos: 'function', etiquetas: 'function', drive: 'function' });
});
