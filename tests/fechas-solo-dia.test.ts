import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { deSQLite, fecha, diaDeCalendario, vencida, hoyLocal } from '../src/lib/fechas';

/**
 * Las fechas de entrega salían un día antes en Colombia.
 *
 * `issues.due_date` se guarda como `'2026-09-09'`: un día del calendario, sin
 * hora ni zona. `deSQLite()` le añadía la `Z` que sí necesitan las marcas de
 * `CURRENT_TIMESTAMP`, así que pasaba a medianoche **UTC**, y en Bogotá
 * (UTC−5) eso son las siete de la tarde del día 8. La tarjeta enseñaba
 * «Sep 8, 2026» para una entrega del 9.
 *
 * En la máquina de quien lo escribió no se veía distinto según la hora: se
 * veía mal siempre, pero solo al oeste de Greenwich. Por eso cada caso se
 * corre en dos zonas, una a cada lado: Bogotá (−5) y Tokio (+9). Un arreglo que
 * solo funcione en una de ellas —p. ej. restar el desfase a mano— cae en la otra.
 */
const ZONAS = ['America/Bogota', 'Asia/Tokyo'] as const;
const DESFASE_MIN = { 'America/Bogota': 300, 'Asia/Tokyo': -540 } as const;

describe.each(ZONAS)('fechas solo-día en %s', (zona) => {
  let previa: string | undefined;

  beforeAll(() => {
    previa = process.env.TZ;
    process.env.TZ = zona;
    // Si el cambio de zona no llegara a aplicarse, estas pruebas pasarían en
    // la zona de la máquina y no demostrarían nada. Se comprueba primero.
    expect(new Date(2026, 8, 9).getTimezoneOffset(), `TZ=${zona} no se aplicó`).toBe(DESFASE_MIN[zona]);
  });

  afterAll(() => {
    if (previa === undefined) delete process.env.TZ;
    else process.env.TZ = previa;
  });

  it('se lee como ese día en la zona local, no como medianoche UTC', () => {
    const d = deSQLite('2026-09-09')!;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 9]);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });

  it('se formatea como el día que se guardó, en los dos idiomas', () => {
    expect(fecha('2026-09-09', 'en')).toBe('Sep 9, 2026');
    expect(fecha('2026-09-09', 'es')).toMatch(/^9 sept? 2026$/);
  });

  it('los bordes del año no se cruzan', () => {
    // El 1 de enero en Bogotá salía «Dec 31, 2025»: cambiaba hasta el año.
    expect(fecha('2026-01-01', 'en')).toBe('Jan 1, 2026');
    expect(fecha('2026-12-31', 'en')).toBe('Dec 31, 2026');
  });

  it('el día de calendario sale tal cual, para el <input type="date">', () => {
    expect(diaDeCalendario('2026-09-09')).toBe('2026-09-09');
    expect(diaDeCalendario(' 2026-09-09 ')).toBe('2026-09-09');
  });

  it('vence el día siguiente, no antes ni después', () => {
    expect(vencida('2026-09-09', new Date(2026, 8, 9, 0, 1))).toBe(false);
    expect(vencida('2026-09-09', new Date(2026, 8, 9, 23, 59))).toBe(false);
    expect(vencida('2026-09-09', new Date(2026, 8, 10, 0, 1))).toBe(true);
  });

  it('un día que no existe es ilegible, no el 2 de marzo', () => {
    expect(deSQLite('2026-02-30')).toBeNull();
    expect(fecha('2026-02-30')).toBe('—');
    expect(diaDeCalendario('2026-02-30')).toBeNull();
  });

  it('las marcas de CURRENT_TIMESTAMP siguen siendo UTC', () => {
    // Lo que no es solo-día no cambia: sigue llevando su `Z`.
    expect(deSQLite('2026-09-09 03:00:00')!.toISOString()).toBe('2026-09-09T03:00:00.000Z');
  });

  it('una marca de tiempo da el día local de ese instante', () => {
    // 03:00 UTC del 9 es el 8 por la noche en Bogotá y el 9 por la mañana en Tokio.
    const esperado = zona === 'America/Bogota' ? '2026-09-08' : '2026-09-09';
    expect(diaDeCalendario('2026-09-09 03:00:00')).toBe(esperado);
    expect(hoyLocal(deSQLite('2026-09-09 03:00:00')!)).toBe(esperado);
  });
});
