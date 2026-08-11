import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import bcrypt from 'bcryptjs';
import { validateUsername } from '../../../lib/accountValidation';

// ── Shared validation helpers ────────────────────────────────────────────────
// Centralised here so both /api/user/settings (main) and /api/users/profile
// (legacy/convenience) apply the same rules.

/** Validate and sanitise an image URL field (avatar or banner). */
function validateImageUrl(value: unknown, fieldName: string, maxLen = 2048): string | Response {
  if (typeof value !== 'string') return new Response(`Invalid ${fieldName} format`, { status: 400 });
  if (value === '') return ''; // allow clearing
  if (value.length > maxLen) return new Response(`${fieldName} URL too long (max ${maxLen} chars)`, { status: 400 });
  if (
    !value.startsWith('http://') &&
    !value.startsWith('https://') &&
    !value.startsWith('data:image/') &&
    !value.startsWith('/api/storage/')
  ) {
    return new Response(`Invalid ${fieldName} source. Must be HTTP/S, data:image, or /api/storage/`, { status: 400 });
  }
  if (value.startsWith('data:image/svg+xml')) {
    return new Response('SVG uploads are not permitted for security reasons', { status: 400 });
  }
  return value.trim();
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user!;

  try {
    const data = await request.json();
    const {
      // Account settings
      username, current_password, new_password, theme_preference,
      // Profile fields
      avatar_url, banner_url, bio, pronouns, public_email, is_public,
      // Notification preferences
      notif_mute_all, notif_mute_assign, notif_mute_mention, notif_mute_sprint, notif_mute_system,
    } = data;

    const updateFields: string[] = [];
    const values: any[] = [];

    // ── Password ────────────────────────────────────────────────────────────
    //
    // Quien entró por Google o GitHub **no tiene** contraseña actual: su cuenta
    // guarda la cadena literal `oauth`, que no es un hash de bcrypt válido y no
    // coincide con nada. Exigirle la actual la dejaba sin poder ponerse una
    // nunca, y por tanto sin poder desvincular su único proveedor —la guarda de
    // `unlink` se lo impide, con razón—. Quedaba atada al proveedor para
    // siempre.
    //
    // Así que aquí se distingue **poner la primera** de **cambiar la que hay**.
    // Poner la primera no necesita nada más que la sesión, que ya está validada
    // por el middleware: no hay ningún secreto anterior que proteger.
    if (new_password) {
      const dbUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as any;
      if (!dbUser) return new Response('Not Found', { status: 404 });

      // Un hash real de bcrypt siempre empieza por `$2`. Cualquier otra cosa
      // —`oauth`, o vacío— significa que esta cuenta aún no tiene contraseña.
      const hasPassword = typeof dbUser.password_hash === 'string' && dbUser.password_hash.startsWith('$2');

      if (hasPassword) {
        if (!current_password || !bcrypt.compareSync(current_password, dbUser.password_hash)) {
          return new Response('Invalid current password', { status: 403 });
        }
      }

      if (new_password.length < 8) {
        return new Response('New password must be at least 8 characters', { status: 400 });
      }
      // Prevent DoS via bcrypt with extremely long passwords
      if (new_password.length > 128) {
        return new Response('New password cannot exceed 128 characters', { status: 400 });
      }
      updateFields.push('password_hash = ?');
      values.push(bcrypt.hashSync(new_password, 10));
    }

    // ── Username ────────────────────────────────────────────────────────────
    //
    // Las mismas reglas que el registro, y por el mismo módulo.
    //
    // Antes esta rama solo comprobaba longitud y juego de caracteres, así que
    // todo lo que el registro impide se conseguía en dos pasos: registrarse
    // como `bob` y renombrarse después a `admin`, a `support` o a
    // `Guest_ab12_9` —que además esconde la cuenta de las sugerencias de
    // búsqueda—. Una regla que solo se aplica en la puerta de entrada no es
    // una regla.
    if (username && typeof username === 'string') {
      const problem = validateUsername(username);
      if (problem) {
        return new Response(JSON.stringify({ error_field: 'username', error_code: problem }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // `COLLATE NOCASE`: `Avery` y `avery` son la misma persona a la vista, y
      // dejar coexistir las dos es la base de cualquier suplantación.
      const existing = db
        .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?')
        .get(username.trim(), user.id);
      if (existing) {
        return new Response(JSON.stringify({ error_field: 'username', error_code: 'taken' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updateFields.push('username = ?');
      values.push(username.trim());
    }

    // ── Avatar ──────────────────────────────────────────────────────────────
    if (avatar_url !== undefined) {
      const result = validateImageUrl(avatar_url, 'Avatar');
      if (result instanceof Response) return result;
      updateFields.push('avatar_url = ?');
      values.push(result || null);
    }

    // ── Banner ──────────────────────────────────────────────────────────────
    if (banner_url !== undefined) {
      const result = validateImageUrl(banner_url, 'Banner');
      if (result instanceof Response) return result;
      updateFields.push('banner_url = ?');
      values.push(result || null);
    }

    // ── Bio ─────────────────────────────────────────────────────────────────
    if (bio !== undefined) {
      if (bio && typeof bio !== 'string') return new Response('Invalid bio', { status: 400 });
      if (bio && bio.length > 500) return new Response('Bio too long (max 500 characters)', { status: 400 });
      updateFields.push('bio = ?');
      values.push(bio ? bio.trim() : null);
    }

    // ── Pronouns ────────────────────────────────────────────────────────────
    if (pronouns !== undefined) {
      if (pronouns && typeof pronouns !== 'string') return new Response('Invalid pronouns', { status: 400 });
      if (pronouns && pronouns.length > 30) return new Response('Pronouns too long', { status: 400 });
      updateFields.push('pronouns = ?');
      values.push(pronouns ? pronouns.trim() : null);
    }

    // ── Public email ────────────────────────────────────────────────────────
    if (public_email !== undefined) {
      if (public_email && typeof public_email !== 'string') return new Response('Invalid email', { status: 400 });
      if (public_email && public_email.length > 100) return new Response('Email too long', { status: 400 });
      if (public_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(public_email)) {
        return new Response('Invalid email format', { status: 400 });
      }
      updateFields.push('public_email = ?');
      values.push(public_email ? public_email.trim() : null);
    }

    // ── Public profile toggle ───────────────────────────────────────────────
    if (is_public !== undefined) {
      updateFields.push('is_public = ?');
      values.push(user.is_guest === 1 ? 0 : (is_public ? 1 : 0));
    }

    // ── Theme ───────────────────────────────────────────────────────────────
    if (theme_preference !== undefined && typeof theme_preference === 'string') {
      if (['light', 'dark'].includes(theme_preference)) {
        updateFields.push('theme_preference = ?');
        values.push(theme_preference);
      }
    }

    // ── Notification preferences ────────────────────────────────────────────
    if (notif_mute_all !== undefined) {
      updateFields.push('notif_mute_all = ?, notif_mute_assign = ?, notif_mute_mention = ?, notif_mute_sprint = ?, notif_mute_system = ?');
      values.push(
        notif_mute_all ? 1 : 0,
        notif_mute_assign ? 1 : 0,
        notif_mute_mention ? 1 : 0,
        notif_mute_sprint ? 1 : 0,
        notif_mute_system ? 1 : 0
      );
    }

    // ── Persist ─────────────────────────────────────────────────────────────
    if (updateFields.length > 0) {
      values.push(user.id);
      db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
