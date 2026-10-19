import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';

const db = new Database('./forge_test.db');

test.describe('Social Phase 2 - Profile Visibility & Anti-Enumeration', () => {
    let visitor: any, target: any, thirdUser: any;
    let cookieVisitor: string;

    test.beforeAll(() => {
        // Run migrations if needed on test db
        try {
            db.prepare('ALTER TABLE workspaces ADD COLUMN is_public BOOLEAN DEFAULT 0 CHECK(is_public IN (0, 1))').run();
            db.prepare("ALTER TABLE workspaces ADD COLUMN join_policy TEXT DEFAULT 'disabled' CHECK(join_policy IN ('open', 'friends_only', 'disabled'))").run();
        } catch (e) {
            // Already added
        }
    });

    test.beforeEach(async () => {
        // Create fresh users
        visitor = { id: randomUUID(), username: 'vis_' + randomUUID().substring(0, 8) };
        target = { id: randomUUID(), username: 'tgt_' + randomUUID().substring(0, 8) };
        thirdUser = { id: randomUUID(), username: 'third_' + randomUUID().substring(0, 8) };
        
        db.prepare("INSERT INTO users (id, username, password_hash, social_enabled) VALUES (?, ?, '123', 1)").run(visitor.id, visitor.username);
        db.prepare("INSERT INTO users (id, username, password_hash, social_enabled) VALUES (?, ?, '123', 1)").run(target.id, target.username);

        const sessionIdVisitor = randomUUID();
        const expires = new Date(Date.now() + 86400000).toISOString();
        
        db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionIdVisitor, visitor.id, expires);
        cookieVisitor = `forge_session=${sessionIdVisitor}`;
    });

    test('Non-existent user returns 404 Not Found (Anti-enumeration)', async ({ request }) => {
        const res = await request.get(`/u/this_user_does_not_exist_123`, {
            headers: { Cookie: cookieVisitor }
        });
        expect(res.status()).toBe(404);
        expect(res.statusText()).toBe('Not Found');
    });

    test('User that blocked the visitor returns EXACTLY the same 404 Not Found (Anti-enumeration)', async ({ request }) => {
        // Target blocks visitor
        db.prepare("INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)").run(target.id, visitor.id);

        const res = await request.get(`/u/${target.username}`, {
            headers: { Cookie: cookieVisitor }
        });
        expect(res.status()).toBe(404);
        expect(res.statusText()).toBe('Not Found');
    });

    test('Normal visitor returns 200 and sees public workspaces but NOT private ones', async ({ request, page }) => {
        // Create 1 public workspace and 1 private workspace for target
        const publicWsId = randomUUID();
        const privateWsId = randomUUID();

        db.prepare("INSERT INTO workspaces (id, name, sys_tag, created_by, is_public, join_policy) VALUES (?, ?, ?, ?, 1, 'open')").run(publicWsId, 'Public Board', randomUUID().substring(0,8), target.id);
        db.prepare("INSERT INTO workspaces (id, name, sys_tag, created_by, is_public, join_policy) VALUES (?, ?, ?, ?, 0, 'disabled')").run(privateWsId, 'Secret Project', randomUUID().substring(0,8), target.id);

        // API request check
        const res = await request.get(`/u/${target.username}`, {
            headers: { Cookie: cookieVisitor }
        });
        expect(res.status()).toBe(200);

        // UI check
        await page.setExtraHTTPHeaders({ Cookie: cookieVisitor });
        await page.goto(`/u/${target.username}`);
        
        const pageContent = await page.content();
        
        // Public workspace should be visible
        expect(pageContent).toContain('Public Board');
        // Private workspace MUST NOT be visible
        expect(pageContent).not.toContain('Secret Project');
    });

    test('Visitor who blocked the target returns 200 (Unilateral block policy)', async ({ request, page }) => {
        // Visitor blocks target
        db.prepare("INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)").run(visitor.id, target.id);

        const res = await request.get(`/u/${target.username}`, {
            headers: { Cookie: cookieVisitor }
        });
        
        // The policy is unilateral visibility: the blocker can still see the blocked person's profile
        // but with an "Unblock" button instead of interaction options.
        expect(res.status()).toBe(200);

        await page.setExtraHTTPHeaders({ Cookie: cookieVisitor });
        await page.goto(`/u/${target.username}`);
        const pageContent = await page.content();

        // The UI must contain the Unblock button
        expect(pageContent).toContain('Unblock User');
    });
});
