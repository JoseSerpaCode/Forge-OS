import type { APIRoute } from 'astro';
import db from '../../../lib/db';

/**
 * A quién he bloqueado.
 *
 * Bloquear se podía —hay endpoint desde hace tiempo— pero **desbloquear no se
 * podía en la práctica**: el botón vive en el perfil de la persona bloqueada, y
 * a ese perfil se llega escribiendo su nombre exacto. Bloquear a alguien y
 * olvidar cómo se llamaba dejaba el bloqueo puesto para siempre.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const filas = db.prepare(`
    SELECT b.id, b.created_at, u.id AS user_id, u.username, u.avatar_url
    FROM user_blocks b
    JOIN users u ON u.id = b.blocked_id
    WHERE b.blocker_id = ?
    ORDER BY b.created_at DESC
  `).all(user.id) as any[];

  return json({
    blocked: filas.map((f) => ({
      userId: f.user_id,
      username: f.username,
      avatarUrl: f.avatar_url,
      since: f.created_at,
    })),
  });
};
