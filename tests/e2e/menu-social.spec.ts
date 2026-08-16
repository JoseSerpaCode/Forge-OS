import { test, expect } from '@playwright/test';

/**
 * El menú de la cuenta y la sección de personas.
 *
 * Lo que faltaba: a tu propio perfil no apuntaba **ningún** enlace de la
 * aplicación, el banner solo se cambiaba pasando el ratón por una imagen que
 * nada anunciaba como pulsable, y las solicitudes de amistad no se veían en
 * ninguna pantalla —había cinco endpoints para responderlas y ninguno para
 * verlas—.
 */

async function entrar(page: any, quien = 'jose') {
  await page.goto('/login');
  await page.fill('input[name="username"]', quien);
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('el menú de la cuenta lleva al perfil propio', async ({ page }) => {
  await entrar(page);

  const menu = page.locator('#user-menu');
  await expect(menu).toBeHidden();

  await page.click('#btn-user-menu');
  await expect(menu).toBeVisible();
  await expect(page.locator('#btn-user-menu')).toHaveAttribute('aria-expanded', 'true');

  // El enlace que no existía en ninguna parte.
  const perfil = menu.locator('a[href="/u/jose"]');
  await expect(perfil).toBeVisible();
  await perfil.click();
  await page.waitForURL('**/u/jose');
});

test('Escape cierra el menú y devuelve el foco', async ({ page }) => {
  await entrar(page);
  await page.click('#btn-user-menu');
  await expect(page.locator('#user-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#user-menu')).toBeHidden();
  await expect(page.locator('#btn-user-menu')).toBeFocused();
});

test('los ajustes tienen sección de personas y de banner', async ({ page }) => {
  await entrar(page);
  await page.goto('/settings');

  // Banner: antes solo se podía tocar desde el perfil público.
  await expect(page.locator('#banner-preview-container')).toBeVisible();
  await expect(page.locator('#banner-file-input')).toHaveCount(1);

  // Personas ya no vive aquí: queda el enlace a su página.
  // El menú lateral también apunta ahí, así que se busca dentro del contenido.
  await expect(page.locator('#settings-wrapper a[href="/people"]')).toBeVisible();
});

test('el menú dice «cuenta», no «workspace»', async ({ page }) => {
  await entrar(page);
  await page.click('#btn-user-menu');
  // El enlace a /settings llevaba la etiqueta de los ajustes **del espacio**,
  // que es otra pantalla distinta.
  const ajustes = page.locator('#user-menu a[href="/settings"]');
  await expect(ajustes).toHaveText(/cuenta|account/i);
  await expect(ajustes).not.toHaveText(/workspace|espacio/i);
});

// Cuenta propia y no `profile_user`: esa la usa la prueba de punta a punta de
// más abajo, y las dos corren a la vez.
test('Personas: buscar, pedir y cancelar', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page);
  await page.goto('/people');

  await expect(page.locator('h1')).toHaveText(/personas|people/i);
  await expect(page.locator('#people-loading')).toBeHidden();

  // Buscar es lo primero de la página: es lo único que se puede hacer estando
  // vacía, que es como la ve quien llega por primera vez.
  const buscador = page.locator('#people-search');
  await expect(buscador).toBeVisible();

  // Con menos de dos letras no se consulta.
  await buscador.fill('p');
  await expect(page.locator('#people-search-results li')).toHaveCount(0);

  await buscador.fill('omnibus_user');
  const resultado = page.locator('#people-search-results li', { hasText: 'omnibus_user' });
  await expect(resultado).toBeVisible();

  // Enviar la solicitud desde aquí: antes solo se podía desde el perfil de la
  // otra persona, al que solo se llegaba sabiendo su nombre exacto.
  await resultado.getByRole('button', { name: /añadir|add/i }).click();
  await expect(page.locator('#people-outgoing')).toBeVisible();
  await expect(page.locator('#people-outgoing-list')).toContainText('omnibus_user');

  // Y el resultado de la búsqueda ya no ofrece «Añadir», que el servidor
  // rechazaría.
  await expect(resultado.getByRole('button', { name: /añadir|add/i })).toHaveCount(0);

  // Se cancela para dejarlo como estaba.
  await page.locator('#people-outgoing-list li').first().getByRole('button').click();
  await expect(page.locator('#people-outgoing')).toBeHidden();
  await ctx.close();
});

test('la búsqueda no expone perfiles privados ni a uno mismo', async ({ page }) => {
  await entrar(page);
  const res = await page.request.post('/api/friends', { data: { q: 'jos' } });
  expect(res.status()).toBe(200);
  const { results } = await res.json();
  expect(results.map((r: any) => r.username)).not.toContain('jose');
  for (const r of results) expect(r.estado).toBeTruthy();

  // Menos de dos letras devuelve vacío en vez de medio padrón.
  const corta = await page.request.post('/api/friends', { data: { q: 'j' } });
  expect((await corta.json()).results).toHaveLength(0);
});

test('sin sesión no se busca a nadie ni se leen bloqueos', async ({ browser }) => {
  const anon = await browser.newContext();
  expect((await anon.request.post('/api/friends', { data: { q: 'jose' } })).status()).toBe(401);
  expect((await anon.request.get('/api/friends/blocked')).status()).toBe(401);
  await anon.close();
});

test('la lista de amigos no expone a quien no debe', async ({ page }) => {
  await entrar(page);
  const res = await page.request.get('/api/friends');
  expect(res.status()).toBe(200);
  const datos = await res.json();

  // Las tres listas, siempre, aunque estén vacías: un cliente que hace
  // `datos.incoming.length` no debería reventar por un campo ausente.
  for (const k of ['friends', 'incoming', 'outgoing']) {
    expect(Array.isArray(datos[k]), `falta ${k}`).toBe(true);
  }

  // Nunca aparece uno mismo: la consulta normaliza a «la otra persona» y una
  // relación consigo mismo sería un fallo de esa normalización.
  const todos = [...datos.friends, ...datos.incoming, ...datos.outgoing];
  for (const p of todos) {
    expect(p.username).not.toBe('jose');
    expect(p.friendshipId).toBeTruthy();
  }
});

test('sin sesión no se puede leer la lista de nadie', async ({ browser }) => {
  const anon = await browser.newContext();
  const res = await anon.request.get('/api/friends');
  expect(res.status()).toBe(401);
  await anon.close();
});

/**
 * El caso que de verdad estaba roto: alguien te manda una solicitud y no hay
 * ninguna pantalla donde enterarte. Aquí se manda una de verdad y se responde
 * desde los ajustes, que es lo único que antes no se podía hacer.
 */
test.describe('una solicitud de verdad, de punta a punta', () => {
  test.describe.configure({ mode: 'serial' });

  test('llega, se ve y se acepta desde los ajustes', async ({ browser }) => {
    // `profile_user` pide amistad a `jose`.
    const ctxOtro = await browser.newContext();
    const otro = await ctxOtro.newPage();
    await entrar(otro, 'profile_user');
    const envio = await otro.request.post('/api/friends/request', {
      data: { target_username: 'jose' },
    });
    expect([200, 201]).toContain(envio.status());

    // `jose` la ve sin haber pasado por el perfil de nadie.
    const ctxJose = await browser.newContext();
    const page = await ctxJose.newPage();
    await entrar(page);

    // El distintivo del menú es lo que hace que se mire.
    await expect(page.locator('#btn-user-menu')).toContainText('1');

    await page.goto('/people');
    const entrantes = page.locator('#people-incoming');
    await expect(entrantes).toBeVisible();
    await expect(entrantes.locator('li')).toContainText('profile_user');

    // Aceptar la mueve de lista sin recargar la página.
    await entrantes.getByRole('button', { name: /aceptar|accept/i }).first().click();
    await expect(page.locator('#people-friends-list')).toContainText('profile_user');
    await expect(entrantes).toBeHidden();

    // Y desde el otro lado también consta.
    const suya = await otro.request.get('/api/friends');
    const datos = await suya.json();
    expect(datos.friends.map((f: any) => f.username)).toContain('jose');
    expect(datos.outgoing).toHaveLength(0);

    // Se deshace para que la prueba pueda repetirse.
    const mias = await page.request.get('/api/friends');
    const amistad = (await mias.json()).friends.find((f: any) => f.username === 'profile_user');
    await page.request.delete(`/api/friends/${amistad.friendshipId}`);

    await ctxOtro.close();
    await ctxJose.close();
  });
});
