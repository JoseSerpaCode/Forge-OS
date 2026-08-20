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

for (const { nombre, ruta } of pantallas) {
  test(`${nombre} cabe a lo ancho`, async ({ page }) => {
    await entrar(page);
    conContenido();
    await page.goto(`/w/${ESPACIO}${ruta}`);
    await page.waitForLoadState('networkidle');

    const medidas = await page.evaluate(() => ({
      documento: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
      // El culpable, si lo hay: el elemento más ancho que la ventana.
      culpable: (() => {
        const w = window.innerWidth;
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const r = el.getBoundingClientRect();
          if (r.width > w + 1 || r.right > w + 1) {
            return `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 70)}`;
          }
        }
        return '';
      })(),
    }));

    expect(medidas.documento, `desborda por ${medidas.culpable}`).toBeLessThanOrEqual(medidas.ventana + 1);
  });
}
