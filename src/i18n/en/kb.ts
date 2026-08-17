/**
 * Traducciones de kb.
 *
 * `ui.ts` era un solo fichero de 2.048 líneas y 939 claves por idioma, y era el
 * segundo que más cambiaba del repositorio. Cualquier trabajo en paralelo
 * chocaba ahí: dos ramas que añaden una clave tocan la misma zona del mismo
 * fichero. Partido por dominio, cada una toca el suyo.
 *
 * El orden de las claves y sus valores son los mismos que tenía; esto fue un
 * corte mecánico, no una reescritura.
 */

export const en = {
  'kb.delete_confirm': 'Delete this page and all its subpages? This cannot be undone.',
  'kb.delete_error': 'That page could not be deleted.',
  'kb.delete_page': 'Delete page',
  'kb.share': 'Share',
  'kb.new_page': 'New page',
  'kb.no_pages': 'No pages yet.',
  'kb.forged_by': 'Written by',
  'kb.updated': 'Updated',
  'kb.saved': 'Saved',
  'kb.empty_title': 'No pages yet.',
  'kb.empty_desc': 'No pages found in this workspace.',
  'kb.empty_cta': 'Click "New Page" in the sidebar to create one.',
} as const;
