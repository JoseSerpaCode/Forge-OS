import { describe, it, expect } from 'vitest';
import { sanitizeEditorBlocks, sanitizeEditorBlocksDetailed } from '../src/lib/sanitizer';

/**
 * El sanitizador no tenía ni un solo test, y perdía datos en cuatro sitios.
 *
 * Los casos de abajo usan el formato **real** que emite cada plugin de
 * Editor.js instalado, no una aproximación: era justamente la diferencia entre
 * lo que el código suponía y lo que el paquete devuelve la causa de la pérdida.
 */

const one = (block: any) => sanitizeEditorBlocks([block])[0];

describe('listas', () => {
  // `@editorjs/list` v2.0.9 devuelve `{content, meta, items}`, no strings.
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

  it('conserva el texto de cada ítem', () => {
    const items = one(v2).data.items;
    expect(items[0].content).toBe('Primero');
    expect(items[1].content).toBe('Segundo');
  });

  it('conserva el anidamiento', () => {
    expect(one(v2).data.items[0].items[0].content).toBe('Anidado');
  });

  it('sigue aceptando el formato viejo de strings', () => {
    const v1 = { type: 'list', data: { style: 'ordered', items: ['uno', 'dos'] } };
    expect(one(v1).data.items).toEqual(['uno', 'dos']);
  });

  it('limpia el HTML peligroso sin vaciar el ítem', () => {
    const malo = {
      type: 'list',
      data: { style: 'unordered', meta: {}, items: [{ content: 'ok<script>alert(1)</script>', meta: {}, items: [] }] },
    };
    const c = one(malo).data.items[0].content;
    expect(c).toContain('ok');
    expect(c).not.toContain('<script');
  });

  it('no se ahoga con un anidamiento absurdo', () => {
    let nodo: any = { content: 'hondo', meta: {}, items: [] };
    for (let i = 0; i < 500; i++) nodo = { content: `n${i}`, meta: {}, items: [nodo] };
    expect(() => one({ type: 'list', data: { style: 'unordered', items: [nodo] } })).not.toThrow();
  });
});

describe('tablas', () => {
  // Estaba registrada en el editor y ausente del sanitizador: se borraba entera.
  const tabla = {
    type: 'table',
    data: { withHeadings: true, content: [['Nombre', 'Rol'], ['avery', 'admin']] },
  };

  it('ya no se descarta', () => {
    expect(sanitizeEditorBlocks([tabla])).toHaveLength(1);
  });

  it('conserva las celdas', () => {
    expect(one(tabla).data.content).toEqual([['Nombre', 'Rol'], ['avery', 'admin']]);
  });

  it('limpia cada celda', () => {
    const malo = { type: 'table', data: { content: [['<img src=x onerror=alert(1)>hola']] } };
    const celda = one(malo).data.content[0][0];
    expect(celda).toContain('hola');
    expect(celda).not.toContain('onerror');
  });
});

describe('bloques de código', () => {
  it('no re-escapa: el texto sale tal cual entró', () => {
    // El fallo acumulativo: `<` → `&lt;` → `&amp;lt;` en cada autoguardado.
    const codigo = 'if (a < b && c > d) { return "<div>"; }';
    expect(one({ type: 'code', data: { code: codigo } }).data.code).toBe(codigo);
  });

  it('guardar mil veces no cambia el contenido', () => {
    let bloque: any = { type: 'code', data: { code: 'a < b & c' } };
    for (let i = 0; i < 1000; i++) bloque = one(bloque);
    expect(bloque.data.code).toBe('a < b & c');
  });
});

describe('formato en línea', () => {
  it('conserva subrayado y saltos de línea suaves', () => {
    const p = one({ type: 'paragraph', data: { text: 'a<u>subrayado</u><br>otra línea' } });
    expect(p.data.text).toContain('<u>subrayado</u>');
    expect(p.data.text).toContain('<br');
  });

  it('sigue quitando lo peligroso', () => {
    const p = one({ type: 'paragraph', data: { text: '<script>alert(1)</script><b>ok</b>' } });
    expect(p.data.text).toBe('<b>ok</b>');
  });

  it('quita los href con esquemas ejecutables', () => {
    const p = one({ type: 'paragraph', data: { text: '<a href="javascript:alert(1)">x</a>' } });
    expect(p.data.text).not.toContain('javascript:');
  });
});

describe('bloques desconocidos', () => {
  it('se descartan, pero se informa de cuáles', () => {
    const r = sanitizeEditorBlocksDetailed([
      { type: 'paragraph', data: { text: 'ok' } },
      { type: 'raw', data: { html: '<script>alert(1)</script>' } },
      { type: 'inventado', data: {} },
    ]);
    expect(r.blocks).toHaveLength(1);
    expect(r.dropped).toEqual(['raw', 'inventado']);
  });

  it('sin descartes, la lista viene vacía', () => {
    expect(sanitizeEditorBlocksDetailed([{ type: 'paragraph', data: { text: 'a' } }]).dropped).toEqual([]);
  });
});

describe('entradas rotas', () => {
  it('no revienta con datos ausentes o de otro tipo', () => {
    expect(() => sanitizeEditorBlocks(null as any)).not.toThrow();
    expect(sanitizeEditorBlocks(null as any)).toEqual([]);
    expect(one({ type: 'list', data: { items: 'no es un array' } }).data.items).toEqual([]);
    expect(one({ type: 'paragraph', data: {} }).data.text).toBe('');
  });
});
