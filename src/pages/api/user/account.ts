import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';
import db from '../../../lib/db';
import {
  previewAccountDeletion,
  deleteAccount,
  AccountDeletionBlocked,
  TOMBSTONE_ID,
} from '../../../lib/accountDeletion';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Las consecuencias, con cifras reales.
 *
 * La pantalla podría limitarse a decir «esto no se puede deshacer», pero eso no
 * ayuda a decidir: lo que cambia la decisión es saber que se van a borrar dos
 * espacios enteros, o que hay un equipo esperando a que traspases la propiedad.
 */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user!;
  return json(previewAccountDeletion(user.id));
};

export const DELETE: APIRoute = async ({ request, locals, cookies }) => {
  const user = locals.user!;

  // Ni la cuenta lápida ni la del sistema: son piezas del esquema, no personas.
  if (user.id === TOMBSTONE_ID || user.id === 'system') {
    return json({ error_code: 'not_deletable' }, 403);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error_code: 'bad_request' }, 400);
  }

  // Escribir el propio nombre a mano. Un botón con un «¿estás seguro?» se pulsa
  // dos veces sin leer; teclear el nombre obliga a mirar qué cuenta es esta.
  if (typeof body.confirm_username !== 'string' || body.confirm_username !== user.username) {
    return json({ error_code: 'confirm_mismatch' }, 400);
  }

  // Y la contraseña, si la hay. Sin esto, una sesión abierta en un ordenador
  // ajeno basta para borrar la cuenta entera de forma irreversible.
  //
  // Las cuentas de OAuth no tienen contraseña que comprobar: su marcador no es
  // un hash de bcrypt (esos empiezan por `$2`). Ahí el nombre tecleado es toda
  // la confirmación posible.
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as any;
  const tienePassword = typeof row?.password_hash === 'string' && row.password_hash.startsWith('$2');

  if (tienePassword) {
    if (typeof body.password !== 'string' || !bcrypt.compareSync(body.password, row.password_hash)) {
      return json({ error_code: 'bad_password' }, 401);
    }
  }

  try {
    const done = deleteAccount(user.id);
    cookies.delete('forge_session', { path: '/' });
    return json({ success: true, ...done });
  } catch (err) {
    if (err instanceof AccountDeletionBlocked) {
      // 409: no es un error de quien pide, es un conflicto de estado que se
      // puede resolver traspasando la propiedad.
      return json({ error_code: 'workspace_ownership', preview: err.preview }, 409);
    }
    console.error('[ACCOUNT] borrado fallido', err);
    return json({ error_code: 'server_error' }, 500);
  }
};
