import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';

const db = new Database('./forge_test.db');

test.describe('Social Phase 1 - Comprehensive Spec Validation', () => {
    let userA: any, userB: any, userC: any;
    let cookieA: string, cookieB: string, cookieC: string;

    test.beforeEach(async () => {
        // Create fresh users for each test to avoid state collision
        userA = { id: randomUUID(), username: 'a_' + randomUUID().substring(0, 8) };
        userB = { id: randomUUID(), username: 'b_' + randomUUID().substring(0, 8) };
        userC = { id: randomUUID(), username: 'c_' + randomUUID().substring(0, 8) };
        
        db.prepare("INSERT INTO users (id, username, password_hash, social_enabled) VALUES (?, ?, '123', 1)").run(userA.id, userA.username);
        db.prepare("INSERT INTO users (id, username, password_hash, social_enabled) VALUES (?, ?, '123', 1)").run(userB.id, userB.username);
        db.prepare("INSERT INTO users (id, username, password_hash, social_enabled) VALUES (?, ?, '123', 1)").run(userC.id, userC.username);

        const sessionIdA = randomUUID(); 
        const sessionIdB = randomUUID(); 
        const sessionIdC = randomUUID();
        const expires = new Date(Date.now() + 86400000).toISOString();
        
        db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionIdA, userA.id, expires);
        db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionIdB, userB.id, expires);
        db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionIdC, userC.id, expires);

        cookieA = `forge_session=${sessionIdA}`;
        cookieB = `forge_session=${sessionIdB}`;
        cookieC = `forge_session=${sessionIdC}`;
    });

    test('DB Constraints: Auto-friendship and UNIQUE checks', async ({ request }) => {
        // 1. Cannot add yourself (Endpoint level)
        const resSelf = await request.post('/api/friends/request', {
            data: { target_username: userA.username },
            headers: { Cookie: cookieA }
        });
        expect(resSelf.status()).toBe(400);

        // 2. Cannot add yourself (DB level CHECK)
        expect(() => {
            db.prepare("INSERT INTO friendships (id, user_a_id, user_b_id, status, action_user_id) VALUES (?, ?, ?, 'pending', ?)").run(randomUUID(), userA.id, userA.id, userA.id);
        }).toThrow(/CHECK constraint failed/);

        // 3. Normalization CHECK
        expect(() => {
            // Force user_a_id > user_b_id
            db.prepare("INSERT INTO friendships (id, user_a_id, user_b_id, status, action_user_id) VALUES (?, ?, ?, 'pending', ?)").run(randomUUID(), 'z', 'a', 'a');
        }).toThrow(/CHECK constraint failed/);

        // 4. Send Request (creates UNIQUE pair)
        const req1 = await request.post('/api/friends/request', {
            data: { target_username: userB.username },
            headers: { Cookie: cookieA }
        });
        expect(req1.status()).toBe(200);

        // 5. Send Request Again (must fail UNIQUE constraint handled by endpoint returning 400)
        const req2 = await request.post('/api/friends/request', {
            data: { target_username: userB.username },
            headers: { Cookie: cookieA }
        });
        expect(req2.status()).toBe(400);
        expect(await req2.text()).toContain('Request already pending or accepted');
    });

    test('IDOR and Auth Boundaries', async ({ request }) => {
        // Send request from A to B
        await request.post('/api/friends/request', {
            data: { target_username: userB.username },
            headers: { Cookie: cookieA }
        });

        const friendship = db.prepare("SELECT id FROM friendships WHERE status = 'pending' AND (user_a_id = ? OR user_b_id = ?)").get(userA.id, userA.id) as any;

        // IDOR: Third party C tries to accept/reject/cancel
        const resAcceptC = await request.post(`/api/friends/accept/${friendship.id}`, { headers: { Cookie: cookieC }, data: {} });
        expect(resAcceptC.status()).toBe(404);

        const resRejectC = await request.post(`/api/friends/reject/${friendship.id}`, { headers: { Cookie: cookieC }, data: {} });
        expect(resRejectC.status()).toBe(404);

        const resCancelC = await request.post(`/api/friends/cancel/${friendship.id}`, { headers: { Cookie: cookieC }, data: {} });
        expect(resCancelC.status()).toBe(404);

        // Sender A cannot accept or reject their own request
        const resAcceptA = await request.post(`/api/friends/accept/${friendship.id}`, { headers: { Cookie: cookieA }, data: {} });
        expect(resAcceptA.status()).toBe(404);

        const resRejectA = await request.post(`/api/friends/reject/${friendship.id}`, { headers: { Cookie: cookieA }, data: {} });
        expect(resRejectA.status()).toBe(404);

        // Receiver B cannot cancel A's request
        const resCancelB = await request.post(`/api/friends/cancel/${friendship.id}`, { headers: { Cookie: cookieB }, data: {} });
        expect(resCancelB.status()).toBe(404);
    });

    test('State Transitions & Cooldowns', async ({ request }) => {
        // A sends to B -> B rejects -> A tries to resend -> Cooldown applied -> Fast forward DB -> Resend successful (UPDATE)
        await request.post('/api/friends/request', { data: { target_username: userB.username }, headers: { Cookie: cookieA } });
        let friendship = db.prepare("SELECT id FROM friendships WHERE status = 'pending' AND (user_a_id = ? OR user_b_id = ?)").get(userA.id, userA.id) as any;

        // B rejects
        await request.post(`/api/friends/reject/${friendship.id}`, { headers: { Cookie: cookieB }, data: {} });
        
        let state = db.prepare("SELECT status FROM friendships WHERE id = ?").get(friendship.id) as any;
        expect(state.status).toBe('rejected');

        // A tries to resend immediately (Cooldown active)
        const resReReq = await request.post('/api/friends/request', { data: { target_username: userB.username }, headers: { Cookie: cookieA } });
        expect(resReReq.status()).toBe(400);

        // Fast forward 31 days in DB
        db.prepare("UPDATE friendships SET updated_at = datetime('now', '-31 days') WHERE id = ?").run(friendship.id);

        // A resends successfully (Updates row to pending)
        const resReReq2 = await request.post('/api/friends/request', { data: { target_username: userB.username }, headers: { Cookie: cookieA } });
        expect(resReReq2.status()).toBe(200);

        state = db.prepare("SELECT status FROM friendships WHERE id = ?").get(friendship.id) as any;
        expect(state.status).toBe('pending');

        // B accepts
        await request.post(`/api/friends/accept/${friendship.id}`, { headers: { Cookie: cookieB }, data: {} });
        state = db.prepare("SELECT status FROM friendships WHERE id = ?").get(friendship.id) as any;
        expect(state.status).toBe('accepted');

        // IDOR: Third party C tries to unfriend
        const resUnfriendC = await request.delete(`/api/friends/${friendship.id}`, { headers: { Cookie: cookieC }, data: {} });
        expect(resUnfriendC.status()).toBe(404);

        // A unfriends
        const resUnfriendA = await request.delete(`/api/friends/${friendship.id}`, { headers: { Cookie: cookieA }, data: {} });
        expect(resUnfriendA.status()).toBe(200);

        state = db.prepare("SELECT status FROM friendships WHERE id = ?").get(friendship.id) as any;
        expect(state.status).toBe('ended');
    });

    test('Block / Unblock Mechanics & Clean Slate & Cascade', async ({ request }) => {
        // Setup cross-workspaces requests
        const wsBId = randomUUID();
        db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?, ?, ?, ?)').run(wsBId, 'WS B', randomUUID(), userB.id);
        const wsAId = randomUUID();
        db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?, ?, ?, ?)').run(wsAId, 'WS A', randomUUID(), userA.id);

        db.prepare('INSERT INTO workspace_join_requests (id, workspace_id, user_id, status) VALUES (?, ?, ?, ?)').run(randomUUID(), wsBId, userA.id, 'pending');
        db.prepare('INSERT INTO workspace_join_requests (id, workspace_id, user_id, status) VALUES (?, ?, ?, ?)').run(randomUUID(), wsAId, userB.id, 'pending');

        // B blocks A
        const resBlock = await request.post(`/api/users/${userA.username}/block`, { headers: { Cookie: cookieB }, data: {} });
        expect(resBlock.status()).toBe(200);

        // 1. Verify Cascade
        expect((db.prepare("SELECT count(*) as c FROM workspace_join_requests WHERE status='pending' AND workspace_id IN (?, ?)").get(wsAId, wsBId) as any).c).toBe(0);

        // 2. A tries to unblock B (IDOR Block vulnerability test)
        const resUnblockA = await request.delete(`/api/users/${userB.username}/block`, { headers: { Cookie: cookieA }, data: {} });
        expect(resUnblockA.status()).toBe(404);

        let state = db.prepare("SELECT count(*) as c FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?").get(userB.id, userA.id) as any;
        expect(state.c).toBe(1);

        // 3. A tries to friend request B while blocked
        const reqBlocked = await request.post('/api/friends/request', { data: { target_username: userB.username }, headers: { Cookie: cookieA } });
        expect(reqBlocked.status()).toBe(400);

        // 4. B Unblocks A
        const resUnblockB = await request.delete(`/api/users/${userA.username}/block`, { headers: { Cookie: cookieB }, data: {} });
        expect(resUnblockB.status()).toBe(200);

        // 5. Verify Clean Slate
        const blockExists = db.prepare("SELECT count(*) as c FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?").get(userB.id, userA.id) as any;
        expect(blockExists.c).toBe(0);

        const friendshipExists = db.prepare("SELECT count(*) as c FROM friendships WHERE user_a_id = ? OR user_b_id = ?").get(userA.id, userA.id) as any;
        expect(friendshipExists.c).toBe(0);

        // 6. A can now successfully send a new request (Clean slate)
        const reqNew = await request.post('/api/friends/request', { data: { target_username: userB.username }, headers: { Cookie: cookieA } });
        expect(reqNew.status()).toBe(200);
    });
});
