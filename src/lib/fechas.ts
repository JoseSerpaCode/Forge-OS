/**
 * Fechas: una sola forma de leer lo que guarda SQLite.
 *
 * SQLite no tiene tipo fecha. `CURRENT_TIMESTAMP` escribe una cadena
 * `'2026-08-17 14:13:06'` **en UTC**, sin zona. Y `new Date('2026-08-17
 * 14:13:06')` la interpreta como **hora local**, así que en Bogotá sale cinco
 * horas más tarde de lo que es.
 *
 * En el proyecto convivían cinco formas de tratar eso:
 *
 *   new Date(x)                                     ← mal: la corre
 *   new Date(x + 'Z')                               ← bien
 *   new Date(x.replace(' ', 'T') + 'Z')             ← bien
 *   x.includes('Z') ? x : x.replace(' ','T') + 'Z'  ← bien, defensivo
 *   new Date(Date.now() - offset*60000).toISOString()
 *
 * Y no era teoría: la misma notificación mostraba una hora en el HTML servido
 * —`TopBar.astro:104`, sin `Z`— y otra distinta tras refrescarse por `fetch`
 * —`:449`, con `Z`—. La diferencia era exactamente el desfase del navegador.
 *
 * Además todo el formateo estaba clavado a `'en-US'`, así que una interfaz en
 * español enseñaba «Aug 17, 2026».
 */

/**
 * Convierte lo que venga de la base en un `Date` real.
 *
 * Acepta las tres formas que hay guardadas: `'2026-08-17 14:13:06'` (lo normal),
 * la misma con `T`, y la que ya trae `Z` o un desfase explícito. Devuelve `null`
 * ante cualquier cosa que no sepa leer, en vez de un `Invalid Date` que se
 * propaga y acaba pintando «NaN» en pantalla.
 */
export function deSQLite(valor: unknown): Date | null {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === 'number') return new Date(valor);
  if (typeof valor !== 'string') return null;

  const limpio = valor.trim();
  if (!limpio) return null;

  // Si ya dice su zona —`Z` o `+05:00`— se respeta: tocarla la movería.
  const tieneZona = /(?:Z|[+-]\d{2}:?\d{2})$/.test(limpio);
  const iso = tieneZona ? limpio.replace(' ', 'T') : `${limpio.replace(' ', 'T')}Z`;

  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** El idioma que quiere `Intl`. `Astro.locals.lang` da 'en' o 'es'. */
const comoLocale = (lang: string) => (lang === 'es' ? 'es-ES' : 'en-US');

/** «17 ago 2026» o «Aug 17, 2026», según el idioma de quien mira. */
export function fecha(valor: unknown, lang = 'en'): string {
  const d = deSQLite(valor);
  if (!d) return '—';
  return d.toLocaleDateString(comoLocale(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Fecha y hora, para cuando importa el momento y no solo el día. */
export function fechaHora(valor: unknown, lang = 'en'): string {
  const d = deSQLite(valor);
  if (!d) return '—';
  return d.toLocaleString(comoLocale(lang), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * «hace 5 min», «hace 3 h», «hace 2 d».
 *
 * Con `Intl.RelativeTimeFormat`, que traduce solo. Antes esto era una escalera
 * de `if` que devolvía `"5m ago"` en inglés fijo, incluso con la interfaz en
 * español.
 *
 * El futuro también se maneja: una fecha de entrega que aún no llega da «en 3
 * días» en vez de «hace -3 días».
 */
export function relativo(valor: unknown, lang = 'en', ahora: Date = new Date()): string {
  const d = deSQLite(valor);
  if (!d) return '—';

  const segundos = Math.round((d.getTime() - ahora.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(comoLocale(lang), { numeric: 'auto' });

  const escalas: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.34524],
    ['month', 12],
    ['year', Infinity],
  ];

  let cantidad = segundos;
  for (const [unidad, tope] of escalas) {
    if (Math.abs(cantidad) < tope) return rtf.format(Math.round(cantidad), unidad);
    cantidad /= tope;
  }
  return rtf.format(Math.round(cantidad), 'year');
}

/**
 * El día de hoy en la zona de quien mira, como `AAAA-MM-DD`.
 *
 * Sirve para comparar con una fecha de entrega y decidir si está vencida.
 * `new Date().toISOString().slice(0,10)` **no** vale: da el día en UTC, así que
 * en Bogotá, entre las 19:00 y medianoche, ya dice mañana y marca como vencido
 * lo que aún no lo está.
 */
export function hoyLocal(ahora: Date = new Date()): string {
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ¿Esta fecha de entrega ya pasó? Compara días, no instantes. */
export function vencida(valor: unknown, ahora: Date = new Date()): boolean {
  const d = deSQLite(valor);
  if (!d) return false;
  // Una entrega «de hoy» no está vencida a las nueve de la mañana.
  return String(valor).slice(0, 10) < hoyLocal(ahora);
}
