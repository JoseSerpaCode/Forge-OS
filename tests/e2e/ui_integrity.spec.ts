import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';
import { registerViaForm } from './helpers/register';

test.describe('UI Integrity & DB Sync', () => {
  test('Debe permitir cambiar el username en Settings y reflejarse en SQLite', async ({ page }) => {
    // 1. Una cuenta propia. Renombraba a `jose`, y durante esos segundos las
    // pruebas que corren en paralelo y lo buscan por nombre no lo encontraban.
    const nombre = `integ_${Date.now()}`;
    const nuevo = `${nombre}_mod`;
    await registerViaForm(page, { username: nombre });
    
    // Configurar listener de diálogos porque tiramos 'alert()' en JS
    page.on('dialog', dialog => dialog.accept());

    // El bloque de usuario dejó de ser un enlace directo a los ajustes: ahora
    // abre un menú, porque desde ahí se llega también al perfil y a las
    // solicitudes de amistad, que antes no tenían ninguna puerta.
    await page.click('#btn-user-menu');
    await page.click('#user-menu a[href="/settings"]');
    await page.waitForURL('**/settings');
    
    // 3. Cambiar username
    await page.fill('#username-input', nuevo);
    
    const requestPromise = page.waitForRequest(req => req.url().includes('/user/settings') && req.method() === 'POST');
    await page.click('#btn-save-settings');
    
    const request = await requestPromise;
    const response = await request.response();
    expect(response?.status()).toBe(200);
    
    // 4. Validar en Base de Datos directamente
    const db = getTestDb();
    const user = db.prepare('SELECT username FROM users WHERE username = ?').get(nuevo) as any;

    expect(user).toBeDefined();
    expect(user.username).toBe(nuevo);
  });
});
