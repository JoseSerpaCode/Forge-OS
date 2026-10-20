import type { APIRoute } from 'astro';
import { abrirEspacio, json, cuerpo } from '../../../../../lib/apiWorkspace';
import { actualizar, borrar, crear, desdeTarea, listar, type Resultado } from '../../../../../lib/plantillas';

/**
 * Plantillas del espacio. Verlas, quien ve el espacio; crearlas y borrarlas,
 * quien puede editar: cambian lo que el equipo encuentra al crear una tarea.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;
  return json(listar(ws.id));
};

const respuesta = (r: Resultado, codigoOk: number) =>
  r.ok ? json({ id: r.id }, codigoOk) : json({ error_code: r.error }, r.error === 'no_existe' ? 404 : 400);

/**
 * Crear: desde una tarea (`issue_id`, «Guardar como plantilla» en su panel) o
 * escrita en los ajustes del espacio (`contenido`).
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;
  const datos = await cuerpo(request);
  if (typeof datos?.issue_id === 'string') {
    return respuesta(desdeTarea(datos.issue_id, ws.id, datos.name, locals.user!.id, datos.due_offset), 201);
  }
  if (datos?.contenido && typeof datos.contenido === 'object') {
    return respuesta(crear(ws.id, datos.name, datos.contenido, locals.user!.id), 201);
  }
  return json({ error_code: 'bad_request' }, 400);
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;
  const datos = await cuerpo(request);
  if (typeof datos?.id !== 'string' || !datos.contenido || typeof datos.contenido !== 'object') return json({ error_code: 'bad_request' }, 400);
  return respuesta(actualizar(datos.id, ws.id, datos.name, datos.contenido), 200);
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;
  const datos = await cuerpo(request);
  if (typeof datos?.id !== 'string') return json({ error_code: 'bad_request' }, 400);
  return borrar(datos.id, ws.id) ? json({ success: true }) : json({ error_code: 'not_found' }, 404);
};
