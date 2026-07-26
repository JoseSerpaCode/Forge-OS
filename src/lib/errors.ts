/**
 * Structured error for API responses with an explicit HTTP status code.
 * Replaces the duplicate definitions previously found in IssueService and WorkspaceService.
 */
export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Converts any caught error into a structured HTTP Response.
 * Handles ApiError with its specific code, and any other error as 500.
 */
export function handleApiError(err: unknown): Response {
  if (err instanceof ApiError) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: err.statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
  console.error('[API Error]', err);
  return new Response(
    JSON.stringify({ error: 'Internal Server Error' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
