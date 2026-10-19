import { test, expect, type Page } from '@playwright/test';
import crypto from 'crypto';
import { getTestDb } from './test-utils';

/**
 * El tablero simplificado, en el navegador.
 *
 * Cada grupo monta su propio espacio con la base de pruebas, para no depender
 * de lo que dejen las demás pruebas en `test-workspace`. Las denegaciones
 * llevan su **control**: la misma petición desde quien sí puede, para que un
 * 404 no pase por permiso denegado cuando en realidad la ruta no existe.
 */

// En serie dentro del fichero: las pruebas de un mismo grupo comparten espacio
// y cada una lo vacía al empezar. En paralelo se borraban las tareas entre sí.
test.describe.configure({ mode: 'serial' });

const PUERTO = process.env.E2E_PORT || 4322;

// Un sufijo por ejecución en el nombre de cada espacio. Con nombres fijos, dos
// ejecuciones a la vez —reintentos, `--repeat-each`, dos copias del repo— se
// vaciaban el espacio la una a la otra, y fallaba una prueba cualquiera.
const RUN = Math.random().toString(36).slice(2, 7);
const ORIGIN = { Origin: `http://localhost:${PUERTO}` };

async function entrar(page: Page, lang: 'es' | 'en' = 'es') {
  await page.context().addCookies([{ name: 'forge_lang', value: lang, url: `http://localhost:${PUERTO}` }]);
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

/** Un espacio de jose, con las funciones que se pidan y sin tareas. */
function espacio(sysTag: string, f: { sprints?: number; tiempo?: number; puntos?: number } = {}) {
  const db = getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  let ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sysTag) as any;
  if (!ws) {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(id, sysTag, sysTag, yo.id);
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(id, yo.id);
    ws = { id };
  }
  db.prepare('UPDATE workspaces SET feat_sprints = ?, feat_time = ?, feat_points = ? WHERE id = ?')
    .run(f.sprints ?? 0, f.tiempo ?? 0, f.puntos ?? 0, ws.id);
  db.prepare('DELETE FROM issues WHERE workspace_id = ?').run(ws.id);
  db.prepare('DELETE FROM sprints WHERE workspace_id = ?').run(ws.id);
  db.close();
  return { id: ws.id as string, yo: yo.id as string };
}

function tarea(ws: { id: string; yo: string }, campos: Record<string, unknown>) {
  const db = getTestDb();
  const id = (campos.id as string) ?? crypto.randomUUID();
  const fila = { id, workspace_id: ws.id, type: 'task', reporter_id: ws.yo, status: 'todo', position: 100000, ...campos };
  const cols = Object.keys(fila);
  db.prepare(`INSERT INTO issues (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...Object.values(fila));
  db.close();
  return id;
}

test.describe('sin sprints, el tablero enseña todo', () => {
  const ESP = `e2e-sin-sprints-${RUN}`;

  test('tareas de dos sprints a la vez, sin selector; encender lo devuelve', async ({ page }) => {
    const ws = espacio(ESP);
    const db = getTestDb();
    db.prepare(`INSERT INTO sprints (id, workspace_id, name) VALUES ('ss-1-${RUN}', ?, 'Uno'), ('ss-2-${RUN}', ?, 'Dos')`).run(ws.id, ws.id);
    db.close();
    tarea(ws, { title: 'En el uno', sprint_id: `ss-1-${RUN}` });
    tarea(ws, { title: 'En el dos', sprint_id: `ss-2-${RUN}` });

    await entrar(page);
    const res = await page.goto(`/w/${ESP}/board?sprint=ss-1-${RUN}`);
    // Un `?sprint=` viejo se ignora en vez de filtrar o dar 404.
    expect(res?.status()).toBe(200);
    await expect(page.locator('.issue-card', { hasText: 'En el uno' })).toBeVisible();
    await expect(page.locator('.issue-card', { hasText: 'En el dos' })).toBeVisible();
    await expect(page.locator('#sprint-selector')).toHaveCount(0);

    const r = await page.request.patch(`/api/w/${ESP}/features`, { headers: ORIGIN, data: { sprints: true } });
    expect(r.status()).toBe(200);
    await page.goto(`/w/${ESP}/board?sprint=ss-1-${RUN}`);
    await expect(page.locator('#sprint-selector')).toBeVisible();
    await expect(page.locator('.issue-card', { hasText: 'En el dos' })).toHaveCount(0);
  });

  test('con el tiempo apagado no hay cronómetro, y arrancarlo por la API es 403', async ({ page }) => {
    const ws = espacio(ESP);
    const id = tarea(ws, { title: 'Sin reloj' });
    await entrar(page);
    await page.goto(`/w/${ESP}/board`);
    await expect(page.locator('.issue-card', { hasText: 'Sin reloj' }).locator('.btn-start-timer')).toHaveCount(0);
    const apagado = await page.request.post(`/api/issues/${id}/timer`, { headers: ORIGIN });
    expect(apagado.status()).toBe(403);
    expect((await apagado.json()).error_code).toBe('feature_disabled');

    // Control: el mismo espacio con la función encendida.
    await page.request.patch(`/api/w/${ESP}/features`, { headers: ORIGIN, data: { tiempo: true } });
    const encendido = await page.request.post(`/api/issues/${id}/timer`, { headers: ORIGIN });
    expect(encendido.status()).toBe(200);
    await page.request.delete(`/api/issues/${id}/timer`, { headers: ORIGIN });
  });
});

test.describe('Hecho: las diez últimas y «ver más»', () => {
  const ESP = `e2e-hecho-${RUN}`;

  test('enseña 10 de 25, el contador dice 25 y las cargadas se abren', async ({ page }) => {
    const ws = espacio(ESP);
    for (let i = 0; i < 25; i++) {
      const dia = String(i + 1).padStart(2, '0');
      tarea(ws, { title: `Hecha ${dia}`, status: 'done', done_at: `2026-09-${dia} 10:00:00` });
    }
    await entrar(page);
    await page.goto(`/w/${ESP}/board`);
    const hecho = page.locator('.board-column[data-status="done"]');
    await expect(hecho.locator('.issue-card')).toHaveCount(10);
    await expect(hecho.locator('.issue-count')).toHaveText('25');
    // Lo más reciente arriba.
    await expect(hecho.locator('.issue-card').first()).toContainText('Hecha 25');

    await hecho.locator('.ver-mas').click();
    await expect(hecho.locator('.issue-card')).toHaveCount(25);
    await expect(hecho.locator('.ver-mas')).toHaveCount(0);

    // Una de las que llegaron después abre el panel: los eventos van delegados.
    await hecho.locator('.issue-card', { hasText: 'Hecha 01' }).click();
    await expect(page.locator('#modal-issue-title')).toHaveValue('Hecha 01');
  });

  test('el parcial no acepta filtros de otro espacio; los propios sí', async ({ page }) => {
    // `jose` es administrador del sistema y entra en todos los espacios, así que
    // lo que se prueba es que un id **ajeno** en los filtros no cuela.
    const ws = espacio(ESP);
    const db = getTestDb();
    db.prepare('DELETE FROM labels WHERE workspace_id = ?').run(ws.id);
    db.prepare(`INSERT INTO labels (id, workspace_id, name, color) VALUES ('hp-propia-${RUN}', ?, 'Propia', '#FF5D00')`).run(ws.id);
    db.prepare(`INSERT OR IGNORE INTO labels (id, workspace_id, name, color) VALUES ('hp-ajena-${RUN}', 'ws-auditoria', 'Ajena', '#FF5D00')`).run();
    db.close();
    await entrar(page);
    expect((await page.request.get(`/w/${ESP}/board/hechas?group=label&carril=hp-ajena-${RUN}`)).status()).toBe(404);
    // Control: el mismo carril, con una etiqueta de este espacio.
    expect((await page.request.get(`/w/${ESP}/board/hechas?group=label&carril=hp-propia-${RUN}`)).status()).toBe(200);
  });
});

test.describe('completar con un clic', () => {
  const ESP = `e2e-completar-${RUN}`;

  test('pasa a Hecho sin recargar, no abre el panel y se deshace', async ({ page }) => {
    const ws = espacio(ESP);
    const id = tarea(ws, { title: 'Para completar', status: 'in_progress' });
    await entrar(page);
    await page.goto(`/w/${ESP}/board`);
    await expect(page.locator('body[data-tablero-listo="true"]')).toHaveCount(1);
    const tarjeta = page.locator(`.issue-card[data-issue-id="${id}"]`);
    await tarjeta.locator('.btn-completar').click();

    await expect(page.locator(`.board-column[data-status="done"] .issue-card[data-issue-id="${id}"]`)).toBeVisible();
    await expect(page.locator('#issue-details-modal')).toHaveClass(/translate-x-full/);
    await expect.poll(() => {
      const db = getTestDb();
      const fila = db.prepare('SELECT status, done_at FROM issues WHERE id = ?').get(id) as any;
      db.close();
      return fila.status === 'done' && !!fila.done_at;
    }).toBe(true);

    await page.locator('#forge-toast-action').click();
    await expect(page.locator(`.board-column[data-status="in_progress"] .issue-card[data-issue-id="${id}"]`)).toBeVisible();
    const db = getTestDb();
    expect(db.prepare('SELECT status, done_at FROM issues WHERE id = ?').get(id)).toEqual({ status: 'in_progress', done_at: null });
    db.close();
  });
});

test.describe('ordenar es una acción', () => {
  const ESP = `e2e-ordenar-${RUN}`;

  test('ordenar por prioridad reescribe el orden, se puede arrastrar y se deshace', async ({ page }) => {
    const ws = espacio(ESP);
    tarea(ws, { title: 'Baja', priority: 'low', position: 100000 });
    tarea(ws, { title: 'Urgente', priority: 'highest', position: 200000 });
    await entrar(page);
    await page.goto(`/w/${ESP}/board`);
    const todo = page.locator('.board-column[data-status="todo"] .issue-card');
    await expect(todo.first()).toContainText('Baja');

    await page.locator('#btn-sort-menu').click();
    await page.locator('.orden-item[data-orden="priority"]').click();
    await page.waitForLoadState('load');
    await expect(todo.first()).toContainText('Urgente');

    // Sin `?sort=` ni diálogo de «volver al orden manual»: se arrastra sin más.
    await expect(page).not.toHaveURL(/sort=/);
    await todo.nth(1).dragTo(todo.first());
    await expect.poll(async () => (await todo.first().textContent())?.includes('Baja')).toBe(true);

    await page.goto(`/w/${ESP}/board`);
    await page.locator('#btn-sort-menu').click();
    await page.locator('.orden-item[data-orden="priority"]').click();
    await page.waitForLoadState('load');
    await page.locator('#forge-toast-action').click();
    await page.waitForLoadState('load');
    await expect(todo.first()).toContainText('Baja');
  });
});

test.describe('alta rápida', () => {
  const ESP = `e2e-alta-${RUN}`;

  test('una línea crea la tarea con fecha, hora, etiqueta, prioridad y apunte', async ({ page }) => {
    const ws = espacio(ESP);
    const db = getTestDb();
    db.prepare('DELETE FROM labels WHERE workspace_id = ?').run(ws.id);
    db.prepare(`INSERT INTO labels (id, workspace_id, name, color) VALUES ('lab-calc-${RUN}', ?, 'Cálculo', '#FF5D00')`).run(ws.id);
    db.prepare('DELETE FROM pages WHERE workspace_id = ?').run(ws.id);
    db.prepare(`INSERT INTO pages (id, workspace_id, title, created_by) VALUES ('pag-tema3-${RUN}', ?, 'Tema 3', ?)`).run(ws.id, ws.yo);
    db.close();

    await entrar(page);
    await page.goto(`/w/${ESP}/board`);
    await page.locator('#btn-new-issue').click();
    await expect(page.locator('#nueva-tarea-titulo')).toHaveText('Nueva tarea');
    await page.fill('#nt-linea', 'Entregar taller 15/11/2027 18:00 #calculo !1 [[Tema 3]]');
    await expect(page.locator('#nt-chips li')).toHaveCount(5);
    await page.locator('#nt-linea').press('Enter');
    await page.waitForLoadState('load');

    const tarjeta = page.locator('.issue-card', { hasText: 'Entregar taller' });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator('h4')).toHaveText('Entregar taller');
    await expect(tarjeta.locator('.card-labels')).toContainText('Cálculo');
    await expect(tarjeta.locator('.card-priority')).toContainText('Urgente');
    await expect(tarjeta.locator('.card-due')).toContainText('18:00');
    await expect(tarjeta.locator('.card-notes')).toBeVisible();

    const db2 = getTestDb();
    const fila = db2.prepare("SELECT id, due_date, due_time, priority FROM issues WHERE workspace_id = ? AND title = 'Entregar taller'").get(ws.id) as any;
    expect(fila).toMatchObject({ due_date: '2027-11-15', due_time: '18:00', priority: 'highest' });
    expect(db2.prepare('SELECT page_id FROM issue_page_links WHERE issue_id = ?').get(fila.id)).toEqual({ page_id: `pag-tema3-${RUN}` });
    db2.close();
  });

  test('una etiqueta que no existe se ofrece, no se crea sola', async ({ page }) => {
    espacio(ESP);
    await entrar(page);
    await page.goto(`/w/${ESP}/board`);
    await page.locator('#btn-new-issue').click();
    await page.fill('#nt-linea', 'Leer #inexistente');
    await expect(page.locator('#nt-chips')).toContainText('Crear etiqueta «inexistente»');
    const db = getTestDb();
    expect(db.prepare("SELECT COUNT(*) AS n FROM labels WHERE name = 'inexistente'").get()).toEqual({ n: 0 });
    db.close();
  });

  test('C abre el alta también fuera del tablero', async ({ page }) => {
    espacio(ESP);
    await entrar(page);
    await page.goto(`/w/${ESP}/p`);
    await page.locator('body').press('c');
    await expect(page.locator('#nueva-tarea')).toBeVisible();
  });
});

test.describe('fecha en el idioma de la app', () => {
  const ESP = `e2e-fecha-${RUN}`;

  test('en español se escribe dd/mm/aaaa y se guarda bien', async ({ page }) => {
    const ws = espacio(ESP);
    const id = tarea(ws, { title: 'Con fecha' });
    await entrar(page, 'es');
    await page.goto(`/w/${ESP}/board`);
    await page.locator(`.issue-card[data-issue-id="${id}"]`).click();
    const campo = page.locator('#modal-issue-due-date-texto');
    await expect(campo).toHaveAttribute('placeholder', 'dd/mm/aaaa');
    await campo.fill('05/03/2027');
    await campo.press('Enter');
    await expect.poll(() => {
      const db = getTestDb();
      const v = (db.prepare('SELECT due_date FROM issues WHERE id = ?').get(id) as any).due_date;
      db.close();
      return v;
    }).toBe('2027-03-05');
  });
});

test.describe('tipo de tarea', () => {
  const ESP = `e2e-tipo-${RUN}`;

  test('cambiarlo en el panel repinta nombre y franja sin recargar', async ({ page }) => {
    const ws = espacio(ESP);
    const id = tarea(ws, { title: 'Cambiará de tipo', type: 'task' });
    await entrar(page, 'es');
    await page.goto(`/w/${ESP}/board`);
    const tarjeta = page.locator(`.issue-card[data-issue-id="${id}"]`);
    await tarjeta.click();
    await page.locator('#modal-issue-type').selectOption('bug');
    const badge = tarjeta.locator('.issue-type-badge');
    await expect(badge).toHaveAttribute('data-type-key', 'bug');
    // El nombre traducido, no la clave cruda.
    await expect(badge).not.toHaveText(/^\s*bug\s*$/);
    const franja = await tarjeta.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--franja'));
    const db = getTestDb();
    const color = (db.prepare("SELECT color FROM issue_types WHERE workspace_id = ? AND key = 'bug'").get(ws.id) as any).color;
    db.close();
    expect(franja.trim().toLowerCase()).toBe(color.toLowerCase());
  });
});

test.describe('agrupar por etiqueta', () => {
  const ESP = `e2e-carriles-${RUN}`;

  test('un carril por etiqueta; una tarea con dos sale en los dos', async ({ page }) => {
    const ws = espacio(ESP);
    const db = getTestDb();
    db.prepare('DELETE FROM labels WHERE workspace_id = ?').run(ws.id);
    db.prepare(`INSERT INTO labels (id, workspace_id, name, color) VALUES ('car-a-${RUN}', ?, 'Álgebra', '#FF5D00'), ('car-b-${RUN}', ?, 'Biología', '#3B82F6')`).run(ws.id, ws.id);
    db.close();
    const doble = tarea(ws, { title: 'De las dos' });
    tarea(ws, { title: 'Sin etiqueta' });
    const db2 = getTestDb();
    db2.prepare(`INSERT INTO issue_labels (issue_id, label_id) VALUES (?, 'car-a-${RUN}'), (?, 'car-b-${RUN}')`).run(doble, doble);
    db2.close();

    await entrar(page);
    await page.goto(`/w/${ESP}/board?group=label`);
    await expect(page.locator('details.carril')).toHaveCount(3);
    await expect(page.locator(`.issue-card[data-issue-id="${doble}"]`)).toHaveCount(2);
    await expect(page.locator('details.carril[data-carril=""]')).toContainText('Sin etiqueta');
  });
});

test.describe('sprints encendidos: mover y borrar bien', () => {
  const ESP = `e2e-sprints-b2-${RUN}`;

  test('mover una tarea a otro sprint desde la tarjeta', async ({ page }) => {
    const ws = espacio(ESP, { sprints: 1 });
    const db = getTestDb();
    db.prepare(`INSERT INTO sprints (id, workspace_id, name) VALUES ('b2-a-${RUN}', ?, 'Sprint A'), ('b2-b-${RUN}', ?, 'Sprint B')`).run(ws.id, ws.id);
    db.close();
    const id = tarea(ws, { title: 'Sprint equivocado', sprint_id: `b2-a-${RUN}` });
    await entrar(page);
    await page.goto(`/w/${ESP}/board?sprint=b2-a-${RUN}`);
    await page.locator(`.issue-card[data-issue-id="${id}"] .btn-mover-sprint`).click();
    await page.locator(`#menu-sprint-tarjeta .sprint-destino[data-sprint="b2-b-${RUN}"]`).click();
    await expect(page.locator(`.issue-card[data-issue-id="${id}"]`)).toHaveCount(0);
    await expect.poll(() => {
      const d = getTestDb();
      const v = (d.prepare('SELECT sprint_id FROM issues WHERE id = ?').get(id) as any).sprint_id;
      d.close();
      return v;
    }).toBe(`b2-b-${RUN}`);
  });

  test('borrar un sprint eligiendo qué pasa con cada tarea', async ({ page }) => {
    const ws = espacio(ESP, { sprints: 1 });
    const db = getTestDb();
    db.prepare(`INSERT INTO sprints (id, workspace_id, name) VALUES ('b2-x-${RUN}', ?, 'Para borrar'), ('b2-y-${RUN}', ?, 'Destino')`).run(ws.id, ws.id);
    db.close();
    const conservar = tarea(ws, { title: 'Me quedo', sprint_id: `b2-x-${RUN}` });
    const tirar = tarea(ws, { title: 'Me voy', sprint_id: `b2-x-${RUN}` });
    await entrar(page);
    await page.goto(`/w/${ESP}/board?sprint=b2-x-${RUN}`);
    await page.locator('#btn-sprint-menu').click();
    await page.locator('#btn-delete-sprint').click();
    const dlg = page.locator('#borrar-sprint-modal');
    await expect(dlg).toBeVisible();
    await dlg.getByLabel('Qué pasa con «Me quedo»').selectOption(`b2-y-${RUN}`);
    await dlg.getByLabel('Qué pasa con «Me voy»').selectOption('borrar');
    await expect(page.locator('#borrar-sprint-confirmar')).toContainText('1');
    await page.locator('#borrar-sprint-confirmar').click();
    await page.waitForURL(/sprint=backlog/);

    const d = getTestDb();
    expect((d.prepare('SELECT sprint_id FROM issues WHERE id = ?').get(conservar) as any).sprint_id).toBe(`b2-y-${RUN}`);
    expect(d.prepare('SELECT 1 FROM issues WHERE id = ?').get(tirar)).toBeUndefined();
    expect(d.prepare(`SELECT 1 FROM sprints WHERE id = 'b2-x-${RUN}'`).get()).toBeUndefined();
    d.close();
  });
});

test.describe('vistas Hoy y Próximos', () => {
  const ESP = `e2e-vistas-${RUN}`;
  // El día de hoy en la zona del navegador de pruebas, que es la que la página
  // guarda en la cuenta al cargar.
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const masDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

  test('Hoy: vencidas y de hoy; ni las hechas ni las de mañana', async ({ page }) => {
    const ws = espacio(ESP);
    tarea(ws, { title: 'Vencida', due_date: masDias(-2) });
    tarea(ws, { title: 'De hoy', due_date: masDias(0) });
    tarea(ws, { title: 'De mañana', due_date: masDias(1) });
    tarea(ws, { title: 'Hecha de hoy', due_date: masDias(0), status: 'done' });
    await entrar(page);
    // Primera carga: la página manda la zona horaria; la segunda ya la usa.
    await page.goto(`/w/${ESP}/board`);
    await page.waitForTimeout(300);
    await page.goto(`/w/${ESP}/board?vista=hoy`);
    await expect(page.locator('[data-grupo="vencidas"]')).toContainText('Vencida');
    await expect(page.locator('[data-grupo="hoy"]')).toContainText('De hoy');
    await expect(page.locator('.issue-card', { hasText: 'De mañana' })).toHaveCount(0);
    await expect(page.locator('.issue-card', { hasText: 'Hecha de hoy' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Vista' }).locator('a[aria-current="page"]')).toHaveText('Hoy');
  });

  test('Próximos: arrastrar a otro día cambia el día de trabajo, nunca la entrega', async ({ page }) => {
    const ws = espacio(ESP);
    const entrega = masDias(5);
    const id = tarea(ws, { title: 'Se mueve', due_date: entrega });
    await entrar(page);
    await page.goto(`/w/${ESP}/board?vista=proximos`);
    const destino = masDias(2);
    await page.locator(`.issue-card[data-issue-id="${id}"]`).dragTo(page.locator(`.dia-proximos[data-fecha="${destino}"]`));
    await expect.poll(() => {
      const d = getTestDb();
      const v = d.prepare('SELECT due_date, planned_date FROM issues WHERE id = ?').get(id) as any;
      d.close();
      return `${String(v.due_date).slice(0, 10)}|${v.planned_date}`;
    }).toBe(`${entrega}|${destino}`);
    // La página se recarga sola al soltar: ahora sale en el día de trabajo,
    // con su línea «Lo hago».
    await expect(page.locator(`.dia-proximos[data-fecha="${destino}"] .issue-card[data-issue-id="${id}"] .card-planned`)).toBeVisible();
  });
});

test.describe('subtareas', () => {
  const ESP = `e2e-subtareas-${RUN}`;

  test('se añaden con Enter, la tarjeta cuenta y al terminar todas se ofrece completar', async ({ page }) => {
    const ws = espacio(ESP);
    const id = tarea(ws, { title: 'Informe de laboratorio' });
    await entrar(page);
    await page.goto(`/w/${ESP}/board`);
    await page.locator(`.issue-card[data-issue-id="${id}"] h4`).click();
    const nueva = page.locator('#modal-subtareas-nueva');
    await nueva.fill('Tomar datos');
    await nueva.press('Enter');
    await nueva.fill('Redactar');
    await nueva.press('Enter');
    const tarjeta = page.locator(`.issue-card[data-issue-id="${id}"]`);
    await expect(tarjeta.locator('.card-subtareas')).toContainText('0/2');

    await page.getByLabel('Hecha: «Tomar datos»').check();
    await page.getByLabel('Hecha: «Redactar»').check();
    await expect(tarjeta.locator('.card-subtareas')).toContainText('2/2');
    await expect(page.locator('#forge-toast-action')).toHaveText('Completar tarea');

    // No son tarjetas del tablero.
    await page.goto(`/w/${ESP}/board`);
    await expect(page.locator('.issue-card', { hasText: 'Tomar datos' })).toHaveCount(0);
  });
  test('dos seguidas con el servidor lento: no se pierde ninguna', async ({ page }) => {
    // Con la red o el servidor lentos, el campo se vaciaba al volver la
    // respuesta de la primera y borraba lo ya escrito para la segunda.
    const ws = espacio(ESP);
    const id = tarea(ws, { title: 'Con prisa' });
    await entrar(page);
    await page.route('**/subtareas', async (ruta) => {
      if (ruta.request().method() === 'POST') await new Promise((r) => setTimeout(r, 800));
      await ruta.continue();
    });
    await page.goto(`/w/${ESP}/board`);
    await page.locator(`.issue-card[data-issue-id="${id}"] h4`).click();
    const nueva = page.locator('#modal-subtareas-nueva');
    await nueva.fill('Primera');
    const primera = page.waitForResponse((r) => r.url().endsWith('/subtareas') && r.request().method() === 'POST');
    await nueva.press('Enter');
    // La segunda se está escribiendo cuando vuelve la respuesta de la primera:
    // es justo el momento en que antes se vaciaba el campo.
    await nueva.fill('Segunda');
    await primera;
    await nueva.press('Enter');
    await expect(page.locator(`.issue-card[data-issue-id="${id}"] .card-subtareas`)).toContainText('0/2');
    const db = getTestDb();
    const n = (db.prepare('SELECT COUNT(*) AS n FROM issues WHERE parent_issue_id = ?').get(id) as any).n;
    db.close();
    expect(n).toBe(2);
  });
});

test.describe('la tarjeta y el panel dicen lo mismo', () => {
  const ESP = `e2e-coherencia-${RUN}`;
  const nombreEnPanel = (page: Page) => page.locator('#modal-issue-type option:checked').textContent();
  const nombreEnTarjeta = (page: Page, id: string) =>
    page.locator(`.issue-card[data-issue-id="${id}"] .issue-type-badge`).textContent();

  test('tras cambiar el tipo, las etiquetas y renombrar en Ajustes, con y sin recargar', async ({ page }) => {
    const ws = espacio(ESP);
    const db = getTestDb();
    db.prepare('DELETE FROM labels WHERE workspace_id = ?').run(ws.id);
    db.prepare(`INSERT INTO labels (id, workspace_id, name, color) VALUES ('coh-l-${RUN}', ?, 'Química', '#FF5D00')`).run(ws.id);
    db.close();
    const id = tarea(ws, { title: 'Coherente', type: 'epic' });
    await entrar(page, 'es');
    await page.goto(`/w/${ESP}/board`);
    const tarjeta = page.locator(`.issue-card[data-issue-id="${id}"]`);

    // 1. Cambiar el tipo en el panel: la tarjeta dice el nombre, no la clave,
    //    y sin mayúsculas forzadas.
    await tarjeta.locator('h4').click();
    await page.locator('#modal-issue-type').selectOption('story');
    await expect(tarjeta.locator('.issue-type-badge')).toHaveAttribute('data-type-key', 'story');
    expect((await nombreEnTarjeta(page, id))?.trim()).toBe((await nombreEnPanel(page))?.trim());
    expect((await nombreEnTarjeta(page, id))?.trim()).toBe('Historia');
    await expect(tarjeta.locator('.issue-type-badge')).not.toHaveCSS('text-transform', 'uppercase');

    // 2. Poner una etiqueta en el panel: sale en la tarjeta sin recargar.
    await page.locator('#issue-details-modal .lp-toggle').click();
    await page.locator(`#issue-details-modal .lp-option[data-label-id="coh-l-${RUN}"]`).click();
    await expect(tarjeta.locator('.card-labels')).toContainText('Química');

    // 3. Recargar: lo mismo, ahora pintado por el servidor.
    await page.reload();
    expect((await nombreEnTarjeta(page, id))?.trim()).toBe('Historia');
    await expect(tarjeta.locator('.card-labels')).toContainText('Química');

    // 4. Renombrar el tipo en Ajustes y volver: tarjeta y panel, el nombre nuevo.
    const tipo = getTestDb();
    const fila = tipo.prepare("SELECT id FROM issue_types WHERE workspace_id = ? AND key = 'story'").get(ws.id) as any;
    tipo.close();
    const r = await page.request.patch(`/api/w/${ESP}/issue-types/${fila.id}`, { headers: ORIGIN, data: { name: 'Lectura' } });
    expect(r.status()).toBe(200);
    await page.goto(`/w/${ESP}/board`);
    expect((await nombreEnTarjeta(page, id))?.trim()).toBe('Lectura');
    await tarjeta.locator('h4').click();
    expect((await nombreEnPanel(page))?.trim()).toBe('Lectura');
  });
});

test.describe('repetir, calendario y recordatorios', () => {
  const ESP = `e2e-repetir-${RUN}`;

  test('una tarea de cada lunes: al completarla aparece la siguiente', async ({ page }) => {
    espacio(ESP);
    await entrar(page);
    await page.goto(`/w/${ESP}/board`);
    await page.locator('#btn-new-issue').click();
    await page.fill('#nt-linea', 'Lectura semanal cada lunes');
    await expect(page.locator('#nt-chips')).toContainText('cada lunes');
    await page.locator('#nt-linea').press('Enter');
    await page.waitForLoadState('load');
    const primera = page.locator('.issue-card', { hasText: 'Lectura semanal' });
    await expect(primera.locator('.card-repeat')).toBeVisible();
    await primera.locator('.btn-completar').click();
    await expect(page.locator('#forge-toast-msg')).toContainText('La siguiente queda para');
    await page.reload();
    await expect(page.locator('.board-column[data-status="todo"] .issue-card', { hasText: 'Lectura semanal' })).toHaveCount(1);
  });

  test('calendario .ics: el enlace sirve, devuelve 304 sin cambios y revocado da 404', async ({ page }) => {
    const ws = espacio(ESP);
    tarea(ws, { title: 'Entrega para el calendario', due_date: '2030-01-15' });
    await entrar(page);
    const creado = await page.request.post('/api/user/calendar', { headers: ORIGIN, data: { workspace_id: ws.id } });
    expect(creado.status()).toBe(201);
    const { id, url } = await creado.json();
    const ruta = new URL(url).pathname;

    // Sin sesión, como lo pide Google.
    const anonimo = await page.context().browser()!.newContext();
    const ics = await anonimo.request.get(`http://localhost:${PUERTO}${ruta}`);
    expect(ics.status()).toBe(200);
    expect(ics.headers()['content-type']).toContain('text/calendar');
    expect(await ics.text()).toContain('SUMMARY:Entrega para el calendario');
    const repetida = await anonimo.request.get(`http://localhost:${PUERTO}${ruta}`, { headers: { 'If-None-Match': ics.headers()['etag'] } });
    expect(repetida.status()).toBe(304);

    expect((await page.request.delete('/api/user/calendar', { headers: ORIGIN, data: { id } })).status()).toBe(200);
    expect((await anonimo.request.get(`http://localhost:${PUERTO}${ruta}`)).status()).toBe(404);
    // Control: un token que nunca existió da lo mismo, 404.
    expect((await anonimo.request.get(`http://localhost:${PUERTO}/cal/inventadoinventadoinventado.ics`)).status()).toBe(404);
    await anonimo.close();
  });

  test('el recordatorio se pone en el panel y necesita fecha', async ({ page }) => {
    const ws = espacio(ESP);
    const sin = tarea(ws, { title: 'Sin fecha para recordar' });
    const con = tarea(ws, { title: 'Con fecha para recordar', due_date: '2030-01-15' });
    await entrar(page);
    await page.goto(`/w/${ESP}/board`);
    await page.locator(`.issue-card[data-issue-id="${sin}"] h4`).click();
    await page.locator('#modal-issue-remind').selectOption('60');
    await expect(page.locator('#modal-issue-remind')).toHaveValue('');
    await page.goto(`/w/${ESP}/board`);
    await page.locator(`.issue-card[data-issue-id="${con}"] h4`).click();
    await page.locator('#modal-issue-remind').selectOption('1440');
    await expect.poll(() => {
      const d = getTestDb();
      const v = (d.prepare('SELECT reminder_minutes FROM issues WHERE id = ?').get(con) as any).reminder_minutes;
      d.close();
      return v;
    }).toBe(1440);
  });
});

test.describe('cabecera del tablero', () => {
  test('un nombre de espacio largo se lee entero, sin recortarse', async ({ page }) => {
    const ESP = `e2e-nombre-largo-${RUN}`;
    espacio(ESP, { sprints: 1, tiempo: 1, puntos: 1 });
    const db = getTestDb();
    db.prepare('UPDATE workspaces SET name = ? WHERE sys_tag = ?').run('Atlas Platform de Ingeniería de Sistemas Distribuidos', ESP);
    db.close();
    await entrar(page);
    for (const ancho of [1440, 1024, 700]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto(`/w/${ESP}/board`);
      const h1 = page.locator('main h1');
      await expect(h1).toContainText('Atlas Platform de Ingeniería de Sistemas Distribuidos');
      const recortado = await h1.evaluate((el) => {
        const cs = getComputedStyle(el);
        return cs.textOverflow === 'ellipsis' || el.scrollWidth > el.clientWidth + 1;
      });
      expect(recortado, `recortado a ${ancho}px`).toBe(false);
    }
  });
});

test.describe('avisos Web Push', () => {
  test('el navegador no pide permiso al cargar Ajustes; sin claves VAPID no se ofrece ni se acepta', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__pedidos = 0;
      if ('Notification' in window) {
        const original = Notification.requestPermission.bind(Notification);
        Notification.requestPermission = (...a: any[]) => { (window as any).__pedidos++; return original(...a); };
      }
    });
    await entrar(page);
    await page.goto('/settings');
    expect(await page.evaluate(() => (window as any).__pedidos)).toBe(0);
    // El servidor de pruebas no tiene claves: la sección no sale y suscribirse da 503.
    await expect(page.locator('#avisos-push')).toHaveCount(0);
    const r = await page.request.post('/api/user/push', {
      headers: ORIGIN,
      data: { endpoint: 'https://push.ejemplo.com/x', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHItJI5svbpez7KI4CCXg' } },
    });
    expect(r.status()).toBe(503);
    // El service worker y el manifest se sirven desde el propio origen.
    expect((await page.request.get('/sw.js')).status()).toBe(200);
    expect((await page.request.get('/manifest.webmanifest')).status()).toBe(200);
  });
});
