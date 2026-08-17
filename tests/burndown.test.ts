import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * El burndown ya no se inventa la historia.
 *
 * El endpoint devolvía un `COUNT(*)` del estado actual con un comentario que
 * decía «mock ... for MVP purposes». El módulo que lo arregla —
 * `lib/sprintSnapshots.ts`— se escribió, se probó y **nunca se enchufó**: el
 * CHANGELOG anunció el arreglo en la v1.12.0 y doce versiones después el
 * endpoint seguía igual, con la tabla de fotos permanentemente vacía.
 *
 * Lo que importa comprobar no es que la cuenta salga bien —eso ya lo hace
 * `planificacion.test.ts`— sino que **las fotos de días pasados no se tocan**.
 * Ese es el motivo de existir de todo el mecanismo: si a un ticket le suben los
 * puntos, la curva de la semana pasada no puede redibujarse distinta hoy.
 */
const DB = path.join(process.cwd(), `forge_burn_${process.pid}.db`);
let db: any;
let snap: typeof import('../src/lib/sprintSnapshots');

beforeAll(async () => {
  fs.rmSync(DB, { force: true });
  process.env.DATABASE_URL = DB;
  process.env.NODE_ENV = 'test';
  snap = await import('../src/lib/sprintSnapshots');
  db = new Database(DB);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES ('u1','burn','x')").run();
  db.prepare("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w1','B','ws-burn','u1')").run();
  db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('s1','w1','S','active')").run();
});

afterAll(() => {
  db?.close();
  for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true });
});

const ticket = (puntos: number, estado = 'todo') =>
  db.prepare(`INSERT INTO issues (id, workspace_id, sprint_id, type, title, status, reporter_id, position, story_points)
              VALUES (?, 'w1', 's1', 'task', 'T', ?, 'u1', 100000, ?)`)
    .run(crypto.randomUUID(), estado, puntos);

describe('las fotos congelan lo que había ese día', () => {
  it('la de ayer no cambia cuando cambian los datos de hoy', () => {
    ticket(5);
    ticket(3, 'done');
    const ayer = snap.tomarFoto('s1', '2026-08-16');
    expect(ayer.pointsTotal).toBe(8);
    expect(ayer.pointsDone).toBe(3);

    // Se sube la estimación de todo y se termina otro ticket.
    db.prepare("UPDATE issues SET story_points = 13 WHERE sprint_id = 's1'").run();
    ticket(21);
    snap.tomarFoto('s1', '2026-08-17');

    const serie = snap.serie('s1');
    const deAyer = serie.find((f) => f.takenOn === '2026-08-16')!;
    // Este es el punto: la foto de ayer sigue diciendo 8, no 47.
    expect(deAyer.pointsTotal).toBe(8);
    expect(deAyer.pointsDone).toBe(3);

    const deHoy = serie.find((f) => f.takenOn === '2026-08-17')!;
    expect(deHoy.pointsTotal).toBe(47);
  });

  it('tomar la foto dos veces el mismo día la refresca, no la duplica', () => {
    // El servicio puede reiniciarse cinco veces en una tarde, y Métricas
    // refresca la de hoy en cada carga.
    const antes = snap.serie('s1').length;
    snap.tomarFoto('s1', '2026-08-17');
    snap.tomarFoto('s1', '2026-08-17');
    expect(snap.serie('s1').length).toBe(antes);
  });

  it('la serie sale ordenada por fecha', () => {
    snap.tomarFoto('s1', '2026-08-14');
    const fechas = snap.serie('s1').map((f) => f.takenOn);
    expect(fechas).toEqual([...fechas].sort());
  });

  it('un ticket sin estimar cuenta como ticket pero no suma puntos', () => {
    db.prepare("DELETE FROM issues WHERE sprint_id = 's1'").run();
    ticket(0);
    db.prepare(`INSERT INTO issues (id, workspace_id, sprint_id, type, title, status, reporter_id, position, story_points)
                VALUES (?, 'w1', 's1', 'task', 'Sin estimar', 'todo', 'u1', 100000, NULL)`)
      .run(crypto.randomUUID());

    const f = snap.tomarFoto('s1', '2026-08-18');
    expect(f.issuesTotal).toBe(2);
    expect(f.pointsTotal).toBe(0);
  });
});

describe('el endpoint ya no recalcula desde el estado actual', () => {
  it('el comentario de «mock» ya no está y se lee la serie', () => {
    const src = fs.readFileSync('src/pages/api/w/[sys_tag]/metrics/burndown.ts', 'utf-8');
    expect(src).not.toContain('mock the daily burndown');
    expect(src).toContain('serie(');
    expect(src).toContain('series:');
  });

  it('algo llama a la foto diaria: la tabla ya no puede quedarse vacía', () => {
    // Era el hueco exacto: módulo escrito, probado y sin ningún disparador.
    const dbTs = fs.readFileSync('src/lib/db.ts', 'utf-8');
    expect(dbTs).toContain('fotografiarHoy');
    expect(dbTs).toMatch(/setInterval\(fotografiarHoy/);
    // Con el temporizador sin `unref`, los tests que importan db.ts se cuelgan
    // al terminar sin que nada lo explique.
    expect(dbTs).toMatch(/setInterval\(fotografiarHoy[^)]*\)[^;]*\.unref\(\)/);
  });
});
