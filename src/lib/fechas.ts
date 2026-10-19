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
 *
 * Y hay un segundo tipo de valor que no es una marca de tiempo: las fechas
 * **solo-día**, como `issues.due_date`, que guarda un `<input type="date">`
 * como `'2026-09-09'`. Eso es un día del
 * calendario, no un instante, y no tiene zona. Tratarlo como UTC lo ponía a
 * medianoche en Greenwich, que en Bogotá todavía es el día 8 a las siete de la
 * tarde: cada entrega salía un día antes de lo que se había puesto.
 */

/** `'2026-09-09'`, sin hora ni zona. */
const SOLO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Convierte lo que venga de la base en un `Date` real.
 *
 * Acepta las tres formas que hay guardadas: `'2026-08-17 14:13:06'` (lo normal),
 * la misma con `T`, y la que ya trae `Z` o un desfase explícito. Devuelve `null`
 * ante cualquier cosa que no sepa leer, en vez de un `Invalid Date` que se
 * propaga y acaba pintando «NaN» en pantalla.
 *
 * Una fecha solo-día (`'2026-09-09'`) da la **medianoche local** de ese día, no
 * la de UTC: así se formatea y se compara como el mismo día en cualquier zona,
 * en el servidor y en el navegador.
 */
export function deSQLite(valor: unknown): Date | null {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === 'number') return new Date(valor);
  if (typeof valor !== 'string') return null;

  const limpio = valor.trim();
  if (!limpio) return null;

  const dia = SOLO_DIA.exec(limpio);
  if (dia) {
    const [a, m, d] = [Number(dia[1]), Number(dia[2]), Number(dia[3])];
    const local = new Date(a, m - 1, d);
    // `new Date(2026, 1, 30)` no falla: salta al 2 de marzo. Un día que no
    // existe se rechaza igual que cualquier otra cosa ilegible.
    if (local.getFullYear() !== a || local.getMonth() !== m - 1 || local.getDate() !== d) return null;
    return local;
  }

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

/**
 * El día del calendario de un valor, como `AAAA-MM-DD`, o `null`.
 *
 * Una fecha solo-día sale tal cual: no hay nada que convertir, y pasarla por
 * `Date` es justo cómo se movía. Una marca de tiempo da el día **local** de ese
 * instante. Es lo que espera un `<input type="date">`; el modal hacía
 * `new Date(x).toISOString().split('T')[0]`, que da el día en UTC.
 */
export function diaDeCalendario(valor: unknown): string | null {
  if (typeof valor === 'string' && SOLO_DIA.test(valor.trim())) {
    return deSQLite(valor) ? valor.trim() : null;
  }
  const d = deSQLite(valor);
  return d ? hoyLocal(d) : null;
}

/**
 * ¿Esta fecha de entrega ya pasó? Compara días, no instantes.
 *
 * Una entrega «de hoy» no está vencida a las nueve de la mañana. Con hora
 * (`due_time`, `HH:MM` de pared y en su propia columna) vence en ese minuto: a
 * las 18:00 todavía no, a las 18:01 sí. Con `zona`, «hoy» y «ahora» son los de
 * quien mira y no los de la máquina, que en el servidor es UTC.
 */
export function vencida(valor: unknown, ahora: Date = new Date(), hora?: string | null, zona?: string | null): boolean {
  const dia = diaDeCalendario(valor);
  if (!dia) return false;
  const hoy = zona ? hoyEn(zona, ahora) : hoyLocal(ahora);
  if (dia !== hoy || !hora || !/^\d{2}:\d{2}$/.test(hora)) return dia < hoy;
  const minutoActual = zona
    ? minutoEn(zona, ahora)
    : `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  return hora < minutoActual;
}

/**
 * Cuántos días del calendario faltan hasta una fecha: 0 si es hoy, negativo si
 * ya pasó, `null` si no se puede leer.
 *
 * Cuenta días, no horas. El resumen del espacio hacía
 * `Math.ceil((fin - ahora) / 86400000)` sobre un `new Date('2026-09-09')`, que
 * es la medianoche **UTC**: en Bogotá, desde las siete de la tarde del día
 * anterior ya decía «termina hoy», y en Tokio el último día por la mañana
 * todavía decía «termina en 1 día».
 */
export function diasHasta(valor: unknown, ahora: Date = new Date()): number | null {
  const dia = diaDeCalendario(valor);
  if (!dia) return null;
  // Las dos fechas pasan a medianoche UTC solo para restarlas: así un cambio de
  // horario de verano no deja un día de 23 horas que redondee mal.
  const comoUTC = (iso: string) => {
    const [a, m, d] = iso.split('-').map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((comoUTC(dia) - comoUTC(hoyLocal(ahora))) / 86_400_000);
}

/** ¿Es una zona IANA que este motor conoce? Lo que no, se trata como UTC. */
export function esZona(zona: unknown): zona is string {
  if (typeof zona !== 'string' || !zona || zona.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zona }); return true; }
  catch { return false; }
}

/**
 * El día de hoy en una zona concreta, como `AAAA-MM-DD`.
 *
 * `hoyLocal()` usa la zona **de la máquina**, que en el navegador es la buena
 * pero en el servidor es UTC. Para pintar en el servidor lo que es «hoy» para
 * quien mira hace falta su zona (`users.timezone`).
 */
export function hoyEn(zona: string | null | undefined, ahora: Date = new Date()): string {
  const z = esZona(zona) ? zona : 'UTC';
  // `en-CA` formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** `HH:MM` ahora mismo en esa zona. */
export function minutoEn(zona: string | null | undefined, ahora: Date = new Date()): string {
  const z = esZona(zona) ? zona : 'UTC';
  return new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ahora);
}

/** `AAAA-MM-DD` más `n` días, sin pasar por zonas. */
export function sumarDiasIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}

/**
 * Fechas que escribe una persona: `05/03/2027` en español, `03/05/2027` en inglés.
 *
 * El `<input type="date">` nativo no sirve para esto: Chrome y Firefox lo pintan
 * con el idioma **del navegador**, no con el de la aplicación, así que con la
 * interfaz en español salía `mm/dd/yyyy`. Ningún atributo lo cambia. Por eso el
 * campo de fecha de la app es un texto y estas dos funciones traducen entre lo
 * que se escribe y lo que se guarda (`AAAA-MM-DD`).
 *
 * El orden de día, mes y año se le pregunta a `Intl` en vez de escribirlo a mano
 * por idioma: así un tercer idioma no obliga a tocar esto.
 */
export type ParteFecha = 'day' | 'month' | 'year';

export function ordenFecha(lang = 'en'): ParteFecha[] {
  const partes = new Intl.DateTimeFormat(comoLocale(lang), { day: '2-digit', month: '2-digit', year: 'numeric' })
    .formatToParts(new Date(2027, 10, 22));
  return partes.map((p) => p.type).filter((t): t is ParteFecha => t === 'day' || t === 'month' || t === 'year');
}

/** La pista del campo: «dd/mm/aaaa» o «mm/dd/yyyy». */
export function patronFecha(lang = 'en'): string {
  const letras: Record<ParteFecha, string> = lang === 'es'
    ? { day: 'dd', month: 'mm', year: 'aaaa' }
    : { day: 'dd', month: 'mm', year: 'yyyy' };
  return ordenFecha(lang).map((p) => letras[p]).join('/');
}

/** `2027-03-05` → `05/03/2027` (es) o `03/05/2027` (en). Lo que no sea `AAAA-MM-DD` da cadena vacía. */
export function fechaCorta(iso: unknown, lang = 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  const valores: Record<ParteFecha, string> = { year: m[1], month: m[2], day: m[3] };
  return ordenFecha(lang).map((p) => valores[p]).join('/');
}

/**
 * Lo que escribió la persona → `AAAA-MM-DD`, o `null` si no es una fecha real.
 *
 * Admite `/`, `-`, `.` o espacios como separador, días y meses de una cifra y
 * años de dos (`5/3/27` → 2027). Una fecha imposible —31 de febrero— da `null`
 * en vez de que `Date` la desborde en silencio al 3 de marzo.
 */
export function leerFechaUsuario(texto: string, lang = 'en'): string | null {
  const trozos = String(texto ?? '').trim().split(/[\/\-.\s]+/).filter(Boolean);
  if (trozos.length !== 3 || trozos.some((t) => !/^\d+$/.test(t))) return null;

  const orden = ordenFecha(lang);
  const v: Record<ParteFecha, number> = { day: 0, month: 0, year: 0 };
  orden.forEach((parte, i) => { v[parte] = Number(trozos[i]); });

  const anioTexto = trozos[orden.indexOf('year')];
  if (anioTexto.length === 2) v.year += 2000;
  else if (anioTexto.length !== 4) return null;

  if (v.month < 1 || v.month > 12 || v.day < 1) return null;
  const diasDelMes = new Date(Date.UTC(v.year, v.month, 0)).getUTCDate();
  if (v.day > diasDelMes) return null;

  return `${v.year}-${String(v.month).padStart(2, '0')}-${String(v.day).padStart(2, '0')}`;
}
