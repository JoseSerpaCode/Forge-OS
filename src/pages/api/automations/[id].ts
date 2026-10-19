import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { funciones, funcionApagada } from '../../../lib/funcionesEspacio';
import { checkWorkspaceAccess } from '../../../lib/guard';
import crypto from 'crypto';

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user!;

  const id = params.id;
  const rule = db.prepare('SELECT workspace_id, name FROM automations WHERE id = ?').get(id) as any;
  if (!rule) return new Response('Not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, rule.workspace_id, 'owner');
  if (!access.granted) return new Response('Forbidden', { status: 403 });

  db.prepare('DELETE FROM automations WHERE id = ?').run(id);

  db.prepare('INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(), rule.workspace_id, user.id, 'AUTOMATION_DELETED', 'automation', id as string, JSON.stringify({ name: rule.name })
  );

  return new Response('OK', { status: 200 });
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;

  const id = params.id;
  const rule = db.prepare('SELECT workspace_id, name FROM automations WHERE id = ?').get(id) as any;
  if (!rule) return new Response('Not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, rule.workspace_id, 'owner');
  if (!access.granted) return new Response('Forbidden', { status: 403 });
  // Reactivar una regla con la función apagada no tendría efecto visible.
  if (!funciones(rule.workspace_id).automatizaciones) return funcionApagada('automatizaciones');

  try {
    const body = await request.json();
    if (body.is_active !== undefined) {
      db.prepare('UPDATE automations SET is_active = ? WHERE id = ?').run(body.is_active, id);
      
      db.prepare('INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(), rule.workspace_id, user.id, 'AUTOMATION_TOGGLED', 'automation', id as string, JSON.stringify({ name: rule.name, is_active: body.is_active })
      );
    }

    return new Response('OK', { status: 200 });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};
