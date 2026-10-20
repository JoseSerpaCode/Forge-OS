import { test, expect } from '@playwright/test';
import { getTestDb } from './test-utils';
import { registerViaForm } from './helpers/register';

/**
 * La barra lateral es la misma en Inicio y dentro de un espacio.
 *
 * Fuera de un espacio la sección perdía el rótulo, los contadores y «Ajustes
 * del espacio», y dentro aparecía además una tarjeta con el nombre: pasar de
 * Inicio al tablero movía la barra entera. Se mide la posición de cada enlace
 * en las dos páginas.
 *
 * Cuenta propia de esta prueba: el último espacio visitado decide la sección
 * que se ve en Inicio, y otra prueba con la misma cuenta lo cambiaría a mitad.
 */
test('los enlaces de la barra lateral no se mueven entre Inicio y el tablero', async ({ page }) => {
  const nombre = `nav_${Date.now()}`;
  await registerViaForm(page, { username: nombre });

  const db = getTestDb();
  const yo = db.prepare('SELECT id FROM users WHERE username = ?').get(nombre) as any;
  const espacios = [`nav-a-${Date.now()}`, `nav-b-${Date.now()}`];
  for (const [i, tag] of espacios.entries()) {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(id, `Espacio ${i + 1}`, tag, yo.id);
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(id, yo.id);
  }

  const medir = () => page.locator('#app-sidebar .sidebar-link').evaluateAll((els) =>
    els.map((e) => `${e.getAttribute('href')}@${Math.round(e.getBoundingClientRect().top)}`));

  await page.goto(`/w/${espacios[0]}/board`);
  const enTablero = await medir();
  await page.goto('/');
  const enInicio = await medir();

  expect(enInicio).toEqual(enTablero);
  await expect(page.locator('#app-sidebar .sidebar-link[href$="/settings"]')).toBeVisible();

  // Con más de un espacio, el rótulo es el que cambia de uno a otro.
  const rotulo = page.locator('#btn-cambio-espacio');
  await expect(rotulo).toContainText('Espacio 1');
  await rotulo.click();
  await page.locator('#menu-cambio-espacio a', { hasText: 'Espacio 2' }).click();
  await page.waitForURL(`**/w/${espacios[1]}`);
  await expect(page.locator('#btn-cambio-espacio')).toContainText('Espacio 2');
});
