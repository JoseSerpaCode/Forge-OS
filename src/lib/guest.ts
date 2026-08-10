import db from './db';
import crypto from 'crypto';

/**
 * Cuánto dura una cuenta de invitado.
 *
 * Se exporta porque la interfaz **tiene que decírselo al usuario**: una cuenta
 * que caduca en silencio y se lleva el trabajo por delante es una trampa. El
 * aviso del hub y el correo de caducidad leen de aquí, así que el número que ve
 * el visitante nunca puede desmentir al que aplica el servidor.
 */
export const GUEST_LIFETIME_DAYS = 30;
const GUEST_LIFETIME_MS = GUEST_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

export type GuestSession = {
  sessionId: string;
  sysTag: string;
  expiresAt: number;
};

/**
 * Crea una cuenta de invitado con su espacio de trabajo y su sesión.
 *
 * Vivía en el middleware, donde se ejecutaba en **cada petición anónima**: una
 * simple visita escribía cuatro filas, y los bots —que no guardan cookies—
 * llegaron a generar 43.000 cuentas al día en producción.
 *
 * Ahora solo se llama desde `POST /api/auth/guest`, es decir, cuando alguien
 * pulsa deliberadamente «probar sin cuenta». Una visita ya no escribe nada.
 *
 * Todo va en una transacción: un invitado a medio crear dejaría un usuario sin
 * espacio de trabajo, y la app da por hecho que siempre tiene uno.
 */
export function createGuestSession(): GuestSession {
  const guestId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const wsId = crypto.randomUUID();
  const shortId = guestId.split('-')[0];
  const guestUsername = `Guest_${shortId}_${Math.floor(Math.random() * 1000)}`;
  const sysTag = `guest-${shortId}-${Math.floor(Math.random() * 1000)}`;
  const expiresAt = Date.now() + GUEST_LIFETIME_MS;

  db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, username, password_hash, is_guest) VALUES (?, ?, ?, 1)`
    ).run(guestId, guestUsername, 'guest');

    db.prepare(
      `INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?, ?, ?, ?)`
    ).run(wsId, 'My Workspace', sysTag, guestId);

    db.prepare(
      `INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, 'owner')`
    ).run(wsId, guestId);

    db.prepare(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
    ).run(sessionId, guestId, expiresAt);
  })();

  return { sessionId, sysTag, expiresAt };
}

/**
 * Días completos que le quedan a una sesión de invitado. Nunca negativo.
 *
 * Redondea hacia abajo a propósito: con 25 horas por delante la gente entiende
 * «queda 1 día», no 2. Redondeando hacia arriba el contador iba siempre uno por
 * encima y el aviso de «caduca hoy» no llegaba a mostrarse nunca, que es justo
 * el momento en que hace falta.
 */
export function guestDaysLeft(expiresAt: number): number {
  return Math.max(0, Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}
