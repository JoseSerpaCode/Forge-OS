/**
 * Reglas de nombre de usuario y de correo, en un módulo propio.
 *
 * Estaban dentro del endpoint de registro como una escalera de `if`s que
 * devolvían cadenas en inglés. Aquí devuelven un **código**, que es lo que
 * permite traducir el mensaje y, sobre todo, probar las reglas sin levantar
 * medio servidor.
 */

export type UsernameError =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'charset'
  | 'edge_punctuation'
  | 'reserved'
  | 'inappropriate'
  | 'looks_like_guest'
  | 'taken';

export type EmailError = 'required' | 'invalid' | 'too_long' | 'taken';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const EMAIL_MAX = 254; // RFC 5321: longitud máxima de una dirección

/**
 * Nombres que el producto necesita para sí mismo.
 *
 * `/u/<username>` comparte espacio con rutas reales, así que un usuario
 * llamado `settings` o `api` genera enlaces ambiguos. Y `admin`, `support` o
 * `security` son la base de cualquier suplantación: un mensaje firmado por
 * «support» se lee como oficial aunque lo escriba cualquiera.
 */
const RESERVED = new Set([
  'admin', 'administrator', 'root', 'sysadmin', 'system', 'forge', 'forgeos',
  'support', 'help', 'security', 'moderator', 'mod', 'staff', 'official',
  'api', 'www', 'mail', 'ftp', 'login', 'logout', 'register', 'signup',
  'signin', 'settings', 'account', 'profile', 'user', 'users', 'me', 'null',
  'undefined', 'anonymous', 'everyone', 'here', 'all',
]);

/**
 * Términos vetados, en dos listas con reglas distintas.
 *
 * Una sola lista buscada por subcadena es el error clásico: «Scunthorpe» —un
 * pueblo de Lincolnshire— contiene una grosería inglesa, «disputa» contiene
 * otra en español y «torpedo» otra más. Es el problema de Scunthorpe, y se
 * lleva por delante nombres legítimos mientras cree proteger a alguien.
 *
 * Se separan según el riesgo de falso positivo:
 *
 *   ANYWHERE — no aparecen dentro de ninguna palabra legítima. Valen en
 *              cualquier posición.
 *   TOKEN    — cortos y presentes en palabras corrientes. Solo cuentan si
 *              abren el nombre, si son el nombre entero, o si van tras un
 *              separador.
 *
 * Ninguna pretende ser exhaustiva. Un filtro de nombres es una barrera de
 * entrada, no una política de moderación: lo que no pare esto lo para alguien.
 */
const BANNED_ANYWHERE = [
  'nigger', 'nigga', 'faggot', 'tranny', 'holocaust', 'hitler',
  'maricon', 'sudaca', 'negrata',
  'pedophile', 'pedofilo', 'childporn', 'childp0rn',
  'forgesupport', 'forgeadmin', 'forgestaff', 'forgeteam', 'forgeofficial',
];

const BANNED_TOKEN = [
  // cunt → Scunthorpe · puta → disputa, computa · rape → grapes
  // anal → analyst    · shit → bullshit         · nazi → nazionale
  'fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'rape', 'nazi',
  'chink', 'spic', 'kike', 'loli',
  'puta', 'polla', 'cono', 'cabron', 'gilipollas', 'mierda', 'violador',
];

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '$': 's', '@': 'a',
};
const SEPARATORS = /[._\-\s]/;

/**
 * Aplana el nombre para compararlo, y **anota de dónde salió cada carácter**.
 *
 * Sin aplanar, `f_u_c_k` y `Fu.ck` pasan sin despeinarse, que es lo primero que
 * intenta cualquiera al ver un filtro. Pero aplanar destruye los límites de
 * palabra, y son justo lo que necesita la lista TOKEN para no partir
 * «Scunthorpe». De ahí el mapa de posiciones: se compara sobre el texto plano
 * y se decide el límite mirando el original.
 */
function flatten(name: string): { flat: string; origin: number[] } {
  const lower = name.toLowerCase();
  let flat = '';
  const origin: number[] = [];
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (SEPARATORS.test(ch)) continue;
    flat += LEET[ch] ?? ch;
    origin.push(i);
  }
  return { flat, origin };
}

/**
 * ¿La coincidencia cae en un límite de palabra del nombre original?
 *
 * Cuenta si abre el nombre o si viene justo tras un separador. Con eso caen
 * `my_fuck` y `fuckyou`, y se salvan `Scunthorpe` y `disputa`.
 */
function atWordStart(name: string, origin: number[], flatIndex: number): boolean {
  if (flatIndex === 0) return true;
  const orig = origin[flatIndex];
  return orig > 0 && SEPARATORS.test(name[orig - 1]);
}

/**
 * Valida el nombre **sin tocar la base de datos**. El `taken` lo decide quien
 * llama, que es el único que puede consultarla.
 */
export function validateUsername(raw: unknown): UsernameError | null {
  if (typeof raw !== 'string' || raw.trim() === '') return 'required';
  const name = raw.trim();

  if (name.length < USERNAME_MIN) return 'too_short';
  if (name.length > USERNAME_MAX) return 'too_long';
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return 'charset';

  // Un nombre que empieza o acaba en punto/guion se confunde con la
  // puntuación del texto que lo rodea, y `..` sirve para hacerse pasar por
  // otro (`ana..lopez` frente a `ana.lopez`).
  if (/^[._-]|[._-]$|[._-]{2}/.test(name)) return 'edge_punctuation';

  const { flat, origin } = flatten(name);
  if (RESERVED.has(name.toLowerCase()) || RESERVED.has(flat)) return 'reserved';

  if (BANNED_ANYWHERE.some((w) => flat.includes(w))) return 'inappropriate';

  for (const w of BANNED_TOKEN) {
    if (flat === w) return 'inappropriate';
    for (let from = 0; ; ) {
      const at = flat.indexOf(w, from);
      if (at === -1) break;
      if (atWordStart(name, origin, at)) return 'inappropriate';
      from = at + 1;
    }
  }

  // `Guest_<hex>_<n>` es el formato que genera `createGuestSession()`. Si una
  // cuenta real pudiera adoptarlo, se colaría entre las cuentas que la
  // búsqueda esconde y, peor, se haría pasar por temporal ante quien mira.
  if (/^guest[._-]/i.test(name)) return 'looks_like_guest';

  return null;
}

/**
 * Valida un correo.
 *
 * La comprobación es a propósito laxa: la única prueba real de que una
 * dirección existe es mandarle un mensaje, y cualquier expresión regular
 * «completa» acaba rechazando direcciones válidas. Se descarta lo que
 * seguro está mal y ya.
 */
export function validateEmail(raw: unknown, { required = true } = {}): EmailError | null {
  if (typeof raw !== 'string' || raw.trim() === '') return required ? 'required' : null;
  const email = raw.trim();

  if (email.length > EMAIL_MAX) return 'too_long';
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return 'invalid';

  return null;
}

/** Para guardar y comparar: el dominio no distingue mayúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
