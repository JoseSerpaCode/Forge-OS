import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Forge para usarlo a solas: auditoría, automatizaciones y lo social pasan a
 * encenderse a mano.
 *
 * Lo importante es la regla del despliegue: **nadie pierde de vista algo que ya
 * usaba**. Las migraciones 51 y 52 se aplican aquí sobre datos «de antes», igual
 * que pasará en producción.
 */

let tmp: string;
let ruta: string;
let db: any;
let funcionesMod: typeof import('../src/lib/funcionesEspacio');
let social: typeof import('../src/lib/social');
let automationsApi: typeof import('../src/pages/api/automations/index');

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-limpieza-'));
  ruta = path.join(tmp, 'limpieza.db');
  process.env.DATABASE_URL = ruta;
  process.env.NODE_ENV = 'test';

  vi.resetModules();
  (await import('../src/lib/db')).default.close();

  const crudo = new Database(ruta);
  crudo.pragma('foreign_keys = OFF');
  crudo.exec(`
    INSERT INTO users (id, username, password_hash) VALUES
      ('u-sola','sola','x'), ('u-amiga','amiga','x'), ('u-otra','otra','x'), ('u-bloquea','bloquea','x');
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES
      ('w-solo','Solo','w-solo','u-sola'), ('w-equipo','Equipo','w-equipo','u-sola'), ('w-reglas','Reglas','w-reglas','u-sola');
    INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES
      ('w-solo','u-sola','owner'), ('w-equipo','u-sola','owner'), ('w-equipo','u-otra','editor'), ('w-reglas','u-sola','owner');
    INSERT INTO automations (id, workspace_id, name, trigger_type, trigger_condition, action_type, action_payload, is_active)
      VALUES ('a1','w-reglas','Regla','issue_status_changed','{"to_status":"done"}','webhook','{"url":"https://example.com"}',1);
    INSERT INTO friendships (user_a_id, user_b_id, status, action_user_id) VALUES ('u-amiga','u-otra','accepted','u-amiga');
    INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ('u-bloquea','u-sola');
    UPDATE workspaces SET feat_automations = 0, feat_audit = 0;
    UPDATE users SET social_enabled = 0;
    DELETE FROM schema_migrations WHERE version IN (51, 52);
  `);
  crudo.close();

  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  funcionesMod = await import('../src/lib/funcionesEspacio');
  social = await import('../src/lib/social');
  automationsApi = await import('../src/pages/api/automations/index');
});

afterAll(() => {
  try { db?.close(); } catch { /* ya cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('migración 51: automatizaciones y auditoría', () => {
  it('un espacio de una persona sin reglas las tiene apagadas', () => {
    expect(funcionesMod.funciones('w-solo')).toMatchObject({ automatizaciones: false, auditoria: false });
  });

  it('donde ya había reglas, las automatizaciones siguen encendidas', () => {
    expect(funcionesMod.funciones('w-reglas').automatizaciones).toBe(true);
  });

  it('donde trabaja más de una persona, la auditoría sigue encendida', () => {
    expect(funcionesMod.funciones('w-equipo').auditoria).toBe(true);
  });
});

describe('migración 52: lo social', () => {
  const social_ = (id: string) => (db.prepare('SELECT social_enabled FROM users WHERE id = ?').get(id) as any).social_enabled;

  it('quien no lo usaba lo tiene apagado', () => {
    expect(social_('u-sola')).toBe(0);
  });

  it('quien tenía amistades o bloqueos lo conserva', () => {
    expect(social_('u-amiga')).toBe(1);
    expect(social_('u-otra')).toBe(1);
    expect(social_('u-bloquea')).toBe(1);
  });
});

describe('canInteractSocially con lo social apagado', () => {
  const on = { is_guest: 0, social_enabled: 1 };
  const off = { is_guest: 0, social_enabled: 0 };

  it('deniega en los dos sentidos, como con un invitado', () => {
    expect(social.canInteractSocially(off, on)).toBe(false);
    expect(social.canInteractSocially(on, off)).toBe(false);
  });

  it('con los dos encendidos, se puede', () => {
    expect(social.canInteractSocially(on, on)).toBe(true);
  });

  it('sin el dato no deniega, para no romper a quien no lo lea', () => {
    expect(social.canInteractSocially({ is_guest: 0 }, { is_guest: 0 })).toBe(true);
  });
});

describe('automatizaciones apagadas', () => {
  const crear = (workspaceId: string) =>
    automationsApi.POST({
      request: new Request('http://localhost/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId, name: 'Nueva', trigger_type: 'issue_status_changed',
          trigger_condition: '{"to_status":"done"}', action_type: 'webhook', action_payload: '{"url":"https://example.com"}',
        }),
      }),
      locals: { user: { id: 'u-sola', is_sysadmin: 0, is_guest: 0 } },
    } as any) as Promise<Response>;

  it('no se pueden crear reglas', async () => {
    const r = await crear('w-solo');
    expect(r.status).toBe(403);
    expect((await r.json()).error_code).toBe('feature_disabled');
  });

  it('control: encendidas, sí', async () => {
    expect((await crear('w-reglas')).status).toBe(201);
  });
});
