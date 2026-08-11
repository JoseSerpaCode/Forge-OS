import { test, expect } from '@playwright/test';

/**
 * Etiquetas de formulario.
 *
 * 49 de 62 `<label>` no tenían `for`: ni las anunciaba un lector de pantalla ni
 * funcionaba el clic sobre el texto para enfocar el campo.
 *
 * Al enlazarlas en bloque me salió el fallo que esta prueba fija: en las
 * casillas de notificaciones el control va **dentro** de su etiqueta, así que
 * al buscar «el control siguiente» cada `for` acabó apuntando a la casilla de
 * la fila de abajo. Eso es peor que no tener etiqueta: pulsar «silenciar
 * asignaciones» habría cambiado «silenciar menciones», y de forma
 * silenciosa. La comprobación estructural de más abajo no lo detecta —los
 * destinos existían—, así que hace falta comprobar el comportamiento.
 */

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('cada `for` apunta a un control que existe, y ningún id está repetido', async ({ page }) => {
  await entrar(page);

  for (const ruta of ['/settings', '/w/test-workspace/settings', '/w/test-workspace/board']) {
    await page.goto(ruta);

    const roto = await page.evaluate(() =>
      [...document.querySelectorAll('label[for]')]
        .map((l) => (l as HTMLLabelElement).htmlFor)
        .filter((id) => !document.getElementById(id))
    );
    expect(roto, `etiquetas apuntando al vacío en ${ruta}`).toEqual([]);

    const repetidos = await page.evaluate(() => {
      const vistos = new Map<string, number>();
      for (const el of document.querySelectorAll('[id]')) {
        vistos.set(el.id, (vistos.get(el.id) || 0) + 1);
      }
      return [...vistos].filter(([, n]) => n > 1).map(([id]) => id);
    });
    // Un id repetido rompe `for` aunque el destino exista: gana el primero.
    expect(repetidos, `ids repetidos en ${ruta}`).toEqual([]);
  }
});

test('pulsar el texto de una casilla cambia la casilla que dice, no la de al lado', async ({ page }) => {
  await entrar(page);
  await page.goto('/settings');

  const casillas = ['notif-mute-all', 'notif-mute-assign', 'notif-mute-mention', 'notif-mute-sprint', 'notif-mute-system'];
  const antes = await page.evaluate(
    (ids) => ids.map((id) => (document.getElementById(id) as HTMLInputElement).checked),
    casillas
  );

  // Se pulsa la etiqueta, no la casilla: es lo que hace una persona, y es
  // justo donde vivía el fallo. Se localiza por estructura y no por texto
  // porque el idioma de la pantalla depende de la cookie y del navegador.
  //
  // Detalle que hace que la prueba valga: cuando una etiqueta tiene `for`, el
  // navegador **ignora** el control que envuelve y obedece al `for`. Por eso un
  // `for` mal puesto sobre una etiqueta que ya envolvía su casilla cambiaba la
  // de la fila siguiente.
  await page.locator('label:has(#notif-mute-assign)').click();

  const despues = await page.evaluate(
    (ids) => ids.map((id) => (document.getElementById(id) as HTMLInputElement).checked),
    casillas
  );

  const cambiadas = casillas.filter((_, i) => antes[i] !== despues[i]);
  expect(cambiadas).toEqual(['notif-mute-assign']);
});

test('el aviso emergente se anuncia', async ({ page }) => {
  await entrar(page);
  await page.goto('/settings');
  // Es el canal principal de respuesta de la aplicación y no tenía `aria-live`:
  // cada «guardado» y cada error pasaban en silencio para quien no ve la
  // pantalla.
  const toast = page.locator('#forge-toast');
  await expect(toast).toHaveAttribute('aria-live', 'polite');
  await expect(toast).toHaveAttribute('role', 'status');
});
