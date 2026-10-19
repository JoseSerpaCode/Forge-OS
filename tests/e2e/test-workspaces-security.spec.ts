import { test, expect } from '@playwright/test';
import db from '../../src/lib/db';
import crypto from 'crypto';

test('Workspaces: Cross-workspace IDOR isolation for members and deletions', async ({ request, page }) => {
  // 1. Create Workspace C manually with owner TestUserNotionC
  const wsCId = 'ws-sec-c-' + crypto.randomUUID();
  db.prepare(`
    INSERT INTO workspaces (id, name, sys_tag, created_by)
    VALUES (?, ?, ?, ?)
  `).run(wsCId, 'Sec Workspace C', 'ws-sec-c', 'test-user-notion-c');
  db.prepare('INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)').run(wsCId, 'test-user-notion-c', 'owner');

  // Add TestUserNotionE as viewer in Workspace C
  db.prepare('INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)').run(wsCId, 'test-user-notion-e', 'viewer');

  // 2. Login as User D (Owner of Workspace D, NOT a member of Workspace C)
  await page.goto('/login');
  await page.fill('input[name="username"]', 'TestUserNotionD');
  await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/);

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'forge_session');
  
  // ATTEMPT 1: User D tries to delete Workspace C -> Should return 404
  const resDelC = await request.delete(`/api/workspaces/${wsCId}`, {
    headers: { 
      'Cookie': `forge_session=${sessionCookie?.value}`,
      'Origin': `http://localhost:${process.env.E2E_PORT || 4322}`
    }
  });
  expect(resDelC.status()).toBe(404);

  // ATTEMPT 2: User D tries to add a member to Workspace C -> Should return 404
  const resAddC = await request.post(`/api/workspaces/${wsCId}/members`, {
    data: { username: 'test-user-notion-d', role: 'owner' },
    headers: { 
      'Cookie': `forge_session=${sessionCookie?.value}`,
      'Origin': `http://localhost:${process.env.E2E_PORT || 4322}`
    }
  });
  expect(resAddC.status()).toBe(404);

  // 3. Login as User E (Viewer in Workspace C, insufficient role)
  await page.context().clearCookies();
  await page.goto('/login');
  await page.fill('input[name="username"]', 'TestUserNotionE');
  await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/);

  const cookiesE = await page.context().cookies();
  const sessionCookieE = cookiesE.find(c => c.name === 'forge_session');

  // ATTEMPT 3: User E tries to delete Workspace C -> Should return 403
  const resDelE = await request.delete(`/api/workspaces/${wsCId}`, {
    headers: { 
      'Cookie': `forge_session=${sessionCookieE?.value}`,
      'Origin': `http://localhost:${process.env.E2E_PORT || 4322}`
    }
  });
  expect(resDelE.status()).toBe(403);

  // ATTEMPT 4: User E tries to add a member to Workspace C -> Should return 403
  const resAddE = await request.post(`/api/workspaces/${wsCId}/members`, {
    data: { username: 'TestUserNotionE', role: 'owner' },
    headers: { 
      'Cookie': `forge_session=${sessionCookieE?.value}`,
      'Origin': `http://localhost:${process.env.E2E_PORT || 4322}`
    }
  });
  expect(resAddE.status()).toBe(403);
});
