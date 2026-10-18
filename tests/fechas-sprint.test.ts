import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { diasHasta } from '../src/lib/fechas';

/**
 * Las fechas de sprint y el día de las fotos del burndown.
 *
 * Es el mismo fallo que el de las fechas de entrega, en otros sitios:
 *
 *  - El resumen del espacio contaba los días que le quedan al sprint con
 *    `Math.ceil((new Date(end_date) - ahora) / 86400000)`. Con una fecha
 *    solo-día eso es la medianoche **UTC**, así que en Bogotá decía «termina
 *    hoy» desde las siete de la tarde del día anterior, y en Tokio, el último
 *    día por la mañana, todavía decía «termina en 1 día».
 *  - La foto diaria del burndown se guardaba con el día en UTC: desde las siete
 *    de la tarde en Bogotá, con la fecha de mañana.
 *
 * Como en `fechas-solo-dia.test.ts`, cada caso corre a los dos lados de
 * Greenwich.
 */
const ZONAS = ['America/Bogota', 'Asia/Tokyo'] as const;
const DESFASE_MIN = { 'America/Bogota': 300, 'Asia/Tokyo': -540 } as const;

const DB = path.join(process.cwd(), `forge_sprint_tz_${process.pid}.db`);
let db: any;
let snap: typeof import('../src/lib/sprintSnapshots');

beforeAll(async () => {
  fs.rmSync(DB, { force: true });
  process.env.DATABASE_URL = DB;
  process.env.NODE_ENV = 'test';
  snap = await import('../src/lib/sprintSnapshots');
  db = new Database(DB);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES ('u1','tz','x')").run();
  db.prepare("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w1','TZ','ws-tz','u1')").run();
  db.prepare("INSERT INTO sprints (id, workspace_id, name, status) VALUES ('s1','w1','S','active')").run();
});

afterAll(() => {
  db?.close();
  for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true });
});

describe.each(ZONAS)('fechas de sprint en %s', (zona) => {
  let previa: string | undefined;

  beforeAll(() => {
    previa = process.env.TZ;
    process.env.TZ = zona;
    expect(new Date(2026, 8, 9).getTimezoneOffset(), `TZ=${zona} no se aplicó`).toBe(DESFASE_MIN[zona]);
  });

  afterAll(() => {
    if (previa === undefined) delete process.env.TZ;
    else process.env.TZ = previa;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('el día anterior al fin quedan 1 día, a cualquier hora', () => {
    for (const hora of [0, 8, 12, 20, 23]) {
      expect(diasHasta('2026-09-09', new Date(2026, 8, 8, hora, 30)), `a las ${hora}:30`).toBe(1);
    }
  });

  it('el último día es «hoy» desde la medianoche hasta el final', () => {
    for (const hora of [0, 8, 12, 20, 23]) {
      expect(diasHasta('2026-09-09', new Date(2026, 8, 9, hora, 30)), `a las ${hora}:30`).toBe(0);
    }
  });

  it('un sprint terminado da días negativos, no cero', () => {
    // El resumen recorta a 0 con `Math.max`; la función no esconde el pasado.
    expect(diasHasta('2026-09-09', new Date(2026, 8, 12, 10))).toBe(-3);
  });

  it('cruza meses y años', () => {
    expect(diasHasta('2026-10-01', new Date(2026, 8, 30, 22))).toBe(1);
    expect(diasHasta('2027-01-01', new Date(2026, 11, 31, 23, 59))).toBe(1);
  });

  it('lo ilegible da null, no NaN', () => {
    expect(diasHasta(null)).toBeNull();
    expect(diasHasta('')).toBeNull();
    expect(diasHasta('2026-02-30')).toBeNull();
  });

  it('una marca de tiempo cuenta desde su día local', () => {
    // 03:00 UTC del 9: en Bogotá es todavía el 8 por la noche.
    const ahora = new Date(2026, 8, 8, 10);
    expect(diasHasta('2026-09-09T03:00:00Z', ahora)).toBe(zona === 'America/Bogota' ? 0 : 1);
  });

  it('la foto del burndown lleva el día local, no el de UTC', () => {
    // 01:00 UTC del 9 de septiembre: en Bogotá son las 20:00 del 8; en Tokio,
    // las 10:00 del 9. Con el día en UTC, la de Bogotá salía con fecha del 9.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-09T01:00:00Z'));

    const foto = snap.tomarFoto('s1');
    expect(foto.takenOn).toBe(zona === 'America/Bogota' ? '2026-09-08' : '2026-09-09');
  });
});

/**
 * Bogotá y Tokio no cambian de hora, así que un día de 23 o 25 horas no sale en
 * las pruebas de arriba. En Madrid, la noche del 24 al 25 de octubre de 2026 el
 * reloj se atrasa: restar instantes y dividir entre 24 horas da 2,04 días.
 */
describe('con cambio de hora (Europe/Madrid)', () => {
  let previa: string | undefined;
  beforeAll(() => {
    previa = process.env.TZ;
    process.env.TZ = 'Europe/Madrid';
    expect(new Date(2026, 9, 24).getTimezoneOffset()).toBe(-120);
    expect(new Date(2026, 9, 26).getTimezoneOffset()).toBe(-60);
  });
  afterAll(() => {
    if (previa === undefined) delete process.env.TZ;
    else process.env.TZ = previa;
  });

  it('cuenta los días del calendario, no bloques de 24 horas', () => {
    expect(diasHasta('2026-10-26', new Date(2026, 9, 24, 0, 0))).toBe(2);
    expect(diasHasta('2026-10-26', new Date(2026, 9, 24, 23, 59))).toBe(2);
  });
});
