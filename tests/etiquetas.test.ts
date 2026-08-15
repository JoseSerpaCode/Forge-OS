import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';

/**
 * Etiquetas.
 *
 * Se prueba contra el esquema real porque lo que hay que verificar es
 * justamente lo que hace la base: el índice único que impide dos «Urgente» en
 * el mismo espacio, y el CASCADE que quita la etiqueta de todo lo que la lleva
 * cuando se borra. Un esquema simplificado probaría otra cosa.
 */

let lib: typeof import('../src/lib/labels');
let db: any, tmp: string;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-lbl-'));
  process.env.DATABASE_URL = path.join(tmp, 'lbl.db');
  lib = await import('../src/lib/labels');
  db = (await import('../src/lib/db')).default;

  db.exec("INSERT INTO users (id, username, password_hash) VALUES ('u1', 'uno', 'x')");
  db.exec("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w1', 'Uno', 'uno', 'u1')");
  db.exec("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w2', 'Dos', 'dos', 'u1')");
  db.exec("INSERT INTO issues (id, workspace_id, title, type, status, reporter_id) VALUES ('i1', 'w1', 'Uno', 'task', 'todo', 'u1')");
  db.exec("INSERT INTO issues (id, workspace_id, title, type, status, reporter_id) VALUES ('i-ajeno', 'w2', 'Ajeno', 'task', 'todo', 'u1')");
  db.exec("INSERT INTO pages (id, workspace_id, title, created_by) VALUES ('p1', 'w1', 'Pagina', 'u1')");
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe('alta', () => {
  it('crea y devuelve la etiqueta', () => {
    const r = lib.crear('w1', 'Urgente', '#E5484D');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.etiqueta.name).toBe('Urgente');
      expect(r.etiqueta.color).toBe('#E5484D');
    }
  });

  it('limpia el nombre y no admite el vacío', () => {
    const r = lib.crear('w1', '  Dos   espacios  ', undefined);
    expect(r.ok && r.etiqueta.name).toBe('Dos espacios');
    expect(lib.crear('w1', '   ', undefined)).toEqual({ ok: false, error: 'required' });
    expect(lib.crear('w1', 42 as any, undefined)).toEqual({ ok: false, error: 'required' });
  });

  it('no deja repetir el nombre, ni cambiando mayúsculas', () => {
    // «Urgente» y «urgente» son la misma para cualquiera que las lea; tenerlas
    // separadas solo reparte lo mismo en dos sitios.
    expect(lib.crear('w1', 'Urgente', undefined)).toEqual({ ok: false, error: 'duplicate' });
    expect(lib.crear('w1', 'URGENTE', undefined)).toEqual({ ok: false, error: 'duplicate' });
  });

  it('el mismo nombre sí puede existir en otro espacio', () => {
    expect(lib.crear('w2', 'Urgente', undefined).ok).toBe(true);
  });

  it('rechaza colores que no son de la paleta', () => {
    expect(lib.crear('w1', 'Rara', '#123456')).toEqual({ ok: false, error: 'bad_color' });
    expect(lib.crear('w1', 'Rara', 'red; background: url(x)')).toEqual({ ok: false, error: 'bad_color' });
  });

  it('rechaza nombres kilométricos', () => {
    expect(lib.crear('w1', 'x'.repeat(41), undefined)).toEqual({ ok: false, error: 'too_long' });
  });
});

describe('edición', () => {
  it('cambia nombre y color', () => {
    const r = lib.crear('w1', 'Provisional', undefined);
    const id = r.ok ? r.etiqueta.id : '';
    expect(lib.editar(id, 'w1', { name: 'Definitiva', color: '#0091FF' })).toEqual({ ok: true });

    const guardada = lib.listar('w1').find((e) => e.id === id)!;
    expect(guardada.name).toBe('Definitiva');
    expect(guardada.color).toBe('#0091FF');
  });

  it('no toca una etiqueta de otro espacio', () => {
    const ajena = lib.listar('w2')[0];
    // Aunque el id sea correcto, el espacio de la ruta manda: si no, bastaría
    // con conocer el id para renombrar etiquetas de otro equipo.
    expect(lib.editar(ajena.id, 'w1', { name: 'Colada' })).toEqual({ ok: false, error: 'not_found' });
    expect(lib.listar('w2').find((e) => e.id === ajena.id)!.name).toBe(ajena.name);
  });
});

describe('asignación', () => {
  let urgente: string;

  beforeAll(() => {
    urgente = lib.listar('w1').find((e) => e.name === 'Urgente')!.id;
  });

  it('pone y quita en un ticket', () => {
    expect(lib.asignar(urgente, 'w1', 'issue', 'i1')).toEqual({ ok: true });
    expect(lib.deEntidad('issue', 'i1').map((e) => e.id)).toEqual([urgente]);

    expect(lib.quitar(urgente, 'w1', 'issue', 'i1')).toEqual({ ok: true });
    expect(lib.deEntidad('issue', 'i1')).toEqual([]);
  });

  it('ponerla dos veces no la duplica', () => {
    lib.asignar(urgente, 'w1', 'issue', 'i1');
    lib.asignar(urgente, 'w1', 'issue', 'i1');
    expect(lib.deEntidad('issue', 'i1')).toHaveLength(1);
  });

  it('la misma etiqueta vale para una página', () => {
    expect(lib.asignar(urgente, 'w1', 'page', 'p1')).toEqual({ ok: true });
    expect(lib.deEntidad('page', 'p1').map((e) => e.name)).toEqual(['Urgente']);
  });

  it('no se puede colgar de algo de otro espacio', () => {
    // El ataque concreto: etiquetar un ticket ajeno sabiendo su id, y que
    // aparezca en el tablero de otro equipo.
    expect(lib.asignar(urgente, 'w1', 'issue', 'i-ajeno')).toEqual({ ok: false, error: 'entity_not_here' });
    expect(lib.deEntidad('issue', 'i-ajeno')).toEqual([]);
  });

  it('no se puede usar una etiqueta de otro espacio', () => {
    const ajena = lib.listar('w2')[0].id;
    expect(lib.asignar(ajena, 'w1', 'issue', 'i1')).toEqual({ ok: false, error: 'label_not_here' });
  });
});

describe('recuento y borrado', () => {
  it('cuenta dónde está puesta, sumando tickets y páginas', () => {
    const urgente = lib.listar('w1').find((e) => e.name === 'Urgente')!;
    // Un ticket y una página, de las pruebas de arriba.
    expect(urgente.usos).toBe(2);
  });

  it('al borrarla desaparece de todo, y no se lleva nada más por delante', () => {
    const urgente = lib.listar('w1').find((e) => e.name === 'Urgente')!.id;
    expect(lib.borrar(urgente, 'w1')).toBe(true);

    expect(lib.deEntidad('issue', 'i1')).toEqual([]);
    expect(lib.deEntidad('page', 'p1')).toEqual([]);
    // El ticket y la página siguen ahí: se borró la etiqueta, no lo etiquetado.
    expect(db.prepare("SELECT 1 FROM issues WHERE id='i1'").get()).toBeTruthy();
    expect(db.prepare("SELECT 1 FROM pages WHERE id='p1'").get()).toBeTruthy();
  });

  it('no borra la de otro espacio', () => {
    const ajena = lib.listar('w2')[0].id;
    expect(lib.borrar(ajena, 'w1')).toBe(false);
    expect(lib.listar('w2').some((e) => e.id === ajena)).toBe(true);
  });
});

describe('deVarias', () => {
  it('reparte las etiquetas de muchas cosas en una sola consulta', () => {
    const a = lib.crear('w1', 'Una', undefined);
    const b = lib.crear('w1', 'Otra', undefined);
    const idA = a.ok ? a.etiqueta.id : '';
    const idB = b.ok ? b.etiqueta.id : '';
    lib.asignar(idA, 'w1', 'issue', 'i1');
    lib.asignar(idB, 'w1', 'issue', 'i1');

    const mapa = lib.deVarias('issue', ['i1', 'i-ajeno']);
    expect(mapa.get('i1')!.map((e) => e.name).sort()).toEqual(['Otra', 'Una']);
    // Lo que no tiene etiquetas no aparece, en vez de traer una lista vacía.
    expect(mapa.has('i-ajeno')).toBe(false);
  });

  it('con la lista vacía no consulta nada', () => {
    expect(lib.deVarias('issue', []).size).toBe(0);
  });
});
