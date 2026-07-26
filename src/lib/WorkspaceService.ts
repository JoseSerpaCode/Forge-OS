import db from '../lib/db';
import { checkWorkspaceAccess } from '../lib/guard';
import fs from 'fs/promises';
import path from 'path';
import { ApiError } from './errors';

export { ApiError } from './errors';

export class WorkspaceService {
  /**
   * Safely deletes a workspace, ensuring physical files (attachments)
   * are cleaned up from the filesystem to prevent storage leaks.
   */
  static async delete(workspaceId: string, userId: string, isSysadmin: number) {
    const access = checkWorkspaceAccess(userId, isSysadmin, workspaceId, 'owner');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }

    const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(workspaceId) as any;
    if (!ws) throw new ApiError(404, 'Workspace not found');

    // Find all attachments belonging to this workspace to delete physical files
    // Attachments belong to issues, pages, messages, etc.
    const attachments = db.prepare(`
      SELECT a.id, a.file_path 
      FROM attachments a
      LEFT JOIN issues i ON a.entity_type = 'issue' AND a.entity_id = i.id
      LEFT JOIN pages p ON a.entity_type = 'page' AND a.entity_id = p.id
      LEFT JOIN messages m ON a.entity_type = 'message' AND a.entity_id = m.id
      LEFT JOIN channels c ON m.channel_id = c.id
      WHERE i.workspace_id = ? OR p.workspace_id = ? OR c.workspace_id = ?
    `).all(workspaceId, workspaceId, workspaceId) as any[];

    // Start a transaction for DB deletion
    const deleteTransaction = db.transaction(() => {
      // Clean up users' last_workspace_id
      db.prepare('UPDATE users SET last_workspace_id = NULL WHERE last_workspace_id = ?').run(ws.sys_tag);

      // Clean up attachment DB records manually since they are polymorphic and don't cascade easily
      for (const attachment of attachments) {
        db.prepare('DELETE FROM attachments WHERE id = ?').run(attachment.id);
      }

      // Finally delete the workspace. 
      // SQLite CASCADE will handle issues, pages, sprints, labels, etc.
      db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId);
    });

    deleteTransaction();

    // After DB transaction commits, delete physical files
    for (const attachment of attachments) {
      if (attachment.file_path.startsWith('/api/storage/')) {
        const fileName = attachment.file_path.replace('/api/storage/', '');
        const fullPath = path.join(process.cwd(), '.data', 'storage', fileName);
        try {
          await fs.unlink(fullPath);
        } catch (err: any) {
          if (err.code !== 'ENOENT') {
            console.error(`Failed to delete physical file ${fullPath}:`, err);
          }
        }
      }
    }

    return { success: true };
  }
}
