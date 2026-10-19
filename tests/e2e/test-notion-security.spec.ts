import { test, expect } from '@playwright/test';
import db from '../../src/lib/db';

test('Knowledge Base: Cross-workspace IDOR isolation', async ({ request, page }) => {
  // 1. Manually create a page in Workspace C
  const pageIdC = 'page-c-123';
  db.prepare(`
    INSERT INTO pages (id, workspace_id, title, content_json, created_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(pageIdC, 'ws-notion-c', 'Secret Page C', '{}', 'test-user-notion-c');

  // 2. Login as User D (Owner of Workspace D, has NO access to Workspace C)
  await page.goto('/login');
  await page.fill('input[name="username"]', 'TestUserNotionD');
  await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/);
  
  // Navigate to their own workspace to set last_workspace_id to ws-notion-d
  await page.goto('/w/notion-ws-d/p');
  
  // Wait for the cookie/session to register last_workspace_id
  await page.waitForLoadState('networkidle');

  // Grab the cookie for API requests
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'forge_session');
  expect(sessionCookie).toBeDefined();

  // 3. ATTEMPT READ: Try to visit the page via UI (GET)
  const resRead = await page.goto(`/w/notion-ws-d/p/${pageIdC}`);
  // Should fail since pageIdC belongs to ws-notion-c, but we are querying within notion-ws-d
  expect(resRead?.status()).toBe(404);

  // 4. ATTEMPT WRITE (PATH 1: SELECT mismatch): Try to update the page via API (PUT)
  // User D's last_workspace_id is ws-notion-d. The page belongs to ws-notion-c.
  const resPutPath1 = await request.put(`/api/pages/${pageIdC}`, {
    data: { title: 'Hacked Title' },
    headers: { 'Cookie': `forge_session=${sessionCookie?.value}` }
  });
  console.log('Path 1 (Mismatch) PUT status:', resPutPath1.status());
  console.log('Path 1 (Mismatch) PUT body:', await resPutPath1.text());
  expect(resPutPath1.status()).toBe(404);

  // 4b. ATTEMPT WRITE (PATH 2: not_member): 
  // Force User D's last_workspace_id to ws-notion-c so that the SELECT passes but Guard fails.
  db.prepare('UPDATE users SET last_workspace_id = ? WHERE username = ?').run('notion-ws-c', 'TestUserNotionD');
  
  const resPutPath2 = await request.put(`/api/pages/${pageIdC}`, {
    data: { title: 'Hacked Title' },
    headers: { 'Cookie': `forge_session=${sessionCookie?.value}` }
  });
  console.log('Path 2 (not_member) PUT status:', resPutPath2.status());
  console.log('Path 2 (not_member) PUT body:', await resPutPath2.text());
  expect(resPutPath2.status()).toBe(404);

  const resDelete = await request.delete(`/api/pages/${pageIdC}`, {
    headers: { 
      'Cookie': `forge_session=${sessionCookie?.value}`,
      'Origin': `http://localhost:${process.env.E2E_PORT || 4322}`
    }
  });
  console.log('DELETE status:', resDelete.status());
  console.log('DELETE body:', await resDelete.text());
  expect(resDelete.status()).toBe(404);

  // Restore last_workspace_id so the POST test runs correctly under notion-ws-d
  db.prepare('UPDATE users SET last_workspace_id = ? WHERE username = ?').run('notion-ws-d', 'TestUserNotionD');

  // 6. ATTEMPT CROSS-PARENTING: Try to create a page in Workspace D with parent in Workspace C (POST)
  const resPost = await request.post(`/api/pages`, {
    data: { title: 'Cross Parent', parent_page_id: pageIdC },
    headers: { 'Cookie': `forge_session=${sessionCookie?.value}` }
  });
  expect(resPost.status()).toBe(400); // 400 Bad Request cross-workspace parenting
});
