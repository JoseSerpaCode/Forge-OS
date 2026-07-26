import type { APIRoute } from 'astro';
import { IssueService } from '../../../lib/IssueService';
import { handleApiError } from '../../../lib/errors';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user!;

  try {
    const data = await request.json();
    const result = await IssueService.create(data, user.id, user.is_sysadmin);
    return new Response(JSON.stringify(result), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return handleApiError(err);
  }
};
