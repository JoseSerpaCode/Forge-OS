import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { checkWorkspaceAccess } from '../../../lib/guard';
import fs from 'fs';
import path from 'path';
import { STORAGE_DIR } from '../../../lib/storage';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const { filename } = params;
  if (!filename) return new Response('Bad Request', { status: 400 });

  const user = locals.user!;

  // 1. Find the attachment record to get entity context
  const fileUrl = `/api/storage/${filename}`;
  const attachment = db.prepare('SELECT entity_type, entity_id, mime_type FROM attachments WHERE file_path = ?').get(fileUrl) as any;
  
  if (!attachment) {
    return new Response('File not found', { status: 404 });
  }

  // 2. Enforce Access based on entity type
  if (attachment.entity_type === 'issue' || attachment.entity_type === 'page') {
    const table = attachment.entity_type === 'issue' ? 'issues' : 'pages';
    const entity = db.prepare(`SELECT workspace_id FROM ${table} WHERE id = ?`).get(attachment.entity_id) as any;
    
    if (!entity) return new Response('Entity not found', { status: 404 });

    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, entity.workspace_id, 'viewer');
    if (!access.granted) {
      if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
      return new Response(access.error || 'Forbidden', { status: 403 });
    }
  } else if (attachment.entity_type === 'user') {
    // User avatars are public for authenticated users
  } else if (attachment.entity_type === 'workspace') {
    // Workspace icons are public for authenticated users
  }

  // 4. Serve the file securely
  const safeFilename = path.basename(filename);
  const filePath = path.join(STORAGE_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return new Response('File not found on disk', { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileStream = fs.createReadStream(filePath);

  const isSafeImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.mime_type);

  return new Response(fileStream as any, {
    status: 200,
    headers: {
      'Content-Type': isSafeImage ? attachment.mime_type : 'application/octet-stream',
      'Content-Disposition': isSafeImage ? 'inline' : `attachment; filename="${encodeURIComponent(safeFilename)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': stat.size.toString(),
      // `private`, no `public`: esta respuesta llega después de comprobar el
      // acceso del usuario al workspace (checkWorkspaceAccess, arriba).
      // Marcarla como `public` autoriza a cachés compartidas —un CDN, un proxy
      // corporativo— a almacenar un archivo privado y servírselo a alguien que
      // no ha pasado esa comprobación.
      'Cache-Control': 'private, max-age=86400',
    }
  });
};
