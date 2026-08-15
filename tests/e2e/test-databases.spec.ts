import { test, expect } from '@playwright/test';

test.describe('Dynamic Databases Module', () => {
  test('Should render DB module and create a new dynamic table', async ({ page, request }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'jose');
    await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/);

    // 2. Navigate to Database module in test workspace
    const res = await page.goto('/w/test-workspace/db');
    expect(res?.status()).toBe(200);

    // 3. Verify page renders without 500 error
    await expect(page.locator('h1')).toContainText('Databases & Tables');

    // 4. Click Create New Table
    await page.click('#btn-new-db');
    const modal = page.locator('#new-db-modal');
    await expect(modal).toBeVisible();

    // 4b. The modal now opens on the template gallery. This test builds its own
    // columns, so it takes the blank table.
    await page.click('[data-tpl="__blank__"]');
    await expect(page.locator('#step-form')).toBeVisible();

    // 5. Fill out the form
    await page.fill('#db-name', 'E2E Test CRM');
    await page.fill('#db-desc', 'Automated CRM tracker for E2E testing');
    
    // Add a custom column
    await page.click('#btn-add-col');
    const newCol = page.locator('.col-def').nth(1);
    await newCol.locator('.col-name').fill('Revenue');
    await newCol.locator('.col-type').selectOption('number');

    // 6. Submit the form by interacting with API (or clicking save)
    // We'll click Save and wait for the redirect to the DB details page
    const navPromise = page.waitForNavigation({ url: /.*\/db\/.*/ });
    await page.click('#btn-save-db');
    await navPromise;

    // 7. Verify we are inside the newly created database page
    await expect(page.locator('h1')).toContainText('E2E Test CRM');
    await expect(page.locator('th').filter({ hasText: 'Revenue' })).toBeVisible();
    
    // 8. Add a new row to ensure dynamic_entries doesn't crash
    await page.click('#btn-add-row');
    // Ensure row was added by looking for a row in tbody
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });
});
