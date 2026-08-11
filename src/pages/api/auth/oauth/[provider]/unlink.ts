import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { isProviderId, providerConfig } from '../../../../../lib/oauth';

/**
 * Desvincula un proveedor de la cuenta que está dentro.
 *
 * Lo delicado no es borrar la columna: es **no dejar a nadie fuera de su propia
 * cuenta**. Una cuenta creada por OAuth guarda la cadena literal `'oauth'` en
 * `password_hash`, que no es un hash de bcrypt válido, así que ninguna
 * contraseña puede volver a entrar. Si esa persona desvincula su único
 * proveedor, pierde el acceso para siempre y ni siquiera puede recuperarlo.
 *
 * Por eso se comprueba antes que quede al menos una forma de entrar.
 */
export const POST: APIRoute = async ({ params, locals, redirect }) => {
  const user = locals.user;
  if (!user || user.is_guest === 1) return new Response('Unauthorized', { status: 401 });

  const provider = params.provider;
  if (!isProviderId(provider)) return new Response('Not Found', { status: 404 });

  const col = providerConfig(provider).column;

  const row = db
    .prepare('SELECT password_hash, github_id, google_id FROM users WHERE id = ?')
    .get(user.id) as
    | { password_hash: string; github_id: string | null; google_id: string | null }
    | undefined;

  if (!row) return new Response('Not Found', { status: 404 });
  if (!row[col]) return redirect('/settings', 302); // Ya estaba suelto.

  // `'oauth'` es el marcador que pone el callback al crear la cuenta. Cualquier
  // hash real de bcrypt empieza por `$2`, así que esto distingue las dos cosas
  // sin guardar una bandera aparte.
  const hasPassword = Boolean(row.password_hash) && row.password_hash.startsWith('$2');
  const other = col === 'github_id' ? row.google_id : row.github_id;

  if (!hasPassword && !other) {
    return redirect('/settings?error=oauth_last_method', 302);
  }

  db.prepare(`UPDATE users SET ${col} = NULL WHERE id = ?`).run(user.id);
  return redirect('/settings?disconnected=' + provider, 302);
};
