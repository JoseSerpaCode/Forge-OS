import { describe, it, expect, vi, afterEach } from 'vitest';
import { createState, verifyState, isProviderId, credentialsFor, redirectUri, normalizeProfile } from '../src/lib/oauth';

afterEach(() => vi.useRealTimers());

describe('estado de OAuth', () => {
  it('un estado recién creado vale para su proveedor', () => {
    expect(verifyState(createState('github'), 'github')).toBe('ok');
  });

  /**
   * Sin esto, un atacante prepara una URL de retorno con SU código de
   * autorización; quien la abra acaba dentro de la cuenta del atacante y sigue
   * escribiendo ahí creyendo que es la suya.
   */
  it('no se puede forjar', () => {
    expect(verifyState('github.' + Date.now() + '.abc.firmafalsa', 'github')).toBe('malformed');
    expect(verifyState('basura', 'github')).toBe('malformed');
    expect(verifyState('', 'github')).toBe('missing');
    expect(verifyState(undefined, 'github')).toBe('missing');
  });

  it('no vale el de un proveedor para otro', () => {
    // Si valiera, se podría empezar el flujo en el proveedor barato de atacar y
    // cerrarlo contra el otro.
    expect(verifyState(createState('github'), 'google')).toBe('wrong_provider');
  });

  it('no se puede reetiquetar un estado válido', () => {
    const s = createState('github');
    const [, ts, nonce, mac] = s.split('.');
    expect(verifyState(`google.${ts}.${nonce}.${mac}`, 'google')).toBe('malformed');
  });

  it('caduca a los diez minutos', () => {
    const s = createState('google');
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(verifyState(s, 'google')).toBe('expired');
  });

  it('dos estados seguidos son distintos', () => {
    expect(createState('google')).not.toBe(createState('google'));
  });
});

describe('configuración', () => {
  it('solo reconoce los dos proveedores', () => {
    expect(isProviderId('google')).toBe(true);
    expect(isProviderId('github')).toBe(true);
    for (const x of ['facebook', '', null, '../../etc/passwd']) expect(isProviderId(x)).toBe(false);
  });

  it('sin credenciales no hay proveedor', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(credentialsFor('google')).toBeNull();
  });

  it('hacen falta las dos mitades, no solo el id', () => {
    process.env.GITHUB_CLIENT_ID = 'x';
    delete process.env.GITHUB_CLIENT_SECRET;
    expect(credentialsFor('github')).toBeNull();
    process.env.GITHUB_CLIENT_SECRET = 'y';
    expect(credentialsFor('github')).toEqual({ clientId: 'x', clientSecret: 'y' });
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
  });

  it('la URI de retorno sale de PUBLIC_SITE_URL, no de la petición', () => {
    // Los proveedores la comparan carácter a carácter con la registrada; si
    // saliera de la URL de la petición, detrás del proxy diría localhost.
    process.env.PUBLIC_SITE_URL = 'https://forge-os.online';
    expect(redirectUri('google')).toBe('https://forge-os.online/api/auth/oauth/google/callback');
    delete process.env.PUBLIC_SITE_URL;
  });
});

describe('perfil del proveedor', () => {
  it('Google se identifica por `sub`, no por el correo', () => {
    const p = normalizeProfile('google', { sub: '12345', email: 'Jose@Gmail.com', name: 'Jose' });
    expect(p?.providerUserId).toBe('12345');
    expect(p?.suggestedUsername).toBe('Jose');
  });

  it('GitHub se identifica por `id`', () => {
    const p = normalizeProfile('github', { id: 987, login: 'joseserpa' });
    expect(p?.providerUserId).toBe('987');
    expect(p?.suggestedUsername).toBe('joseserpa');
  });

  it('una respuesta sin identificador se rechaza', () => {
    expect(normalizeProfile('google', { email: 'a@b.co' })).toBeNull();
    expect(normalizeProfile('github', {})).toBeNull();
    expect(normalizeProfile('github', null)).toBeNull();
  });
});
