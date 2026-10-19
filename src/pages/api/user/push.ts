import type { APIRoute } from 'astro';
import { borrarSuscripcion, clavePublica, cuantasSuscripciones, esSuscripcion, guardarSuscripcion } from '../../../lib/push';

/**
 * Suscribir y dar de baja este navegador para los avisos Web Push.
 *
 * El navegador pide el permiso **solo cuando la persona pulsa «Activar
 * avisos»** en Ajustes; aquí llega ya con la suscripción hecha.
 */
const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  return json({ publicKey: clavePublica(), suscripciones: cuantasSuscripciones(user.id) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!clavePublica()) return json({ error_code: 'push_disabled' }, 503);
  let datos: unknown = null;
  try { datos = await request.json(); } catch { /* sin cuerpo */ }
  if (!esSuscripcion(datos)) return json({ error_code: 'bad_subscription' }, 400);
  guardarSuscripcion(user.id, datos);
  return json({ success: true }, 201);
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  let datos: any = null;
  try { datos = await request.json(); } catch { /* sin cuerpo */ }
  if (typeof datos?.endpoint !== 'string') return json({ error_code: 'bad_request' }, 400);
  return borrarSuscripcion(user.id, datos.endpoint) ? json({ success: true }) : json({ error_code: 'not_found' }, 404);
};
