import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { deEntidad, desvincular, vincular } from '../../../../../lib/driveFiles';
import { deEntidad as etiquetasDe } from '../../../../../lib/labels';
import { abrirEspacio, json } from '../../../../../lib/apiWorkspace';

/**
 * Colgar un archivo de un ticket o de una página.
 *
 * Al colgarlo **hereda las etiquetas** de aquello a lo que se cuelga. Es la
 * razón de ser de este endpoint: si la tarea está etiquetada «Parcial 2», la
 * guía que se le adjunta queda etiquetada igual sin que nadie lo haga a mano, y
 * a partir de ahí se puede encontrar filtrando en Archivos.
 */



async function leer(request: Request) {
  let datos: any;
  try {
    datos = await request.json();
  } catch {
    return { error: json({ error_code: 'bad_request' }, 400) };
  }

  const fileId = typeof datos?.file_id === 'string' ? datos.file_id : '';
  const tipo = datos?.entity_type;
  const entidadId = typeof datos?.entity_id === 'string' ? datos.entity_id : '';

  if (!fileId || !entidadId) return { error: json({ error_code: 'bad_request' }, 400) };
  if (tipo !== 'issue' && tipo !== 'page') return { error: json({ error_code: 'bad_entity_type' }, 400) };

  return { fileId, tipo: tipo as 'issue' | 'page', entidadId };
}

/** Los archivos colgados de algo. */
export const GET: APIRoute = async ({ params, url, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;

  const tipo = url.searchParams.get('entity_type');
  const entidadId = url.searchParams.get('entity_id');
  if (tipo !== 'issue' && tipo !== 'page') return json({ error_code: 'bad_entity_type' }, 400);
  if (!entidadId) return json({ error_code: 'bad_request' }, 400);

  // Que la entidad sea de este espacio: si no, se podría leer qué archivos
  // lleva un ticket ajeno sabiendo su id.
  const tabla = tipo === 'issue' ? 'issues' : 'pages';
  const propia = db.prepare(`SELECT 1 FROM ${tabla} WHERE id = ? AND workspace_id = ?`).get(entidadId, ws.id);
  if (!propia) return json({ error_code: 'entity_not_here' }, 404);

  return json({ files: deEntidad(tipo, entidadId) });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;

  const datos = await leer(request);
  if (datos.error) return datos.error;

  const r = vincular(datos.fileId!, ws.id, datos.tipo!, datos.entidadId!);
  if (!r.ok) return json({ error_code: r.error }, 400);

  // Se devuelve lo que ha quedado puesto, incluidas las heredadas, para que la
  // pantalla enseñe la verdad y no lo que cree que pasó.
  return json({
    inherited: r.heredadas,
    labels: etiquetasDe('file', datos.fileId!),
    files: deEntidad(datos.tipo!, datos.entidadId!),
  });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'editor');
  if (error) return error;

  const datos = await leer(request);
  if (datos.error) return datos.error;

  const quitado = desvincular(datos.fileId!, ws.id, datos.tipo!, datos.entidadId!);
  if (!quitado) return json({ error_code: 'not_found' }, 404);

  return json({ files: deEntidad(datos.tipo!, datos.entidadId!) });
};
