import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Duplicar un ticket.
 *
 * Lo que se comprueba es sobre todo lo que **no** se copia. Copiar de más es
 * fácil de escribir y difícil de ver: unas horas registradas que se arrastran
 * no dan ningún error, simplemente hacen que el sprint diga que se trabajaron
 * horas que nadie trabajó.
 */

const DB = path.join(process.cwd(), `forge_dup_${process.pid}.db`);
let db: any;
let IssueService: any;

beforeAll(async () => {
  process.env.DATABASE_URL = DB;
  process.env.NODE_ENV = 'test';
  ({ IssueService } = await import('../src/lib/IssueService'));
  db = new Database(DB);
});

afterAll(() => {
  db?.close();
  for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true });
});

const nuevo = (extra: Record<string, unknown> = {}) => {
  const id = crypto.randomUUID();
  const base: Record<string, unknown> = {
    id, workspace_id: 'ws-dup', sprint_id: null, parent_issue_id: null,
    type: 'task', title: 'Informe semanal', description: 'Cuerpo',
    status: 'todo', priority: 'high', story_points: 5,
    estimated_hours: 8, logged_hours: 0, position: 100000,
    reporter_id: 'u-uno', assignee_id: null, due_date: null, ...extra,
  };
  const cols = Object.keys(base);
  db.prepare(
    `INSERT INTO issues (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  ).run(...cols.map((c) => base[c]));
  return id;
};

beforeAll(() => {
  db.exec(`
    DELETE FROM issues; DELETE FROM sprints; DELETE FROM workspace_members;
    DELETE FROM workspaces; DELETE FROM users; DELETE FROM labels;
  `);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES ('u-uno','uno','x'),('u-dos','dos','x')").run();
  db.prepare("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('ws-dup','Dup','ws-dup','u-uno')").run();
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('ws-dup','u-uno','owner'),('ws-dup','u-dos','editor')").run();
});

describe('lo que la copia no arrastra', () => {
  it('las horas registradas se quedan a cero', async () => {
    const id = nuevo({ logged_hours: 12 });
    const { id: copia } = await IssueService.duplicate(id, 'u-uno', 0);
    const c = db.prepare('SELECT logged_hours FROM issues WHERE id = ?').get(copia);
    expect(c.logged_hours).toBe(0);
    // Y el original no se toca.
    expect(db.prepare('SELECT logged_hours FROM issues WHERE id = ?').get(id).logged_hours).toBe(12);
  });

  it('un ticket hecho se copia como pendiente', async () => {
    const id = nuevo({ status: 'done', title: 'Ya estaba hecho' });
    const { id: copia } = await IssueService.duplicate(id, 'u-uno', 0);
    expect(db.prepare('SELECT status FROM issues WHERE id = ?').get(copia).status).toBe('todo');
  });

  it('no hereda a un asignado que ya no está en el espacio', async () => {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES ('u-fuera','fuera','x')").run();
    const id = nuevo({ assignee_id: 'u-fuera', title: 'De alguien que se fue' });
    const { id: copia } = await IssueService.duplicate(id, 'u-uno', 0);
    expect(db.prepare('SELECT assignee_id FROM issues WHERE id = ?').get(copia).assignee_id).toBeNull();
  });
});

describe('lo que sí arrastra', () => {
  it('descripción, tipo, prioridad, puntos y estimación', async () => {
    const id = nuevo({ title: 'Con todo', type: 'bug', priority: 'low', story_points: 3, estimated_hours: 2.5 });
    const { id: copia } = await IssueService.duplicate(id, 'u-uno', 0);
    const c = db.prepare('SELECT * FROM issues WHERE id = ?').get(copia);
    expect(c.description).toBe('Cuerpo');
    expect(c.type).toBe('bug');
    expect(c.priority).toBe('low');
    expect(c.story_points).toBe(3);
    expect(c.estimated_hours).toBe(2.5);
  });

  it('las etiquetas', async () => {
    db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES ('l-1','ws-dup','Urgente','#f00'),('l-2','ws-dup','Docs','#0f0')").run();
    const id = nuevo({ title: 'Etiquetado' });
    db.prepare("INSERT INTO issue_labels (issue_id, label_id) VALUES (?,'l-1'),(?,'l-2')").run(id, id);

    const { id: copia } = await IssueService.duplicate(id, 'u-uno', 0);
    const suyas = db.prepare('SELECT label_id FROM issue_labels WHERE issue_id = ? ORDER BY label_id').all(copia);
    expect(suyas.map((s: any) => s.label_id)).toEqual(['l-1', 'l-2']);
  });

  it('el autor de la copia es quien duplica, no quien escribió el original', async () => {
    const id = nuevo({ reporter_id: 'u-uno', title: 'Escrito por uno' });
    const { id: copia } = await IssueService.duplicate(id, 'u-dos', 0);
    expect(db.prepare('SELECT reporter_id FROM issues WHERE id = ?').get(copia).reporter_id).toBe('u-dos');
  });
});

describe('sprints', () => {
  it('la copia se queda en el mismo sprint si sigue abierto', async () => {
    db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('sp-abierto','ws-dup','Abierto','active')").run();
    const id = nuevo({ sprint_id: 'sp-abierto', title: 'En sprint vivo' });
    const { sprint_id } = await IssueService.duplicate(id, 'u-uno', 0);
    expect(sprint_id).toBe('sp-abierto');
  });

  it('un sprint cerrado no recibe la copia: va al backlog', async () => {
    // Añadir trabajo nuevo a un sprint terminado descuadra lo que ese sprint
    // dice que se hizo.
    db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('sp-cerrado','ws-dup','Cerrado','completed')").run();
    const id = nuevo({ sprint_id: 'sp-cerrado', title: 'En sprint cerrado' });
    const { id: copia, sprint_id } = await IssueService.duplicate(id, 'u-uno', 0);
    expect(sprint_id).toBeNull();
    expect(db.prepare('SELECT sprint_id FROM issues WHERE id = ?').get(copia).sprint_id).toBeNull();
  });
});

describe('el título', () => {
  it('la primera copia no lleva número', async () => {
    const id = nuevo({ title: 'Revisar contratos' });
    const { title } = await IssueService.duplicate(id, 'u-uno', 0);
    expect(title).toBe('Revisar contratos (copia)');
  });

  it('la siguiente sí, y no se encadena «copia de copia»', async () => {
    const id = nuevo({ title: 'Backup mensual' });
    const primera = await IssueService.duplicate(id, 'u-uno', 0);
    const segunda = await IssueService.duplicate(id, 'u-uno', 0);
    // Duplicar la copia parte de la base, no de «... (copia)».
    const tercera = await IssueService.duplicate(
      db.prepare('SELECT id FROM issues WHERE title = ?').get(primera.title).id, 'u-uno', 0);

    expect(primera.title).toBe('Backup mensual (copia)');
    expect(segunda.title).toBe('Backup mensual (copia 2)');
    expect(tercera.title).toBe('Backup mensual (copia 3)');
  });

  it('un título con % o _ no se lleva por delante la búsqueda de duplicados', async () => {
    // Sin escapar, `LIKE '100% _ (copia%'` casa con cualquier cosa y el
    // contador se dispara.
    const id = nuevo({ title: '100% _ listo' });
    const { title } = await IssueService.duplicate(id, 'u-uno', 0);
    expect(title).toBe('100% _ listo (copia)');
  });

  it('un título en el límite no revienta la columna', async () => {
    const largo = 'x'.repeat(200);
    const id = nuevo({ title: largo });
    const { title } = await IssueService.duplicate(id, 'u-uno', 0);
    expect(title.length).toBeLessThanOrEqual(200);
  });
});

describe('permisos', () => {
  it('quien no es miembro recibe 404, no 403', async () => {
    // Un 403 confirmaría que el ticket existe.
    const id = nuevo({ title: 'Ajeno' });
    await expect(IssueService.duplicate(id, 'u-extranio', 0)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('un ticket que no existe da 404', async () => {
    await expect(IssueService.duplicate('no-existe', 'u-uno', 0)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('un lector no puede duplicar', async () => {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES ('u-lector','lector','x')").run();
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('ws-dup','u-lector','viewer')").run();
    const id = nuevo({ title: 'Solo mirar' });
    await expect(IssueService.duplicate(id, 'u-lector', 0)).rejects.toMatchObject({ statusCode: 403 });
  });
});
