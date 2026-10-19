import { getTestDb } from '../test-utils';

/**
 * Encender sprints, tiempo y puntos en un espacio de pruebas.
 *
 * Los espacios nuevos nacen con las tres funciones apagadas (migración 40).
 * Una prueba de sprints o de cronómetro sobre un espacio recién creado tiene
 * que encender la suya: si no, el endpoint responde 403 `feature_disabled` y la
 * prueba falla por algo que no es lo que prueba.
 */
export function encenderFunciones(
  sysTag: string,
  f: { sprints?: boolean; tiempo?: boolean; puntos?: boolean } = { sprints: true, tiempo: true, puntos: true }
) {
  const db = getTestDb();
  try {
    db.prepare('UPDATE workspaces SET feat_sprints = ?, feat_time = ?, feat_points = ? WHERE sys_tag = ?')
      .run(f.sprints ? 1 : 0, f.tiempo ? 1 : 0, f.puntos ? 1 : 0, sysTag);
  } finally {
    db.close();
  }
}
