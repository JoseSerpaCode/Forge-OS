import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Las transacciones de la aplicación empiezan con `BEGIN IMMEDIATE`.
 *
 * Con el `BEGIN` diferido de better-sqlite3, una transacción que lee y luego
 * escribe fallaba con «database is locked» —sin esperar el `busy_timeout`— si
 * otra conexión escribía entre medias. Pasaba al mover tarjetas (500 en
 * `/move`) mientras otro proceso escribía en la misma base.
 */
let tmp: string;
let db: any;
let otra: Database.Database;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-tx-'));
  process.env.DATABASE_URL = path.join(tmp, 'tx.db');
  process.env.NODE_ENV = 'test';
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  db.exec('CREATE TABLE IF NOT EXISTS prueba_tx (id INTEGER PRIMARY KEY, v INTEGER)');
  db.exec('INSERT INTO prueba_tx (id, v) VALUES (1, 0)');
  otra = new Database(process.env.DATABASE_URL);
  otra.pragma('busy_timeout = 0');
});

afterAll(() => {
  otra?.close();
  try { db?.close(); } catch { /* cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

/** Lee, deja que la otra conexión intente escribir, y escribe. */
const leerYEscribir = (tx: (fn: () => void) => () => void) => {
  let laOtraPudo = true;
  tx(() => {
    db.prepare('SELECT v FROM prueba_tx WHERE id = 1').get();
    try { otra.prepare('UPDATE prueba_tx SET v = v + 10 WHERE id = 1').run(); } catch { laOtraPudo = false; }
    db.prepare('UPDATE prueba_tx SET v = v + 1 WHERE id = 1').run();
  })();
  return laOtraPudo;
};

describe('transacciones', () => {
  it('diferida: si otra conexión escribe entre la lectura y la escritura, revienta', () => {
    expect(() => leerYEscribir((fn) => db.transaction(fn).deferred)).toThrow(/locked|busy/i);
  });

  it('por defecto es IMMEDIATE: la transacción gana y la otra conexión es la que espera', () => {
    let laOtraPudo = true;
    expect(() => { laOtraPudo = leerYEscribir((fn) => db.transaction(fn)); }).not.toThrow();
    expect(laOtraPudo).toBe(false);
  });

  it('una transacción dentro de otra sigue funcionando (SAVEPOINT)', () => {
    const interior = db.transaction(() => db.prepare('UPDATE prueba_tx SET v = 100 WHERE id = 1').run());
    db.transaction(() => { interior(); })();
    expect(db.prepare('SELECT v FROM prueba_tx WHERE id = 1').get()).toEqual({ v: 100 });
  });
});
