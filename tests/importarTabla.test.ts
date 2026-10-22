import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { aNumero, leerCsv, MAX_FILAS, prepararTabla, tiposDe, validarImportacion } from '../src/lib/importarTabla';
import { fechaDeSerie, leerXlsx } from '../src/lib/xlsx';

describe('leerCsv', () => {
  it('comas, comillas, comillas dobladas y saltos dentro de un campo', () => {
    expect(leerCsv('a,b\n"x, y","di ""hola""\notra línea"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'di "hola"\notra línea'],
    ]);
  });

  it('punto y coma (Excel en español), CRLF y BOM', () => {
    expect(leerCsv('﻿Nombre;Nota\r\nAna;4,5\r\nLuis;3\r\n')).toEqual([['Nombre', 'Nota'], ['Ana', '4,5'], ['Luis', '3']]);
  });

  it('tabuladores', () => {
    expect(leerCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('aNumero', () => {
  it('acepta enteros, decimales con punto o coma y signo', () => {
    expect([aNumero('3'), aNumero('3.5'), aNumero('3,5'), aNumero('-2'), aNumero(7)]).toEqual([3, 3.5, 3.5, -2, 7]);
  });

  it('un código con cero delante o de más de quince cifras no es un número', () => {
    expect([aNumero('007'), aNumero('0301234567'), aNumero('1234567890123456'), aNumero('0.5')]).toEqual([null, null, null, 0.5]);
  });

  it('palabras y vacíos, no', () => {
    expect([aNumero('3 kg'), aNumero(''), aNumero(null), aNumero('1.000,5')]).toEqual([null, null, null, null]);
  });
});

describe('tiposDe', () => {
  it('todo números: Número', () => {
    expect(tiposDe([1, '2,5', null])).toEqual({ type: 'number', posibles: ['text', 'number', 'select'] });
  });

  it('pocos valores que se repiten: Opciones', () => {
    expect(tiposDe(['Hecho', 'Pendiente', 'Hecho', 'Hecho', 'Pendiente']).type).toBe('select');
  });

  it('nombres distintos: Texto, aunque sean pocos', () => {
    expect(tiposDe(['Ana', 'Luis', 'Marta']).type).toBe('text');
  });

  it('con una palabra no se ofrece Número', () => {
    expect(tiposDe(['1', 'dos']).posibles).not.toContain('number');
  });
});

describe('prepararTabla', () => {
  it('cabecera, filas y columnas vacías fuera, nombres repetidos y sin nombre', () => {
    const t = prepararTabla([
      [],
      ['Nombre', 'Nombre', null, '', 'Nota'],
      ['Ana', 'x', null, null, '4,5'],
      [null, null, null, null, null],
      ['Luis', 'y', null, 'suelto', 3],
    ], { nombreColumna: (n) => `Columna ${n}` })!;
    expect(t.columnas.map((c) => c.name)).toEqual(['Nombre', 'Nombre (2)', 'Columna 3', 'Nota']);
    expect(t.columnas.map((c) => c.type)).toEqual(['text', 'text', 'text', 'number']);
    expect(t.filas).toEqual([['Ana', 'x', null, '4,5'], ['Luis', 'y', 'suelto', 3]]);
    expect(t.sobranFilas).toBe(false);
  });

  it('recorta a MAX_FILAS y lo dice', () => {
    const filas = [['n'], ...Array.from({ length: MAX_FILAS + 5 }, (_, i) => [i + 1])];
    const t = prepararTabla(filas)!;
    expect(t.filas).toHaveLength(MAX_FILAS);
    expect(t.sobranFilas).toBe(true);
  });

  it('un archivo vacío no es una tabla', () => {
    expect(prepararTabla([[], [null, ''], ['  ']])).toBeNull();
  });
});

describe('validarImportacion', () => {
  const base = { name: '  Notas  ', columns: [{ name: 'Alumno', type: 'text' }, { name: 'Nota', type: 'number' }, { name: 'Estado', type: 'select' }] };

  it('convierte los números y saca las opciones de los datos', () => {
    const r = validarImportacion({ ...base, rows: [['Ana', '4,5', 'Aprobado'], ['Luis', 3, 'Suspenso'], ['Marta', null, 'Aprobado']] });
    expect(r).toEqual({
      name: 'Notas',
      columnas: [{ name: 'Alumno', type: 'text' }, { name: 'Nota', type: 'number' }, { name: 'Estado', type: 'select', options: ['Aprobado', 'Suspenso'] }],
      filas: [['Ana', 4.5, 'Aprobado'], ['Luis', 3, 'Suspenso'], ['Marta', null, 'Aprobado']],
    });
  });

  it('dos columnas con el mismo nombre se distinguen', () => {
    const r = validarImportacion({ name: 'x', columns: [{ name: 'Nota', type: 'text' }, { name: 'nota ', type: 'text' }], rows: [] });
    expect('columnas' in r && r.columnas.map((c) => c.name)).toEqual(['Nota', 'nota (2)']);
  });

  it('una palabra en una columna numérica se rechaza diciendo dónde', () => {
    expect(validarImportacion({ ...base, rows: [['Ana', 'cuatro', 'x']] })).toEqual({ error_code: 'bad_number', fila: 1, columna: 'Nota' });
  });

  it('sin nombre, sin columnas, tipos inventados, filas que no son listas o de más', () => {
    expect(validarImportacion({ ...base, name: ' ', rows: [] })).toEqual({ error_code: 'bad_name' });
    expect(validarImportacion({ ...base, columns: [], rows: [] })).toEqual({ error_code: 'bad_columns' });
    expect(validarImportacion({ ...base, columns: [{ name: 'a', type: 'file' }], rows: [] })).toEqual({ error_code: 'bad_columns' });
    expect(validarImportacion({ ...base, rows: ['Ana'] })).toEqual({ error_code: 'bad_rows' });
    expect(validarImportacion({ ...base, rows: [['a', 1, 'b', 'sobra']] })).toEqual({ error_code: 'bad_rows' });
    expect(validarImportacion({ ...base, rows: [[{ a: 1 }, 1, 'b']] })).toEqual({ error_code: 'bad_rows' });
    expect(validarImportacion({ ...base, rows: Array.from({ length: MAX_FILAS + 1 }, () => []) })).toEqual({ error_code: 'too_many_rows' });
  });
});

/** Un `.xlsx` mínimo, como lo guarda Excel: libro, relaciones, cadenas, estilos y una hoja. */
function xlsx(hoja: string, extra: Record<string, string> = {}) {
  const archivos: Record<string, string> = {
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Notas &amp; más" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/sharedStrings.xml': `<sst><si><t>Alumno</t></si><si><t>Fecha</t></si><si><r><t>An</t></r><r><rPr><b/></rPr><t>a</t></r><rPh><t>ア</t></rPh></si><si><t xml:space="preserve">a &lt; b_x000D_</t></si></sst>`,
    'xl/styles.xml': `<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="4"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': hoja,
    ...extra,
  };
  return zipSync(Object.fromEntries(Object.entries(archivos).map(([k, v]) => [k, strToU8(v)])));
}

describe('leerXlsx', () => {
  it('cadenas compartidas con formato, en línea, números, fechas, booleanos y huecos', () => {
    const hojas = leerXlsx(xlsx(`<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>Nota</t></is></c></row>
      <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><v>46317</v></c><c r="C2" t="b"><v>1</v></c><c r="D2" s="2"><v>4.5</v></c></row>
      <row r="4"><c r="A4" t="s"><v>3</v></c><c r="B4" s="1"/><c r="D4" t="e"><v>#DIV/0!</v></c></row>
    </sheetData></worksheet>`));
    expect(hojas).toHaveLength(1);
    expect(hojas[0].nombre).toBe('Notas & más');
    expect(hojas[0].filas).toEqual([
      ['Alumno', 'Fecha', undefined, 'Nota'],
      ['Ana', '2026-10-22', true, 4.5],
      [],
      ['a < b\r', null, undefined, null],
    ]);
  });

  it('prefijos de espacio de nombres (x:c) y celdas sin referencia', () => {
    const hojas = leerXlsx(xlsx(`<x:worksheet><x:sheetData><x:row><x:c t="inlineStr"><x:is><x:t>uno</x:t></x:is></x:c><x:c><x:v>2</x:v></x:c></x:row></x:sheetData></x:worksheet>`));
    expect(hojas[0].filas).toEqual([['uno', 2]]);
  });

  it('lo que no es un .xlsx se dice', () => {
    expect(() => leerXlsx(strToU8('Nombre,Nota'))).toThrow('no_xlsx');
    expect(() => leerXlsx(zipSync({ 'a.txt': strToU8('x') }))).toThrow('no_xlsx');
  });

  it('fechas de serie: día, día con hora y libros de 1904', () => {
    expect(fechaDeSerie(46317)).toBe('2026-10-22');
    expect(fechaDeSerie(46317.5)).toBe('2026-10-22 12:00');
    expect(fechaDeSerie(46317 - 1462, true)).toBe('2026-10-22');
  });

  it('de la hoja a la tabla: la fecha queda como texto y la nota como número', () => {
    const [hoja] = leerXlsx(xlsx(`<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><v>46317</v></c></row>
    </sheetData></worksheet>`));
    const t = prepararTabla(hoja.filas)!;
    expect(t.columnas.map((c) => [c.name, c.type])).toEqual([['Alumno', 'text'], ['Fecha', 'text']]);
    expect(t.filas).toEqual([['Ana', '2026-10-22']]);
  });
});
