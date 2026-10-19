import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { esZona } from '../../../lib/fechas';

/**
 * La zona horaria de la persona, tal como la dice su navegador.
 *
 * «Hoy» y «vencida» dependen de dónde está quien mira, y el servidor corre en
 * UTC. La página la manda sola cuando no coincide con la guardada; no hay que
 * configurarla. Solo se acepta un nombre IANA que el motor conozca: lo demás
 * se rechaza en vez de guardarse y romper cada cálculo de fechas después.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  let datos: any = null;
  try { datos = await request.json(); } catch { /* sin cuerpo */ }
  if (!esZona(datos?.timezone)) {
    return new Response(JSON.stringify({ error_code: 'bad_timezone' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  db.prepare('UPDATE users SET timezone = ? WHERE id = ?').run(datos.timezone, user.id);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
