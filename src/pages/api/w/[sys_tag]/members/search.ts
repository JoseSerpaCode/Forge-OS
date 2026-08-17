import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../../lib/guard';

/**
 * Personas a las que se puede invitar a este espacio.
 *
 * Existe porque el campo de invitar era un texto libre: había que escribir el
 * nombre exacto y, si te equivocabas en una letra, el error llegaba después de
 * enviar. Escribir de memoria el nombre de alguien es justo lo que un buscador
 * evita.
 *
 * Tres reglas, y las tres importan:
 *
 *  - **Solo lo pide quien puede invitar**, es decir un propietario. Si no, este
 *    endpoint sería un listado de usuarios de la instancia para cualquiera.
 *  - **No salen las cuentas de invitado.** Son temporales y caducan; invitar a
 *    una es regalarle trabajo a algo que va a desaparecer.
 *  - **No salen quienes ya están dentro.** Aparecer en la lista de invitables a
 *    alguien que ya es miembro solo lleva a un error al enviar.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ params, url, locals }) => {
  const user = locals.user!;

  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(params.sys_tag) as any;
  if (!ws) return new Response('Not Found', { status: 404 });

  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, ws.id, 'owner');
  if (!acceso.granted) {
    // 404 a quien no es miembro: un 403 confirmaría que el espacio existe.
    if (acceso.reason === 'not_member') return new Response('Not Found', { status: 404 });
    return new Response(acceso.error, { status: 403 });
  }

  const texto = (url.searchParams.get('q') ?? '').trim();
  // Con menos de dos letras la lista sería medio padrón. Se devuelve vacío en
  // vez de todo.
  if (texto.length < 2) return json({ users: [] });

  // Los comodines de SQL se buscan como texto: sin escapar, `%` sacaría a todo
  // el mundo.
  const patron = `%${texto.replace(/[%_]/g, (c) => `\\${c}`)}%`;

  const usuarios = db.prepare(`
    SELECT u.id, u.username, u.avatar_url AS avatarUrl
    FROM users u
    WHERE u.is_guest = 0
      AND u.id <> 'deleted-user'
      AND u.id <> 'system'
      AND u.username LIKE ? ESCAPE '\\'
      AND NOT EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id = ? AND m.user_id = u.id
      )
    ORDER BY
      -- Primero quien empieza por lo escrito: buscando «jo», «jose» va antes
      -- que «mejor_jose».
      CASE WHEN u.username LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
      LENGTH(u.username),
      u.username COLLATE NOCASE
    LIMIT 8
  `).all(patron, ws.id, `${texto.replace(/[%_]/g, (c) => `\\${c}`)}%`) as any[];

  return json({ users: usuarios });
};
