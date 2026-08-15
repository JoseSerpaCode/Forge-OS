import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../../lib/guard';
import { asignar, deEntidad, esTipoEntidad, quitar } from '../../../../../lib/labels';

/**
 * Poner y quitar etiquetas.
 *
 * Un solo endpoint para tickets y páginas, porque la comprobación que importa
 * es la misma en los dos casos y repetirla en dos sitios es repetir la
 * oportunidad de olvidarse de ella: **la etiqueta y la cosa etiquetada tienen
 * que ser las dos de este espacio**. Sin eso se podría colgar una etiqueta
 * propia de un ticket ajeno sabiendo su id, y saldría en el tablero de otro
 * equipo.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function abrirEspacio(sysTag: string | undefined, user: any) {
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sysTag) as any;
  if (!ws) return { error: new Response('Not Found', { status: 404 }) };

  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, ws.id, 'editor');
  if (!acceso.granted) {
    if (acceso.reason === 'not_member') return { error: new Response('Not Found', { status: 404 }) };
    return { error: new Response(acceso.error, { status: 403 }) };
  }
  return { ws };
}

async function leer(params: any, request: Request, locals: any) {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!);
  if (error) return { error };

  let datos: any;
  try {
    datos = await request.json();
  } catch {
    return { error: json({ error_code: 'bad_request' }, 400) };
  }

  const { label_id: labelId, entity_type: tipo, entity_id: entidadId } = datos ?? {};
  if (typeof labelId !== 'string' || !labelId) return { error: json({ error_code: 'bad_request' }, 400) };
  if (!esTipoEntidad(tipo)) return { error: json({ error_code: 'bad_entity_type' }, 400) };
  if (typeof entidadId !== 'string' || !entidadId) return { error: json({ error_code: 'bad_request' }, 400) };

  return { ws, labelId, tipo, entidadId };
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const r = await leer(params, request, locals);
  if (r.error) return r.error;

  const res = asignar(r.labelId!, r.ws.id, r.tipo!, r.entidadId!);
  // Se devuelven las etiquetas que quedan puestas para que la pantalla se
  // repinte con lo que hay de verdad, y no con lo que cree que hay.
  return res.ok ? json({ labels: deEntidad(r.tipo!, r.entidadId!) }) : json({ error_code: res.error }, 400);
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const r = await leer(params, request, locals);
  if (r.error) return r.error;

  const res = quitar(r.labelId!, r.ws.id, r.tipo!, r.entidadId!);
  return res.ok ? json({ labels: deEntidad(r.tipo!, r.entidadId!) }) : json({ error_code: res.error }, 400);
};
