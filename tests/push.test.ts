import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Avisos Web Push, con el servicio de push simulado: las pruebas no salen a
 * internet.
 */
const enviados: Array<{ endpoint: string; cuerpo: string }> = [];
let respuestaPorEndpoint: Record<string, number> = {};

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub: { endpoint: string }, cuerpo: string) => {
      const codigo = respuestaPorEndpoint[sub.endpoint];
      if (codigo) throw Object.assign(new Error('push'), { statusCode: codigo });
      enviados.push({ endpoint: sub.endpoint, cuerpo });
      return { statusCode: 201 };
    }),
  },
}));

let tmp: string;
let db: any;
let push: typeof import('../src/lib/push');
let rec: typeof import('../src/lib/recordatorios');

const sub = (n: string) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } });

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-push-'));
  process.env.DATABASE_URL = path.join(tmp, 'push.db');
  process.env.NODE_ENV = 'test';
  process.env.VAPID_PUBLIC_KEY = 'BClavePublicaDePrueba';
  process.env.VAPID_PRIVATE_KEY = 'ClavePrivadaDePrueba';
  process.env.VAPID_SUBJECT = 'mailto:pruebas@forge.test';
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  push = await import('../src/lib/push');
  rec = await import('../src/lib/recordatorios');
  push.reiniciarConfiguracion();
  db.exec(`
    INSERT INTO users (id, username, password_hash, timezone) VALUES ('u','duena','x','America/Bogota'), ('m','muda','x','UTC');
    UPDATE users SET notif_mute_all = 1 WHERE id = 'm';
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w','W','w','u');
    -- Los recordatorios solo van a quien sigue siendo miembro del espacio.
    INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('w','u','owner'), ('w','m','editor');
    INSERT INTO users (id, username, password_hash) VALUES ('tope','tope','x');
  `);
});

afterAll(() => {
  try { db?.close(); } catch { /* cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const k of ['DATABASE_URL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) delete process.env[k];
});

beforeEach(() => { enviados.length = 0; respuestaPorEndpoint = {}; });

describe('suscripciones', () => {
  it('solo https y a hosts públicos, con claves en base64url', () => {
    expect(push.esSuscripcion(sub('a'))).toBe(true);
    expect(push.esSuscripcion({ ...sub('a'), endpoint: 'http://fcm.googleapis.com/a' })).toBe(false);
    // Solo servicios de push conocidos: nada que el cliente invente.
    expect(push.esSuscripcion({ ...sub('a'), endpoint: 'https://push.ejemplo.com/a' })).toBe(false);
    expect(push.esSuscripcion({ ...sub('a'), endpoint: 'https://172.20.0.5/a' })).toBe(false);
    expect(push.esSuscripcion({ ...sub('a'), endpoint: 'https://[::1]/a' })).toBe(false);
    expect(push.esSuscripcion({ ...sub('a'), endpoint: 'https://evilfcm.googleapis.com/a' })).toBe(false);
    expect(push.esSuscripcion({ ...sub('a'), endpoint: 'https://fcm.googleapis.com.evil.com/a' })).toBe(false);
    expect(push.esSuscripcion({ ...sub('a'), endpoint: 'https://fcm.googleapis.com:8443/a' })).toBe(false);
    for (const ok of ['https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://wns2-par02p.notify.windows.com/w/?token=x']) {
      expect(push.esSuscripcion({ ...sub('a'), endpoint: ok }), ok).toBe(true);
    }
    expect(push.esSuscripcion({ ...sub('a'), endpoint: 'https://127.0.0.1/a' })).toBe(false);
    expect(push.esSuscripcion({ ...sub('a'), endpoint: 'https://localhost/a' })).toBe(false);
    expect(push.esSuscripcion({ ...sub('a'), keys: { p256dh: '<script>', auth: 'x' } })).toBe(false);
    expect(push.esSuscripcion(null)).toBe(false);
  });

  it('una persona no puede dar de baja la suscripción de otra', () => {
    push.guardarSuscripcion('u', sub('de-u'));
    expect(push.borrarSuscripcion('m', sub('de-u').endpoint)).toBe(false);
    // Control: la dueña sí.
    expect(push.borrarSuscripcion('u', sub('de-u').endpoint)).toBe(true);
  });
});

describe('enviar', () => {
  it('a todos los dispositivos; uno que ya no existe (410) se borra', async () => {
    push.guardarSuscripcion('u', sub('movil'));
    push.guardarSuscripcion('u', sub('viejo'));
    respuestaPorEndpoint[sub('viejo').endpoint] = 410;
    expect(await push.enviarPush('u', { title: 'Recordatorio', body: 'Informe' })).toBe(1);
    expect(db.prepare('SELECT endpoint FROM push_subscriptions WHERE user_id = ?').all('u').map((r: any) => r.endpoint)).toEqual([sub('movil').endpoint]);
  });

  it('sin claves VAPID no se manda nada', async () => {
    const guardada = process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    push.reiniciarConfiguracion();
    expect(push.clavePublica()).toBeNull();
    expect(await push.enviarPush('u', { title: 'x', body: 'y' })).toBe(0);
    process.env.VAPID_PRIVATE_KEY = guardada;
    push.reiniciarConfiguracion();
  });
});

describe('desde los recordatorios', () => {
  it('el recordatorio sale también por push; a quien tiene todo silenciado, por ningún lado', async () => {
    push.guardarSuscripcion('m', sub('de-m'));
    db.exec(`
      INSERT INTO issues (id, workspace_id, type, title, reporter_id, status, due_date, due_time, reminder_minutes) VALUES
        ('p1','w','task','Para la dueña','u','todo','2026-10-23','18:00', 60),
        ('p2','w','task','Para la muda','m','todo','2026-10-23','18:00', 60);
    `);
    rec.procesarRecordatorios(new Date('2026-10-23T22:00:30Z'));
    await new Promise((r) => setTimeout(r, 20));
    const cuerpos = enviados.map((e) => JSON.parse(e.cuerpo));
    expect(cuerpos.some((c) => c.body.includes('Para la dueña') && c.url.includes('issue=p1'))).toBe(true);
    expect(enviados.some((e) => e.endpoint === sub('de-m').endpoint)).toBe(false);
  });
});

describe('tope de dispositivos', () => {
  it(`una cuenta guarda como mucho ${10} suscripciones, las más recientes`, () => {
    for (let i = 0; i < 12; i++) push.guardarSuscripcion('tope', sub(`d${i}`));
    expect(push.cuantasSuscripciones('tope')).toBe(push.MAX_SUSCRIPCIONES);
    const quedan = db.prepare('SELECT endpoint FROM push_subscriptions WHERE user_id = ?').all('tope').map((r: any) => r.endpoint);
    expect(quedan).toContain(sub('d11').endpoint);
    expect(quedan).not.toContain(sub('d0').endpoint);
  });
});
