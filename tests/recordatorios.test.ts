import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Recordatorios, con el reloj inyectado.
 *
 * Entrega el viernes 23 de octubre de 2026 a las 18:00 en Bogotá (UTC−5), que
 * son las 23:00 UTC. Con una hora de antelación, el aviso toca a las 22:00 UTC.
 */
let tmp: string;
let db: any;
let rec: typeof import('../src/lib/recordatorios');

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-rec-'));
  process.env.DATABASE_URL = path.join(tmp, 'rec.db');
  process.env.NODE_ENV = 'test';
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  rec = await import('../src/lib/recordatorios');
  db.exec(`
    INSERT INTO users (id, username, password_hash, timezone) VALUES ('u','duena','x','America/Bogota'), ('m','muda','x','America/Bogota');
    UPDATE users SET notif_mute_all = 1 WHERE id = 'm';
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w','W','w','u');
    INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('w','u','owner'), ('w','m','editor');
    INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, due_date, due_time, reminder_minutes)
      VALUES ('r','w','task','Informe','u','todo','2026-10-23','18:00', 60);
  `);
});

afterAll(() => {
  try { db?.close(); } catch { /* cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

const avisos = (id = 'u') => db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND title = 'Recordatorio'").get(id).n;

describe('cuándo toca', () => {
  it('ni un minuto antes', () => {
    rec.procesarRecordatorios(new Date('2026-10-23T21:59:00Z'));
    expect(avisos()).toBe(0);
  });
  it('a su hora, una vez; volver a llamar (un reinicio) no lo repite', () => {
    rec.procesarRecordatorios(new Date('2026-10-23T22:00:30Z'));
    rec.procesarRecordatorios(new Date('2026-10-23T22:01:30Z'));
    expect(avisos()).toBe(1);
  });
  it('cambiar la fecha lo vuelve a dejar pendiente', async () => {
    const { IssueService } = await import('../src/lib/IssueService');
    await IssueService.update('r', { due_date: '2026-10-30' } as any, 'u', 0, 'duena');
    expect(db.prepare("SELECT reminded_at FROM issues WHERE id = 'r'").get().reminded_at).toBeNull();
  });
});

describe('tras una caída', () => {
  it('lo que venció hace más de una hora se marca sin mandar', () => {
    db.exec("INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, due_date, due_time, reminder_minutes) VALUES ('viejo','w','task','Viejo','u','todo','2026-10-20','10:00', 0)");
    const antes = avisos();
    const r = rec.procesarRecordatorios(new Date('2026-10-20T20:00:00Z'));
    expect(r.descartados).toBeGreaterThanOrEqual(1);
    expect(avisos()).toBe(antes);
    expect(db.prepare("SELECT reminded_at FROM issues WHERE id = 'viejo'").get().reminded_at).not.toBeNull();
  });
});

describe('a quién', () => {
  it('a la persona responsable, y se respeta el silencio total', () => {
    db.exec("INSERT INTO issues (id, workspace_id, type, title, reporter_id, assignee_id, status, due_date, reminder_minutes) VALUES ('asig','w','task','Para muda','u','m','todo','2026-10-21', 0)");
    rec.procesarRecordatorios(new Date('2026-10-21T14:05:00Z'));
    expect(avisos('m')).toBe(0);
    expect(db.prepare("SELECT reminded_at FROM issues WHERE id = 'asig'").get().reminded_at).not.toBeNull();
  });
});

describe('pertenencia', () => {
  it('a quien ya no es miembro del espacio no se le avisa; control: a quien sí', () => {
    db.exec(`
      INSERT INTO users (id, username, password_hash, timezone) VALUES ('fuera','fuera','x','UTC');
      INSERT INTO issues (id, workspace_id, type, title, reporter_id, assignee_id, status, due_date, reminder_minutes)
        VALUES ('ex','w','task','Secreto del espacio','u','fuera','todo','2026-11-02', 0),
               ('dentro','w','task','Para la duena','u','u','todo','2026-11-02', 0);
    `);
    rec.procesarRecordatorios(new Date('2026-11-02T14:05:00Z'));
    expect(avisos('fuera')).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'u' AND message LIKE 'Para la duena%'").get().n).toBe(1);
  });
});
