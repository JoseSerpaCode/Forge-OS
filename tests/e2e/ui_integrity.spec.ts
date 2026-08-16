import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';
import path from 'path';

test.describe('UI Integrity & DB Sync', () => {
  test('Debe permitir cambiar el username en Settings y reflejarse en SQLite', async ({ page }) => {
    // 1. Iniciar sesión
    await page.goto('/login');
    await page.fill('input[name="username"]', 'jose');
    await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
    await page.click('button[type="submit"]');
    
    // 2. Navegar a Dashboard y luego a Settings
    await page.waitForURL('**/');
    
    // Configurar listener de diálogos porque tiramos 'alert()' en JS
    page.on('dialog', dialog => dialog.accept());

    // El bloque de usuario dejó de ser un enlace directo a los ajustes: ahora
    // abre un menú, porque desde ahí se llega también al perfil y a las
    // solicitudes de amistad, que antes no tenían ninguna puerta.
    await page.click('#btn-user-menu');
    await page.click('#user-menu a[href="/settings"]');
    await page.waitForURL('**/settings');
    
    // 3. Cambiar username
    await page.fill('#username-input', 'jose_modificado');
    
    const requestPromise = page.waitForRequest(req => req.url().includes('/user/settings') && req.method() === 'POST');
    await page.click('#btn-save-settings');
    
    const request = await requestPromise;
    const response = await request.response();
    expect(response?.status()).toBe(200);
    
    // 4. Validar en Base de Datos directamente
    const db = getTestDb();
    const user = db.prepare('SELECT username FROM users WHERE username = ?').get('jose_modificado') as any;
    
    expect(user).toBeDefined();
    expect(user.username).toBe('jose_modificado');
    
    // Rollback para no romper siguientes pruebas
    db.prepare('UPDATE users SET username = ? WHERE username = ?').run('jose', 'jose_modificado');
    db.close();
  });
});
