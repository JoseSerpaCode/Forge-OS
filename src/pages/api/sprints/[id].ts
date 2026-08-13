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
    const { status, strategy, target_sprint_id } = data;
    
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

    // ── Cerrar un sprint: qué pasa con lo que no se terminó ─────────────────
    //
    // Cerrar en silencio es lo que hacía antes: el sprint pasaba a completado y
    // los tickets sin acabar se quedaban dentro, invisibles para el siguiente.
    // El trabajo no desaparece porque alguien cambie una etiqueta de estado, y
    // decidir qué hacer con él es del equipo, no del sistema.
    //
    // Por eso, si quedan tickets por terminar, hay que decir explícitamente qué
    // hacer con ellos. Sin `strategy` se devuelve 409 con la cuenta, para que
    // la interfaz pueda preguntar con el número delante.
    let movidos = 0;
    if (status === 'completed') {
      const pendientes = db.prepare(
        "SELECT id FROM issues WHERE sprint_id = ? AND status != 'done'"
      ).all(id) as Array<{ id: string }>;

      if (pendientes.length > 0) {
        const ESTRATEGIAS = ['next', 'backlog', 'keep'];
        if (!ESTRATEGIAS.includes(strategy)) {
          return new Response(
            JSON.stringify({
              error_code: 'unfinished_issues',
              pending: pendientes.length,
              strategies: ESTRATEGIAS,
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (strategy === 'backlog') {
          db.prepare("UPDATE issues SET sprint_id = NULL WHERE sprint_id = ? AND status != 'done'").run(id);
          movidos = pendientes.length;
        } else if (strategy === 'next') {
          // El destino se comprueba: tiene que existir, ser de este mismo
          // espacio y no ser el que se está cerrando. Aceptar un id a ciegas
          // dejaría mover trabajo al sprint de otro equipo.
          const destino = db.prepare(
            "SELECT id FROM sprints WHERE id = ? AND workspace_id = ? AND id != ? AND status != 'completed'"
          ).get(target_sprint_id, sprint.workspace_id, id) as any;
          if (!destino) {
            return new Response(JSON.stringify({ error_code: 'bad_target_sprint' }), {
              status: 400, headers: { 'Content-Type': 'application/json' },
            });
          }
          db.prepare("UPDATE issues SET sprint_id = ? WHERE sprint_id = ? AND status != 'done'").run(destino.id, id);
          movidos = pendientes.length;
        }
        // 'keep': se quedan donde están, pero habiéndolo dicho.
      }
    }

    db.prepare('UPDATE sprints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    if (status === 'completed') {
      db.prepare('UPDATE sprints SET completed_at = CURRENT_TIMESTAMP WHERE id = ? AND completed_at IS NULL').run(id);
    }

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

    return new Response(JSON.stringify({ success: true, moved: movidos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
