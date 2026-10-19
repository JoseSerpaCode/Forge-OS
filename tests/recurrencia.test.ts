import { describe, it, expect } from 'vitest';
import { leerRegla, esRegla, siguiente, primera, describir } from '../src/lib/recurrencia';

/**
 * Las reglas de repetición, con fechas fijas.
 *
 * Martes 20 de octubre de 2026 es «hoy» en todos los casos.
 */
const HOY = '2026-10-20';

describe('leer y validar', () => {
  it('acepta los cuatro formatos y normaliza el orden de los días', () => {
    expect(leerRegla('d:3')).toEqual({ tipo: 'd', cada: 3 });
    expect(leerRegla('w:1:TH,MO')).toEqual({ tipo: 'w', cada: 1, dias: ['MO', 'TH'] });
    expect(leerRegla('m:1:15')).toEqual({ tipo: 'm', cada: 1, dia: 15 });
    expect(leerRegla('m:2:-1')).toEqual({ tipo: 'm', cada: 2, dia: -1 });
  });

  it('rechaza lo que no se puede validar', () => {
    for (const malo of ['', 'd:0', 'd:-1', 'd:100', 'w:1:', 'w:1:XX', 'm:1:32', 'm:1:0', 'cada lunes', 'x:1', null, 7]) {
      expect(esRegla(malo), String(malo)).toBe(false);
    }
  });
});

describe('la siguiente fecha', () => {
  it('cada lunes, completada el miércoles: el lunes siguiente', () => {
    expect(siguiente('w:1:MO', '2026-10-19', '2026-10-21')).toBe('2026-10-26');
  });

  it('con tres semanas de retraso: la primera futura, una sola', () => {
    expect(siguiente('w:1:MO', '2026-09-28', HOY)).toBe('2026-10-26');
  });

  it('completada antes de tiempo: la siguiente a la prevista, no a hoy', () => {
    expect(siguiente('w:1:FR', '2026-10-23', HOY)).toBe('2026-10-30');
  });

  it('cada lunes y jueves', () => {
    expect(siguiente('w:1:MO,TH', '2026-10-19', '2026-10-19')).toBe('2026-10-22');
    expect(siguiente('w:1:MO,TH', '2026-10-22', '2026-10-22')).toBe('2026-10-26');
  });

  it('cada 2 semanas cuenta desde la semana de la prevista', () => {
    expect(siguiente('w:2:MO', '2026-10-19', '2026-10-19')).toBe('2026-11-02');
  });

  it('cada 3 días, desde la prevista', () => {
    expect(siguiente('d:3', '2026-10-20', '2026-10-20')).toBe('2026-10-23');
    expect(siguiente('d:3', '2026-10-10', HOY)).toBe('2026-10-22');
  });

  it('el 31 cada mes cae en el último día de los meses cortos', () => {
    expect(siguiente('m:1:31', '2027-01-31', '2027-01-31')).toBe('2027-02-28');
    expect(siguiente('m:1:31', '2028-01-31', '2028-01-31')).toBe('2028-02-29');
  });

  it('fin de mes y cruce de año', () => {
    expect(siguiente('m:1:-1', '2026-12-31', '2026-12-31')).toBe('2027-01-31');
  });

  it('una regla mala o una fecha mala no dan fecha', () => {
    expect(siguiente('w:1:XX', '2026-10-19', HOY)).toBeNull();
    expect(siguiente('d:1', 'mañana', HOY)).toBeNull();
  });
});

describe('la primera, para una tarea sin fecha', () => {
  it('cada lunes, un martes: el lunes que viene; un lunes: hoy', () => {
    expect(primera('w:1:MO', HOY)).toBe('2026-10-26');
    expect(primera('w:1:MO', '2026-10-19')).toBe('2026-10-19');
    expect(primera('d:1', HOY)).toBe(HOY);
    expect(primera('m:1:15', HOY)).toBe('2026-11-15');
  });
});

describe('en palabras', () => {
  it('español e inglés', () => {
    expect(describir('w:1:MO,TH', 'es')).toBe('cada lunes y jueves');
    expect(describir('w:2:MO', 'es')).toBe('cada 2 semanas, el lunes');
    expect(describir('d:1', 'es')).toBe('cada día');
    expect(describir('m:1:-1', 'es')).toBe('cada fin de mes');
    expect(describir('m:1:15', 'es')).toBe('el día 15 de cada mes');
    expect(describir('w:1:FR', 'en')).toBe('every Friday');
    expect(describir('basura', 'es')).toBe('');
  });
});
