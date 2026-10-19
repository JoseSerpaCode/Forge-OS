import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Tareas que se repiten, contra el esquema real.
 *
 * Lo delicado no es calcular la fecha (eso lo cubre `recurrencia.test.ts`)
 * sino lo que pasa alrededor: una sola siguiente aunque se complete dos veces,
 * que la siguiente lleve lo que tiene que llevar, y deshacerla al reabrir solo
 * si nadie la ha tocado.
 */

let tmp: string;
let db: any;
let IssueService: typeof import('../src/lib/IssueService').IssueService;

const nueva = (id: string, extra = '') => db.exec(`
  INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, due_date, recurrence${extra ? ', ' + extra.split('=')[0] : ''})
  VALUES ('${id}', 'w', 'task', 'Lectura', 'u', 'todo', '2026-10-19', 'w:1:MO'${extra ? ", '" + extra.split('=')[1] + "'" : ''});
`);

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-recurrentes-'));
  process.env.DATABASE_URL = path.join(tmp, 'rec.db');
  process.env.NODE_ENV = 'test';
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  IssueService = (await import('../src/lib/IssueService')).IssueService;
  db.exec(`
    INSERT INTO users (id, username, password_hash) VALUES ('u','duena','x');
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w','W','w','u');
    INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('w','u','owner');
    INSERT INTO labels (id, workspace_id, name, color) VALUES ('l','w','Cálculo','#FF5D00');
    INSERT INTO pages (id, workspace_id, title, created_by) VALUES ('p','w','Tema 1','u');
  `);
});

afterAll(() => {
  try { db?.close(); } catch { /* cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

const fila = (id: string) => db.prepare('SELECT * FROM issues WHERE id = ?').get(id);

describe('completar crea la siguiente', () => {
  it('con la fecha que toca, sus etiquetas, apuntes y subtareas pendientes; la regla pasa a ella', async () => {
    nueva('r1');
    db.exec("INSERT INTO issue_labels (issue_id, label_id) VALUES ('r1','l'); INSERT INTO issue_page_links (issue_id, page_id, linked_by) VALUES ('r1','p','u');");
    const sub = IssueService.crearSubtarea('r1', 'Resumen', 'u', 0);
    db.prepare("UPDATE issues SET status = 'done' WHERE id = ?").run(sub.id);

    await IssueService.update('r1', { status: 'done' } as any, 'u', 0, 'duena');
    const original = fila('r1');
    expect(original.recurrence).toBeNull();
    expect(original.next_issue_id).toBeTruthy();

    const sig = fila(original.next_issue_id);
    expect(sig.recurrence).toBe('w:1:MO');
    expect(sig.status).toBe('todo');
    expect(sig.due_date > '2026-10-19').toBe(true);
    expect(new Date(`${sig.due_date}T12:00:00Z`).getUTCDay()).toBe(1);
    expect(db.prepare('SELECT label_id FROM issue_labels WHERE issue_id = ?').all(sig.id)).toEqual([{ label_id: 'l' }]);
    expect(db.prepare('SELECT page_id FROM issue_page_links WHERE issue_id = ?').all(sig.id)).toEqual([{ page_id: 'p' }]);
    expect(db.prepare('SELECT title, status FROM issues WHERE parent_issue_id = ?').all(sig.id)).toEqual([{ title: 'Resumen', status: 'todo' }]);
  });

  it('completar dos veces seguidas crea una sola', () => {
    nueva('r2');
    db.prepare("UPDATE issues SET status = 'done' WHERE id = 'r2'").run();
    const antes = db.prepare('SELECT COUNT(*) AS n FROM issues').get().n;
    IssueService.trasCambioDeEstado('r2', 'todo', 'done', 'u');
    IssueService.trasCambioDeEstado('r2', 'todo', 'done', 'u');
    expect(db.prepare('SELECT COUNT(*) AS n FROM issues').get().n).toBe(antes + 1);
  });
});

describe('reabrir', () => {
  it('con la siguiente intacta, la borra y la regla vuelve', async () => {
    nueva('r3');
    await IssueService.update('r3', { status: 'done' } as any, 'u', 0, 'duena');
    const sig = fila('r3').next_issue_id;
    await IssueService.update('r3', { status: 'todo' } as any, 'u', 0, 'duena');
    expect(fila(sig)).toBeUndefined();
    expect(fila('r3')).toMatchObject({ recurrence: 'w:1:MO', next_issue_id: null });
  });

  it('con la siguiente ya tocada, la conserva', async () => {
    nueva('r4');
    await IssueService.update('r4', { status: 'done' } as any, 'u', 0, 'duena');
    const sig = fila('r4').next_issue_id;
    db.prepare("UPDATE issues SET title = 'Lectura editada', updated_at = datetime('now', '+1 minute') WHERE id = ?").run(sig);
    await IssueService.update('r4', { status: 'todo' } as any, 'u', 0, 'duena');
    expect(fila(sig)).toBeTruthy();
    expect(fila('r4').recurrence).toBeNull();
  });
});

describe('validación', () => {
  it('una regla mala o sin fecha es 400', async () => {
    await expect(IssueService.create({ workspace_id: 'w', title: 'X', recurrence: 'cada lunes', due_date: '2026-10-19' } as any, 'u', 0)).rejects.toMatchObject({ statusCode: 400 });
    await expect(IssueService.create({ workspace_id: 'w', title: 'X', recurrence: 'w:1:MO' } as any, 'u', 0)).rejects.toMatchObject({ statusCode: 400 });
    db.exec("INSERT INTO issues (id, workspace_id, type, title, reporter_id, status) VALUES ('sinfecha','w','task','Sin fecha','u','todo')");
    await expect(IssueService.update('sinfecha', { recurrence: 'd:1' } as any, 'u', 0, 'duena')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('con día de trabajo', () => {
  it('la siguiente conserva la misma distancia entre trabajo y entrega', async () => {
    db.exec("INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, due_date, planned_date, recurrence) VALUES ('r5','w','task','Informe','u','todo','2026-10-23','2026-10-20','w:1:FR')");
    await IssueService.update('r5', { status: 'done' } as any, 'u', 0, 'duena');
    const sig = fila(fila('r5').next_issue_id);
    const dias = (Date.parse(`${sig.due_date}T00:00:00Z`) - Date.parse(`${sig.planned_date}T00:00:00Z`)) / 86_400_000;
    expect(dias).toBe(3);
  });
  it('un día de trabajo imposible es 400', async () => {
    await expect(IssueService.update('r5', { planned_date: '2026-02-30' } as any, 'u', 0, 'duena')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('la siguiente solo se borra si de verdad nadie la tocó', () => {
  const completarYReabrir = async (id: string, tocar: (sig: string) => void) => {
    await IssueService.update(id, { status: 'done' } as any, 'u', 0, 'duena');
    const sig = fila(id).next_issue_id;
    tocar(sig);
    await IssueService.update(id, { status: 'todo' } as any, 'u', 0, 'duena');
    return sig;
  };

  it('con una subtarea marcada, se conserva', async () => {
    nueva('t1');
    IssueService.crearSubtarea('t1', 'Paso', 'u', 0);
    const sig = await completarYReabrir('t1', (s) => db.prepare("UPDATE issues SET status = 'done' WHERE parent_issue_id = ?").run(s));
    expect(fila(sig)).toBeTruthy();
  });

  it('con una etiqueta añadida, se conserva', async () => {
    nueva('t2');
    const sig = await completarYReabrir('t2', (s) => db.prepare("INSERT INTO issue_labels (issue_id, label_id) VALUES (?, 'l')").run(s));
    expect(fila(sig)).toBeTruthy();
  });

  it('con un apunte vinculado, se conserva', async () => {
    nueva('t3');
    const sig = await completarYReabrir('t3', (s) => db.prepare("INSERT INTO issue_page_links (issue_id, page_id, linked_by) VALUES (?, 'p', 'u')").run(s));
    expect(fila(sig)).toBeTruthy();
  });

  it('control: sin tocar nada, se borra', async () => {
    nueva('t4');
    const sig = await completarYReabrir('t4', () => {});
    expect(fila(sig)).toBeUndefined();
  });
});

describe('el «hoy» de la repetición es el de quien la completa', () => {
  it('una diaria completada a las 21:00 en Bogotá cuenta desde el día de Bogotá, no desde el de UTC', () => {
    db.exec(`
      UPDATE users SET timezone = 'America/Bogota' WHERE id = 'u';
      INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, due_date, recurrence)
        VALUES ('z1','w','task','Diaria','u','done','2026-10-10','d:1');
    `);
    // 02:00 UTC del 20 = 21:00 del 19 en Bogotá.
    const r = IssueService.trasCambioDeEstado('z1', 'todo', 'done', 'u', new Date('2026-10-20T02:00:00Z'));
    expect(r.creada?.due_date).toBe('2026-10-20');
  });
});
