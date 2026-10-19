import type { APIRoute } from 'astro';
import crypto from 'crypto';
import { feedPorToken, generarIcs, marcarLeido, tareasDelFeed } from '../../lib/calendario';
import { checkRateLimit } from '../../lib/rateLimit';

/**
 * `/cal/<token>.ics`: el calendario que se suscribe desde Google Calendar.
 *
 * Público (lo pide Google, sin sesión), con el token como única llave. Un token
 * inventado o revocado da 404, igual que uno que no existió nunca: un 403
 * confirmaría que el enlace existió.
 *
 * `ETag` y `304`: Google lo consulta cada pocas horas, y con la salida de red
 * limitada a 1 GB al mes cada respuesta que se puede ahorrar cuenta.
 */
export const GET: APIRoute = async ({ params, request, url }) => {
  const token = String(params.token ?? '');
  const limite = checkRateLimit(`cal:${token.slice(0, 16)}`, { max: 60, windowMs: 60 * 60 * 1000 });
  if (!limite.allowed) return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': String(limite.retryAfter ?? 3600) } });

  const feed = feedPorToken(token);
  if (!feed) return new Response('Not Found', { status: 404 });

  const base = (process.env.PUBLIC_SITE_URL || url.origin).replace(/\/$/, '');
  const tareas = tareasDelFeed(feed);
  // `DTSTAMP` = la última modificación, no «ahora»: así el mismo contenido da
  // el mismo fichero y el `ETag` sirve de algo.
  const ultima = tareas.reduce((m, t) => (t.updated_at > m ? t.updated_at : m), '1970-01-01 00:00:00');
  const cuerpo = generarIcs(tareas, feed.timezone, base, new Date(`${ultima.replace(' ', 'T')}Z`));
  const etiqueta = `"${crypto.createHash('sha1').update(cuerpo).digest('hex')}"`;
  marcarLeido(feed.id);

  const cabeceras = {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Cache-Control': 'private, max-age=900',
    ETag: etiqueta,
  };
  if (request.headers.get('if-none-match') === etiqueta) return new Response(null, { status: 304, headers: cabeceras });
  return new Response(cuerpo, { status: 200, headers: cabeceras });
};
