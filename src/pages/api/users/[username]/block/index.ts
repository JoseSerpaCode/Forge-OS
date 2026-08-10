import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { canInteractSocially, socialBlockReason, SOCIAL_DENIED } from '../../../../../lib/social';

export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    const user = locals.user;
    if (!user) return new Response('Unauthorized', { status: 401 });

    const targetUsername = params.username;
    if (!targetUsername) return new Response('Bad Request', { status: 400 });

    if (user.username === targetUsername) {
       return new Response('Cannot block yourself', { status: 400 });
    }

    const targetUser = db.prepare('SELECT id, is_guest FROM users WHERE username = ?').get(targetUsername) as {id: string, is_guest: number} | undefined;
    
    if (!targetUser) return new Response('User not found', { status: 404 });

    // Bloquear es una acción social, y era la única que se había quedado sin
    // esta comprobación. Un invitado no puede bloquear (la cuenta es
    // desechable: bloquear y fabricarse otra no protege de nada) y a un
    // invitado no se le bloquea, porque no puede dirigirte nada que bloquear.
    if (!canInteractSocially(user, targetUser)) {
      const reason = socialBlockReason(user, targetUser)!;
      return new Response(SOCIAL_DENIED[reason], { status: 403 });
    }

    const blockId = crypto.randomUUID();

    // ID normalizado para amistades
    const userA = user.id < targetUser.id ? user.id : targetUser.id;
    const userB = user.id < targetUser.id ? targetUser.id : user.id;

    const tx = db.transaction(() => {
        // 1. Update friendships to blocked
        db.prepare(`
            UPDATE friendships 
            SET status = 'blocked', updated_at = CURRENT_TIMESTAMP
            WHERE user_a_id = ? AND user_b_id = ?
        `).run(userA, userB);

        // 2. Delete pending workspace requests both ways
        db.prepare(`
           DELETE FROM workspace_join_requests WHERE status='pending' AND (
             (workspace_id IN (SELECT id FROM workspaces WHERE created_by = ?) AND user_id = ?)
             OR
             (workspace_id IN (SELECT id FROM workspaces WHERE created_by = ?) AND user_id = ?)
           )
        `).run(user.id, targetUser.id, targetUser.id, user.id);

        // 3. Insert into blocks, ignore if already exists (silent success)
        db.prepare(`
            INSERT INTO user_blocks (id, blocker_id, blocked_id) 
            VALUES (?, ?, ?)
            ON CONFLICT(blocker_id, blocked_id) DO NOTHING
        `).run(blockId, user.id, targetUser.id);
    });

    tx();
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e: any) {
    console.error('Block Error:', e);
    return new Response(e.message, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  try {
    const user = locals.user;
    if (!user) return new Response('Unauthorized', { status: 401 });

    const targetUsername = params.username;
    if (!targetUsername) return new Response('Bad Request', { status: 400 });

    const targetUser = db.prepare('SELECT id FROM users WHERE username = ?').get(targetUsername) as {id: string} | undefined;
    if (!targetUser) return new Response('User not found', { status: 404 });

    const userA = user.id < targetUser.id ? user.id : targetUser.id;
    const userB = user.id < targetUser.id ? targetUser.id : user.id;

    const tx = db.transaction(() => {
        // Delete block
        const blockResult = db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?').run(user.id, targetUser.id);
        
        if (blockResult.changes === 0) {
            return false;
        }

        // Remove friendship entirely so it's a clean slate
        db.prepare(`
            DELETE FROM friendships 
            WHERE (user_a_id = ? AND user_b_id = ?) AND status = 'blocked'
            AND (user_a_id = ? OR user_b_id = ?)
        `).run(userA, userB, userA, userB);

        return true;
    });

    const success = tx();
    
    if (!success) {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e: any) {
    console.error('Unblock Error:', e);
    return new Response(e.message, { status: 500 });
  }
}
