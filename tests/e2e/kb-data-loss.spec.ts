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

const nota = (...content: any[]) => ({ format: 'tiptap', doc: { type: 'doc', content } });
const p = (text?: string, marks?: any[]) =>
  text ? { type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] } : { type: 'paragraph' };

async function nuevaPagina(page: any, origin: string, title: string) {
  const created = await page.request.post('/api/pages', {
    data: { workspace_id: 'ws-jose-test', title },
    headers: { Origin: origin },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  return (await created.json()).id as string;
}

test('un documento con lista, tabla, código, tareas y huecos sobrevive al guardado', async ({ page }) => {
  // Cada caso es una pérdida que existió con Editor.js —listas vaciadas,
  // tablas borradas, código re-escapado, subrayado perdido— más la que motivó
  // el cambio de editor: las líneas en blanco desaparecían al recargar.
  const origin = await entrar(page);
  const pageId = await nuevaPagina(page, origin, 'Prueba de pérdida');

  const CODE = 'if (a < b && c > d) { return "<div>"; }';
  const payload = nota(
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p('Primero'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('Anidado')] }] }] },
        { type: 'listItem', content: [p('Segundo')] },
      ],
    },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [p('Nombre')] }, { type: 'tableHeader', content: [p('Rol')] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [p('avery')] }, { type: 'tableCell', content: [p('admin')] }] },
      ],
    },
    { type: 'codeBlock', content: [{ type: 'text', text: CODE }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'subrayado', marks: [{ type: 'underline' }] }, { type: 'hardBreak' }, { type: 'text', text: 'y salto' }] },
    p(),
    p(),
    p('tras dos líneas en blanco'),
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p('hecha')] }] },
  );

  const saved = await page.request.put(`/api/pages/${pageId}`, {
    data: { title: 'Prueba de pérdida', content_json: JSON.stringify(payload) },
    headers: { Origin: origin },
  });
  expect(saved.ok(), await saved.text()).toBeTruthy();

  const stored = rowOf(pageId);
  expect(stored.format).toBe('tiptap');
  const bloques = stored.doc.content;
  const deTipo = (t: string) => bloques.find((b: any) => b.type === t);
  const texto = JSON.stringify(stored);

  expect(texto).toContain('Primero');
  expect(texto).toContain('Anidado');
  expect(deTipo('bulletList').content[0].content[1].type).toBe('bulletList');
  expect(deTipo('table').content).toHaveLength(2);
  expect(texto).toContain('admin');
  expect(deTipo('codeBlock').content[0].text).toBe(CODE);
  expect(JSON.stringify(bloques[3])).toContain('underline');
  expect(JSON.stringify(bloques[3])).toContain('hardBreak');
  // Las dos líneas en blanco siguen ahí.
  for (const hueco of [bloques[4], bloques[5]]) {
    expect(hueco.type).toBe('paragraph');
    expect(hueco.content).toBeUndefined();
  }
  expect(deTipo('taskList').content[0].attrs.checked).toBe(true);
});

test('guardar muchas veces no degrada el contenido', async ({ page }) => {
  // El autoguardado dispara cada segundo. La corrupción del código con
  // Editor.js era acumulativa, así que el daño crecía con el tiempo de edición.
  const origin = await entrar(page);
  const pageId = await nuevaPagina(page, origin, 'Repetido');

  const CODE = 'x < y & z';
  for (let i = 0; i < 20; i++) {
    // Se reenvía lo que hay guardado, como haría el editor al releerlo.
    const actual = i === 0 ? nota({ type: 'codeBlock', content: [{ type: 'text', text: CODE }] }, p('a & b')) : rowOf(pageId);
    // Con un reintento: veinte peticiones seguidas contra el mismo servidor,
    // mientras el resto de la suite corre en paralelo, hacen que de vez en
    // cuando se caiga una conexión con ECONNRESET. Eso es transporte, no un
    // fallo del guardado.
    for (let intento = 0; intento < 3; intento++) {
      try {
        await page.request.put(`/api/pages/${pageId}`, {
          data: { content_json: JSON.stringify(actual) },
          headers: { Origin: origin },
        });
        break;
      } catch (e) {
        if (intento === 2) throw e;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  const final = rowOf(pageId);
  expect(final.doc.content[0].content[0].text).toBe(CODE);
  expect(final.doc.content[1].content[0].text).toBe('a & b');
});

test('un nodo desconocido se descarta, pero el servidor lo dice', async ({ page }) => {
  const origin = await entrar(page);
  const pageId = await nuevaPagina(page, origin, 'Con bloque raro');

  const res = await page.request.put(`/api/pages/${pageId}`, {
    data: { content_json: JSON.stringify(nota(p('esto se queda'), { type: 'raw', attrs: { html: '<script>alert(1)</script>' } })) },
    headers: { Origin: origin },
  });

  expect(res.ok()).toBeTruthy();
  // Con Editor.js contestaba `{success:true}` a secas y el usuario veía «Saved».
  expect((await res.json()).dropped).toEqual(['raw']);
  expect(JSON.stringify(rowOf(pageId))).toContain('esto se queda');
});

test('una nota de Editor.js se abre convertida y se guarda en el formato nuevo', async ({ page }) => {
  const origin = await entrar(page);
  const pageId = await nuevaPagina(page, origin, 'Nota vieja');

  const db = getTestDb();
  db.prepare('UPDATE pages SET content_json = ? WHERE id = ?').run(
    JSON.stringify({
      time: 1,
      version: '2.31.6',
      blocks: [
        { type: 'header', data: { text: 'Integrantes:', level: 1 } },
        { type: 'list', data: { style: 'unordered', meta: {}, items: [{ content: 'José', meta: {}, items: [] }, { content: 'Juan Camilo', meta: {}, items: [] }] } },
        { type: 'table', data: { withHeadings: false, content: [['a', 'b']] } },
      ],
    }),
    pageId
  );
  db.close();

  await page.goto(`${origin}/w/${await espacioDe(pageId)}/p/${pageId}`);
  const editor = page.locator('#page-editor .ProseMirror');
  await expect(editor.locator('h1')).toHaveText('Integrantes:');
  await expect(editor.locator('li')).toHaveCount(2);
  await expect(editor.locator('table td').first()).toHaveText('a');

  // Al editar, se escribe en el formato nuevo.
  await editor.locator('li').last().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Luna');
  await expect(page.locator('#save-status')).toHaveText(/^(Saved|Guardado)$/, { timeout: 5000 });

  const stored = rowOf(pageId);
  expect(stored.format).toBe('tiptap');
  expect(JSON.stringify(stored)).toContain('Juan Camilo Luna');
});

test('una nota vieja con bloques que no se pueden convertir no se sobrescribe', async ({ page }) => {
  const origin = await entrar(page);
  const pageId = await nuevaPagina(page, origin, 'Nota con imagen');

  const original = JSON.stringify({
    blocks: [
      { type: 'paragraph', data: { text: 'texto' } },
      { type: 'image', data: { url: 'https://example.com/x.png' } },
    ],
  });
  const db = getTestDb();
  db.prepare('UPDATE pages SET content_json = ? WHERE id = ?').run(original, pageId);
  db.close();

  await page.goto(`${origin}/w/${await espacioDe(pageId)}/p/${pageId}`);
  await expect(page.getByRole('alert')).toContainText('image');

  await page.locator('#page-editor .ProseMirror p').first().click();
  await page.keyboard.type(' editado');
  await expect(page.locator('#save-status')).toHaveText(/^(Not saved|No se ha guardado)$/, { timeout: 5000 });
  await page.waitForTimeout(1500);

  const fila = getTestDb();
  const guardado = (fila.prepare('SELECT content_json FROM pages WHERE id = ?').get(pageId) as any).content_json;
  fila.close();
  expect(guardado).toBe(original);
});

async function espacioDe(pageId: string): Promise<string> {
  const db = getTestDb();
  const fila = db.prepare('SELECT w.sys_tag FROM pages p JOIN workspaces w ON w.id = p.workspace_id WHERE p.id = ?').get(pageId) as any;
  db.close();
  return fila.sys_tag;
}
