import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { checkRateLimit } from '../../../lib/rateLimit';
import { getClientIp } from '../../../lib/clientIp';
import { adoptarTrabajoDeInvitado } from '../../../lib/adopcionInvitado';

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
    
    const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as any;
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      console.error('[LOGIN_DEBUG] Credenciales inválidas for username:', username);
      return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
    }

    const currentUser = locals.user;
    if (currentUser && currentUser.is_guest === 1) {
      // Qué se conserva del trabajo hecho como invitado y qué se tira lo decide
      // `lib/adopcionInvitado.ts`. Estaba aquí, con once consultas en línea
      // dentro del controlador de entrada y sin transacción: un fallo a mitad
      // dejaba el espacio con el dueño cambiado y los tickets a nombre de una
      // cuenta a punto de borrarse.
      adoptarTrabajoDeInvitado(currentUser.id, user.id, keep_workspaces);
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
