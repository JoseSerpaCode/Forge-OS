import { describe, it, expect } from 'vitest';
import { validateUsername, validateEmail, normalizeEmail } from '../src/lib/accountValidation';

describe('nombre de usuario', () => {
  it('acepta nombres normales', () => {
    for (const n of ['avery', 'jose.serpa', 'dev_01', 'a-b-c', 'Scunthorpe'])
      expect(validateUsername(n), n).toBeNull();
  });

  it('exige longitud y juego de caracteres', () => {
    expect(validateUsername('')).toBe('required');
    expect(validateUsername('ab')).toBe('too_short');
    expect(validateUsername('x'.repeat(33))).toBe('too_long');
    expect(validateUsername('hola mundo')).toBe('charset');
    expect(validateUsername('<script>')).toBe('charset');
  });

  it('rechaza puntuación en los bordes y doblada', () => {
    expect(validateUsername('.avery')).toBe('edge_punctuation');
    expect(validateUsername('avery.')).toBe('edge_punctuation');
    // `ana..lopez` se lee igual que `ana.lopez` de un vistazo.
    expect(validateUsername('ana..lopez')).toBe('edge_punctuation');
  });

  it('reserva los nombres del propio producto', () => {
    for (const n of ['admin', 'ADMIN', 'support', 'api', 'settings', 'system'])
      expect(validateUsername(n), n).toBe('reserved');
  });

  it('veta términos inapropiados', () => {
    expect(validateUsername('fuckyou')).toBe('inappropriate');
    expect(validateUsername('gilipollas')).toBe('inappropriate');
  });

  it('y también sus disfraces con separadores y leetspeak', () => {
    // Lo primero que intenta cualquiera al ver un filtro.
    expect(validateUsername('f.u.c.k')).toBe('inappropriate');
    expect(validateUsername('f_u_c_k')).toBe('inappropriate');
    expect(validateUsername('sh1t')).toBe('inappropriate');
    expect(validateUsername('n4zi')).toBe('inappropriate');
  });

  it('no cae en el problema de Scunthorpe', () => {
    // Nombres legítimos que una lista negra ingenua parte por la mitad.
    for (const n of ['Scunthorpe', 'Penistone', 'analyst', 'Cockburn', 'Hancock'])
      expect(validateUsername(n), n).toBeNull();
  });

  it('impide hacerse pasar por una cuenta temporal', () => {
    expect(validateUsername('Guest_a3f9c210_447')).toBe('looks_like_guest');
    expect(validateUsername('guest-de-verdad')).toBe('looks_like_guest');
    // Pero un nombre que solo *contiene* «guest» no molesta a nadie.
    expect(validateUsername('myguesthouse')).toBeNull();
  });

  it('rechaza lo que no es texto', () => {
    expect(validateUsername(null)).toBe('required');
    expect(validateUsername(42)).toBe('required');
    expect(validateUsername({})).toBe('required');
  });
});

describe('correo', () => {
  it('acepta direcciones normales', () => {
    for (const e of ['a@b.co', 'jose.serpa+forge@gmail.com', 'x_y@sub.dominio.es'])
      expect(validateEmail(e), e).toBeNull();
  });

  it('rechaza lo que seguro está mal', () => {
    expect(validateEmail('')).toBe('required');
    expect(validateEmail('sin-arroba')).toBe('invalid');
    expect(validateEmail('a@b')).toBe('invalid');       // sin dominio de primer nivel
    expect(validateEmail('a@@b.co')).toBe('invalid');
    expect(validateEmail('a b@c.co')).toBe('invalid');
    expect(validateEmail('a'.repeat(250) + '@b.co')).toBe('too_long');
  });

  it('puede ser opcional', () => {
    expect(validateEmail('', { required: false })).toBeNull();
  });

  it('normaliza a minúsculas para comparar', () => {
    expect(normalizeEmail('  Jose@GMail.COM ')).toBe('jose@gmail.com');
  });
});

describe('las reglas se aplican también al renombrarse', () => {
  /**
   * `/api/user/settings` solo miraba longitud y caracteres, así que todo lo que
   * el registro impide se conseguía en dos pasos: registrarse con un nombre
   * cualquiera y renombrarse después. Una regla que solo actúa en la puerta de
   * entrada no es una regla; esto fija que ambas puertas usan la misma.
   */
  it('los nombres que el registro rechaza siguen rechazados al renombrar', () => {
    for (const name of ['admin', 'support', 'Guest_ab12_9', 'f.u.c.k', 'api']) {
      expect(validateUsername(name), name).not.toBeNull();
    }
  });
});
