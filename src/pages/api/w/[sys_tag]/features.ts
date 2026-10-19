import type { APIRoute } from 'astro';
import { abrirEspacio, json, cuerpo } from '../../../../lib/apiWorkspace';
import { cambiarFunciones, funciones } from '../../../../lib/funcionesEspacio';

/**
 * Encender o apagar sprints, tiempo y puntos en un espacio.
 *
 * Es de propietarios: cambia lo que ve todo el equipo en el tablero. Y no de
 * invitados, igual que el resto de los ajustes del espacio.
 */

export const GET: APIRoute = async ({ params, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;
  return json(funciones(ws.id));
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'owner');
  if (error) return error;
  if (user.is_guest === 1) return json({ error_code: 'guest' }, 403);

  const datos = await cuerpo(request);
  if (!datos) return json({ error_code: 'bad_request' }, 400);

  const cambios: Record<string, boolean> = {};
  for (const clave of ['sprints', 'tiempo', 'puntos', 'automatizaciones', 'auditoria']) {
    if (clave in datos) {
      if (typeof datos[clave] !== 'boolean') return json({ error_code: 'bad_request' }, 400);
      cambios[clave] = datos[clave];
    }
  }
  if (Object.keys(cambios).length === 0) return json({ error_code: 'bad_request' }, 400);

  return json(cambiarFunciones(ws.id, cambios));
};
