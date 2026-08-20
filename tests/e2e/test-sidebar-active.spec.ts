import { test, expect } from '@playwright/test';

test('Sidebar active states toggle correctly', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'TestUserSidebar');
  await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/);
  
  // Go to Dashboard
  await page.goto('/w/test-workspace');
  await page.waitForLoadState('networkidle');
  
  // Acotado a `#app-sidebar`: con la barra inferior de móvil en el DOM —oculta
  // en escritorio, pero presente— `nav a` casaba con dos menús y el localizador
  // dejaba de ser único. El id dice lo que la prueba siempre quiso decir.
  const dashboardLink = page.locator('#app-sidebar a', { hasText: 'Dashboard' });
  const kanbanLink = page.locator('#app-sidebar a', { hasText: 'Kanban Board' });
  
  await expect(dashboardLink).toHaveClass(/active/);
  await expect(kanbanLink).not.toHaveClass(/active/);
  
  // Click Kanban Board
  await kanbanLink.click();
  await page.waitForURL('**/board');
  
  // Verify classes swapped
  await expect(kanbanLink).toHaveClass(/active/);
  await expect(dashboardLink).not.toHaveClass(/active/);
});
