import crypto from 'crypto';

/**
 * Prueba anti-bot para el registro, resuelta en casa.
 *
 * No es reCAPTCHA ni hCaptcha a propósito. La landing promete «sin analíticas,
 * sin rastreadores, sin scripts de terceros», y el producto entero se vende
 * como «un proceso, un archivo, nadie más leyendo tu trabajo». Meter un widget
 * de Google en el formulario de registro convertiría esa frase en publicidad
 * engañosa: cada persona que se registra quedaría fichada por un tercero antes
 * incluso de tener cuenta.
 *
 * Lo que hay es una suma sencilla firmada con HMAC:
 *
 *   1. El servidor inventa dos números, calcula el resultado y devuelve el
 *      enunciado más un testigo firmado que contiene la respuesta y la hora.
 *   2. El navegador manda la respuesta y el testigo.
 *   3. El servidor comprueba la firma y la respuesta.
 *
 * **El servidor no guarda nada.** No hay tabla de retos pendientes ni memoria
 * que crezca: el testigo se valida solo, así que un atacante que pida un millón
 * de retos no consume un byte de estado, que es como se tumba un captcha con
 * almacenamiento.
 *
 * Lo que esto para y lo que no: para el bot genérico que rellena formularios,
 * que es de donde salían las 43.000 cuentas al día. No para a quien se siente a
 * escribir un script contra esta web en concreto — resolver una suma es
 * trivial. Para eso está el límite por IP, que es la defensa de verdad; esto es
 * la que evita que ni siquiera lo intenten.
 */

const TTL_MS = 10 * 60 * 1000; // Diez minutos: de sobra para rellenar un formulario.

/**
 * Clave de firma.
 *
 * Sale de `SESSION_SECRET` si está definida. Si no, se genera una al arrancar:
 * eso invalida los retos en curso en cada reinicio —molesto pero inofensivo—, y
 * es mucho mejor que una constante escrita en el repositorio, que cualquiera
 * podría usar para firmarse sus propios testigos.
 */
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export type Challenge = { question: string; token: string };

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

/** Crea un reto nuevo. Sumas pequeñas: es una barrera, no un examen. */
export function createChallenge(): Challenge {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const payload = `${a + b}.${Date.now()}`;
  return {
    question: `${a} + ${b}`,
    token: `${payload}.${sign(payload)}`,
  };
}

export type CaptchaResult = 'ok' | 'missing' | 'malformed' | 'expired' | 'wrong';

/** Comprueba la respuesta contra el testigo. */
export function verifyChallenge(token: unknown, answer: unknown): CaptchaResult {
  if (typeof token !== 'string' || !token) return 'missing';
  if (answer === undefined || answer === null || String(answer).trim() === '') return 'missing';

  const parts = token.split('.');
  if (parts.length !== 3) return 'malformed';
  const [expected, issuedAt, mac] = parts;

  // Comparación en tiempo constante: un `===` sobre el MAC filtra, byte a byte,
  // cuánto se ha acertado, y con eso se puede llegar a forjar una firma válida.
  const good = sign(`${expected}.${issuedAt}`);
  const macBuf = Buffer.from(mac);
  const goodBuf = Buffer.from(good);
  if (macBuf.length !== goodBuf.length || !crypto.timingSafeEqual(macBuf, goodBuf)) {
    return 'malformed';
  }

  const ts = Number(issuedAt);
  if (!Number.isFinite(ts) || Date.now() - ts > TTL_MS) return 'expired';

  return String(answer).trim() === expected ? 'ok' : 'wrong';
}
