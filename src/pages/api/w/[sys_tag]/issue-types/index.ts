import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../../lib/guard';
import { crear, listar, reordenar } from '../../../../../lib/issueTypes';

/**
 * Tipos de ticket de un espacio.
 *
 * El espacio sale de la **ruta**, nunca del cuerpo: aceptarlo del cuerpo es el
 * camino corto al IDOR.
 *
 * Ver la lista es cosa de cualquier miembro —hace falta para pintar el
 * desplegable de nuevo ticket—, pero **cambiarla es cosa de propietarios**. Es
 * lo que distingue esto de las etiquetas: una etiqueta clasifica, y quitarla no
 * toca el trabajo; borrar un tipo reescribe la columna `type` de todos los
 * tickets que lo llevan.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function abrirEspacio(sysTag: string | undefined, user: any, rol: 'viewer' | 'editor' | 'owner') {
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sysTag) as any;
  if (!ws) return { error: new Response('Not Found', { status: 404 }) };

  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, ws.id, rol);
  if (!acceso.granted) {
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
  return json({ types: listar(ws!.id) });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'owner');
  if (error) return error;

  const datos = await cuerpo(request);
  if (!datos) return json({ error_code: 'bad_json' }, 400);

  const r = crear(ws!.id, datos.name, datos.color);
  if (!r.ok) return json({ error_code: r.error }, r.error === 'demasiados' ? 409 : 400);
  return json({ type: r.tipo }, 201);
};

/** Reordenar. Va aquí y no en `[id]` porque afecta a la lista entera, no a uno. */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'owner');
  if (error) return error;

  const datos = await cuerpo(request);
  if (!datos || !Array.isArray(datos.order)) return json({ error_code: 'bad_json' }, 400);

  if (!reordenar(ws!.id, datos.order)) return json({ error_code: 'bad_order' }, 400);
  return json({ types: listar(ws!.id) });
};
