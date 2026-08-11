import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../../lib/guard';

export const GET: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user!;
  const { sys_tag } = params;

  const url = new URL(request.url);
  const sprintId = url.searchParams.get('sprint_id');

  try {
    // 1. Server-side workspace resolution
    const workspace = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sys_tag) as any;
    if (!workspace) return new Response('Workspace Not Found', { status: 404 });

    // 2. Authorization check
    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspace.id, 'viewer');
    if (!access.granted) {
      if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
      return new Response('Forbidden', { status: 403 });
    }

    // 3. 2D Distribution (Assignee x Status)
    let distributionData;
    if (sprintId) {
      distributionData = db.prepare(`
        SELECT -- La etiqueta de «sin asignar» NO se pone aquí.
        -- Estas dos gráficas viven en la misma pantalla y cada una traía la
        -- suya: 'Unassigned' en distribución y 'Sin asignar' en precisión, así
        -- que Métricas enseñaba los dos idiomas a la vez, fuera cual fuera el
        -- del usuario. El servidor devuelve NULL y el cliente resuelve la
        -- palabra con la clave i18n que ya existe.
        u.username as assignee, i.status, COUNT(i.id) as count
        FROM issues i
        LEFT JOIN users u ON i.assignee_id = u.id
        WHERE i.workspace_id = ? AND i.sprint_id = ?
        GROUP BY i.assignee_id, i.status
      `).all(workspace.id, sprintId);
    } else {
      distributionData = db.prepare(`
        SELECT u.username as assignee, i.status, COUNT(i.id) as count
        FROM issues i
        LEFT JOIN users u ON i.assignee_id = u.id
        WHERE i.workspace_id = ?
        GROUP BY i.assignee_id, i.status
      `).all(workspace.id);
    }

    return new Response(JSON.stringify(distributionData), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (err: any) {
    console.error('Distribution API Error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};
