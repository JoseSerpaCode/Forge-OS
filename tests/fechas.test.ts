import { describe, it, expect } from 'vitest';
import { deSQLite, fecha, relativo, hoyLocal, vencida } from '../src/lib/fechas';

/**
 * El desfase que veía el usuario.
 *
 * SQLite guarda `'2026-08-17 14:13:06'` en UTC y sin decirlo. `new Date(x)`
 * sobre esa cadena la interpreta como hora **local**, así que la misma
 * notificación mostraba una hora en el HTML servido y otra tras refrescarse por
 * fetch: la diferencia era el desfase del navegador.
 */
describe('leer lo que guarda SQLite', () => {
  it('una cadena sin zona se lee como UTC, no como hora local', () => {
    const d = deSQLite('2026-08-17 14:13:06')!;
    expect(d.toISOString()).toBe('2026-08-17T14:13:06.000Z');
  });

  it('da igual que venga con T o con espacio', () => {
    expect(deSQLite('2026-08-17T14:13:06')!.toISOString())
      .toBe(deSQLite('2026-08-17 14:13:06')!.toISOString());
  });

  it('si ya trae zona, no se le añade otra', () => {
    // Tocar una fecha que ya dice su zona la movería.
    expect(deSQLite('2026-08-17T14:13:06Z')!.toISOString()).toBe('2026-08-17T14:13:06.000Z');
    expect(deSQLite('2026-08-17T09:13:06-05:00')!.toISOString()).toBe('2026-08-17T14:13:06.000Z');
  });

  it('lo ilegible da null, no un Invalid Date', () => {
    // Un `Invalid Date` se propaga y acaba pintando «NaN» en pantalla.
    for (const malo of ['', '   ', 'ayer', null, undefined, {}]) {
      expect(deSQLite(malo as any)).toBeNull();
    }
  });
});

describe('formato según el idioma', () => {
  it('no está clavado a inglés', () => {
    const en = fecha('2026-08-17 14:13:06', 'en');
    const es = fecha('2026-08-17 14:13:06', 'es');
    expect(en).not.toBe(es);
    expect(en).toMatch(/Aug/);
    expect(es).toMatch(/ago/);
  });

  it('lo que no se puede leer sale como raya, no como error', () => {
    expect(fecha(null)).toBe('—');
  });
});

describe('tiempo relativo', () => {
  const ahora = new Date('2026-08-17T12:00:00Z');

  it('traduce solo', () => {
    const hace2h = '2026-08-17 10:00:00';
    expect(relativo(hace2h, 'en', ahora)).toMatch(/hour/);
    expect(relativo(hace2h, 'es', ahora)).toMatch(/hora/);
  });

  it('el futuro no sale como «hace -3 días»', () => {
    const dentroDe3d = '2026-08-20 12:00:00';
    const r = relativo(dentroDe3d, 'es', ahora);
    expect(r).not.toContain('-');
    expect(r).toMatch(/dentro de|en /);
  });

  it('escala de segundos a años', () => {
    expect(relativo('2026-08-17 11:59:30', 'en', ahora)).toMatch(/second/);
    expect(relativo('2026-08-16 12:00:00', 'en', ahora)).toMatch(/day|yesterday/);
    expect(relativo('2024-08-17 12:00:00', 'en', ahora)).toMatch(/year/);
  });
});

describe('vencimientos', () => {
  it('hoy no está vencido', () => {
    const ahora = new Date('2026-08-17T09:00:00');
    expect(vencida('2026-08-17', ahora)).toBe(false);
  });

  it('ayer sí', () => {
    const ahora = new Date('2026-08-17T09:00:00');
    expect(vencida('2026-08-16', ahora)).toBe(true);
  });

  it('el día de hoy se calcula en la zona de quien mira, no en UTC', () => {
    /**
     * A las 21:00 en Bogotá (UTC-5) ya son las 02:00 del día siguiente en UTC.
     * Con `toISOString().slice(0,10)` el «hoy» saltaría a mañana y marcaría como
     * vencido lo que vence justo hoy.
     */
    const nocheEnBogota = new Date(2026, 7, 17, 21, 0, 0); // 17 de agosto, local
    expect(hoyLocal(nocheEnBogota)).toBe('2026-08-17');
    expect(vencida('2026-08-17', nocheEnBogota)).toBe(false);
  });
});
