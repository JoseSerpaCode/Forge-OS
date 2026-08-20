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

export const es = {
  'kb.delete_confirm': '¿Borrar esta página y todas sus subpáginas? Esto no se puede deshacer.',
  'kb.delete_error': 'No se ha podido borrar la página.',
  'kb.delete_page': 'Borrar página',
  'kb.share': 'Compartir',
  'kb.new_page': 'Página nueva',
  'kb.no_pages': 'Todavía no hay páginas.',
  'kb.forged_by': 'Escrita por',
  'kb.updated': 'Actualizada',
  'kb.saved': 'Guardado',
  'kb.empty_title': 'Aún no hay páginas.',
  'kb.empty_desc': 'No se encontraron páginas en este workspace.',
  'kb.empty_cta_movil': 'Ábrelo con el botón del índice, aquí arriba, y crea la primera.',
  'kb.empty_cta': 'Haz clic en "Nueva Página" en la barra lateral para crear una.',
  'kb.open_tree': 'Abrir el índice de páginas',
  'kb.editor_tips': 'Ayuda del editor',
  'kb.shortcuts': 'Atajos del editor',
} as const;
