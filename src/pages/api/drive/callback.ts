import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { checkWorkspaceAccess } from '../../../lib/guard';
import {
  AMBITO, CARPETA_RAIZ, canjearCodigo, carpeta, compartirPorEnlace,
  correoDeLaCuenta, guardarConexion, leerEstado,
} from '../../../lib/drive';

/**
 * Vuelta de la pantalla de permisos de Google.
 *
 * Aquí se cierra la conexión de un espacio con un Drive. Todo lo que llega es
 * de fuera, así que nada se da por bueno: el `state` lleva firma, la persona
 * tiene que ser la misma que empezó **y** seguir siendo propietaria del
 * espacio, y el permiso concedido tiene que ser realmente el que se pidió.
 *
 * Los errores no se cuentan por pantalla con detalle: se vuelve a la sección de
 * archivos con un código, y allí se traduce. Un volcado del error de Google en
 * mitad de una redirección no lo entiende nadie y de paso enseña interioridades.
 */

/** Vuelve a la sección de archivos del espacio con un código de resultado. */
function volver(sysTag: string | null, codigo: string): Response {
  const destino = sysTag ? `/w/${sysTag}/files?drive=${codigo}` : `/?drive=${codigo}`;
  return new Response(null, { status: 302, headers: { Location: destino } });
}

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  const estado = leerEstado(url.searchParams.get('state'));

  // Sin estado válido no se sabe ni a qué espacio volver. Tampoco se distingue
  // entre firma mala y estado caducado: por fuera es el mismo «vuelve a
  // intentarlo», y separarlos le diría a quien lo manipula qué parte acertó.
  if (!estado) return volver(null, 'bad_state');

  const ws = db.prepare('SELECT id, name, sys_tag FROM workspaces WHERE id = ?').get(estado.workspaceId) as any;
  if (!ws) return volver(null, 'bad_state');

  // La sesión de ahora tiene que ser la que empezó. Si no, alguien podría
  // dejarte a medias su propio permiso para que acabe atado a tu espacio.
  if (!user || user.id !== estado.userId) return volver(ws.sys_tag, 'wrong_user');

  // Y seguir siendo propietaria: entre que se abrió la pantalla de Google y se
  // volvió pueden haber pasado diez minutos y un cambio de rol.
  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, ws.id, 'owner');
  if (!acceso.granted) return volver(ws.sys_tag, 'forbidden');

  // Cancelar en la pantalla de Google es una respuesta legítima, no un fallo.
  const errorDeGoogle = url.searchParams.get('error');
  if (errorDeGoogle) return volver(ws.sys_tag, errorDeGoogle === 'access_denied' ? 'cancelled' : 'google_error');

  const code = url.searchParams.get('code');
  if (!code) return volver(ws.sys_tag, 'google_error');

  const tokens = await canjearCodigo(code);
  if (!tokens?.access_token) return volver(ws.sys_tag, 'google_error');

  // Se puede aceptar entrar y a la vez **desmarcar** el permiso de archivos.
  // Sin él no hay nada que hacer, y es mejor decirlo ahora que dejar una
  // conexión que falla en la primera subida.
  if (tokens.scope && !tokens.scope.split(/\s+/).includes(AMBITO)) {
    return volver(ws.sys_tag, 'missing_scope');
  }

  // Google entrega el token de refresco **solo la primera vez** que se acepta.
  // Se pide con `prompt=consent` justamente para que llegue siempre; si aun así
  // falta, sin él no se podría subir nada cuando esa persona no esté delante.
  if (!tokens.refresh_token) return volver(ws.sys_tag, 'no_refresh_token');

  const raiz = await carpeta(tokens.access_token, CARPETA_RAIZ);
  if (!raiz) return volver(ws.sys_tag, 'folder_failed');

  const delEspacio = await carpeta(tokens.access_token, ws.name, raiz.id);
  if (!delEspacio) return volver(ws.sys_tag, 'folder_failed');

  // Compartir por enlace es lo que permite al resto del equipo abrir los
  // archivos sin cuenta de Google. Si falla, la conexión sirve igual —se puede
  // subir— así que no se tira todo por esto; la pantalla avisa aparte.
  const compartida = await compartirPorEnlace(tokens.access_token, delEspacio.id);

  guardarConexion({
    workspaceId: ws.id,
    refreshToken: tokens.refresh_token,
    googleEmail: await correoDeLaCuenta(tokens.access_token),
    rootFolderId: raiz.id,
    folderId: delEspacio.id,
    folderLink: delEspacio.webViewLink ?? null,
    connectedBy: user.id,
  });

  return volver(ws.sys_tag, compartida ? 'ok' : 'ok_not_shared');
};
