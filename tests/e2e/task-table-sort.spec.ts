import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

test('Task Table sorting functionality', async ({ page }) => {
  // 1. Setup session in DB
  const dbPath = path.resolve('forge_test.db');
  const db = new Database(dbPath);
  
  const user = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
  if (!user) throw new Error('No user found to test with');

  /**
   * La tabla se siembra aquí en vez de contar con que ya haya tareas.
   *
   * El hub agrupa las pendientes por espacio, así que sin ninguna no pinta
   * ninguna tabla: enseña el estado vacío. La prueba dependía de que la cuenta
   * elegida tuviera trabajo asignado por casualidad, y ordenar una tabla que no
   * existe no prueba nada aunque pase.
   */
  const ws = db.prepare('SELECT id, sys_tag FROM workspaces LIMIT 1').get() as any;
  db.prepare("DELETE FROM issues WHERE title LIKE 'TTS %'").run();
  const ins = db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, assignee_id, position, due_date)
                          VALUES (?, ?, 'task', ?, 'todo', ?, ?, ?, ?)`);
  ins.run(crypto.randomUUID(), ws.id, 'TTS zeta', user.id, user.id, 100000, '2030-01-01');
  ins.run(crypto.randomUUID(), ws.id, 'TTS alfa', user.id, user.id, 200000, '2029-01-01');
  
  const sessionId = 'test-session-task-table';
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))").run(sessionId, user.id);
  
  // 2. Set cookie
  await page.context().addCookies([
    {
      name: 'forge_session',
      value: sessionId,
      domain: 'localhost',
      path: '/',
    }
  ]);
  
  console.log('Navigating to hub...');
  await page.goto('/');
  
  /**
   * Una tabla, no «la» tabla.
   *
   * El hub agrupa las pendientes por espacio, así que hay una tabla por espacio
   * con trabajo asignado. Se comprueba sobre la que contiene las tareas de esta
   * prueba: ordenar «todas las tablas a la vez» no es lo que hace la página, y
   * el script de orden está acotado a cada `.task-table-container` justo para
   * que cada grupo se ordene por su cuenta.
   */
  const tabla = page.locator('.task-table-container').filter({ hasText: 'TTS ' }).first();
  await expect(tabla).toBeVisible();

  // Test sorting by name
  const nameHeader = tabla.locator('th[data-sort="name"]');
  await nameHeader.click();
  
  // Get all rows text for the name column
  let names = await tabla.locator('.task-table-body tr.task-row td:nth-child(2) a').allTextContents();
  names = names.map(n => n.trim().toLowerCase());
  
  // Check if they are sorted ascending
  let isSortedAsc = true;
  for (let i = 0; i < names.length - 1; i++) {
    if (names[i] > names[i+1]) {
      isSortedAsc = false;
      break;
    }
  }
  expect(isSortedAsc).toBeTruthy();

  // Click again to sort descending
  await nameHeader.click();
  
  names = await tabla.locator('.task-table-body tr.task-row td:nth-child(2) a').allTextContents();
  names = names.map(n => n.trim().toLowerCase());
  
  // Check if they are sorted descending
  let isSortedDesc = true;
  for (let i = 0; i < names.length - 1; i++) {
    if (names[i] < names[i+1]) {
      isSortedDesc = false;
      break;
    }
  }
  expect(isSortedDesc).toBeTruthy();
  
  // Cleanup
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
});
