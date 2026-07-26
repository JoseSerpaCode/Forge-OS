import db from '../lib/db';
import { checkWorkspaceAccess } from '../lib/guard';
import type { Issue } from '../types/db';
import { NotificationService } from './NotificationService';
import crypto from 'crypto';
import { finalizeIssueSessions } from '../pages/api/issues/[id]/timer';
import { ApiError } from './errors';

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
    const issue = db.prepare('SELECT id, workspace_id FROM issues WHERE id = ?').get(issueId) as Pick<Issue, 'id' | 'workspace_id'> | undefined;
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
        NotificationService.notify(
          data.assignee_id,
          'assign',
          'Task Assigned',
          `${username} assigned you to issue ${issueId.substring(0,8)}`,
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

    const generalChannel = db.prepare("SELECT id FROM channels WHERE workspace_id = ? AND name = 'general'").get(data.workspace_id) as any;
    if (generalChannel) {
      process.emit('system_notification', { channelId: generalChannel.id, content: `🆕 New issue created: **${data.title}** (${data.type || 'task'})` });
    }

    return { id: issueId };
  }
}
