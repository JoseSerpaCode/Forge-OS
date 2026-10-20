import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * Ninguna de las pantallas del espacio se sale a lo ancho.
 *
 * Es la comprobación que ninguna prueba concreta hace y que todas dan por
 * hecha. Un desbordamiento horizontal en móvil no rompe nada: la página sigue
 * funcionando, solo que el contenido se desplaza de lado y la mitad derecha de
 * cada línea queda fuera. No hay error, no hay excepción, no hay nada que
 * mirar en la consola — y por eso llevaba tanto tiempo pasando.
 *
 * Un ancho fijo en píxeles, una tabla, un `min-w-`, un modal de 550: cualquiera
 * de los cuatro lo provoca, y las seis pantallas usan los cuatro patrones.
 */
const ESPACIO = 'ws-desborde-movil';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

function conContenido() {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;

  const nuevo = crypto.randomUUID();
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(nuevo, 'Desbordamiento móvil', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);

  // Un ticket con un título largo: el caso que más veces ha desbordado.
  db.prepare('DELETE FROM issues WHERE workspace_id = ?').run(ws.id);
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position)
              VALUES (?, ?, 'task', ?, 'todo', ?, 100000)`)
    .run(crypto.randomUUID(), ws.id,
         'Un título deliberadamente larguísimo que no cabe de ninguna manera en la anchura de un teléfono',
         yo.id);

  return ws.id;
}

const pantallas = [
  { nombre: 'panel', ruta: '' },
  { nombre: 'tablero', ruta: '/board' },
  { nombre: 'base de conocimiento', ruta: '/p' },
  { nombre: 'bases de datos', ruta: '/db' },
  { nombre: 'archivos', ruta: '/files' },
  { nombre: 'métricas', ruta: '/metrics' },
];

/*
 * Se miden el documento **y** el `<main>`. Solo el documento no basta:
 * `<body>` es `overflow-hidden` y quien se desplaza es el `<main>`, que es
 * `overflow-auto`. En Inicio el documento medía lo mismo que la ventana
 * mientras el `<main>` se iba de lado con todo el contenido: un `sr-only`
 * absoluto en la cabecera de una tabla escapaba de su panel con
 * desplazamiento, porque su bloque contenedor era el `<main>`, no la tabla.
 */
async function cabeALoAncho(page: any) {
  const medidas = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const borde = main.getBoundingClientRect().right;
    // Lo que va dentro de un contenedor con desplazamiento (las tablas) puede
    // ser ancho, salvo que sea absoluto: ese puede escapar del recorte.
    const recortado = (el: Element) => {
      if (getComputedStyle(el).position === 'absolute') return false;
      for (let p = el.parentElement; p && p !== main; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== 'visible') return true;
      }
      return false;
    };
    const culpable = Array.from(document.querySelectorAll('body *')).find((el) =>
      !el.closest('dialog:not([open])') && !recortado(el) && el.getBoundingClientRect().right > borde + 1);
    return {
      documento: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
      contenido: main.scrollWidth,
      caja: main.clientWidth,
      culpable: culpable ? `${culpable.tagName.toLowerCase()}.${(culpable.className || '').toString().slice(0, 70)}` : '',
    };
  });

  expect(medidas.documento, `desborda por ${medidas.culpable}`).toBeLessThanOrEqual(medidas.ventana + 1);
  expect(medidas.contenido, `el <main> desborda por ${medidas.culpable}`).toBeLessThanOrEqual(medidas.caja + 1);
}

for (const { nombre, ruta } of pantallas) {
  test(`${nombre} cabe a lo ancho`, async ({ page }) => {
    await entrar(page);
    conContenido();
    await page.goto(`/w/${ESPACIO}${ruta}`);
    await page.waitForLoadState('networkidle');
    await cabeALoAncho(page);
  });
}

test('inicio cabe a lo ancho', async ({ page }) => {
  await entrar(page);
  const wsId = conContenido();
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  db.prepare('UPDATE issues SET assignee_id = ? WHERE workspace_id = ?').run(yo.id, wsId);

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await cabeALoAncho(page);
});

test('nada empuja la vista de lado, ni por código', async ({ page }) => {
  await entrar(page);
  const wsId = conContenido();

  const db = getTestDb();
  db.prepare('DELETE FROM pages WHERE workspace_id = ?').run(wsId);
  const pid = crypto.randomUUID();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  db.prepare('INSERT INTO pages (id, workspace_id, title, content_json, created_by) VALUES (?,?,?,?,?)')
    .run(pid, wsId, 'Proyecto 2', JSON.stringify({ blocks: [{ type: 'header', data: { text: 'Integrantes:', level: 1 } }] }), yo.id);

  await page.goto(`/w/${ESPACIO}/p/${pid}`);
  await page.waitForLoadState('networkidle');

  /*
   * `overflow: hidden` frena el dedo pero no al código: un `scrollIntoView()`
   * —y Editor.js, el editor de notas de entonces, hacía uno por cada bloque
   * que enfocaba— corre el contenedor de
   * lado igual, y ahí se queda. Se veía como la página entera desplazada, con
   * el texto cortado por la izquierda y la barra inferior arrastrada con ella.
   *
   * Se intenta a la fuerza, que es lo único que reproduce el fallo: mirar el
   * ancho del documento no basta porque el desbordamiento venía de un elemento
   * colocado en negativo, no de uno demasiado ancho.
   */
  const movido = await page.evaluate(() => {
    const sitios = [document.documentElement, document.body];
    for (const el of sitios) {
      el.scrollLeft = 500;
      if (el.scrollLeft !== 0) return `${el.tagName.toLowerCase()} se fue a ${el.scrollLeft}`;
    }
    return '';
  });
  expect(movido, 'la vista se puede empujar de lado').toBe('');

  // Y el menú lateral de escritorio no se queda plantado fuera de la pantalla.
  await expect(page.locator('#app-sidebar')).toBeHidden();
});
