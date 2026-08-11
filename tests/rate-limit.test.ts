import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';

/**
 * El limitador de intentos, en el modo en que corre en producción.
 *
 * Se comprueba aquí y no con la suite e2e porque `checkRateLimit` **se
 * autodesactiva con NODE_ENV=test**, que es justo el modo en el que corren las
 * pruebas de extremo a extremo: allí veinte intentos fallidos seguidos pasan
 * sin bloqueo, y eso puede leerse como que no hay protección. La hay; lo que no
 * había era una prueba que lo demostrara.
 */
let checkRateLimit: any, tmp: string, antes: string | undefined;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-rl-'));
  process.env.DATABASE_URL = path.join(tmp, 'rl.db');
  antes = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  ({ checkRateLimit } = await import('../src/lib/rateLimit'));
});

afterAll(() => {
  process.env.NODE_ENV = antes;
  delete process.env.DATABASE_URL;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('límite de intentos', () => {
  it('bloquea a partir del intento 15 y dice cuánto esperar', () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 15; i++) {
      expect(checkRateLimit(ip).allowed, `el intento ${i + 1} debería pasar`).toBe(true);
    }
    const bloqueado = checkRateLimit(ip);
    expect(bloqueado.allowed).toBe(false);
    expect(bloqueado.retryAfter).toBeGreaterThan(0);
  });

  it('no castiga a otra IP por lo que hizo la primera', () => {
    expect(checkRateLimit('198.51.100.9').allowed).toBe(true);
  });

  it('se desactiva en modo test a propósito, para no bloquear la suite', async () => {
    process.env.NODE_ENV = 'test';
    const ip = '192.0.2.50';
    for (let i = 0; i < 30; i++) expect(checkRateLimit(ip).allowed).toBe(true);
    process.env.NODE_ENV = 'production';
  });
});
