import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../lib/guard';
import { IssueService } from '../../../../lib/IssueService';
import { handleApiError } from '../../../../lib/errors';

/**
 * Las subtareas de una tarea.
 *
 * Listar y crear van aquí; marcar, renombrar y borrar una subtarea usan los
 * endpoints de siempre (`PATCH`/`DELETE /api/issues/[id]`), porque una subtarea
 * es una tarea: tiene su `status`, su `done_at` y sus permisos.
 */
const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const madre = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(params.id) as any;
  if (!madre) return new Response('Not Found', { status: 404 });
  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, madre.workspace_id, 'viewer');
  if (!acceso.granted) return new Response('Not Found', { status: acceso.reason === 'not_member' ? 404 : 403 });
  return json(IssueService.listarSubtareas(params.id as string));
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  try {
    let datos: any = null;
    try { datos = await request.json(); } catch { /* sin cuerpo */ }
    return json(IssueService.crearSubtarea(params.id as string, datos?.title, user.id, user.is_sysadmin), 201);
  } catch (err) {
    return handleApiError(err);
  }
};
