import { describe, it, expect } from 'vitest';
import { normalizarHora } from '../src/lib/hora';

/**
 * Una sola forma de leer la hora de entrega. El alta exigía dos cifras y
 * rechazaba «9:00»; el panel lo aceptaba. Ahora las dos, y el servidor, usan
 * esta función.
 */
describe('normalizarHora', () => {
  it('acepta una o dos cifras, con o sin minutos y con varios separadores', () => {
    for (const [entrada, salida] of [
      ['9', '09:00'], ['9:00', '09:00'], ['09:00', '09:00'], ['8:30', '08:30'], ['930', '09:30'],
      ['0930', '09:30'], ['9.30', '09:30'], ['9h30', '09:30'], ['18', '18:00'], [' 23:59 ', '23:59'], ['0:00', '00:00'],
    ]) {
      expect(normalizarHora(entrada), entrada).toBe(salida);
    }
  });
  it('vacío es «sin hora», y lo que no es una hora es null', () => {
    expect(normalizarHora('')).toBe('');
    expect(normalizarHora('   ')).toBe('');
    expect(normalizarHora(null)).toBe('');
    for (const malo of ['24:00', '9:60', '9:5', 'nueve', '12345', '9:00 pm', 42]) {
      expect(normalizarHora(malo), String(malo)).toBeNull();
    }
  });
});
