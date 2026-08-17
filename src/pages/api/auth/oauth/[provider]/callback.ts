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
  fetchGithubVerifiedEmail,
  deriveUsername,
} from '../../../../../lib/oauth';

/**
 * Retorno del proveedor: canjea el código, vincula la cuenta y abre sesión.
 *
 * Termina siempre en una redirección, nunca en JSON: aquí llega el navegador
 * del usuario tras salir de Google o GitHub, y lo que espera es una página.
 */

export const GET: APIRoute = async ({ params, url, cookies, redirect, locals }) => {
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

    // GitHub no dice en `/user` si el correo está verificado; hay que
    // preguntárselo a `/user/emails`. Solo se hace falta cuando ese correo
    // podría emparejar con una cuenta ya existente.
    if (provider === 'github') {
      const verificado = await fetchGithubVerifiedEmail(token.access_token);
      if (verificado) {
        profile.email = verificado;
        profile.emailVerified = true;
      }
    }

    const col = cfg.column;

    // ── Caso 1: ya hay sesión → esto es «conectar», no «entrar» ───────────────
    //
    // Es el botón de Ajustes. Sin esta rama, quien pulsara «Conectar» acababa
    // dentro de **otra** cuenta —la que el proveedor tuviera vinculada, o una
    // recién creada— en lugar de enlazar la suya. Silenciosamente, y con su
    // trabajo aparentemente desaparecido.
    const current = locals.user;
    if (current && current.is_guest !== 1) {
      const taken = db
        .prepare(`SELECT id FROM users WHERE ${col} = ?`)
        .get(profile.providerUserId) as { id: string } | undefined;

      // Ese proveedor ya es de otra cuenta. Reasignarlo dejaría a la otra
      // persona sin su método de entrada, así que se rechaza.
      if (taken && taken.id !== current.id) {
        return redirect('/settings?error=oauth_taken', 302);
      }

      /**
       * Al conectar también se guarda el correo, si la cuenta no tiene ninguno.
       *
       * Aquí solo se escribía el identificador del proveedor. Consecuencia: una
       * cuenta creada con usuario y contraseña que luego conecta Google y GitHub
       * se quedaba **sin correo** —el proveedor lo estaba dando en cada vuelta y
       * se tiraba—. En Ajustes salía «Esta cuenta no tiene ninguna dirección de
       * correo registrada» con dos proveedores conectados al lado, que no hay
       * forma de entender.
       *
       * Tres condiciones, y las tres importan:
       *
       *  - **Solo si la cuenta no tiene correo.** Sobrescribir el que ya puso
       *    alguien a mano sería cambiarle un dato de identidad sin pedírselo.
       *  - **Solo si el proveedor lo da por verificado.** Un correo sin
       *    verificar es una afirmación de un tercero, y aquí acaba sirviendo
       *    para emparejar cuentas.
       *  - **Solo si nadie más lo tiene.** La columna es única; sin esta
       *    comprobación el `UPDATE` revienta y la conexión falla entera por un
       *    añadido opcional.
       */
      const correo = profile.email && profile.emailVerified ? profile.email.toLowerCase() : null;
      const sinCorreo = db.prepare('SELECT email FROM users WHERE id = ?').get(current.id) as { email: string | null } | undefined;
      const libre = correo
        ? !db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(correo, current.id)
        : false;

      if (correo && libre && !sinCorreo?.email) {
        db.prepare(`UPDATE users SET ${col} = ?, email = ? WHERE id = ?`).run(
          profile.providerUserId,
          correo,
          current.id
        );
      } else {
        db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(
          profile.providerUserId,
          current.id
        );
      }
      return redirect('/settings?connected=' + provider, 302);
    }

    // ── Caso 2: sin sesión → entrar, vinculando o creando ────────────────────
    //
    // La búsqueda va por el identificador del proveedor y **no por el correo**.
    // Un correo se cambia, se libera y se reasigna; el `sub` de Google y el `id`
    // de GitHub no. Emparejar por correo permitiría que alguien que se hace con
    // una dirección caducada entre en una cuenta ajena.
    let user = db
      .prepare(`SELECT id, is_guest FROM users WHERE ${col} = ?`)
      .get(profile.providerUserId) as { id: string; is_guest: number } | undefined;

    // ¿Esta vuelta ha acabado creando una cuenta nueva? Hay que decirlo, no
    // dejar a la persona en el hub como si hubiera entrado en la suya.
    let cuentaNueva = false;

    if (!user) {
      // Si ya hay una cuenta con ese correo, se vincula en vez de duplicar: es
      // la misma persona entrando por otra puerta.
      //
      // **Solo si el proveedor lo da por verificado.** Este emparejamiento
      // entrega la cuenta entera sin pedir contraseña, así que aceptar un
      // correo sin comprobar convierte «entrar con Google» en una puerta
      // trasera: basta con declarar el correo de la víctima en un proveedor
      // propio. Sin verificación se sigue de largo y se crea una cuenta nueva,
      // que es recuperable; una cuenta entregada, no.
      const byEmail = profile.email && profile.emailVerified
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
        cuentaNueva = true;
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

    // Entrar con un proveedor que no está vinculado a ninguna cuenta **crea
    // una cuenta**. Es el comportamiento correcto de «entrar con GitHub» —el
    // proveedor ya ha comprobado quién eres, no hace falta contraseña— pero
    // hacerlo en silencio es lo que asusta: quien acaba de borrar su cuenta
    // pulsa el botón esperando entrar, aterriza en un hub vacío y cree que ha
    // perdido su trabajo. Se avisa, y se dice de qué proveedor viene.
    return redirect(cuentaNueva ? `/?cuenta_nueva=${provider}` : '/', 302);
  } catch (err) {
    console.error(`[oauth/${provider}]`, err);
    return redirect('/login?error=oauth_failed', 302);
  }
};
