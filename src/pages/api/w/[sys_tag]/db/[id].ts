import type { APIRoute } from 'astro';
import { orm } from '../../../../../lib/db/drizzle';
import { dynamicDatabases, dynamicViews } from '../../../../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkWorkspaceAccess } from '../../../../../lib/guard';

import db from '../../../../../lib/db';

export const GET: APIRoute = async (context) => {
  const { sys_tag, id } = context.params;
  const user = context.locals.user!;

  const workspace = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sys_tag) as any;
  if (!workspace) return new Response('Workspace not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspace.id, 'viewer');
  if (!access.granted) {
    if (access.reason === 'not_member') return new Response('Workspace not found', { status: 404 });
    return new Response(access.error || 'Forbidden', { status: 403 });
  }

  const dbId = id;

  const database = orm.select().from(dynamicDatabases).where(eq(dynamicDatabases.id, dbId as string)).get();
  if (!database) return new Response('Database not found', { status: 404 });

  if (database.workspaceId !== workspace.id) {
    return new Response('Database not found in this workspace', { status: 404 });
  }

  const views = orm.select().from(dynamicViews).where(eq(dynamicViews.databaseId, dbId as string)).all();

  return new Response(JSON.stringify({ 
    database, 
    views 
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// Borrar la tabla con sus filas.
export const DELETE: APIRoute = async (context) => {
  const { sys_tag, id } = context.params;
  const user = context.locals.user!;

  const workspace = db.prepare('SELECT id FROM workspaces WHERE sys_tag = ?').get(sys_tag) as any;
  if (!workspace) return new Response('Workspace not found', { status: 404 });

  const access = checkWorkspaceAccess(user.id, user.is_sysadmin, workspace.id, 'editor');
  if (!access.granted) {
    if (access.reason === 'not_member') return new Response('Workspace not found', { status: 404 });
    return new Response(access.error || 'Forbidden', { status: 403 });
  }

  const dbId = id;

  const database = orm.select().from(dynamicDatabases).where(eq(dynamicDatabases.id, dbId as string)).get();
  // De este espacio: ser editor de uno no deja borrar las tablas de otro
  // sabiendo su id. El GET de arriba ya lo comprobaba; el borrado, no.
  if (!database || database.workspaceId !== workspace.id) return new Response('Database not found', { status: 404 });

  // SQLite ON DELETE CASCADE handles dynamic_entries and dynamic_views
  orm.delete(dynamicDatabases).where(eq(dynamicDatabases.id, dbId as string)).run();

  return new Response('OK', { status: 200 });
};
