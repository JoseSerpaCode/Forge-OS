import type { APIRoute } from 'astro';
import { borrar, editar, listar } from '../../../../../lib/issueTypes';
import { abrirEspacio, json, cuerpo } from '../../../../../lib/apiWorkspace';



export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'owner');
  if (error) return error;

  const datos = await cuerpo(request);
  if (!datos) return json({ error_code: 'bad_json' }, 400);

  const r = editar(params.id!, ws!.id, { name: datos.name, color: datos.color });
  if (!r.ok) return json({ error_code: r.error }, r.error === 'no_existe' ? 404 : 400);
  return json({ type: (r as any).tipo });
};

/**
 * Borrar un tipo.
 *
 * Si quedan tickets de ese tipo se responde **409 con la cuenta y la lista de
 * sustitutos**, igual que al cerrar un sprint con trabajo dentro. La interfaz
 * necesita las dos cosas para poder preguntar con el número delante en vez de
 * con un «puede que afecte a algunos tickets».
 *
 * Borrar en silencio dejando los tickets apuntando a una clave muerta sería lo
 * más fácil de escribir y lo peor de descubrir: el tablero carga igual y las
 * tarjetas se quedan sin insignia hasta que alguien filtra por tipo.
 */
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'owner');
  if (error) return error;

  const datos = await cuerpo(request);
  const r = borrar(params.id!, ws!.id, datos?.replacement);

  if (r.ok) return json({ moved: r.movidos });

  if (r.error === 'en_uso') {
    return json({
      error_code: 'in_use',
      in_use: r.enUso,
      candidates: listar(ws!.id).filter((t) => t.id !== params.id),
    }, 409);
  }
  if (r.error === 'ultimo') return json({ error_code: 'last_type' }, 409);
  if (r.error === 'no_existe') return json({ error_code: 'not_found' }, 404);
  return json({ error_code: r.error }, 400);
};
