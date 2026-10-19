import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { abrirEspacio, json, cuerpo } from '../../../../../lib/apiWorkspace';
import { usar } from '../../../../../lib/plantillas';
import { hoyEn } from '../../../../../lib/fechas';
import { handleApiError } from '../../../../../lib/errors';
import { funciones } from '../../../../../lib/funcionesEspacio';

/**
 * Crear una tarea desde una plantilla. La entrega relativa se cuenta desde el
 * día de **quien la usa** (su zona horaria), no desde el del servidor.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'editor');
  if (error) return error;
  const datos = await cuerpo(request);
  if (typeof datos?.id !== 'string') return json({ error_code: 'bad_request' }, 400);
  let sprintId: string | null = null;
  if (datos.sprint_id && funciones(ws.id).sprints) {
    if (!db.prepare('SELECT 1 FROM sprints WHERE id = ? AND workspace_id = ?').get(datos.sprint_id, ws.id)) return json({ error_code: 'bad_sprint' }, 400);
    sprintId = datos.sprint_id;
  }
  try {
    const r = await usar(datos.id, ws.id, user.id, user.is_sysadmin, hoyEn(user.timezone), sprintId);
    return r ? json(r, 201) : json({ error_code: 'not_found' }, 404);
  } catch (err) {
    return handleApiError(err);
  }
};
