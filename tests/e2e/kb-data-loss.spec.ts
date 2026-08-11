import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Guardar un documento y comprobar lo que hay **en SQLite**, no en la pantalla.
 *
 * La pérdida era invisible desde la interfaz: el editor en memoria seguía
 * enseñando el contenido correcto y el indicador decía «Saved». Solo se
 * descubría al recargar, y entonces ya no había nada que recuperar. Así que
 * estas comprobaciones leen la fila.
 */

/**
 * Entra y **visita el espacio** antes de crear nada.
 *
 * `POST /api/pages` exige `users.last_workspace_id`, que se fija al abrir un
 * espacio. Crear una página sin haber entrado nunca a uno devuelve 400, que es
 * lo que hacía este test antes: un atajo que ninguna persona real toma.
 */
async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
  await page.goto('/w/test-workspace/board');
  return new URL(page.url()).origin;
}

const rowOf = (pageId: string) => {
  const db = getTestDb();
  const row = db.prepare('SELECT content_json FROM pages WHERE id = ?').get(pageId) as any;
  db.close();
  return JSON.parse(row.content_json);
};

test('un documento con lista, tabla, código y subrayado sobrevive al guardado', async ({ page }) => {
  const origin = await entrar(page);

  const created = await page.request.post('/api/pages', {
    data: { workspace_id: 'ws-jose-test', title: 'Prueba de pérdida' },
    headers: { Origin: origin },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const pageId = (await created.json()).id;

  const CODE = 'if (a < b && c > d) { return "<div>"; }';
  const payload = {
    time: Date.now(),
    version: '2.31.6',
    blocks: [
      {
        type: 'list',
        data: {
          style: 'unordered',
          meta: {},
          items: [
            { content: 'Primero', meta: {}, items: [{ content: 'Anidado', meta: {}, items: [] }] },
            { content: 'Segundo', meta: {}, items: [] },
          ],
        },
      },
      { type: 'table', data: { withHeadings: true, content: [['Nombre', 'Rol'], ['avery', 'admin']] } },
      { type: 'code', data: { code: CODE } },
      { type: 'paragraph', data: { text: 'texto <u>subrayado</u><br>y salto' } },
    ],
  };

  const saved = await page.request.put(`/api/pages/${pageId}`, {
    data: { title: 'Prueba de pérdida', content_json: JSON.stringify(payload) },
    headers: { Origin: origin },
  });
  expect(saved.ok(), await saved.text()).toBeTruthy();

  const stored = rowOf(pageId);
  const byType = Object.fromEntries(stored.blocks.map((b: any) => [b.type, b]));

  // 1. Listas: cada ítem se guardaba como cadena vacía.
  expect(byType.list.data.items[0].content).toBe('Primero');
  expect(byType.list.data.items[1].content).toBe('Segundo');
  expect(byType.list.data.items[0].items[0].content).toBe('Anidado');

  // 2. Tablas: el bloque entero desaparecía.
  expect(byType.table).toBeDefined();
  expect(byType.table.data.content).toEqual([['Nombre', 'Rol'], ['avery', 'admin']]);

  // 3. Código: se re-escapaba en cada guardado, acumulando `&amp;lt;`.
  expect(byType.code.data.code).toBe(CODE);

  // 4. Subrayado y salto suave: se borraban del texto.
  expect(byType.paragraph.data.text).toContain('<u>subrayado</u>');
  expect(byType.paragraph.data.text).toContain('<br');
});

test('guardar mil veces no degrada el contenido', async ({ page }) => {
  // El autoguardado dispara cada segundo. La corrupción del bloque de código
  // era acumulativa, así que el daño crecía con el tiempo de edición.
  const origin = await entrar(page);

  const created = await page.request.post('/api/pages', {
    data: { workspace_id: 'ws-jose-test', title: 'Repetido' },
    headers: { Origin: origin },
  });
  const pageId = (await created.json()).id;

  const CODE = 'x < y & z';
  const blocks = [{ type: 'code', data: { code: CODE } }];

  for (let i = 0; i < 20; i++) {
    // Se reenvía lo que hay guardado, como haría el editor al releerlo.
    const actual = i === 0 ? { blocks } : rowOf(pageId);
    await page.request.put(`/api/pages/${pageId}`, {
      data: { content_json: JSON.stringify(actual) },
      headers: { Origin: origin },
    });
  }

  expect(rowOf(pageId).blocks[0].data.code).toBe(CODE);
});

test('un bloque desconocido se descarta, pero el servidor lo dice', async ({ page }) => {
  const origin = await entrar(page);

  const created = await page.request.post('/api/pages', {
    data: { workspace_id: 'ws-jose-test', title: 'Con bloque raro' },
    headers: { Origin: origin },
  });
  const pageId = (await created.json()).id;

  const res = await page.request.put(`/api/pages/${pageId}`, {
    data: {
      content_json: JSON.stringify({
        blocks: [
          { type: 'paragraph', data: { text: 'esto se queda' } },
          { type: 'raw', data: { html: '<script>alert(1)</script>' } },
        ],
      }),
    },
    headers: { Origin: origin },
  });

  expect(res.ok()).toBeTruthy();
  // Antes contestaba `{success:true}` a secas y el usuario veía «Saved».
  expect((await res.json()).dropped).toEqual(['raw']);
});
