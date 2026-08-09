import db from './db';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 15;

export type RateLimitOptions = {
  /** Duración de la ventana en ms. Por defecto 15 minutos. */
  windowMs?: number;
  /** Peticiones permitidas dentro de la ventana. Por defecto 15. */
  max?: number;
};

/**
 * Persistent SQLite-backed rate limiter.
 * Unlike an in-memory Map, counters survive process restarts — making brute-force
 * protection effective even when the server is cycled frequently.
 *
 * Interface is intentionally identical to the previous in-memory version so
 * callers (login.ts, register.ts) require zero changes; los límites solo se
 * parametrizan cuando hacen falta otros, como en la creación de invitados.
 *
 * Usa siempre `getClientIp()` (src/lib/clientIp.ts) para construir la clave: leer
 * la IP de `X-Forwarded-For` a la ligera permite saltarse el límite falseando la
 * cabecera.
 */
export function checkRateLimit(key: string, options: RateLimitOptions = {}): { allowed: boolean; retryAfter?: number } {
  if (process.env.NODE_ENV === 'test') {
    return { allowed: true };
  }

  const windowMs = options.windowMs ?? WINDOW_MS;
  const max = options.max ?? MAX_ATTEMPTS;
  const now = Date.now();

  const existing = db.prepare(
    'SELECT count, reset_at FROM rate_limit_attempts WHERE key = ?'
  ).get(key) as { count: number; reset_at: number } | undefined;

  // No record or window has expired — start a fresh window
  if (!existing || existing.reset_at < now) {
    db.prepare(
      'INSERT OR REPLACE INTO rate_limit_attempts (key, count, reset_at) VALUES (?, 1, ?)'
    ).run(key, now + windowMs);
    return { allowed: true };
  }

  // Window active and limit reached
  if (existing.count >= max) {
    const retryAfter = Math.ceil((existing.reset_at - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Window active, increment counter
  db.prepare(
    'UPDATE rate_limit_attempts SET count = count + 1 WHERE key = ?'
  ).run(key);
  return { allowed: true };
}

// Purge expired entries on module load and every 30 minutes
function purgeExpired(): void {
  db.prepare('DELETE FROM rate_limit_attempts WHERE reset_at < ?').run(Date.now());
}
purgeExpired();
setInterval(purgeExpired, 30 * 60 * 1000);
