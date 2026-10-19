import crypto from 'crypto';
import webpush from 'web-push';
import db from './db';

/**
 * Avisos Web Push: el recordatorio llega aunque Forge esté cerrado.
 *
 * El servidor habla con el servicio de push del navegador (el de Google, el de
 * Mozilla…); el navegador no carga nada de fuera. La promesa de «sin scripts de
 * terceros» sigue en pie.
 *
 * Hace falta un par de claves VAPID en el entorno (`VAPID_PUBLIC_KEY`,
 * `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; ver `deploy/README.md`). Sin ellas la
 * función está apagada: no se ofrece en Ajustes y no se manda nada.
 */

let configurado: boolean | null = null;

export function pushDisponible(): boolean {
  if (configurado !== null) return configurado;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return (configurado = false);
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configurado = true;
  } catch (err) {
    console.error('[push] claves VAPID no válidas:', err);
    configurado = false;
  }
  return configurado;
}

export const clavePublica = () => (pushDisponible() ? process.env.VAPID_PUBLIC_KEY! : null);

/** Solo para pruebas: volver a leer el entorno. */
export const reiniciarConfiguracion = () => { configurado = null; };

export interface Suscripcion { endpoint: string; keys: { p256dh: string; auth: string } }

/**
 * Los servicios de push de los navegadores. El servidor solo habla con estos.
 *
 * El endpoint lo manda el cliente, así que sin esta lista el servidor haría
 * peticiones a donde le dijeran: a `localhost`, a la red interna de la máquina
 * o a un dominio que resuelva a ella. Descartar IPs privadas a mano se queda
 * corto —`172.16/12`, IPv6, nombres que resuelven por dentro—; una lista de
 * los que existen de verdad no.
 */
const SERVICIOS_PUSH = [
  'fcm.googleapis.com',               // Chrome, Edge, Brave, Opera, Android
  'updates.push.services.mozilla.com', // Firefox
  'push.apple.com',                   // Safari (web.push.apple.com)
  'notify.windows.com',               // Edge en Windows (wns2-*.notify.windows.com)
];
const esServicioPush = (host: string) =>
  SERVICIOS_PUSH.some((d) => host === d || host.endsWith(`.${d}`));

/** Dispositivos por cuenta. Cada uno es una petición por recordatorio. */
export const MAX_SUSCRIPCIONES = 10;

/**
 * Lo que manda el navegador, comprobado: una URL `https` de un servicio de push
 * conocido y dos claves en base64url.
 */
export function esSuscripcion(v: unknown): v is Suscripcion {
  const s = v as Suscripcion;
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1000 || !s.keys) return false;
  let url: URL;
  try { url = new URL(s.endpoint); } catch { return false; }
  if (url.protocol !== 'https:' || url.port !== '' || !esServicioPush(url.hostname)) return false;
  const b64 = /^[A-Za-z0-9_-]{8,200}={0,2}$/;
  return typeof s.keys.p256dh === 'string' && b64.test(s.keys.p256dh) && typeof s.keys.auth === 'string' && b64.test(s.keys.auth);
}

export function guardarSuscripcion(userId: string, s: Suscripcion) {
  db.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
  `).run(crypto.randomUUID(), userId, s.endpoint, s.keys.p256dh, s.keys.auth);
  // Como mucho MAX_SUSCRIPCIONES por cuenta: sin tope, una cuenta podía
  // registrar cientos y hacer que el servidor mandara cientos de peticiones
  // por cada recordatorio. Se queda con las más recientes.
  db.prepare(`
    DELETE FROM push_subscriptions WHERE user_id = ? AND id NOT IN (
      SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?
    )
  `).run(userId, userId, MAX_SUSCRIPCIONES);
}

/** Solo las propias: el endpoint de otra persona no se puede dar de baja desde aquí. */
export function borrarSuscripcion(userId: string, endpoint: string): boolean {
  return db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint).changes > 0;
}

export const cuantasSuscripciones = (userId: string) =>
  (db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?').get(userId) as any).n as number;

/**
 * Mandar un aviso a todos los dispositivos de una persona.
 *
 * Un 404 o un 410 del servicio de push significa que esa suscripción ya no
 * existe (se desinstaló el navegador, se quitó el permiso): se borra, o se
 * seguiría intentando para siempre.
 */
export async function enviarPush(userId: string, aviso: { title: string; body: string; url?: string }): Promise<number> {
  if (!pushDisponible()) return 0;
  const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId) as Array<{ endpoint: string; p256dh: string; auth: string }>;
  let enviados = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), { TTL: 60 * 60 });
      enviados++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(s.endpoint);
      } else {
        console.error('[push] no se pudo enviar:', err?.statusCode ?? err);
      }
    }
  }
  return enviados;
}
