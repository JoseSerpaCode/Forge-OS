import { test, expect } from '@playwright/test';
import { getTestDb } from '../test-utils';

/**
 * El tablero en un teléfono.
 *
 * Eran cuatro columnas de `min-w-[320px]`: 1328 px de carril en los 393 que
 * hay, sin anclaje ni indicador, así que se desplazaba a ciegas y siempre se
 * acababa entre dos columnas.
 *
 * Y peor: **mover un ticket era imposible**. El arrastre del tablero es HTML5
 * —`dragstart`, `dragover`, `drop`— y no dispara con eventos táctiles. Ni
 * arrastrando, ni desde el modal, que no tiene selector de estado. La función
 * no existía y nada lo decía.
 */
const ESPACIO = 'ws-tablero-movil';
// Títulos únicos por ejecución: `conUnTicket` borra por título, y con
// `--repeat-each` dos copias de la misma prueba se borraban la tarea.
const unico = (base: string) => `${base} ${Math.random().toString(36).slice(2, 7)}`;

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

/**
 * El espacio y el ticket se crean **en la base**, no por la API, y cada prueba
 * trae su propio título.
 *
 * Las dos pruebas de este fichero sembraban el mismo `Mover en móvil` y
 * `fullyParallel` las corre a la vez: la primera borraba y recreaba la fila que
 * la segunda acababa de mover, así que la comprobación final leía una fila
 * recién nacida en `todo`. El endpoint devolvía 200 y escribía bien —se
 * comprobó— y aun así la prueba fallaba. De ahí que la comprobación vaya ahora
 * **por id**, que es de esta prueba y de nadie más.
 *
 * La versión anterior los creaba con `page.request` y la comprobación pasaba,
 * pero el espacio no existía después: la API de workspaces devuelve 200 sin
 * crear nada cuando el `sys_tag` choca con uno de otra corrida, y la de issues
 * exige `last_workspace_id` en la sesión —lo pone el middleware al navegar, no
 * la petición—. Dos capas de silencio para acabar mirando un tablero vacío sin
 * saber por qué.
 *
 * Sembrar directamente quita las dos y deja la prueba comprobando lo que dice
 * comprobar: que se puede mover un ticket con el dedo.
 */
async function conUnTicket(_page: any, titulo: string) {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;

  db.prepare('DELETE FROM issues WHERE title = ?').run(titulo);
  // `INSERT OR IGNORE` y luego leer: las dos pruebas de este fichero corren en
  // paralelo y las dos siembran, así que comprobar-y-crear es una carrera.
  const nuevo = crypto.randomUUID();
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(nuevo, 'Tablero móvil', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);

  const issueId = crypto.randomUUID();
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position)
              VALUES (?, ?, 'task', ?, 'todo', ?, 100000)`)
    .run(issueId, ws.id, titulo, yo.id);
  return { issueId, wsId: ws.id };
}

test('en móvil se ve una columna, y el conmutador cambia cuál', async ({ page }) => {
  await entrar(page);
  await conUnTicket(page, unico('Columna en móvil'));
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);

  const columnas = page.locator('.board-column');
  await expect(columnas).toHaveCount(4);

  // Una sola a la vista: las otras tres no compiten por el ancho.
  const visibles = page.locator('.board-column:visible');
  await expect(visibles).toHaveCount(1);
  await expect(visibles.first()).toHaveAttribute('data-status', 'todo');

  // Y la que se ve ocupa la pantalla, no un 85 % con la siguiente asomando.
  const caja = await visibles.first().boundingBox();
  const ventana = page.viewportSize()!.width;
  expect(caja!.width).toBeGreaterThan(ventana * 0.85);

  // El conmutador lleva las cuentas encima, sin tener que entrar a mirarlas.
  const enCurso = page.locator('.filtro-estado[data-estado="in_progress"]');
  await expect(enCurso).toBeVisible();

  await enCurso.click();
  await expect(page.locator('.board-column:visible')).toHaveCount(1);
  await expect(page.locator('.board-column:visible').first()).toHaveAttribute('data-status', 'in_progress');
  await expect(enCurso).toHaveAttribute('aria-selected', 'true');
});

test('se puede mover un ticket sin arrastrarlo, desde su hoja', async ({ page }) => {
  await entrar(page);
  const { issueId } = await conUnTicket(page, unico('Mover en móvil'));
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);

  const tarjeta = page.locator(`.issue-card[data-issue-id="${issueId}"]`);
  await tarjeta.scrollIntoViewIfNeeded();
  await expect(tarjeta).toBeVisible();

  const boton = tarjeta.locator('.btn-mover-estado');
  await expect(boton, 'no hay forma de mover el ticket en táctil').toBeVisible();
  await boton.click();

  const hoja = page.locator('#hoja-mover');
  await expect(hoja).toBeVisible();
  // Donde ya está, marcado y sin poder pulsarse.
  await expect(hoja.locator('.estado-destino[data-estado="todo"]')).toBeDisabled();

  // Se espera a la petición que dispara la hoja, no a un `load`: la página no
  // se recarga, y la base se leería antes de que el `PATCH` terminase.
  const movida = page.waitForResponse((r: any) => r.url().includes(`/api/issues/${issueId}/move`));
  await hoja.locator('.estado-destino[data-estado="in_progress"]').click();
  expect((await movida).status()).toBe(200);
  await expect(hoja).toBeHidden();

  // Y el cambio es real, no solo visual: en la base y en la columna.
  const fila = getTestDb().prepare('SELECT status FROM issues WHERE id = ?').get(issueId) as any;
  expect(fila.status).toBe('in_progress');
  await expect(page.locator(`.board-column[data-status="in_progress"] .issue-card[data-issue-id="${issueId}"]`)).toHaveCount(1);
  await expect(page.locator('.filtro-estado[data-estado="in_progress"] .wide')).not.toHaveText('0');
});

/** Un dedo de verdad: eventos táctiles por el protocolo de Chrome, no clics. */
async function dedo(page: any) {
  const cdp = await page.context().newCDPSession(page);
  const toque = (type: string, x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  return {
    /**
     * `hasta` se pide **después** de la espera: con la máquina cargada, la
     * página aún se recoloca (fuentes, desplazamiento) entre que se mide y que
     * el dedo llega, y una medida vieja soltaba la tarjeta fuera del destino.
     */
    async arrastrar(desde: { x: number; y: number }, hasta: () => Promise<{ x: number; y: number }>, esperaMs: number) {
      await toque('touchStart', desde.x, desde.y);
      await page.waitForTimeout(esperaMs);
      const fin = await hasta();
      for (let i = 1; i <= 8; i++) {
        await toque('touchMove', desde.x + ((fin.x - desde.x) * i) / 8, desde.y + ((fin.y - desde.y) * i) / 8);
      }
      await toque('touchEnd', fin.x, fin.y);
    },
  };
}
const centro = async (loc: any) => {
  const c = (await loc.boundingBox())!;
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
};

test('mantener pulsada una tarjeta y soltarla en una pestaña la mueve de estado', async ({ page }) => {
  await entrar(page);
  const { issueId } = await conUnTicket(page, unico('Arrastrar con el dedo'));
  // La primera de su columna, para no depender de cuántas haya dejado otra prueba.
  getTestDb().prepare('UPDATE issues SET position = 1 WHERE id = ?').run(issueId);
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  await expect(page.locator('body')).toHaveAttribute('data-tablero-listo', 'true');

  const tarjeta = page.locator(`.issue-card[data-issue-id="${issueId}"]`);
  await tarjeta.scrollIntoViewIfNeeded();
  const pestana = page.locator('.filtro-estado[data-estado="review"]');
  const movida = page.waitForResponse((r: any) => r.url().includes(`/api/issues/${issueId}/move`));
  await (await dedo(page)).arrastrar(await centro(tarjeta.locator('h4')), () => centro(pestana), 500);
  expect((await movida).status()).toBe(200);

  const fila = getTestDb().prepare('SELECT status FROM issues WHERE id = ?').get(issueId) as any;
  expect(fila.status).toBe('review');
  // No se abrió la tarea al soltar.
  await expect(page.locator('#issue-details-modal')).toHaveClass(/translate-x-full/);
});

test('deslizar sin esperar no levanta la tarjeta: cambia de pestaña', async ({ page }) => {
  await entrar(page);
  const { issueId } = await conUnTicket(page, unico('Deslizar al lado'));
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  await expect(page.locator('body')).toHaveAttribute('data-tablero-listo', 'true');

  const tarjeta = page.locator(`.issue-card[data-issue-id="${issueId}"]`);
  await tarjeta.scrollIntoViewIfNeeded();
  const desde = await centro(tarjeta.locator('h4'));
  await (await dedo(page)).arrastrar(desde, async () => ({ x: desde.x - 200, y: desde.y + 5 }), 0);

  await expect(page.locator('.filtro-estado[data-estado="in_progress"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.board-column:visible').first()).toHaveAttribute('data-status', 'in_progress');
  const fila = getTestDb().prepare('SELECT status FROM issues WHERE id = ?').get(issueId) as any;
  expect(fila.status, 'deslizar no debe mover la tarea').toBe('todo');

  // La pestaña va en la dirección: al recargar sigue ahí.
  await expect(page).toHaveURL(/estado=in_progress/);
  await page.reload();
  await expect(page.locator('.board-column:visible').first()).toHaveAttribute('data-status', 'in_progress');
});

test('la barra del tablero cabe en dos filas: lo demás va en «Filtros y orden»', async ({ page }) => {
  await entrar(page);
  await conUnTicket(page, unico('Barra compacta'));
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);

  const opciones = page.locator('#btn-opciones-tablero');
  await expect(opciones).toBeVisible();
  await expect(page.locator('#sort-menu-root')).toBeHidden();
  await expect(page.locator('#btn-new-issue')).toBeVisible();

  await opciones.click();
  await expect(opciones).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#sort-menu-root')).toBeVisible();
});
