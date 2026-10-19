import db from './db';

/**
 * Apuntes (páginas) vinculados a tareas.
 *
 * La regla «la página tiene que ser del mismo espacio que la tarea» estaba
 * escrita dentro de `api/issues/[issue_id]/linked-pages.ts`. El alta rápida
 * también vincula apuntes al crear, y una segunda copia de la regla es como se
 * acaba vinculando una página de otro espacio por un camino y no por el otro.
 */
export function esPaginaDelEspacio(pageId: unknown, workspaceId: string): boolean {
  if (typeof pageId !== 'string' || !pageId) return false;
  return Boolean(db.prepare('SELECT 1 FROM pages WHERE id = ? AND workspace_id = ?').get(pageId, workspaceId));
}

/** Vincular sin comprobar: quien llama ya validó con `esPaginaDelEspacio`. */
export function vincular(issueId: string, pageId: string, userId: string) {
  db.prepare('INSERT OR IGNORE INTO issue_page_links (issue_id, page_id, linked_by) VALUES (?, ?, ?)').run(issueId, pageId, userId);
}
