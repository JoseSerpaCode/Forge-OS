import type { APIRoute } from 'astro';
import { createGuestSession, GUEST_LIFETIME_DAYS } from '../../../lib/guest';
import { checkRateLimit } from '../../../lib/rateLimit';
import { getClientIp } from '../../../lib/clientIp';

const GUEST_LIMIT_PER_HOUR = Number(process.env.GUEST_LIMIT_PER_HOUR) || 10;
const GUEST_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Crea una cuenta de invitado **a petición del usuario**.
 *
 * Antes esto ocurría en el middleware, en cada visita anónima. Ahora hace falta
 * pulsar el botón de la landing, así que el límite por IP deja de ser la única
 * defensa contra los bots y pasa a ser lo que debería haber sido siempre: una
 * red de seguridad sobre una acción deliberada.
 */
export const POST: APIRoute = async ({ request, cookies, redirect, clientAddress }) => {
  const ip = getClientIp(request, clientAddress);
  const quota = checkRateLimit(`guest:${ip}`, {
    windowMs: GUEST_LIMIT_WINDOW_MS,
    max: GUEST_LIMIT_PER_HOUR,
  });

  if (!quota.allowed) {
    // No es un callejón sin salida: registrarse sigue disponible, así que se
    // manda ahí con el motivo, en vez de un 429 a secas que no dice qué hacer.
    return redirect('/register?reason=guest_limit');
  }

  const { sessionId, sysTag } = createGuestSession();

  cookies.set('forge_session', sessionId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * GUEST_LIFETIME_DAYS,
  });

  return redirect(`/w/${sysTag}?welcome=guest`);
};
