import { describe, it, expect, vi, afterEach } from 'vitest';
import { createChallenge, verifyChallenge } from '../src/lib/captcha';

const solve = (q: string) => q.split('+').reduce((a, n) => a + Number(n.trim()), 0);

afterEach(() => vi.useRealTimers());

describe('captcha propio', () => {
  it('un reto se resuelve leyendo el enunciado', () => {
    const c = createChallenge();
    expect(verifyChallenge(c.token, solve(c.question))).toBe('ok');
  });

  it('acepta la respuesta como texto, que es como llega del formulario', () => {
    const c = createChallenge();
    expect(verifyChallenge(c.token, ` ${solve(c.question)} `)).toBe('ok');
  });

  it('rechaza una respuesta equivocada', () => {
    const c = createChallenge();
    expect(verifyChallenge(c.token, solve(c.question) + 1)).toBe('wrong');
  });

  it('exige respuesta y testigo', () => {
    expect(verifyChallenge(undefined, 5)).toBe('missing');
    expect(verifyChallenge(createChallenge().token, '')).toBe('missing');
  });

  // El punto entero del HMAC: sin él, cualquiera se fabrica un testigo con la
  // respuesta que quiera y el captcha deja de existir.
  it('no se puede forjar un testigo', () => {
    expect(verifyChallenge('7.' + Date.now() + '.firmafalsa', 7)).toBe('malformed');
    expect(verifyChallenge('7.' + Date.now(), 7)).toBe('malformed');
    expect(verifyChallenge('basura', 7)).toBe('malformed');
  });

  it('no se puede cambiar la respuesta de un testigo válido', () => {
    const c = createChallenge();
    const [, issued, mac] = c.token.split('.');
    // Mismo MAC, respuesta manipulada: la firma cubre las dos cosas.
    expect(verifyChallenge(`999.${issued}.${mac}`, 999)).toBe('malformed');
  });

  it('el testigo caduca a los diez minutos', () => {
    const c = createChallenge();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(verifyChallenge(c.token, solve(c.question))).toBe('expired');
  });

  it('dos retos seguidos no son el mismo testigo', () => {
    const seen = new Set(Array.from({ length: 40 }, () => createChallenge().token));
    expect(seen.size).toBeGreaterThan(1);
  });
});
