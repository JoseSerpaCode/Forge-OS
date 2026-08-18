import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

/**
 * Subir una imagen desde los tres sitios que lo permiten.
 *
 * Había tres implementaciones con tres comportamientos: una recortaba a 512 px
 * de ancho, otra a 512 de ancho **y alto**, y la del perfil público **no
 * recortaba nada** —mandaba la foto del móvil entera para servirla a 24×24 px—.
 * Ninguna tenía prueba, que es cómo se llegó a tres.
 *
 * Lo que se comprueba es lo que importa: que lo que sale del navegador es
 * mucho más pequeño que lo que se eligió.
 */
const ORIGIN = { Origin: 'http://localhost:4322' };

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('el navegador redimensiona antes de subir', async ({ page }) => {
  await entrar(page);
  await page.goto('/settings');

  /**
   * Todo en una sola evaluación, sin dar la vuelta por un `data:` URI.
   *
   * El primer intento generaba el PNG, lo pasaba a `data:` y lo recuperaba con
   * `fetch` para armar el `File`. La CSP lo bloquea —`connect-src` no incluye
   * `data:`— y con razón: no hay motivo para que la página se conecte a un URI
   * de datos. El `Blob` del canvas ya sirve directamente.
   */
  // `/api/upload` exige a qué entidad pertenece la imagen.
  const yo = getTestDb().prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;

  const medida = await page.evaluate(async (userId) => {
    const c = document.createElement('canvas');
    // Ruido aleatorio no comprime, así que son ~3 bytes por píxel: a 3000×2000
    // pasaba de los 10 MB que rechaza el subidor —el tope funciona— y la prueba
    // moría por el motivo equivocado.
    c.width = 1400; c.height = 1000;
    const ctx = c.getContext('2d')!;
    // Ruido: un lienzo liso comprime a casi nada y no probaría nada.
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = Math.random() * 255;
      img.data[i + 1] = Math.random() * 255;
      img.data[i + 2] = Math.random() * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
    const file = new File([blob], 'grande.png', { type: 'image/png' });

    const w = window as any;
    const r = await w.forgeImagen.subir(file, {
      maxAncho: w.forgeImagen.ANCHOS.avatar,
      entidad: { tipo: 'user', id: userId },
    });
    return { original: blob.size, resultado: r };
  }, yo.id);

  expect(medida.original, 'la imagen de prueba tiene que ser grande').toBeGreaterThan(1_000_000);
  expect(medida.resultado.ok, `la subida falló: ${JSON.stringify(medida.resultado)}`).toBe(true);

  /**
   * Se mide el **ancho** de lo guardado, no su peso.
   *
   * La primera versión comparaba bytes y pasaba igual con el redimensionado
   * desactivado: la conversión a WebP ya encoge un PNG de ruido lo suficiente
   * como para bajar del umbral. Estaba midiendo la compresión, no el recorte, y
   * lo demostró desactivar el recorte a propósito y ver que seguía en verde.
   *
   * El ancho no miente: o se recortó a 512 o no se recortó.
   */
  const ancho = await page.evaluate((url) => new Promise<number>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth);
    img.onerror = () => resolve(-1);
    img.src = url;
  }), medida.resultado.url);

  expect(ancho, 'no se pudo leer la imagen guardada').toBeGreaterThan(0);
  expect(
    ancho,
    `la imagen guardada mide ${ancho}px de ancho; el original medía 1400 y el tope es 512`
  ).toBeLessThanOrEqual(512);
});

test('los tres sitios usan el mismo subidor', async ({ page }) => {
  await entrar(page);
  // Si alguien vuelve a escribir su propia versión, `forgeImagen` deja de ser
  // el único camino y las tres se separan otra vez.
  for (const ruta of ['/settings', '/u/jose']) {
    await page.goto(ruta);
    const hay = await page.evaluate(() => typeof (window as any).forgeImagen?.subir === 'function');
    expect(hay, `${ruta} no tiene el subidor común`).toBe(true);
  }
});
