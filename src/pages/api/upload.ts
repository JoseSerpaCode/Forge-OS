// src/pages/api/upload.ts
import type { APIRoute } from 'astro';
import db from '../../lib/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { STORAGE_DIR } from '../../lib/storage';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user!;

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const entityType = formData.get('entity_type') as string;
  const entityId = formData.get('entity_id') as string;

  if (!file || !entityType || !entityId) return new Response('Missing data', { status: 400 });

  if (entityType !== 'issue' && entityType !== 'page' && entityType !== 'user' && entityType !== 'workspace') {
    return new Response('Invalid entity type', { status: 400 });
  }

  // Security check for issues/pages
  if (entityType === 'issue' || entityType === 'page') {
    const table = entityType === 'issue' ? 'issues' : 'pages';
    const entity = db.prepare(`SELECT workspace_id FROM ${table} WHERE id = ?`).get(entityId) as any;
    if (!entity) return new Response('Entity not found', { status: 404 });

    const { checkWorkspaceAccess } = await import('../../lib/guard');
    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, entity.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
      return new Response(access.error || 'Forbidden', { status: 403 });
    }
  }

  // Security check for users/workspaces
  if (entityType === 'user' && entityId !== user.id && user.is_sysadmin !== 1) {
    return new Response('Forbidden', { status: 403 });
  }
  if (entityType === 'workspace') {
    const { checkWorkspaceAccess } = await import('../../lib/guard');
    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, entityId, 'owner');
    if (!access.granted) return new Response('Forbidden', { status: 403 });
  }

  // [A-4 FIX] Enforce file size limit (10 MB)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return new Response(JSON.stringify({ error: 'File too large (max 10 MB)' }), { status: 413 });
  }

  // [A-4 FIX] Whitelist allowed MIME types — client-provided type, but blocked at server level
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response(JSON.stringify({ error: `File type '${file.type}' is not allowed` }), { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeFilename = path.basename(file.name).replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const fileName = `${crypto.randomUUID()}-${safeFilename}`;
  
  // SECURE STORAGE: Store outside of the public/ directory to prevent unauthorized static access
  const uploadDir = STORAGE_DIR;

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, fileName), buffer);

  // Serve through a secure API endpoint
  const fileUrl = `/api/storage/${fileName}`;

  // Track all uploads in the attachments table for reference and storage lookup
  db.prepare('INSERT INTO attachments (id, entity_type, entity_id, file_name, file_path, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(), entityType, entityId, file.name, fileUrl, file.type, file.size, user.id
  );

  return new Response(JSON.stringify({ url: fileUrl }), { status: 200 });
};
