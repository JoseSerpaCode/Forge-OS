import type { APIRoute } from 'astro';
import { orm } from '../../../../../lib/db/drizzle';
import { dynamicDatabases, dynamicViews } from '../../../../../lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { checkWorkspaceAccess } from '../../../../../lib/guard';
import crypto from 'node:crypto';
import { esIcono } from '../../../../../lib/icons';

import db from '../../../../../lib/db';

/** Un fallo de validación que ocurre dentro del `map`, para que salga 400 y no 500. */
class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const GET: APIRoute = async (context) => {
  const { sys_tag } = context.params;
  const user = context.locals.user!;

  const workspace = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sys_tag) as any;
  if (!workspace) return new Response('Workspace not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspace.id, 'viewer');
  if (!access.granted) {
    if (access.reason === 'not_member') return new Response('Workspace not found', { status: 404 });
    return new Response(access.error || 'Forbidden', { status: 403 });
  }

  const databases = orm.select().from(dynamicDatabases)
    .where(eq(dynamicDatabases.workspaceId, workspace.id))
    .orderBy(desc(dynamicDatabases.createdAt))
    .all();

  return new Response(JSON.stringify(databases), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async (context) => {
  const { sys_tag } = context.params;
  const user = context.locals.user!;

  const workspace = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sys_tag) as any;
  if (!workspace) return new Response('Workspace not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspace.id, 'editor');
  if (!access.granted) {
    if (access.reason === 'not_member') return new Response('Workspace not found', { status: 404 });
    return new Response(access.error || 'Forbidden', { status: 403 });
  }

  try {
    const body = await context.request.json();
    let { name, description, icon, columns } = body;

    if (!name) return new Response('Name is required', { status: 400 });

    // Topes de tamaño. El formulario ya no deja llegar aquí nada de esto, pero
    // la API es pública para cualquiera con sesión y un esquema con diez mil
    // columnas se guarda igual de bien y luego no hay pantalla que lo pinte.
    if (!Array.isArray(columns) || columns.length === 0) {
      return new Response('At least one column is required', { status: 400 });
    }
    if (columns.length > 50) return new Response('Too many columns', { status: 400 });

    // Validate and generate safe IDs for columns
    const safeColumns = columns.map((col: any) => {
      // The server ALWAYS generates the col_id. The client cannot force it.
      const colId = `col_${crypto.randomUUID().split('-')[0]}`;
      const nombre = typeof col?.name === 'string' ? col.name.trim() : '';
      if (!nombre) throw new HttpError('Every column needs a name', 400);
      return {
        id: colId,
        name: nombre.slice(0, 120),
        // `file` apunta a un archivo de la sección de Archivos. No duplica un
        // sistema de archivos dentro de las bases de datos: los archivos viven
        // en un solo sitio y la tabla los referencia.
        type: ['text', 'number', 'select', 'file'].includes(col.type) ? col.type : 'text',
        options: col.type === 'select' && Array.isArray(col.options)
          ? col.options.filter((o: any) => typeof o === 'string' && o.trim()).slice(0, 50).map((o: string) => o.trim().slice(0, 120))
          : undefined
      };
    });

    const schemaJson = JSON.stringify({ columns: safeColumns });
    const dbId = crypto.randomUUID();

    orm.insert(dynamicDatabases).values({
      id: dbId,
      workspaceId: workspace.id,
      name,
      sysTag: sys_tag as string,
      description: description || null,
      // Solo nombres de la tabla de iconos. Lo que se guarda aquí se acaba
      // usando para pintar, así que un valor cualquiera no entra; si no se
      // reconoce, se queda sin icono y la pantalla pone el de por defecto.
      icon: esIcono(icon) ? icon : null,
      schemaJson
    }).run();

    orm.insert(dynamicViews).values({
      id: crypto.randomUUID(),
      databaseId: dbId,
      name: 'Default Table',
      type: 'table',
      visibleColumnsJson: JSON.stringify(safeColumns.map((c: any) => c.id))
    }).run();

    return new Response(JSON.stringify({ id: dbId }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    if (err instanceof HttpError) return new Response(err.message, { status: err.status });
    return new Response(err.message, { status: 500 });
  }
};
