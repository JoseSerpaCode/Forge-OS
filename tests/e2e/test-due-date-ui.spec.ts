import { test, expect } from '@playwright/test';
import db from '../../src/lib/db';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

test.describe('Due Date Visual Indicator', () => {
  let workspaceId: string;
  let issuePastTodo: string;
  let issuePastDone: string;

  test.beforeAll(async () => {
    // 1. Iniciar sesión para obtener las cookies de sesión (CREAR USUARIO Y SESIÓN DIRECTAMENTE)
    db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, is_sysadmin) VALUES ('user-due', 'due_user', ?, 1)").run(bcrypt.hashSync((process.env.TEST_PASSWORD || 'LocalDevPass123!'), 10));

    workspaceId = 'ws-due-date';
    db.prepare("INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES (?, 'Due Date WS', 'due-date-ws', 'user-due')").run(workspaceId);
    db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, 'user-due', 'owner')").run(workspaceId);
    
    // Cleanup old data
    db.prepare("DELETE FROM issues WHERE workspace_id = ?").run(workspaceId);
    
    // Past due and 'todo' -> Should be RED
    issuePastTodo = crypto.randomUUID();
    db.prepare(`
      INSERT INTO issues (id, workspace_id, type, title, status, due_date, reporter_id)
      VALUES (?, ?, 'task', 'Past Todo Issue', 'todo', datetime('now', '-2 days'), 'user-due')
    `).run(issuePastTodo, workspaceId);

    // Past due but 'done' -> Should NOT be RED
    issuePastDone = crypto.randomUUID();
    db.prepare(`
      INSERT INTO issues (id, workspace_id, type, title, status, due_date, reporter_id)
      VALUES (?, ?, 'task', 'Past Done Issue', 'done', datetime('now', '-2 days'), 'user-due')
    `).run(issuePastDone, workspaceId);
  });

  test('Past due items are marked red unless they are done', async ({ context, page }) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(sessionId, 'user-due', expiresAt);
    
    await context.addCookies([
      { name: 'forge_session', value: sessionId, domain: 'localhost', path: '/' }
    ]);
    
    await page.goto('/w/due-date-ws/board');
    
    // Check Past Todo Issue
    const pastTodoCard = page.locator(`[id="${issuePastTodo}"]`);
    await expect(pastTodoCard).toBeVisible();
    
    // Wait for the due date element to be visible within the card
    const pastTodoDue = pastTodoCard.locator('.card-due');
    // Rediseño «Taller»: la fecha vencida lleva `.late` (rojo y seminegrita).
    await expect(pastTodoDue).toHaveClass(/\blate\b/);

    // Check Past Done Issue
    const pastDoneCard = page.locator(`[id="${issuePastDone}"]`);
    await expect(pastDoneCard).toBeVisible();
    
    const pastDoneDue = pastDoneCard.locator('.card-due');
    // Ensure it doesn't have the red error class
    await expect(pastDoneDue).not.toHaveClass(/\blate\b/);
  });
});
