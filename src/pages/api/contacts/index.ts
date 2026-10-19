import type { APIRoute } from 'astro';
import { crear, listar } from '../../../lib/contactos';

/**
 * GET  /api/contacts — tu libreta de contactos.
 * POST /api/contacts — `{ name, note? }`: un contacto nuevo.
 *
 * Son siempre los de quien pregunta: no hay forma de pedir los de otra cuenta.
 */
const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error_code: 'unauthorized' }, 401);
  return json(listar(user.id));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return json({ error_code: 'unauthorized' }, 401);
  let datos: any = null;
  try { datos = await request.json(); } catch { /* sin cuerpo */ }
  const r = crear(user, datos?.name, datos?.note);
  if (!r.ok) return json({ error_code: r.error }, r.error === 'invitado' ? 403 : 400);
  return json(r.contacto, 201);
};
