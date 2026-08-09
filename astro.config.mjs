// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',

  // URL pública real. Astro la usa para resolver enlaces absolutos; en
  // producción se fija a https://forge-os.online mediante PUBLIC_SITE_URL.
  // El valor por defecto mantiene el comportamiento de desarrollo intacto.
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:4321',

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