import { strFromU8, unzipSync } from 'fflate';
import type { Celda } from './importarTabla';

/**
 * Leer un `.xlsx` (Excel, Google Sheets, LibreOffice al guardar como Excel) sin
 * una librería de hojas de cálculo entera.
 *
 * Un `.xlsx` es un zip con XML dentro. Para importar una tabla basta con los
 * valores: el libro (nombres de hoja), las cadenas compartidas, los estilos
 * —solo para saber qué números son fechas— y cada hoja. Ni fórmulas (se toma el
 * resultado guardado), ni formatos, ni celdas combinadas.
 *
 * Se lee con expresiones regulares y no con `DOMParser` para que funcione igual
 * en el navegador y en las pruebas. El XML de un `.xlsx` lo escribe un programa
 * y es regular; los prefijos de espacio de nombres (`x:c`) que ponen algunas
 * librerías se admiten.
 */

export interface Hoja {
  nombre: string;
  filas: Celda[][];
}

const ENTIDADES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Entidades XML y los `_x000D_` con que Excel escribe caracteres de control. */
function decodificar(s: string): string {
  return s
    .replace(/&(?:#x([0-9a-f]+)|#(\d+)|(lt|gt|amp|quot|apos));/gi, (_, hex, dec, nombre) =>
      hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(parseInt(dec, 10)) : ENTIDADES[nombre.toLowerCase()])
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const atributo = (attrs: string, nombre: string) => {
  const m = attrs.match(new RegExp(`(?:^|\\s)${nombre}="([^"]*)"`));
  return m ? decodificar(m[1]) : null;
};

/** El texto de un `<si>` o un `<is>`: todos sus `<t>`, sin la fonética (`<rPh>`). */
function textoDe(xml: string): string {
  const sinFonetica = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '');
  let s = '';
  for (const m of sinFonetica.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)) s += m[1];
  return decodificar(s);
}

function cadenasCompartidas(xml: string | null): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>|<(?:\w+:)?si\s*\/>/g)].map((m) => textoDe(m[1] ?? ''));
}

/** Los formatos de número de serie que son fechas u horas. */
const FECHAS_DE_SERIE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/** Qué estilos de celda (`s="…"`) pintan el número como fecha. */
function estilosDeFecha(xml: string | null): Set<number> {
  const fechas = new Set<number>();
  if (!xml) return fechas;
  const propios = new Map<number, string>();
  for (const m of xml.matchAll(/<(?:\w+:)?numFmt\b([^>]*)\/?>/g)) {
    const id = Number(atributo(m[1], 'numFmtId'));
    const codigo = atributo(m[1], 'formatCode');
    if (codigo !== null) propios.set(id, codigo);
  }
  const esFecha = (id: number) => {
    if (FECHAS_DE_SERIE.has(id)) return true;
    const codigo = propios.get(id);
    if (!codigo) return false;
    // Sin lo que va entre comillas, corchetes o escapado: «"días" 0» no es fecha.
    const limpio = codigo.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    return /[dmyhs]/i.test(limpio) && !/^General$/i.test(limpio);
  };
  const xfs = xml.match(/<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/);
  if (!xfs) return fechas;
  [...xfs[1].matchAll(/<(?:\w+:)?xf\b([^>]*?)\/?>/g)].forEach((m, i) => {
    if (esFecha(Number(atributo(m[1], 'numFmtId') ?? 0))) fechas.add(i);
  });
  return fechas;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Número de serie de Excel a «2026-10-22» (o «2026-10-22 14:30» si lleva hora). */
export function fechaDeSerie(serie: number, desde1904 = false): string {
  const dias = desde1904 ? serie + 1462 : serie;
  const ms = Math.round((dias - 25569) * 86400000);
  const f = new Date(ms);
  const dia = `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
  if (serie < 1) return `${dos(f.getUTCHours())}:${dos(f.getUTCMinutes())}`;
  return f.getUTCHours() || f.getUTCMinutes() ? `${dia} ${dos(f.getUTCHours())}:${dos(f.getUTCMinutes())}` : dia;
}

/** «C» → 2. */
function columnaDe(ref: string | null): number | null {
  const letras = ref?.match(/^[A-Z]+/i)?.[0];
  if (!letras) return null;
  let n = 0;
  for (const l of letras.toUpperCase()) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}

function leerHoja(xml: string, compartidas: string[], fechas: Set<number>, desde1904: boolean, maxFilas: number): Celda[][] {
  const filas: Celda[][] = [];
  let siguienteFila = 0;
  for (const r of xml.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const numero = Number(atributo(r[1], 'r'));
    const indice = numero > 0 ? numero - 1 : siguienteFila;
    siguienteFila = indice + 1;
    if (indice >= maxFilas) break;
    const fila: Celda[] = [];
    let siguienteColumna = 0;
    for (const c of (r[2] ?? '').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const col = columnaDe(atributo(c[1], 'r')) ?? siguienteColumna;
      siguienteColumna = col + 1;
      const tipo = atributo(c[1], 't');
      const dentro = c[2] ?? '';
      const v = dentro.match(/<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
      let valor: Celda = null;
      if (tipo === 'inlineStr') valor = textoDe(dentro);
      else if (v === undefined) valor = null;
      else if (tipo === 's') valor = compartidas[Number(v)] ?? null;
      else if (tipo === 'str' || tipo === 'd') valor = decodificar(v);
      else if (tipo === 'b') valor = v === '1';
      else if (tipo === 'e') valor = null;
      else {
        const n = Number(v);
        valor = !Number.isFinite(n) ? null : fechas.has(Number(atributo(c[1], 's') ?? -1)) ? fechaDeSerie(n, desde1904) : n;
      }
      fila[col] = valor;
    }
    filas[indice] = fila;
  }
  // Las filas que no aparecen en el XML están vacías.
  return Array.from({ length: filas.length }, (_, i) => filas[i] ?? []);
}

/**
 * Las hojas de un `.xlsx`, en su orden, con sus valores. Como mucho `maxFilas`
 * filas por hoja: lo que no se va a importar no hace falta leerlo.
 *
 * Lanza `Error('no_xlsx')` si el archivo no es un `.xlsx` (un `.xls` antiguo,
 * un zip cualquiera, uno con contraseña).
 */
export function leerXlsx(datos: Uint8Array, maxFilas = 5000): Hoja[] {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(datos, { filter: (f) => f.name.endsWith('.xml') || f.name.endsWith('.rels') });
  } catch {
    throw new Error('no_xlsx');
  }
  const leer = (ruta: string) => (zip[ruta] ? strFromU8(zip[ruta]) : null);
  const libro = leer('xl/workbook.xml');
  if (!libro) throw new Error('no_xlsx');

  const destinos = new Map<string, string>();
  for (const m of (leer('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<(?:\w+:)?Relationship\b([^>]*?)\/?>/g)) {
    const id = atributo(m[1], 'Id');
    const destino = atributo(m[1], 'Target');
    if (id && destino) destinos.set(id, destino);
  }
  const compartidas = cadenasCompartidas(leer('xl/sharedStrings.xml'));
  const fechas = estilosDeFecha(leer('xl/styles.xml'));
  const desde1904 = /<(?:\w+:)?workbookPr\b[^>]*\bdate1904="(?:1|true)"/.test(libro);

  const hojas: Hoja[] = [];
  for (const m of libro.matchAll(/<(?:\w+:)?sheet\b([^>]*?)\/?>/g)) {
    const rid = m[1].match(/\b\w+:id="([^"]*)"/)?.[1];
    const destino = rid ? destinos.get(rid) : undefined;
    if (!destino) continue;
    // «worksheets/sheet1.xml», relativo a `xl/`; o absoluto, «/xl/worksheets/…».
    const ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino.replace(/^\.\//, '')}`;
    const xml = leer(ruta);
    if (!xml) continue;
    hojas.push({ nombre: atributo(m[1], 'name') ?? '', filas: leerHoja(xml, compartidas, fechas, desde1904, maxFilas) });
  }
  if (!hojas.length) throw new Error('no_xlsx');
  return hojas;
}
