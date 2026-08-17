import type { APIRoute } from 'astro';
import { borrar, crear, editar, listar } from '../../../../../lib/labels';
import { abrirEspacio, json, cuerpo } from '../../../../../lib/apiWorkspace';

/**
 * Etiquetas de un espacio.
 *
 * El espacio sale de la **ruta**, nunca del cuerpo: aceptarlo del cuerpo es el
 * camino corto al IDOR —bastaría con mandar el id de otro espacio para crear o
 * borrar etiquetas dentro.
 *
 * Crear y editar es cosa de quien puede editar. Borrar también: una etiqueta se
 * quita de todo lo que la lleva, pero no destruye nada más, y exigir ser
 * propietario para eso convierte una tarea de limpieza corriente en un trámite.
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
  if (!datos) return json({ error_code: 'bad_request' }, 400);

  const r = crear(ws.id, datos.name, datos.color);
  return r.ok ? json(r.etiqueta, 201) : json({ error_code: r.error }, 400);
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;

  const datos = await cuerpo(request);
  if (!datos || typeof datos.id !== 'string' || !datos.id) return json({ error_code: 'bad_request' }, 400);

  const r = editar(datos.id, ws.id, { name: datos.name, color: datos.color });
  if (r.ok) return json({ success: true });
  return json({ error_code: r.error }, r.error === 'not_found' ? 404 : 400);
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;

  const datos = await cuerpo(request);
  if (!datos || typeof datos.id !== 'string' || !datos.id) return json({ error_code: 'bad_request' }, 400);

  return borrar(datos.id, ws.id) ? json({ success: true }) : json({ error_code: 'not_found' }, 404);
};
