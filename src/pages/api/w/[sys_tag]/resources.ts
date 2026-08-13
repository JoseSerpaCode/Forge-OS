import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../lib/guard';
import { crearRecurso, listar, archivar, vincular, normalizarUrl, type TipoRecurso } from '../../../../lib/resources';

/**
 * Recursos de un espacio de trabajo.
 *
 * El espacio se identifica **por la ruta** y el permiso se comprueba contra él,
 * nunca contra un `workspace_id` del cuerpo. Aceptarlo del cuerpo es el camino
 * corto al IDOR: bastaría con mandar el id de otro espacio para escribir dentro.
 */

const TIPOS: TipoRecurso[] = ['link', 'file', 'note', 'snippet', 'repo'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Resuelve el espacio de la ruta y comprueba el permiso pedido. */
function abrirEspacio(sysTag: string | undefined, user: any, rol: 'viewer' | 'editor') {
  const ws = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sysTag) as any;
  if (!ws) return { error: new Response('Not Found', { status: 404 }) };

  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, ws.id, rol);
  if (!acceso.granted) {
    // Quien no es miembro recibe 404, no 403: un 403 confirma que el espacio
    // existe, y eso ya es información sobre un sitio donde no pinta nada.
    if (acceso.reason === 'not_member') return { error: new Response('Not Found', { status: 404 }) };
    return { error: new Response(acceso.error, { status: 403 }) };
  }
  return { ws };
}

export const GET: APIRoute = async ({ params, locals }) => {
  const { ws, error } = abrirEspacio(params.sys_tag, locals.user!, 'viewer');
  if (error) return error;
  return json(listar(ws.id));
};

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

  const tipo = datos?.type;
  if (!TIPOS.includes(tipo)) return json({ error_code: 'bad_type' }, 400);

  const titulo = typeof datos?.title === 'string' ? datos.title.trim() : '';
  if (!titulo) return json({ error_field: 'title', error_code: 'required' }, 400);
  if (titulo.length > 300) return json({ error_field: 'title', error_code: 'too_long' }, 400);

  // Los tipos con URL la necesitan de verdad, y tiene que ser una que se pueda
  // normalizar: sin clave de deduplicación, el módulo pierde su razón de ser.
  if (tipo === 'link' || tipo === 'repo') {
    if (!normalizarUrl(datos?.url)) return json({ error_field: 'url', error_code: 'invalid' }, 400);
  }

  const creado = crearRecurso({
    workspaceId: ws.id,
    type: tipo,
    title: titulo,
    description: datos?.description,
    url: datos?.url,
    body: datos?.body,
    language: datos?.language,
    createdBy: user.id,
  });

  // Vínculo opcional con algo del espacio. Se comprueba que la entidad sea
  // **de este espacio**: sin eso se podría colgar un recurso propio de un issue
  // ajeno y hacerlo aparecer en el panel de otro equipo.
  const et = datos?.entity_type;
  const ei = datos?.entity_id;
  if (et && ei) {
    if (!['issue', 'page', 'sprint'].includes(et)) return json({ error_code: 'bad_entity_type' }, 400);
    const tabla = et === 'issue' ? 'issues' : et === 'page' ? 'pages' : 'sprints';
    const propia = db.prepare(`SELECT 1 FROM ${tabla} WHERE id = ? AND workspace_id = ?`).get(ei, ws.id);
    if (!propia) return json({ error_code: 'entity_not_here' }, 400);

    const sprintId = et === 'issue'
      ? ((db.prepare('SELECT sprint_id FROM issues WHERE id = ?').get(ei) as any)?.sprint_id ?? null)
      : null;
    vincular(creado.id, et, ei, sprintId);
  }

  // 200 y no 201 cuando ya existía: no se ha creado nada. Y se dice, para que
  // la pantalla pueda avisar de que ese enlace ya estaba en la lista en vez de
  // fingir un alta.
  return json({ id: creado.id, already_existed: creado.yaExistia }, creado.yaExistia ? 200 : 201);
};

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

  // El archivado se limita al espacio de la ruta: `archivar` lleva el
  // `workspace_id` en su propio WHERE, así que un id de otro espacio no toca
  // nada y devuelve 404.
  return archivar(id, ws.id) ? json({ success: true }) : json({ error_code: 'not_found' }, 404);
};
