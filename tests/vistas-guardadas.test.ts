import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Vistas guardadas: solo claves conocidas, solo las propias y fuera con la
 * cuenta.
 */
let tmp: string;
let db: any;
let vistas: typeof import('../src/lib/vistasGuardadas');

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-vistas-'));
  process.env.DATABASE_URL = path.join(tmp, 'vistas.db');
  process.env.NODE_ENV = 'test';
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  vistas = await import('../src/lib/vistasGuardadas');
  db.exec(`
    INSERT INTO users (id, username, password_hash) VALUES ('ana','ana','x'), ('bea','bea','x');
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w','W','w','ana');
  `);
});

afterAll(() => {
  try { db?.close(); } catch { /* cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe('lista blanca', () => {
  it('limpiar se queda solo con lo válido', () => {
    expect(vistas.limpiarConsulta({ vista: 'hoy', prioridad: 'high', vence: 7, label: 'lab-1', sql: 'DROP TABLE', vence2: 3 }))
      .toEqual({ vista: 'hoy', prioridad: 'high', vence: 7, label: 'lab-1' });
    expect(vistas.limpiarConsulta({ vence: 999, prioridad: 'urgentisima', label: "x' OR 1=1" })).toEqual({});
  });

  it('una clave desconocida al guardar es un error, no se descarta en silencio', () => {
    expect(vistas.crear('ana', 'w', 'Mala', { sql: 'x' })).toEqual({ ok: false, error: 'clave_desconocida' });
    expect(vistas.crear('ana', 'w', 'Buena', { vista: 'proximos', label: 'l1' }).ok).toBe(true);
  });

  it('lo que haya en la base se vuelve a limpiar al leer', () => {
    db.prepare("INSERT INTO saved_views (id, workspace_id, user_id, name, query_json) VALUES ('rota','w','ana','Rota', ?)")
      .run(JSON.stringify({ vista: 'hoy', inyectado: '<script>' }));
    const rota = vistas.listar('ana', 'w', 'w').find((v) => v.id === 'rota')!;
    expect(rota.query).toEqual({ vista: 'hoy' });
    expect(rota.url).toBe('/w/w/board?vista=hoy');
  });
});

describe('son personales', () => {
  it('bea no ve ni borra las de ana; ana sí', () => {
    const { id } = vistas.crear('ana', 'w', 'De Ana', { prioridad: 'low' }) as { ok: true; id: string };
    expect(vistas.listar('bea', 'w', 'w').map((v) => v.id)).not.toContain(id);
    expect(vistas.borrar('bea', 'w', id)).toBe(false);
    // Control: la dueña.
    expect(vistas.borrar('ana', 'w', id)).toBe(true);
  });

  it('se van con la cuenta (CASCADE)', () => {
    vistas.crear('bea', 'w', 'De Bea', { vista: 'hoy' });
    db.exec("DELETE FROM users WHERE id = 'bea'");
    expect(db.prepare("SELECT COUNT(*) AS n FROM saved_views WHERE user_id = 'bea'").get().n).toBe(0);
  });
});
