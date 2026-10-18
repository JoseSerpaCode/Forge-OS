import type { APIRoute } from 'astro';
import db from '../../../lib/db';
import { checkWorkspaceAccess } from '../../../lib/guard';
import { validateNoteDoc, serializeNote, isStoredNote } from '../../../lib/notes/content';

// Helper to resolve workspace and check permissions
function authorize(user: any, requiredRole: 'owner' | 'editor' | 'viewer', pageId: string) {

  // [A-3 FIX] Look up the page first to get its actual workspace_id from DB
  // Never rely on user.last_workspace_id which can be stale with multiple tabs
  const page = db.prepare('SELECT id, workspace_id FROM pages WHERE id = ?').get(pageId) as any;
  if (!page) return { error: new Response('Not Found', { status: 404 }) };

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, page.workspace_id, requiredRole);
  if (!access.granted) {
    return { error: new Response('Not Found', { status: 404 }) }; // Use 404 to avoid leaking existence
  }

  return { workspaceId: page.workspace_id, page };
}

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) return new Response('Bad Request', { status: 400 });
  
  const auth = authorize(locals.user, 'viewer', id);
  if (auth.error) return auth.error;

  const page = db.prepare('SELECT * FROM pages WHERE id = ? AND workspace_id = ?').get(id, auth.workspaceId);
  return new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  if (!id) return new Response('Bad Request', { status: 400 });

  const auth = authorize(locals.user, 'editor', id);
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    
    let finalContentJson = undefined;
    let droppedBlocks: string[] = [];
    
    if (data.content_json !== undefined) {
      let parsed;
      try {
        parsed = typeof data.content_json === 'string' ? JSON.parse(data.content_json) : data.content_json;
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400 });
      }

      // Solo se escribe el formato de Tiptap. Las notas de Editor.js se
      // convierten al leerlas (`lib/notes/content.ts`), así que un cliente
      // que mande `{blocks: […]}` es un cliente viejo en caché: aceptarlo
      // volvería a meter el formato que se está migrando.
      if (!isStoredNote(parsed)) {
        return new Response(JSON.stringify({ error: 'Invalid JSON payload format' }), { status: 400 });
      }

      // Se valida con el mismo esquema con el que escribe el editor. Lo que
      // el editor produce pasa siempre; lo que no, es un documento manipulado.
      const valid = validateNoteDoc(parsed.doc);
      if (!valid.ok) {
        return new Response(JSON.stringify({ error: 'El contenido fue rechazado porque no es un documento válido', code: valid.error }), { status: 400 });
      }

      finalContentJson = serializeNote(valid.doc);

      // Lo que se ha descartado viaja en la respuesta.
      //
      // Antes se descartaba en silencio y se contestaba `{success:true}`: las
      // tablas desaparecían del documento mientras el editor mostraba «Saved».
      // Un guardado que pierde contenido no es un guardado correcto, y quien
      // escribe tiene derecho a enterarse en ese momento y no al recargar.
      droppedBlocks = valid.dropped;
    }

    // Explicit IDOR mitigation: AND workspace_id = ?
    if (data.title !== undefined || finalContentJson !== undefined) {
      db.prepare(`
        UPDATE pages 
        SET title = COALESCE(?, title), 
            content_json = COALESCE(?, content_json), 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND workspace_id = ?
      `).run(
        data.title !== undefined ? data.title : null, 
        finalContentJson !== undefined ? finalContentJson : null, 
        id, 
        auth.workspaceId
      );
    }
    return new Response(
      JSON.stringify(droppedBlocks.length ? { success: true, dropped: droppedBlocks } : { success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[pages/[id] PUT] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) return new Response('Bad Request', { status: 400 });

  // [B-2 FIX] Editors can delete pages; previously required 'owner' which was overly restrictive
  const auth = authorize(locals.user, 'editor', id);
  if (auth.error) return auth.error;

  // Explicit IDOR mitigation: AND workspace_id = ?
  db.prepare('DELETE FROM pages WHERE id = ? AND workspace_id = ?').run(id, auth.workspaceId);
  
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
