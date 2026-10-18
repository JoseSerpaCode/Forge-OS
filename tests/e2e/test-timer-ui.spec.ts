import { test, expect } from '@playwright/test';
import db from '../../src/lib/db';
import crypto from 'crypto';

test.describe('Timer UI and Auto-stop flow', () => {
  let userId: string;
  let wsId: string;
  let issueId: string;

  test.beforeAll(() => {
    wsId = crypto.randomUUID();
    issueId = crypto.randomUUID();

    // Find jose user
    const jose = db.prepare("SELECT id FROM users WHERE username = 'jose'").get() as any;
    userId = jose.id;
    const sysTag = `timer-ws-${crypto.randomUUID().substring(0,8)}`;

    // Create workspace
    db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?, ?, ?, ?)').run(wsId, 'Timer Test WS', sysTag, userId);
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)').run(wsId, userId, 'owner');
    
    // Create an issue in TODO
    db.prepare('INSERT INTO issues (id, workspace_id, type, title, status, position, reporter_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(issueId, wsId, 'task', 'Test Timer Issue', 'todo', 100000, userId);
  });

  test('Start timer, wait, stop timer, verify UI, then auto-stop on done', async ({ page }) => {
    // Login manually
    await page.goto('/login');
    await page.fill('input[name="username"]', 'jose');
    await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');

    // Go to board
    // Fetch the sysTag that was just created since it's randomly generated
    const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(wsId) as any;
    await page.goto(`/w/${ws.sys_tag}/board`);
    await page.waitForLoadState('networkidle');

    // 1. Verify "Start" button exists and click it
    const startBtn = page.locator(`.issue-card[id="${issueId}"] .btn-start-timer`);
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // The page reloads after start in current logic
    await page.waitForLoadState('networkidle');

    // 2. Verify Timer is Active (Stop button is visible)
    const stopBtn = page.locator(`.issue-card[id="${issueId}"] .btn-stop-timer`);
    await expect(stopBtn).toBeVisible();
    
    // 3. Verify it moved to In Progress column automatically
    const column = page.locator('.board-column[data-status="in_progress"]');
    await expect(column.locator(`.issue-card[id="${issueId}"]`)).toBeVisible();

    // Fast-forward time in DB manually to log at least 0.1 hours (6 mins) so it's visible, otherwise it deletes it if < 0.016 hours
    // Wait, let's just use API or stop it. Wait, if we stop it now, it might be < 0.016 hours (1 min) and it will get deleted, not logged.
    // So let's modify the started_at in DB directly
    db.prepare("UPDATE time_tracking_sessions SET started_at = datetime('now', '-3 hours') WHERE issue_id = ?").run(issueId);

    // Stop timer via UI
    await stopBtn.click();
    await page.waitForLoadState('networkidle');

    // Verify it is stopped and "Start" button is back
    await expect(page.locator(`.issue-card[id="${issueId}"] .btn-start-timer`)).toBeVisible();

    // Start timer AGAIN to test Auto-stop
    await page.locator(`.issue-card[id="${issueId}"] .btn-start-timer`).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`.issue-card[id="${issueId}"] .btn-stop-timer`)).toBeVisible();

    // Fast-forward time again
    db.prepare("UPDATE time_tracking_sessions SET started_at = datetime('now', '-2 hours') WHERE issue_id = ?").run(issueId);

    // Move to Done by using API call to simulate drop
    const moveRes = await page.request.patch(`/api/issues/${issueId}/move`, {
      data: { status: 'done', position: 200000, workspaceId: wsId }
    });
    expect(moveRes.status()).toBe(200);

    // Reload the page to check UI state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify it is in Done column
    const doneColumn = page.locator('.board-column[data-status="done"]');
    await expect(doneColumn.locator(`.issue-card[id="${issueId}"]`)).toBeVisible();

    // Verify the timer controls are gone and replaced by X.Xh registradas
    const card = doneColumn.locator(`.issue-card[id="${issueId}"]`);
    await expect(card.locator('.btn-start-timer')).not.toBeVisible();
    await expect(card.locator('.btn-stop-timer')).not.toBeVisible();
    
    await expect(card.getByText('registradas')).toBeVisible();
    await expect(card.getByText('5h registradas')).toBeVisible(); // 3 hours + 2 hours = 5 hours
  });
});
