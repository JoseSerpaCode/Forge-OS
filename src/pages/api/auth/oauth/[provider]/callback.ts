import type { APIRoute } from 'astro';
import crypto from 'crypto';
import db from '../../../../../lib/db';
import {
  isProviderId,
  credentialsFor,
  providerConfig,
  redirectUri,
  verifyState,
  normalizeProfile,
  deriveUsername,
} from '../../../../../lib/oauth';

/**
 * Retorno del proveedor: canjea el código, vincula la cuenta y abre sesión.
 *
 * Termina siempre en una redirección, nunca en JSON: aquí llega el navegador
 * del usuario tras salir de Google o GitHub, y lo que espera es una página.
 */

export const GET: APIRoute = async ({ params, url, cookies, redirect }) => {
  const provider = params.provider;
  if (!isProviderId(provider)) return new Response('Not Found', { status: 404 });

  const creds = credentialsFor(provider);
  if (!creds) return new Response('Not Found', { status: 404 });

  // El proveedor avisa aquí si el usuario canceló. No es un error nuestro, así
  // que vuelve al login sin ruido.
  if (url.searchParams.get('error')) return redirect('/login', 302);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return redirect('/login?error=oauth_no_code', 302);

  // Doble comprobación del `state`: la firma demuestra que lo emitimos
  // nosotros, y la cookie que se lo emitimos a **este** navegador. Con solo lo
  // primero, un atacante pide su propio state firmado y lo usa para cerrar el
  // flujo en el navegador de otra persona, que acaba dentro de la cuenta del
  // atacante sin notarlo.
  const cookieState = cookies.get('forge_oauth_state')?.value;
  cookies.delete('forge_oauth_state', { path: '/' });

  if (!cookieState || cookieState !== state) return redirect('/login?error=oauth_state', 302);
  if (verifyState(state, provider) !== 'ok') return redirect('/login?error=oauth_state', 302);

  const cfg = providerConfig(provider);

  try {
    // ── Canjear el código por un token ───────────────────────────────────────
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: redirectUri(provider),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenRes.ok) return redirect('/login?error=oauth_token', 302);
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return redirect('/login?error=oauth_token', 302);

    // ── Pedir el perfil ──────────────────────────────────────────────────────
    const profileRes = await fetch(cfg.userUrl, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
        // GitHub rechaza las peticiones sin User-Agent.
        'User-Agent': 'Forge-OS',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!profileRes.ok) return redirect('/login?error=oauth_profile', 302);
    const profile = normalizeProfile(provider, await profileRes.json());
    if (!profile) return redirect('/login?error=oauth_profile', 302);

    // ── Vincular o crear ─────────────────────────────────────────────────────
    //
    // La búsqueda va por el identificador del proveedor y **no por el correo**.
    // Un correo se cambia, se libera y se reasigna; el `sub` de Google y el `id`
    // de GitHub no. Emparejar por correo permitiría que alguien que se hace con
    // una dirección caducada entre en una cuenta ajena.
    const col = cfg.column;
    let user = db
      .prepare(`SELECT id, is_guest FROM users WHERE ${col} = ?`)
      .get(profile.providerUserId) as { id: string; is_guest: number } | undefined;

    if (!user) {
      // Si ya hay una cuenta con ese correo, se vincula en vez de duplicar: es
      // la misma persona entrando por otra puerta.
      const byEmail = profile.email
        ? (db.prepare('SELECT id FROM users WHERE email = ?').get(profile.email.toLowerCase()) as
            | { id: string }
            | undefined)
        : undefined;

      if (byEmail) {
        db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(profile.providerUserId, byEmail.id);
        user = { id: byEmail.id, is_guest: 0 };
      } else {
        const id = crypto.randomUUID();
        const username = deriveUsername(profile.suggestedUsername);
        db.prepare(
          `INSERT INTO users (id, username, email, password_hash, avatar_url, ${col}) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          username,
          profile.email ? profile.email.toLowerCase() : null,
          // Sin contraseña utilizable: esta cuenta entra por el proveedor. El
          // valor no es un hash válido de bcrypt, así que `compareSync` contra
          // él devuelve false para cualquier contraseña — no hay que confiar en
          // que nadie adivine una cadena literal.
          'oauth',
          '/default-avatar.svg',
          profile.providerUserId
        );
        user = { id, is_guest: 0 };
      }
    }

    // ── Abrir sesión ─────────────────────────────────────────────────────────
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
      sessionId,
      user.id,
      expiresAt
    );

    cookies.set('forge_session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });

    return redirect('/', 302);
  } catch (err) {
    console.error(`[oauth/${provider}]`, err);
    return redirect('/login?error=oauth_failed', 302);
  }
};
