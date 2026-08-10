import type { Page } from '@playwright/test';

/**
 * Registra una cuenta rellenando el formulario, captcha incluido.
 *
 * Varios specs hacían esto a mano con dos `fill()` —usuario y contraseña—, y se
 * quedaron colgados en cuanto el registro pasó a pedir correo y a resolver una
 * suma. Aquí está en un sitio, así que el próximo campo obligatorio se añade
 * una vez y no en cinco ficheros.
 *
 * El captcha se resuelve leyendo el enunciado de la página, que es exactamente
 * lo que hace una persona. No se puentea ni se desactiva en pruebas: un captcha
 * que los tests saltan es un captcha que nadie comprueba que siga funcionando.
 */
type Account = { username: string; password?: string; email?: string };

/**
 * Rellena el formulario y lo envía, **sin esperar a que navegue**.
 *
 * Separado de `registerViaForm` porque los casos de rechazo —nombre reservado,
 * nombre inapropiado— no navegan nunca: esperar la navegación en ellos agota
 * los 30 segundos del test y lo mata antes de poder mirar el mensaje de error.
 */
export async function submitRegisterForm(
  page: Page,
  { username, password = 'LocalDevPass123!', email }: Account
): Promise<void> {
  await page.goto('/register');

  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email ?? `${username}@example.test`);
  await page.fill('input[name="password"]', password);

  const sum = (await page.locator('.af-sum').textContent()) ?? '';
  const answer = sum.split('+').reduce((total, part) => total + Number(part.trim()), 0);
  await page.fill('input[name="captcha_answer"]', String(answer));

  await page.click('button[type="submit"]');
}

/** Registra una cuenta y espera a estar dentro. Para el camino feliz. */
export async function registerViaForm(page: Page, account: Account): Promise<void> {
  await submitRegisterForm(page, account);
  await page.waitForURL('**/');
}
