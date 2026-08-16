import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * La migración 38 rehace la tabla `issues`.
 *
 * Es la más arriesgada del proyecto: `issues` es la tabla central y cinco
 * tablas apuntan a ella. Rehacerla mal no da un error — da una base que arranca
 * con tickets perdidos, o con `issue_labels` apuntando a una tabla que ya no
 * existe, y eso se descubre semanas después.
 *
 * Aquí se monta una base **con la tabla vieja y su CHECK**, con datos y con
 * relaciones colgando, se abre con el código de hoy —que aplica la migración— y
 * se comprueba que todo sigue en su sitio.
 */

const DB = path.join(process.cwd(), `forge_mig38_${process.pid}.db`);

function baseVieja() {
  /**
   * El «antes» no se escribe a mano: se copia del esquema real.
   *
   * Una base inventada con las cuatro tablas del caso se parece poco a la de
   * producción —le faltan columnas, índices y las otras veinte tablas—, así que
   * una migración podría pasar aquí y fallar allí. `forge.db` está justo en la
   * versión anterior, que es el estado desde el que se migra de verdad.
   *
   * Se copia con `.backup` y no con `cp`: la base está en WAL y copiar el
   * archivo da algo incompleto.
   */
  const origen = path.join(process.cwd(), 'forge.db');
  const tmp = new Database(origen, { readonly: true });
  tmp.exec(`VACUUM INTO '${DB}'`);
  tmp.close();

  const db = new Database(DB);
  db.pragma('foreign_keys = OFF');

  // Se vacía para partir de datos conocidos, pero el **esquema** es el real.
  for (const t of ['work_logs', 'issue_labels', 'time_tracking_sessions', 'issue_page_links', 'issues', 'sprints', 'labels', 'issue_types']) {
    try { db.exec(`DELETE FROM ${t}`); } catch { /* la tabla puede no existir */ }
  }

  /**
   * Se rebobina a la versión 37.
   *
   * La copia sale de `forge.db`, que ya está migrada: usarla tal cual haría que
   * esta prueba no probara nada, porque la migración no tendría trabajo que
   * hacer. Se devuelve `issues` a su forma anterior —con la `CHECK` que impedía
   * los tipos propios— y se borra la marca de la 38.
   *
   * El resto del esquema se deja como está, que es justo el motivo de partir de
   * la base real: las otras veinticinco tablas, sus índices y sus triggers son
   * los de verdad, no cuatro inventadas para el caso.
   */
  db.exec('DROP TABLE IF EXISTS issue_types');
  db.exec('DROP TABLE IF EXISTS issues');
  db.exec(`
    CREATE TABLE issues (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      sprint_id TEXT,
      parent_issue_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('epic', 'story', 'task', 'bug')),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT CHECK(priority IN ('lowest', 'low', 'medium', 'high', 'highest')) DEFAULT 'medium',
      story_points INTEGER DEFAULT 0,
      estimated_hours REAL DEFAULT 0.0,
      logged_hours REAL DEFAULT 0.0,
      position REAL DEFAULT 0.0,
      reporter_id TEXT NOT NULL,
      assignee_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, due_date DATETIME,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
      FOREIGN KEY (reporter_id) REFERENCES users(id),
      FOREIGN KEY (assignee_id) REFERENCES users(id)
    )
  `);
  db.exec('CREATE INDEX idx_issues_workspace ON issues(workspace_id)');
  db.exec('CREATE INDEX idx_issues_metrics ON issues(workspace_id, sprint_id, status)');
  db.exec('CREATE INDEX idx_issues_workspace_status ON issues(workspace_id, status)');
  db.prepare('DELETE FROM schema_migrations WHERE version >= 38').run();

  const esquema = db.prepare("SELECT sql FROM sqlite_master WHERE name='issues'").get() as any;
  if (!esquema.sql.includes('CHECK(type IN')) throw new Error('se esperaba la CHECK vieja en issues');

  db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, is_sysadmin) VALUES ('u1','mig_uno','x',0)").run();
  db.prepare("INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES ('w1','Uno','mig-w1','u1')").run();
  db.prepare("INSERT OR IGNORE INTO workspaces (id, name, sys_tag, created_by) VALUES ('w2','Dos','mig-w2','u1')").run();
  db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('s1','w1','Sprint','active')").run();
  db.prepare("INSERT INTO labels (id, workspace_id, name, color) VALUES ('l1','w1','Urgente','#f00')").run();

  const ins = db.prepare(`INSERT INTO issues
    (id, workspace_id, sprint_id, parent_issue_id, type, title, description, status,
     priority, story_points, estimated_hours, logged_hours, position, reporter_id,
     assignee_id, created_at, updated_at, due_date)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  ins.run('i1','w1','s1',null,'task','Con todo','desc','in_progress','high',5,8,0,100000,'u1','u1','2020-01-01 00:00:00','2020-02-02 00:00:00','2020-03-03');
  ins.run('i2','w1',null,'i1','bug','Hija','','todo','low',1,1,0,200000,'u1',null,'2020-01-01 00:00:00','2020-01-01 00:00:00',null);
  ins.run('i3','w2',null,null,'story','De otro espacio',null,'done','medium',0,0,0,100000,'u1',null,'2020-01-01 00:00:00','2020-01-01 00:00:00',null);

  db.prepare("INSERT INTO issue_labels (issue_id, label_id) VALUES ('i1','l1')").run();
  db.prepare("INSERT INTO work_logs (id, issue_id, user_id, hours_spent) VALUES ('wl1','i1','u1',3.5)").run();
  db.close();
}

let db: any;

beforeAll(async () => {
  fs.rmSync(DB, { force: true });
  baseVieja();
  process.env.DATABASE_URL = DB;
  process.env.NODE_ENV = 'test';
  // Importar el módulo aplica las migraciones pendientes.
  await import('../src/lib/db');
  db = new Database(DB);
});

afterAll(() => {
  db?.close();
  for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true });
});

describe('la tabla se rehace sin perder nada', () => {
  it('siguen estando los tres tickets, con sus valores', () => {
    const i1 = db.prepare('SELECT * FROM issues WHERE id = ?').get('i1');
    expect(i1.title).toBe('Con todo');
    expect(i1.description).toBe('desc');
    expect(i1.status).toBe('in_progress');
    expect(i1.priority).toBe('high');
    expect(i1.story_points).toBe(5);
    expect(i1.estimated_hours).toBe(8);
    // Lo pone el trigger de `work_logs`, no la inserción: si la migración
    // perdiera el parte de trabajo, esto bajaría a 0.
    expect(i1.logged_hours).toBe(3.5);
    expect(i1.position).toBe(100000);
    expect(i1.sprint_id).toBe('s1');
    expect(i1.assignee_id).toBe('u1');
    // Las fechas son lo que se pierde si se casan columnas por posición: la
    // tabla vieja tenía `due_date` al final, fuera del orden del CREATE.
    expect(i1.created_at).toBe('2020-01-01 00:00:00');
    expect(i1.updated_at).toBe('2020-02-02 00:00:00');
    expect(i1.due_date).toBe('2020-03-03');
    expect(db.prepare('SELECT COUNT(*) n FROM issues').get().n).toBe(3);
  });

  it('la jerarquía padre-hija sobrevive', () => {
    expect(db.prepare('SELECT parent_issue_id FROM issues WHERE id = ?').get('i2').parent_issue_id).toBe('i1');
  });

  it('las etiquetas y los partes de trabajo siguen colgando del ticket', () => {
    expect(db.prepare('SELECT COUNT(*) n FROM issue_labels WHERE issue_id = ?').get('i1').n).toBe(1);
    expect(db.prepare('SELECT COUNT(*) n FROM work_logs WHERE issue_id = ?').get('i1').n).toBe(1);
  });

  it('las tablas que apuntaban a issues no acabaron apuntando a issues_old', () => {
    // Esto es lo que pasa si se renombra con `foreign_keys` activo: SQLite
    // reescribe las cláusulas REFERENCES de las demás tablas.
    for (const t of ['issue_labels', 'work_logs']) {
      const sql = db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(t).sql;
      expect(sql, t).toContain('REFERENCES issues(id)');
      expect(sql, t).not.toContain('issues_old');
    }
    expect(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'issues_old'").get().n).toBe(0);
  });

  it('la base queda íntegra y sin claves rotas', () => {
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(db.pragma('foreign_key_check')).toHaveLength(0);
  });

  it('los índices vuelven: sin ellos el tablero se degrada en silencio', () => {
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='issues'")
      .all().map((r: any) => r.name);
    for (const n of ['idx_issues_workspace', 'idx_issues_metrics', 'idx_issues_workspace_status']) {
      expect(idx, n).toContain(n);
    }
  });
});

describe('los tipos propios ya son posibles', () => {
  it('la CHECK que los impedía ya no está', () => {
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'issues'").get().sql;
    expect(sql).not.toContain("CHECK(type IN");
    // La de prioridad sí se conserva: esa lista sí es cerrada.
    expect(sql).toContain("CHECK(priority IN");
  });

  it('se puede guardar un ticket con un tipo que no es de fábrica', () => {
    expect(() => db.prepare(`INSERT INTO issues
      (id, workspace_id, type, title, status, reporter_id, position)
      VALUES ('i9','w1','incidencia','Corte de luz','todo','u1',300000)`).run()).not.toThrow();
  });

  it('cada espacio arranca con los cuatro tipos de fábrica', () => {
    for (const ws of ['w1', 'w2']) {
      const claves = db.prepare('SELECT key FROM issue_types WHERE workspace_id = ? ORDER BY position')
        .all(ws).map((r: any) => r.key);
      expect(claves, ws).toEqual(['task', 'bug', 'story', 'epic']);
    }
  });

  it('dos espacios pueden tener un tipo con la misma clave, y uno no puede repetirla', () => {
    const ins = db.prepare("INSERT INTO issue_types (id, workspace_id, key, name, color, position) VALUES (?,?,?,?,?,?)");
    expect(() => ins.run('t-a', 'w1', 'incidencia', 'Incidencia', '#f00', 5)).not.toThrow();
    expect(() => ins.run('t-b', 'w2', 'incidencia', 'Incidencia', '#f00', 5)).not.toThrow();
    expect(() => ins.run('t-c', 'w1', 'incidencia', 'Otra', '#0f0', 6)).toThrow();
  });

  it('borrar el espacio se lleva sus tipos', () => {
    db.pragma('foreign_keys = ON');
    db.prepare('DELETE FROM issues WHERE workspace_id = ?').run('w2');
    db.prepare("DELETE FROM workspaces WHERE id = 'w2'").run();
    expect(db.prepare("SELECT COUNT(*) n FROM issue_types WHERE workspace_id = 'w2'").get().n).toBe(0);
  });
});
