import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../lib/guard';

// GET /api/issues/[issue_id]/linked-pages → list linked KB pages
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user!;

  const { issue_id } = params;
  if (!issue_id) return new Response('Bad Request', { status: 400 });

  const issue = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(issue_id) as any;
  if (!issue) return new Response('Not Found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'viewer');
  if (!access.granted) return new Response('Forbidden', { status: 403 });

  const linked = db.prepare(`
    SELECT p.id, p.title, p.icon, p.updated_at, ipl.linked_at, u.username as linked_by_username
    FROM issue_page_links ipl
    JOIN pages p ON ipl.page_id = p.id
    LEFT JOIN users u ON ipl.linked_by = u.id
    WHERE ipl.issue_id = ?
    ORDER BY ipl.linked_at DESC
  `).all(issue_id);

  return new Response(JSON.stringify(linked), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// POST /api/issues/[issue_id]/linked-pages → link a page to this issue
export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;

  const { issue_id } = params;
  if (!issue_id) return new Response('Bad Request', { status: 400 });

  const issue = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(issue_id) as any;
  if (!issue) return new Response('Not Found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'editor');
  if (!access.granted) return new Response('Forbidden', { status: 403 });

  try {
    const { page_id } = await request.json();
    if (!page_id) return new Response(JSON.stringify({ error: 'page_id is required' }), { status: 400 });

    // Verify the page belongs to the same workspace
    const page = db.prepare('SELECT id FROM pages WHERE id = ? AND workspace_id = ?').get(page_id, issue.workspace_id) as any;
    if (!page) return new Response(JSON.stringify({ error: 'Page not found in this workspace' }), { status: 404 });

    // Insert or ignore if already linked
    db.prepare(`
      INSERT OR IGNORE INTO issue_page_links (issue_id, page_id, linked_by)
      VALUES (?, ?, ?)
    `).run(issue_id, page_id, user.id);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('POST issue-page-links error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
};

// DELETE /api/issues/[issue_id]/linked-pages → unlink
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;

  const { issue_id } = params;
  if (!issue_id) return new Response('Bad Request', { status: 400 });

  const issue = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(issue_id) as any;
  if (!issue) return new Response('Not Found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'editor');
  if (!access.granted) return new Response('Forbidden', { status: 403 });

  try {
    const { page_id } = await request.json();
    if (!page_id) return new Response(JSON.stringify({ error: 'page_id is required' }), { status: 400 });

    db.prepare('DELETE FROM issue_page_links WHERE issue_id = ? AND page_id = ?').run(issue_id, page_id);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('DELETE issue-page-links error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
};
