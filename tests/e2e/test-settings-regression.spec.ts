import { test, expect } from '@playwright/test';

test('Settings regression: Sidebar handles missing workspace and navigates successfully', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'TestUserSettings');
  await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/); 
  
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  
  // Verify that NO link has href="#"
  const links = await page.locator('nav a').all();
  for (const link of links) {
    const href = await link.getAttribute('href');
    expect(href).not.toBe('#');
  }

  // Change username and save
  await page.fill('#username-input', 'TestUserSettings2');

  // Se espera a que la recarga **termine**, no un tiempo fijo. Al guardar,
  // `settings.astro` programa `window.location.reload()` a los 1200 ms; este
  // test esperaba 1000. Pulsaba el enlace del lateral y, 200 ms después, la
  // recarga pendiente lo devolvía a /settings y la comprobación final fallaba.
  // Pasaba solo cuando la navegación ganaba la carrera.
  await Promise.all([
    page.waitForURL('**/settings', { waitUntil: 'load' }),
    page.click('#btn-save-settings'),
  ]);
  
  // Now click a link in the sidebar
  const sidebarLink = page.locator('nav a').first();
  await sidebarLink.click();
  
  // It should navigate away from /settings
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('/settings');
});
