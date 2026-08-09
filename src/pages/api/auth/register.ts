import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { checkRateLimit } from '../../../lib/rateLimit';
import { getClientIp } from '../../../lib/clientIp';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const { username, password, keep_workspaces } = await request.json();

    const ip = getClientIp(request);
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

    if (username.length < 3) {
      return new Response(JSON.stringify({ error: 'Username must be at least 3 characters' }), { status: 400 });
    }

    if (username.length > 32) {
      return new Response(JSON.stringify({ error: 'Username cannot exceed 32 characters' }), { status: 400 });
    }

    // [A-2 FIX] Restrict to safe characters — prevents XSS payloads in usernames
    if (!/^[a-zA-Z0-9._\-]+$/.test(username)) {
      return new Response(JSON.stringify({ error: 'Username can only contain letters, numbers, dots, hyphens and underscores' }), { status: 400 });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400 });
    }

    // [A-2 FIX] Prevent DoS via bcrypt with extremely long passwords
    if (password.length > 128) {
      return new Response(JSON.stringify({ error: 'Password cannot exceed 128 characters' }), { status: 400 });
    }
    
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return new Response(JSON.stringify({ error: 'Username already taken' }), { status: 409 });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

    const currentUser = locals.user;
    
    if (currentUser && currentUser.is_guest === 1) {
      // Upgrade existing guest account
      db.prepare('UPDATE users SET username = ?, password_hash = ?, avatar_url = ?, is_guest = 0 WHERE id = ?').run(
        username, passwordHash, avatarUrl, currentUser.id
      );

      if (Array.isArray(keep_workspaces)) {
        const userWorkspaces = db.prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ?').all(currentUser.id) as any[];
        for (const uw of userWorkspaces) {
           if (!keep_workspaces.includes(uw.workspace_id)) {
               db.prepare('DELETE FROM workspaces WHERE id = ?').run(uw.workspace_id);
           }
        }
      }
    } else {
      // Create entirely new user
      const userId = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, username, password_hash, avatar_url) VALUES (?, ?, ?, ?)').run(
        userId, username, passwordHash, avatarUrl
      );
      
      const sessionId = crypto.randomUUID();
      const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 días
      db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, userId, expiresAt);
      
      cookies.set('forge_session', sessionId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30
      });
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
