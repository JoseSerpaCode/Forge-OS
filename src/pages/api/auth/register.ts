import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { checkRateLimit } from '../../../lib/rateLimit';
import { getClientIp } from '../../../lib/clientIp';
import { verifyChallenge, createChallenge } from '../../../lib/captcha';
import {
  validateUsername,
  validateEmail,
  normalizeEmail,
  type UsernameError,
  type EmailError,
} from '../../../lib/accountValidation';

const PASSWORD_MIN = 6;
const PASSWORD_MAX = 128;

/**
 * Los códigos viajan al cliente y él los traduce.
 *
 * Antes cada rama devolvía su frase en inglés, en una aplicación con dos
 * idiomas: quien se registraba en español recibía «Username already taken».
 */
const bad = (field: string, code: string, status = 400) =>
  new Response(JSON.stringify({ error_field: field, error_code: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, cookies, locals, clientAddress }) => {
  try {
    const { username, email, password, captcha_token, captcha_answer, keep_workspaces } =
      await request.json();

    // `clientAddress` faltaba en esta llamada, aunque el resto de endpoints sí
    // lo pasa. Sin él, detrás de un proxy que no ponga las cabeceras esperadas
    // getClientIp devuelve 'unknown' para todo el mundo, y el límite por IP se
    // convierte en un límite global compartido: el primer bot que lo agota deja
    // fuera a todos los usuarios legítimos.
    const ip = getClientIp(request, clientAddress);
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error_field: 'form', error_code: 'rate_limited', retryAfter: rateCheck.retryAfter }),
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter), 'Content-Type': 'application/json' } }
      );
    }

    // El captcha se comprueba antes que nada más: es lo único que separa este
    // endpoint de un bot, y validar campos primero le daría un oráculo gratis
    // para saber qué nombres están libres.
    const captcha = verifyChallenge(captcha_token, captcha_answer);
    if (captcha !== 'ok') {
      // Se manda un reto nuevo con el rechazo. Sin esto el mensaje —«prueba con
      // la suma nueva»— mentía: el testigo del formulario seguía siendo el
      // mismo, así que no había ninguna suma nueva que probar. Y reutilizar un
      // reto tras un fallo es justo lo que permite ir tanteando respuestas.
      return new Response(
        JSON.stringify({ error_field: 'captcha', error_code: captcha, captcha: createChallenge() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const usernameError: UsernameError | null = validateUsername(username);
    if (usernameError) return bad('username', usernameError);
    const name = String(username).trim();

    const emailError: EmailError | null = validateEmail(email);
    if (emailError) return bad('email', emailError);
    const mail = normalizeEmail(String(email));

    if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
      // El formulario anunciaba 6 caracteres y el servidor exigía 8: quien
      // escribía 7 recibía un rechazo por una regla que nadie le había contado.
      return bad('password', 'too_short');
    }
    // Evita el DoS por bcrypt con contraseñas larguísimas.
    if (password.length > PASSWORD_MAX) return bad('password', 'too_long');

    if (db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(name)) {
      return bad('username', 'taken', 409);
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) {
      return bad('email', 'taken', 409);
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    // El avatar por defecto lo sirve la propia aplicación.
    //
    // Antes era `https://api.dicebear.com/...?seed=<username>`, que contradice
    // de frente lo que promete la portada —«sin terceros leyendo tu trabajo»,
    // «sin scripts de terceros»—: cada carga de perfil enviaba el nombre de
    // usuario y la IP del visitante a un servidor ajeno, y un autoalojado sin
    // salida a internet se quedaba sin avatares.
    const avatarUrl = '/default-avatar.svg';

    const currentUser = locals.user;

    try {
      if (currentUser && currentUser.is_guest === 1) {
        // Ascender la cuenta de invitado en vez de crear otra: así conserva sus
        // espacios, sus issues y su sesión.
        db.transaction(() => {
          db.prepare(
            'UPDATE users SET username = ?, email = ?, password_hash = ?, avatar_url = ?, is_guest = 0 WHERE id = ?'
          ).run(name, mail, passwordHash, avatarUrl, currentUser.id);

          if (Array.isArray(keep_workspaces)) {
            const owned = db
              .prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ?')
              .all(currentUser.id) as { workspace_id: string }[];
            for (const w of owned) {
              if (!keep_workspaces.includes(w.workspace_id)) {
                db.prepare('DELETE FROM workspaces WHERE id = ?').run(w.workspace_id);
              }
            }
          }
        })();
      } else {
        const userId = crypto.randomUUID();
        const sessionId = crypto.randomUUID();
        const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;

        // Usuario y sesión en la misma transacción: un usuario sin sesión deja
        // a alguien que acaba de registrarse mirando la pantalla de login.
        db.transaction(() => {
          db.prepare(
            'INSERT INTO users (id, username, email, password_hash, avatar_url) VALUES (?, ?, ?, ?, ?)'
          ).run(userId, name, mail, passwordHash, avatarUrl);
          db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
            sessionId,
            userId,
            expiresAt
          );
        })();

        cookies.set('forge_session', sessionId, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    } catch (e: any) {
      // Entre el SELECT de disponibilidad y el INSERT cabe otro registro con el
      // mismo nombre. Las restricciones UNIQUE lo paran, pero sin esto el
      // choque salía como un 500 genérico y el usuario no sabía qué cambiar.
      if (String(e?.message).includes('UNIQUE')) {
        return bad(String(e.message).includes('email') ? 'email' : 'username', 'taken', 409);
      }
      throw e;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[auth/register]', err);
    return new Response(JSON.stringify({ error_field: 'form', error_code: 'server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
