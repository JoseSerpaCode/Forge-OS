import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Borrado permanente de una cuenta.
 *
 * Se prueba contra el esquema **real** —no uno de mentira— porque lo que hay
 * que verificar es precisamente el comportamiento de las claves ajenas: ocho
 * tablas apuntan a `users` con `NO ACTION`, así que un borrado ingenuo falla, y
 * las que están en CASCADE tienen que llevarse lo personal sin tocar lo
 * compartido. Un esquema simplificado para el test probaría otra cosa.
 *
 * Para eso se apunta `DATABASE_URL` a un archivo temporal antes de importar el
 * módulo: `db.ts` crea el esquema entero al importarse.
 */

let lib: typeof import('../src/lib/accountDeletion');
let db: any;
let tmpDir: string;

const PW = '$2b$10$abcdefghijklmnopqrstuv'; // no es válido, pero empieza por $2

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-del-'));
  process.env.DATABASE_URL = path.join(tmpDir, 'test.db');
  lib = await import('../src/lib/accountDeletion');
  db = (await import('../src/lib/db')).default;

  db.exec("INSERT INTO users (id, username, password_hash) VALUES ('u-solo', 'solo', '" + PW + "')");
  db.exec("INSERT INTO users (id, username, password_hash) VALUES ('u-equipo', 'equipo', '" + PW + "')");
  db.exec("INSERT INTO users (id, username, password_hash) VALUES ('u-companero', 'companero', '" + PW + "')");
  db.exec("INSERT INTO users (id, username, password_hash) VALUES ('u-jefe', 'jefe', '" + PW + "')");
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

function crearEspacio(id: string, tag: string, dueño: string) {
  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?, ?, ?, ?)').run(id, tag, tag, dueño);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, 'owner')").run(id, dueño);
}

function añadirMiembro(ws: string, user: string, rol = 'editor') {
  db.prepare('INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)').run(ws, user, rol);
}

describe('previsualización del borrado', () => {
  it('marca como «se borra entero» el espacio donde no queda nadie más', () => {
    crearEspacio('ws-personal', 'personal', 'u-solo');
    const p = lib.previewAccountDeletion('u-solo');
    expect(p.workspacesDeleted.map((w) => w.id)).toEqual(['ws-personal']);
    expect(p.blocking).toHaveLength(0);
    expect(lib.canDelete(p)).toBe(true);
  });

  it('bloquea si es la única propietaria de un espacio con más gente', () => {
    crearEspacio('ws-equipo', 'equipo', 'u-jefe');
    añadirMiembro('ws-equipo', 'u-companero');

    const p = lib.previewAccountDeletion('u-jefe');
    expect(p.blocking).toHaveLength(1);
    expect(p.blocking[0].otherMembers).toBe(1);
    expect(lib.canDelete(p)).toBe(false);
    // Y no toca nada: la comprobación va antes que la transacción.
    expect(() => lib.deleteAccount('u-jefe')).toThrow(lib.AccountDeletionBlocked);
    expect(db.prepare("SELECT 1 FROM users WHERE id='u-jefe'").get()).toBeTruthy();
  });

  it('no bloquea si queda otra persona con la propiedad', () => {
    añadirMiembro('ws-equipo', 'u-equipo', 'owner');
    const p = lib.previewAccountDeletion('u-jefe');
    expect(p.blocking).toHaveLength(0);
    expect(p.membershipsLeft).toBe(1);
  });

  it('no cuenta como «conservado» lo que vive en un espacio que se borra entero', () => {
    // Una cifra tranquilizadora sobre trabajo que en realidad desaparece sería
    // peor que no dar ninguna.
    db.prepare(`INSERT INTO issues (id, workspace_id, title, type, reporter_id, status)
                VALUES ('i-doomed', 'ws-personal', 'x', 'task', 'u-solo', 'todo')`).run();
    const p = lib.previewAccountDeletion('u-solo');
    expect(p.issuesReported).toBe(0);
  });
});

describe('borrado', () => {
  it('conserva el trabajo compartido con una lápida y borra lo personal', () => {
    crearEspacio('ws-vivo', 'vivo', 'u-companero');
    añadirMiembro('ws-vivo', 'u-equipo');

    db.prepare(`INSERT INTO issues (id, workspace_id, title, type, reporter_id, assignee_id, status)
                VALUES ('i-1', 'ws-vivo', 'Ticket compartido', 'task', 'u-equipo', 'u-equipo', 'todo')`).run();
    db.prepare(`INSERT INTO pages (id, workspace_id, title, created_by)
                VALUES ('p-1', 'ws-vivo', 'Página compartida', 'u-equipo')`).run();
    db.prepare(`INSERT INTO notifications (id, user_id, title, message)
                VALUES ('n-1', 'u-equipo', 'x', 'x')`).run();
    db.prepare(`INSERT INTO sessions (id, user_id, expires_at)
                VALUES ('s-1', 'u-equipo', 99999999999999)`).run();

    lib.deleteAccount('u-equipo');

    // La cuenta ya no está.
    expect(db.prepare("SELECT 1 FROM users WHERE id='u-equipo'").get()).toBeFalsy();

    // Lo personal se fue con ella.
    expect(db.prepare("SELECT 1 FROM notifications WHERE id='n-1'").get()).toBeFalsy();
    expect(db.prepare("SELECT 1 FROM sessions WHERE id='s-1'").get()).toBeFalsy();
    expect(db.prepare("SELECT 1 FROM workspace_members WHERE user_id='u-equipo'").get()).toBeFalsy();

    // El trabajo del equipo sigue ahí, con lápida.
    const issue = db.prepare("SELECT * FROM issues WHERE id='i-1'").get() as any;
    expect(issue.reporter_id).toBe(lib.TOMBSTONE_ID);
    expect(issue.title).toBe('Ticket compartido');

    // Y sin asignar, que es más útil que asignado a un fantasma.
    expect(issue.assignee_id).toBeNull();

    const page = db.prepare("SELECT * FROM pages WHERE id='p-1'").get() as any;
    expect(page.created_by).toBe(lib.TOMBSTONE_ID);
  });

  it('borra entero el espacio donde no queda nadie más', () => {
    lib.deleteAccount('u-solo');
    expect(db.prepare("SELECT 1 FROM workspaces WHERE id='ws-personal'").get()).toBeFalsy();
    // Y con él, por CASCADE, lo que tenía dentro.
    expect(db.prepare("SELECT 1 FROM issues WHERE id='i-doomed'").get()).toBeFalsy();
  });

  it('la cuenta lápida no sale en la búsqueda de personas', () => {
    // La columna `is_public` viene por defecto a 1, y la búsqueda de personas
    // filtra justo por ahí. Sin ponerlo a 0 explícitamente, «[cuenta
    // eliminada]» aparecería en las sugerencias como si fuera alguien.
    const t = db.prepare('SELECT is_public FROM users WHERE id = ?').get(lib.TOMBSTONE_ID) as any;
    expect(t.is_public).toBe(0);
  });

  it('por la cuenta lápida no se puede entrar', () => {
    const t = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(lib.TOMBSTONE_ID) as any;
    expect(t).toBeTruthy();
    // Los hashes de bcrypt empiezan por `$2`; este no, así que `compareSync`
    // devuelve falso contra cualquier contraseña.
    expect(t.password_hash.startsWith('$2')).toBe(false);
  });
});
