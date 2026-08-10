import crypto from 'crypto';
import db from './db';
import { validateUsername } from './accountValidation';

/**
 * Entrada con Google y GitHub, por redirección completa.
 *
 * **No por ventana emergente**: el middleware envía
 * `Cross-Origin-Opener-Policy: same-origin`, que corta la referencia entre la
 * ventana emergente y la que la abrió. Un flujo por popup se quedaría colgado
 * sin decir por qué, y relajar esa cabecera para arreglarlo sería pagar la
 * comodidad de un flujo con la protección de todos los demás.
 *
 * Cada proveedor se activa **solo si tiene credenciales**. Sin ellas la ruta
 * devuelve 404 en vez de un error a medias, y los botones de la interfaz salen
 * deshabilitados diciendo que falta configurarlos.
 */

export type ProviderId = 'google' | 'github';

type ProviderConfig = {
  id: ProviderId;
  authUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
  /** Columna de `users` donde se guarda el identificador del proveedor. */
  column: 'google_id' | 'github_id';
};

const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  google: {
    id: 'google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    column: 'google_id',
  },
  github: {
    id: 'github',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    column: 'github_id',
  },
};

export function isProviderId(value: unknown): value is ProviderId {
  return value === 'google' || value === 'github';
}

const env = (key: string): string | undefined =>
  process.env[key] || (import.meta.env as Record<string, string | undefined>)[key];

export function credentialsFor(id: ProviderId): { clientId: string; clientSecret: string } | null {
  const clientId = env(`${id.toUpperCase()}_CLIENT_ID`);
  const clientSecret = env(`${id.toUpperCase()}_CLIENT_SECRET`);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function providerConfig(id: ProviderId): ProviderConfig {
  return PROVIDERS[id];
}

/**
 * URI de retorno.
 *
 * Se construye sobre `PUBLIC_SITE_URL` y **no** sobre `Astro.url`. Los
 * proveedores comparan este valor carácter a carácter con el que hay registrado
 * en su consola: si detrás del proxy la URL saliera como `http://localhost:4321`
 * —que es justo lo que pasaba antes de arreglar `allowedDomains`—, Google y
 * GitHub rechazarían la petición con `redirect_uri_mismatch`.
 */
export function redirectUri(id: ProviderId): string {
  const base = env('PUBLIC_SITE_URL') || 'http://localhost:4321';
  return new URL(`/api/auth/oauth/${id}/callback`, base).href;
}

// ── Estado firmado ───────────────────────────────────────────────────────────
//
// El parámetro `state` es lo único que impide que alguien te haga completar un
// inicio de sesión que no empezaste: sin él, un atacante prepara una URL de
// retorno con **su** código de autorización y quien la abra queda dentro de la
// cuenta del atacante, donde seguirá escribiendo creyendo que es la suya.
//
// Va firmado con HMAC y sin guardar nada en servidor, igual que el captcha: un
// `state` con almacenamiento es una tabla que crece con cada intento abandonado.
const SECRET = env('SESSION_SECRET') || crypto.randomBytes(32).toString('hex');
const STATE_TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createState(id: ProviderId): string {
  const payload = `${id}.${Date.now()}.${crypto.randomBytes(12).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

export type StateCheck = 'ok' | 'missing' | 'malformed' | 'expired' | 'wrong_provider';

export function verifyState(state: unknown, expected: ProviderId): StateCheck {
  if (typeof state !== 'string' || !state) return 'missing';

  const parts = state.split('.');
  if (parts.length !== 4) return 'malformed';
  const [id, issuedAt, nonce, mac] = parts;

  const good = sign(`${id}.${issuedAt}.${nonce}`);
  const macBuf = Buffer.from(mac);
  const goodBuf = Buffer.from(good);
  // Comparación en tiempo constante: un `===` sobre el MAC filtra byte a byte
  // cuánto se ha acertado, y con eso se puede llegar a forjar una firma.
  if (macBuf.length !== goodBuf.length || !crypto.timingSafeEqual(macBuf, goodBuf)) {
    return 'malformed';
  }

  if (id !== expected) return 'wrong_provider';

  const ts = Number(issuedAt);
  if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return 'expired';

  return 'ok';
}

// ── Perfil normalizado ───────────────────────────────────────────────────────

export type OAuthProfile = {
  /** Identificador estable del proveedor. Nunca el correo: los correos cambian. */
  providerUserId: string;
  email: string | null;
  suggestedUsername: string;
  avatarUrl: string | null;
};

export function normalizeProfile(id: ProviderId, raw: any): OAuthProfile | null {
  if (id === 'google') {
    if (!raw?.sub) return null;
    return {
      providerUserId: String(raw.sub),
      email: raw.email ? String(raw.email) : null,
      suggestedUsername: String(raw.email || raw.name || 'user').split('@')[0],
      avatarUrl: null,
    };
  }
  if (!raw?.id) return null;
  return {
    providerUserId: String(raw.id),
    email: raw.email ? String(raw.email) : null,
    suggestedUsername: String(raw.login || 'user'),
    avatarUrl: null,
  };
}

/**
 * Convierte la sugerencia del proveedor en un nombre que la aplicación acepta.
 *
 * El nombre que viene de fuera no cumple necesariamente nuestras reglas:
 * `jose.serpa@gmail.com` da `jose.serpa`, pero un login de GitHub puede traer
 * caracteres fuera del juego permitido, chocar con uno existente o caer en la
 * lista de reservados. Se limpia y, si hace falta, se numera.
 */
export function deriveUsername(suggested: string): string {
  let base = suggested
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 28);

  if (base.length < 3) base = `user${crypto.randomBytes(3).toString('hex')}`;

  const taken = (name: string) =>
    Boolean(db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(name));

  if (!validateUsername(base) && !taken(base)) return base;

  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}${i}`;
    if (!validateUsername(candidate) && !taken(candidate)) return candidate;
  }
  // Salida de emergencia: aleatorio puro. Nunca debería llegar aquí.
  return `user${crypto.randomBytes(6).toString('hex')}`;
}
