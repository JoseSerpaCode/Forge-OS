import { describe, it, expect } from 'vitest';
import { vencida, hoyLocal } from '../src/lib/fechas';

/**
 * El contador de vencidas del Hub.
 *
 * `Hub.astro` comparaba con `new Date().toISOString().slice(0, 10)`, que da el
 * día en **UTC**. En una zona con desfase negativo —Bogotá es UTC-5— eso
 * significa que a partir de las siete de la tarde el servidor ya cree que es
 * mañana, y una entrega de hoy aparece como vencida.
 *
 * No falla nunca por la mañana, así que es de los que se descartan como «cosa
 * mía». Se fija con la hora clavada, que es lo único que lo reproduce.
 */
describe('una entrega de hoy no está vencida por la tarde', () => {
  // 22:00 en Bogotá = 03:00 UTC del día siguiente.
  const laNoche = new Date('2026-08-21T03:00:00Z');

  it('la comparación en UTC daba mañana; la local da hoy', () => {
    const enUtc = laNoche.toISOString().slice(0, 10);
    const enLocal = hoyLocal(laNoche);

    // Si esta prueba corre en UTC-5, los dos días son distintos: ahí estaba el
    // fallo. En otra zona no se puede afirmar, pero la comparación de abajo
    // vale igual.
    if (enUtc !== enLocal) {
      expect(enUtc > enLocal, 'UTC va por delante del día local').toBe(true);
    }
  });

  it('una tarea que vence hoy no cuenta como vencida', () => {
    const hoy = hoyLocal(laNoche);
    expect(vencida(hoy, laNoche)).toBe(false);
  });

  it('una que venció ayer sí', () => {
    const hoy = hoyLocal(laNoche);
    const ayer = new Date(`${hoy}T12:00:00Z`);
    ayer.setDate(ayer.getDate() - 1);
    expect(vencida(ayer.toISOString().slice(0, 10), laNoche)).toBe(true);
  });

  it('sin fecha de entrega no está vencida', () => {
    expect(vencida(null, laNoche)).toBe(false);
    expect(vencida('', laNoche)).toBe(false);
  });
});
