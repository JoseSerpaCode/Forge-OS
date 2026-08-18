import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Qué pasa con el trabajo hecho como invitado al entrar en una cuenta real.
 *
 * Es lo más delicado que hace el producto sin avisar: alguien ha estado
 * probando, ha creado un espacio con trabajo dentro, y ahora se identifica.
 * Hacerlo mal significa **borrar trabajo real de alguien que acaba de
 * registrarse**, y no tenía ni una prueba.
 *
 * Estaba dentro del controlador de entrada, con once consultas en línea, sin
 * transacción y con un comentario final que decía «el invitado queda huérfano
 * para limpiarse luego, o simplemente bórralo si no hay restricción».
 */
const DB = path.join(process.cwd(), `forge_adopcion_${process.pid}.db`);
let db: any;
let adoptar: typeof import('../src/lib/adopcionInvitado').adoptarTrabajoDeInvitado;

beforeAll(async () => {
  fs.rmSync(DB, { force: true });
  process.env.DATABASE_URL = DB;
  process.env.NODE_ENV = 'test';
  ({ adoptarTrabajoDeInvitado: adoptar } = await import('../src/lib/adopcionInvitado'));
  db = new Database(DB);
});

afterAll(() => {
  db?.close();
  for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true });
});

beforeEach(() => {
  db.exec('DELETE FROM issues; DELETE FROM pages; DELETE FROM workspace_members; DELETE FROM workspaces; DELETE FROM users;');
  db.prepare("INSERT INTO users (id, username, password_hash, is_guest) VALUES ('inv','invitado','x',1)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, is_guest) VALUES ('real','real','x',0)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, is_guest) VALUES ('otro','otro','x',0)").run();
});

const espacio = (id: string, dueno: string) => {
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?,?,?,?)').run(id, id, id, dueno);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?,?,'owner')").run(id, dueno);
};
const ticket = (id: string, ws: string, quien: string) =>
  db.prepare(`INSERT INTO issues (id, workspace_id, type, title, status, reporter_id, assignee_id, position)
              VALUES (?,?,'task','T','todo',?,?,100000)`).run(id, ws, quien, quien);

describe('lo que se conserva', () => {
  it('el espacio pasa a ser de la cuenta real, con su trabajo', () => {
    espacio('w1', 'inv');
    ticket('i1', 'w1', 'inv');

    const r = adoptar('inv', 'real', ['w1']);
    expect(r.adoptados).toBe(1);

    expect(db.prepare("SELECT created_by FROM workspaces WHERE id='w1'").get().created_by).toBe('real');
    const i = db.prepare("SELECT reporter_id, assignee_id FROM issues WHERE id='i1'").get();
    // Se reatribuye, no se copia: el ticket es el mismo, con su historial.
    expect(i.reporter_id).toBe('real');
    expect(i.assignee_id).toBe('real');
    expect(db.prepare("SELECT ws_role FROM workspace_members WHERE workspace_id='w1' AND user_id='real'").get().ws_role).toBe('owner');
  });
});

describe('lo que se tira', () => {
  it('un espacio del invitado que no se conserva se borra', () => {
    espacio('w1', 'inv');
    espacio('w2', 'inv');
    ticket('i2', 'w2', 'inv');

    const r = adoptar('inv', 'real', ['w1']);
    expect(r.borrados).toBe(1);
    expect(db.prepare("SELECT 1 FROM workspaces WHERE id='w2'").get()).toBeUndefined();
    // Y su contenido se va con él, en cascada.
    expect(db.prepare("SELECT 1 FROM issues WHERE id='i2'").get()).toBeUndefined();
  });

  it('un espacio ajeno donde solo estaba invitado NO se borra', () => {
    // Esto es lo que no puede fallar nunca: borrar el espacio de otra persona
    // porque un invitado pasó por él.
    espacio('ajeno', 'otro');
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('ajeno','inv','editor')").run();
    ticket('i3', 'ajeno', 'otro');

    adoptar('inv', 'real', []);

    expect(db.prepare("SELECT created_by FROM workspaces WHERE id='ajeno'").get().created_by).toBe('otro');
    expect(db.prepare("SELECT 1 FROM issues WHERE id='i3'").get()).toBeTruthy();
    // Pero el invitado ya no está dentro.
    expect(db.prepare("SELECT 1 FROM workspace_members WHERE workspace_id='ajeno' AND user_id='inv'").get()).toBeUndefined();
  });
});

describe('lo que no se puede colar', () => {
  it('pedir conservar un espacio del que no era miembro no lo adopta', () => {
    /**
     * La lista de qué conservar viene en el cuerpo de la petición, o sea del
     * navegador. Sin comprobar la pertenencia, mandar un id cualquiera
     * adoptaría el espacio de otra persona.
     */
    espacio('ajeno', 'otro');

    const r = adoptar('inv', 'real', ['ajeno']);
    expect(r.adoptados).toBe(0);
    expect(db.prepare("SELECT created_by FROM workspaces WHERE id='ajeno'").get().created_by).toBe('otro');
  });

  it('una lista que no es una lista no rompe nada', () => {
    espacio('w1', 'inv');
    for (const basura of [null, undefined, 'w1', 42, { w1: true }]) {
      expect(() => adoptar('inv', 'real', basura as any)).not.toThrow();
    }
  });
});

describe('atomicidad', () => {
  it('todo va en una transacción', () => {
    /**
     * Sin ella, un fallo a mitad deja el espacio con el dueño cambiado y los
     * tickets todavía a nombre del invitado, que se borra justo después: trabajo
     * apuntando a una cuenta que ya no existe.
     */
    const src = fs.readFileSync('src/lib/adopcionInvitado.ts', 'utf-8');
    expect(src).toContain('db.transaction(');
  });
});
