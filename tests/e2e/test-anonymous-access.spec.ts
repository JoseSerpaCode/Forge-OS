import { test, expect } from '@playwright/test';

/**
 * Una petición anónima no debe crear estado persistente.
 *
 * Antes, entrar a cualquier ruta privada sin sesión hacía que el middleware
 * creara una cuenta de invitado en el acto —usuario, espacio de trabajo,
 * membresía y sesión— y te soltara dentro. En producción los bots, que no
 * guardan cookies, generaban así unas 43.000 cuentas al día.
 *
 * Este archivo sustituye a test-debug2.spec.ts, que afirmaba justo ese
 * comportamiento.
 */

test('una ruta privada sin sesión lleva a la landing, no a un espacio de invitado', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/settings');

  await expect(page).toHaveURL(/\/$/);
  await expect(page).not.toHaveURL(/\/w\/guest-/);
});

test('la landing se sirve sin sesión y ofrece las tres salidas', async ({ page }) => {
  await page.context().clearCookies();
  const res = await page.goto('/');

  expect(res?.status()).toBe(200);
  await expect(page.locator('h1')).toContainText('forge.db');

  // Probar sin cuenta, iniciar sesión y registrarse: las tres visibles sin
  // tener que buscarlas.
  await expect(page.locator('form[action="/api/auth/guest"] button').first()).toBeVisible();
  await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  await expect(page.locator('a[href="/register"]').first()).toBeVisible();
});

test('la cuenta de invitado se crea solo al pedirla, y avisa de lo que es', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/');

  // El aviso va junto al botón, antes de decidir — no escondido después.
  await expect(page.getByText(/temporary workspace|espacio temporal/i).first()).toBeVisible();

  await page.locator('form[action="/api/auth/guest"] button').first().click();
  await expect(page).toHaveURL(/\/w\/guest-/);

  // Y una vez dentro, la app sigue diciendo que la cuenta es temporal.
  await expect(page.locator('.gb')).toBeVisible();
});
