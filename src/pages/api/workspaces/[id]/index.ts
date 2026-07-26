import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../lib/guard';
import { WorkspaceService } from '../../../../lib/WorkspaceService';
import { ApiError, handleApiError } from '../../../../lib/errors';

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user!;
  const workspaceId = params.id;
  
  if (!workspaceId) return new Response('Missing workspace ID', { status: 400 });

  try {
    await WorkspaceService.delete(workspaceId, user.id, user.is_sysadmin);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return handleApiError(err);
  }
};

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user!;
  const workspaceId = params.id;
  
  if (!workspaceId) return new Response('Missing workspace ID', { status: 400 });

  // Only owner can edit
  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspaceId, 'owner');
  if (!access.granted) {
    if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
    return new Response(access.error || 'Forbidden', { status: 403 });
  }

  if (user.is_guest === 1) {
    return new Response('Guest accounts cannot modify workspace settings', { status: 403 });
  }

  try {
    const { name, sys_tag, icon, description, is_public, join_policy } = await request.json();
    if (!name || !sys_tag) return new Response('Name and System Tag are required', { status: 400 });
    
    // [M-2 FIX] Validate sys_tag format — same rule as POST /api/workspaces
    if (!/^[a-z0-9\-]+$/.test(sys_tag)) {
      return new Response('Invalid sys_tag format (lowercase letters, numbers and dashes only)', { status: 400 });
    }

    // Check if tag is taken
    const existing = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ? AND id != ?').get(sys_tag, workspaceId);
    if (existing) return new Response('System tag already in use', { status: 400 });
    
    const oldWs = db.prepare('SELECT sys_tag, is_public, join_policy FROM workspaces WHERE id = ?').get(workspaceId) as any;
    
    // Validate is_public and join_policy
    const validIsPublic = is_public ? 1 : 0;
    const validJoinPolicy = ['open', 'friends_only', 'disabled'].includes(join_policy) ? join_policy : 'disabled';

    db.prepare('UPDATE workspaces SET name = ?, sys_tag = ?, icon = ?, description = ?, is_public = ?, join_policy = ? WHERE id = ?').run(
      name, sys_tag, icon || null, description || null, validIsPublic, validJoinPolicy, workspaceId
    );
    
    // Public to private transition or disabling join policy => cancel pending requests
    if (oldWs && ((oldWs.is_public === 1 && validIsPublic === 0) || (oldWs.join_policy !== 'disabled' && validJoinPolicy === 'disabled'))) {
      const pendingReqs = db.prepare(`SELECT id, user_id FROM workspace_join_requests WHERE workspace_id = ? AND status = 'pending'`).all(workspaceId) as any[];
      if (pendingReqs.length > 0) {
        db.prepare(`UPDATE workspace_join_requests SET status = 'cancelled' WHERE workspace_id = ? AND status = 'pending'`).run(workspaceId);
        // Send notification to users whose requests were cancelled
        const crypto = await import('crypto');
        const stmt = db.prepare(`INSERT INTO notifications (id, user_id, type, title, message) VALUES (?, ?, 'system', 'Workspace Request Cancelled', 'Your request to join workspace ' || ? || ' was cancelled because the workspace is no longer accepting requests.')`);
        const tx = db.transaction(() => {
          for (const req of pendingReqs) {
            stmt.run(crypto.randomUUID(), req.user_id, name);
          }
        });
        tx();
      }
    }

    if (oldWs && oldWs.sys_tag !== sys_tag) {
      db.prepare('UPDATE users SET last_workspace_id = ? WHERE last_workspace_id = ?').run(sys_tag, oldWs.sys_tag);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};
