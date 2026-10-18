import { describe, it, expect } from 'vitest';
import { fromEditorjs, inlineFromHtml } from '../src/lib/notes/fromEditorjs';
import { loadNote, validateNoteDoc, serializeNote, EMPTY_NOTE_JSON } from '../src/lib/notes/content';

/**
 * Las notas pasan de Editor.js a Tiptap. Los casos de Editor.js usan el
 * formato **real** que emitía cada plugin instalado —el mismo que fijaba el
 * test del sanitizador viejo—, porque la diferencia entre lo que el código
 * suponía y lo que el paquete devolvía fue la causa de cuatro pérdidas de
 * datos.
 *
 * Todo documento convertido tiene que pasar además la validación del
 * servidor: si no, la primera vez que se guardara una nota migrada se
 * rechazaría.
 */

const convertir = (...blocks: any[]) => {
  const r = fromEditorjs({ blocks });
  const v = validateNoteDoc(r.doc);
  expect(v.ok, `el documento convertido no pasa el esquema: ${JSON.stringify(r.doc)}`).toBe(true);
  return r;
};
const primero = (...blocks: any[]) => convertir(...blocks).doc.content![0];
const texto = (n: any): string =>
  n.type === 'text' ? n.text : n.type === 'hardBreak' ? '\n' : (n.content ?? []).map(texto).join('');

describe('párrafos y formato en línea', () => {
  it('convierte negrita, cursiva, subrayado, resaltado y código', () => {
    const p = primero({ type: 'paragraph', data: { text: '<b>n</b><i>c</i><u>s</u><mark class="cdx-marker">r</mark><code class="inline-code">k</code>' } });
    expect(p.content!.map((n: any) => n.marks[0].type)).toEqual(['bold', 'italic', 'underline', 'highlight', 'code']);
  });

  it('conserva los saltos de línea suaves', () => {
    const p = primero({ type: 'paragraph', data: { text: 'a<br>b' } });
    expect(p.content!.map((n: any) => n.type)).toEqual(['text', 'hardBreak', 'text']);
  });

  it('decodifica entidades', () => {
    expect(texto(primero({ type: 'paragraph', data: { text: 'a &amp; b &lt;c&gt;&nbsp;d' } }))).toBe('a & b <c> d');
  });

  it('conserva los enlaces seguros y quita los ejecutables sin perder el texto', () => {
    const bueno = primero({ type: 'paragraph', data: { text: '<a href="https://x.y">x</a>' } });
    expect(bueno.content![0].marks![0]).toEqual({ type: 'link', attrs: { href: 'https://x.y' } });

    const malo = primero({ type: 'paragraph', data: { text: '<a href="javascript:alert(1)">x</a>' } });
    expect(JSON.stringify(malo)).not.toContain('javascript:');
    expect(texto(malo)).toBe('x');
  });

  it('el código en línea no lleva otras marcas, que el esquema no admite', () => {
    const p = primero({ type: 'paragraph', data: { text: '<b><code>x</code></b>' } });
    expect(p.content![0].marks).toEqual([{ type: 'code' }]);
  });

  it('no conserva scripts, ni siquiera como texto', () => {
    expect(texto(primero({ type: 'paragraph', data: { text: '<script>alert(1)</script><b>ok</b>' } }))).toBe('ok');
  });

  it('las etiquetas desconocidas se ignoran conservando su texto', () => {
    expect(texto(primero({ type: 'paragraph', data: { text: '<span style="x">hola</span>' } }))).toBe('hola');
  });

  it('el HTML mal anidado no rompe nada', () => {
    expect(() => inlineFromHtml('<b>a<i>b</b>c</i>')).not.toThrow();
    convertir({ type: 'paragraph', data: { text: '<b>a<i>b</b>c</i>' } });
  });
});

describe('encabezados', () => {
  it('conservan el nivel 1–3 y bajan el 4–6 a 3', () => {
    expect(primero({ type: 'header', data: { text: 'h', level: 2 } }).attrs).toEqual({ level: 2 });
    expect(primero({ type: 'header', data: { text: 'h', level: 5 } }).attrs).toEqual({ level: 3 });
  });
});

describe('listas', () => {
  const v2 = {
    type: 'list',
    data: {
      style: 'unordered',
      meta: {},
      items: [
        { content: 'Primero', meta: {}, items: [{ content: 'Anidado', meta: {}, items: [] }] },
        { content: 'Segundo', meta: {}, items: [] },
      ],
    },
  };

  it('conservan el texto y el anidamiento (v2)', () => {
    const l = primero(v2);
    expect(l.type).toBe('bulletList');
    expect(texto(l.content![0].content![0])).toBe('Primero');
    expect(texto(l.content![0].content![1])).toBe('Anidado');
    expect(texto(l.content![1])).toBe('Segundo');
  });

  it('aceptan el formato viejo de strings (v1)', () => {
    const l = primero({ type: 'list', data: { style: 'ordered', items: ['uno', 'dos'] } });
    expect(l.type).toBe('orderedList');
    expect(l.content!.map(texto)).toEqual(['uno', 'dos']);
  });

  it('respetan el número de inicio', () => {
    expect(primero({ type: 'list', data: { style: 'ordered', meta: { start: 4 }, items: ['x'] } }).attrs).toEqual({ start: 4 });
  });

  it('el estilo checklist de la v2 pasa a lista de tareas', () => {
    const l = primero({
      type: 'list',
      data: { style: 'checklist', items: [{ content: 'hecho', meta: { checked: true }, items: [] }, { content: 'no', meta: { checked: false }, items: [] }] },
    });
    expect(l.type).toBe('taskList');
    expect(l.content!.map((i: any) => i.attrs.checked)).toEqual([true, false]);
  });

  it('no se ahogan con un anidamiento absurdo', () => {
    let nodo: any = { content: 'hondo', meta: {}, items: [] };
    for (let i = 0; i < 500; i++) nodo = { content: `n${i}`, meta: {}, items: [nodo] };
    expect(() => convertir({ type: 'list', data: { style: 'unordered', items: [nodo] } })).not.toThrow();
  });

  it('una lista vacía no deja un nodo inválido', () => {
    expect(convertir({ type: 'list', data: { items: 'no es un array' } }).doc.content).toEqual([{ type: 'paragraph' }]);
  });
});

describe('checklist', () => {
  it('conserva las casillas marcadas', () => {
    const l = primero({ type: 'checklist', data: { items: [{ text: 'a', checked: true }, { text: 'b', checked: false }] } });
    expect(l.content!.map((i: any) => [texto(i), i.attrs.checked])).toEqual([['a', true], ['b', false]]);
  });
});

describe('tablas', () => {
  it('conservan las celdas y la fila de cabecera', () => {
    const t = primero({ type: 'table', data: { withHeadings: true, content: [['Nombre', 'Rol'], ['avery', 'admin']] } });
    expect(t.content![0].content!.map((c: any) => c.type)).toEqual(['tableHeader', 'tableHeader']);
    expect(t.content![1].content!.map(texto)).toEqual(['avery', 'admin']);
  });

  it('rellenan las filas cortas, que ProseMirror no admite', () => {
    const t = primero({ type: 'table', data: { content: [['a', 'b'], ['c']] } });
    expect(t.content![1].content).toHaveLength(2);
  });
});

describe('código', () => {
  it('sale tal cual, sin decodificar ni escapar', () => {
    const codigo = 'if (a < b && c > d) { return "<div>&amp;"; }';
    expect(texto(primero({ type: 'code', data: { code: codigo } }))).toBe(codigo);
  });
});

describe('cita, aviso y separador', () => {
  it('la cita conserva texto y pie', () => {
    const q = primero({ type: 'quote', data: { text: 'frase', caption: 'autor' } });
    expect(q.type).toBe('blockquote');
    expect(q.content!.map(texto)).toEqual(['frase', '— autor']);
  });

  it('el aviso se convierte en cita con el título en negrita', () => {
    const q = primero({ type: 'warning', data: { title: 'Ojo', message: 'cuidado' } });
    expect(q.type).toBe('blockquote');
    expect(q.content![0].content![0].marks).toEqual([{ type: 'bold' }]);
    expect(texto(q.content![1])).toBe('cuidado');
  });

  it('el separador es una línea horizontal', () => {
    expect(primero({ type: 'delimiter', data: {} }).type).toBe('horizontalRule');
  });
});

describe('bloques desconocidos', () => {
  it('se descartan, pero se informa de cuáles', () => {
    const r = convertir(
      { type: 'paragraph', data: { text: 'ok' } },
      { type: 'raw', data: { html: '<script>alert(1)</script>' } },
      { type: 'image', data: {} },
    );
    expect(r.doc.content).toHaveLength(1);
    expect(r.dropped).toEqual(['raw', 'image']);
  });
});

describe('cargar lo que haya en la columna', () => {
  it('documento vacío para null, cadena vacía y {}', () => {
    for (const raw of [null, '', 'null', '{}']) {
      const r = loadNote(raw);
      expect(r.ok && r.doc.content).toEqual([{ type: 'paragraph' }]);
    }
  });

  it('una nota de Editor.js se convierte al vuelo y lo dice', () => {
    const r = loadNote(JSON.stringify({ time: 1, version: '2.31.6', blocks: [{ type: 'paragraph', data: { text: 'hola' } }] }));
    expect(r.ok && r.legacy).toBe(true);
  });

  it('una nota nueva se lee tal cual', () => {
    const r = loadNote(EMPTY_NOTE_JSON);
    expect(r.ok && r.legacy).toBe(false);
  });

  it('el JSON roto no se convierte en una nota vacía', () => {
    // Si se cargara vacía, el primer autoguardado la sobrescribiría con nada.
    expect(loadNote('{"blocks": [').ok).toBe(false);
    expect(loadNote('"una cadena"').ok).toBe(false);
  });
});

describe('validación en el servidor', () => {
  const doc = (...content: any[]) => ({ type: 'doc', content });

  it('conserva los párrafos vacíos: Enter + Enter sobrevive', () => {
    const r = validateNoteDoc(doc(
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
      { type: 'paragraph' },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
    ));
    expect(r.ok && r.doc.content).toHaveLength(4);
  });

  it('quita los enlaces ejecutables sin perder el texto', () => {
    const r = validateNoteDoc(doc({
      type: 'paragraph',
      content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }],
    }));
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r)).not.toContain('javascript:');
  });

  it('un enlace solo guarda su destino', () => {
    const r = validateNoteDoc(doc({
      type: 'paragraph',
      content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://a.b', target: '_self', onclick: 'x' } }] }],
    }));
    // `target` y `rel` los pone el esquema; lo que mande el cliente no cuenta.
    const attrs = r.ok ? (r.doc.content![0].content![0].marks![0].attrs as any) : {};
    expect(attrs.href).toBe('https://a.b');
    expect(attrs.target).toBe('_blank');
    expect(attrs).not.toHaveProperty('onclick');
  });

  it('descarta los bloques desconocidos de primer nivel y lo dice', () => {
    const r = validateNoteDoc(doc({ type: 'paragraph' }, { type: 'iframe' }));
    expect(r.ok && r.dropped).toEqual(['iframe']);
  });

  it('rechaza un documento hecho solo de bloques desconocidos', () => {
    expect(validateNoteDoc(doc({ type: 'iframe' })).ok).toBe(false);
  });

  it('rechaza estructuras que el esquema no admite', () => {
    // Un ítem de lista suelto en el documento.
    expect(validateNoteDoc(doc({ type: 'listItem', content: [{ type: 'paragraph' }] })).ok).toBe(false);
    // Texto vacío, que ProseMirror no permite.
    expect(validateNoteDoc(doc({ type: 'paragraph', content: [{ type: 'text', text: '' }] })).ok).toBe(false);
  });

  it('no se ahoga con un anidamiento absurdo', () => {
    let n: any = { type: 'paragraph' };
    for (let i = 0; i < 5000; i++) n = { type: 'blockquote', content: [n] };
    expect(() => validateNoteDoc(doc(n))).not.toThrow();
    expect(validateNoteDoc(doc(n)).ok).toBe(false);
  });

  it('lo que valida se puede volver a validar sin cambios', () => {
    const r = validateNoteDoc(fromEditorjs({ blocks: [
      { type: 'table', data: { withHeadings: true, content: [['a', 'b']] } },
      { type: 'list', data: { style: 'checklist', items: [{ content: 'x', meta: { checked: true }, items: [] }] } },
    ] }).doc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const otra = validateNoteDoc(JSON.parse(serializeNote(r.doc)).doc);
    expect(otra).toEqual(r);
  });
});
