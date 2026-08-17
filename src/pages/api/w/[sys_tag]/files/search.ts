import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../../lib/guard';
import { buscar, busquedasRecientes, olvidarBusquedas, recordarBusqueda } from '../../../../../lib/driveFiles';
import { deVarias as etiquetasDeVarias } from '../../../../../lib/labels';
import { abrirEspacio, json } from '../../../../../lib/apiWorkspace';

/**
 * Buscar archivos por nombre, con historial.
 *
 * El historial es **de cada persona y de cada espacio**, y sirve para repetir
 * una búsqueda de ayer sin volver a escribirla. No es un registro de lo que la
 * gente busca: se guardan diez y se pueden borrar de un botón.
 */



export const GET: APIRoute = async ({ params, url, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'viewer');
  if (error) return error;

  const texto = (url.searchParams.get('q') ?? '').trim();

  // La etiqueta tiene que ser de este espacio; si no, se ignora en vez de
  // devolver una lista vacía que parece que no hay nada.
  const etiquetaPedida = url.searchParams.get('label');
  const etiqueta = etiquetaPedida
    ? (db.prepare('SELECT id FROM labels WHERE id = ? AND workspace_id = ?').get(etiquetaPedida, ws.id) as any)?.id ?? null
    : null;

  // Sin texto no se busca ni se recuerda nada: se devuelve el historial, que es
  // lo que hace falta para enseñar sugerencias en cuanto se abre el buscador.
  if (!texto) {
    return json({ files: [], history: busquedasRecientes(user.id, ws.id) });
  }

  const resultados = buscar(ws.id, texto, { labelId: etiqueta });

  // Con sus etiquetas: buscar por nombre no debería dar una vista más pobre
  // que la de la carpeta. Van en una sola consulta para todos los resultados.
  const etiquetas = etiquetasDeVarias('file', resultados.map((f) => f.id));
  const conEtiquetas = resultados.map((f) => ({ ...f, labels: etiquetas.get(f.id) ?? [] }));

  // Se recuerda **después** de buscar y solo si valía la pena: guardar cada
  // pulsación mientras alguien escribe llenaría el historial de fragmentos.
  if (texto.length >= 3) recordarBusqueda(user.id, ws.id, texto);

  return json({ files: conEtiquetas, history: busquedasRecientes(user.id, ws.id) });
};

/** Olvida el historial de quien lo pide. Solo el suyo. */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'viewer');
  if (error) return error;

  olvidarBusquedas(user.id, ws.id);
  return json({ success: true });
};
