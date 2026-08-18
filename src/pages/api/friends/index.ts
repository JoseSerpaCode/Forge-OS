import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { escaparLike } from '../../../lib/texto';

/**
 * La lista de amigos y de solicitudes.
 *
 * No existía. Había endpoints para pedir, aceptar, rechazar, cancelar y quitar
 * —cinco verbos— pero ninguno para **ver**, así que la única forma de saber que
 * alguien te había mandado una solicitud era entrar a su perfil por casualidad.
 * Las solicitudes pendientes eran invisibles.
 *
 * La tabla guarda la relación una sola vez, con `user_a_id` y `user_b_id` en el
 * orden en que se creó. Quien mira puede estar en cualquiera de las dos
 * columnas, así que aquí se normaliza a «la otra persona» antes de devolver
 * nada: dejar esa decisión al cliente es pedirle que repita la misma lógica en
 * cada sitio donde se pinte una lista.
 *
 * `action_user_id` es quien hizo el último movimiento. Sobre una solicitud
 * pendiente eso distingue las dos situaciones que **no** son la misma cosa:
 * si fui yo, estoy esperando; si fue la otra persona, me toca responder. Se
 * devuelven separadas porque en pantalla no comparten botones.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Los invitados no tienen vida social: `canInteractSocially` ya lo impide en
  // los dos sentidos, así que una lista aquí siempre saldría vacía.
  if (user.is_guest) return json({ friends: [], incoming: [], outgoing: [] });

  const filas = db.prepare(`
    SELECT
      f.id,
      f.status,
      f.action_user_id,
      f.updated_at,
      u.id       AS user_id,
      u.username,
      u.avatar_url,
      u.is_public
    FROM friendships f
    JOIN users u
      ON u.id = CASE WHEN f.user_a_id = ? THEN f.user_b_id ELSE f.user_a_id END
    WHERE (f.user_a_id = ? OR f.user_b_id = ?)
      AND f.status IN ('pending', 'accepted')
      -- Un bloqueo por cualquiera de los dos lados esconde la relación. Sin
      -- esto, bloquear a alguien lo dejaba igual de visible en tu lista.
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks b
        WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
           OR (b.blocker_id = u.id AND b.blocked_id = ?)
      )
    ORDER BY u.username COLLATE NOCASE
  `).all(user.id, user.id, user.id, user.id, user.id) as any[];

  const friends: any[] = [];
  const incoming: any[] = [];
  const outgoing: any[] = [];

  for (const f of filas) {
    const persona = {
      friendshipId: f.id,
      userId: f.user_id,
      username: f.username,
      avatarUrl: f.avatar_url,
      // El perfil privado no se enlaza: el enlace llevaría a un 404 y parecería
      // que la cuenta ya no existe.
      hasProfile: f.is_public !== 0,
      since: f.updated_at,
    };
    if (f.status === 'accepted') friends.push(persona);
    else if (f.action_user_id === user.id) outgoing.push(persona);
    else incoming.push(persona);
  }

  return json({ friends, incoming, outgoing });
};

/**
 * Buscar a quién añadir.
 *
 * Es lo que faltaba para que lo demás sirviera: hasta ahora una solicitud solo
 * se podía enviar **desde el perfil de la otra persona**, y a ese perfil solo
 * se llegaba sabiendo su nombre exacto y escribiéndolo en la barra. Para
 * encontrar a alguien había que saber ya quién era.
 *
 * Cuatro reglas, y las cuatro tienen su motivo:
 *
 *  - **Los perfiles privados no salen.** Quien apaga su perfil público está
 *    diciendo que no quiere aparecer en listados; que salga aquí sería el mismo
 *    listado con otro nombre.
 *  - **Los invitados tampoco**, en los dos sentidos: `canInteractSocially` los
 *    excluye, así que aparecer solo llevaría a un botón que falla.
 *  - **Ni quien te bloqueó ni a quien bloqueaste.** Enseñar a quien te bloqueó
 *    le filtraría a otro que existe y que puede recibir algo.
 *  - **Se dice en qué estado está cada uno** —ya sois amigos, hay solicitud
 *    pendiente— para no ofrecer un botón que responde «ya existe».
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.is_guest) return json({ results: [] });

  let texto = '';
  try {
    texto = String((await request.json())?.q ?? '').trim();
  } catch {
    return json({ error_code: 'bad_json' }, 400);
  }

  // Con menos de dos letras la lista sería medio padrón.
  if (texto.length < 2) return json({ results: [] });

  // Los comodines de SQL se buscan como texto: sin escapar, `%` saca a todos.
  const escapado = escaparLike(texto);

  const filas = db.prepare(`
    SELECT
      u.id, u.username, u.avatar_url,
      f.id AS friendship_id, f.status, f.action_user_id
    FROM users u
    LEFT JOIN friendships f
      ON (f.user_a_id = u.id AND f.user_b_id = ?)
      OR (f.user_b_id = u.id AND f.user_a_id = ?)
    WHERE u.id != ?
      AND u.is_guest = 0
      AND u.is_public = 1
      AND u.id NOT IN ('deleted-user', 'system')
      AND u.username LIKE ? ESCAPE '\\'
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks b
        WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
           OR (b.blocker_id = u.id AND b.blocked_id = ?)
      )
    ORDER BY
      -- Primero quien empieza por lo escrito: buscando «jo», «jose» va antes
      -- que «mejor_jose».
      CASE WHEN u.username LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
      LENGTH(u.username),
      u.username COLLATE NOCASE
    LIMIT 10
  `).all(user.id, user.id, user.id, `%${escapado}%`, user.id, user.id, `${escapado}%`) as any[];

  return json({
    results: filas.map((f) => ({
      userId: f.id,
      username: f.username,
      avatarUrl: f.avatar_url,
      // 'none' | 'friends' | 'sent' | 'received'
      estado: f.status === 'accepted'
        ? 'friends'
        : f.status === 'pending'
          ? (f.action_user_id === user.id ? 'sent' : 'received')
          : 'none',
      friendshipId: f.friendship_id ?? null,
    })),
  });
};
