import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { checkWorkspaceAccess } from '../../../lib/guard';

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  const user = locals.user!;
  if (!id) return new Response('Bad Request', { status: 400 });

  try {
    const data = await request.json();
    const { status } = data;
    
    if (!status) return new Response('Missing status', { status: 400 });

    const VALID_STATUSES = ['planned', 'active', 'completed'];
    if (!VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status. Must be one of: planned, active, completed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const sprint = db.prepare('SELECT workspace_id FROM sprints WHERE id = ?').get(id) as any;
    if (!sprint) return new Response('Not Found', { status: 404 });

    const requiredRole = status === 'completed' ? 'owner' : 'editor';
    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, sprint.workspace_id, requiredRole);
    
    if (!access.granted) {
      if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
      return new Response(access.error, { status: 403 });
    }

    db.prepare('UPDATE sprints SET status = ? WHERE id = ?').run(status, id);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
