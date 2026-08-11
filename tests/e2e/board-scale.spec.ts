import { test, expect } from '@playwright/test';

/**
 * El tablero no puede pintar un backlog entero.
 *
 * La consulta no tenía `LIMIT`: medido en local, 2.000 issues generaban 5 MB de
 * HTML en una sola carga. En la `e2-micro` de producción eso es un proceso de
 * 1 GB de RAM renderizando 5 MB, y el tier gratuito da 1 GB de egress al mes:
 * doscientas aperturas del tablero se lo comen entero. Y Cloudflare no puede
 * ayudar, porque es HTML privado por usuario.
 *
 * El espacio de trabajo se crea aquí y no se reutiliza el compartido: los 120
 * issues que hacen falta para pasar del tope contaminaban `test-workspace`, que
 * usan otros diez specs, y hacían fallar de forma intermitente al más largo de
 * todos —uno distinto en cada corrida, verde al aislarlo—.
 */
const LIMIT = 100;

test('el tablero acota por columna y dice lo que deja fuera', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const origin = new URL(page.url()).origin;
  const tag = `scale-${Date.now()}`;

  const created = await page.request.post('/api/workspaces', {
    data: { name: 'Board scale', sys_tag: tag },
    headers: { Origin: origin },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const wsId = (await created.json()).id ?? (await created.json()).workspace_id;

  // 120 issues en una sola columna: por encima del tope, para que se note.
  await page.evaluate(async (wsId) => {
    for (let i = 0; i < 120; i++) {
      await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: wsId, title: `Escala ${i}`, type: 'task', status: 'todo' }),
      });
    }
  }, wsId);

  await page.goto(`/w/${tag}/board?sprint=backlog`);
  const col = page.locator('.board-column[data-status="todo"]');

  // Se pinta el tope, no todo.
  await expect(col.locator('.issue-card')).toHaveCount(LIMIT);

  // Pero el contador dice la verdad, y hay aviso de lo que falta.
  const shown = Number(await col.getAttribute('data-shown'));
  const total = Number(await col.getAttribute('data-total'));
  expect(shown).toBe(LIMIT);
  expect(total).toBe(120);
  expect(Number(await col.locator('.issue-count').textContent())).toBe(total);
  await expect(col.getByText(`${shown} / ${total}`)).toBeVisible();
});
