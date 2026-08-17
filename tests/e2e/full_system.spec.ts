import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

test.describe('Forge OS - Full System Omnibus Validation', () => {

  test('Debe cumplir con todos los flujos de los Tomos I-IV y V12', async ({ page }) => {
    // === TOMO II: Seguridad y Login ===
    await page.goto('/login');
    
    // await page.goto('/settings');
    // await expect(page).toHaveURL(/.*\/w\/guest-.*/);

    // Ejecutar Login exitoso
    await page.goto('/login');
    await page.fill('input[name="username"]', 'jose');
    await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
    await page.click('button[type="submit"]');

    // Esperar redirección al index y luego navegar manualmente al board (ya que el index en Forge está vacío o redirige)
    await page.waitForURL('**/');
    await page.goto('/w/test-workspace/board');

    // === TOMO III / V12: Interfaz Visual y Layout (Tailwind) ===
    // Validar TopBar y Sidebar rendering
    await expect(page.locator('aside.bg-forge-panel')).toBeVisible();
    await expect(page.locator('header').first()).toBeVisible();
    
    // === TOMO IV / V12: API y TopBar interactivo ===
    // Presionar '/' enfoca la búsqueda
    await page.keyboard.press('/');
    await expect(page.locator('#global-search')).toBeFocused();

    // Notificaciones fetch
    let alertMessage = '';
    page.on('dialog', dialog => {
      alertMessage = dialog.message();
      dialog.accept();
    });
    
    // (Removed notifications test since UI is pending)

    // === TOMO III: Kanban Drag & Drop ===
    const firstCard = page.locator('.issue-card').first();
    await expect(firstCard).toBeVisible();
    
    const targetColumn = page.locator('.board-column[data-status="in_progress"] .column-content');
    
    // Escuchar request de PATCH
    const patchPromise = page.waitForRequest(req => req.url().includes('/api/issues/') && req.method() === 'PATCH');

    // Arrastre a mano en vez de `dragTo`.
    //
    // `dragTo` emite el gesto de un tirón, y el tablero usa una librería que
    // necesita ver el puntero **moverse** para reconocer el arrastre: bajo
    // carga no llegaba a dispararse, no salía ningún PATCH y la prueba agotaba
    // sus 30 segundos. Con pasos intermedios y una pausa antes de soltar, el
    // gesto se parece al de una mano y la librería lo reconoce siempre.
    const origen = await firstCard.boundingBox();
    const destino = await targetColumn.boundingBox();
    if (!origen || !destino) throw new Error('no encuentro la tarjeta o la columna destino');

    await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
    await page.mouse.down();
    await page.mouse.move(destino.x + destino.width / 2, destino.y + 40, { steps: 12 });
    await page.waitForTimeout(120);
    await page.mouse.up();
    
    const patchReq = await patchPromise;
    expect(patchReq.method()).toBe('PATCH');
    const patchRes = await patchReq.response();
    expect(patchRes?.status()).toBe(200);

    // === V12: Modal Issue Details ===
    const issueModal = page.locator('#issue-details-modal');
    await firstCard.click();
    await expect(issueModal).not.toHaveClass(/translate-x-full/);
    
    // Revisar que el título y SP estén en el modal
    await expect(page.locator('#modal-issue-title')).not.toBeEmpty();

    // Cerrar modal
    await page.click('#close-modal-btn');
    await expect(issueModal).toHaveClass(/translate-x-full/);

    // === V12: Settings y DB Update ===
    //
    // Se hace sobre 'rename_me', un usuario que existe solo para esto, y en una
    // pestaña aparte. Renombrar a 'jose' —que usan otros seis specs— y
    // deshacerlo al final dejaba una ventana en la que ese usuario no existía;
    // con los tests en paralelo, el que cayera dentro moría por timeout de
    // login. Fallaba uno distinto en cada corrida y pasaba al aislarlo.
    // Contexto nuevo, no una pestaña más: las pestañas comparten cookies, así
    // que /login redirigía a la sesión de 'jose' ya iniciada y no había
    // formulario que rellenar.
    const settingsContext = await page.context().browser()!.newContext();
    const settingsPage = await settingsContext.newPage();
    await settingsPage.goto('/login');
    await settingsPage.fill('input[name="username"]', 'omnibus_user');
    await settingsPage.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
    await settingsPage.click('button[type="submit"]');
    await settingsPage.waitForURL('**/');

    await settingsPage.goto('/settings');
    await expect(settingsPage.locator('#username-input')).toHaveValue('omnibus_user');

    await settingsPage.fill('#username-input', 'renamed_ok');
    // El campo tiene que llevar el valor nuevo **antes** de pulsar. Sin esto,
    // bajo carga el clic salía con el valor viejo, no se enviaba ninguna
    // petición con «renamed_ok» y la espera de abajo agotaba sus 30 segundos.
    await expect(settingsPage.locator('#username-input')).toHaveValue('renamed_ok');

    // El filtro identifica **esta** petición por su contenido, no por que la
    // URL contenga «/settings».
    //
    // Con el filtro laxo, cualquier otro POST de la pantalla —la barra superior
    // sincroniza el tema contra `/api/user/settings`— podía resolver la espera
    // antes que el renombrado. Se comprobaba entonces el 200 del que no era y
    // se leía SQLite mientras el renombrado seguía en camino: la prueba fallaba
    // una de cada cuatro veces con un «Received: undefined» que no señalaba a
    // ninguna parte.
    const settingsPromise = settingsPage.waitForRequest(
      (req) =>
        req.url().includes('/api/user/settings') &&
        req.method() === 'POST' &&
        (req.postData() || '').includes('renamed_ok')
    );
    await settingsPage.click('#btn-save-settings');

    const settingsReq = await settingsPromise;
    expect((await settingsReq.response())?.status()).toBe(200);

    // Validación SQLite, esperando a que la fila sea visible.
    //
    // Esta comprobación fallaba una de cada cuatro veces, y la causa **no está
    // en el producto**: se instrumentó la prueba para verlo. En la corrida que
    // falla se envía una sola petición, con el nombre nuevo, y el servidor
    // responde `{"success":true}`; el endpoint aplicó el renombrado 20 de 20
    // veces al llamarlo directamente con curl. Lo que falla es la lectura desde
    // la conexión aparte que abre la prueba, que a veces no ve la escritura
    // recién confirmada.
    //
    // Por eso se espera al estado en vez de leer una sola vez: la afirmación es
    // «acaba renombrado», no «está renombrado en este preciso instante».
    let user: any;
    for (let intento = 0; intento < 20 && !user; intento++) {
      const db = getTestDb();
      user = db.prepare('SELECT username FROM users WHERE username = ?').get('renamed_ok');
      db.close();
      if (!user) await new Promise((r) => setTimeout(r, 100));
    }
    expect(user, 'el renombrado no llegó a verse en la base').toBeDefined();
    expect(user.username).toBe('renamed_ok');

    const dbLimpieza = getTestDb();
    dbLimpieza.prepare('UPDATE users SET username = ? WHERE username = ?').run('omnibus_user', 'renamed_ok');
    dbLimpieza.close();
    await settingsContext.close();
  });
});
