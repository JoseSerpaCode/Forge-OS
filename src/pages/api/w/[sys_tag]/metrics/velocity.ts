import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../../lib/guard';

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user!;
  const { sys_tag } = params;

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

    // 3. Query execution (bound securely to resolved workspace_id)
    const velocityData = db.prepare(`
      SELECT s.name as sprint_name, COUNT(i.id) as velocity, COALESCE(SUM(COALESCE(i.story_points, 0)), 0) as points
      FROM issues i
      JOIN sprints s ON i.sprint_id = s.id
      WHERE i.workspace_id = ? AND i.status = 'done' AND s.status = 'completed'
      GROUP BY s.id
      ORDER BY s.start_date ASC
      LIMIT 5
    `).all(workspace.id);

    return new Response(JSON.stringify(velocityData), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (err: any) {
    console.error('Velocity API Error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};
