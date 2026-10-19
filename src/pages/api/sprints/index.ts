import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { funciones, funcionApagada } from '../../../lib/funcionesEspacio';
import { checkWorkspaceAccess } from '../../../lib/guard';
import crypto from 'crypto';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user!;

  try {
    const { name, workspaceId, start_date, end_date } = await request.json();

    if (!name || !workspaceId) {
      return new Response('Name and workspaceId are required', { status: 400 });
    }

    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspaceId, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
      return new Response(access.error || 'Forbidden', { status: 403 });
    }
    if (!funciones(workspaceId).sprints) return funcionApagada('sprints');

    const newId = crypto.randomUUID();
    
    db.prepare(`
      INSERT INTO sprints (id, workspace_id, name, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, 'planned')
    `).run(newId, workspaceId, name, start_date || null, end_date || null);

    return new Response(JSON.stringify({ id: newId, name, status: 'planned' }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
