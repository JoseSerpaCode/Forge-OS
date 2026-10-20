import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';

const db = new Database('./forge_test.db');

function createTestUser(username: string) {
    const id = randomUUID();
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, 'hash');
    return { id, username };
}

function createTestWorkspace(ownerId: string, name: string) {
    const id = randomUUID();
    const sys_tag = name.toLowerCase().replace(/\s+/g, '-');
    db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?, ?, ?, ?)').run(id, name, sys_tag, ownerId);
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)').run(id, ownerId, 'owner');
    return id;
}

test.describe('Phase 4: Notifications, Invites, and Recent Activity', () => {
    let owner: any;
    let user1: any;
    let wsId: string;
    let cookieOwner: string;
    let cookieUser1: string;

    test.beforeEach(async () => {
        owner = createTestUser(`owner_p4_${randomUUID().substring(0,8)}`);
        user1 = createTestUser(`user1_p4_${randomUUID().substring(0,8)}`);
        wsId = createTestWorkspace(owner.id, `P4 Workspace ${randomUUID().substring(0,8)}`);

        const mkCookie = (uid: string) => {
            const sid = randomUUID();
            db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sid, uid, new Date(Date.now() + 86400000).toISOString());
            return `forge_session=${sid}`;
        };

        cookieOwner = mkCookie(owner.id);
        cookieUser1 = mkCookie(user1.id);
    });

    test('notifications page displays elements correctly', async ({ request }) => {
        // user1 views their activity page
        const res = await request.get('/activity', { headers: { Cookie: cookieUser1 } });
        expect(res.status()).toBe(200);
        const html = await res.text();
        
        // Assert UI components exist
        expect(html).toContain('Activity and notifications');
        expect(html).toContain('Recent activity');
        expect(html).toContain('Workspace invitations');
        expect(html).toContain('My join requests');
    });

    test('invitations flow works end-to-end', async ({ request }) => {
        // 1. Owner invites user1 to workspace
        const link_url = JSON.stringify({ ws_id: wsId, role: 'editor' });
        const inviteNotifId = randomUUID();
        db.prepare(`
            INSERT INTO notifications (id, user_id, title, message, type, link_url)
            VALUES (?, ?, 'Workspace Invite', 'You have been invited', 'invite', ?)
        `).run(inviteNotifId, user1.id, link_url);

        // 2. User1 checks their activity page and sees the invite
        const actRes = await request.get('/activity', { headers: { Cookie: cookieUser1 } });
        const actHtml = await actRes.text();
        expect(actHtml).toContain('Workspace Invite');
        
        // Extract notification ID
        const notif = db.prepare("SELECT id FROM notifications WHERE user_id = ? AND type = 'invite'").get(user1.id) as any;
        expect(notif).toBeDefined();

        // 3. User1 accepts the invite
        const acceptRes = await request.post('/api/user/invites', {
            headers: { Cookie: cookieUser1 },
            data: { notifId: notif.id, action: 'accept' }
        });
        if (acceptRes.status() !== 200) {
            console.error('acceptRes:', await acceptRes.text());
        }
        expect(acceptRes.status()).toBe(200);

        // 4. Verify user1 is now a member of the workspace
        const member = db.prepare("SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?").get(wsId, user1.id);
        expect(member).toBeDefined();
        
        // 5. Verify notification was deleted
        const notifAfter = db.prepare("SELECT * FROM notifications WHERE id = ?").get(notif.id);
        expect(notifAfter).toBeUndefined();
    });

    test('notifications marking as read works', async ({ request }) => {
        // Generate a system notification
        const sysNotifId = randomUUID();
        db.prepare(`
            INSERT INTO notifications (id, user_id, title, message, type, is_read)
            VALUES (?, ?, 'Test Notif', 'Hello World', 'system', 0)
        `).run(sysNotifId, user1.id);

        const notif = db.prepare("SELECT id FROM notifications WHERE user_id = ? AND title = 'Test Notif'").get(user1.id) as any;

        // Mark as read
        const readRes = await request.post('/api/user/notifications', {
            headers: { Cookie: cookieUser1 },
            data: { action: 'mark_read', id: notif.id }
        });
        if (readRes.status() !== 200) {
            console.error('readRes:', await readRes.text());
        }
        expect(readRes.status()).toBe(200);

        // Verify in DB
        const notifAfter = db.prepare("SELECT is_read FROM notifications WHERE id = ?").get(notif.id) as any;
        expect(notifAfter.is_read).toBe(1);

        // Mark all as read
        const markAllRes = await request.post('/api/user/notifications', {
            headers: { Cookie: cookieUser1 },
            data: { action: 'mark_all_read' }
        });
        expect(markAllRes.status()).toBe(200);
    });
});
