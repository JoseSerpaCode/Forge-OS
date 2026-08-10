import type { APIRoute } from 'astro';
import {
  isProviderId,
  credentialsFor,
  providerConfig,
  redirectUri,
  createState,
} from '../../../../../lib/oauth';

/**
 * Arranca el flujo: manda al usuario al proveedor.
 *
 * Se responde con una redirección de verdad y no con JSON porque el botón de la
 * interfaz es un `<a>`: el navegador tiene que salir de aquí hacia Google o
 * GitHub, no quedarse esperando datos.
 */
export const GET: APIRoute = async ({ params, redirect, cookies }) => {
  const provider = params.provider;
  if (!isProviderId(provider)) return new Response('Not Found', { status: 404 });

  const creds = credentialsFor(provider);
  // Sin credenciales la ruta no existe. Devolver un 500 o una página de error
  // haría pensar que algo se ha roto, cuando simplemente no está configurado —
  // y los botones de la interfaz ya salen deshabilitados diciéndolo.
  if (!creds) return new Response('Not Found', { status: 404 });

  const cfg = providerConfig(provider);
  const state = createState(provider);

  // El `state` viaja también en una cookie de vida corta. Comprobar solo la
  // firma demuestra que lo emitimos nosotros, pero no que se lo emitiéramos a
  // **este** navegador: sin la cookie, un atacante puede pedir su propio state
  // firmado y usarlo para cerrar el flujo en el navegador de otro.
  cookies.set('forge_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // 'strict' rompería el retorno: viene de otro sitio.
    maxAge: 600,
  });

  const url = new URL(cfg.authUrl);
  url.searchParams.set('client_id', creds.clientId);
  url.searchParams.set('redirect_uri', redirectUri(provider));
  url.searchParams.set('scope', cfg.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');

  return redirect(url.href, 302);
};
