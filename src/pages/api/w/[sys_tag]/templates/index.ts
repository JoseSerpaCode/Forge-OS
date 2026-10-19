import type { APIRoute } from 'astro';
import { abrirEspacio, json, cuerpo } from '../../../../../lib/apiWorkspace';
import { borrar, desdeTarea, listar } from '../../../../../lib/plantillas';

/**
 * Plantillas del espacio. Verlas, quien ve el espacio; crearlas y borrarlas,
 * quien puede editar: cambian lo que el equipo encuentra al crear una tarea.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;
  return json(listar(ws.id));
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;
  const datos = await cuerpo(request);
  if (typeof datos?.issue_id !== 'string') return json({ error_code: 'bad_request' }, 400);
  const r = desdeTarea(datos.issue_id, ws.id, datos.name, locals.user!.id, datos.due_offset);
  return r.ok ? json({ id: r.id }, 201) : json({ error_code: r.error }, r.error === 'no_existe' ? 404 : 400);
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;
  const datos = await cuerpo(request);
  if (typeof datos?.id !== 'string') return json({ error_code: 'bad_request' }, 400);
  return borrar(datos.id, ws.id) ? json({ success: true }) : json({ error_code: 'not_found' }, 404);
};
