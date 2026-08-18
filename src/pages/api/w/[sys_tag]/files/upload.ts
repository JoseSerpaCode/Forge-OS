import type { APIRoute } from 'astro';
import { abrirSesionDeSubida, accesoPara, conexionDe, datosDeArchivo } from '../../../../../lib/drive';
import { carpeta, limpiarNombre, registrar } from '../../../../../lib/driveFiles';
import { abrirEspacio, json } from '../../../../../lib/apiWorkspace';

/**
 * Subida de archivos, en dos tiempos.
 *
 * Los bytes **no pasan por aquí**. Con 1 GB de salida de red al mes, hacer de
 * intermediario para los archivos de todo el mundo se lo come en un par de
 * tardes. El reparto es:
 *
 *   1. `POST` — se comprueba el permiso y se abre una sesión de subida en
 *      Drive. Se devuelve **la URL de esa sesión**, que sirve para una subida y
 *      para nada más. Lo que no se devuelve nunca es el token de acceso: sería
 *      darle al navegador una llave que abre todo lo que la aplicación ha
 *      creado en ese Drive, incluidos los archivos de los demás.
 *   2. El navegador manda el archivo a esa URL, directamente a Google.
 *   3. `PUT` — el navegador dice «ya está, este es el id». Antes de creerle se
 *      le pregunta a Drive: que el archivo exista, que no esté en la papelera y
 *      que esté **dentro de la carpeta de este espacio**. Sin esa comprobación,
 *      cualquiera podría meter en la lista el id de un archivo ajeno.
 */


/**
 * Tope por archivo.
 *
 * No es por coste nuestro —los bytes no nos tocan— sino por el de quien presta
 * su Drive: son sus 15 GB. Medio giga por archivo es de sobra para apuntes,
 * PDF y presentaciones, y evita que un despiste llene la cuenta de otro.
 */
const MAXIMO_BYTES = 500 * 1024 * 1024;


/** Paso 1: abre la sesión de subida. */
export const POST: APIRoute = async ({ params, request, locals, url }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;

  let datos: any;
  try {
    datos = await request.json();
  } catch {
    return json({ error_code: 'bad_request' }, 400);
  }

  const nombre = limpiarNombre(datos?.name);
  if (!nombre) return json({ error_code: 'bad_name' }, 400);

  const tamaño = Number(datos?.size);
  if (!Number.isFinite(tamaño) || tamaño < 0) return json({ error_code: 'bad_request' }, 400);
  if (tamaño > MAXIMO_BYTES) return json({ error_code: 'too_large', max: MAXIMO_BYTES }, 413);

  const conexion = conexionDe(ws.id);
  if (!conexion?.folderId) return json({ error_code: 'not_connected' }, 409);

  // La carpeta destino tiene que ser de este espacio.
  let carpetaDestino = conexion.folderId;
  let folderId: string | null = null;
  if (datos?.folder_id) {
    const c = carpeta(String(datos.folder_id), ws.id);
    if (!c) return json({ error_code: 'folder_not_found' }, 404);
    folderId = c.id;
    // Una carpeta creada mientras Drive no respondía no tiene id allí; sus
    // archivos van a la del espacio en vez de fallar.
    if (c.driveId) carpetaDestino = c.driveId;
  }

  const acceso = await accesoPara(ws.id);
  if (!acceso) return json({ error_code: 'drive_unreachable' }, 502);

  const sesion = await abrirSesionDeSubida(acceso, {
    nombre,
    mimeType: typeof datos?.mime_type === 'string' ? datos.mime_type : 'application/octet-stream',
    carpetaDrive: carpetaDestino,
    // Drive necesita el origen para dejar que el `PUT` salga del navegador.
    origen: url.origin,
  });
  if (!sesion.ok) {
    /**
     * Cada motivo con su código, porque cada uno se resuelve distinto.
     *
     * Un Drive lleno no es un fallo de la aplicación: es algo que quien conectó
     * la cuenta puede arreglar en cinco minutos, y decírselo es la diferencia
     * entre eso y pensar que Forge está roto. El 507 es el código que existe
     * exactamente para «no queda sitio».
     */
    if (sesion.motivo === 'sin_espacio') return json({ error_code: 'drive_full' }, 507);
    if (sesion.motivo === 'sin_permiso') return json({ error_code: 'drive_revoked' }, 502);
    return json({ error_code: 'drive_unreachable' }, 502);
  }

  return json({ upload_url: sesion.url, name: nombre, folder_id: folderId });
};

/** Paso 3: comprobar lo subido y darlo de alta. */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'editor');
  if (error) return error;

  let datos: any;
  try {
    datos = await request.json();
  } catch {
    return json({ error_code: 'bad_request' }, 400);
  }

  const driveId = typeof datos?.drive_id === 'string' ? datos.drive_id.trim() : '';
  if (!driveId) return json({ error_code: 'bad_request' }, 400);

  const conexion = conexionDe(ws.id);
  if (!conexion?.folderId) return json({ error_code: 'not_connected' }, 409);

  let folderId: string | null = null;
  let carpetaEsperada = conexion.folderId;
  if (datos?.folder_id) {
    const c = carpeta(String(datos.folder_id), ws.id);
    if (!c) return json({ error_code: 'folder_not_found' }, 404);
    folderId = c.id;
    if (c.driveId) carpetaEsperada = c.driveId;
  }

  const acceso = await accesoPara(ws.id);
  if (!acceso) return json({ error_code: 'drive_unreachable' }, 502);

  const archivo = await datosDeArchivo(acceso, driveId);
  if (!archivo || archivo.trashed) return json({ error_code: 'not_uploaded' }, 400);

  // Que esté donde decimos que está. Es lo que impide meter en la lista el id
  // de un archivo que no salió de aquí.
  if (!archivo.parents?.includes(carpetaEsperada)) {
    return json({ error_code: 'not_in_folder' }, 400);
  }

  const r = registrar({
    workspaceId: ws.id,
    folderId,
    driveId: archivo.id,
    // El nombre y el tamaño se toman de Drive, no de lo que diga el navegador.
    name: archivo.name || 'archivo',
    mimeType: archivo.mimeType ?? null,
    sizeBytes: archivo.size ? Number(archivo.size) : null,
    webViewLink: archivo.webViewLink ?? null,
    uploadedBy: user.id,
  });
  if (!r.ok) return json({ error_code: r.error }, 409);

  return json({ id: r.id, name: archivo.name, web_view_link: archivo.webViewLink ?? null }, 201);
};
