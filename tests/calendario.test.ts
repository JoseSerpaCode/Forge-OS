import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * El calendario `.ics` de solo lectura.
 *
 * Tres cosas que no pueden fallar: que el fichero sea un iCalendar válido (lo
 * lee Google, no una persona), que una entrega con hora caiga en su hora para
 * quien la apuntó, y que el enlace deje de enseñar un espacio en cuanto la
 * persona deja de ser miembro.
 */
let tmp: string;
let db: any;
let cal: typeof import('../src/lib/calendario');

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-cal-'));
  process.env.DATABASE_URL = path.join(tmp, 'cal.db');
  process.env.NODE_ENV = 'test';
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  cal = await import('../src/lib/calendario');
  db.exec(`
    INSERT INTO users (id, username, password_hash, timezone) VALUES ('u','duena','x','America/Bogota');
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w','Uni','uni','u'), ('w2','Otro','otro','u');
    INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('w','u','owner'), ('w2','u','owner');
    INSERT INTO issues (id, workspace_id, type, title, description, reporter_id, status, due_date, due_time) VALUES
      ('a','w','task','Entregar informe; versión final, con anexos','Notas privadas','u','todo','2026-10-23','18:00'),
      ('b','w','task','Leer tema 4','','u','todo','2026-10-24',NULL),
      ('c','w','task','Hecha','','u','done','2026-10-20',NULL),
      ('d','w2','task','Del otro espacio','','u','todo','2026-10-25',NULL);
  `);
});

afterAll(() => {
  try { db?.close(); } catch { /* cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

const desplegar = (ics: string) => ics.replace(/\r\n[ \t]/g, '');

describe('el fichero', () => {
  it('es iCalendar: CRLF, líneas de 75 octetos como mucho, UID estable y sin descripción', () => {
    const { token } = cal.crearFeed('u', null);
    const feed = cal.feedPorToken(token)!;
    const ics = cal.generarIcs(cal.tareasDelFeed(feed), 'America/Bogota', 'https://forge.test', new Date('2026-10-20T12:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75)).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    const plano = desplegar(ics);
    expect(plano).toContain('UID:a@forge-os');
    expect(plano).toContain('SUMMARY:Entregar informe\\; versión final\\, con anexos');
    expect(plano).not.toContain('Notas privadas');
    expect(plano).not.toContain('Hecha');
  });

  it('con hora: 18:00 en Bogotá son las 23:00 UTC; sin hora: día completo', () => {
    const { token } = cal.crearFeed('u', 'w');
    const ics = desplegar(cal.generarIcs(cal.tareasDelFeed(cal.feedPorToken(token)!), 'America/Bogota', 'https://forge.test'));
    expect(ics).toContain('DTSTART:20261023T230000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261024');
    expect(ics).toContain('DTEND;VALUE=DATE:20261025');
  });
});

describe('el enlace', () => {
  it('uno de un espacio no enseña los demás; uno general, todos', () => {
    const solo = cal.tareasDelFeed(cal.feedPorToken(cal.crearFeed('u', 'w').token)!).map((t: any) => t.id);
    expect(solo).not.toContain('d');
    const todos = cal.tareasDelFeed(cal.feedPorToken(cal.crearFeed('u', null).token)!).map((t: any) => t.id);
    expect(todos).toContain('d');
  });

  it('al salir de un espacio, sus tareas desaparecen del mismo enlace', () => {
    const feed = cal.feedPorToken(cal.crearFeed('u', null).token)!;
    expect(cal.tareasDelFeed(feed).map((t: any) => t.id)).toContain('d');
    db.exec("DELETE FROM workspace_members WHERE workspace_id = 'w2' AND user_id = 'u'");
    expect(cal.tareasDelFeed(feed).map((t: any) => t.id)).not.toContain('d');
  });

  it('se guarda solo el hash; revocado, el token ya no sirve', () => {
    const { id, token } = cal.crearFeed('u', null);
    expect(db.prepare('SELECT COUNT(*) AS n FROM calendar_feeds WHERE token_hash = ?').get(token).n).toBe(0);
    expect(cal.feedPorToken(token)).toBeTruthy();
    expect(cal.revocar('u', id)).toBe(true);
    expect(cal.feedPorToken(token)).toBeNull();
    expect(cal.feedPorToken('inventado')).toBeNull();
  });
});
