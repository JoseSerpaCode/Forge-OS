import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';

/**
 * Los huecos de Planificación, contra el esquema real.
 *
 * Van juntos porque comparten la misma base: un sprint con tickets dentro. Y
 * contra el esquema de verdad porque dos de las tres cosas que se comprueban
 * —el índice único de sprint activo y el índice de una foto por día— son
 * garantías **de la base de datos**, no del código: probarlas sobre un esquema
 * inventado no probaría nada.
 */

let snap: typeof import('../src/lib/sprintSnapshots');
let db: any, tmp: string;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-plan-'));
  process.env.DATABASE_URL = path.join(tmp, 'plan.db');
  snap = await import('../src/lib/sprintSnapshots');
  db = (await import('../src/lib/db')).default;

  db.exec("INSERT INTO users (id, username, password_hash) VALUES ('u', 'planner', 'x')");
  db.exec("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w', 'W', 'w', 'u')");
  db.exec("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w2', 'W2', 'w2', 'u')");
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe('un solo sprint activo por espacio', () => {
  it('la base lo impide, no solo la aplicación', () => {
    db.exec("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('s1', 'w', 'Uno', 'active')");
    // Dos peticiones a la vez pasan las dos la comprobación en código antes de
    // que ninguna escriba; la única defensa que aguanta eso es el índice.
    expect(() =>
      db.exec("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('s2', 'w', 'Dos', 'active')")
    ).toThrow(/UNIQUE/);
  });

  it('cada espacio puede tener el suyo', () => {
    expect(() =>
      db.exec("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('s3', 'w2', 'Otro', 'active')")
    ).not.toThrow();
  });

  it('los planificados y los completados no estorban', () => {
    db.exec("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('s4', 'w', 'Futuro', 'planned')");
    db.exec("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('s5', 'w', 'Pasado', 'completed')");
    db.exec("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('s6', 'w', 'Otro pasado', 'completed')");
    const n = db.prepare("SELECT COUNT(*) AS n FROM sprints WHERE workspace_id = 'w'").get() as any;
    expect(n.n).toBe(4);
  });
});

describe('fotos del burndown', () => {
  beforeAll(() => {
    const meter = (id: string, pts: number | null, status: string) =>
      db.prepare(
        "INSERT INTO issues (id, workspace_id, sprint_id, title, type, status, reporter_id, story_points) VALUES (?, 'w', 's1', ?, 'task', ?, 'u', ?)"
      ).run(id, 'T' + id, status, pts);
    meter('i1', 5, 'done');
    meter('i2', 3, 'todo');
    meter('i3', null, 'todo');   // sin estimar
  });

  it('cuenta puntos y tickets por separado', () => {
    const m = snap.medirSprint('s1');
    expect(m.pointsTotal).toBe(8);
    expect(m.pointsDone).toBe(5);
    // El ticket sin estimar suma 0 puntos pero sí es un ticket: mezclarlo es
    // lo que hace que las dos gráficas cuenten historias distintas.
    expect(m.issuesTotal).toBe(3);
    expect(m.issuesDone).toBe(1);
  });

  it('repetir la foto del mismo día actualiza, no duplica', () => {
    snap.tomarFoto('s1', '2026-08-13');
    db.prepare("UPDATE issues SET status = 'done' WHERE id = 'i2'").run();
    snap.tomarFoto('s1', '2026-08-13');

    const s = snap.serie('s1');
    expect(s).toHaveLength(1);
    expect(s[0].pointsDone).toBe(8);
  });

  it('las fotos de días anteriores no se reescriben', () => {
    snap.tomarFoto('s1', '2026-08-14');
    db.prepare("UPDATE issues SET story_points = 100 WHERE id = 'i1'").run();
    snap.tomarFoto('s1', '2026-08-14');

    const s = snap.serie('s1');
    const ayer = s.find((f) => f.takenOn === '2026-08-13')!;
    // Es el punto de todo esto: subirle los puntos a un ticket hoy no puede
    // cambiar la curva de ayer.
    expect(ayer.pointsTotal).toBe(8);
    expect(s.find((f) => f.takenOn === '2026-08-14')!.pointsTotal).toBe(103);
  });

  it('fotografía todos los sprints activos de una vez', () => {
    const n = snap.fotografiarSprintsActivos('2026-08-15');
    expect(n).toBe(2); // s1 en 'w' y s3 en 'w2'
  });
});
