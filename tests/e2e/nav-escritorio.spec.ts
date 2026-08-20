import { test, expect } from '@playwright/test';

/**
 * En escritorio no hay barra inferior.
 *
 * La barra de móvil sustituye al cajón lateral solo por debajo de `md`. Sin
 * esta comprobación, un cambio de punto de corte la dejaría colada bajo el pie
 * de página en pantalla grande y nadie se enteraría: las pruebas de móvil
 * seguirían en verde, porque allí sí tiene que estar.
 */
test('el menú lateral es el único menú en pantalla grande', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  await expect(page.locator('#app-sidebar')).toBeVisible();
  await expect(page.locator('nav.nav-movil')).toBeHidden();
});
