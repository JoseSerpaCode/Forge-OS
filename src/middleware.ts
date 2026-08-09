import { defineMiddleware } from 'astro:middleware';
import db from './lib/db';

import crypto from 'crypto';

export const onRequest = defineMiddleware(async (context, next) => {
  const sessionId = context.cookies.get('forge_session')?.value;
  const isPublicRoute = context.url.pathname === '/login' || context.url.pathname === '/register' || context.url.pathname === '/api/auth/login' || context.url.pathname === '/api/auth/register';

  if (!sessionId) {
    if (isPublicRoute) {
      context.locals.user = null;
      return applySecurityHeaders(await next());
    }
    
    // Si es un API call sin sesión, devolvemos 401
    if (context.url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Auto-login as GUEST for web routes
    const guestId = crypto.randomUUID();
    const newSessionId = crypto.randomUUID();
    
    // Insert Guest User
    const guestUsername = `Guest_${guestId.split('-')[0]}_${Math.floor(Math.random() * 1000)}`;
    const wsId = crypto.randomUUID();
    const sysTag = `guest-${guestId.split('-')[0]}-${Math.floor(Math.random() * 1000)}`;
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
    
    // Wrap all guest creation in a transaction to prevent orphaned data
    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, username, password_hash, is_guest) 
        VALUES (?, ?, ?, 1)
      `).run(guestId, guestUsername, 'guest');
      
      // Create Default Workspace for Guest
      db.prepare(`
        INSERT INTO workspaces (id, name, sys_tag, created_by) 
        VALUES (?, ?, ?, ?)
      `).run(wsId, 'My Workspace', sysTag, guestId);
      
      db.prepare(`
        INSERT INTO workspace_members (workspace_id, user_id, ws_role) 
        VALUES (?, ?, 'owner')
      `).run(wsId, guestId);
      
      // Create Session
      db.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).run(newSessionId, guestId, expiresAt);
    })();
    
    // Set Cookie
    context.cookies.set('forge_session', newSessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });
    
    // Redirect guest to their new workspace
    return context.redirect(`/w/${sysTag}`);
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

  // Parse language from cookie or auto-detect from browser
  let langPref = context.cookies.get('forge_lang')?.value;
  if (!langPref) {
    const acceptLang = context.request.headers.get('accept-language') || '';
    langPref = acceptLang.toLowerCase().startsWith('es') ? 'es' : 'en';
  }
  context.locals.lang = (langPref === 'es') ? 'es' : 'en';

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

  // No filtrar la ruta completa a terceros: los avatares de dicebear y las
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
    "img-src 'self' data: blob: https://api.dicebear.com",
    "connect-src 'self' ws: wss: https://api.dicebear.com",
    "frame-ancestors 'none'"
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  return response;
}
