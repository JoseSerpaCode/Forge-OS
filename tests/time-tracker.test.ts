import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../src/lib/db';
import crypto from 'crypto';
import { finalizeActiveSession, finalizeIssueSessions, POST } from '../src/pages/api/issues/[id]/timer';
import type { APIContext } from 'astro';

describe('Time Tracker Backend Logic', () => {
  let wsId: string;
  let userId1: string;
  let userId2: string;
  let issueId: string;

  beforeAll(() => {
    wsId = crypto.randomUUID();
    userId1 = crypto.randomUUID();
    userId2 = crypto.randomUUID();
    issueId = crypto.randomUUID();

    // Create test environment
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId1, 'testuser1', 'hash');
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId2, 'testuser2', 'hash');
    db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by, feat_time) VALUES (?, ?, ?, ?, 1)').run(wsId, 'Test WS', 'test_ws_timer', userId1);
    // El cronómetro es una función que se enciende por espacio; aquí se prueba encendida.
    db.prepare('INSERT INTO issues (id, workspace_id, type, title, reporter_id) VALUES (?, ?, ?, ?, ?)').run(issueId, wsId, 'task', 'Test Issue', userId1);
  });

  afterAll(() => {
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(wsId);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userId1, userId2);
  });

  it('Caps a session older than 12 hours exactly at 12 hours in work_logs', () => {
    const sessionId = crypto.randomUUID();
    
    // Insert a session started exactly 20 hours ago
    db.prepare(`
      INSERT INTO time_tracking_sessions (id, issue_id, user_id, started_at) 
      VALUES (?, ?, ?, datetime('now', '-20 hours'))
    `).run(sessionId, issueId, userId1);

    // Run the finalize logic
    const result = finalizeActiveSession(userId1);
    
    // Verify results
    expect(result).not.toBeNull();
    expect(result?.hours).toBe(12);

    // Verify DB
    const sessionExists = db.prepare('SELECT id FROM time_tracking_sessions WHERE id = ?').get(sessionId);
    expect(sessionExists).toBeUndefined();

    const log = db.prepare('SELECT hours_spent FROM work_logs WHERE id = ?').get(result?.logId) as any;
    expect(log).toBeDefined();
    expect(log.hours_spent).toBe(12.0);
  });

  it('Isolates idempotency and sessions per user', () => {
    // User 1 starts a timer
    const session1Id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO time_tracking_sessions (id, issue_id, user_id, started_at) 
      VALUES (?, ?, ?, datetime('now', '-1 hours'))
    `).run(session1Id, issueId, userId1);

    // User 2 starts a timer on the SAME issue
    const session2Id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO time_tracking_sessions (id, issue_id, user_id, started_at) 
      VALUES (?, ?, ?, datetime('now', '-2 hours'))
    `).run(session2Id, issueId, userId2);

    // User 1 stops their timer
    const result1 = finalizeActiveSession(userId1);
    expect(result1?.hours).toBeCloseTo(1, 2); // 1 hour elapsed

    // User 2's timer should still be completely intact and running
    const user2Session = db.prepare('SELECT id FROM time_tracking_sessions WHERE user_id = ?').get(userId2);
    expect(user2Session).toBeDefined();

    // Now finalize all for the issue (e.g. moving issue to Done)
    const issueResults = finalizeIssueSessions(issueId);
    expect(issueResults.length).toBe(1); // Only User 2 was still running
    expect(issueResults[0]?.hours).toBeCloseTo(2, 2); // 2 hours elapsed
  });

  it('Ensures true idempotency: double click by same user preserves original started_at', async () => {
    const originalStartedAt = '2026-07-01 12:00:00';
    db.prepare(`
      INSERT INTO time_tracking_sessions (id, issue_id, user_id, started_at) 
      VALUES (?, ?, ?, ?)
    `).run(crypto.randomUUID(), issueId, userId1, originalStartedAt);

    // Simulate POST /start again
    const mockContext = {
      params: { id: issueId },
      locals: { user: { id: userId1, is_sysadmin: 1 } },
      request: new Request('http://localhost')
    } as unknown as APIContext;

    const res = await POST(mockContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('Timer already running');

    // Verify DB still has the exact same original started_at
    const session = db.prepare('SELECT started_at FROM time_tracking_sessions WHERE issue_id = ? AND user_id = ?').get(issueId, userId1) as any;
    expect(session.started_at).toBe(originalStartedAt);
  });
});
