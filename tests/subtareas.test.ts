import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Subtareas: pasos dentro de una tarea.
 *
 * Lo que se fija aquí son las reglas que no se ven en el esquema —un solo
 * nivel, el espacio de la madre, fuera de los sprints— y, sobre todo, que **no
 * aparezcan como tarjetas** en ninguna lista: tablero, Hecho, vistas por fecha.
 */

let tmp: string;
let db: any;
let IssueService: typeof import('../src/lib/IssueService').IssueService;
let tablero: typeof import('../src/lib/tablero');

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-subtareas-'));
  process.env.DATABASE_URL = path.join(tmp, 'sub.db');
  process.env.NODE_ENV = 'test';
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  IssueService = (await import('../src/lib/IssueService')).IssueService;
  tablero = await import('../src/lib/tablero');
  db.exec(`
    INSERT INTO users (id, username, password_hash) VALUES ('u','duena','x'), ('v','mirona','x');
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w','W','w','u'), ('w2','W2','w2','u');
    INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('w','u','owner'), ('w','v','viewer');
    INSERT INTO sprints (id, workspace_id, name) VALUES ('s','w','S');
    INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, sprint_id, due_date)
      VALUES ('madre','w','task','Informe','u','todo','s', '2026-10-20');
  `);
});

afterAll(() => {
  try { db?.close(); } catch { /* cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe('crear', () => {
  it('copia el espacio de la madre y queda fuera de los sprints', () => {
    const st = IssueService.crearSubtarea('madre', '  Buscar fuentes  ', 'u', 0);
    const fila = db.prepare('SELECT workspace_id, sprint_id, parent_issue_id, title, status FROM issues WHERE id = ?').get(st.id);
    expect(fila).toEqual({ workspace_id: 'w', sprint_id: null, parent_issue_id: 'madre', title: 'Buscar fuentes', status: 'todo' });
  });

  it('una subtarea no puede tener subtareas', () => {
    const st = IssueService.crearSubtarea('madre', 'Escribir', 'u', 0);
    expect(() => IssueService.crearSubtarea(st.id, 'Nieta', 'u', 0)).toThrow(/Subtasks cannot have subtasks/);
  });

  it('sin título es 400, y quien solo mira no puede crear', () => {
    expect(() => IssueService.crearSubtarea('madre', '   ', 'u', 0)).toThrow(/Title/);
    expect(() => IssueService.crearSubtarea('madre', 'Algo', 'v', 0)).toThrow();
  });
});

describe('no son tarjetas', () => {
  it('ni el tablero, ni sus cuentas, ni Hecho, ni la vista Hoy las enseñan', () => {
    const st = IssueService.crearSubtarea('madre', 'Con fecha', 'u', 0);
    db.prepare("UPDATE issues SET status = 'done', done_at = CURRENT_TIMESTAMP, due_date = '2026-10-20' WHERE id = ?").run(st.id);

    const t = tablero.cargarTablero({ workspaceId: 'w', userId: 'u' });
    expect(t.tarjetas.map((x: any) => x.id)).toEqual(['madre']);
    expect(t.conteos.done ?? 0).toBe(0);
    expect(tablero.masHechas({ workspaceId: 'w', userId: 'u' }).tarjetas).toEqual([]);
    const hoy = tablero.cargarVista({ workspaceId: 'w', userId: 'u', vista: 'hoy', hoy: '2026-10-20' });
    expect(hoy.flatMap((g) => g.tarjetas.map((x: any) => x.id))).toEqual(['madre']);
  });

  it('la tarjeta de la madre lleva la cuenta de hechas y totales', () => {
    const t = tablero.cargarTablero({ workspaceId: 'w', userId: 'u' });
    const madre = t.tarjetas.find((x: any) => x.id === 'madre');
    const total = db.prepare("SELECT COUNT(*) AS n FROM issues WHERE parent_issue_id = 'madre'").get().n;
    const hechas = db.prepare("SELECT COUNT(*) AS n FROM issues WHERE parent_issue_id = 'madre' AND status = 'done'").get().n;
    expect([madre.subtareas_hechas, madre.subtareas_total]).toEqual([hechas, total]);
  });
});

describe('copiar y borrar', () => {
  it('duplicar copia las subtareas, todas pendientes', async () => {
    const copia = await IssueService.duplicate('madre', 'u', 0);
    const hijas = db.prepare('SELECT status FROM issues WHERE parent_issue_id = ?').all(copia.id);
    expect(hijas.length).toBe(db.prepare("SELECT COUNT(*) AS n FROM issues WHERE parent_issue_id = 'madre'").get().n);
    expect(hijas.every((h: any) => h.status === 'todo')).toBe(true);
  });

  it('borrar la madre se lleva las subtareas y sus adjuntos', () => {
    const st = IssueService.crearSubtarea('madre', 'Con adjunto', 'u', 0);
    db.prepare(`INSERT INTO attachments (id, entity_type, entity_id, file_name, file_path, mime_type, size_bytes, uploaded_by)
                VALUES ('adj', 'issue', ?, 'a.txt', '/api/storage/no-existe.txt', 'text/plain', 1, 'u')`).run(st.id);
    IssueService.borrarSinComprobar(['madre']);
    expect(db.prepare("SELECT COUNT(*) AS n FROM issues WHERE parent_issue_id = 'madre' OR id = 'madre'").get().n).toBe(0);
    expect(db.prepare("SELECT 1 FROM attachments WHERE id = 'adj'").get()).toBeUndefined();
  });
});
