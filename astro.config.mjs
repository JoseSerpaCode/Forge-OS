// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

// URL pública real, única fuente de verdad para `site` y para los dominios de
// confianza de abajo. En producción se fija con PUBLIC_SITE_URL; el valor por
// defecto mantiene el comportamiento de desarrollo intacto.
const siteUrl = new URL(process.env.PUBLIC_SITE_URL || 'http://localhost:4321');

// https://astro.build/config
export default defineConfig({
  output: 'server',

  // Astro la usa para resolver enlaces absolutos.
  site: siteUrl.href.replace(/\/$/, ''),

  security: {
    // Sin esto, Astro ignora X-Forwarded-Proto y cree que la petición llegó por
    // HTTP — que es lo que ve del tramo interno Caddy→Node. Entonces compara el
    // Origin del navegador (https://forge-os.online) contra http://forge-os.online,
    // no cuadra, y checkOrigin rechaza TODOS los POST de formulario con
    // "Cross-site POST form submissions are forbidden". En producción eso rompía
    // el selector de idioma y habría roto cualquier formulario nuevo.
    //
    // Declarando los dominios de confianza, Astro pasa a hacer caso a
    // X-Forwarded-Host y X-Forwarded-Proto y `Astro.url` queda correcta en toda
    // la app — que es además lo que necesitará el redirect URI de OAuth.
    //
    // La lista es EXPLÍCITA a propósito. Astro admite `[{}]` como comodín, pero
    // eso acepta cualquier X-Forwarded-Host que envíe un cliente: justo el
    // ataque de inyección de host que esta opción existe para prevenir.
    //
    // No se toca `checkOrigin`: desactivarlo también quitaría el 403, pero
    // dejando la app sin protección CSRF en todos los formularios.
    allowedDomains: [
      { hostname: siteUrl.hostname, protocol: siteUrl.protocol.replace(':', '') },
      { hostname: `www.${siteUrl.hostname}`, protocol: siteUrl.protocol.replace(':', '') },
    ],
  },

  devToolbar: {
    enabled: false
  },
  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({
    mode: 'middleware'
  })
});