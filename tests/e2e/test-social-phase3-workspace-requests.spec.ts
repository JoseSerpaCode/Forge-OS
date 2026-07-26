import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';

const db = new Database('./forge_test.db');

test.describe('Social Phase 3 - Workspace Join Requests', () => {
    let owner: any, user1: any, user2: any;
    let cookieOwner: string, cookieUser1: string, cookieUser2: string;
    let wsId: string;

    test.beforeAll(() => {
        // Run migrations if needed
        try {
            db.prepare('ALTER TABLE workspaces ADD COLUMN is_public BOOLEAN DEFAULT 0 CHECK(is_public IN (0, 1))').run();
            db.prepare("ALTER TABLE workspaces ADD COLUMN join_policy TEXT DEFAULT 'disabled' CHECK(join_policy IN ('open', 'friends_only', 'disabled'))").run();
        } catch (e) {}
    });

    test.beforeEach(async () => {
        owner = { id: randomUUID(), username: 'ws_owner_' + randomUUID().substring(0, 8) };
        user1 = { id: randomUUID(), username: 'req_u1_' + randomUUID().substring(0, 8) };
        user2 = { id: randomUUID(), username: 'req_u2_' + randomUUID().substring(0, 8) };
        
        const st = db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, '123')");
        st.run(owner.id, owner.username);
        st.run(user1.id, user1.username);
        st.run(user2.id, user2.username);

        const mkCookie = (uid: string) => {
            const sid = randomUUID();
            db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sid, uid, new Date(Date.now() + 86400000).toISOString());
            return `forge_session=${sid}`;
        };

        cookieOwner = mkCookie(owner.id);
        cookieUser1 = mkCookie(user1.id);
        cookieUser2 = mkCookie(user2.id);

        wsId = randomUUID();
        db.prepare("INSERT INTO workspaces (id, name, sys_tag, created_by, is_public, join_policy) VALUES (?, 'Public WS', ?, ?, 1, 'open')").run(wsId, randomUUID().substring(0,8), owner.id);
        db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, 'owner')").run(wsId, owner.id);
    });

    test('Public to private transition cancels pending requests and sends notification', async ({ request }) => {
        // 1. Users send join requests
        const res1 = await request.post(`/api/workspaces/${wsId}/join`, { headers: { Cookie: cookieUser1 }, data: {} });
        if (res1.status() !== 200) console.error(await res1.text());
        expect(res1.status()).toBe(200);

        const res2 = await request.post(`/api/workspaces/${wsId}/join`, { headers: { Cookie: cookieUser2 }, data: {} });
        expect(res2.status()).toBe(200);

        const pendingReqs = db.prepare("SELECT id, status FROM workspace_join_requests WHERE workspace_id = ?").all(wsId) as any[];
        expect(pendingReqs.length).toBe(2);
        expect(pendingReqs[0].status).toBe('pending');
        expect(pendingReqs[1].status).toBe('pending');

        const req1Id = pendingReqs.find((r: any) => (db.prepare('SELECT user_id FROM workspace_join_requests WHERE id=?').get(r.id) as any).user_id === user1.id).id;

        // 2. Owner changes workspace to private
        const patchRes = await request.patch(`/api/workspaces/${wsId}`, {
            headers: { Cookie: cookieOwner },
            data: {
                name: 'Public WS',
                sys_tag: (db.prepare('SELECT sys_tag FROM workspaces WHERE id=?').get(wsId) as any).sys_tag,
                is_public: false,
                join_policy: 'disabled'
            }
        });
        expect(patchRes.status()).toBe(200);

        // 3. Requests should be cancelled
        const cancelledReqs = db.prepare("SELECT status FROM workspace_join_requests WHERE workspace_id = ?").all(wsId) as any[];
        expect(cancelledReqs.length).toBe(2);
        expect(cancelledReqs.every(r => r.status === 'cancelled')).toBe(true);

        // 4. Try to accept a cancelled request (should fail)
        const acceptRes = await request.post(`/api/workspaces/${wsId}/requests/${req1Id}/accept`, {
            headers: { Cookie: cookieOwner },
            data: {}
        });
        expect(acceptRes.status()).toBe(400); // "Request is not pending"

        // 5. Notifications are generated exactly once per user
        const notifs = db.prepare("SELECT id FROM notifications WHERE user_id IN (?, ?) AND title = 'Workspace Request Cancelled'").all(user1.id, user2.id) as any[];
        expect(notifs.length).toBe(2); // One for user1, one for user2

        // 6. Test Idempotency: Send the same PATCH again
        const patchRes2 = await request.patch(`/api/workspaces/${wsId}`, {
            headers: { Cookie: cookieOwner },
            data: {
                name: 'Public WS',
                sys_tag: (db.prepare('SELECT sys_tag FROM workspaces WHERE id=?').get(wsId) as any).sys_tag,
                is_public: false,
                join_policy: 'disabled'
            }
        });
        expect(patchRes2.status()).toBe(200);

        // Notifications count should remain the same (no duplicates)
        const notifsAfter = db.prepare("SELECT id FROM notifications WHERE user_id IN (?, ?) AND title = 'Workspace Request Cancelled'").all(user1.id, user2.id) as any[];
        expect(notifsAfter.length).toBe(2);
    });

    test('friends_only policy correctly allows friends and blocks non-friends', async ({ request }) => {
        // Change ws to friends_only
        await request.patch(`/api/workspaces/${wsId}`, {
            headers: { Cookie: cookieOwner },
            data: {
                name: 'Public WS',
                sys_tag: (db.prepare('SELECT sys_tag FROM workspaces WHERE id=?').get(wsId) as any).sys_tag,
                is_public: 1,
                join_policy: 'friends_only'
            }
        });

        // user1 sends request (not a friend)
        const resNonFriend = await request.post(`/api/workspaces/${wsId}/join`, { headers: { Cookie: cookieUser1 }, data: {} });
        expect(resNonFriend.status()).toBe(403);

        // user2 becomes a friend
        const userA = owner.id < user2.id ? owner.id : user2.id;
        const userB = owner.id < user2.id ? user2.id : owner.id;
        db.prepare("INSERT INTO friendships (user_a_id, user_b_id, status, action_user_id) VALUES (?, ?, 'accepted', ?)").run(userA, userB, user2.id);

        // user2 sends request
        const resFriend = await request.post(`/api/workspaces/${wsId}/join`, { headers: { Cookie: cookieUser2 }, data: {} });
        expect(resFriend.status()).toBe(200);
    });
});
