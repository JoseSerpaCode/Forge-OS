/**
 * Tareas que se repiten: «cada lunes», «cada 2 semanas», «el día 15 de cada mes».
 *
 * La regla se guarda en `issues.recurrence` con un formato **corto y validado**,
 * no como texto libre ni como una RRULE completa: lo que no se puede validar
 * acaba generando fechas que nadie pidió.
 *
 *   d:N            cada N días
 *   w:N:MO,TH      cada N semanas, esos días (MO TU WE TH FR SA SU)
 *   m:N:15         el día 15 cada N meses (si el mes no lo tiene, el último)
 *   m:N:-1         el último día cada N meses
 *
 * Todo trabaja con días del calendario (`AAAA-MM-DD`), sin zonas: una entrega
 * de cada lunes es de cada lunes en cualquier sitio. Las cuentas se hacen en
 * UTC solo para que un cambio de horario no deje un día de 23 horas.
 */

export const DIAS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type Dia = (typeof DIAS)[number];

export type Regla =
  | { tipo: 'd'; cada: number }
  | { tipo: 'w'; cada: number; dias: Dia[] }
  | { tipo: 'm'; cada: number; dia: number };

const MAX_CADA = 99;

export function leerRegla(texto: unknown): Regla | null {
  if (typeof texto !== 'string') return null;
  const partes = texto.split(':');
  const cada = Number(partes[1]);
  if (!Number.isInteger(cada) || cada < 1 || cada > MAX_CADA) return null;
  if (partes[0] === 'd' && partes.length === 2) return { tipo: 'd', cada };
  if (partes[0] === 'w' && partes.length === 3) {
    const dias = partes[2].split(',');
    if (dias.length === 0 || dias.some((d) => !(DIAS as readonly string[]).includes(d))) return null;
    // Ordenados y sin repetir: la misma regla se escribe siempre igual.
    const unicos = DIAS.filter((d) => dias.includes(d));
    return { tipo: 'w', cada, dias: unicos };
  }
  if (partes[0] === 'm' && partes.length === 3) {
    const dia = Number(partes[2]);
    if (!Number.isInteger(dia) || (dia !== -1 && (dia < 1 || dia > 31))) return null;
    return { tipo: 'm', cada, dia };
  }
  return null;
}

export function escribirRegla(r: Regla): string {
  if (r.tipo === 'd') return `d:${r.cada}`;
  if (r.tipo === 'w') return `w:${r.cada}:${r.dias.join(',')}`;
  return `m:${r.cada}:${r.dia}`;
}

/** ¿Es una regla válida? Lo que no, no se guarda. */
export const esRegla = (texto: unknown) => leerRegla(texto) !== null;

const aUTC = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const aIso = (f: Date) => f.toISOString().slice(0, 10);
const masDias = (iso: string, n: number) => { const f = aUTC(iso); f.setUTCDate(f.getUTCDate() + n); return aIso(f); };
const diasEnMes = (a: number, m: number) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate();

/** La primera ocurrencia estrictamente posterior a `desde`. */
function ocurrenciaTras(r: Regla, desde: string, ancla: string): string {
  if (r.tipo === 'd') {
    // Cada N días contando desde la fecha prevista, no desde cuando se mira.
    const pasos = Math.floor((aUTC(desde).getTime() - aUTC(ancla).getTime()) / 86_400_000 / r.cada) + 1;
    return masDias(ancla, Math.max(1, pasos) * r.cada);
  }
  if (r.tipo === 'w') {
    // Las semanas cuentan desde la del ancla (semana que empieza en lunes).
    const lunes = (iso: string) => { const f = aUTC(iso); const dow = (f.getUTCDay() + 6) % 7; return masDias(iso, -dow); };
    const semanaAncla = aUTC(lunes(ancla)).getTime();
    let dia = masDias(desde, 1);
    for (let i = 0; i < 7 * r.cada * 2 + 7; i++, dia = masDias(dia, 1)) {
      const semanas = Math.round((aUTC(lunes(dia)).getTime() - semanaAncla) / (7 * 86_400_000));
      if (semanas % r.cada !== 0) continue;
      if (r.dias.includes(DIAS[aUTC(dia).getUTCDay()])) return dia;
    }
    return masDias(desde, 7 * r.cada);
  }
  // Mensual: el día pedido, o el último si el mes es más corto (31 → 30, 28…).
  const a0 = aUTC(ancla);
  for (let k = 0; k < 1200; k += r.cada) {
    const total = a0.getUTCMonth() + k;
    const a = a0.getUTCFullYear() + Math.floor(total / 12);
    const m = total % 12;
    const tope = diasEnMes(a, m);
    const d = r.dia === -1 ? tope : Math.min(r.dia, tope);
    const iso = aIso(new Date(Date.UTC(a, m, d)));
    if (iso > desde) return iso;
  }
  return masDias(desde, 30);
}

/**
 * La fecha de la siguiente tarea al completar una que vencía `prevista`.
 *
 * La base es **la fecha prevista, no el día en que se completa**: una lectura
 * de cada lunes completada el miércoles sigue siendo de cada lunes. Y si se
 * completa con varias ocurrencias de retraso, la siguiente es la primera
 * posterior a hoy, no una por cada lunes perdido: nadie quiere tres tareas
 * vencidas de golpe por haberse saltado unas semanas.
 */
export function siguiente(regla: string, prevista: string, hoy: string): string | null {
  const r = leerRegla(regla);
  if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(prevista)) return null;
  const desde = hoy > prevista ? hoy : prevista;
  return ocurrenciaTras(r, desde, prevista);
}

/** La primera ocurrencia en o después de `hoy`: para una tarea nueva sin fecha. */
export function primera(regla: string, hoy: string): string | null {
  const r = leerRegla(regla);
  if (!r) return null;
  if (r.tipo === 'd') return hoy;
  return ocurrenciaTras(r, masDias(hoy, -1), r.tipo === 'w' ? hoy : hoy);
}

const NOMBRES_ES: Record<Dia, string> = { MO: 'lunes', TU: 'martes', WE: 'miércoles', TH: 'jueves', FR: 'viernes', SA: 'sábado', SU: 'domingo' };
const NOMBRES_EN: Record<Dia, string> = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };

/** La regla en palabras: «cada lunes y jueves», «every 2 weeks on Monday». */
export function describir(regla: unknown, lang = 'es'): string {
  const r = leerRegla(regla);
  if (!r) return '';
  const es = lang === 'es';
  const lista = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ${es ? 'y' : 'and'} ${xs[xs.length - 1]}`;
  if (r.tipo === 'd') {
    if (es) return r.cada === 1 ? 'cada día' : `cada ${r.cada} días`;
    return r.cada === 1 ? 'every day' : `every ${r.cada} days`;
  }
  if (r.tipo === 'w') {
    const dias = lista(r.dias.map((d) => (es ? NOMBRES_ES : NOMBRES_EN)[d]));
    if (es) return r.cada === 1 ? `cada ${dias}` : `cada ${r.cada} semanas, el ${dias}`;
    return r.cada === 1 ? `every ${dias}` : `every ${r.cada} weeks on ${dias}`;
  }
  if (es) {
    const cuando = r.dia === -1 ? 'el último día' : `el día ${r.dia}`;
    return r.cada === 1 ? (r.dia === -1 ? 'cada fin de mes' : `${cuando} de cada mes`) : `${cuando}, cada ${r.cada} meses`;
  }
  const cuando = r.dia === -1 ? 'the last day' : `day ${r.dia}`;
  return r.cada === 1 ? `${cuando} of every month` : `${cuando}, every ${r.cada} months`;
}

/** El día de la semana de una fecha, en el formato de las reglas. */
export const diaDe = (iso: string): Dia => DIAS[aUTC(iso).getUTCDay()];
