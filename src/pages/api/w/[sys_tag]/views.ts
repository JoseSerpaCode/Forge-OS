import type { APIRoute } from 'astro';
import { abrirEspacio, json, cuerpo } from '../../../../lib/apiWorkspace';
import { borrar, crear, listar, renombrar } from '../../../../lib/vistasGuardadas';

/**
 * Vistas guardadas del tablero, de quien las pide en este espacio.
 *
 * Basta con poder ver el espacio: guardar un filtro no cambia nada que vean
 * los demás.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;
  return json(listar(locals.user!.id, ws.id, ws.sys_tag));
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;
  const datos = await cuerpo(request);
  const r = crear(locals.user!.id, ws.id, datos?.name, datos?.query);
  return r.ok ? json({ id: r.id }, 201) : json({ error_code: r.error }, 400);
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;
  const datos = await cuerpo(request);
  if (typeof datos?.id !== 'string') return json({ error_code: 'bad_request' }, 400);
  const r = renombrar(locals.user!.id, ws.id, datos.id, datos.name);
  return r.ok ? json({ success: true }) : json({ error_code: r.error }, r.error === 'no_existe' ? 404 : 400);
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;
  const datos = await cuerpo(request);
  if (typeof datos?.id !== 'string') return json({ error_code: 'bad_request' }, 400);
  return borrar(locals.user!.id, ws.id, datos.id) ? json({ success: true }) : json({ error_code: 'not_found' }, 404);
};
