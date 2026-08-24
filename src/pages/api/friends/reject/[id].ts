import type { APIRoute } from 'astro';
import db from '../../../../lib/db';

export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    const user = locals.user;
    if (!user) return new Response('Unauthorized', { status: 401 });

    const friendshipId = params.id;
    if (!friendshipId) return new Response('Bad Request', { status: 400 });

    const result = db.prepare(`
      UPDATE friendships 
      SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? 
      AND (user_a_id = ? OR user_b_id = ?) 
      AND action_user_id != ? 
      AND status = 'pending'
    `).run(friendshipId, user.id, user.id, user.id);
    
    /**
     * El 404 no cuenta nada de la fila.
     *
     * Aquí se devolvía `dbState` con el `SELECT *` entero de la amistad:
     * `action_user_id`, el id de la otra persona y las marcas de tiempo, a
     * quien acababa de fallar la comprobación de permisos. Era depuración que
     * se quedó puesta —había también un `console.log` de cada intento— y
     * convertía un «no puedes» en un volcado de la tabla.
     *
     * Sus dos hermanos, `accept/[id].ts` y `cancel/[id].ts`, responden con la
     * frase a secas. Este era el único de los tres que se salía del patrón.
     */
    if (result.changes === 0) {
        return new Response('Not Found or Unauthorized', { status: 404 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e: any) {
    console.error('Reject Friend Error:', e);
    return new Response(e.message, { status: 500 });
  }
};
