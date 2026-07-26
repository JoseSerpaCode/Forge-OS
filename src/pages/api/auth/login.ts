import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { checkRateLimit } from '../../../lib/rateLimit';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const { username, password, keep_workspaces } = await request.json();

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('cf-connecting-ip') || 'unknown';
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: `Too many attempts. Please try again in ${rateCheck.retryAfter} seconds.` }), {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfter), 'Content-Type': 'application/json' }
      });
    }
    
    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Faltan credenciales' }), { status: 400 });
    }
    
    const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as any;
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      console.error('[LOGIN_DEBUG] Credenciales inválidas for username:', username);
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
    }

    const currentUser = locals.user;
    if (currentUser && currentUser.is_guest === 1) {
      if (Array.isArray(keep_workspaces) && keep_workspaces.length > 0) {
         for (const wsId of keep_workspaces) {
             const isMember = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(wsId, currentUser.id);
             if (isMember) {
                db.prepare('UPDATE workspaces SET created_by = ? WHERE id = ? AND created_by = ?').run(user.id, wsId, currentUser.id);
                db.prepare('UPDATE issues SET reporter_id = ? WHERE reporter_id = ? AND workspace_id = ?').run(user.id, currentUser.id, wsId);
                db.prepare('UPDATE issues SET assignee_id = ? WHERE assignee_id = ? AND workspace_id = ?').run(user.id, currentUser.id, wsId);
                db.prepare('UPDATE pages SET created_by = ? WHERE created_by = ? AND workspace_id = ?').run(user.id, currentUser.id, wsId);
                db.prepare('INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)').run(wsId, user.id, 'owner');
             }
         }
      }
      
      // Only delete workspaces CREATED by the guest (not ones they were invited to)
      const guestOwnedWorkspaces = db.prepare('SELECT id FROM workspaces WHERE created_by = ?').all(currentUser.id) as any[];
      for (const uw of guestOwnedWorkspaces) {
          if (!Array.isArray(keep_workspaces) || !keep_workspaces.includes(uw.id)) {
              db.prepare('DELETE FROM workspaces WHERE id = ?').run(uw.id);
          }
      }
      // Remove guest from any workspaces they were invited to (not owned)
      db.prepare('DELETE FROM workspace_members WHERE user_id = ?').run(currentUser.id);
      
      // Guest will be unlinked (their cookie replaced), but since we deleted their workspaces, we leave the guest account orphaned to be cleaned up or just delete it if not constrained.
      // We safely deleted workspaces above which cascades to issues, sprints, pages. So the guest account should be clean.
    }
    
    // Rotación de Sesión de Seguridad
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 días
    
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expiresAt);
    
    cookies.set('forge_session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('[LOGIN_DEBUG] Internal Server Error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
