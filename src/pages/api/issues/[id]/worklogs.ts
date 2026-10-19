import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { funciones, funcionApagada } from '../../../../lib/funcionesEspacio';
import { checkWorkspaceAccess } from '../../../../lib/guard';
import crypto from 'crypto';

export const GET: APIRoute = async ({ params, locals }) => {
  const issueId = params.id;
  const user = locals.user!;

  const issue = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(issueId) as any;
  if (!issue) return new Response('Not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'viewer');
  if (!access.granted) return new Response('Forbidden', { status: 403 });

  const logs = db.prepare(`
    SELECT wl.id, wl.hours_spent, wl.description, wl.work_date, wl.user_id, u.username, u.avatar_url
    FROM work_logs wl
    JOIN users u ON wl.user_id = u.id
    WHERE wl.issue_id = ?
    ORDER BY wl.work_date DESC, wl.logged_at DESC
  `).all(issueId);

  return new Response(JSON.stringify(logs), { status: 200 });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const issueId = params.id;
  const user = locals.user!;

  const issue = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(issueId) as any;
  if (!issue) return new Response('Not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'editor');
  if (!access.granted) return new Response('Forbidden', { status: 403 });
  if (!funciones(issue.workspace_id).tiempo) return funcionApagada('tiempo');

  try {
    const body = await request.json();
    let { hours_spent, description, work_date } = body;
    
    hours_spent = parseFloat(hours_spent);
    if (isNaN(hours_spent) || hours_spent <= 0) {
      return new Response('Invalid hours_spent', { status: 400 });
    }

    if (!work_date) work_date = new Date().toISOString();

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO work_logs (id, issue_id, user_id, hours_spent, description, work_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, issueId, user.id, hours_spent, description || null, work_date);

    // No need to manually update issues.logged_hours here because of the SQLite triggers in db.ts!

    db.prepare('INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(), issue.workspace_id, user.id, 'WORKLOG_CREATED', 'work_log', id, JSON.stringify({ issue_id: issueId, hours: hours_spent })
    );

    return new Response(JSON.stringify({ id }), { status: 201 });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};
