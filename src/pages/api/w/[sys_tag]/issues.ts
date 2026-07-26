import type { APIRoute } from 'astro';
import { IssueService } from '../../../../lib/IssueService';
import { ApiError, handleApiError } from '../../../../lib/errors';
import db from '../../../../lib/db';

export const POST: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user!;
  const { sys_tag } = params;

  try {
    const data = await request.json();
    
    // Server-side workspace_id resolution
    const workspace = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sys_tag) as any;
    if (!workspace) throw new ApiError(404, 'Workspace Not Found');
    
    data.workspace_id = workspace.id;

    const result = await IssueService.create(data, user.id, user.is_sysadmin);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return handleApiError(err);
  }
};
