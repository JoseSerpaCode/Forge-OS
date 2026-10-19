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
const ORIGIN_HEADER = { Origin: `http://localhost:${process.env.E2E_PORT || 4322}` };

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
    const cuerpo = {
      content_json: { format: 'tiptap', doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hola' }] }] } },
    };

    expect((await dentro.fetch('/api/pages/p-auditoria', { method: 'PUT', data: cuerpo, headers: ORIGIN_HEADER })).status()).toBe(200);
    expect((await viewer.fetch('/api/pages/p-auditoria', { method: 'PUT', data: cuerpo, headers: ORIGIN_HEADER })).status()).not.toBe(200);
  });
});

test.describe('mover notas en el árbol', () => {
  const mover = (s: APIRequestContext, pagina: string, padre: string | null) =>
    s.fetch(`/api/pages/${pagina}/move`, {
      method: 'PATCH',
      headers: ORIGIN_HEADER,
      data: { parent_id: padre, index: 0 },
    });

  test('solo quien edita mueve, y nadie de fuera se entera de que la nota existe', async ({ browser }) => {
    const dueno = await sesionDe(browser, 'aud_owner');
    const lector = await sesionDe(browser, 'aud_viewer');
    const fuera = await sesionDe(browser, 'aud_fuera');

    // Control: la misma petición desde quien sí puede.
    expect((await mover(dueno, 'p-auditoria', null)).status()).toBe(200);
    expect((await mover(lector, 'p-auditoria', null)).status()).not.toBe(200);
    expect((await mover(fuera, 'p-auditoria', null)).status()).toBe(404);
  });

  test('una nota no se cuelga de otra de un espacio ajeno', async ({ browser }) => {
    const dueno = await sesionDe(browser, 'aud_owner');
    // Una nota en otro espacio del que el dueño también es miembro: aunque
    // pueda verla, mezclar árboles de dos espacios la sacaría del suyo.
    const db = getTestDb();
    db.prepare(`INSERT OR IGNORE INTO pages (id, workspace_id, title, created_by)
                VALUES ('p-otro-espacio', 'ws-tablas', 'Otra', 'aud-owner')`).run();
    db.close();

    expect((await mover(dueno, 'p-inyeccion', 'p-otro-espacio')).status()).toBe(400);
    // Control: dentro de su propio espacio sí se puede.
    expect((await mover(dueno, 'p-inyeccion', 'p-auditoria')).status()).toBe(200);
    // Y se deja como estaba, para no afectar a la prueba de inyección.
    expect((await mover(dueno, 'p-inyeccion', null)).status()).toBe(200);
  });

  test('una nota no va dentro de sí misma ni de su hija', async ({ browser }) => {
    const dueno = await sesionDe(browser, 'aud_owner');
    expect((await mover(dueno, 'p-auditoria', 'p-auditoria')).status()).toBe(409);
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
  test('la validación de notas no deja pasar nodos raros, atributos ni javascript:', async ({ browser }) => {
    // Con Tiptap el texto ya no viaja como HTML: un `<script>` escrito en una
    // nota es texto y se pinta como texto. Lo que hay que vigilar ahora son
    // los nodos y atributos que no están en el esquema, y los destinos de los
    // enlaces.
    const dentro = await sesionDe(browser, 'aud_owner');
    const enlace = (href: string, text: string) => ({
      type: 'paragraph',
      content: [{ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }],
    });
    const res = await dentro.fetch('/api/pages/p-inyeccion', {
      method: 'PUT',
      headers: ORIGIN_HEADER,
      data: {
        content_json: {
          format: 'tiptap',
          doc: {
            type: 'doc',
            content: [
              { type: 'paragraph', attrs: { onerror: 'alert(2)', style: 'x' }, content: [{ type: 'text', text: 'texto' }] },
              enlace('javascript:alert(3)', 'trampa'),
              enlace('//evil.example', 'protocolo relativo'),
              { type: 'raw', attrs: { html: '<script>alert(4)</script>' } },
            ],
          },
        },
      },
    });
    expect(res.status()).toBe(200);
    // El nodo `raw` no se descarta en silencio: se dice cuál se fue.
    expect((await res.json()).dropped).toContain('raw');

    const db = getTestDb();
    const fila = db.prepare("SELECT content_json FROM pages WHERE id = 'p-inyeccion'").get() as any;
    db.close();
    const guardado = fila.content_json as string;

    expect(guardado).not.toContain('<script');
    expect(guardado).not.toContain('onerror');
    expect(guardado).toContain('texto');
    // El texto del enlace sobrevive; su destino peligroso, no.
    expect(guardado).toContain('trampa');
    expect(guardado).not.toContain('javascript:');
    expect(guardado).not.toContain('//evil.example');
  });

  test('un cliente viejo que mande bloques de Editor.js no escribe', async ({ browser }) => {
    // Las notas de Editor.js se convierten al leerlas; escribir ese formato
    // otra vez desharía la migración.
    const dentro = await sesionDe(browser, 'aud_owner');
    const res = await dentro.fetch('/api/pages/p-inyeccion', {
      method: 'PUT',
      headers: ORIGIN_HEADER,
      data: { content_json: { blocks: [{ type: 'paragraph', data: { text: 'hola' } }] } },
    });
    expect(res.status()).toBe(400);
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
