import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Mover notas en el árbol.
 *
 * Lo que más importa es lo que **no** se debe poder hacer: colgar una nota de
 * otro espacio o de su propia hija. Las dos cosas las impide el servidor; el
 * cliente solo deja de ofrecerlas.
 */

const DB = path.join(process.cwd(), `forge_arbol_${process.pid}.db`);
let db: any;
let arbol: typeof import('../src/lib/arbolPaginas');

beforeAll(async () => {
  process.env.DATABASE_URL = DB;
  process.env.NODE_ENV = 'test';
  arbol = await import('../src/lib/arbolPaginas');
  db = new Database(DB);
  // Las notas de prueba cuelgan de un espacio y una cuenta que no hace falta
  // crear: solo en esta conexión, la que prepara los datos.
  db.pragma('foreign_keys = OFF');
});

afterAll(() => {
  db?.close();
  for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true });
});

const nota = (id: string, padre: string | null, posicion: number, ws = 'ws-a') =>
  db
    .prepare(
      `INSERT INTO pages (id, workspace_id, parent_page_id, title, content_json, created_by, position)
       VALUES (?, ?, ?, ?, '{}', 'u-1', ?)`
    )
    .run(id, ws, padre, id, posicion);

/** Los hijos de `padre`, en orden. */
const hijos = (padre: string | null, ws = 'ws-a') =>
  (
    db
      .prepare('SELECT id FROM pages WHERE workspace_id = ? AND parent_page_id IS ? ORDER BY position')
      .all(ws, padre) as Array<{ id: string }>
  ).map((f) => f.id);

beforeEach(() => {
  db.prepare('DELETE FROM pages').run();
  // ws-a:  a, b (con b1, b2), c        ws-b:  ajena
  nota('a', null, 1000);
  nota('b', null, 2000);
  nota('b1', 'b', 1000);
  nota('b2', 'b', 2000);
  nota('c', null, 3000);
  nota('ajena', null, 1000, 'ws-b');
});

describe('reordenar dentro del mismo nivel', () => {
  it('lleva la última al principio', () => {
    expect(arbol.moverPagina('ws-a', 'c', null, 0)).toEqual({ ok: true });
    expect(hijos(null)).toEqual(['c', 'a', 'b']);
  });

  it('un índice fuera de rango se queda en el extremo, no falla', () => {
    expect(arbol.moverPagina('ws-a', 'a', null, 99).ok).toBe(true);
    expect(hijos(null)).toEqual(['b', 'c', 'a']);
    expect(arbol.moverPagina('ws-a', 'a', null, -5).ok).toBe(true);
    expect(hijos(null)).toEqual(['a', 'b', 'c']);
  });

  it('renumbera el nivel con posiciones enteras', () => {
    arbol.moverPagina('ws-a', 'c', null, 1);
    const pos = db.prepare('SELECT position FROM pages WHERE parent_page_id IS NULL AND workspace_id = ? ORDER BY position').all('ws-a').map((f: any) => f.position);
    expect(pos).toEqual([1000, 2000, 3000]);
  });
});

describe('meter una nota dentro de otra', () => {
  it('la convierte en subpágina, en el sitio pedido', () => {
    expect(arbol.moverPagina('ws-a', 'c', 'b', 1).ok).toBe(true);
    expect(hijos('b')).toEqual(['b1', 'c', 'b2']);
    expect(hijos(null)).toEqual(['a', 'b']);
  });

  it('se lleva a sus propias subpáginas con ella', () => {
    expect(arbol.moverPagina('ws-a', 'b', 'a', 0).ok).toBe(true);
    expect(hijos('a')).toEqual(['b']);
    expect(hijos('b')).toEqual(['b1', 'b2']);
  });

  it('sacarla a la raíz con null', () => {
    expect(arbol.moverPagina('ws-a', 'b2', null, 0).ok).toBe(true);
    expect(hijos(null)).toEqual(['b2', 'a', 'b', 'c']);
    expect(hijos('b')).toEqual(['b1']);
  });
});

describe('lo que no se puede', () => {
  it('meter una nota dentro de sí misma', () => {
    expect(arbol.moverPagina('ws-a', 'b', 'b', 0)).toEqual({ ok: false, error: 'cycle' });
  });

  it('meter una nota dentro de su propia hija', () => {
    // Quedaría desenganchada del árbol, con todo lo que cuelga de ella.
    expect(arbol.moverPagina('ws-a', 'b', 'b1', 0)).toEqual({ ok: false, error: 'cycle' });
    expect(hijos(null)).toEqual(['a', 'b', 'c']);
  });

  it('colgarla de una nota de otro espacio', () => {
    expect(arbol.moverPagina('ws-a', 'a', 'ajena', 0)).toEqual({ ok: false, error: 'parent_not_found' });
  });

  it('mover una nota de otro espacio', () => {
    expect(arbol.moverPagina('ws-a', 'ajena', null, 0)).toEqual({ ok: false, error: 'not_found' });
    expect(hijos(null, 'ws-b')).toEqual(['ajena']);
  });

  it('un ciclo que ya estuviera en la base no cuelga el servidor', () => {
    db.prepare("UPDATE pages SET parent_page_id = 'b2' WHERE id = 'b'").run();
    expect(() => arbol.moverPagina('ws-a', 'a', 'b1', 0)).not.toThrow();
  });
});

describe('notas nuevas', () => {
  it('van al final de su nivel', () => {
    expect(arbol.posicionAlFinal('ws-a', null)).toBe(4000);
    expect(arbol.posicionAlFinal('ws-a', 'b')).toBe(3000);
    expect(arbol.posicionAlFinal('ws-a', 'a')).toBe(1000);
  });
});
