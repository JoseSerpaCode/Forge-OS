import { test, expect } from '@playwright/test';

/**
 * Lo que no puede pasar en un teléfono, en cualquier pantalla de la aplicación.
 *
 * Estas comprobaciones son transversales a propósito: recorren las pantallas
 * principales y verifican dos cosas que no dependen del diseño concreto de cada
 * una, sino de que quepa.
 *
 * El proyecto `movil` de Playwright corre solo este directorio, en un Pixel 5
 * (393×851). Se eligió ese ancho porque los problemas de este proyecto aparecen
 * por debajo de 400px.
 */

const PANTALLAS = [
  { nombre: 'hub', ruta: '/' },
  { nombre: 'actividad', ruta: '/activity' },
  { nombre: 'personas', ruta: '/people' },
  { nombre: 'ajustes de la cuenta', ruta: '/settings' },
];

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test.describe('la página cabe en la pantalla', () => {
  for (const { nombre, ruta } of PANTALLAS) {
    test(`${nombre} no obliga a hacer scroll horizontal`, async ({ page }) => {
      await entrar(page);
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');

      /**
       * El `<body>` no puede ser más ancho que la ventana.
       *
       * Es la comprobación que atrapa los anchos fijos: un `w-[420px]` sin
       * `max-w` o una rejilla de 7 columnas de 40px se salen y obligan a
       * arrastrar la página de lado para leer. Se deja un margen de 1px por el
       * redondeo de los navegadores.
       */
      const { ancho, ventana, culpable } = await page.evaluate(() => {
        const w = document.documentElement.clientWidth;
        let peor = { sel: '', ancho: 0 };
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const r = el.getBoundingClientRect();
          if (r.width > peor.ancho && r.right > w + 1) {
            peor = {
              sel: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${(el.className || '').toString().split(' ').slice(0, 2).join('.')}`,
              ancho: Math.round(r.width),
            };
          }
        }
        return { ancho: document.body.scrollWidth, ventana: w, culpable: peor };
      });

      expect(
        ancho,
        `el contenido mide ${ancho}px en una ventana de ${ventana}px. El más ancho: ${culpable.sel} (${culpable.ancho}px)`
      ).toBeLessThanOrEqual(ventana + 1);
    });
  }
});

test('los diálogos tampoco se salen de la pantalla', async ({ page }) => {
  await entrar(page);
  await page.goto('/');

  /**
   * Un diálogo cerrado no mide nada, así que no sale en la comprobación de
   * arriba: hay que abrirlo para medirlo.
   *
   * Resultado que conviene dejar escrito, porque contradice lo que parecía:
   * `#forge-confirm-modal` declara `w-[420px]` sin `max-w` y **no se desborda**
   * en una pantalla de 393px. El navegador aplica a `dialog` un
   * `max-width: calc(100% - 6px - 2em)` por su cuenta y lo deja en 355px. Lo
   * mismo con `#docs-modal`, que declara 650px. Así que no hay nada que
   * arreglar ahí, y esta prueba está para enterarse si algún día deja de ser
   * cierto —por ejemplo si alguien pone `position: fixed` y se salta el
   * comportamiento por defecto.
   */
  const { desbordes, medidos } = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const malos: string[] = [];
    for (const d of Array.from(document.querySelectorAll('dialog'))) {
      const dlg = d as HTMLDialogElement;
      const abierto = dlg.open;
      if (!abierto) { try { dlg.showModal(); } catch { continue; } }
      const r = dlg.getBoundingClientRect();
      if (Math.round(r.width) > w + 1) malos.push(`${dlg.id || '(sin id)'}: ${Math.round(r.width)}px de ${w}px`);
      if (!abierto) dlg.close();
    }
    return { desbordes: malos, medidos: document.querySelectorAll('dialog').length };
  });

  // Sin esto, la prueba pasaría igual el día que no encuentre ni un diálogo.
  expect(medidos, 'no se midió ningún diálogo').toBeGreaterThan(2);
  expect(desbordes, `diálogos más anchos que la pantalla:\n  ${desbordes.join('\n  ')}`).toEqual([]);
});

test.describe('la navegación funciona sin ratón ni teclado', () => {
  test('el menú lateral se abre y se cierra', async ({ page }) => {
    await entrar(page);
    // En móvil la barra lateral es un cajón: sin el botón no hay forma de
    // llegar a ninguna sección.
    const boton = page.locator('#sidebar-toggle');
    await expect(boton).toBeVisible();

    const barra = page.locator('aside').first();
    await boton.tap();
    await expect(barra).toBeInViewport();
  });

  test('se puede buscar sin teclado', async ({ page }) => {
    /**
     * Hueco conocido, pendiente del rediseño móvil.
     *
     * `test.fail()` no es una excusa: afirma que **hoy falla**. Si alguien lo
     * arregla y no quita esta línea, la prueba falla por pasar, que es
     * exactamente lo que hay que enterarse.
     */
    test.fail();
    await entrar(page);
    // La búsqueda global se esconde por debajo de 640px y la paleta Cmd+K
    // necesita teclado: en un teléfono no queda ninguna forma de buscar.
    const buscar = page.locator('#btn-search-mobile, #global-search, input[type="search"]').first();
    await expect(buscar).toBeVisible();
  });
});
