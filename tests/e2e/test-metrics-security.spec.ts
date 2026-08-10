import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { registerViaForm } from './helpers/register';

test.describe('Metrics API Security', () => {
  let outsiderContext: BrowserContext;
  let outsiderPage: Page;
  
  test.beforeAll(async ({ browser }) => {
    // Create an outsider user
    outsiderContext = await browser.newContext();
    outsiderPage = await outsiderContext.newPage();
    
    // Register the outsider. Va por el ayudante porque el formulario pide
    // ahora correo y una suma; hacerlo a mano aquí se quedaba colgado sin
    // decir por qué.
    await registerViaForm(outsiderPage, {
      username: 'outsider_metrics_' + Date.now(),
      password: 'outsider123',
    });
  });

  test.afterAll(async () => {
    await outsiderContext.close();
  });

  test('Outsider receives 403 or 404 when trying to access metrics of SYS workspace', async () => {
    // The outsider is NOT a member of 'SYS'
    
    // Test Distribution
    const distResponse = await outsiderPage.request.get('/api/w/SYS/metrics/distribution');
    const distStatus = distResponse.status();
    expect(distStatus === 404 || distStatus === 403).toBeTruthy();

    // Test Burndown
    const burnResponse = await outsiderPage.request.get('/api/w/SYS/metrics/burndown?sprint_id=some_id');
    const burnStatus = burnResponse.status();
    expect(burnStatus === 404 || burnStatus === 403).toBeTruthy();
    
    // Test Velocity
    const velResponse = await outsiderPage.request.get('/api/w/SYS/metrics/velocity');
    const velStatus = velResponse.status();
    expect(velStatus === 404 || velStatus === 403).toBeTruthy();
    
    // Test Precision
    const precResponse = await outsiderPage.request.get('/api/w/SYS/metrics/precision');
    const precStatus = precResponse.status();
    expect(precStatus === 404 || precStatus === 403).toBeTruthy();
  });
});
