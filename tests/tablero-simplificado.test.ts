import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * El tablero simplificado, contra el esquema real.
 *
 * Migraciones 40 (funciones del espacio) y 41 (`done_at`), el cambio de
 * funciones, `done_at` por los dos caminos que cambian el estado, ordenar con
 * deshacer y el alta con etiquetas, apuntes y prioridad.
 *
 * Las migraciones se prueban **con datos dentro**: se abre una base nueva, se
 * llenan las tablas como estarían antes de la 39 y la 40, se borran esas dos
 * de `schema_migrations` y se vuelve a cargar el módulo, que las aplica otra
 * vez sobre los datos. Probar una migración sobre una base vacía no prueba el
 * relleno, que es justo lo que puede salir mal.
 */

let tmp: string;
let ruta: string;
let db: any;
let IssueService: typeof import('../src/lib/IssueService').IssueService;
let funcionesMod: typeof import('../src/lib/funcionesEspacio');
let reorder: typeof import('../src/pages/api/w/[sys_tag]/board/reorder');
let features: typeof import('../src/pages/api/w/[sys_tag]/features');

const OWNER = { id: 'u-owner', username: 'duena', is_sysadmin: 0, is_guest: 0 };
const EDITOR = { id: 'u-editor', username: 'editora', is_sysadmin: 0, is_guest: 0 };
const VIEWER = { id: 'u-viewer', username: 'mirona', is_sysadmin: 0, is_guest: 0 };

const peticion = (metodo: string, cuerpo: unknown) =>
  new Request('http://localhost/x', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
const llamar = (fn: any, sysTag: string, user: any, metodo: string, cuerpo: unknown) =>
  fn({ params: { sys_tag: sysTag }, request: peticion(metodo, cuerpo), locals: { user } } as any) as Promise<Response>;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-tablero-'));
  ruta = path.join(tmp, 'tablero.db');
  process.env.DATABASE_URL = ruta;
  process.env.NODE_ENV = 'test';

  // 1. Base nueva, con todas las migraciones.
  vi.resetModules();
  (await import('../src/lib/db')).default.close();

  // 2. El «antes»: datos de un espacio con sprints, otro con horas, otro con
  //    puntos y otro vacío; y tareas hechas sin `done_at`.
  const crudo = new Database(ruta);
  crudo.exec(`
    INSERT INTO users (id, username, password_hash) VALUES ('u-owner','duena','x'),('u-editor','editora','x'),('u-viewer','mirona','x');
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES
      ('w-sprints','S','w-sprints','u-owner'), ('w-horas','H','w-horas','u-owner'),
      ('w-puntos','P','w-puntos','u-owner'), ('w-vacio','V','w-vacio','u-owner'),
      ('w-ajeno','A','w-ajeno','u-owner');
    INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES
      ('w-vacio','u-owner','owner'), ('w-vacio','u-editor','editor'), ('w-vacio','u-viewer','viewer'),
      ('w-ajeno','u-owner','owner');
    INSERT INTO sprints (id, workspace_id, name) VALUES ('s1','w-sprints','Uno');
    INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, estimated_hours) VALUES ('h1','w-horas','task','Con horas','u-owner','todo', 3);
    INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, story_points) VALUES ('p1','w-puntos','task','Con puntos','u-owner','todo', 5);
    INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, updated_at) VALUES ('d1','w-vacio','task','Hecha vieja','u-owner','done','2026-01-02 10:00:00');
    UPDATE workspaces SET feat_sprints = 0, feat_time = 0, feat_points = 0;
    UPDATE issues SET done_at = NULL;
    DELETE FROM schema_migrations WHERE version IN (40, 41);
  `);
  crudo.close();

  // 3. Se recarga: la 39 y la 40 se aplican sobre esos datos.
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  IssueService = (await import('../src/lib/IssueService')).IssueService;
  funcionesMod = await import('../src/lib/funcionesEspacio');
  reorder = await import('../src/pages/api/w/[sys_tag]/board/reorder');
  features = await import('../src/pages/api/w/[sys_tag]/features');
});

afterAll(() => {
  try { db?.close(); } catch { /* ya cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe('migración 40: funciones del espacio', () => {
  it('enciende solo lo que cada espacio ya usaba', () => {
    const f = (id: string) => funcionesMod.funciones(id);
    expect(f('w-sprints')).toEqual({ sprints: true, tiempo: false, puntos: false });
    expect(f('w-horas')).toEqual({ sprints: false, tiempo: true, puntos: false });
    expect(f('w-puntos')).toEqual({ sprints: false, tiempo: false, puntos: true });
    expect(f('w-vacio')).toEqual({ sprints: false, tiempo: false, puntos: false });
  });

  it('un espacio nuevo nace con todo apagado', () => {
    db.exec("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w-nuevo','N','w-nuevo','u-owner')");
    expect(funcionesMod.funciones('w-nuevo')).toEqual({ sprints: false, tiempo: false, puntos: false });
  });

  it('la CHECK rechaza valores que no son 0 o 1', () => {
    expect(() => db.exec("UPDATE workspaces SET feat_time = 2 WHERE id = 'w-vacio'")).toThrow(/CHECK/);
  });
});

describe('cambiar funciones', () => {
  it('solo la propietaria; la editora recibe 403', async () => {
    const denegada = await llamar(features.PATCH, 'w-vacio', EDITOR, 'PATCH', { puntos: true });
    expect(denegada.status).toBe(403);
    // Control: la misma petición, de quien sí puede.
    const permitida = await llamar(features.PATCH, 'w-vacio', OWNER, 'PATCH', { puntos: true });
    expect(permitida.status).toBe(200);
    expect(funcionesMod.funciones('w-vacio').puntos).toBe(true);
    await llamar(features.PATCH, 'w-vacio', OWNER, 'PATCH', { puntos: false });
  });

  it('apagar el tiempo para y registra los cronómetros en marcha', () => {
    db.exec(`
      UPDATE workspaces SET feat_time = 1 WHERE id = 'w-horas';
      INSERT INTO time_tracking_sessions (id, issue_id, user_id, started_at) VALUES ('t1','h1','u-owner', datetime('now','-1 hours'));
    `);
    funcionesMod.cambiarFunciones('w-horas', { tiempo: false });
    expect(db.prepare("SELECT COUNT(*) AS n FROM time_tracking_sessions WHERE issue_id = 'h1'").get().n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM work_logs WHERE issue_id = 'h1'").get().n).toBe(1);
  });
});

describe('done_at', () => {
  it('la migración 41 rellena las ya hechas con su updated_at', () => {
    expect(db.prepare("SELECT done_at FROM issues WHERE id = 'd1'").get().done_at).toBe('2026-01-02 10:00:00');
  });

  it('IssueService.update lo pone al entrar en Hecho, lo conserva y lo borra al salir', async () => {
    db.exec("INSERT INTO issues (id, workspace_id, type, title, reporter_id, status) VALUES ('d2','w-vacio','task','Por hacer','u-owner','todo')");
    await IssueService.update('d2', { status: 'done' } as any, OWNER.id, 0, OWNER.username);
    const primero = db.prepare("SELECT done_at FROM issues WHERE id = 'd2'").get().done_at;
    expect(primero).toBeTruthy();

    db.exec("UPDATE issues SET done_at = '2026-01-01 00:00:00' WHERE id = 'd2'");
    await IssueService.update('d2', { status: 'done', title: 'Editada' } as any, OWNER.id, 0, OWNER.username);
    expect(db.prepare("SELECT done_at FROM issues WHERE id = 'd2'").get().done_at).toBe('2026-01-01 00:00:00');

    await IssueService.update('d2', { status: 'todo' } as any, OWNER.id, 0, OWNER.username);
    expect(db.prepare("SELECT done_at FROM issues WHERE id = 'd2'").get().done_at).toBeNull();
  });
});

describe('ordenar como acción, con deshacer', () => {
  beforeAll(() => {
    db.exec(`
      INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, priority, position) VALUES
        ('o1','w-vacio','task','Baja','u-owner','todo','low', 100),
        ('o2','w-vacio','task','Urgente','u-owner','todo','highest', 200),
        ('o3','w-vacio','task','Alta','u-owner','todo','high', 300);
    `);
  });

  it('reescribe position por urgencia, no por alfabeto, y deshacer lo deja como estaba', async () => {
    const antes = db.prepare("SELECT id, position FROM issues WHERE id IN ('o1','o2','o3') ORDER BY id").all();
    const res = await llamar(reorder.POST, 'w-vacio', EDITOR, 'POST', { by: 'priority' });
    expect(res.status).toBe(200);
    const { previo } = await res.json();
    const orden = db.prepare("SELECT id FROM issues WHERE id IN ('o1','o2','o3') ORDER BY position").all().map((r: any) => r.id);
    expect(orden).toEqual(['o2', 'o3', 'o1']);

    const deshacer = await llamar(reorder.PUT, 'w-vacio', EDITOR, 'PUT', { previo });
    expect(deshacer.status).toBe(200);
    expect(db.prepare("SELECT id, position FROM issues WHERE id IN ('o1','o2','o3') ORDER BY id").all()).toEqual(antes);
  });

  it('quien solo mira no puede ordenar', async () => {
    expect((await llamar(reorder.POST, 'w-vacio', VIEWER, 'POST', { by: 'title' })).status).toBe(403);
    // Control.
    expect((await llamar(reorder.POST, 'w-vacio', EDITOR, 'POST', { by: 'title' })).status).toBe(200);
  });

  it('un orden inventado es 400, también los de la cadena de prototipos', async () => {
    expect((await llamar(reorder.POST, 'w-vacio', EDITOR, 'POST', { by: 'toString' })).status).toBe(400);
  });

  it('deshacer con ids de otro espacio no toca nada fuera de este', async () => {
    db.exec("INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, position) VALUES ('x1','w-ajeno','task','Ajena','u-owner','todo', 7)");
    const res = await llamar(reorder.PUT, 'w-vacio', EDITOR, 'PUT', { previo: [{ id: 'x1', position: 99999 }] });
    expect((await res.json()).restored).toBe(0);
    expect(db.prepare("SELECT position FROM issues WHERE id = 'x1'").get().position).toBe(7);
  });
});

describe('alta con etiquetas, apuntes y prioridad', () => {
  beforeAll(() => {
    db.exec(`
      INSERT INTO labels (id, workspace_id, name, color) VALUES ('l-propia','w-vacio','Cálculo','#FF5D00'), ('l-ajena','w-ajeno','Otra','#FF5D00');
      INSERT INTO pages (id, workspace_id, title, created_by) VALUES ('pg-propia','w-vacio','Tema 3','u-owner'), ('pg-ajena','w-ajeno','Ajena','u-owner');
    `);
  });

  const cuenta = (titulo: string) => db.prepare('SELECT COUNT(*) AS n FROM issues WHERE title = ?').get(titulo).n;

  it('una etiqueta de otro espacio rechaza el alta entera', async () => {
    await expect(IssueService.create({ workspace_id: 'w-vacio', title: 'Con ajena', label_ids: ['l-ajena'] } as any, OWNER.id, 0)).rejects.toThrow();
    expect(cuenta('Con ajena')).toBe(0);
    // Control: con la propia, se crea y queda etiquetada.
    const { id } = await IssueService.create({ workspace_id: 'w-vacio', title: 'Con propia', label_ids: ['l-propia'] } as any, OWNER.id, 0);
    expect(db.prepare('SELECT label_id FROM issue_labels WHERE issue_id = ?').all(id).map((r: any) => r.label_id)).toEqual(['l-propia']);
  });

  it('un apunte de otro espacio rechaza el alta; uno propio se vincula', async () => {
    await expect(IssueService.create({ workspace_id: 'w-vacio', title: 'Apunte ajeno', page_ids: ['pg-ajena'] } as any, OWNER.id, 0)).rejects.toThrow();
    expect(cuenta('Apunte ajeno')).toBe(0);
    const { id } = await IssueService.create({ workspace_id: 'w-vacio', title: 'Apunte propio', page_ids: ['pg-propia'] } as any, OWNER.id, 0);
    expect(db.prepare('SELECT page_id FROM issue_page_links WHERE issue_id = ?').all(id).map((r: any) => r.page_id)).toEqual(['pg-propia']);
  });

  it('guarda prioridad y hora; una hora sin fecha no se guarda', async () => {
    const { id } = await IssueService.create({ workspace_id: 'w-vacio', title: 'Con hora', priority: 'highest', due_date: '2026-10-23', due_time: '18:00' } as any, OWNER.id, 0);
    expect(db.prepare('SELECT priority, due_time FROM issues WHERE id = ?').get(id)).toEqual({ priority: 'highest', due_time: '18:00' });
    const sinFecha = await IssueService.create({ workspace_id: 'w-vacio', title: 'Sin fecha', due_time: '18:00' } as any, OWNER.id, 0);
    expect(db.prepare('SELECT due_time FROM issues WHERE id = ?').get(sinFecha.id).due_time).toBeNull();
  });

  it('una prioridad o una hora inventadas son 400, no 500', async () => {
    await expect(IssueService.create({ workspace_id: 'w-vacio', title: 'Mala', priority: 'urgentisima' } as any, OWNER.id, 0)).rejects.toMatchObject({ statusCode: 400 });
    await expect(IssueService.update('d1', { priority: 'urgentisima' } as any, OWNER.id, 0, OWNER.username)).rejects.toMatchObject({ statusCode: 400 });
    await expect(IssueService.update('d1', { due_time: '25:00' } as any, OWNER.id, 0, OWNER.username)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('borrar un sprint decidiendo tarea por tarea', () => {
  let sprints: typeof import('../src/pages/api/sprints/[id]');
  const borrar = (user: any, id: string, cuerpo: unknown) =>
    sprints.DELETE({ params: { id }, request: peticion('DELETE', cuerpo), locals: { user } } as any) as Promise<Response>;

  beforeAll(async () => {
    sprints = await import('../src/pages/api/sprints/[id]');
    db.exec(`
      INSERT INTO sprints (id, workspace_id, name) VALUES ('sp-a','w-vacio','A'), ('sp-b','w-vacio','B'), ('sp-x','w-ajeno','X');
      INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, sprint_id) VALUES
        ('s1','w-vacio','task','Al backlog','u-owner','todo','sp-a'),
        ('s2','w-vacio','task','A B','u-owner','todo','sp-a'),
        ('s3','w-vacio','task','Se borra','u-owner','todo','sp-a');
      INSERT INTO attachments (id, entity_type, entity_id, file_name, file_path, mime_type, size_bytes, uploaded_by)
        VALUES ('adj-s3','issue','s3','a.txt','/api/storage/no-existe.txt','text/plain',1,'u-owner');
    `);
  });

  it('sin destinos responde 409 con la lista de tareas', async () => {
    const res = await borrar(OWNER, 'sp-a', {});
    expect(res.status).toBe(409);
    const datos = await res.json();
    expect(datos.issues.map((i: any) => i.id).sort()).toEqual(['s1', 's2', 's3']);
  });

  it('si falta el destino de alguna, no toca nada', async () => {
    const res = await borrar(OWNER, 'sp-a', { destinos: { s1: 'backlog', s2: 'sp-b' } });
    expect(res.status).toBe(400);
    expect(db.prepare("SELECT COUNT(*) AS n FROM issues WHERE sprint_id = 'sp-a'").get().n).toBe(3);
    expect(db.prepare("SELECT 1 FROM sprints WHERE id = 'sp-a'").get()).toBeTruthy();
  });

  it('un sprint de otro espacio no vale como destino', async () => {
    const res = await borrar(OWNER, 'sp-a', { destinos: { s1: 'backlog', s2: 'sp-x', s3: 'borrar' } });
    expect(res.status).toBe(400);
    expect(db.prepare("SELECT sprint_id FROM issues WHERE id = 's2'").get().sprint_id).toBe('sp-a');
  });

  it('la editora no puede borrar sprints', async () => {
    expect((await borrar(EDITOR, 'sp-a', { destinos: { s1: 'backlog', s2: 'sp-b', s3: 'borrar' } })).status).toBe(403);
  });

  it('con destinos completos: una al backlog, otra a B, otra borrada con sus adjuntos', async () => {
    // Control de lo anterior: la propietaria, con todo bien.
    const res = await borrar(OWNER, 'sp-a', { destinos: { s1: 'backlog', s2: 'sp-b', s3: 'borrar' } });
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT sprint_id FROM issues WHERE id = 's1'").get().sprint_id).toBeNull();
    expect(db.prepare("SELECT sprint_id FROM issues WHERE id = 's2'").get().sprint_id).toBe('sp-b');
    expect(db.prepare("SELECT 1 FROM issues WHERE id = 's3'").get()).toBeUndefined();
    expect(db.prepare("SELECT 1 FROM attachments WHERE id = 'adj-s3'").get()).toBeUndefined();
    expect(db.prepare("SELECT 1 FROM sprints WHERE id = 'sp-a'").get()).toBeUndefined();
  });
});

describe('ordenar con un filtro de etiqueta', () => {
  it('ordena solo las filtradas, en sus huecos, y renumera la columna entera sin entremezclar', async () => {
    db.exec(`
      DELETE FROM issues WHERE workspace_id = 'w-vacio' AND status = 'review';
      INSERT INTO labels (id, workspace_id, name, color) VALUES ('ord-l', 'w-vacio', 'Filtro', '#FF5D00');
      INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, priority, position) VALUES
        ('f1','w-vacio','task','Filtrada baja','u-owner','review','low', 100),
        ('n1','w-vacio','task','Sin filtro 1','u-owner','review','medium', 200),
        ('f2','w-vacio','task','Filtrada urgente','u-owner','review','highest', 300),
        ('n2','w-vacio','task','Sin filtro 2','u-owner','review','highest', 400);
      INSERT INTO issue_labels (issue_id, label_id) VALUES ('f1','ord-l'), ('f2','ord-l');
    `);
    const res = await llamar(reorder.POST, 'w-vacio', EDITOR, 'POST', { by: 'priority', label: 'ord-l' });
    expect(res.status).toBe(200);
    const orden = db.prepare("SELECT id FROM issues WHERE workspace_id = 'w-vacio' AND status = 'review' ORDER BY position").all().map((r: any) => r.id);
    // Las filtradas cambian entre sí; las otras siguen donde estaban.
    expect(orden).toEqual(['f2', 'n1', 'f1', 'n2']);
    const posiciones = db.prepare("SELECT position FROM issues WHERE workspace_id = 'w-vacio' AND status = 'review' ORDER BY position").all().map((r: any) => r.position);
    expect(new Set(posiciones).size).toBe(4);
  });
});
