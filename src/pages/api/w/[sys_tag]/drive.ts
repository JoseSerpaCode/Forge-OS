import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../lib/guard';
import { abrirEspacio, json } from '../../../../lib/apiWorkspace';
import {
  conexionDe, crearEstado, desconectar, driveDisponible, urlDeConsentimiento,
} from '../../../../lib/drive';

/**
 * La conexión con Drive de un espacio.
 *
 * Conectar es cosa de un **propietario**, no de cualquiera que pueda editar:
 * lo que se ata al espacio es el Drive personal de alguien, con su cuota y sus
 * archivos. Que un editor de paso pudiera enchufar —o desenchufar— la cuenta
 * de otra persona sería regalar una decisión que no le corresponde.
 */



/** El estado de la conexión. Nunca el token, ni cifrado. */
export const GET: APIRoute = async ({ params, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;

  const c = conexionDe(ws.id);
  return json({
    available: driveDisponible(),
    connected: Boolean(c),
    status: c?.status ?? null,
    email: c?.googleEmail ?? null,
    folder_link: c?.folderLink ?? null,
    connected_at: c?.connectedAt ?? null,
  });
};

/**
 * Empieza la conexión.
 *
 * Responde con la URL en vez de redirigir: la llamada sale de `fetch` desde la
 * pantalla, y una redirección ahí la seguiría el propio `fetch` —acabaría
 * trayéndose el HTML de Google a un sitio donde no sirve de nada— en lugar de
 * llevar a la persona a la pantalla de permisos.
 */
export const POST: APIRoute = async ({ params, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'owner');
  if (error) return error;

  if (!driveDisponible()) return json({ error_code: 'drive_unavailable' }, 503);

  const url = urlDeConsentimiento(crearEstado(ws.id, user.id));
  if (!url) return json({ error_code: 'drive_unavailable' }, 503);

  return json({ url });
};

/**
 * Desconecta.
 *
 * Solo se olvida el token: las carpetas y los archivos se quedan en el Drive de
 * quien los subió. Borrarlos desde aquí sería destruir cosas que no son
 * nuestras, y encima sin poder preguntar.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'owner');
  if (error) return error;

  return desconectar(ws.id) ? json({ success: true }) : json({ error_code: 'not_connected' }, 404);
};
