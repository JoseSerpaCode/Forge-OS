import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

/**
 * Contactos sin cuenta: de quién son, a quién se puede asignar una tarea y
 * qué menciones cuentan.
 */
let tmp: string;
let db: any;
let ct: typeof import('../src/lib/contactos');
let resp: typeof import('../src/lib/responsables');
let notas: typeof import('../src/lib/notes/content');

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-contactos-'));
  process.env.DATABASE_URL = path.join(tmp, 'contactos.db');
  process.env.NODE_ENV = 'test';
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  ct = await import('../src/lib/contactos');
  resp = await import('../src/lib/responsables');
  notas = await import('../src/lib/notes/content');
  db.exec(`
    INSERT INTO users (id, username, password_hash) VALUES ('ana','ana','x'), ('beto','beto','x'), ('fuera','fuera','x');
    INSERT INTO users (id, username, password_hash, is_guest) VALUES ('inv','inv','x', 1);
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w','W','w','ana'), ('w2','W2','w2','beto');
    INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('w','ana','owner'), ('w','beto','editor'), ('w2','beto','owner');
  `);
});

afterAll(() => {
  try { db?.close(); } catch { /* cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

const crear = (owner: string, nombre: string) => {
  const r = ct.crear({ id: owner }, nombre);
  if (!r.ok) throw new Error(r.error);
  return r.contacto;
};

describe('la libreta', () => {
  it('nombre de 1 a 80, nota hasta 200, y un invitado no tiene libreta', () => {
    expect(ct.crear({ id: 'ana' }, '   ')).toEqual({ ok: false, error: 'nombre' });
    expect(ct.crear({ id: 'ana' }, 'x'.repeat(81))).toEqual({ ok: false, error: 'nombre' });
    expect(ct.crear({ id: 'ana' }, 'Luis', 'n'.repeat(201))).toEqual({ ok: false, error: 'nota' });
    expect(ct.crear({ id: 'inv', is_guest: 1 }, 'Luis')).toEqual({ ok: false, error: 'invitado' });
    const r = ct.crear({ id: 'ana' }, '  Juan   Camilo ');
    expect(r.ok && r.contacto.name).toBe('Juan Camilo');
  });

  it('nadie lista, edita ni borra los contactos de otra cuenta', () => {
    const c = crear('ana', 'Privado');
    expect(ct.listar('beto').some((x) => x.id === c.id)).toBe(false);
    expect(ct.deDueno('beto', c.id)).toBeNull();
    expect(ct.editar('beto', c.id, { name: 'Cambiado' })).toEqual({ ok: false, error: 'no_existe' });
    expect(ct.borrar('beto', c.id)).toBe(false);
    expect(ct.ficha('beto', c.id)).toBeNull();
    // Control: la dueña sí.
    expect(ct.editar('ana', c.id, { name: 'Cambiado' })).toEqual({ ok: true });
    expect(ct.borrar('ana', c.id)).toBe(true);
  });
});

describe('asignar', () => {
  it('a un miembro del espacio sí; a una cuenta de fuera no (también al editar)', () => {
    expect(resp.resolver({ workspaceId: 'w', actorId: 'ana', assignee_id: 'beto' })).toEqual({ assignee_id: 'beto', assignee_contact_id: null });
    expect(() => resp.resolver({ workspaceId: 'w', actorId: 'ana', assignee_id: 'fuera' })).toThrow();
  });

  it('a un contacto propio sí; al de otra persona no, salvo que ya lo tuviera', () => {
    const deAna = crear('ana', 'Lucía');
    expect(resp.resolver({ workspaceId: 'w', actorId: 'ana', assignee_contact_id: deAna.id })).toEqual({ assignee_id: null, assignee_contact_id: deAna.id });
    expect(() => resp.resolver({ workspaceId: 'w', actorId: 'beto', assignee_contact_id: deAna.id })).toThrow();
    // Beto puede tocar la tarea sin quitarle el contacto que ya tenía.
    expect(resp.resolver({ workspaceId: 'w', actorId: 'beto', assignee_contact_id: deAna.id, contactoActual: deAna.id }).assignee_contact_id).toBe(deAna.id);
  });

  it('nunca los dos a la vez; vacío quita el responsable', () => {
    const c = crear('ana', 'Mario');
    expect(() => resp.resolver({ workspaceId: 'w', actorId: 'ana', assignee_id: 'beto', assignee_contact_id: c.id })).toThrow();
    expect(resp.resolver({ workspaceId: 'w', actorId: 'ana', assignee_id: '' })).toEqual({ assignee_id: null, assignee_contact_id: null });
    expect(resp.resolver({ workspaceId: 'w', actorId: 'ana' })).toEqual({});
  });

  it('borrar el contacto deja sus tareas sin asignar, no las borra', () => {
    const c = crear('ana', 'Temporal');
    db.prepare("INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, assignee_contact_id) VALUES ('t-tmp','w','task','Cartel','ana','todo',?)").run(c.id);
    ct.borrar('ana', c.id);
    expect(db.prepare("SELECT assignee_contact_id FROM issues WHERE id = 't-tmp'").get()).toEqual({ assignee_contact_id: null });
  });

  it('la ficha solo enseña tareas de espacios donde la dueña sigue', () => {
    const c = crear('beto', 'Compañera');
    db.prepare("INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, assignee_contact_id) VALUES ('t-w','w','task','En W','beto','todo',?), ('t-w2','w2','task','En W2','beto','todo',?)").run(c.id, c.id);
    expect(ct.ficha('beto', c.id)!.tareas.map((t) => t.id).sort()).toEqual(['t-w', 't-w2']);
    db.prepare("DELETE FROM workspace_members WHERE workspace_id = 'w2' AND user_id = 'beto'").run();
    expect(ct.ficha('beto', c.id)!.tareas.map((t) => t.id)).toEqual(['t-w']);
  });
});

describe('menciones en notas', () => {
  const doc = (...menciones: Array<Record<string, unknown>>) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hablar con ' }, ...menciones.map((attrs) => ({ type: 'mention', attrs }))] }],
  });

  it('el servidor acepta la mención y sanea sus atributos', () => {
    const v = notas.validateNoteDoc(doc({ id: 'x', label: '  Juan  ', tipo: 'contacto', onclick: 'alert(1)' }));
    expect(v.ok).toBe(true);
    const m = (v as any).doc.content[0].content[1];
    expect(m).toEqual({ type: 'mention', attrs: { id: 'x', label: 'Juan', tipo: 'contacto' } });
  });

  it('una mención sin tipo válido se queda como texto', () => {
    const v = notas.validateNoteDoc(doc({ id: 'x', label: 'Juan', tipo: 'admin' }));
    expect(v.ok).toBe(true);
    expect(JSON.stringify((v as any).doc)).not.toContain('"mention"');
    expect(JSON.stringify((v as any).doc)).toContain('@Juan');
  });

  it('solo se indexan los contactos de quien guarda, y se conservan los de los demás', () => {
    db.exec("INSERT INTO pages (id, workspace_id, title, created_by) VALUES ('p1','w','Acta','ana')");
    const deAna = crear('ana', 'Sofía');
    const deBeto = crear('beto', 'Tomás');
    // Beto guarda primero con su contacto.
    ct.indexarMenciones('p1', doc({ id: deBeto.id, label: 'Tomás', tipo: 'contacto' }), 'beto');
    // Ana mete a mano el id del contacto de Beto y el suyo: solo cuenta el suyo.
    ct.indexarMenciones('p1', doc({ id: deAna.id, label: 'Sofía', tipo: 'contacto' }), 'ana');
    const ids = db.prepare("SELECT contact_id FROM page_mentions WHERE page_id = 'p1'").all().map((r: any) => r.contact_id).sort();
    expect(ids).toEqual([deAna.id, deBeto.id].sort());
    expect(ct.ficha('ana', deAna.id)!.notas.map((n) => n.id)).toEqual(['p1']);
    // Al quitar la mención de su contacto, Ana solo quita la suya.
    ct.indexarMenciones('p1', doc(), 'ana');
    expect(db.prepare("SELECT contact_id FROM page_mentions WHERE page_id = 'p1'").all().map((r: any) => r.contact_id)).toEqual([deBeto.id]);
  });
});
