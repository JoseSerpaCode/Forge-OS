import { test, expect } from '@playwright/test';

/**
 * El panel de atajos de la base de conocimiento no promete lo que no puede dar.
 *
 * Listaba `Ctrl+K` para insertar un enlace y `Ctrl+B/I/U` para estilos. De esos
 * el navegador se queda dos: `Ctrl+K` va a su barra de búsqueda y `Ctrl+U` abre
 * «ver código fuente». Ningún `preventDefault()` de la página los recupera de
 * forma fiable, así que quien los probaba concluía que la aplicación falla.
 *
 * (La paleta Cmd+K de la propia app **no** es la culpable: su manejador corta
 * antes si el foco está en algo editable.)
 */
test('no lista atajos que el navegador intercepta, y está traducido', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'jose');
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'LocalDevPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  await page.request.post('/api/lang', {
    form: { lang: 'es', current_path: '/' },
    headers: { Origin: 'http://localhost:4322' },
  });

  const db = (await import('./test-utils')).getTestDb();
  const yo = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  db.prepare('INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)')
    .run(crypto.randomUUID(), 'Atajos', 'ws-atajos-kb', yo.id);
  const ws = db.prepare("SELECT id FROM workspaces WHERE sys_tag = 'ws-atajos-kb'").get() as any;
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')")
    .run(ws.id, yo.id);
  db.prepare("DELETE FROM pages WHERE workspace_id = ?").run(ws.id);
  const pid = crypto.randomUUID();
  db.prepare('INSERT INTO pages (id, workspace_id, title, content_json, created_by) VALUES (?,?,?,?,?)')
    .run(pid, ws.id, 'Atajos', '{}', yo.id);

  await page.goto(`/w/ws-atajos-kb/p/${pid}`);
  await page.waitForLoadState('networkidle');

  const panel = page.locator('h4', { hasText: /atajos/i }).locator('..');
  const texto = await panel.evaluate((el: HTMLElement) => el.textContent ?? '');

  // Los dos que el navegador se queda.
  expect(texto, 'sigue prometiendo Ctrl+K, que va a la barra del navegador').not.toContain('Ctrl K');
  expect(texto, 'sigue prometiendo Ctrl+U, que abre el código fuente').not.toContain('U');

  // Y ninguno de los cinco textos sigue en inglés a pelo.
  for (const suelto of ['Add Block', 'Move Block', 'Undo/Redo', 'Styles', 'Link']) {
    expect(texto, `«${suelto}» sigue sin traducir`).not.toContain(suelto);
  }
});
