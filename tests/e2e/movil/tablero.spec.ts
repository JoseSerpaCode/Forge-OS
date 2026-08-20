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
const ORIGIN = { Origin: 'http://localhost:4322' };
const ESPACIO = 'ws-tablero-movil';

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
  await conUnTicket(page, 'Columna en móvil');
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

test('se puede mover un ticket sin arrastrarlo', async ({ page }) => {
  await entrar(page);
  const { issueId } = await conUnTicket(page, 'Mover en móvil');
  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);

  const tarjeta = page.locator('.issue-card', { hasText: 'Mover en móvil' }).first();
  await expect(tarjeta).toBeVisible();

  const selector = tarjeta.locator('.mover-issue');
  await expect(selector, 'no hay forma de mover el ticket en táctil').toBeVisible();
  await expect(selector).toHaveValue('todo');

  // Se espera a la petición que dispara el propio desplegable, no a un
  // `load`: la página ya estaba cargada, así que `waitForLoadState` volvía al
  // instante y la base se leía antes de que el `PATCH` hubiese terminado.
  const movida = page.waitForResponse((r: any) => r.url().includes(`/api/issues/${issueId}/move`));
  await selector.selectOption('in_progress');
  expect((await movida).status()).toBe(200);

  // Y el cambio es real, no solo visual.
  const fila = getTestDb()
    .prepare('SELECT status FROM issues WHERE id = ?')
    .get(issueId) as any;
  expect(fila.status).toBe('in_progress');
});
