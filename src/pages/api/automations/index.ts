import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { funciones, funcionApagada } from '../../../lib/funcionesEspacio';
import { checkWorkspaceAccess } from '../../../lib/guard';
import crypto from 'crypto';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user!;

  try {
    const body = await request.json();
    const { workspaceId, name, trigger_type, trigger_condition, action_type, action_payload } = body;

    if (!workspaceId || !name || !trigger_type || !trigger_condition || !action_type || !action_payload) {
      return new Response('Missing fields', { status: 400 });
    }

    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspaceId, 'owner');
    if (!access.granted) return new Response('Forbidden', { status: 403 });
    if (!funciones(workspaceId).automatizaciones) return funcionApagada('automatizaciones');

    // Validate JSONs
    JSON.parse(trigger_condition);
    JSON.parse(action_payload);

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO automations (id, workspace_id, name, trigger_type, trigger_condition, action_type, action_payload, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, workspaceId, name, trigger_type, trigger_condition, action_type, action_payload);

    db.prepare('INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(), workspaceId, user.id, 'AUTOMATION_CREATED', 'automation', id, JSON.stringify({ name, trigger_type })
    );

    return new Response(JSON.stringify({ id }), { status: 201 });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};
