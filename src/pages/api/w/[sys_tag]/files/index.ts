import type { APIRoute } from 'astro';
import { accesoPara, aLaPapelera, carpeta as carpetaDrive, conexionDe } from '../../../../../lib/drive';
import { abrirEspacio, json } from '../../../../../lib/apiWorkspace';
import {
  archivo, archivosDe, carpeta, carpetasDe, crearCarpeta, marcarPerdido, olvidar,
} from '../../../../../lib/driveFiles';

/**
 * Archivos y carpetas de un espacio.
 *
 * Listar es para cualquiera que pueda mirar; crear carpetas y borrar, para
 * quien pueda editar. Como en todo lo demás, el espacio sale de la **ruta** y
 * nunca del cuerpo.
 */



/** La carpeta pedida, comprobando que es de este espacio. `null` = la raíz. */
function carpetaPedida(valor: string | null, workspaceId: string) {
  if (!valor) return { folderId: null as string | null };
  const c = carpeta(valor, workspaceId);
  if (!c) return { error: json({ error_code: 'folder_not_found' }, 404) };
  return { folderId: c.id, carpeta: c };
}

export const GET: APIRoute = async ({ params, url, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;

  const pedida = carpetaPedida(url.searchParams.get('folder'), ws.id);
  if (pedida.error) return pedida.error;

  return json({
    folders: carpetasDe(ws.id, pedida.folderId),
    files: archivosDe(ws.id, pedida.folderId),
  });
};

/** Crea una carpeta, aquí y en Drive. */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'editor');
  if (error) return error;

  let datos: any;
  try {
    datos = await request.json();
  } catch {
    return json({ error_code: 'bad_request' }, 400);
  }

  const pedida = carpetaPedida(datos?.parent_id ?? null, ws.id);
  if (pedida.error) return pedida.error;

  const conexion = conexionDe(ws.id);
  if (!conexion) return json({ error_code: 'not_connected' }, 409);

  // La carpeta se crea primero en Drive, para que el árbol de allí sea el
  // mismo que el de aquí. Si Drive falla se crea igualmente en Forge, sin
  // `drive_id`: perder lo que alguien acaba de ordenar por un fallo de red
  // ajeno es peor que tener una carpeta pendiente de sincronizar.
  let driveId: string | null = null;
  const acceso = await accesoPara(ws.id);
  if (acceso) {
    const padreDrive = pedida.carpeta?.driveId ?? conexion.folderId;
    if (padreDrive) {
      const creada = await carpetaDrive(acceso, String(datos?.name ?? '').slice(0, 200), padreDrive);
      driveId = creada?.id ?? null;
    }
  }

  const r = crearCarpeta({
    workspaceId: ws.id,
    parentId: pedida.folderId,
    nombre: datos?.name,
    driveId,
    createdBy: user.id,
  });
  if (!r.ok) return json({ error_code: r.error }, r.error === 'parent_not_found' ? 404 : 400);

  return json({ ...r.carpeta, synced: Boolean(driveId) }, 201);
};

/**
 * Quita un archivo.
 *
 * En Drive va a la **papelera**, no se destruye: es el Drive de una persona y
 * ahí puede recuperarlo. Si Drive no contesta, se quita igualmente de la lista
 * de Forge y se dice, porque lo contrario es un botón que no hace nada.
 */
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;

  let id: unknown;
  try {
    id = (await request.json())?.id;
  } catch {
    return json({ error_code: 'bad_request' }, 400);
  }
  if (typeof id !== 'string' || !id) return json({ error_code: 'bad_request' }, 400);

  const f = archivo(id, ws.id);
  if (!f) return json({ error_code: 'not_found' }, 404);

  let enPapelera = false;
  const acceso = await accesoPara(ws.id);
  if (acceso) enPapelera = await aLaPapelera(acceso, f.driveId);

  olvidar(id, ws.id);
  return json({ success: true, trashed: enPapelera });
};

/** Marca un archivo como no encontrado, sin borrar sus datos. */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;

  let datos: any;
  try {
    datos = await request.json();
  } catch {
    return json({ error_code: 'bad_request' }, 400);
  }
  if (typeof datos?.id !== 'string' || !datos.id) return json({ error_code: 'bad_request' }, 400);
  if (!archivo(datos.id, ws.id)) return json({ error_code: 'not_found' }, 404);

  marcarPerdido(datos.id, ws.id);
  return json({ success: true });
};
