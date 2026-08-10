import { describe, it, expect } from 'vitest';
import { canInteractSocially, socialBlockReason } from '../src/lib/social';

const real = { is_guest: 0 };
const guest = { is_guest: 1 };

describe('aislamiento social de los invitados', () => {
  it('dos cuentas reales pueden tratarse', () => {
    expect(canInteractSocially(real, real)).toBe(true);
  });

  it('un invitado no puede dirigir nada a nadie', () => {
    expect(canInteractSocially(guest, real)).toBe(false);
    expect(socialBlockReason(guest, real)).toBe('actor_is_guest');
  });

  // La mitad que faltaba: bloquear solo un sentido dejaba al invitado como
  // objetivo, que es justo a quien había que proteger.
  it('y nadie puede dirigirle nada a un invitado', () => {
    expect(canInteractSocially(real, guest)).toBe(false);
    expect(socialBlockReason(real, guest)).toBe('target_is_guest');
  });

  it('invitado contra invitado tampoco', () => {
    expect(canInteractSocially(guest, guest)).toBe(false);
  });

  it('sin sesión no hay interacción posible', () => {
    expect(canInteractSocially(null, real)).toBe(false);
    expect(canInteractSocially(real, undefined)).toBe(false);
  });

  it('acepta el booleano además del 0/1 de SQLite', () => {
    expect(canInteractSocially({ is_guest: true }, real)).toBe(false);
    expect(canInteractSocially({ is_guest: false }, real)).toBe(true);
  });
});
