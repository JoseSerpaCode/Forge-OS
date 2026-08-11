import { defineMiddleware } from 'astro:middleware';
import db from './lib/db';

/**
 * Idioma de la petición: cookie primero, y si no, lo que pida el navegador.
 *
 * Vive fuera del cuerpo del middleware porque hay que aplicarlo **en los dos
 * caminos**, y antes estaba solo en uno.
 */
function resolveLang(context: Parameters<Parameters<typeof defineMiddleware>[0]>[0]): 'es' | 'en' {
  const cookie = context.cookies.get('forge_lang')?.value;
  if (cookie === 'es' || cookie === 'en') return cookie;
  const accept = context.request.headers.get('accept-language') || '';
  return accept.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const sessionId = context.cookies.get('forge_session')?.value;

  // El idioma se fija lo primero, para **todas** las peticiones.
  //
  // Antes se resolvía más abajo, después del `return` que atiende a los
  // visitantes sin sesión en rutas públicas. Resultado: la portada, el login y
  // el registro —justo lo que ve quien llega por primera vez— caían siempre al
  // `|| 'en'` de los componentes, sin importar la cookie ni el idioma del
  // navegador. Y el conmutador solo existe dentro de la aplicación, así que no
  // había forma de cambiarlo. La mitad española del producto era inalcanzable.
  context.locals.lang = resolveLang(context);
  // `/` es pública: sirve la landing a quien no tiene sesión. Antes exigía
  // sesión, y no teniéndola el middleware creaba una cuenta de invitado ahí
  // mismo — cuatro filas por visita anónima.
  const PUBLIC_ROUTES = new Set([
    '/',
    '/welcome',
    // Los dos archivos que un buscador pide antes que ninguna página. Sin
    // ellos aquí, el middleware los redirigía y Google recibía un 302 en vez
    // del sitemap.
    '/robots.txt',
    '/sitemap.xml',
    '/login',
    '/register',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/guest',
    // El conmutador de idioma de la portada y del login lo usa quien **aún no
    // tiene sesión**: es justo el visitante que todavía no ha elegido idioma.
    // Sin esto devolvía 401 y el botón no hacía nada.
    '/api/lang',
  ]);

  // Las rutas de OAuth son dinámicas —`/api/auth/oauth/<proveedor>` y su
  // `/callback`— así que no caben en un Set de comparación exacta. Y tienen que
  // ser públicas por definición: quien vuelve de Google todavía no tiene sesión,
  // y sin esta excepción el middleware lo mandaría al login justo en el paso que
  // iba a crearla.
  const isPublicRoute =
    PUBLIC_ROUTES.has(context.url.pathname) ||
    context.url.pathname.startsWith('/api/auth/oauth/');

  if (!sessionId) {
    if (isPublicRoute) {
      context.locals.user = null;
      return applySecurityHeaders(await next());
    }
    
    // Si es un API call sin sesión, devolvemos 401
    if (context.url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Sin sesión y en una ruta privada: a la landing, donde puede decidir qué
    // hacer. Aquí ya NO se crea nada.
    //
    // Antes se le creaba una cuenta de invitado en el acto y se le soltaba
    // dentro de un espacio de trabajo vacío: confuso para quien llegaba por
    // primera vez, e imposible de limitar sin castigar a alguien, porque
    // cualquier petición anónima escribía en la base de datos. Ahora el
    // invitado se crea desde POST /api/auth/guest, cuando lo pide una persona.
    return context.redirect('/');
  }

  // Validación de Sesión contra Base de Datos Real
  const sessionData = db.prepare(`
    SELECT u.id, u.username, u.avatar_url, u.is_sysadmin, u.is_guest,
           u.theme_preference, u.last_workspace_id, u.last_page_id,
           u.bio, u.pronouns, u.public_email, u.github_id, u.google_id,
           s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(sessionId) as any;

  if (!sessionData || sessionData.expires_at < Date.now()) {
    context.cookies.delete('forge_session', { path: '/' });
    context.locals.user = null;
    if (isPublicRoute) return next();
    return context.url.pathname.startsWith('/api/') 
      ? new Response(JSON.stringify({ error: 'Session Expired' }), { status: 401 }) 
      : context.redirect('/login');
  }

  // Update last_workspace_id if we are navigating to a workspace
  const match = context.url.pathname.match(/^\/w\/([^/]+)/);
  if (match && match[1]) {
    const sysTag = match[1];
    const isMember = sessionData.is_sysadmin === 1
      ? true
      : db.prepare(
          `SELECT 1 FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id WHERE w.sys_tag = ? AND wm.user_id = ?`
        ).get(sysTag, sessionData.id);

    if (isMember && sessionData.last_workspace_id !== sysTag) {
      db.prepare('UPDATE users SET last_workspace_id = ? WHERE id = ?').run(sysTag, sessionData.id);
      sessionData.last_workspace_id = sysTag;
    }
    
    // Update last_page_id if we are navigating to a specific page
    const pageMatch = context.url.pathname.match(/^\/w\/[^/]+\/p\/([a-zA-Z0-9-]+)$/);
    if (pageMatch && pageMatch[1]) {
      const pageId = pageMatch[1];
      if (isMember && sessionData.last_page_id !== pageId) {
        // Solo actualizamos si la página pertenece al workspace (esto ya se valida en la vista, pero previene spam DB)
        db.prepare('UPDATE users SET last_page_id = ? WHERE id = ?').run(pageId, sessionData.id);
        sessionData.last_page_id = pageId;
      }
    }
  }

  // Inject user to locals for APIs and Astro components
  context.locals.user = sessionData;

  // Basic API global security rules
  // If hitting an API that expects workspace ID, we could validate here.
  // But for now, we just pass the valid session.

  if ((context.url.pathname === '/login' || context.url.pathname === '/register') && sessionData.is_guest !== 1) {
    return context.redirect('/');
  }

  return applySecurityHeaders(await next());
});

// Helper function to apply security headers
function applySecurityHeaders(response: Response): Response {
  // Prevent MIME-sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Prevent Clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  // Prevent XSS
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // HSTS
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // No filtrar la ruta completa a terceros: las
  // fuentes de Google reciben la URL de origen en cada petición.
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // La app no usa ninguna de estas APIs (el único permiso que toca es
  // navigator.clipboard, que no requiere declaración). Negarlas evita que
  // un script inyectado pueda pedirlas.
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()'
  );

  // Aísla la ventana de aperturas cross-origin (refuerza X-Frame-Options).
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');


  // CSP: Allow inline scripts/styles (Astro needs them for island hydration),
  // allow external avatars and fonts, allow WS for real-time features.
  // NOTE: 'unsafe-inline' is intentional — Astro SSR injects inline scripts for
  // component hydration. Remove only if Nonce-based CSP is implemented.
  // NOTE: 'unsafe-eval' is NOT included — no code in this project uses eval().
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'"
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  return response;
}
