import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../lib/guard';
import { moverPagina } from '../../../../lib/arbolPaginas';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * PATCH /api/pages/[page_id]/move — `{ parent_id: string | null, index: number }`
 *
 * Cuelga la nota de `parent_id` (o la saca a la raíz con `null`) en la
 * posición `index` entre sus nuevas hermanas. Lo usan arrastrar en el árbol y
 * «Mover a…».
 *
 * El espacio sale de la fila de la nota, nunca del cuerpo ni de
 * `last_workspace_id`: con varias pestañas abiertas ese valor puede ser de
 * otro espacio. Sin acceso se contesta 404, igual que el resto de rutas de
 * páginas, para no confirmar que la nota existe.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { page_id } = params;
  if (!page_id) return json({ error: 'Bad Request' }, 400);

  const pagina = db.prepare('SELECT workspace_id FROM pages WHERE id = ?').get(page_id) as
    | { workspace_id: string }
    | undefined;
  if (!pagina) return json({ error: 'Not Found' }, 404);

  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, pagina.workspace_id, 'editor');
  if (!acceso.granted) return json({ error: 'Not Found' }, 404);

  let cuerpo: any;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const padre = cuerpo?.parent_id ?? null;
  if (padre !== null && typeof padre !== 'string') return json({ error: 'invalid_parent' }, 400);
  const indice = Number(cuerpo?.index);
  if (!Number.isFinite(indice)) return json({ error: 'invalid_index' }, 400);

  const r = moverPagina(pagina.workspace_id, page_id, padre, indice);
  if (!r.ok) {
    // Un padre de otro espacio se contesta igual que uno que no existe.
    if (r.error === 'cycle') return json({ error: 'cycle' }, 409);
    return json({ error: r.error }, r.error === 'not_found' ? 404 : 400);
  }
  return json({ success: true }, 200);
};
