import { test, expect } from '@playwright/test';
import { registerViaForm, submitRegisterForm } from './helpers/register';

/**
 * El registro, por el formulario, tal como lo usa una persona.
 *
 * Existe porque la suite no cubría este flujo: cuando el formulario pasó a
 * pedir correo y a resolver una suma, el único spec que se registraba se quedó
 * colgado 30 segundos y murió por timeout, sin decir qué campo faltaba.
 */

test('una cuenta nueva se crea resolviendo la suma', async ({ page }) => {
  await page.context().clearCookies();
  await registerViaForm(page, { username: 'reg_ok_' + Date.now() });
  // Registrarse deja sesión iniciada: no se vuelve al login.
  await expect(page).not.toHaveURL(/\/login/);
});

test('sin resolver la suma no se registra a nadie', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/register');
  await page.fill('input[name="username"]', 'reg_nocap_' + Date.now());
  await page.fill('input[name="email"]', 'nocap@example.test');
  await page.fill('input[name="password"]', 'LocalDevPass123!');
  await page.click('button[type="submit"]');

  // El campo del captcha es `required`, así que el navegador ni siquiera envía.
  await expect(page).toHaveURL(/\/register/);
});

test('una suma mal resuelta muestra el error y trae una suma nueva', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/register');
  const before = await page.locator('.af-sum').textContent();

  await page.fill('input[name="username"]', 'reg_bad_' + Date.now());
  await page.fill('input[name="email"]', 'bad@example.test');
  await page.fill('input[name="password"]', 'LocalDevPass123!');
  await page.fill('input[name="captcha_answer"]', '999');
  await page.click('button[type="submit"]');

  await expect(page.locator('#auth-error')).toBeVisible();
  // El mensaje dice «prueba con la suma nueva»; tiene que haber una.
  await expect(page.locator('.af-sum')).not.toHaveText(before ?? '');
  await expect(page.locator('input[name="captcha_answer"]')).toHaveValue('');
});

test('un nombre reservado se rechaza en el idioma del usuario', async ({ page }) => {
  await page.context().clearCookies();
  await submitRegisterForm(page, { username: 'admin' });

  await expect(page).toHaveURL(/\/register/);
  await expect(page.locator('#auth-error')).toContainText(/reserved|reserva/i);
});

test('un nombre inapropiado se rechaza aunque venga disfrazado', async ({ page }) => {
  await page.context().clearCookies();
  await submitRegisterForm(page, { username: 'f.u.c.k' });

  await expect(page).toHaveURL(/\/register/);
  await expect(page.locator('#auth-error')).toBeVisible();
});
