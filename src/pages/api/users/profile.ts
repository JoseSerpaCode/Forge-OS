import type { APIRoute } from 'astro';
import db from '../../../lib/db';

/**
 * Legacy convenience endpoint for profile-only updates.
 *
 * All validation now lives in /api/user/settings (the single source of truth).
 * This endpoint simply forwards the request there so that callers like the
 * public profile page (/u/[username]) keep working without changes.
 *
 * Accepted fields: bio, pronouns, public_email, is_public, avatar_url, banner_url.
 */
export const POST: APIRoute = async ({ request, locals, url }) => {
  const user = locals.user!;

  try {
    const data = await request.json();

    // Only allow profile-related fields — reject account/security fields
    const allowed = ['bio', 'pronouns', 'public_email', 'is_public', 'avatar_url', 'banner_url'];
    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }

    if (Object.keys(filtered).length === 0) {
      return new Response(JSON.stringify({ error: 'No profile fields provided' }), { status: 400 });
    }

    // Forward to the canonical endpoint
    const settingsUrl = new URL('/api/user/settings', url.origin);
    const res = await fetch(settingsUrl.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the cookie so auth middleware recognises the user
        'Cookie': request.headers.get('Cookie') || '',
      },
      body: JSON.stringify(filtered),
    });

    // Relay response as-is
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
