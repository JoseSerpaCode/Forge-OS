import type { APIRoute } from 'astro';
import db from '../../../lib/db';

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user!;

  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  
  if (!q || q.length < 1) {
    return new Response(JSON.stringify([]), { status: 200 });
  }

  try {
    let filter = 'all';
    let searchQuery = q;

    if (q.startsWith('/w ')) { filter = 'workspace'; searchQuery = q.slice(3); }
    else if (q.startsWith('/i ')) { filter = 'issue'; searchQuery = q.slice(3); }
    else if (q.startsWith('/p ')) { filter = 'page'; searchQuery = q.slice(3); }
    else if (q.startsWith('/u ')) { filter = 'user'; searchQuery = q.slice(3); }
    else if (q.startsWith('/')) {
      if (q === '/' || ['/w', '/i', '/p', '/u'].some(prefix => prefix.startsWith(q))) {
         return new Response(JSON.stringify([
           { title: 'Search Workspaces...', type: 'hint', insert: '/w ' },
           { title: 'Search Issues...', type: 'hint', insert: '/i ' },
           { title: 'Search Pages...', type: 'hint', insert: '/p ' },
           { title: 'Search Users...', type: 'hint', insert: '/u ' }
         ]), { status: 200 });
      } else {
         // Just a slash or invalid command, let's just strip it and search normally
         searchQuery = q.replace(/^\//, '');
      }
    }

    const query = `%${searchQuery}%`;
    let results: any[] = [];

    // Search Workspaces
    if (filter === 'all' || filter === 'workspace') {
      if (user.is_sysadmin === 1) {
        const wss = db.prepare(`SELECT w.name as title, 'workspace' as type, '/w/' || w.sys_tag as url FROM workspaces w WHERE w.name LIKE ? OR w.sys_tag LIKE ? LIMIT 5`).all(query, query);
        results = results.concat(wss);
      } else {
        const wss = db.prepare(`
          SELECT w.name as title, 'workspace' as type, '/w/' || w.sys_tag as url 
          FROM workspaces w 
          JOIN workspace_members wm ON w.id = wm.workspace_id 
          WHERE wm.user_id = ? AND (w.name LIKE ? OR w.sys_tag LIKE ?) LIMIT 5
        `).all(user.id, query, query);
        results = results.concat(wss);
      }
    }

    // Search Users
    if (filter === 'all' || filter === 'user') {
      // Los invitados no salen entre las sugerencias, pero sí aparecen si se
      // escribe su nombre entero.
      //
      // Son cuentas anónimas y desechables que se crean con un clic: dejarlas
      // en el autocompletado llenaría la búsqueda de `Guest_a3f9c210_447` y
      // convertiría el listado de usuarios en el registro de visitas de la web.
      // Esconderlas del todo, en cambio, rompería un enlace legítimo — dos
      // invitados que comparten un espacio de trabajo se ven entre ellos y
      // tienen que poder llegar al perfil del otro.
      //
      // La coincidencia exacta es la línea entre las dos cosas: se les
      // encuentra sabiendo el nombre, no explorando.
      const users = db.prepare(`
        SELECT username as title, 'user' as type, '/u/' || username as url
        FROM users
        WHERE id != 'system'
          AND (is_public = 1 OR id = ?)
          AND (
            (is_guest = 0 AND username LIKE ?)
            OR username = ?
          )
        LIMIT 5
      `).all(user.id, query, searchQuery);
      results = results.concat(users);
    }

    // Search Pages & Issues
    if (filter === 'all' || filter === 'page' || filter === 'issue') {
      if (user.is_sysadmin === 1) {
        if (filter === 'all' || filter === 'page') {
          const pages = db.prepare(`SELECT p.title, 'page' as type, '/w/' || w.sys_tag || '/p?page=' || p.id as url FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.title LIKE ? LIMIT 5`).all(query);
          results = results.concat(pages);
        }
        if (filter === 'all' || filter === 'issue') {
          const issues = db.prepare(`SELECT i.title, 'issue' as type, '/w/' || w.sys_tag || '/board?issue=' || i.id as url FROM issues i JOIN workspaces w ON i.workspace_id = w.id WHERE i.title LIKE ? LIMIT 5`).all(query);
          results = results.concat(issues);
        }
      } else {
        const userWorkspaces = db.prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ?').all(user.id).map((row: any) => row.workspace_id);
        
        if (userWorkspaces.length > 0) {
          const placeholders = userWorkspaces.map(() => '?').join(',');
          
          if (filter === 'all' || filter === 'page') {
            const pages = db.prepare(`SELECT p.title, 'page' as type, '/w/' || w.sys_tag || '/p?page=' || p.id as url FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.title LIKE ? AND p.workspace_id IN (${placeholders}) LIMIT 5`).all(query, ...userWorkspaces);
            results = results.concat(pages);
          }
          if (filter === 'all' || filter === 'issue') {
            const issues = db.prepare(`SELECT i.title, 'issue' as type, '/w/' || w.sys_tag || '/board?issue=' || i.id as url FROM issues i JOIN workspaces w ON i.workspace_id = w.id WHERE i.title LIKE ? AND i.workspace_id IN (${placeholders}) LIMIT 5`).all(query, ...userWorkspaces);
            results = results.concat(issues);
          }
        }
      }
    }

    return new Response(JSON.stringify(results), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
