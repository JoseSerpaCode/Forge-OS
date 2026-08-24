import { test, expect } from '@playwright/test';

/**
 * Un 404 no cuenta nada de la fila.
 *
 * `api/friends/reject/[id].ts` devolvía `dbState` con el `SELECT *` entero de
 * la amistad —`action_user_id`, el id de la otra persona, las marcas de
 * tiempo— a quien acababa de fallar la comprobación de permisos. Era
 * depuración que se quedó puesta, y convertía un «no puedes» en un volcado de
 * la tabla. Sus dos hermanos responden con la frase a secas.
 */
test('el rechazo de una solicitud inexistente no filtra la fila', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const res = await page.request.post('/api/friends/reject/no-existe-este-id', {
    headers: { Origin: 'http://localhost:4322' },
  });
  expect(res.status()).toBe(404);

  const cuerpo = await res.text();

  // Ni el volcado, ni las columnas que llevaba dentro.
  for (const filtrado of ['dbState', 'action_user_id', 'user_a_id', 'user_b_id', 'updated_at']) {
    expect(cuerpo, `el 404 sigue contando «${filtrado}»`).not.toContain(filtrado);
  }
  // Y tampoco el id de quien pregunta, que tampoco pintaba nada ahí.
  expect(cuerpo).not.toContain('userId');
});
