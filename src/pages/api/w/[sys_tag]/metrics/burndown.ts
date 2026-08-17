import type { APIRoute } from 'astro';
import db from '../../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../../lib/guard';
import { serie, tomarFoto } from '../../../../../lib/sprintSnapshots';

export const GET: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user!;
  const { sys_tag } = params;
  const url = new URL(request.url);
  const sprintId = url.searchParams.get('sprint_id');

  try {
    // 1. Server-side workspace resolution
    const workspace = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sys_tag) as any;
    if (!workspace) return new Response('Workspace Not Found', { status: 404 });

    // 2. Authorization check
    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspace.id, 'viewer');
    if (!access.granted) {
      if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
      return new Response('Forbidden', { status: 403 });
    }

    if (!sprintId) {
      return new Response(JSON.stringify({ error: 'Missing sprint_id parameter' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // 3. Verify sprint belongs to workspace
    const sprint = db.prepare('SELECT start_date, end_date FROM sprints WHERE id = ? AND workspace_id = ?').get(sprintId, workspace.id) as any;
    if (!sprint) {
       return new Response(JSON.stringify({ error: 'Sprint not found in this workspace' }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    /**
     * El burndown sale de las fotos diarias, no de un recuento de ahora.
     *
     * Aquí había un `COUNT(*)` del estado actual con un comentario que decía
     * «mock ... for MVP purposes». El módulo que arregla eso —
     * `lib/sprintSnapshots.ts`— se escribió, se probó y **nunca se enchufó**:
     * el CHANGELOG anunciaba el arreglo en la v1.12.0 y el endpoint siguió
     * devolviendo lo mismo doce versiones.
     *
     * El problema de recalcular no es el coste, es que **la historia cambia**:
     * si a un ticket le suben los puntos o se mueve de sprint, la curva de la
     * semana pasada se redibuja distinta hoy. Una gráfica de progreso que
     * cambia hacia atrás no sirve para mirar atrás.
     */
    const fotos = serie(sprintId);

    /**
     * La foto de hoy se refresca al mirar.
     *
     * El disparador diario deja la de cada día, pero si alguien abre Métricas a
     * media tarde después de cerrar cinco tickets, la curva tiene que
     * enseñarlos. `tomarFoto` es idempotente por día: refresca la de hoy y no
     * toca ninguna anterior. Así también se llena el primer día de un sprint,
     * antes de que el disparador haya pasado por él.
     */
    const hoy = tomarFoto(sprintId);
    const serieCompleta = [...fotos.filter((f) => f.takenOn !== hoy.takenOn), hoy]
      .sort((a, b) => a.takenOn.localeCompare(b.takenOn));

    const burndownData = {
      sprint_start: sprint.start_date,
      sprint_end: sprint.end_date,
      // Se mantienen los dos campos que ya consumía la gráfica, para no
      // romperla mientras se le añade la serie.
      total_issues: hoy.issuesTotal,
      completed_issues: hoy.issuesDone,
      series: serieCompleta.map((f) => ({
        date: f.takenOn,
        points_total: f.pointsTotal,
        points_done: f.pointsDone,
        issues_total: f.issuesTotal,
        issues_done: f.issuesDone,
      })),
    };

    return new Response(JSON.stringify(burndownData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Burndown API Error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};
