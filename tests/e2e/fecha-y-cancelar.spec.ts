import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

const ESPACIO = 'ws-fecha-cancelar';

// El navegador, en la misma zona que el servidor (`playwright.config.ts`): al
// oeste de UTC es donde una fecha solo-día se corría al día anterior.
test.use({ timezoneId: 'America/Bogota' });

/** «Sep 9, 2026» o «9 sept 2026»: el día exacto, en cualquiera de los dos idiomas. */
const elDia = (d: number) => new RegExp(`(Sep ${d}, 2026|\\b${d} sept? 2026)`);

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
    .run(crypto.randomUUID(), 'Fecha y cancelar', ESPACIO, yo.id);
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(ESPACIO) as any;
  // Con la medición de tiempo encendida el panel pide la tarea dos veces al
  // abrirse (la segunda, tras cargar los registros de horas): es la carrera que
  // fija la prueba de la fecha lenta. Apagada, solo hay una petición.
  db.prepare('UPDATE workspaces SET feat_time = 1 WHERE id = ?').run(ws.id);
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);
  return { db, yo, ws };
}

/**
 * La misma entrega se lee igual en la tarjeta y al abrirla.
 *
 * El modal usaba `toLocaleDateString()` **sin argumentos**, así que tomaba el
 * idioma del navegador y no el de la aplicación: «9 sept 2026» en la tarjeta,
 * «9/09/26» al abrir el ticket. Es el mismo fallo que ya se corrigió una vez en
 * la tarjeta y del que quedó una copia suelta aquí.
 */
test('la fecha de entrega se ve igual en la tarjeta y en el modal', async ({ page }) => {
  await entrar(page);
  const { db, yo, ws } = conEspacio();
  db.prepare("DELETE FROM issues WHERE title = 'Con fecha'").run();
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position, due_date)
              VALUES (?, ?, 'task', 'Con fecha', 'todo', ?, 100000, '2026-09-09')`)
    .run(crypto.randomUUID(), ws.id, yo.id);

  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const tarjeta = page.locator('.issue-card', { hasText: 'Con fecha' }).first();
  await expect(tarjeta).toBeVisible();

  // Como la pinta el servidor, con el idioma de la aplicación.
  const antes = (await tarjeta.locator('.card-due').textContent())?.trim() ?? '';

  /*
   * El día exacto que se guardó, no uno parecido.
   *
   * `'2026-09-09'` se leía como medianoche UTC, que en Bogotá es el día 8 a
   * las siete de la tarde: la tarjeta decía «Sep 8, 2026». Comparar solo la
   * forma de las dos fechas, como hace el final de esta prueba, no lo veía.
   */
  expect(antes).toMatch(elDia(9));

  // Y ahora se edita desde el modal, que es cuando se reescribía con el
  // formato del navegador: el modal escribe de vuelta en la propia tarjeta.
  await tarjeta.locator('h4').click();
  await expect(page.locator('#issue-details-modal')).not.toHaveClass(/translate-x-full/);

  // El modal se rellena desde la tarjeta al abrirse. Sin esperar a que la
  // fecha esté puesta, el `fill` corría antes que el manejador y el cambio se
  // perdía: la prueba fallaba una de cada tres.
  await expect(page.locator('#modal-issue-due-date')).toHaveValue('2026-09-09');

  await page.fill('#modal-issue-due-date', '2026-09-10');
  await page.locator('#modal-issue-due-date').dispatchEvent('change');

  await expect
    .poll(async () => (await tarjeta.locator('.card-due').textContent())?.trim() ?? '')
    .not.toBe(antes);

  const despues = (await tarjeta.locator('.card-due').textContent())?.trim() ?? '';
  // Y el del navegador, que repinta con la misma `fecha()`, tampoco se corre.
  expect(despues).toMatch(elDia(10));

  /*
   * No se fija el formato concreto, sino que los dos se escriban igual: el
   * servidor usa `fecha()` y el cliente usaba `toLocaleDateString()` a secas,
   * así que salía «9 sept 2026» antes de tocarla y «9/09/26» después.
   */
  const forma = (s: string) => s.replace(/\d+/g, '#');
  expect(forma(despues), `antes «${antes}» y después «${despues}»`).toBe(forma(antes));
});

/**
 * La fecha elegida no la pisa una carga que llega tarde.
 *
 * Al abrir el modal, los datos del ticket se piden dos veces: una directa y
 * otra cuando terminan de cargar los registros de trabajo. La segunda
 * reescribía el campo de fecha con lo que había en el servidor *antes* de
 * elegir la nueva, así que el campo volvía a la fecha vieja. Con la suite en
 * paralelo pasaba de vez en cuando y hacía fallar la prueba de arriba; aquí se
 * fuerza retrasando los registros de trabajo.
 */
test('elegir la fecha justo al abrir el ticket no se deshace', async ({ page }) => {
  await entrar(page);
  const { db, yo, ws } = conEspacio();
  db.prepare("DELETE FROM issues WHERE title = 'Con fecha lenta'").run();
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position, due_date)
              VALUES (?, ?, 'task', 'Con fecha lenta', 'todo', ?, 100001, '2026-09-09')`)
    .run(crypto.randomUUID(), ws.id, yo.id);

  /*
   * Se deja pasar la primera carga y se retiene la **respuesta** de la segunda:
   * la petición sale antes de elegir la fecha, así que trae la vieja, y llega
   * después. Retener la petición en vez de la respuesta no reproduce nada —
   * saldría tras el PATCH y ya traería la nueva—.
   */
  let cargas = 0;
  let soltar!: () => void;
  const retenido = new Promise<void>((r) => { soltar = r; });
  let pedida!: () => void;
  const segundaPedida = new Promise<void>((r) => { pedida = r; });
  let entregada!: () => void;
  const segundaEntregada = new Promise<void>((r) => { entregada = r; });
  await page.route(/\/api\/issues\/[^/]+$/, async (ruta) => {
    if (ruta.request().method() !== 'GET' || ++cargas !== 2) return ruta.continue();
    const vieja = await ruta.fetch();
    pedida();
    await retenido;
    await ruta.fulfill({ response: vieja });
    entregada();
  });

  await page.goto(`/w/${ESPACIO}/board?sprint=backlog`);
  const tarjeta = page.locator('.issue-card', { hasText: 'Con fecha lenta' }).first();
  await tarjeta.locator('h4').click();
  const campo = page.locator('#modal-issue-due-date');
  await expect(campo).toHaveValue('2026-09-09');
  await segundaPedida;

  const guardado = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/api/issues/'));
  await campo.fill('2026-09-10');
  await campo.dispatchEvent('change');
  await guardado;

  // Ahora llega la segunda carga, con lo que había antes de elegir.
  soltar();
  await segundaEntregada;
  // Un respiro para que el manejador de la respuesta escriba en el campo.
  await page.evaluate(() => new Promise((r) => setTimeout(r, 100)));

  await expect(campo).toHaveValue('2026-09-10');
  await expect(tarjeta.locator('.card-due')).toHaveText(/(Sep 10, 2026|\b10 sept? 2026)/);
});

/**
 * «Cancelar» deshace un paso; la equis cierra.
 *
 * Hacía `close()`, exactamente lo mismo que la equis, y en un alta de dos pasos
 * eso convierte «me he equivocado de plantilla» en «empieza de cero».
 */
test('cancelar en el formulario vuelve a las plantillas, no cierra', async ({ page }) => {
  await entrar(page);
  conEspacio();
  await page.goto(`/w/${ESPACIO}/db`);

  await page.locator('#btn-new-db').click();
  await expect(page.locator('#step-tpl')).toBeVisible();

  // Se entra al formulario eligiendo una plantilla.
  await page.locator('[data-tpl]').first().click();
  await expect(page.locator('#step-form')).toBeVisible();

  await page.locator('#btn-cancel-db').click();

  await expect(page.locator('#new-db-modal'), 'el diálogo se cerró entero').toBeVisible();
  await expect(page.locator('#step-tpl'), 'no volvió a las plantillas').toBeVisible();
});
