import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Tipos de ticket propios.
 *
 * El caso que decide si esto está bien hecho es el **borrado**: qué pasa con
 * los tickets que ya son de ese tipo. Dejarlos apuntando a una clave muerta no
 * da ningún error —el tablero carga, las tarjetas salen sin insignia— y por eso
 * es la forma más fácil de romperlo sin enterarse.
 */

const DB = path.join(process.cwd(), `forge_tipos_${process.pid}.db`);
let db: any;
let tipos: typeof import('../src/lib/issueTypes');

beforeAll(async () => {
  fs.rmSync(DB, { force: true });
  process.env.DATABASE_URL = DB;
  process.env.NODE_ENV = 'test';
  tipos = await import('../src/lib/issueTypes');
  db = new Database(DB);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES ('u1','tipos_uno','x')").run();
  db.prepare("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('ws-t','T','ws-t','u1')").run();
  db.prepare("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('ws-otro','O','ws-otro','u1')").run();
});

afterAll(() => {
  db?.close();
  for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true });
});

beforeEach(() => {
  db.exec("DELETE FROM issues; DELETE FROM issue_types;");
});

const ticket = (tipo: string, ws = 'ws-t') => {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, position)
              VALUES (?, ?, ?, 'X', 'todo', 'u1', 100000)`).run(id, ws, tipo);
  return id;
};

describe('siembra', () => {
  it('un espacio sin tipos recibe los cuatro de siempre al consultarlos', () => {
    // Si devolviera una lista vacía, el desplegable de nuevo ticket se quedaría
    // sin una sola opción y no se podría crear nada.
    const lista = tipos.listar('ws-t');
    expect(lista.map((t) => t.key)).toEqual(['task', 'bug', 'story', 'epic']);
    expect(lista.every((t) => t.isBuiltin)).toBe(true);
  });

  it('no los siembra dos veces', () => {
    tipos.listar('ws-t');
    tipos.listar('ws-t');
    expect(tipos.listar('ws-t')).toHaveLength(4);
  });
});

describe('claves', () => {
  it('quita acentos: la clave acaba en URLs y en atributos', () => {
    expect(tipos.claveDesdeNombre('Incidencia Crítica')).toBe('incidencia-critica');
    expect(tipos.claveDesdeNombre('Mantenimiento  preventivo')).toBe('mantenimiento-preventivo');
  });

  it('un nombre sin letras no da una clave vacía', () => {
    // Dos claves vacías chocarían entre sí.
    const a = tipos.claveDesdeNombre('🔥🔥');
    const b = tipos.claveDesdeNombre('...');
    expect(a).not.toBe('');
    expect(a).not.toBe(b);
  });

  it('nombres distintos que dan la misma clave no chocan', () => {
    tipos.listar('ws-t');
    const uno = tipos.crear('ws-t', 'Cosa-1', '#E5484D');
    const dos = tipos.crear('ws-t', 'Cosa 1', '#30A46C');
    expect(uno.ok && dos.ok).toBe(true);
    if (uno.ok && dos.ok) expect(uno.tipo.key).not.toBe(dos.tipo.key);
  });
});

describe('alta', () => {
  beforeEach(() => tipos.listar('ws-t'));

  it('crea con nombre y color', () => {
    const r = tipos.crear('ws-t', '  Incidencia  ', '#E5484D');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tipo.name).toBe('Incidencia');
      expect(r.tipo.color).toBe('#E5484D');
      expect(r.tipo.isBuiltin).toBe(false);
    }
  });

  it('rechaza el nombre vacío y el demasiado largo', () => {
    expect(tipos.crear('ws-t', '   ', '#E5484D')).toMatchObject({ ok: false, error: 'nombre_vacio' });
    expect(tipos.crear('ws-t', 'x'.repeat(31), '#E5484D')).toMatchObject({ ok: false, error: 'nombre_largo' });
  });

  it('un color fuera de la paleta cae al de por defecto en vez de fallar', () => {
    const r = tipos.crear('ws-t', 'Con color raro', 'javascript:alert(1)');
    expect(r.ok).toBe(true);
    if (r.ok) expect(tipos.COLORES).toContain(r.tipo.color as any);
  });

  it('no deja dos con el mismo nombre, ni cambiando mayúsculas', () => {
    tipos.crear('ws-t', 'Incidencia', '#E5484D');
    expect(tipos.crear('ws-t', 'incidencia', '#30A46C')).toMatchObject({ ok: false, error: 'repetido' });
  });

  it('otro espacio sí puede tener uno que se llame igual', () => {
    tipos.listar('ws-otro');
    tipos.crear('ws-t', 'Incidencia', '#E5484D');
    expect(tipos.crear('ws-otro', 'Incidencia', '#E5484D').ok).toBe(true);
  });

  it('hay un tope', () => {
    for (let i = 0; i < 16; i++) tipos.crear('ws-t', `Tipo ${i}`, '#E5484D');
    expect(tipos.crear('ws-t', 'Uno más', '#E5484D')).toMatchObject({ ok: false, error: 'demasiados' });
  });
});

describe('edición', () => {
  beforeEach(() => tipos.listar('ws-t'));

  it('renombrar NO cambia la clave, que es lo que llevan escrito los tickets', () => {
    const antes = tipos.listar('ws-t').find((t) => t.key === 'task')!;
    ticket('task');
    ticket('task');

    tipos.editar(antes.id, 'ws-t', { name: 'Tarea' });

    const despues = tipos.listar('ws-t').find((t) => t.id === antes.id)!;
    expect(despues.name).toBe('Tarea');
    expect(despues.key).toBe('task');
    // Los dos tickets siguen teniendo tipo.
    expect(db.prepare("SELECT COUNT(*) n FROM issues WHERE type = 'task'").get().n).toBe(2);
  });

  it('no deja renombrar a uno que ya existe', () => {
    expect(tipos.editar(
      tipos.listar('ws-t').find((t) => t.key === 'bug')!.id, 'ws-t', { name: 'Task' }
    )).toMatchObject({ ok: false, error: 'repetido' });
  });

  it('un id de otro espacio no se puede editar', () => {
    tipos.listar('ws-otro');
    const ajeno = tipos.listar('ws-otro')[0];
    expect(tipos.editar(ajeno.id, 'ws-t', { name: 'Robado' })).toMatchObject({ ok: false, error: 'no_existe' });
  });
});

describe('borrado: qué pasa con los tickets que ya son de ese tipo', () => {
  beforeEach(() => tipos.listar('ws-t'));

  it('sin usar, se borra sin más', () => {
    const epic = tipos.listar('ws-t').find((t) => t.key === 'epic')!;
    expect(tipos.borrar(epic.id, 'ws-t')).toMatchObject({ ok: true, movidos: 0 });
    expect(tipos.listar('ws-t').map((t) => t.key)).not.toContain('epic');
  });

  it('en uso y sin sustituto: se niega y dice cuántos son', () => {
    const bug = tipos.listar('ws-t').find((t) => t.key === 'bug')!;
    ticket('bug'); ticket('bug'); ticket('bug');
    expect(tipos.borrar(bug.id, 'ws-t')).toMatchObject({ ok: false, error: 'en_uso', enUso: 3 });
    // Y no ha borrado nada.
    expect(tipos.listar('ws-t').map((t) => t.key)).toContain('bug');
  });

  it('con sustituto, los tickets se mueven y ninguno queda huérfano', () => {
    const bug = tipos.listar('ws-t').find((t) => t.key === 'bug')!;
    ticket('bug'); ticket('bug');
    ticket('task');

    expect(tipos.borrar(bug.id, 'ws-t', 'task')).toMatchObject({ ok: true, movidos: 2 });
    expect(db.prepare("SELECT COUNT(*) n FROM issues WHERE type = 'bug'").get().n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM issues WHERE type = 'task'").get().n).toBe(3);

    // Ni un solo ticket apuntando a un tipo que no existe.
    const claves = new Set(tipos.listar('ws-t').map((t) => t.key));
    const huerfanos = db.prepare('SELECT DISTINCT type FROM issues WHERE workspace_id = ?')
      .all('ws-t').filter((r: any) => !claves.has(r.type));
    expect(huerfanos).toEqual([]);
  });

  it('el sustituto no puede ser el que se borra ni uno de otro espacio', () => {
    const bug = tipos.listar('ws-t').find((t) => t.key === 'bug')!;
    ticket('bug');
    expect(tipos.borrar(bug.id, 'ws-t', 'bug')).toMatchObject({ ok: false, error: 'sustituto_invalido' });
    expect(tipos.borrar(bug.id, 'ws-t', 'no-existe')).toMatchObject({ ok: false, error: 'sustituto_invalido' });
  });

  it('no se puede borrar el último: sin tipos no se pueden crear tickets', () => {
    const lista = tipos.listar('ws-t');
    for (const t of lista.slice(0, 3)) tipos.borrar(t.id, 'ws-t');
    expect(tipos.listar('ws-t')).toHaveLength(1);
    expect(tipos.borrar(tipos.listar('ws-t')[0].id, 'ws-t')).toMatchObject({ ok: false, error: 'ultimo' });
  });

  it('los tickets de otro espacio con la misma clave no se tocan', () => {
    tipos.listar('ws-otro');
    ticket('bug', 'ws-otro');
    ticket('bug', 'ws-t');
    const bug = tipos.listar('ws-t').find((t) => t.key === 'bug')!;

    tipos.borrar(bug.id, 'ws-t', 'task');
    expect(db.prepare("SELECT COUNT(*) n FROM issues WHERE workspace_id='ws-otro' AND type='bug'").get().n).toBe(1);
  });
});

describe('orden', () => {
  beforeEach(() => tipos.listar('ws-t'));

  it('reordenar cambia el orden del desplegable', () => {
    const antes = tipos.listar('ws-t');
    const alReves = [...antes].reverse().map((t) => t.id);
    expect(tipos.reordenar('ws-t', alReves)).toBe(true);
    expect(tipos.listar('ws-t').map((t) => t.key)).toEqual(['epic', 'story', 'bug', 'task']);
  });

  it('un id ajeno colado en la lista no mueve nada', () => {
    tipos.listar('ws-otro');
    const ajeno = tipos.listar('ws-otro')[0];
    const antes = tipos.listar('ws-t').map((t) => t.key);
    expect(tipos.reordenar('ws-t', [ajeno.id, ...tipos.listar('ws-t').map((t) => t.id)])).toBe(false);
    expect(tipos.listar('ws-t').map((t) => t.key)).toEqual(antes);
  });
});
