/**
 * Alta rápida: «Entregar taller viernes 18:00 #Cálculo !1 [[Tema 3]]».
 *
 * Una línea que se escribe de corrido y de la que salen la fecha, la hora, las
 * etiquetas, la prioridad y los apuntes. Lo que queda es el título.
 *
 * **Función pura**, sin red ni DOM: recibe el texto, el día de hoy y el
 * catálogo de etiquetas, y devuelve lo reconocido. Así se prueba con una tabla
 * de frases y un `hoy` fijo, que es la única forma de probar «el viernes» sin
 * que el test dependa del día en que corre.
 *
 * Se interpreta **solo en el navegador**. El servidor recibe campos ya
 * separados (`title`, `due_date`, `label_ids`…) y no vuelve a leer la frase:
 * dos intérpretes acabarían discrepando en algún caso raro y la tarea saldría
 * distinta de lo que se vio al escribirla.
 *
 * Todo lo reconocido sale con su tramo de texto, para pintarlo como chip. Una
 * palabra que parece fecha pero es parte del título —«Leer *El lunes*»— se
 * arregla quitando el chip: su tramo se pasa en `ignorar` y vuelve al título.
 * Sin esa salida, el intérprete estorbaría más de lo que ayuda.
 */

import { DE_ATAJO, type Prioridad } from './prioridad';
import { diaDe, primera, type Dia } from './recurrencia';

export type TipoTramo = 'fecha' | 'hora' | 'etiqueta' | 'prioridad' | 'apunte' | 'repeticion' | 'trabajo' | 'recordatorio';

export interface Tramo {
  tipo: TipoTramo;
  inicio: number;
  fin: number;
  texto: string;
}

export interface Interpretacion {
  titulo: string;
  fecha: string | null;
  hora: string | null;
  etiquetas: Array<{ id: string; name: string }>;
  /** `#algo` que no coincide con ninguna etiqueta: se ofrece crearla, nunca se crea sola. */
  etiquetasNuevas: string[];
  prioridad: Prioridad | null;
  /** Títulos de los `[[apuntes]]` cerrados. Quien llama los traduce a ids. */
  apuntes: string[];
  /** Regla de repetición (`lib/recurrencia.ts`), o `null`. */
  recurrencia: string | null;
  /** «hacer el martes»: el día en que se hace, aparte de la entrega. */
  fechaTrabajo: string | null;
  /** «recordar 1 h antes»: minutos de antelación respecto a la entrega. */
  recordatorio: number | null;
  tramos: Tramo[];
}

export interface Contexto {
  hoy: Date;
  lang?: string;
  etiquetas?: Array<{ id: string; name: string }>;
  /** Tramos que la persona descartó (por su `inicio`): se quedan en el título. */
  ignorar?: Set<number>;
}

/** Sin tildes, en minúsculas y sin separadores: `#calculo-ii` encuentra «Cálculo II». */
export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const soloDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DIAS_EN_CORTOS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** El próximo día de la semana `dia` **después** de hoy: «viernes» un viernes es el de la semana que viene. */
function proximoDia(hoy: Date, dia: number) {
  const diff = ((dia - hoy.getDay() + 7) % 7) || 7;
  return sumarDias(hoy, diff);
}

/** Una fecha válida o `null`; si ya pasó y no se dijo el año, la del año siguiente. */
function fechaDe(hoy: Date, dia: number, mes: number, anio?: number): Date | null {
  const y = anio ?? hoy.getFullYear();
  const d = new Date(y, mes, dia);
  if (d.getMonth() !== mes || d.getDate() !== dia) return null;
  if (anio === undefined && d < soloDia(hoy)) return new Date(y + 1, mes, dia);
  return d;
}

// Límites de palabra que entienden tildes y ñ: `\b` de JavaScript no las ve.
const ANTES = '(?<![\\p{L}\\p{N}#!])';
const DESPUES = '(?![\\p{L}\\p{N}%])';

interface Candidato { tipo: TipoTramo; inicio: number; fin: number; valor: unknown }

function buscarFechas(texto: string, hoy: Date, lang: string): Candidato[] {
  const hallados: Candidato[] = [];
  const probar = (re: RegExp, calcular: (m: RegExpExecArray) => Date | null) => {
    for (const m of texto.matchAll(new RegExp(re.source, 'giu'))) {
      const d = calcular(m as RegExpExecArray);
      if (d) hallados.push({ tipo: 'fecha', inicio: m.index!, fin: m.index! + m[0].length, valor: iso(d) });
    }
  };

  const nombres = (lista: string[]) => lista.join('|');
  const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  if (lang === 'es') {
    const prefijo = '(?:para\\s+(?:el\\s+)?|el\\s+|este\\s+|esta\\s+)?';
    probar(new RegExp(`${ANTES}${prefijo}pasado\\s+ma[ñn]ana${DESPUES}`), () => sumarDias(hoy, 2));
    probar(new RegExp(`${ANTES}(?:para\\s+)?ma[ñn]ana${DESPUES}`), () => sumarDias(hoy, 1));
    probar(new RegExp(`${ANTES}(?:para\\s+)?hoy${DESPUES}`), () => soloDia(hoy));
    probar(new RegExp(`${ANTES}(?:para\\s+)?(?:la\\s+)?(?:pr[óo]xima\\s+semana|semana\\s+que\\s+viene)${DESPUES}`), () => proximoDia(hoy, 1));
    probar(new RegExp(`${ANTES}(?:para\\s+)?en\\s+(\\d{1,3})\\s+d[ií]as?${DESPUES}`), (m) => sumarDias(hoy, Number(m[1])));
    probar(new RegExp(`${ANTES}${prefijo}(?:pr[óo]ximo\\s+)?(${nombres(['domingo', 'lunes', 'martes', 'mi[ée]rcoles', 'jueves', 'viernes', 's[áa]bado'])})${DESPUES}`),
      (m) => proximoDia(hoy, DIAS_ES.indexOf(sinTildes(m[1]))));
    probar(new RegExp(`${ANTES}${prefijo}(\\d{1,2})\\s+de\\s+(${nombres(MESES_ES)})(?:\\s+(?:de\\s+)?(\\d{4}))?${DESPUES}`),
      (m) => fechaDe(hoy, Number(m[1]), MESES_ES.indexOf(m[2].toLowerCase()), m[3] ? Number(m[3]) : undefined));
  } else {
    const prefijo = '(?:on\\s+|by\\s+|this\\s+)?';
    probar(new RegExp(`${ANTES}(?:by\\s+)?tomorrow${DESPUES}`), () => sumarDias(hoy, 1));
    probar(new RegExp(`${ANTES}(?:by\\s+)?today${DESPUES}`), () => soloDia(hoy));
    probar(new RegExp(`${ANTES}next\\s+week${DESPUES}`), () => proximoDia(hoy, 1));
    probar(new RegExp(`${ANTES}in\\s+(\\d{1,3})\\s+days?${DESPUES}`), (m) => sumarDias(hoy, Number(m[1])));
    probar(new RegExp(`${ANTES}${prefijo}(?:next\\s+)?(${nombres(DIAS_EN)}|${nombres(DIAS_EN_CORTOS)})${DESPUES}`), (m) => {
      const k = m[1].toLowerCase();
      const i = DIAS_EN.indexOf(k) >= 0 ? DIAS_EN.indexOf(k) : DIAS_EN_CORTOS.indexOf(k);
      return proximoDia(hoy, i);
    });
    probar(new RegExp(`${ANTES}${prefijo}(${nombres(MESES_EN)}|${nombres(MESES_EN.map((x) => x.slice(0, 3)))})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?${DESPUES}`), (m) => {
      const k = m[1].toLowerCase();
      const mes = MESES_EN.findIndex((x) => x === k || x.slice(0, 3) === k);
      return fechaDe(hoy, Number(m[2]), mes, m[3] ? Number(m[3]) : undefined);
    });
  }

  // Numéricas, en el orden del idioma: 15/03 en español, 03/15 en inglés.
  probar(new RegExp(`${ANTES}${lang === 'es' ? '(?:para\\s+(?:el\\s+)?|el\\s+)?' : '(?:on\\s+|by\\s+)?'}(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2}|\\d{4}))?${DESPUES}`), (m) => {
    const a = Number(m[1]), b = Number(m[2]);
    const [dia, mes] = lang === 'es' ? [a, b] : [b, a];
    const anio = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
    return fechaDe(hoy, dia, mes - 1, anio);
  });

  // «el 15»: ese día de este mes, o del siguiente si ya pasó.
  if (lang === 'es') {
    probar(new RegExp(`${ANTES}(?:para\\s+)?el\\s+(\\d{1,2})${DESPUES}(?![/.:-]\\d)(?!\\s+de\\s)`), (m) => {
      const dia = Number(m[1]);
      const este = fechaDe(hoy, dia, hoy.getMonth(), hoy.getFullYear());
      if (este && este >= soloDia(hoy)) return este;
      const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
      return fechaDe(hoy, dia, siguiente.getMonth(), siguiente.getFullYear());
    });
  }
  return hallados;
}

const DIAS_REGLA_ES: Record<string, Dia> = { lunes: 'MO', martes: 'TU', miercoles: 'WE', jueves: 'TH', viernes: 'FR', sabado: 'SA', domingo: 'SU' };
const DIAS_REGLA_EN: Record<string, Dia> = { monday: 'MO', tuesday: 'TU', wednesday: 'WE', thursday: 'TH', friday: 'FR', saturday: 'SA', sunday: 'SU' };

/**
 * «cada lunes», «cada 2 semanas», «cada mes el 15», «cada fin de mes».
 *
 * Las que dependen del día —«cada semana», «cada mes»— se escriben con `?` y
 * se completan al final con el día de la fecha (o de hoy si no hay fecha).
 */
function buscarRepeticiones(texto: string, lang: string): Candidato[] {
  const hallados: Candidato[] = [];
  const poner = (m: RegExpMatchArray, valor: string) =>
    hallados.push({ tipo: 'repeticion', inicio: m.index!, fin: m.index! + m[0].length, valor });
  const sinTildes = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const re = (fuente: string) => new RegExp(`${ANTES}${fuente}${DESPUES}`, 'giu');

  if (lang === 'es') {
    const dia = '(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)';
    for (const m of texto.matchAll(re(`(?:cada\\s+d[ií]a|todos\\s+los\\s+d[ií]as|a\\s+diario)`))) poner(m, 'd:1');
    for (const m of texto.matchAll(re(`cada\\s+(\\d{1,2})\\s+d[ií]as`))) poner(m, `d:${Number(m[1])}`);
    for (const m of texto.matchAll(re(`cada\\s+fin\\s+de\\s+mes`))) poner(m, 'm:1:-1');
    for (const m of texto.matchAll(re(`cada\\s+mes(?:\\s+el(?:\\s+d[ií]a)?\\s+(\\d{1,2}))?`))) poner(m, `m:1:${m[1] ? Number(m[1]) : '?'}`);
    for (const m of texto.matchAll(re(`cada\\s+(\\d{1,2})\\s+semanas(?:\\s+el\\s+(${dia}))?`))) {
      poner(m, `w:${Number(m[1])}:${m[2] ? DIAS_REGLA_ES[sinTildes(m[2])] : '?'}`);
    }
    for (const m of texto.matchAll(re(`cada\\s+semana`))) poner(m, 'w:1:?');
    for (const m of texto.matchAll(re(`cada\\s+(${dia}(?:\\s*(?:,|y)\\s*${dia})*)`))) {
      const dias = m[1].split(/\s*(?:,|y)\s*/).map((d) => DIAS_REGLA_ES[sinTildes(d)]).filter(Boolean);
      poner(m, `w:1:${dias.join(',')}`);
    }
  } else {
    const dia = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
    for (const m of texto.matchAll(re(`(?:every\\s+day|daily)`))) poner(m, 'd:1');
    for (const m of texto.matchAll(re(`every\\s+(\\d{1,2})\\s+days`))) poner(m, `d:${Number(m[1])}`);
    for (const m of texto.matchAll(re(`every\\s+month`))) poner(m, 'm:1:?');
    for (const m of texto.matchAll(re(`every\\s+(\\d{1,2})\\s+weeks`))) poner(m, `w:${Number(m[1])}:?`);
    for (const m of texto.matchAll(re(`every\\s+week`))) poner(m, 'w:1:?');
    for (const m of texto.matchAll(re(`every\\s+(${dia}(?:\\s*(?:,|and)\\s*${dia})*)`))) {
      const dias = m[1].split(/\s*(?:,|and)\s*/).map((d) => DIAS_REGLA_EN[d.toLowerCase()]).filter(Boolean);
      poner(m, `w:1:${dias.join(',')}`);
    }
  }
  return hallados;
}

function buscarHoras(texto: string): Candidato[] {
  const hallados: Candidato[] = [];
  const poner = (m: RegExpMatchArray, h: number, min: number) => {
    if (h > 23 || min > 59) return;
    hallados.push({
      tipo: 'hora', inicio: m.index!, fin: m.index! + m[0].length,
      valor: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    });
  };
  const prefijo = '(?:a\\s+las\\s+|at\\s+|@)?';
  // 6pm, 6:30 pm, 12am
  for (const m of texto.matchAll(new RegExp(`${ANTES}${prefijo}(\\d{1,2})(?::(\\d{2}))?\\s?(am|pm|a\\.m\\.|p\\.m\\.)(?![\\p{L}])`, 'giu'))) {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase().startsWith('p')) h += 12;
    poner(m, h, Number(m[2] ?? 0));
  }
  // 18:00, 18h, 18h30, a las 18
  for (const m of texto.matchAll(new RegExp(`${ANTES}${prefijo}(\\d{1,2})(?::(\\d{2})|h(\\d{2})?)${DESPUES}`, 'giu'))) {
    poner(m, Number(m[1]), Number(m[2] ?? m[3] ?? 0));
  }
  for (const m of texto.matchAll(new RegExp(`${ANTES}a\\s+las\\s+(\\d{1,2})${DESPUES}(?![:h])`, 'giu'))) {
    poner(m, Number(m[1]), 0);
  }
  return hallados;
}

export function interpretar(texto: string, ctx: Contexto): Interpretacion {
  const lang = ctx.lang === 'es' ? 'es' : 'en';
  const catalogo = ctx.etiquetas ?? [];
  const ignorar = ctx.ignorar ?? new Set<number>();
  const candidatos: Candidato[] = [];

  for (const m of texto.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    candidatos.push({ tipo: 'apunte', inicio: m.index!, fin: m.index! + m[0].length, valor: m[1].trim() });
  }
  for (const m of texto.matchAll(new RegExp(`${ANTES.replace('#!', '')}#([\\p{L}\\p{N}_-]+)`, 'gu'))) {
    candidatos.push({ tipo: 'etiqueta', inicio: m.index!, fin: m.index! + m[0].length, valor: m[1] });
  }
  /**
   * Prioridad: `!1`…`!4` y también por su nombre, en los dos idiomas
   * (`!urgente`, `!alta`, `!normal`, `!baja`; `!urgent`, `!high`, `!low`).
   * Sin distinguir mayúsculas ni tildes.
   */
  const NOMBRES_PRIORIDAD: Record<string, Prioridad> = {
    urgente: 'highest', urgent: 'highest',
    alta: 'high', high: 'high',
    normal: 'medium', media: 'medium', medium: 'medium',
    baja: 'low', low: 'low',
  };
  for (const m of texto.matchAll(/(?<![\p{L}\p{N}])!([1-4]|\p{L}+)(?![\p{L}\p{N}])/gu)) {
    const clave = m[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const valor = /^[1-4]$/.test(clave) ? DE_ATAJO[clave] : NOMBRES_PRIORIDAD[clave];
    if (valor) candidatos.push({ tipo: 'prioridad', inicio: m.index!, fin: m.index! + m[0].length, valor });
  }
  candidatos.push(...buscarRepeticiones(texto, lang), ...buscarHoras(texto));

  // «recordar 1 h antes», «avisar 2 días antes», «remind me 30 min before».
  const avisos = lang === 'es'
    ? /(?<![\p{L}\p{N}])(?:recordar(?:me)?|av[ií]sa(?:r(?:me)?|me))\s+(\d{1,3})\s*(min(?:utos?)?|h(?:oras?)?|d(?:[ií]as?)?|semanas?)\s+antes(?![\p{L}\p{N}])/giu
    : /(?<![\p{L}\p{N}])remind(?:\s+me)?\s+(\d{1,3})\s*(min(?:utes?)?|h(?:ours?)?|d(?:ays?)?|weeks?)\s+before(?![\p{L}\p{N}])/giu;
  for (const m of texto.matchAll(avisos)) {
    const u = m[2].toLowerCase();
    const factor = u.startsWith('min') ? 1 : u.startsWith('h') ? 60 : u.startsWith('d') ? 1440 : 10080;
    const minutos = Number(m[1]) * factor;
    if (minutos <= 20160) candidatos.push({ tipo: 'recordatorio', inicio: m.index!, fin: m.index! + m[0].length, valor: minutos });
  }

  /**
   * «hacer el martes», «trabajar el 15/11», «do tue»: una fecha precedida de
   * esas palabras es el día de trabajo, no la entrega. El prefijo se come con
   * ella para que no quede en el título.
   */
  const fechas = buscarFechas(texto, ctx.hoy, lang);
  const prefijo = lang === 'es' ? /(?<![\p{L}\p{N}])(?:hacer(?:lo)?|trabajar(?:lo)?|lo\s+hago)\s+$/iu : /(?<![\p{L}\p{N}])(?:do(?:\s+it)?|work\s+on)\s+$/iu;
  for (const f of fechas) {
    const m = prefijo.exec(texto.slice(0, f.inicio));
    if (m) candidatos.push({ ...f, tipo: 'trabajo', inicio: m.index });
    else candidatos.push(f);
  }

  // Sin solapes: gana el que empieza antes y, a igualdad, el más largo
  // («pasado mañana» antes que «mañana»; «15 de marzo» antes que «el 15»).
  candidatos.sort((a, b) => a.inicio - b.inicio || (b.fin - b.inicio) - (a.fin - a.inicio));
  const elegidos: Candidato[] = [];
  let hasta = -1;
  for (const c of candidatos) {
    if (c.inicio < hasta) continue;
    elegidos.push(c);
    hasta = c.fin;
  }

  const r: Interpretacion = {
    titulo: '', fecha: null, hora: null, etiquetas: [], etiquetasNuevas: [], prioridad: null, apuntes: [], recurrencia: null, fechaTrabajo: null, recordatorio: null, tramos: [],
  };
  const usados: Candidato[] = [];
  for (const c of elegidos) {
    if (ignorar.has(c.inicio)) continue;
    // Una sola fecha, una hora y una prioridad: la segunda se queda en el título.
    if (c.tipo === 'fecha') { if (r.fecha) continue; r.fecha = c.valor as string; }
    else if (c.tipo === 'hora') { if (r.hora) continue; r.hora = c.valor as string; }
    else if (c.tipo === 'prioridad') { if (r.prioridad) continue; r.prioridad = c.valor as Prioridad; }
    else if (c.tipo === 'apunte') r.apuntes.push(c.valor as string);
    else if (c.tipo === 'repeticion') { if (r.recurrencia) continue; r.recurrencia = c.valor as string; }
    else if (c.tipo === 'trabajo') { if (r.fechaTrabajo) continue; r.fechaTrabajo = c.valor as string; }
    else if (c.tipo === 'recordatorio') { if (r.recordatorio !== null) continue; r.recordatorio = c.valor as number; }
    else if (c.tipo === 'etiqueta') {
      const buscada = normalizar(c.valor as string);
      const hallada = catalogo.find((e) => normalizar(e.name) === buscada);
      if (hallada) { if (!r.etiquetas.some((e) => e.id === hallada.id)) r.etiquetas.push(hallada); }
      else if (!r.etiquetasNuevas.includes(c.valor as string)) r.etiquetasNuevas.push(c.valor as string);
    }
    usados.push(c);
    r.tramos.push({ tipo: c.tipo, inicio: c.inicio, fin: c.fin, texto: texto.slice(c.inicio, c.fin) });
  }

  // «cada semana» y «cada mes» toman el día de la fecha, o el de hoy.
  if (r.recurrencia?.includes('?')) {
    const base = r.fecha ?? iso(soloDia(ctx.hoy));
    r.recurrencia = r.recurrencia.startsWith('w')
      ? r.recurrencia.replace('?', diaDe(base))
      : r.recurrencia.replace('?', String(Number(base.slice(8, 10))));
  }
  // Una tarea que se repite necesita fecha: la primera que toca.
  if (r.recurrencia && !r.fecha) r.fecha = primera(r.recurrencia, iso(soloDia(ctx.hoy)));

  // Una hora sin fecha es para hoy: «18:00 entregar» se entiende como hoy.
  if (r.hora && !r.fecha) r.fecha = iso(soloDia(ctx.hoy));

  let titulo = '';
  let cursor = 0;
  for (const c of usados) {
    titulo += texto.slice(cursor, c.inicio);
    cursor = c.fin;
  }
  titulo += texto.slice(cursor);
  r.titulo = titulo.replace(/\s+/g, ' ').trim();
  return r;
}
