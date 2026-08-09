/**
 * IP real del cliente, para rate limiting.
 *
 * El orden importa y no es el intuitivo.
 *
 * `X-Forwarded-For` **la controla el cliente**: cualquiera puede enviarla. Los
 * proxies intermedios *añaden* al final en vez de sobrescribir, así que si un
 * atacante manda `X-Forwarded-For: 1.2.3.4`, la cabecera acaba siendo
 * `1.2.3.4, <ip real>`. Leer el primer valor —lo habitual— entrega justo el que
 * el atacante eligió, y con eso se salta cualquier límite por IP cambiando esa
 * cadena en cada petición.
 *
 * `CF-Connecting-IP` la escribe Cloudflare en el borde y **sobrescribe**
 * cualquier valor que traiga el cliente, así que es la única fiable mientras el
 * tráfico entre por ahí.
 *
 * Sin Cloudflare delante (desarrollo, o acceso directo a la IP del servidor) se
 * cae a `X-Forwarded-For`, pero tomando el **último** valor: el que añadió el
 * proxy de confianza más cercano, no el que pudo inventarse el cliente.
 */
export function getClientIp(request: Request, fallback?: string): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }

  return fallback?.trim() || 'unknown';
}
