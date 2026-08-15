import crypto from 'crypto';

/**
 * Cifrado de secretos en reposo.
 *
 * Existe por una cosa concreta: el *refresh token* de Google. Es una llave
 * permanente al Drive de una persona —no caduca, sirve para pedir accesos
 * nuevos indefinidamente— y va a vivir en un fichero SQLite que se copia a un
 * bucket cada noche. En claro, cualquiera que llegue a una copia de seguridad
 * llega también a los archivos de todo el mundo. Cifrado con una clave que
 * **no** está dentro de la base, una copia robada no vale para nada por sí sola.
 *
 * AES-256-GCM: cifra y autentica a la vez. Si alguien retoca un byte del texto
 * cifrado directamente en la base, el descifrado falla en vez de devolver
 * basura que el resto del código se tragaría.
 *
 * Cada llamada usa un IV nuevo de 12 bytes. Repetir IV con la misma clave en
 * GCM es el fallo que rompe el cifrado entero, no solo el mensaje repetido.
 */

const env = (key: string): string | undefined =>
  process.env[key] || (import.meta.env as Record<string, string | undefined>)[key];

const VERSION = 'v1';

/**
 * La clave, 32 bytes.
 *
 * Se prefiere `DRIVE_TOKEN_KEY` (64 caracteres hexadecimales) porque puede
 * rotarse sin tocar las sesiones. Si no está, se deriva de `SESSION_SECRET`
 * con scrypt y una sal fija: es peor —rotar el secreto de sesión deja los
 * tokens ilegibles— pero evita que la funcionalidad dependa de recordar una
 * variable más, y el caso está contemplado: lo ilegible se trata como
 * «hay que volver a conectar», no como un error.
 *
 * Se calcula una vez: scrypt es deliberadamente lento y hacerlo en cada
 * llamada convertiría cada subida de archivo en medio segundo de CPU.
 */
let claveCache: Buffer | null = null;

function clave(): Buffer {
  if (claveCache) return claveCache;

  const explicita = env('DRIVE_TOKEN_KEY');
  if (explicita) {
    const buf = Buffer.from(explicita.trim(), 'hex');
    if (buf.length !== 32) {
      throw new Error('DRIVE_TOKEN_KEY debe ser de 64 caracteres hexadecimales (32 bytes)');
    }
    claveCache = buf;
    return buf;
  }

  const base = env('SESSION_SECRET');
  if (!base) {
    // Sin secreto no se inventa uno al vuelo: un secreto aleatorio por arranque
    // haría que los tokens dejaran de leerse en cada reinicio, y el fallo
    // aparecería mucho después y sin relación aparente con la causa.
    throw new Error('Hace falta DRIVE_TOKEN_KEY o SESSION_SECRET para cifrar secretos');
  }
  claveCache = crypto.scryptSync(base, 'forge-secret-box-v1', 32);
  return claveCache;
}

/** Solo para las pruebas: olvida la clave calculada. */
export function _olvidarClave(): void {
  claveCache = null;
}

/** Cifra un texto. Devuelve `v1.iv.tag.cifrado`, todo en base64url. */
export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave(), iv);
  const ct = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

/**
 * Descifra lo que produjo `cifrar`.
 *
 * Devuelve `null` ante cualquier problema —formato raro, clave cambiada, texto
 * manipulado— en vez de lanzar. Quien llama no puede hacer nada distinto según
 * el motivo: en todos los casos el token no sirve y hay que volver a conectar.
 * Y distinguirlos por fuera sería contarle a quien manipula qué parte acertó.
 */
export function descifrar(blob: unknown): string | null {
  if (typeof blob !== 'string') return null;

  const partes = blob.split('.');
  if (partes.length !== 4 || partes[0] !== VERSION) return null;

  try {
    const iv = Buffer.from(partes[1], 'base64url');
    const tag = Buffer.from(partes[2], 'base64url');
    const ct = Buffer.from(partes[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return null;

    const decipher = crypto.createDecipheriv('aes-256-gcm', clave(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
