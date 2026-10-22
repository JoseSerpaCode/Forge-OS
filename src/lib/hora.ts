/**
 * Horas de entrega: `HH:MM` de pared, sin zona.
 *
 * Una sola forma de leerlas. El panel de la tarea aceptaba «9:00», «9», «0900»
 * o «9.00» y los dejaba como «09:00»; el alta validaba a mano con dos cifras
 * obligatorias y rechazaba «9:00» con un «No se ha podido crear la tarea» que
 * no decía por qué. Toda hora antes de las diez fallaba al crear y funcionaba
 * al editar.
 */

/**
 * La hora en `HH:MM`, `''` si viene vacía, o `null` si no es una hora.
 *
 * Admite una o dos cifras para la hora, con o sin minutos, y `:`, `.` o `h`
 * como separador: «9», «9:00», «09:00», «930», «0930», «9.30», «9h30».
 */
export function normalizarHora(valor: unknown): string | '' | null {
  if (valor === null || valor === undefined) return '';
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().replace(/[.h]/gi, ':');
  if (!limpio) return '';
  const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(limpio);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
