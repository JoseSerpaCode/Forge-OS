import type { APIRoute } from 'astro';
import db from '../../../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../../../lib/guard';
import crypto from 'crypto';
import { esDelEspacio } from '../../../../../../lib/driveFiles';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const { sys_tag, id } = params;
  const user = locals.user!;

  // 1. Resolve Workspace and DB
  const database = db.prepare('SELECT id, workspace_id, schema_json FROM dynamic_databases WHERE id = ?').get(id) as any;
  if (!database) return new Response('Database not found', { status: 404 });

  // 2. Auth checks
  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, database.workspace_id, 'viewer');
  if (!access.granted) {
    if (access.reason === 'not_member') return new Response('Database not found', { status: 404 });
    return new Response(access.error || 'Forbidden', { status: 403 });
  }

  // Double check workspace sys_tag matches the URL (anti-IDOR sanity check)
  const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(database.workspace_id) as any;
  if (ws.sys_tag !== sys_tag) return new Response('Workspace mismatch', { status: 400 });

  // 3. Fetch entries
  // In Phase 1, we just return all entries (or a large LIMIT). 
  // Future: query params for sorting/filtering using the dynamic indexes.
  const entries = db.prepare(`
    SELECT id, payload_json, created_by, created_at, updated_at
    FROM dynamic_entries
    WHERE database_id = ?
    ORDER BY created_at DESC
    LIMIT 1000
  `).all(id);

  return new Response(JSON.stringify(entries), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// Helper to escape HTML tags to prevent XSS (Same lesson as Editor.js)

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { sys_tag, id } = params;
  const user = locals.user!;

  const database = db.prepare('SELECT id, workspace_id, schema_json FROM dynamic_databases WHERE id = ?').get(id) as any;
  if (!database) return new Response('Database not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, database.workspace_id, 'editor');
  if (!access.granted) {
    if (access.reason === 'not_member') return new Response('Database not found', { status: 404 });
    return new Response(access.error || 'Forbidden', { status: 403 });
  }

  try {
    const body = await request.json(); // incoming payload
    const schema = JSON.parse(database.schema_json);
    const validPayload: Record<string, any> = {};

    // SERVER-SIDE VALIDATION
    for (const col of schema.columns) {
      const val = body[col.id];
      if (val === undefined || val === null || val === '') {
        validPayload[col.id] = null; // Normalize empty values
        continue;
      }

      if (col.type === 'number') {
        const num = parseFloat(val);
        if (isNaN(num)) return new Response(`Validation Error: Column ${col.name} expects a number`, { status: 400 });
        validPayload[col.id] = num;
      } 
      else if (col.type === 'select') {
        const strVal = String(val).trim();
        if (col.options && !col.options.includes(strVal)) {
          return new Response(`Validation Error: Column ${col.name} value must be one of [${col.options.join(', ')}]`, { status: 400 });
        }
        /**
         * Se guarda tal cual. El escapado va **al pintar**.
         *
         * Aquí se escapaba antes de meterlo en la base, contra la regla que el
         * propio proyecto documenta en `lib/sanitizer.ts`. No aportaba
         * seguridad —la tabla se pinta con `{val}` en Astro, que escapa solo— y
         * sí acumulaba: un `<` se guardaba como `&lt;`, y al reeditar la fila
         * como `&amp;lt;`. Quien escribía un signo de menor lo veía convertido
         * en `&lt;` y no había forma de escribirlo de verdad.
         */
        validPayload[col.id] = strVal;
      } 
      else if (col.type === 'file') {
        // Lo que se guarda es el id de un archivo de **este** espacio. Sin
        // comprobarlo, una fila podría apuntar a un archivo de otro equipo y
        // la tabla enseñaría su nombre a quien no debería verlo.
        const fileId = String(val).trim();
        if (!esDelEspacio(fileId, database.workspace_id)) {
          return new Response(`Validation Error: Column ${col.name} expects a file from this workspace`, { status: 400 });
        }
        validPayload[col.id] = fileId;
      }
      else {
        // Texto libre, guardado tal cual. El escapado va al pintar; ver la nota
        // de arriba sobre por qué escapar aquí acumulaba `&amp;lt;`.
        validPayload[col.id] = String(val);
      }
    }

    const entryId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO dynamic_entries (id, database_id, payload_json, created_by)
      VALUES (?, ?, ?, ?)
    `).run(entryId, database.id, JSON.stringify(validPayload), user.id);

    return new Response(JSON.stringify({ id: entryId, payload: validPayload }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};
