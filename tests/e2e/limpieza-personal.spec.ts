import { test, expect, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { getTestDb } from './test-utils';

/**
 * Forge para usarlo a solas.
 *
 * - Fuera de un espacio no hay rol que enseñar: el Hub le decía «Lector» al
 *   dueño de todos sus espacios.
 * - Lo social (amigos, solicitudes, el banner del Hub) se enciende por cuenta.
 * - Automatizaciones y auditoría se encienden por espacio.
 *
 * Cada prueba crea su propia cuenta: el escenario común (`reset-db.ts`) tiene
 * lo social encendido para los specs de amigos, y aquí se mide el caso de una
 * cuenta nueva, que lo trae apagado.
 */

const PW = process.env.TEST_PASSWORD || 'LocalDevPass123!';
const PUERTO = process.env.E2E_PORT || 4322;
const ORIGIN = { Origin: `http://localhost:${PUERTO}` };

function cuenta(social: 0 | 1) {
  const nombre = `solo_${Math.random().toString(36).slice(2, 8)}`;
  const db = getTestDb();
  db.prepare('INSERT INTO users (id, username, password_hash, is_sysadmin, social_enabled) VALUES (?, ?, ?, 0, ?)')
    .run(`u-${nombre}`, nombre, bcrypt.hashSync(PW, 4), social);
  db.close();
  return nombre;
}

async function entrar(page: Page, usuario: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', usuario);
  await page.fill('input[name="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test('el Hub no dice «Lector» a quien no está en ningún espacio', async ({ page }) => {
  const yo = cuenta(0);
  await entrar(page, yo);
  const pie = page.locator('#app-sidebar');
  await expect(pie).toContainText(`@${yo}`);
  await expect(pie).not.toContainText(/Lector|Viewer/i);
});

test('con lo social apagado no hay Personas ni banner, y no te llegan solicitudes', async ({ page, browser }) => {
  const yo = cuenta(0);
  await entrar(page, yo);

  await expect(page.getByText(/Forge es mejor con amigos|Forge is better with friends/)).toHaveCount(0);
  await page.locator('#btn-user-menu').click();
  await expect(page.locator('#user-menu a[href="/people"]')).toHaveCount(0);

  // La página sigue existiendo, pero explica cómo encenderlo.
  await page.goto('/people');
  await expect(page.getByRole('link', { name: /Ir a Ajustes|Go to Settings/ })).toBeVisible();

  // Otra cuenta, con lo social encendido, no puede mandarme una solicitud...
  const otra = cuenta(1);
  const ctx = await browser.newContext();
  const login = await ctx.request.post('/api/auth/login', { data: { username: otra, password: PW }, headers: ORIGIN });
  expect(login.ok()).toBeTruthy();
  const pedir = (a: string) => ctx.request.post('/api/friends/request', { data: { target_username: a }, headers: ORIGIN });
  expect((await pedir(yo)).ok()).toBeFalsy();
  // ...y la misma petición a alguien con lo social encendido sí sale (control).
  expect((await pedir(cuenta(1))).ok()).toBeTruthy();
  await ctx.close();
});

test('encender lo social en Ajustes trae de vuelta Personas', async ({ page }) => {
  const yo = cuenta(0);
  await entrar(page, yo);
  await page.goto('/settings');
  await page.locator('label:has(#profile-social)').click();
  // Al cambiar lo social, Ajustes recarga la página para enseñar o quitar
  // «Personas». Hay que esperar a esa recarga: si no, el `goto('/')` de abajo
  // choca con ella y sale `net::ERR_ABORTED` cuando la máquina va cargada.
  const recarga = page.waitForEvent('load');
  await page.locator('#btn-save-profile').click();
  await recarga;
  await expect.poll(() => {
    const db = getTestDb();
    const v = (db.prepare('SELECT social_enabled FROM users WHERE username = ?').get(yo) as any).social_enabled;
    db.close();
    return v;
  }).toBe(1);
  await page.goto('/');
  await page.locator('#btn-user-menu').click();
  await expect(page.locator('#user-menu a[href="/people"]')).toBeVisible();
});

test('automatizaciones y auditoría: escondidas en un espacio nuevo, y se encienden en Ajustes', async ({ page }) => {
  const yo = cuenta(0);
  await entrar(page, yo);
  const tag = `solo-${Math.random().toString(36).slice(2, 8)}`;
  const r = await page.request.post('/api/workspaces', { data: { name: 'Solo', sys_tag: tag }, headers: ORIGIN });
  expect(r.ok(), await r.text()).toBeTruthy();

  await page.goto(`/w/${tag}/settings`);
  await expect(page.locator('#btn-add-automation')).toHaveCount(0);
  await expect(page.locator('#audit-logs-container')).toHaveCount(0);

  // Crear una regla por la API también se niega con la función apagada.
  const ws = (await r.json()).id;
  const regla = await page.request.post('/api/automations', {
    headers: ORIGIN,
    data: {
      workspaceId: ws, name: 'X', trigger_type: 'issue_status_changed', trigger_condition: '{"to_status":"done"}',
      action_type: 'webhook', action_payload: '{"url":"https://example.com"}',
    },
  });
  expect(regla.status()).toBe(403);

  await page.locator('label:has(input[data-funcion="automatizaciones"])').click();
  await page.waitForLoadState('load');
  await expect(page.locator('#btn-add-automation')).toBeVisible();
  await page.locator('label:has(input[data-funcion="auditoria"])').click();
  await page.waitForLoadState('load');
  await expect(page.locator('#audit-logs-container')).toBeVisible();
});
