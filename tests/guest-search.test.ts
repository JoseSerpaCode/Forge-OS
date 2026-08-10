import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * La consulta de búsqueda de usuarios, tal cual la ejecuta
 * `src/pages/api/sys/state.ts`, contra una base de verdad.
 *
 * Se prueba el SQL y no un envoltorio porque la regla vive **dentro** de la
 * consulta: un `is_guest = 0` mal puesto respecto al `OR` del nombre exacto
 * deja pasar a todos los invitados, y eso no lo detecta ninguna prueba de la
 * función que la llama.
 */
const SQL = `
  SELECT username as title, 'user' as type, '/u/' || username as url
  FROM users
  WHERE id != 'system'
    AND (is_public = 1 OR id = ?)
    AND (
      (is_guest = 0 AND username LIKE ?)
      OR username = ?
    )
  LIMIT 5
`;

let db: Database.Database;
let file: string;

beforeAll(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-search-')), 't.db');
  db = new Database(file);
  db.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
    is_guest INTEGER DEFAULT 0, is_public INTEGER DEFAULT 1
  )`);
  const ins = db.prepare('INSERT INTO users (id, username, is_guest, is_public) VALUES (?, ?, ?, 1)');
  ins.run('system', 'Forge System', 0);
  ins.run('u1', 'avery', 0);
  ins.run('u2', 'avery_backup', 0);
  ins.run('g1', 'Guest_a3f9c210_447', 1);
  ins.run('g2', 'Guest_bb01de55_912', 1);
  ins.run('p1', 'hidden', 0);
  db.prepare('UPDATE users SET is_public = 0 WHERE id = ?').run('p1');
});

afterAll(() => db?.close());

const search = (q: string, asUser = 'u1') =>
  (db.prepare(SQL).all(asUser, `%${q}%`, q) as { title: string }[]).map((r) => r.title);

describe('los invitados no salen en las sugerencias', () => {
  it('una búsqueda parcial no los propone', () => {
    // 'Guest' es prefijo de todos los nombres de invitado: es exactamente lo
    // que alguien escribiría para listarlos.
    expect(search('Guest')).toEqual([]);
    expect(search('a3f9')).toEqual([]);
  });

  it('pero se les encuentra con el nombre entero', () => {
    expect(search('Guest_a3f9c210_447')).toEqual(['Guest_a3f9c210_447']);
  });

  it('el nombre entero devuelve solo a ese, no a los demás invitados', () => {
    expect(search('Guest_a3f9c210_447')).not.toContain('Guest_bb01de55_912');
  });

  it('las cuentas reales siguen apareciendo por coincidencia parcial', () => {
    expect(search('aver').sort()).toEqual(['avery', 'avery_backup']);
  });

  it('la cuenta del sistema nunca sale', () => {
    expect(search('Forge')).toEqual([]);
  });

  it('un perfil privado sigue oculto para otros', () => {
    expect(search('hidden')).toEqual([]);
    expect(search('hidden', 'p1')).toEqual(['hidden']);
  });
});
