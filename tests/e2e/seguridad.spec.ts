import { test, expect, type APIRequestContext } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Auditoría de permisos y de las defensas del producto.
 *
 * Nace de una pasada manual contra el servidor en marcha. Dos cosas que se
 * aprendieron por el camino y que dan forma a este archivo:
 *
 *  1. **Un 404 no demuestra nada por sí solo.** Al probar «¿puede un extraño
 *     mover este ticket?» salió 404 y parecía denegado; resultó que la ruta que
 *     estaba llamando no existía —el endpoint real es PATCH y pide `position`—,
 *     así que la prueba habría pasado igual sin ninguna comprobación de
 *     permisos detrás. Por eso cada caso lleva su **control**: la misma
 *     petición desde quien sí tiene permiso, que tiene que salir bien.
 *
 *  2. **El modo de ejecución cambia las defensas.** El limitador de intentos se
 *     desactiva solo con `NODE_ENV=test`, que es el modo de esta suite. Aquí no
 *     se prueba; se prueba en `tests/rate-limit.test.ts`, forzando el modo de
 *     producción.
 */

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const ORIGIN_HEADER = { Origin: 'http://localhost:4322' };

type Sesion = { peticion: APIRequestContext };

async function sesionDe(browser: any, usuario: string): Promise<APIRequestContext> {
  const ctx = await browser.newContext();
  const res = await ctx.request.post('/api/auth/login', {
    data: { username: usuario, password: PW },
    headers: ORIGIN_HEADER,
  });
  expect(res.ok(), `no pude entrar como ${usuario}: ${await res.text()}`).toBeTruthy();
  return ctx.request;
}

test.describe('permisos por rol', () => {
  test('leer, escribir y administrar están separados por rol', async ({ browser }) => {
    const como: Record<string, APIRequestContext> = {};
    for (const u of ['aud_owner', 'aud_editor', 'aud_viewer', 'aud_fuera']) {
      como[u] = await sesionDe(browser, u);
    }

    // Mover un ticket: PATCH y con `position`. Escrito de otra forma devuelve
    // 404 para todo el mundo y la prueba deja de medir permisos.
    const mover = (u: string) =>
      como[u].fetch('/api/issues/i-auditoria/move', {
        method: 'PATCH',
        data: { status: 'done', position: 1 },
        headers: ORIGIN_HEADER,
      });

    // Control primero: si esto no pasa, el resto del caso no significa nada.
    expect((await mover('aud_owner')).status(), 'el propietario debería poder mover').toBe(200);
    expect((await mover('aud_editor')).status()).toBe(200);
    expect((await mover('aud_viewer')).status(), 'quien solo mira no mueve').toBe(403);
    expect((await mover('aud_fuera')).status(), 'de fuera ni se entera de que existe').toBe(404);
  });

  test('nadie de fuera lee ni modifica un ticket ajeno sabiendo su id', async ({ browser }) => {
    const dentro = await sesionDe(browser, 'aud_owner');
    const fuera = await sesionDe(browser, 'aud_fuera');

    expect((await dentro.get('/api/issues/i-auditoria')).status()).toBe(200);
    expect((await fuera.get('/api/issues/i-auditoria')).status()).toBe(404);

    const editar = (ctx: APIRequestContext) =>
      ctx.fetch('/api/issues/i-auditoria', {
        method: 'PATCH',
        data: { title: 'secuestrado' },
        headers: ORIGIN_HEADER,
      });
    expect((await editar(dentro)).status()).toBe(200);
    expect((await editar(fuera)).status()).toBe(404);

    const db = getTestDb();
    const issue = db.prepare("SELECT title FROM issues WHERE id = 'i-auditoria'").get() as any;
    db.close();
    // El único cambio que quedó es el del control, no el del extraño.
    expect(issue.title).toBe('secuestrado');
  });

  test('quien solo mira no escribe en una página', async ({ browser }) => {
    const dentro = await sesionDe(browser, 'aud_owner');
    const viewer = await sesionDe(browser, 'aud_viewer');
    const cuerpo = { content_json: { blocks: [{ type: 'paragraph', data: { text: 'hola' } }] } };

    expect((await dentro.fetch('/api/pages/p-auditoria', { method: 'PUT', data: cuerpo, headers: ORIGIN_HEADER })).status()).toBe(200);
    expect((await viewer.fetch('/api/pages/p-auditoria', { method: 'PUT', data: cuerpo, headers: ORIGIN_HEADER })).status()).not.toBe(200);
  });
});

test.describe('escalada de privilegios', () => {
  test('no puedo hacerme sysadmin escribiéndolo en mis ajustes', async ({ browser }) => {
    const editor = await sesionDe(browser, 'aud_editor');
    // El endpoint contesta 200 porque el resto del formulario es válido: lo que
    // importa es que el campo extra se ignora, no que la petición falle.
    await editor.post('/api/user/settings', {
      data: { is_sysadmin: 1, is_guest: 0, bio: 'intento de ascenso' },
      headers: ORIGIN_HEADER,
    });

    const db = getTestDb();
    const u = db.prepare("SELECT is_sysadmin FROM users WHERE id = 'aud-editor'").get() as any;
    db.close();
    expect(u.is_sysadmin).toBeFalsy();
  });

  test('no puedo ascenderme a propietario del espacio', async ({ browser }) => {
    const editor = await sesionDe(browser, 'aud_editor');
    const res = await editor.fetch('/api/workspaces/ws-auditoria/members', {
      method: 'PATCH',
      data: { user_id: 'aud-editor', ws_role: 'owner' },
      headers: ORIGIN_HEADER,
    });
    expect(res.status()).toBe(403);

    const db = getTestDb();
    const m = db.prepare("SELECT ws_role FROM workspace_members WHERE workspace_id='ws-auditoria' AND user_id='aud-editor'").get() as any;
    db.close();
    expect(m.ws_role).toBe('editor');
  });
});

test.describe('sesiones', () => {
  test('cambiar la contraseña echa a las demás sesiones, pero no a la mía', async ({ browser }) => {
    // El caso real: alguien te roba la sesión, tú cambias la contraseña. Si su
    // cookie sigue valiendo, cambiarla no ha servido de nada —y encima da el
    // problema por resuelto.
    const mia = await sesionDe(browser, 'aud_pass');
    const intruso = await sesionDe(browser, 'aud_pass');

    const cambio = await mia.post('/api/user/settings', {
      data: { current_password: PW, new_password: 'CambiadaAdrede999!' },
      headers: ORIGIN_HEADER,
    });
    expect(cambio.status(), await cambio.text()).toBe(200);

    const db = getTestDb();
    const n = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = 'aud-pass'").get() as any;
    db.close();
    expect(n.n, 'debería quedar solo la sesión desde la que se cambió').toBe(1);

    // Y la del intruso ya no abre nada.
    expect((await intruso.get('/api/user/notifications')).status()).toBe(401);
    // La mía sigue sirviendo: obligar a entrar de nuevo justo después de
    // escribir la contraseña nueva empuja a la gente a no cambiarla.
    expect((await mia.get('/api/user/notifications')).status()).toBe(200);

    // Y se deja la contraseña como estaba. Esta prueba es la única de la suite
    // que cambia una credencial; sin devolverla, la segunda ejecución seguida
    // no puede ni entrar.
    const vuelta = await mia.post('/api/user/settings', {
      data: { current_password: 'CambiadaAdrede999!', new_password: PW },
      headers: ORIGIN_HEADER,
    });
    expect(vuelta.status(), 'no pude devolver la contraseña original').toBe(200);
  });
});

test.describe('inyección', () => {
  test('el sanitizador no deja pasar script, iframe ni javascript: por el editor', async ({ browser }) => {
    const dentro = await sesionDe(browser, 'aud_owner');
    const res = await dentro.fetch('/api/pages/p-inyeccion', {
      method: 'PUT',
      headers: ORIGIN_HEADER,
      data: {
        content_json: {
          blocks: [
            { type: 'paragraph', data: { text: '<script>alert(1)</script><img src=x onerror=alert(2)>texto' } },
            { type: 'paragraph', data: { text: '<a href="javascript:alert(3)">trampa</a>' } },
            { type: 'paragraph', data: { text: '<a href="//evil.example">protocolo relativo</a>' } },
            { type: 'raw', data: { html: '<script>alert(4)</script>' } },
          ],
        },
      },
    });
    expect(res.status()).toBe(200);
    // El bloque `raw` no se descarta en silencio: se dice cuál se fue.
    expect((await res.json()).dropped).toContain('raw');

    const db = getTestDb();
    const fila = db.prepare("SELECT content_json FROM pages WHERE id = 'p-inyeccion'").get() as any;
    db.close();
    const guardado = fila.content_json as string;

    expect(guardado).not.toContain('<script');
    expect(guardado).not.toContain('onerror');
    expect(guardado).toContain('texto');
    // El enlace sobrevive; su destino peligroso, no.
    expect(guardado).not.toContain('javascript:');
    expect(guardado).not.toContain('//evil.example');
  });

  test('la biografía no se puede escapar del atributo meta donde se pinta', async ({ browser }) => {
    // La biografía acaba dentro de `<meta content="...">`. Ahí `<` y `>` son
    // inofensivos: lo único que abriría un hueco es una comilla.
    const owner = await sesionDe(browser, 'aud_owner');
    await owner.post('/api/user/settings', {
      data: { bio: '"><img src=x onerror=alert(1)><b y="', pronouns: '', public_email: '' },
      headers: ORIGIN_HEADER,
    });

    const perfil = await owner.get('/u/aud_owner');
    const html = await perfil.text();
    expect(html).not.toContain('content=""><img');
    expect(html).toContain('&quot;');
  });
});
