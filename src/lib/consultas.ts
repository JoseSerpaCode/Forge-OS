import db from './db';

/**
 * Las consultas que hacían los componentes por su cuenta.
 *
 * `Hub.astro`, `Sidebar.astro` y `PageTree.astro` abrían la base directamente
 * desde el frontmatter. Un componente de interfaz que sabe SQL es un componente
 * que no se puede reutilizar en otra pantalla sin arrastrar su esquema, y que
 * no se puede probar sin una base montada.
 *
 * Aquí no hay lógica nueva: son las mismas consultas, movidas y con nombre.
 */

/** Cuántas solicitudes de amistad esperan respuesta de esta persona. */
export function solicitudesPendientes(userId: string, esInvitado: boolean): number {
  // Los invitados no tienen vida social —`canInteractSocially` lo impide en los
  // dos sentidos—, así que ni se consulta.
  if (esInvitado) return 0;

  const fila = db.prepare(`
    SELECT COUNT(*) AS n FROM friendships
    WHERE (user_a_id = ? OR user_b_id = ?)
      AND status = 'pending'
      AND action_user_id != ?
  `).get(userId, userId, userId) as { n: number };

  return fila.n;
}

/** El rol de alguien en un espacio, o `null` si no es miembro. */
export function rolEnEspacio(workspaceId: string, userId: string): string | null {
  const fila = db
    .prepare('SELECT ws_role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .get(workspaceId, userId) as { ws_role: string } | undefined;
  return fila?.ws_role ?? null;
}

/** El `sys_tag` de un espacio, si existe. Sirve para validar el último visitado. */
export function sysTagDeEspacio(sysTag: string | null | undefined): string | null {
  if (!sysTag) return null;
  const fila = db
    .prepare('SELECT sys_tag FROM workspaces WHERE sys_tag = ?')
    .get(sysTag) as { sys_tag: string } | undefined;
  return fila?.sys_tag ?? null;
}

export interface PaginaDelArbol {
  id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
}

/**
 * Las páginas de un espacio, en el orden en que se crearon.
 *
 * El árbol lo arma quien las pinta: aquí solo se traen. Ordenar por creación y
 * no por título es deliberado —el árbol de una base de conocimiento es un
 * orden que la gente construye, no un listado alfabético.
 */
export function paginasDeEspacio(workspaceId: string): PaginaDelArbol[] {
  return db
    .prepare('SELECT id, parent_page_id, title, icon FROM pages WHERE workspace_id = ? ORDER BY created_at ASC')
    .all(workspaceId) as PaginaDelArbol[];
}

export interface EspacioDelHub {
  id: string;
  name: string;
  sys_tag: string;
  icon: string | null;
  role: string;
  members: Array<{ id: string; username: string; avatar_url: string | null }>;
  totalMembers: number;
}

/**
 * Los espacios que ve alguien en su hub, con hasta cinco caras y el total.
 *
 * La rama de sysadmin lee todos los de la instancia y va **acotada a 100**: el
 * hub es una portada, no un panel de administración, y sin tope el coste de
 * abrirlo crece con el producto entero. Enumerarlos todos es trabajo de una
 * vista de administración, que no existe todavía.
 *
 * Las caras vienen en la misma consulta con `json_group_array` en vez de una
 * consulta por espacio: con doce espacios eso serían trece viajes a la base
 * para pintar una portada.
 */
export function espaciosDelHub(userId: string, esSysadmin: boolean): EspacioDelHub[] {
  const caras = (alias: string) => `
      (SELECT json_group_array(json_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url))
       FROM (SELECT u2.id, u2.username, u2.avatar_url FROM workspace_members ${alias} JOIN users u2 ON ${alias}.user_id = u2.id WHERE ${alias}.workspace_id = w.id LIMIT 5) u) as members_json,
      (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as totalMembers`;

  const filas = (esSysadmin
    ? db.prepare(`
        SELECT w.id, w.name, w.sys_tag, w.icon, 'sysadmin' as role, ${caras('wm')}
        FROM workspaces w
        WHERE w.sys_tag NOT LIKE 'guest-%'
        ORDER BY w.created_at DESC LIMIT 100
      `).all()
    : db.prepare(`
        SELECT w.id, w.name, w.sys_tag, w.icon, wm.ws_role as role, ${caras('wm2')}
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = ?
      `).all(userId)) as any[];

  for (const f of filas) {
    f.members = JSON.parse(f.members_json || '[]');
    delete f.members_json;
  }
  return filas as EspacioDelHub[];
}

export interface TareaPendiente {
  id: string;
  title: string;
  status: string;
  sprint_id: string | null;
  type: string;
  due_date: string | null;
  priority: string | null;
  sys_tag: string;
  workspace_id: string;
  workspace_icon: string | null;
  workspace_name: string;
}

/**
 * Lo que alguien tiene pendiente, en todos sus espacios.
 *
 * Ordenadas por **urgencia**, no por lo último tocado: lo que vence antes va
 * primero y lo que no tiene fecha va al final. Ordenar por `updated_at` subía
 * justo lo que se acababa de mirar, que es lo que menos falta hace ver.
 *
 * `due_date IS NULL ASC` a mano porque SQLite pone los nulos primero, y una
 * lista de pendientes que empieza por lo que no tiene fecha entierra lo urgente.
 */
export function tareasPendientes(userId: string): TareaPendiente[] {
  return db.prepare(`
    SELECT i.id, i.title, i.status, i.sprint_id, i.type, i.due_date, i.priority,
           w.sys_tag, w.id AS workspace_id, w.icon AS workspace_icon, w.name AS workspace_name
    FROM issues i
    JOIN workspaces w ON i.workspace_id = w.id
    WHERE i.assignee_id = ? AND i.status != 'done'
    ORDER BY
      i.due_date IS NULL ASC,
      i.due_date ASC,
      CASE i.priority WHEN 'highest' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 WHEN 'lowest' THEN 4 ELSE 2 END ASC,
      i.updated_at DESC
  `).all(userId) as TareaPendiente[];
}
