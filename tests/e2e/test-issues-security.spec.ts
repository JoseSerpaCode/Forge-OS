import { test, expect } from '@playwright/test';
import db from '../../src/lib/db';

test('Issues: Cross-workspace IDOR isolation', async ({ request, page }) => {
  // 1. Create a workspace C and D if they don't exist (done by reset-db.ts globalSetup)
  // We'll just create an issue in Workspace C manually
  const issueIdC = 'issue-c-123';
  db.prepare(`
    INSERT INTO issues (id, workspace_id, type, title, description, status, story_points, reporter_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(issueIdC, 'ws-notion-c', 'task', 'Secret Issue C', 'Description C', 'todo', 5, 'test-user-notion-c');

  // 2. Login as User D (Owner of Workspace D, has NO access to Workspace C)
  await page.goto('/login');
  await page.fill('input[name="username"]', 'TestUserNotionD');
  await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/);
  
  // Navigate to their own workspace to set last_workspace_id to ws-notion-d
  await page.goto('/w/notion-ws-d/board');
  await page.waitForLoadState('networkidle');

  // Grab the cookie for API requests
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'forge_session');
  expect(sessionCookie).toBeDefined();

  // 3. ATTEMPT UPDATE: Try to update the issue via API (PATCH)
  const resPatch = await request.patch(`/api/issues/${issueIdC}`, {
    data: { description: 'Hacked Description' },
    headers: { 
      'Cookie': `forge_session=${sessionCookie?.value}`,
      'Origin': `http://localhost:${process.env.E2E_PORT || 4322}`
    }
  });
  console.log('PATCH /api/issues/[id] status:', resPatch.status());
  expect(resPatch.status()).toBe(404);



  // --- SECOND CASE: USER D ATTEMPTS TO CREATE AN ISSUE IN WORKSPACE C ---
  // Try to create an issue via POST using a valid sys_tag of a workspace they don't belong to
  const resPost = await request.post(`/api/w/notion-ws-c/issues`, {
    data: { 
      type: 'task',
      title: 'Malicious Issue by D',
      description: 'Hacked creation',
      status: 'todo',
      story_points: 3,
      assignee_id: null
    },
    headers: { 
      'Cookie': `forge_session=${sessionCookie?.value}`,
      'Origin': `http://localhost:${process.env.E2E_PORT || 4322}`
    }
  });
  console.log('User D POST /api/w/notion-ws-c/issues status:', resPost.status());
  expect(resPost.status()).toBe(404);

  // --- THIRD CASE: USER E (VIEWER IN WORKSPACE C) ---
  await page.context().clearCookies();
  // Login as User E
  await page.goto('/login');
  await page.fill('input[name="username"]', 'TestUserNotionE');
  await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/);
  
  await page.goto('/w/notion-ws-c/board');
  await page.waitForLoadState('networkidle');

  const cookiesE = await page.context().cookies();
  const sessionCookieE = cookiesE.find(c => c.name === 'forge_session');

  // ATTEMPT UPDATE: Try to update the issue via API (PATCH) -> Should be 403 (insufficient role)
  const resPatchE = await request.patch(`/api/issues/${issueIdC}`, {
    data: { description: 'Hacked Description E' },
    headers: { 
      'Cookie': `forge_session=${sessionCookieE?.value}`,
      'Origin': `http://localhost:${process.env.E2E_PORT || 4322}`
    }
  });
  console.log('User E PATCH /api/issues/[id] status:', resPatchE.status());
  expect(resPatchE.status()).toBe(403);


});
