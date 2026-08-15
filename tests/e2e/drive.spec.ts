import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Endpoints de la conexión con Drive.
 *
 * Lo que hay que vigilar aquí es **quién puede conectar**. Lo que se ata al
 * espacio es el Drive personal de alguien, con su cuota y sus archivos: si un
 * editor de paso pudiera enchufarlo —o desenchufar el de otro— estaría tomando
 * una decisión que no le corresponde y que además tiene efectos fuera de Forge.
 *
 * No se prueba el ida y vuelta con Google: exige credenciales reales y una
 * cuenta de verdad. Lo que sí se prueba entero es el permiso, la frontera entre
 * espacios y que el token nunca sale por la API.
 *
 * En serie a propósito: hay **una sola fila** de conexión por espacio y todos
 * los casos usan el mismo espacio de auditoría, así que en paralelo se pisan —
 * la limpieza de un caso borra la conexión que otro acaba de poner.
 */

test.describe.configure({ mode: 'serial' });

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const ORIGIN = { Origin: 'http://localhost:4322' };
const WS = 'ws-auditoria';

async function sesion(browser: any, usuario: string) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post('/api/auth/login', { data: { username: usuario, password: PW }, headers: ORIGIN });
  expect(r.ok(), `no pude entrar como ${usuario}`).toBeTruthy();
  return ctx.request;
}

/** Deja una conexión falsa puesta, para probar lo que hay después de conectar. */
function conectarAMano(email = 'cuenta@ejemplo.com') {
  const db = getTestDb();
  db.prepare(`
    INSERT INTO workspace_drive (workspace_id, google_email, folder_id, folder_link, refresh_token_enc, connected_by)
    VALUES (?, ?, 'carpeta-falsa', 'https://drive.google.com/drive/folders/carpeta-falsa', 'v1.no.es.real', 'aud-owner')
    ON CONFLICT(workspace_id) DO UPDATE SET google_email = excluded.google_email
  `).run(WS, email);
  db.close();
}

function hayConexion(): boolean {
  const db = getTestDb();
  const fila = db.prepare('SELECT 1 FROM workspace_drive WHERE workspace_id = ?').get(WS);
  db.close();
  return Boolean(fila);
}

function limpiar() {
  const db = getTestDb();
  db.prepare('DELETE FROM workspace_drive WHERE workspace_id = ?').run(WS);
  db.close();
}

test.afterEach(() => limpiar());

test('solo un propietario puede conectar', async ({ browser }) => {
  for (const usuario of ['aud_viewer', 'aud_editor'] as const) {
    const api = await sesion(browser, usuario);
    const r = await api.post('/api/w/auditoria-ws/drive', { headers: ORIGIN });
    expect(r.status(), `${usuario} no debería poder conectar`).toBe(403);
  }
});

test('quien no es miembro recibe 404, no 403', async ({ browser }) => {
  // Un 403 confirmaría que el espacio existe, y eso ya es información sobre un
  // sitio donde no pinta nada.
  const api = await sesion(browser, 'aud_fuera');
  for (const metodo of ['GET', 'POST', 'DELETE'] as const) {
    const r = await api.fetch('/api/w/auditoria-ws/drive', { method: metodo, headers: ORIGIN });
    expect(r.status(), metodo).toBe(404);
  }
});

test('el propietario recibe una URL de Google con el ámbito justo', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');
  const r = await api.post('/api/w/auditoria-ws/drive', { headers: ORIGIN });

  // Sin credenciales de Google configuradas —el caso normal en pruebas— la
  // respuesta correcta es un 503 claro, no un error a medias.
  if (r.status() === 503) {
    expect((await r.json()).error_code).toBe('drive_unavailable');
    return;
  }

  expect(r.status()).toBe(200);
  const u = new URL((await r.json()).url);
  expect(u.origin).toBe('https://accounts.google.com');
  expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
  expect(u.searchParams.get('access_type')).toBe('offline');
  expect(u.searchParams.get('state')).toBeTruthy();
});

test('el estado de la conexión se ve, pero el token nunca sale', async ({ browser }) => {
  conectarAMano();

  // Un lector puede ver que hay Drive conectado y de quién es: lo necesita para
  // entender de dónde salen los archivos.
  const api = await sesion(browser, 'aud_viewer');
  const r = await api.get('/api/w/auditoria-ws/drive', { headers: ORIGIN });
  expect(r.status()).toBe(200);

  const cuerpo = await r.text();
  const datos = JSON.parse(cuerpo);
  expect(datos.connected).toBe(true);
  expect(datos.email).toBe('cuenta@ejemplo.com');
  // Ni el token ni nada que se le parezca, tampoco cifrado.
  expect(cuerpo).not.toContain('refresh');
  expect(cuerpo).not.toContain('v1.no.es.real');
});

test('desconectar es cosa del propietario, y no borra archivos', async ({ browser }) => {
  conectarAMano();

  const editor = await sesion(browser, 'aud_editor');
  const negado = await editor.fetch('/api/w/auditoria-ws/drive', { method: 'DELETE', headers: ORIGIN });
  expect(negado.status()).toBe(403);
  expect(hayConexion(), 'un editor no debería haber podido desconectar').toBe(true);

  const dueño = await sesion(browser, 'aud_owner');
  const ok = await dueño.fetch('/api/w/auditoria-ws/drive', { method: 'DELETE', headers: ORIGIN });
  expect(ok.status()).toBe(200);
  expect(hayConexion()).toBe(false);
});

test('la vuelta de Google con un estado inventado no conecta nada', async ({ browser }) => {
  const api = await sesion(browser, 'aud_owner');

  // Sin firma válida no se sabe ni a qué espacio volver, así que se sale al
  // hub. Lo importante es que no quede ninguna conexión guardada.
  const r = await api.get('/api/drive/callback?state=inventado&code=lo-que-sea', {
    headers: ORIGIN, maxRedirects: 0,
  });
  expect(r.status()).toBe(302);
  expect(r.headers()['location']).toContain('drive=bad_state');
  expect(hayConexion()).toBe(false);
});

test('la sección de archivos se ve, y dice antes de conectar lo que hay que saber', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'aud_owner');
  await page.fill('input[name="password"]', PW);
  await page.click('button.af-submit');
  await page.waitForURL(/\/$/);

  const res = await page.goto('/w/auditoria-ws/files');
  expect(res?.status()).toBe(200);

  const boton = page.locator('#btn-drive-connect');
  if (await boton.count()) {
    // Los dos avisos van a la vista **antes** del botón, no detrás de un
    // desplegable: quien conecta decide por todo el equipo y pone su propio
    // almacenamiento.
    await expect(boton).toBeVisible();
    await expect(page.getByText(/enlace|link/i).first()).toBeVisible();
    await expect(page.getByText(/almacenamiento|storage/i).first()).toBeVisible();
  } else {
    // Sin credenciales de Google no hay nada que conectar, y la pantalla lo
    // dice en lugar de ofrecer un botón que no puede funcionar.
    await expect(page.getByText(/no tiene configurada|not configured/i)).toBeVisible();
  }
});
