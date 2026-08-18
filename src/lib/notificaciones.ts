/**
 * Cómo se ve una notificación.
 *
 * El punto de color que la acompaña estaba calculado **cuatro veces**: dos en
 * `TopBar.astro` —una para el HTML servido y otra para el que se arma por
 * JavaScript al refrescar—, una tercera para las que llegan por socket, y una
 * cuarta en `activity.astro`.
 *
 * Y las cuatro no coincidían. La de `activity.astro` solo distinguía «leída» de
 * «sistema», así que la misma notificación salía naranja en la campana y azul
 * en la página de actividad. Cuando el color significa algo, que signifique dos
 * cosas distintas según dónde se mire es peor que no tener color.
 */

export type TipoNotificacion = 'assign' | 'mention' | 'system' | 'invite' | string;

/**
 * La clase de fondo del punto, según el tipo.
 *
 * Se devuelve una clase de Tailwind y no un color: Tailwind genera sus clases
 * leyendo el código, así que un color calculado en tiempo de ejecución nunca
 * acabaría en la hoja de estilos.
 */
export function colorDeNotificacion(tipo: TipoNotificacion, leida = false): string {
  // Una notificación ya leída no compite por la atención: pierde el color.
  if (leida) return 'bg-forge-border';

  switch (tipo) {
    case 'assign':  return 'bg-forge-info';
    case 'mention': return 'bg-forge-warning';
    case 'system':  return 'bg-forge-error';
    default:        return 'bg-forge-primary';
  }
}
