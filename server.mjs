// server.mjs
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handler as astroHandler } from './dist/server/entry.mjs'; // Build output
import { setupSockets } from './src/lib/sockets.mjs';
import path from 'path';

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

// Comprobación de salud para el script de despliegue. Va antes que los
// estáticos y que Astro para que responda aunque el build esté a medias.
//
// Consulta la base de datos a propósito: un proceso que acepta conexiones pero
// no puede leer su SQLite está caído para todo lo que importa, y un healthcheck
// que solo devuelve 200 no lo distinguiría.
//
// Abre su propia conexión de **solo lectura** en vez de importar `src/lib/db.ts`.
// Ese módulo crea el esquema y corre las migraciones al importarlo, así que
// usarlo aquí ataría el arranque del servidor a que la base sea escribible y
// repetiría todo ese trabajo en cada boot.
import Database from 'better-sqlite3';
const DB_PATH =
  process.env.DATABASE_URL || path.join(process.cwd(), 'forge.db');

app.get('/healthz', (_req, res) => {
  let probe;
  try {
    probe = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    probe.prepare('SELECT 1').get();
    res.type('text/plain').send('ok');
  } catch (err) {
    res.status(503).type('text/plain').send(`db: ${err.message}`);
  } finally {
    probe?.close();
  }
});

// Servir estáticos de Astro (CSS, JS, assets)
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

/**
 * Conexiones persistentes: el servidor tiene que aguantar más que quien le
 * habla.
 *
 * Node cierra una conexión keep-alive ociosa a los 5 segundos. Si el cliente
 * —Caddy delante, o el navegador— reutiliza esa misma conexión justo en ese
 * instante, la petición se escribe en un socket que ya se está cerrando y el
 * cliente ve un `ECONNRESET`. No es un fallo de la aplicación y no deja rastro
 * en los registros: simplemente, de vez en cuando, una petición muere.
 *
 * Se vio en las pruebas de punta a punta, donde varios trabajadores en paralelo
 * hacen justo eso —muchas peticiones cortas reutilizando conexiones— y una
 * prueba cualquiera fallaba una vez de cada tres corridas. Detrás de un proxy
 * el mismo caso se convierte en un 502 esporádico para alguien de verdad.
 *
 * La regla es que el origen espere más que el que está delante. 65 segundos
 * queda por encima de los 60 habituales, y `headersTimeout` tiene que ser mayor
 * que `keepAliveTimeout` o vuelve a ganar la carrera.
 */
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

const PORT = process.env.PORT || 4321;
server.listen(PORT, () => {
  const publicUrl = process.env.PUBLIC_SITE_URL || `http://localhost:${PORT}`;
  console.log(`[SYS.NET] Forge OS corriendo en ${publicUrl} (escuchando en :${PORT})`);
  console.log(`[SYS.NET] WebSockets (WSS) online.`);
});
