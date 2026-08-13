import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { checkWorkspaceAccess } from '../../../lib/guard';
import { NotificationService } from '../../../lib/NotificationService';

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

    const sprint = db.prepare('SELECT workspace_id, name FROM sprints WHERE id = ?').get(id) as any;
    if (!sprint) return new Response('Not Found', { status: 404 });

    const requiredRole = status === 'completed' ? 'owner' : 'editor';
    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, sprint.workspace_id, requiredRole);
    
    if (!access.granted) {
      if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
      return new Response(access.error, { status: 403 });
    }

    db.prepare('UPDATE sprints SET status = ? WHERE id = ?').run(status, id);

    // Avisar al equipo cuando un sprint arranca o se cierra.
    //
    // Ajustes ofrecía «silenciar actualizaciones de sprint» desde el principio,
    // pero no había nada que silenciar: ningún punto del código creaba esa
    // notificación. Una preferencia sobre algo que no ocurre es una promesa
    // vacía, así que o se implementa o se quita; esto es implementarla.
    //
    // Va a los **demás** miembros: quien pulsa el botón ya sabe lo que ha
    // hecho, y una notificación de tu propia acción es ruido.
    if (status === 'active' || status === 'completed') {
      const miembros = db.prepare(
        'SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id <> ?'
      ).all(sprint.workspace_id, user.id) as Array<{ user_id: string }>;

      const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(sprint.workspace_id) as any;
      const titulo = status === 'active' ? 'Sprint iniciado' : 'Sprint cerrado';

      for (const m of miembros) {
        NotificationService.notify(
          m.user_id,
          'sprint',
          titulo,
          sprint.name ?? '',
          ws ? `/w/${ws.sys_tag}/board` : undefined
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
