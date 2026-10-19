import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { funciones, funcionApagada } from '../../../../lib/funcionesEspacio';
import { checkWorkspaceAccess } from '../../../../lib/guard';
import crypto from 'crypto';

import { finalizeActiveSession, finalizeIssueSessions } from '../../../../lib/sesionesTiempo';
// Se reexportan: el test del cronómetro y código antiguo las importan desde aquí.
export { finalizeActiveSession, finalizeIssueSessions };

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const issueId = params.id as string;

  const issue = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(issueId) as any;
  if (!issue) return new Response('Not Found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'viewer');
  if (!access.granted) {
    return new Response('Forbidden', { status: access.reason === 'not_member' ? 404 : 403 });
  }

  // Passively auto-close if > 12h
  const active = db.prepare('SELECT id, started_at FROM time_tracking_sessions WHERE issue_id = ? AND user_id = ?').get(issueId, user.id) as any;
  if (active) {
    const started = new Date(active.started_at + 'Z').getTime();
    const age = (Date.now() - started) / (1000 * 60 * 60);
    if (age > 12) {
      finalizeActiveSession(user.id);
      return new Response(JSON.stringify({ active: false }), { status: 200 });
    }
    return new Response(JSON.stringify({ active: true, started_at: active.started_at, hours_elapsed: age }), { status: 200 });
  }

  return new Response(JSON.stringify({ active: false }), { status: 200 });
};

export const POST: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const issueId = params.id as string;

  const issue = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(issueId) as any;
  if (!issue) return new Response('Not Found', { status: 404 });

  // Require editor to track time
  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'editor');
  if (!access.granted) {
    return new Response('Forbidden', { status: access.reason === 'not_member' ? 404 : 403 });
  }
  // Parar sí se deja con la función apagada (`DELETE`); arrancar, no.
  if (!funciones(issue.workspace_id).tiempo) return funcionApagada('tiempo');

  // Check if same issue
  const existing = db.prepare('SELECT id FROM time_tracking_sessions WHERE issue_id = ? AND user_id = ?').get(issueId, user.id);
  if (existing) {
    return new Response(JSON.stringify({ success: true, message: 'Timer already running' }), { status: 200 });
  }

  // Finalize any other running timer
  const stopped = finalizeActiveSession(user.id);

  // Start new
  db.prepare('INSERT INTO time_tracking_sessions (id, issue_id, user_id, started_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').run(crypto.randomUUID(), issueId, user.id);
  
  return new Response(JSON.stringify({ success: true, stopped_previous: !!stopped, stopped_details: stopped }), { status: 200 });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const issueId = params.id as string;

  const issue = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(issueId) as any;
  if (!issue) return new Response('Not Found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'editor');
  if (!access.granted) {
    return new Response('Forbidden', { status: access.reason === 'not_member' ? 404 : 403 });
  }

  const result = finalizeActiveSession(user.id);
  return new Response(JSON.stringify({ success: true, logged: result }), { status: 200 });
};
