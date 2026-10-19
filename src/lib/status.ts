/**
 * Los estados de un ticket, en un solo sitio: clave, nombre, color y orden.
 *
 * Antes cada pantalla tenía su copia —el tablero, la tabla de tareas, el panel,
 * las métricas— con colores distintos (gris, cian, amarillo de Tailwind, verde
 * de Tailwind) y grafías distintas («en progreso», «In Progress», «Doing»).
 * Ahora el nombre sale de `status.*` en i18n y el color de los tokens
 * `--forge-st-*` de `themes.css`, que pasan la validación de paleta para
 * daltonismo y por eso son también los de las gráficas.
 *
 * El color de estado es **marca gráfica** (punto, cinta de columna, barra,
 * serie), nunca color de texto: el texto que lo acompaña va en tinta.
 */
export const ESTADOS = ['todo', 'in_progress', 'review', 'done'] as const;
export type Estado = (typeof ESTADOS)[number];

export interface InfoEstado {
  clave: Estado;
  /** Nombre en tipo oración: «En curso». */
  i18n: `status.${Estado}`;
  /** Variable CSS del color, para `style` o `color-mix`. */
  color: string;
  orden: number;
}

const COLOR: Record<Estado, string> = {
  todo: 'var(--forge-st-todo)',
  in_progress: 'var(--forge-st-progress)',
  review: 'var(--forge-st-review)',
  done: 'var(--forge-st-done)',
};

export const INFO: Record<Estado, InfoEstado> = Object.fromEntries(
  ESTADOS.map((clave, orden) => [clave, { clave, i18n: `status.${clave}` as const, color: COLOR[clave], orden }])
) as Record<Estado, InfoEstado>;

/**
 * Normaliza lo que haya en la base: datos viejos escribían `in-progress` con
 * guion. Un estado desconocido cuenta como «Por hacer».
 */
export function estado(valor: unknown): Estado {
  const v = typeof valor === 'string' ? valor.replace('-', '_') : '';
  return (ESTADOS as readonly string[]).includes(v) ? (v as Estado) : 'todo';
}

export const info = (valor: unknown) => INFO[estado(valor)];
