import type { APIRoute } from 'astro';
import db from '../../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user!;

  try {
    const { bio, pronouns, public_email, is_public, avatar_url, banner_url } = await request.json();
    
    // Strict validation
    if (bio && typeof bio !== 'string') return new Response('Invalid bio', { status: 400 });
    if (bio && bio.length > 500) return new Response('Bio too long (max 500 characters)', { status: 400 });
    
    if (pronouns && typeof pronouns !== 'string') return new Response('Invalid pronouns', { status: 400 });
    if (pronouns && pronouns.length > 30) return new Response('Pronouns too long', { status: 400 });
    
    if (public_email && typeof public_email !== 'string') return new Response('Invalid email', { status: 400 });
    if (public_email && public_email.length > 100) return new Response('Email too long', { status: 400 });
    if (public_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(public_email)) {
      return new Response('Invalid email format', { status: 400 });
    }

    const updateFields: string[] = [];
    const values: any[] = [];

    if (bio !== undefined) { updateFields.push('bio = ?'); values.push(bio ? bio.trim() : null); }
    if (pronouns !== undefined) { updateFields.push('pronouns = ?'); values.push(pronouns ? pronouns.trim() : null); }
    if (public_email !== undefined) { updateFields.push('public_email = ?'); values.push(public_email ? public_email.trim() : null); }
    if (is_public !== undefined) { 
        updateFields.push('is_public = ?'); 
        values.push(user.is_guest === 1 ? 0 : (is_public ? 1 : 0)); 
    }
    if (avatar_url !== undefined) { 
      if (typeof avatar_url !== 'string') return new Response('Invalid avatar format', { status: 400 });
      if (avatar_url.length > 2048) return new Response('Avatar URL too long', { status: 400 });
      if (avatar_url !== '' && !avatar_url.startsWith('http://') && !avatar_url.startsWith('https://') && !avatar_url.startsWith('data:image/') && !avatar_url.startsWith('/api/storage/')) {
        return new Response('Invalid avatar source', { status: 400 });
      }
      if (avatar_url.startsWith('data:image/svg+xml')) return new Response('SVG uploads are not permitted', { status: 400 });
      updateFields.push('avatar_url = ?'); values.push(avatar_url ? avatar_url.trim() : null); 
    }
    if (banner_url !== undefined) { 
      if (typeof banner_url !== 'string') return new Response('Invalid banner format', { status: 400 });
      if (banner_url.length > 2048) return new Response('Banner URL too long', { status: 400 });
      if (banner_url !== '' && !banner_url.startsWith('http://') && !banner_url.startsWith('https://') && !banner_url.startsWith('data:image/') && !banner_url.startsWith('/api/storage/')) {
        return new Response('Invalid banner source', { status: 400 });
      }
      if (banner_url.startsWith('data:image/svg+xml')) return new Response('SVG uploads are not permitted', { status: 400 });
      updateFields.push('banner_url = ?'); values.push(banner_url ? banner_url.trim() : null); 
    }

    if (updateFields.length > 0) {
        values.push(user.id);
        db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};
