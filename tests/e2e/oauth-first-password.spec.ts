import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';
import bcrypt from 'bcryptjs';

/**
 * Una cuenta creada por un proveedor tiene que poder ponerse contraseña.
 *
 * Guardan la cadena literal `oauth` como hash, que no es bcrypt válido. El
 * endpoint exigía la contraseña actual para cambiarla, así que esas cuentas no
 * podían ponerse una **nunca** — y sin contraseña tampoco podían desvincular su
 * único proveedor, porque la guarda de `unlink` lo impide con razón. Quedaban
 * atadas al proveedor para siempre.
 */

// En serie: los dos tests comparten el mismo usuario y el segundo le pone
// contraseña, que es justo lo que el primero necesita que no tenga. En paralelo
// se pisaban y fallaba uno u otro según quién llegara antes.
test.describe.configure({ mode: 'serial' });

const USER = 'oauthonly';
const PASS = 'unaContraseñaNueva1';

test.beforeAll(() => {
  const db = getTestDb();
  db.prepare('DELETE FROM users WHERE username = ?').run(USER);
  db.prepare(
    "INSERT INTO users (id, username, password_hash, github_id) VALUES ('test-oauth-only', ?, 'oauth', 'gh-999')"
  ).run(USER);
  db.close();
});

test.afterAll(() => {
  const db = getTestDb();
  db.prepare('DELETE FROM users WHERE username = ?').run(USER);
  db.close();
});

test('puede ponerse la primera contraseña sin dar una anterior', async ({ page, request, baseURL }) => {
  // Sesión directa: esta cuenta no puede entrar por el formulario todavía, que
  // es precisamente el problema.
  const db = getTestDb();
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES ('sess-oauth-only', 'test-oauth-only', ?)").run(
    Date.now() + 3600_000
  );
  db.close();
  await page.context().addCookies([
    { name: 'forge_session', value: 'sess-oauth-only', url: baseURL! },
  ]);

  const res = await page.request.post('/api/user/settings', {
    data: { username: USER, new_password: PASS },
    headers: { Origin: baseURL! },
  });
  expect(res.status(), await res.text()).toBeLessThan(400);

  // Y ahora sí entra por el formulario.
  const db2 = getTestDb();
  const hash = (db2.prepare('SELECT password_hash FROM users WHERE username = ?').get(USER) as any).password_hash;
  db2.close();
  expect(hash.startsWith('$2')).toBe(true);
  expect(bcrypt.compareSync(PASS, hash)).toBe(true);
});

test('con contraseña puesta, cambiarla sigue exigiendo la anterior', async ({ page, baseURL }) => {
  const db = getTestDb();
  db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(bcrypt.hashSync(PASS, 10), USER);
  db.prepare("INSERT OR REPLACE INTO sessions (id, user_id, expires_at) VALUES ('sess-oauth-only-2', 'test-oauth-only', ?)").run(
    Date.now() + 3600_000
  );
  db.close();
  await page.context().addCookies([
    { name: 'forge_session', value: 'sess-oauth-only-2', url: baseURL! },
  ]);

  // Sin la anterior, o con una equivocada, se rechaza. Si no, cualquiera que
  // robara una sesión podría cambiar la contraseña y quedarse la cuenta.
  const sinAnterior = await page.request.post('/api/user/settings', {
    data: { username: USER, new_password: 'otraContraseña99' },
    headers: { Origin: baseURL! },
  });
  expect(sinAnterior.status()).toBe(403);

  const conAnteriorMala = await page.request.post('/api/user/settings', {
    data: { username: USER, current_password: 'loQueSea', new_password: 'otraContraseña99' },
    headers: { Origin: baseURL! },
  });
  expect(conAnteriorMala.status()).toBe(403);
});
