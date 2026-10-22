/**
 * Importar una tabla hecha en otro sitio (CSV o Excel) como base dinámica.
 *
 * Todo lo de aquí es puro y lo usan los dos lados: el navegador para enseñar la
 * vista previa —columnas, tipos, primeras filas— y el servidor para validar lo
 * que llega antes de escribir. La regla de qué es un número es la misma en los
 * dos, así que una columna que la vista previa da por numérica no la rechaza
 * después el servidor.
 *
 * Leer el `.xlsx` va aparte (`xlsx.ts`), porque arrastra el descompresor y solo
 * hace falta cuando alguien elige una hoja de cálculo.
 */

/** Lo que puede traer una celda de cualquiera de los dos formatos. */
export type Celda = string | number | boolean | null | undefined;
/** Lo que se guarda: texto, número o nada. */
export type Valor = string | number | null;
export type TipoImportado = 'text' | 'number' | 'select';

/** Topes. Las filas, las mismas que enseña la página de una tabla. */
export const MAX_FILAS = 1000;
export const MAX_COLUMNAS = 50;
export const MAX_OPCIONES = 50;
export const LARGO_NOMBRE = 120;
export const LARGO_TEXTO = 5000;

export interface ColumnaImportada {
  name: string;
  /** El que se propone. */
  type: TipoImportado;
  /** Los que admiten sus valores: «Número» no se ofrece si hay una palabra. */
  posibles: TipoImportado[];
}

export interface TablaImportada {
  columnas: ColumnaImportada[];
  filas: Valor[][];
  /** El archivo traía más filas o columnas de las que caben. */
  sobranFilas: boolean;
  sobranColumnas: boolean;
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/**
 * El separador de un CSV: el que más aparece en la primera línea fuera de
 * comillas. Excel en español guarda con `;` —la coma es el decimal— y una hoja
 * exportada como «valores separados por tabulaciones», con tabulador.
 */
function separadorDe(texto: string): string {
  const cuentas: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let dentro = false;
  for (const c of texto) {
    if (c === '"') dentro = !dentro;
    else if (!dentro && (c === '\n' || c === '\r')) break;
    else if (!dentro && c in cuentas) cuentas[c]++;
  }
  const [mejor, veces] = Object.entries(cuentas).sort((a, b) => b[1] - a[1])[0];
  return veces > 0 ? mejor : ',';
}

/** RFC 4180: comillas dobles, comillas escapadas duplicándolas, saltos dentro. */
export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '');
  const sep = separadorDe(limpio);
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let dentro = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (dentro) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentro = false;
      else campo += c;
    } else if (c === '"') {
      dentro = true;
    } else if (c === sep) {
      fila.push(campo); campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila);
      fila = []; campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

// ── Valores ──────────────────────────────────────────────────────────────────

const NUMERO = /^[-+]?\d+(?:[.,]\d+)?$/;

/**
 * Un número, o `null` si no lo es. «3,5» vale 3.5: en español la coma es el
 * decimal. Los que empiezan por cero («007», un teléfono «0301…») y los de más
 * de quince cifras no son números: perderían el cero o la precisión, y son
 * códigos, no cantidades.
 */
export function aNumero(v: Celda): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!NUMERO.test(s)) return null;
  const cifras = s.replace(/^[-+]/, '');
  if (/^0\d/.test(cifras) || cifras.replace(/[.,]/, '').length > 15) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** La celda como valor guardable, sin decidir aún el tipo. */
function normalizar(v: Celda, si: string, no: string): Valor {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? si : no;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  // Fuera los caracteres de control, salvo saltos y tabuladores.
  const s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s === '' ? null : s;
}

const texto = (v: Valor): string => (typeof v === 'number' ? String(v) : (v ?? ''));

/** Qué tipos admite una columna y cuál se propone. */
export function tiposDe(valores: Valor[]): { type: TipoImportado; posibles: TipoImportado[] } {
  const llenos = valores.filter((v): v is string | number => v !== null);
  const posibles: TipoImportado[] = ['text'];
  if (!llenos.length) return { type: 'text', posibles };

  const numerica = llenos.every((v) => aNumero(v) !== null);
  if (numerica) posibles.push('number');
  const distintos = new Set(llenos.map(texto));
  if (distintos.size <= MAX_OPCIONES && [...distintos].every((d) => d.length <= LARGO_NOMBRE)) posibles.push('select');

  // Opciones solo si se repiten de verdad: un «Estado» con tres valores en
  // veinte filas, no una columna de nombres que casualmente son pocos.
  const pocas = distintos.size <= 12 && llenos.length >= 4 && distintos.size * 2 <= llenos.length;
  const type: TipoImportado = numerica ? 'number' : pocas && posibles.includes('select') ? 'select' : 'text';
  return { type, posibles };
}

// ── La tabla ─────────────────────────────────────────────────────────────────

export interface OpcionesPreparar {
  /** El nombre de una columna sin cabecera, a partir de su número. */
  nombreColumna?: (n: number) => string;
  /** Cómo se escribe verdadero y falso de una celda de Excel. */
  si?: string;
  no?: string;
}

/**
 * De las filas de un archivo a columnas con nombre y tipo. La primera fila con
 * algo es la cabecera. Se quitan las filas vacías y las columnas que no tienen
 * ni cabecera ni datos —las que deja una celda formateada sin querer—.
 */
export function prepararTabla(crudas: Celda[][], o: OpcionesPreparar = {}): TablaImportada | null {
  const si = o.si ?? 'TRUE';
  const no = o.no ?? 'FALSE';
  const nombreColumna = o.nombreColumna ?? ((n: number) => `Column ${n}`);

  const filas = crudas
    .map((f) => (Array.isArray(f) ? f.map((v) => normalizar(v, si, no)) : []))
    .filter((f) => f.some((v) => v !== null));
  if (!filas.length) return null;

  const [cabecera, ...datos] = filas;
  const ancho = Math.max(...filas.map((f) => f.length));
  const usadas = Array.from({ length: ancho }, (_, c) => c)
    .filter((c) => cabecera[c] != null || datos.some((f) => f[c] != null));

  const sobranColumnas = usadas.length > MAX_COLUMNAS;
  const sobranFilas = datos.length > MAX_FILAS;
  const columnasUsadas = usadas.slice(0, MAX_COLUMNAS);
  const filasUsadas = datos.slice(0, MAX_FILAS).map((f) => columnasUsadas.map((c) => f[c] ?? null));

  const vistos = new Set<string>();
  const columnas = columnasUsadas.map((c, i) => {
    const base = texto(cabecera[c] ?? null).replace(/\s+/g, ' ').slice(0, LARGO_NOMBRE).trim() || nombreColumna(i + 1);
    let name = base;
    for (let n = 2; vistos.has(name.toLowerCase()); n++) name = `${base} (${n})`;
    vistos.add(name.toLowerCase());
    return { name, ...tiposDe(filasUsadas.map((f) => f[i])) };
  });

  return { columnas, filas: filasUsadas, sobranFilas, sobranColumnas };
}

// ── Lo que valida el servidor ────────────────────────────────────────────────

export type ErrorImportacion =
  | { error_code: 'bad_name' | 'bad_columns' | 'bad_rows' | 'too_many_rows' }
  | { error_code: 'bad_number' | 'too_many_options'; fila?: number; columna: string };

export interface ImportacionValida {
  name: string;
  columnas: Array<{ name: string; type: TipoImportado; options?: string[] }>;
  /** Una fila por entrada, ya con el tipo de cada columna. */
  filas: Valor[][];
}

/**
 * Lo que llega del navegador, comprobado: el nombre, cada columna con un tipo
 * que sus valores admiten, y cada celda convertida. Las opciones de una columna
 * de selección salen de los datos, no del cuerpo.
 */
export function validarImportacion(cuerpo: any): ImportacionValida | ErrorImportacion {
  const name = typeof cuerpo?.name === 'string' ? cuerpo.name.replace(/\s+/g, ' ').trim().slice(0, LARGO_NOMBRE) : '';
  if (!name) return { error_code: 'bad_name' };

  const cols = cuerpo?.columns;
  if (!Array.isArray(cols) || !cols.length || cols.length > MAX_COLUMNAS) return { error_code: 'bad_columns' };
  const columnas: ImportacionValida['columnas'] = [];
  const vistos = new Set<string>();
  for (const c of cols) {
    const base = typeof c?.name === 'string' ? c.name.replace(/\s+/g, ' ').trim().slice(0, LARGO_NOMBRE) : '';
    if (!base || !['text', 'number', 'select'].includes(c?.type)) return { error_code: 'bad_columns' };
    // Dos con el mismo nombre (renombradas así en la vista previa) se distinguen.
    let nombre = base;
    for (let n = 2; vistos.has(nombre.toLowerCase()); n++) nombre = `${base} (${n})`;
    vistos.add(nombre.toLowerCase());
    columnas.push({ name: nombre, type: c.type });
  }

  const crudas = cuerpo?.rows;
  if (!Array.isArray(crudas)) return { error_code: 'bad_rows' };
  if (crudas.length > MAX_FILAS) return { error_code: 'too_many_rows' };

  const filas: Valor[][] = [];
  for (let i = 0; i < crudas.length; i++) {
    const f = crudas[i];
    if (!Array.isArray(f) || f.length > columnas.length) return { error_code: 'bad_rows' };
    const fila: Valor[] = [];
    for (let c = 0; c < columnas.length; c++) {
      const v = f[c];
      if (v !== null && v !== undefined && typeof v !== 'string' && typeof v !== 'number') return { error_code: 'bad_rows' };
      const crudo = normalizar(v, 'TRUE', 'FALSE');
      if (crudo === null) { fila.push(null); continue; }
      if (columnas[c].type === 'number') {
        const n = aNumero(crudo);
        if (n === null) return { error_code: 'bad_number', fila: i + 1, columna: columnas[c].name };
        fila.push(n);
      } else {
        fila.push(texto(crudo).slice(0, columnas[c].type === 'select' ? LARGO_NOMBRE : LARGO_TEXTO));
      }
    }
    filas.push(fila);
  }

  for (let c = 0; c < columnas.length; c++) {
    if (columnas[c].type !== 'select') continue;
    const opciones = [...new Set(filas.map((f) => f[c]).filter((v): v is string => typeof v === 'string'))];
    if (opciones.length > MAX_OPCIONES) return { error_code: 'too_many_options', columna: columnas[c].name };
    columnas[c].options = opciones;
  }
  return { name, columnas, filas };
}
