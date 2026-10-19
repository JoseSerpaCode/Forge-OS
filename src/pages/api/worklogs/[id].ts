import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { funciones, funcionApagada } from '../../../lib/funcionesEspacio';
import { checkWorkspaceAccess } from '../../../lib/guard';
import crypto from 'crypto';

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const logId = params.id;
  const user = locals.user!;

  const log = db.prepare(`
    SELECT wl.*, i.workspace_id 
    FROM work_logs wl
    JOIN issues i ON wl.issue_id = i.id
    WHERE wl.id = ?
  `).get(logId) as any;
  if (!log) return new Response('Not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, log.workspace_id, 'editor');
  if (!access.granted) return new Response('Forbidden', { status: 403 });
  // Borrar un registro sí se deja con el tiempo apagado: es limpiar.
  if (!funciones(log.workspace_id).tiempo) return funcionApagada('tiempo');

  // Only the author or a workspace owner can edit the log
  if (log.user_id !== user.id && access.role !== 'owner' && user.is_sysadmin !== 1) {
    return new Response('Only the author or an owner can edit this log', { status: 403 });
  }

  try {
    const body = await request.json();
    const hours_spent = body.hours_spent !== undefined ? parseFloat(body.hours_spent) : log.hours_spent;
    const description = body.description !== undefined ? body.description : log.description;
    const work_date = body.work_date !== undefined ? body.work_date : log.work_date;

    if (isNaN(hours_spent) || hours_spent < 0) {
      return new Response('Invalid hours_spent', { status: 400 });
    }

    db.prepare(`
      UPDATE work_logs 
      SET hours_spent = ?, description = ?, work_date = ?
      WHERE id = ?
    `).run(hours_spent, description, work_date, logId);

    // No need to manually update issues.logged_hours here because of the SQLite triggers in db.ts!

    db.prepare('INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(), log.workspace_id, user.id, 'WORKLOG_UPDATED', 'work_log', logId as string, JSON.stringify({ issue_id: log.issue_id, old_hours: log.hours_spent, new_hours: hours_spent })
    );

    return new Response('OK', { status: 200 });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const logId = params.id;
  const user = locals.user!;

  const log = db.prepare(`
    SELECT wl.*, i.workspace_id 
    FROM work_logs wl
    JOIN issues i ON wl.issue_id = i.id
    WHERE wl.id = ?
  `).get(logId) as any;
  if (!log) return new Response('Not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, log.workspace_id, 'editor');
  if (!access.granted) return new Response('Forbidden', { status: 403 });

  // Only the author or a workspace owner can delete the log
  if (log.user_id !== user.id && access.role !== 'owner' && user.is_sysadmin !== 1) {
    return new Response('Only the author or an owner can delete this log', { status: 403 });
  }

  db.prepare('DELETE FROM work_logs WHERE id = ?').run(logId);
  // SQLite triggers will automatically deduct hours from issue.logged_hours

  db.prepare('INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(), log.workspace_id, user.id, 'WORKLOG_DELETED', 'work_log', logId as string, JSON.stringify({ issue_id: log.issue_id, hours: log.hours_spent })
  );

  return new Response('OK', { status: 200 });
};
