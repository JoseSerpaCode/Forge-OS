import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';

const db = new Database('./forge_test.db');

test.describe('Social Phase 1 - Negative & Auth Tests', () => {
    let userA: any, userB: any, userC: any;
    let sessionIdA: string, sessionIdB: string, sessionIdC: string;
    let cookieA: string, cookieB: string, cookieC: string;

    test.beforeAll(async () => {
        userA = { id: randomUUID(), username: 'a_' + randomUUID().substring(0, 8), password_hash: '123' };
        userB = { id: randomUUID(), username: 'b_' + randomUUID().substring(0, 8), password_hash: '123' };
        userC = { id: randomUUID(), username: 'c_' + randomUUID().substring(0, 8), password_hash: '123' };
        
        db.prepare('INSERT INTO users (id, username, password_hash, social_enabled) VALUES (?, ?, ?, 1)').run(userA.id, userA.username, userA.password_hash);
        db.prepare('INSERT INTO users (id, username, password_hash, social_enabled) VALUES (?, ?, ?, 1)').run(userB.id, userB.username, userB.password_hash);
        db.prepare('INSERT INTO users (id, username, password_hash, social_enabled) VALUES (?, ?, ?, 1)').run(userC.id, userC.username, userC.password_hash);

        sessionIdA = randomUUID(); sessionIdB = randomUUID(); sessionIdC = randomUUID();
        const expires = new Date(Date.now() + 86400000).toISOString();
        db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionIdA, userA.id, expires);
        db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionIdB, userB.id, expires);
        db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionIdC, userC.id, expires);

        cookieA = `forge_session=${sessionIdA}`;
        cookieB = `forge_session=${sessionIdB}`;
        cookieC = `forge_session=${sessionIdC}`;
    });

    test('Blocker IDOR: A third user cannot accept/reject A and B friendship', async ({ request }) => {
        // Send request from A to B
        const reqRes = await request.post('/api/friends/request', {
            data: { target_username: userB.username },
            headers: { Cookie: cookieA }
        });
        console.log('Request response:', await reqRes.text());

        // Get the friendship ID
        const friendship = db.prepare("SELECT id FROM friendships WHERE status = 'pending' AND (user_a_id = ? OR user_b_id = ?)").get(userA.id, userA.id) as any;
        expect(friendship).toBeTruthy();

        // User C tries to accept it
        const resAccept = await request.post(`/api/friends/accept/${friendship.id}`, { headers: { Cookie: cookieC }, data: {} });
        expect(resAccept.status()).toBe(404);
        console.log('[IDOR Accept] Expected 404 from third party:', await resAccept.text());

        // User A tries to accept their own sent request
        const resAcceptSelf = await request.post(`/api/friends/accept/${friendship.id}`, { headers: { Cookie: cookieA }, data: {} });
        expect(resAcceptSelf.status()).toBe(404);
        console.log('[IDOR Accept] Expected 404 from sender:', await resAcceptSelf.text());
        
        // C tries to cancel it
        const resCancel = await request.post(`/api/friends/cancel/${friendship.id}`, { headers: { Cookie: cookieC }, data: {} });
        expect(resCancel.status()).toBe(404);
        console.log('[IDOR Cancel] Expected 404 from third party:', await resCancel.text());

        // B tries to cancel it (B is receiver, only sender A can cancel)
        const resCancelB = await request.post(`/api/friends/cancel/${friendship.id}`, { headers: { Cookie: cookieB }, data: {} });
        expect(resCancelB.status()).toBe(404);
        console.log('[IDOR Cancel] Expected 404 from receiver:', await resCancelB.text());

        // B correctly rejects it
        const dbState = db.prepare('SELECT * FROM friendships WHERE id = ?').get(friendship.id);
        console.log('DB State before reject:', dbState);
        const resReject = await request.post(`/api/friends/reject/${friendship.id}`, { headers: { Cookie: cookieB }, data: {} });
        console.log('Reject res:', await resReject.text());
        expect(resReject.status()).toBe(200);
    });
    test('Block Unblock IDOR & Workspace Cascade', async ({ request }) => {
        // 1. Setup Workspaces
        const wsBId = randomUUID();
        db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?, ?, ?, ?)').run(wsBId, 'WS B', 'ws_b_' + randomUUID().substring(0, 8), userB.id);
        const wsAId = randomUUID();
        db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?, ?, ?, ?)').run(wsAId, 'WS A', 'ws_a_' + randomUUID().substring(0, 8), userA.id);

        // A requests to join B's workspace
        db.prepare('INSERT INTO workspace_join_requests (id, workspace_id, user_id, status) VALUES (?, ?, ?, ?)').run(randomUUID(), wsBId, userA.id, 'pending');
        // B requests to join A's workspace
        db.prepare('INSERT INTO workspace_join_requests (id, workspace_id, user_id, status) VALUES (?, ?, ?, ?)').run(randomUUID(), wsAId, userB.id, 'pending');

        // Verify they exist
        expect((db.prepare("SELECT count(*) as c FROM workspace_join_requests WHERE status='pending' AND workspace_id IN (?, ?)").get(wsAId, wsBId) as any).c).toBe(2);

        // 2. User B blocks User A
        const resBlock = await request.post(`/api/users/${userA.username}/block`, { headers: { Cookie: cookieB }, data: {} });
        expect(resBlock.status()).toBe(200);

        // Verify cascades
        // The workspace requests should be deleted
        expect((db.prepare("SELECT count(*) as c FROM workspace_join_requests WHERE status='pending' AND workspace_id IN (?, ?)").get(wsAId, wsBId) as any).c).toBe(0);

        // 3. Unblock IDOR: User A tries to unblock User B (even though B blocked A)
        const resUnblock = await request.delete(`/api/users/${userB.username}/block`, { headers: { Cookie: cookieA }, data: {} });
        console.log('[Unblock IDOR] Expected 404:', await resUnblock.text());
        expect(resUnblock.status()).toBe(404);

        // Verify the block STILL exists
        const blockedExists = db.prepare('SELECT count(*) as c FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?').get(userB.id, userA.id) as any;
        expect(blockedExists.c).toBe(1);
    });
});
