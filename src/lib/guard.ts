import db from './db';

/**
 * Los tres roles, con nombre.
 *
 * Estaba escrito a mano en cada firma que lo necesitaba, y con el orden
 * cambiado según el fichero: `'viewer' | 'editor'` en cinco sitios,
 * `'owner' | 'editor' | 'viewer'` en otros. Nombrarlo evita que la próxima
 * copia se deje uno fuera sin que nada avise.
 */
export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export function checkWorkspaceAccess(userId: string, isSysadmin: number, workspaceId: string, requiredRole?: WorkspaceRole) {
  if (isSysadmin === 1) return { granted: true, role: 'owner' };
  
  const membership = db.prepare('SELECT ws_role FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId) as any;
  
  if (!membership) return { granted: false, reason: 'not_member', error: 'Acceso Denegado. Workspace no encontrado o no eres miembro.' };
  
  if (requiredRole) {
    const hierarchy = { 'owner': 3, 'editor': 2, 'viewer': 1 };
    if (hierarchy[membership.ws_role as keyof typeof hierarchy] < hierarchy[requiredRole]) {
      return { granted: false, reason: 'insufficient_role', error: 'Permisos insuficientes en este Workspace.' };
    }
  }
  
  return { granted: true, role: membership.ws_role };
}
