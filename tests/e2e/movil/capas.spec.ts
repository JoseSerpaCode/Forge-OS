import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * Qué queda por delante de qué.
 *
 * Es la familia de fallos que más veces se ha colado en este rediseño, y
 * siempre por lo mismo: alguien pone `z-50` a un elemento para que su tooltip
 * salga por encima de las tarjetas, y con eso queda también por encima del
 * panel de notificaciones y del cajón lateral. Nada falla, nada avisa: solo un
 * botón naranja flotando encima de un menú abierto.
 *
 * Estas pruebas no comprueban números de `z-index` —eso sería copiar el código
 * en la prueba—, sino lo único que importa: qué toca el dedo.
 */
const ESPACIO = 'ws-capas';

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

function conEspacio() {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(crypto.randomUUID(), 'Capas', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);
  return ws.id;
}

/**
 * Qué se interpone sobre una caja, muestreando toda su superficie.
 *
 * Un solo punto no sirve: el primer intento miraba el borde superior del panel
 * y el botón que lo perforaba estaba a media altura, así que la prueba pasaba
 * con el fallo puesto. Se recorre una rejilla y se devuelven los intrusos.
 */
async function loQueSeInterpone(page: any, selector: string): Promise<string[]> {
  return page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return ['no existe'];
    const r = el.getBoundingClientRect();
    const intrusos = new Set<string>();
    for (let fx = 0.1; fx <= 0.9; fx += 0.2) {
      for (let fy = 0.1; fy <= 0.9; fy += 0.2) {
        const arriba = document.elementFromPoint(r.x + r.width * fx, r.y + r.height * fy);
        if (arriba && arriba !== el && !el.contains(arriba)) {
          intrusos.add(arriba.id || arriba.className.toString().slice(0, 40) || arriba.tagName);
        }
      }
    }
    return [...intrusos];
  }, selector);
}

test('el panel de notificaciones queda por delante del tablero', async ({ page }) => {
  await entrar(page);
  conEspacio();
  await page.goto(`/w/${ESPACIO}/board`);

  await page.locator('#btn-notifications').click();
  const panel = page.locator('#notif-dropdown');
  await expect(panel).toBeVisible();

  // «+ Nuevo ticket» estaba en `z-50` y se pintaba encima del panel abierto.
  const intrusos = await loQueSeInterpone(page, '#notif-dropdown');
  expect(intrusos, 'algo se pinta por delante del panel de notificaciones').toEqual([]);
});

test('el menú del sprint no se sale de la pantalla', async ({ page }) => {
  await entrar(page);
  conEspacio();
  await page.goto(`/w/${ESPACIO}/board`);

  const boton = page.locator('#btn-sprint-menu');
  await expect(boton).toBeVisible();
  await boton.click();

  const menu = page.locator('#sprint-menu');
  await expect(menu).toBeVisible();

  // Anclado a la derecha de un botón que ahora vive en la columna izquierda de
  // una rejilla, el menú se desplegaba hacia la izquierda y quedaba cortado por
  // el borde: se veía media palabra y ninguna de sus opciones.
  const caja = await menu.boundingBox();
  expect(caja!.x, 'el menú empieza fuera de la pantalla').toBeGreaterThanOrEqual(-1);
  expect(caja!.x + caja!.width, 'el menú acaba fuera de la pantalla')
    .toBeLessThanOrEqual(page.viewportSize()!.width + 1);
});
