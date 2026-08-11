import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../lib/guard';
import { ForgeEvents } from '../../../../lib/automations';
import crypto from 'crypto';
import { finalizeIssueSessions } from './timer';

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const issueId = params.id as string;
  const user = locals.user!;
  
  
  const body = await request.json();
  const position = body.position;
  const status = body.status;
  const sprint_id = body.sprint_id;
  
  if (position === undefined || typeof position !== 'number' || !status) {
    return new Response('Missing position or status', { status: 400 });
  }

  // 1. Obtener Issue y Validar Existencia
  const oldIssue = db.prepare('SELECT status, sprint_id, workspace_id, position FROM issues WHERE id = ?').get(issueId) as any;
  if (!oldIssue) return new Response('Not Found', { status: 404 });

  // 2. Validar Aislamiento Multi-Tenant
  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, oldIssue.workspace_id, 'editor');
  if (!access.granted) {
    if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
    return new Response(access.error, { status: 403 });
  }

  // 3. Validar sprint_id si está presente
  if (sprint_id !== undefined && sprint_id !== null) {
    const sprint = db.prepare('SELECT id FROM sprints WHERE id = ? AND workspace_id = ?').get(sprint_id, oldIssue.workspace_id);
    if (!sprint) return new Response('Sprint not found or belongs to another workspace', { status: 400 });
  }

  // 4. Transacción Segura: Mover y Rebalancear si es necesario
  const updateTransaction = db.transaction(() => {
    const newSprintId = sprint_id !== undefined ? sprint_id : oldIssue.sprint_id;
    
    // Validar rebalanceo
    // Encontrar vecinos en el nuevo grupo
    let neighborsQuery = `SELECT id, position FROM issues WHERE workspace_id = ? AND status = ?`;
    let params: any[] = [oldIssue.workspace_id, status];
    
    if (newSprintId) {
      neighborsQuery += ` AND sprint_id = ?`;
      params.push(newSprintId);
    } else {
      neighborsQuery += ` AND sprint_id IS NULL`;
    }
    neighborsQuery += ` AND id != ? ORDER BY position ASC, id ASC`;
    params.push(issueId);
    
    const neighbors = db.prepare(neighborsQuery).all(...params) as any[];
    
    // Check if the requested position is too close to any neighbor
    let needsRebalance = false;
    for (const neighbor of neighbors) {
      if (Math.abs(neighbor.position - position) < 1e-5) {
        needsRebalance = true;
        break;
      }
    }
    
    let finalPosition = position;
    
    if (needsRebalance) {
      // Rebalance transaction: space everyone by 100000
      let currentPos = 100000;
      let inserted = false;
      for (const neighbor of neighbors) {
        if (!inserted && position <= neighbor.position) {
          finalPosition = currentPos;
          currentPos += 100000;
          inserted = true;
        }
        db.prepare('UPDATE issues SET position = ? WHERE id = ?').run(currentPos, neighbor.id);
        currentPos += 100000;
      }
      if (!inserted) finalPosition = currentPos;
    }
    
    // Update issue
    let sql = 'UPDATE issues SET position = ?, status = ?, updated_at = CURRENT_TIMESTAMP';
    let updateParams: any[] = [finalPosition, status];
    
    if (sprint_id !== undefined) {
      sql += ', sprint_id = ?';
      updateParams.push(sprint_id);
    }
    sql += ' WHERE id = ?';
    updateParams.push(issueId);
    
    db.prepare(sql).run(...updateParams);
    
    // 5. Auto-stop time tracker si pasa a review o done
    if (status === 'review' || status === 'done') {
      finalizeIssueSessions(issueId, 'Auto-registrado al completar');
    }

    // camelCase, que es lo que desestructura el oyente en `lib/automations.ts`.
    // Se emitía en snake_case, así que `workspaceId` llegaba como `undefined` y
    // better-sqlite3 rechazaba el binding: ninguna automatización llegó nunca a
    // consultarse siquiera.
    ForgeEvents.emit('issue.status_changed', {
      issueId,
      workspaceId: oldIssue.workspace_id,
      oldStatus: oldIssue.status,
      newStatus: status,
      userId: user.id,
    });
    
    db.prepare('INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(), oldIssue.workspace_id, user.id, 'ISSUE_MOVED', 'issue', issueId, JSON.stringify({ oldStatus: oldIssue.status, newStatus: status, oldPosition: oldIssue.position, newPosition: finalPosition })
    );
  });
  
  try {
    updateTransaction();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};
