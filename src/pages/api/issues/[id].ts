import type { APIRoute } from 'astro';
import { IssueService } from '../../../lib/IssueService';
import { ApiError, handleApiError } from '../../../lib/errors';
import { checkWorkspaceAccess } from '../../../lib/guard';
import db from '../../../lib/db';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const user = locals.user!;
  if (!id) return new Response('Bad Request', { status: 400 });

  try {
    const issue = await IssueService.getById(id) as any;
    if (!issue) return new Response('Not Found', { status: 404 });

    // IDOR fix: verify user has access to the issue's workspace
    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'viewer');
    if (!access.granted) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(JSON.stringify(issue), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return handleApiError(err);
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  const user = locals.user!;
  if (!id) return new Response('Bad Request', { status: 400 });

  try {
    const data = await request.json();
    await IssueService.update(id, data, user.id, user.is_sysadmin, user.username);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return handleApiError(err);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const user = locals.user!;
  if (!id) return new Response('Bad Request', { status: 400 });

  try {
    await IssueService.delete(id, user.id, user.is_sysadmin);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return handleApiError(err);
  }
};
