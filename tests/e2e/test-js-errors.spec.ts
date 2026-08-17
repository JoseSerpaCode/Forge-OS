import { test, } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

test('No JS exceptions on main page load', async ({ page }) => {
  // Setup valid session
  const dbPath = path.resolve(process.env.NODE_ENV === 'test' ? 'forge_test.db' : 'forge.db');
  const db = new Database(dbPath);
  const user = db.prepare('SELECT id FROM users LIMIT 1').get() as any;
  if (!user) throw new Error('No user found');
  const sessionId = 'test-session-jserrors-99';
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))").run(sessionId, user.id);

  await page.context().addCookies([{ name: 'forge_session', value: sessionId, domain: 'localhost', path: '/' }]);

  const exceptions: string[] = [];
  page.on('pageerror', err => exceptions.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`BROWSER ERROR: ${msg.text()}`);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Cleanup
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

  if (exceptions.length > 0) {
    throw new Error(`JS exceptions found:\n${exceptions.join('\n')}`);
  }
});
