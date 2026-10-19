import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { abrirEspacio, json } from '../../../../../lib/apiWorkspace';
import { escaparLike } from '../../../../../lib/texto';

/**
 * Buscar apuntes de un espacio por título, para vincularlos a una tarea.
 *
 * Lo usan el `[[` del alta rápida y el «Vincular apunte» del panel. Solo
 * páginas **de este espacio**: el espacio sale de la ruta, y quien busca tiene
 * que poder verlo.
 *
 * Sin texto devuelve las más recientes, que suele ser lo que se busca: el
 * apunte de la clase de hoy.
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;

  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  const filas = q
    ? db.prepare(`
        SELECT id, title, icon FROM pages
        WHERE workspace_id = ? AND title LIKE ? ESCAPE '\\'
        ORDER BY (title LIKE ? ESCAPE '\\') DESC, updated_at DESC
        LIMIT 8
      `).all(ws.id, `%${escaparLike(q)}%`, `${escaparLike(q)}%`)
    : db.prepare('SELECT id, title, icon FROM pages WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 8').all(ws.id);

  return json(filas);
};
