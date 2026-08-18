import db from '../lib/db';
import { checkWorkspaceAccess } from '../lib/guard';
import type { Issue } from '../types/db';
import { NotificationService } from './NotificationService';
import crypto from 'crypto';
import { finalizeIssueSessions } from '../pages/api/issues/[id]/timer';
import { ApiError } from './errors';
import { escaparLike } from './texto';

export { ApiError } from './errors';

export class IssueService {
  /**
   * Retrieves an issue by ID.
   */
  static async getById(issueId: string) {
    return db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
  }

  /**
   * Updates an issue dynamically. Solves the N+1 problem.
   */
  static async update(
    issueId: string, 
    data: Partial<Issue>, 
    userId: string, 
    isSysadmin: number,
    username: string
  ) {
    // El título entra en la consulta porque lo usa el aviso de asignación: sin
    // él, el mensaje solo podía enseñar un trozo del identificador.
    const issue = db.prepare('SELECT id, workspace_id, title FROM issues WHERE id = ?').get(issueId) as Pick<Issue, 'id' | 'workspace_id' | 'title'> | undefined;
    if (!issue) throw new ApiError(404, 'Issue Not Found');

    const access = checkWorkspaceAccess(userId, isSysadmin, issue.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Issue Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }

    // Whitelist allowed fields to prevent SQL injection via keys
    const allowedFields = ['title', 'description', 'status', 'priority', 'story_points', 'estimated_hours', 'type', 'assignee_id', 'sprint_id', 'position', 'due_date'];
    const safeData: any = {};
    for (const key of Object.keys(data)) {
      if (allowedFields.includes(key)) {
        safeData[key] = data[key as keyof Partial<Issue>];
      }
    }

    const keys = Object.keys(safeData);
    if (keys.length === 0) return { success: true };

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = Object.values(safeData);
    
    // Add updated_at
    const finalClause = `${setClause}, updated_at = CURRENT_TIMESTAMP`;
    values.push(issueId); // for WHERE id = ?

    db.prepare(`UPDATE issues SET ${finalClause} WHERE id = ?`).run(...values);

    // Automation logic could be hooked here (EventEmitter pattern)
    
    // Auto-stop time tracker on done
    if (safeData.status === 'done' || safeData.status === 'review') {
      finalizeIssueSessions(issueId, 'Auto-registrado al completar');
    }

    // Assignee Notification Hook
    if (data.assignee_id !== undefined && data.assignee_id !== null && data.assignee_id !== userId) {
      const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(issue.workspace_id) as any;
      if (ws) {
        // El título, no ocho caracteres del identificador: «te han asignado
        // 3f2a1b9c» no dice qué hay que hacer, y obliga a abrir el enlace solo
        // para saber si importa.
        NotificationService.notify(
          data.assignee_id,
          'assign',
          'Te han asignado un ticket',
          `${username}: ${data.title ?? issue.title ?? ''}`,
          `/w/${ws.sys_tag}/board?issue=${issueId}`
        );
      }
    }

    return { success: true };
  }

  static async delete(issueId: string, userId: string, isSysadmin: number) {
    const issue = db.prepare('SELECT id, workspace_id FROM issues WHERE id = ?').get(issueId) as Pick<Issue, 'id' | 'workspace_id'> | undefined;
    if (!issue) throw new ApiError(404, 'Issue Not Found');

    const access = checkWorkspaceAccess(userId, isSysadmin, issue.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Issue Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }

    db.prepare('DELETE FROM issues WHERE id = ?').run(issueId);
    return { success: true };
  }
  static async create(data: Partial<Issue>, userId: string, isSysadmin: number) {
    if (!data.title || !data.workspace_id) throw new ApiError(400, 'Title and workspaceId are required');

    const access = checkWorkspaceAccess(userId, isSysadmin, data.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }

    if (data.sprint_id) {
      const sprint = db.prepare('SELECT id FROM sprints WHERE id = ? AND workspace_id = ?').get(data.sprint_id, data.workspace_id);
      if (!sprint) throw new ApiError(400, 'Sprint not found or belongs to another workspace');
    }

    if (data.assignee_id) {
      const isMember = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(data.workspace_id, data.assignee_id);
      if (!isMember) throw new ApiError(400, 'Assignee is not a member of this workspace');
    }

    const issueId = crypto.randomUUID();
    const status = 'todo';
    
    let position = 100000;
    const lastIssue = db.prepare('SELECT position FROM issues WHERE workspace_id = ? AND status = ? ORDER BY position DESC LIMIT 1').get(data.workspace_id, status) as any;
    if (lastIssue) {
      position = lastIssue.position + 100000;
    }

    db.prepare(`
      INSERT INTO issues (id, workspace_id, sprint_id, title, type, status, reporter_id, position, assignee_id, due_date, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(issueId, data.workspace_id, data.sprint_id || null, data.title, data.type || 'task', status, userId, position, data.assignee_id || null, data.due_date || null, data.description || null);

    // Avisar a quien queda asignado **al crear**, no solo al editar después.
    //
    // Este hueco explicaba por sí solo el «no me llega nunca nada»: crear el
    // ticket ya asignado es el camino normal —está en el propio formulario de
    // nuevo ticket—, y era el único que no avisaba. Había que crearlo sin
    // asignar y asignarlo en un segundo paso para que saliera la notificación.
    if (data.assignee_id && data.assignee_id !== userId) {
      const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(data.workspace_id) as any;
      const quien = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
      if (ws) {
        NotificationService.notify(
          data.assignee_id,
          'assign',
          'Te han asignado un ticket',
          `${quien?.username ?? 'Alguien'}: ${data.title}`,
          `/w/${ws.sys_tag}/board?issue=${issueId}`
        );
      }
    }

    const generalChannel = db.prepare("SELECT id FROM channels WHERE workspace_id = ? AND name = 'general'").get(data.workspace_id) as any;
    if (generalChannel) {
      process.emit('system_notification', { channelId: generalChannel.id, content: `🆕 New issue created: **${data.title}** (${data.type || 'task'})` });
    }

    return { id: issueId };
  }

  /**
   * Duplicar un ticket.
   *
   * Lo interesante no es lo que se copia, sino lo que **no**:
   *
   *  - **Las horas registradas se quedan a cero.** Son el registro de un tiempo
   *    que alguien trabajó de verdad. Copiarlas inventa trabajo que no ocurrió,
   *    y el tablero las suma para dar el total del sprint: duplicar tres veces
   *    un ticket de ocho horas añadiría veinticuatro horas de nada.
   *  - **El estado vuelve a «por hacer».** Se duplica sobre todo para repetir
   *    algo ya hecho, y una copia que nace en «Hecho» es trabajo invisible: no
   *    la mira nadie y cuenta como terminada.
   *  - **El cronómetro no se hereda.** Una sesión abierta pertenece a la
   *    persona que la arrancó sobre el ticket original.
   *
   * Sí se copian las etiquetas: son la clasificación del trabajo y siguen
   * valiendo. Y el sprint, **salvo que esté cerrado** — meter trabajo nuevo en
   * un sprint terminado descuadra lo que ese sprint dice que se hizo, así que
   * en ese caso la copia va al backlog.
   */
  static async duplicate(issueId: string, userId: string, isSysadmin: number) {
    const original = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId) as Issue | undefined;
    if (!original) throw new ApiError(404, 'Not Found');

    const access = checkWorkspaceAccess(userId, isSysadmin, original.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }

    // Un sprint cerrado no recibe trabajo nuevo.
    let sprintId = original.sprint_id;
    if (sprintId) {
      const sprint = db.prepare("SELECT status FROM sprints WHERE id = ?").get(sprintId) as any;
      if (!sprint || sprint.status === 'completed') sprintId = null;
    }

    // Quien estaba asignado puede haberse ido del espacio desde entonces.
    let assigneeId = original.assignee_id;
    if (assigneeId) {
      const sigue = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .get(original.workspace_id, assigneeId);
      if (!sigue) assigneeId = null;
    }

    const nuevoId = crypto.randomUUID();
    const estado = 'todo';

    const ultima = db.prepare(
      'SELECT position FROM issues WHERE workspace_id = ? AND status = ? ORDER BY position DESC LIMIT 1'
    ).get(original.workspace_id, estado) as any;
    const position = ultima ? ultima.position + 100000 : 100000;

    // Título y etiquetas en la misma transacción: una copia a medias —el ticket
    // creado y las etiquetas no— es peor que ninguna, porque parece completa.
    const titulo = IssueService.tituloDeCopia(original.title, original.workspace_id);

    db.transaction(() => {
      db.prepare(`
        INSERT INTO issues (
          id, workspace_id, sprint_id, parent_issue_id, type, title, description,
          status, priority, story_points, estimated_hours, logged_hours,
          position, reporter_id, assignee_id, due_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      `).run(
        nuevoId,
        original.workspace_id,
        sprintId,
        original.parent_issue_id ?? null,
        original.type,
        titulo,
        original.description ?? null,
        estado,
        original.priority ?? null,
        original.story_points ?? null,
        original.estimated_hours ?? null,
        position,
        // El autor de la copia es quien la hace, no quien escribió el original:
        // las preguntas sobre este ticket nuevo van a quien lo creó.
        userId,
        assigneeId,
        original.due_date ?? null
      );

      db.prepare(`
        INSERT OR IGNORE INTO issue_labels (issue_id, label_id)
        SELECT ?, label_id FROM issue_labels WHERE issue_id = ?
      `).run(nuevoId, issueId);
    })();

    if (assigneeId && assigneeId !== userId) {
      const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(original.workspace_id) as any;
      const quien = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
      if (ws) {
        NotificationService.notify(
          assigneeId,
          'assign',
          'Te han asignado un ticket',
          `${quien?.username ?? 'Alguien'}: ${titulo}`,
          `/w/${ws.sys_tag}/board?issue=${nuevoId}`
        );
      }
    }

    return { id: nuevoId, title: titulo, sprint_id: sprintId };
  }

  /**
   * «Informe semanal» → «Informe semanal (copia)» → «Informe semanal (copia 2)».
   *
   * Numerar desde la segunda evita el ridículo de un «(copia 1)» cuando solo hay
   * una, y evita también tres tarjetas idénticas en el tablero, que es lo que
   * pasa si el título se repite tal cual: son indistinguibles salvo abriéndolas.
   *
   * El tope de 200 caracteres es el de la columna en la práctica; el sufijo se
   * añade recortando el título, no reventándolo.
   */
  private static tituloDeCopia(titulo: string, workspaceId: string): string {
    const base = titulo.replace(/\s*\(copia(?: \d+)?\)$/i, '').trim();

    const usados = db.prepare(
      "SELECT title FROM issues WHERE workspace_id = ? AND (title = ? OR title LIKE ?)"
    ).all(workspaceId, base, `${escaparLike(base)} (copia%`) as Array<{ title: string }>;

    const nombres = new Set(usados.map((u) => u.title));
    const recorta = (t: string) => (t.length > 200 ? `${t.slice(0, 197)}...` : t);

    let candidato = `${base} (copia)`;
    for (let n = 2; nombres.has(candidato); n++) candidato = `${base} (copia ${n})`;
    return recorta(candidato);
  }
}
