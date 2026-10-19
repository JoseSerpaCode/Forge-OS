import type { APIRoute } from 'astro';
import { borrar, editar, ficha } from '../../../lib/contactos';

/**
 * GET    /api/contacts/:id — la ficha: el contacto, sus tareas y sus notas.
 * PATCH  /api/contacts/:id — `{ name?, note? }`.
 * DELETE /api/contacts/:id — sus tareas quedan sin asignar.
 *
 * Un contacto de otra cuenta responde 404, igual que uno que no existe: no se
 * confirma que exista.
 */
const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return json({ error_code: 'unauthorized' }, 401);
  const f = ficha(user.id, String(params.id));
  return f ? json(f) : json({ error_code: 'not_found' }, 404);
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return json({ error_code: 'unauthorized' }, 401);
  let datos: any = null;
  try { datos = await request.json(); } catch { /* sin cuerpo */ }
  if (!datos || typeof datos !== 'object') return json({ error_code: 'bad_request' }, 400);
  const cambios: { name?: unknown; note?: unknown } = {};
  if ('name' in datos) cambios.name = datos.name;
  if ('note' in datos) cambios.note = datos.note;
  const r = editar(user.id, String(params.id), cambios);
  if (!r.ok) return json({ error_code: r.error }, r.error === 'no_existe' ? 404 : 400);
  return json({ success: true });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return json({ error_code: 'unauthorized' }, 401);
  return borrar(user.id, String(params.id)) ? json({ success: true }) : json({ error_code: 'not_found' }, 404);
};
