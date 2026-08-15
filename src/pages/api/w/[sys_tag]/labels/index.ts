import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../../lib/guard';
import { borrar, crear, editar, listar } from '../../../../../lib/labels';

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function abrirEspacio(sysTag: string | undefined, user: any, rol: 'viewer' | 'editor') {
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sysTag) as any;
  if (!ws) return { error: new Response('Not Found', { status: 404 }) };

  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, ws.id, rol);
  if (!acceso.granted) {
    // 404 y no 403 para quien no es miembro: un 403 confirma que el espacio
    // existe, y eso ya es información sobre un sitio donde no pinta nada.
    if (acceso.reason === 'not_member') return { error: new Response('Not Found', { status: 404 }) };
    return { error: new Response(acceso.error, { status: 403 }) };
  }
  return { ws };
}

async function cuerpo(request: Request): Promise<any | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

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
