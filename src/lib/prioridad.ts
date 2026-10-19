/**
 * Prioridad: cinco valores en la base, cuatro en pantalla.
 *
 * La columna `issues.priority` admite `lowest … highest` desde el principio,
 * pero no había forma de ponerla: solo servía para ordenar. En pantalla se usan
 * cuatro niveles, los mismos que se escriben en el alta rápida con `!1`…`!4`:
 *
 *   !1 urgente (highest) · !2 alta (high) · !3 normal (medium) · !4 baja (low)
 *
 * `lowest` se sigue admitiendo —la `CHECK` lo permite y puede haber filas— y se
 * enseña como «baja». No se migra: reescribir datos para que encajen con una
 * pantalla es perder información que alguien puso a propósito.
 */

export const PRIORIDADES = ['lowest', 'low', 'medium', 'high', 'highest'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];
export type NivelVisible = 'urgente' | 'alta' | 'normal' | 'baja';

export const esPrioridad = (v: unknown): v is Prioridad =>
  typeof v === 'string' && (PRIORIDADES as readonly string[]).includes(v);

/** `!1`…`!4` → valor de la base. */
export const DE_ATAJO: Record<string, Prioridad> = { '1': 'highest', '2': 'high', '3': 'medium', '4': 'low' };

/** Los cuatro que se ofrecen en los desplegables, en orden de urgencia. */
export const OPCIONES: Array<{ valor: Prioridad; nivel: NivelVisible }> = [
  { valor: 'highest', nivel: 'urgente' },
  { valor: 'high', nivel: 'alta' },
  { valor: 'medium', nivel: 'normal' },
  { valor: 'low', nivel: 'baja' },
];

/**
 * El nivel que se enseña y su color de texto.
 *
 * Colores de texto que ya pasan AA en los dos temas: el rojo de error, el
 * naranja **de texto** (`accent-text`, no el de marca) y el gris de apoyo.
 */
export function prioridadVisible(v: unknown): { nivel: NivelVisible; clase: string } {
  switch (v) {
    case 'highest': return { nivel: 'urgente', clase: 'text-forge-error' };
    case 'high': return { nivel: 'alta', clase: 'text-forge-accent-text' };
    case 'low':
    case 'lowest': return { nivel: 'baja', clase: 'text-forge-muted' };
    default: return { nivel: 'normal', clase: 'text-forge-muted' };
  }
}
