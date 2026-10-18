/**
 * Enlaces permitidos en una nota: http, https, mailto, rutas absolutas del
 * propio sitio y anclas.
 *
 * Es la misma regla que aplicaba el sanitizador de Editor.js. `//` se rechaza
 * aparte porque parece una ruta del sitio y es otro dominio.
 */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== 'string' || !href) return false;
  if (/^(https?|mailto):/i.test(href)) return true;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  return href.startsWith('#');
}
