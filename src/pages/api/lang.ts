import type { APIRoute } from 'astro';

/**
 * Cambiar de idioma y volver a la misma página.
 *
 * Solo se vuelve a rutas del propio sitio: `current_path` llega del formulario
 * y `//otro-sitio.com` también empieza por «/», así que sin comprobarlo esto
 * era una redirección abierta.
 *
 * La portada tiene una dirección por idioma (`/` y `/es`): cambiar de idioma en
 * ella lleva a la otra, porque en `/es` el idioma no se negocia.
 */
export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const formData = await request.formData();
  const lang = formData.get('lang')?.toString();
  const pedido = formData.get('current_path')?.toString() || '/';
  let destino = /^\/(?![/\\])/.test(pedido) ? pedido : '/';

  if (lang === 'en' || lang === 'es') {
    cookies.set('forge_lang', lang, {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    // Con sesión, `/` es Inicio y no la portada: no hay a dónde cambiar.
    if (lang === 'en' && destino === '/es') destino = '/';
    if (lang === 'es' && destino === '/' && !locals.user) destino = '/es';
  }

  return redirect(destino);
};
