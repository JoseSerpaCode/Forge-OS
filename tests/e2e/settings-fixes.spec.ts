import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';

// En serie: los cuatro operan sobre el mismo usuario y el formulario guarda el
// perfil **entero** en cada envío, así que en paralelo se pisan los campos unos
// a otros. No es flakiness del producto, es que comparten estado.
test.describe.configure({ mode: 'serial' });

async function entrar(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'profile_user');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('guardar el perfil funciona sin subir una foto nueva', async ({ page }) => {
  // Este era el fallo de fondo: el cliente mandaba `avatar_url: null` siempre,
  // y el servidor —que distingue ausente/vacío/cadena— lo rechazaba con
  // «Invalid Avatar format». Guardar el perfil fallaba **siempre** salvo que
  // subieras una foto en ese mismo momento, así que ni la biografía ni los
  // pronombres ni el correo se guardaban nunca.
  await entrar(page);
  await page.goto('/settings');

  const bio = 'Biografía de prueba ' + Date.now();
  await page.fill('#profile-bio', bio);
  await page.click('#btn-save-profile');
  await page.waitForTimeout(1200);

  const db = getTestDb();
  const row = db.prepare("SELECT bio FROM users WHERE username = 'profile_user'").get() as any;
  db.close();
  expect(row.bio).toBe(bio);
});

test('el correo público se puede cambiar de verdad', async ({ page }) => {
  // Era un `<select>` sin id ni listener; lo que se guardaba era un input
  // oculto que nunca cambiaba, así que elegir no hacía nada.
  const db = getTestDb();
  db.prepare("UPDATE users SET public_email = NULL WHERE username = 'profile_user'").run();
  db.close();

  await entrar(page);
  await page.goto('/settings');

  await page.selectOption('#profile-email', 'profile@example.test');
  await page.click('#btn-save-profile');
  await page.waitForTimeout(1200);

  const db2 = getTestDb();
  const row = db2.prepare("SELECT public_email FROM users WHERE username = 'profile_user'").get() as any;
  db2.close();
  expect(row.public_email).toBe('profile@example.test');
});

test('y se puede volver a ocultar', async ({ page }) => {
  await entrar(page);
  await page.goto('/settings');

  await page.selectOption('#profile-email', '');
  await page.click('#btn-save-profile');
  await page.waitForTimeout(1200);

  const db = getTestDb();
  const row = db.prepare("SELECT public_email FROM users WHERE username = 'profile_user'").get() as any;
  db.close();
  expect(row.public_email ?? '').toBe('');
});

test('cerrar sesión en todas partes revoca todas las sesiones', async ({ page, context }) => {
  // `logout-all` existía y no lo llamaba nadie: seguridad inalcanzable.
  await entrar(page);

  const db = getTestDb();
  const antes = (db.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id = 'test-user-profile'").get() as any).n;
  // Una segunda sesión, como si hubiera otro dispositivo abierto.
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES ('sess-otro-disp', 'test-user-profile', ?)").run(Date.now() + 3600_000);
  db.close();
  expect(antes).toBeGreaterThan(0);

  await page.goto('/settings');
  await expect(page.locator('#btn-logout-all')).toBeVisible();

  const res = await page.request.post('/api/auth/logout-all', {
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(res.ok()).toBeTruthy();

  const db2 = getTestDb();
  const despues = (db2.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id = 'test-user-profile'").get() as any).n;
  db2.close();
  expect(despues).toBe(0);
});
