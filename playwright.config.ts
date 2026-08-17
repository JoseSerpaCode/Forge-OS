import { defineConfig, devices } from '@playwright/test';

process.env.NODE_ENV = 'test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  globalSetup: './tests/e2e/reset-db.ts',
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: 'http://localhost:4322',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      // Las de `movil/` las corre el proyecto de abajo, en un teléfono.
      testIgnore: /movil\/.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /**
     * Móvil.
     *
     * No corre la suite entera en un teléfono: eso duplicaría el tiempo de CI
     * para volver a comprobar cosas que no dependen del tamaño de pantalla.
     * Solo las pruebas de `tests/e2e/movil/`, que son las que existen
     * precisamente porque en un móvil el resultado es distinto.
     *
     * Pixel 5 son 393×851. Se eligió ese y no uno más ancho porque los
     * problemas de este proyecto aparecen por debajo de 400px: cuatro columnas
     * de kanban de 320px, un árbol de páginas de 288px fijos y un diálogo de
     * confirmación de 420px sin `max-w`.
     */
    {
      name: 'movil',
      testMatch: /movil\/.*\.spec\.ts$/,
      use: { ...devices['Pixel 5'] },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'NODE_ENV=test PORT=4322 npm run build && NODE_ENV=test PORT=4322 node server.mjs',
    url: 'http://localhost:4322/login', // Use /login so it waits for the astro server to actually be ready to handle requests
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
