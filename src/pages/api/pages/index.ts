import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { EMPTY_NOTE_JSON } from '../../../lib/notes/content';
import { checkWorkspaceAccess } from '../../../lib/guard';
import crypto from 'crypto';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user!;
  if (!user?.last_workspace_id) return new Response('Bad Request', { status: 400 });

  try {
    const data = await request.json();
    const workspaceId = data.workspace_id;

    if (!workspaceId) {
      return new Response('Workspace ID is required', { status: 400 });
    }

    // Validate Permissions (Editor required for POST)
    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspaceId, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
      return new Response(access.error || 'Forbidden', { status: 403 });
    }

    // 3. If parent_page_id is provided, validate it belongs to the SAME workspace
    if (data.parent_page_id) {
      const parentPage = db.prepare('SELECT workspace_id FROM pages WHERE id = ?').get(data.parent_page_id) as any;
      if (!parentPage || parentPage.workspace_id !== workspaceId) {
        return new Response('Bad Request: Cross-workspace parenting or parent not found', { status: 400 });
      }
    }

    const newId = crypto.randomUUID();
    
    // 4. Insert page explicitly binding to workspaceId
    db.prepare(`
      INSERT INTO pages (id, workspace_id, parent_page_id, title, content_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      workspaceId,
      data.parent_page_id || null,
      data.title || 'Untitled',
      EMPTY_NOTE_JSON,
      user.id
    );

    return new Response(JSON.stringify({ id: newId, title: data.title || 'Untitled' }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
