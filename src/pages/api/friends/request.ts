import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import crypto from 'crypto';
import { canInteractSocially, socialBlockReason, SOCIAL_DENIED } from '../../../lib/social';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) return new Response('Unauthorized', { status: 401 });
    const { target_username } = await request.json();
    if (!target_username) return new Response('Bad Request', { status: 400 });

    if (user.username === target_username) {
        return new Response('Cannot add yourself', { status: 400 });
    }

    const targetUser = db.prepare('SELECT id, is_guest FROM users WHERE username = ?').get(target_username) as {id: string, is_guest: number} | undefined;
    if (!targetUser) return new Response('User not found', { status: 404 });
    if (!canInteractSocially(user, targetUser)) {
      const reason = socialBlockReason(user, targetUser)!;
      return new Response(SOCIAL_DENIED[reason], { status: 403 });
    }

    // Check for block
    const isBlocked = db.prepare(`
        SELECT 1 FROM user_blocks 
        WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
    `).get(user.id, targetUser.id, targetUser.id, user.id);

    if (isBlocked) {
        // Opacity: return generic generic error or 404 behavior as per spec
        return new Response('No es posible enviar una solicitud a este usuario en este momento', { status: 400 });
    }

    const userA = user.id < targetUser.id ? user.id : targetUser.id;
    const userB = user.id < targetUser.id ? targetUser.id : user.id;

    // Check existing
    const existing = db.prepare('SELECT status, updated_at FROM friendships WHERE user_a_id = ? AND user_b_id = ?').get(userA, userB) as any;
    
    if (existing) {
        if (existing.status === 'pending' || existing.status === 'accepted') {
            return new Response('Request already pending or accepted', { status: 400 });
        }
        if (existing.status === 'blocked') {
             return new Response('No es posible enviar una solicitud a este usuario en este momento', { status: 400 });
        }
        
        // Cooldown check for rejected or ended
        const updatedDate = new Date(existing.updated_at);
        const now = new Date();
        const diffDays = (now.getTime() - updatedDate.getTime()) / (1000 * 3600 * 24);
        
        if (diffDays < 30) {
            return new Response('No es posible enviar una solicitud a este usuario en este momento', { status: 400 });
        }

        // UPDATE
        db.prepare(`
            UPDATE friendships 
            SET status = 'pending', action_user_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_a_id = ? AND user_b_id = ?
        `).run(user.id, userA, userB);

    } else {
        // INSERT
        const id = crypto.randomUUID();
        db.prepare(`
            INSERT INTO friendships (id, user_a_id, user_b_id, status, action_user_id) 
            VALUES (?, ?, ?, 'pending', ?)
        `).run(id, userA, userB, user.id);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e: any) {
    console.error('Friend Request Error:', e);
    return new Response(e.message, { status: 500 });
  }
};
