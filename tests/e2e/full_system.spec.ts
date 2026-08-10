import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';
import path from 'path';

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
    await firstCard.dragTo(targetColumn);
    
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
    await settingsPage.fill('input[name="username"]', 'rename_me');
    await settingsPage.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
    await settingsPage.click('button[type="submit"]');
    await settingsPage.waitForURL('**/');

    await settingsPage.goto('/settings');
    await expect(settingsPage.locator('#username-input')).toHaveValue('rename_me');

    await settingsPage.fill('#username-input', 'renamed_ok');

    const settingsPromise = settingsPage.waitForRequest(req => req.url().includes('/settings') && req.method() === 'POST');
    await settingsPage.click('#btn-save-settings');

    const settingsReq = await settingsPromise;
    expect((await settingsReq.response())?.status()).toBe(200);

    // Validación SQLite
    const db = getTestDb();
    const user = db.prepare('SELECT username FROM users WHERE username = ?').get('renamed_ok') as any;
    expect(user).toBeDefined();
    expect(user.username).toBe('renamed_ok');

    db.prepare('UPDATE users SET username = ? WHERE username = ?').run('rename_me', 'renamed_ok');
    db.close();
    await settingsContext.close();
  });
});
