import type { APIRoute } from 'astro';
import { ALTERNATIVAS_PORTADA } from '../components/landing/textosPortada';

/**
 * Sitemap de las páginas públicas.
 *
 * Son pocas. No hace falta `@astrojs/sitemap`: ese paquete recorre las rutas
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
  { path: '/es', changefreq: 'weekly', priority: '1.0' },
  { path: '/login', changefreq: 'monthly', priority: '0.3' },
  { path: '/register', changefreq: 'monthly', priority: '0.5' },
];

/*
 * Sin `lastmod`: aquí ponía la fecha de **hoy** en cada petición, y Google deja
 * de fiarse de un `lastmod` que nunca es cierto. La portada en cada idioma
 * lleva sus alternativas, igual que en su `<head>`.
 */
export const GET: APIRoute = ({ site, url }) => {
  const base = (site ?? new URL(url.origin)).href.replace(/\/$/, '');
  const portada = new Set(ALTERNATIVAS_PORTADA.map((a) => a.path));
  const alternativas = ALTERNATIVAS_PORTADA.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${base}${a.path}"/>`).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PAGES.map(
  (p) => `  <url>
    <loc>${base}${p.path}</loc>
${portada.has(p.path) ? `${alternativas}\n` : ''}    <changefreq>${p.changefreq}</changefreq>
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
