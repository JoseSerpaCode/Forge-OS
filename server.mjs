// server.mjs
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handler as astroHandler } from './dist/server/entry.mjs'; // Build output
import { setupSockets } from './src/lib/sockets.mjs';

const app = express();
const server = createServer(app);
const io = new Server(server);

// Detrás de un proxy inverso (Caddy en producción), Express debe fiarse de las
// cabeceras X-Forwarded-* para reconstruir la URL original. Sin esto,
// `Astro.url` devuelve http://localhost:4321 y se propaga a <link rel=canonical>
// y a las etiquetas OpenGraph — y, cuando exista OAuth, al redirect URI, que
// los proveedores rechazarían.
//
// El valor 1 significa "confía en un único salto": el proxy que tenemos
// delante. Confiar en todos permitiría a un cliente falsear su IP de origen.
app.set('trust proxy', 1);

// Servir estáticos de Astro (CSS, JS, assets)
import path from 'path';
app.use(
  express.static(path.join(process.cwd(), 'dist/client'), {
    setHeaders(res, filePath) {
      // Los assets de /_astro/ llevan un hash de contenido en el nombre: si el
      // contenido cambia, cambia la URL. Son inmutables, así que se cachean para
      // siempre y dejan de consumir egress en cada visita.
      if (filePath.includes(`${path.sep}_astro${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// Inyectar Socket.io en la aplicación
setupSockets(io);

// Astro SSR Middleware
app.use(astroHandler);

const PORT = process.env.PORT || 4321;
server.listen(PORT, () => {
  const publicUrl = process.env.PUBLIC_SITE_URL || `http://localhost:${PORT}`;
  console.log(`[SYS.NET] Forge OS corriendo en ${publicUrl} (escuchando en :${PORT})`);
  console.log(`[SYS.NET] WebSockets (WSS) online.`);
});
