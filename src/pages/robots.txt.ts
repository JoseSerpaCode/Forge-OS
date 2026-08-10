import type { APIRoute } from 'astro';

/**
 * `robots.txt` generado, no un archivo suelto en `public/`.
 *
 * El sitemap tiene que anunciarse con URL absoluta, y esa URL depende del
 * dominio donde corra la instancia. Un archivo estático obligaría a escribir
 * `forge-os.online` a mano, y cualquiera que se autoaloje —que es medio
 * argumento de venta del producto— se llevaría un sitemap apuntando a un sitio
 * ajeno.
 *
 * Lo que se bloquea es todo lo que hay tras la sesión. No por secreto —esas
 * rutas ya redirigen a quien no ha entrado— sino por presupuesto de rastreo:
 * cada visita de Google a `/w/loquesea` es una visita que no le dedica a la
 * portada, que es la única página que hay que posicionar.
 */
export const GET: APIRoute = ({ site, url }) => {
  const base = (site ?? new URL(url.origin)).href.replace(/\/$/, '');

  const body = `# Forge OS
User-agent: *
Allow: /$
Allow: /login$
Allow: /register$

# Tras la sesión: nada que indexar y mucho presupuesto de rastreo que gastar.
Disallow: /api/
Disallow: /w/
Disallow: /u/
Disallow: /settings
Disallow: /activity
Disallow: /welcome

Sitemap: ${base}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Un día de caché: cambia casi nunca y lo piden en cada rastreo.
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
