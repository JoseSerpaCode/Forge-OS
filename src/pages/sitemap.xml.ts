import type { APIRoute } from 'astro';

/**
 * Sitemap de las páginas públicas.
 *
 * Son tres. No hace falta `@astrojs/sitemap`: ese paquete recorre las rutas
 * generadas, y aquí casi todas son privadas o dinámicas, así que habría que
 * filtrarlas a mano de todas formas — con la dependencia añadida y el riesgo de
 * que un día publique `/w/<espacio-de-alguien>` en un archivo que Google lee.
 *
 * Lista explícita: si aparece una página pública nueva, se añade aquí. Es una
 * línea, y a cambio es imposible que se filtre nada por descuido.
 */

type Entry = { path: string; changefreq: string; priority: string };

const PAGES: Entry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/login', changefreq: 'monthly', priority: '0.3' },
  { path: '/register', changefreq: 'monthly', priority: '0.5' },
];

export const GET: APIRoute = ({ site, url }) => {
  const base = (site ?? new URL(url.origin)).href.replace(/\/$/, '');
  const today = new Date().toISOString().split('T')[0];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(
  (p) => `  <url>
    <loc>${base}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
