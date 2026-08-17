import { test, } from '@playwright/test';

test('smoke: login redirige correctamente', async ({ page }) => {
  page.on('response', response => {
    if (response.url().includes('/api/auth/login') && response.request().method() === 'POST') {
      console.log('LOGIN POST STATUS:', response.status());
    }
  });

  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 10000 });
});
