import { describe, it, expect, beforeAll } from 'vitest';
import { POST, DELETE } from '../src/pages/api/issues/[id]/timer';
import db from '../src/lib/db';
import crypto from 'crypto';
import type { APIContext } from 'astro';

describe('Timer and Work Log Integration', () => {
  let testWorkspaceId: string;
  let testUserId: string;
  let testIssueId: string;

  beforeAll(() => {
    testWorkspaceId = crypto.randomUUID();
    testUserId = crypto.randomUUID();
    testIssueId = crypto.randomUUID();

    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(testUserId, 'testuser-' + Date.now(), 'hash');
    db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by, feat_time) VALUES (?, ?, ?, ?, 1)').run(testWorkspaceId, 'Test WS', 'test-ws-' + Date.now(), testUserId);
    // El cronómetro es una función que se enciende por espacio; aquí se prueba encendida.
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)').run(testWorkspaceId, testUserId, 'owner');
    db.prepare('INSERT INTO issues (id, workspace_id, type, title, reporter_id) VALUES (?, ?, ?, ?, ?)').run(testIssueId, testWorkspaceId, 'task', 'Test Issue for Timer', testUserId);
  });

  it('starts a timer, stops it, and verifies the work log is generated', async () => {
    // 1. Start the timer
    const mockContext = {
      params: { id: testIssueId },
      locals: { user: { id: testUserId, is_sysadmin: 0 } }
    } as unknown as APIContext;

    const startRes = await POST(mockContext);
    expect(startRes.status).toBe(200);
    const startData = await startRes.json();
    expect(startData.success).toBe(true);

    // Verify timer is running in DB
    const activeSession = db.prepare('SELECT id, started_at FROM time_tracking_sessions WHERE issue_id = ? AND user_id = ?').get(testIssueId, testUserId) as any;
    expect(activeSession).toBeDefined();

    // 2. Fast forward time by manually updating started_at to 2.5 hours ago
    db.prepare('UPDATE time_tracking_sessions SET started_at = datetime(\'now\', \'-2.5 hours\') WHERE id = ?').run(activeSession.id);

    // 3. Stop the timer
    const stopRes = await DELETE(mockContext);
    expect(stopRes.status).toBe(200);
    const stopData = await stopRes.json();
    
    // Verify auto-logged response matches requirement 2.3
    expect(stopData.success).toBe(true);
    expect(stopData.logged).toBeDefined();
    expect(stopData.logged.hours).toBeCloseTo(2.5, 1);
    
    // Verify it was saved to DB and session was deleted
    const deletedSession = db.prepare('SELECT id FROM time_tracking_sessions WHERE id = ?').get(activeSession.id);
    expect(deletedSession).toBeUndefined();

    const workLog = db.prepare('SELECT hours_spent, description FROM work_logs WHERE id = ?').get(stopData.logged.logId) as any;
    expect(workLog).toBeDefined();
    expect(workLog.hours_spent).toBeCloseTo(2.5, 1);
    expect(workLog.description).toBe('Session auto-logged');
    
    console.log("EVIDENCE: Timer stopped, returning JSON =>", stopData);
  });
});
