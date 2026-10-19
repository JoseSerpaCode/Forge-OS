import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { checkWorkspaceAccess } from '../../../lib/guard';
import { crearFeed, listarFeeds, revocar } from '../../../lib/calendario';

/**
 * Los enlaces de calendario de la cuenta. El token se devuelve **solo al
 * crearlo**: después solo se guarda su hash.
 */
const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  return json(listarFeeds(user.id));
};

export const POST: APIRoute = async ({ request, locals, url }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.is_guest === 1) return json({ error_code: 'guest' }, 403);
  let datos: any = null;
  try { datos = await request.json(); } catch { /* sin cuerpo: todas las tareas */ }
  let workspaceId: string | null = null;
  if (datos?.workspace_id) {
    const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, datos.workspace_id, 'viewer');
    if (!acceso.granted || !db.prepare('SELECT 1 FROM workspaces WHERE id = ?').get(datos.workspace_id)) return json({ error_code: 'not_found' }, 404);
    workspaceId = datos.workspace_id;
  }
  const { id, token } = crearFeed(user.id, workspaceId);
  const base = (process.env.PUBLIC_SITE_URL || url.origin).replace(/\/$/, '');
  return json({ id, url: `${base}/cal/${token}.ics` }, 201);
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  let datos: any = null;
  try { datos = await request.json(); } catch { /* sin cuerpo */ }
  if (typeof datos?.id !== 'string') return json({ error_code: 'bad_request' }, 400);
  return revocar(user.id, datos.id) ? json({ success: true }) : json({ error_code: 'not_found' }, 404);
};
