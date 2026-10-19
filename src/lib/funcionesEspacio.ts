import db from './db';
import { finalizeIssueSessions } from './sesionesTiempo';

/**
 * Qué partes del tablero tiene encendidas un espacio.
 *
 * Forge nació para equipos que planifican por sprints, estiman en puntos y
 * cronometran cada tarea. Usado a solas —para la universidad, por ejemplo— las
 * tres cosas estorban: un selector de sprint que siempre hay que tocar, un
 * botón de «Iniciar» en cada tarjeta y un campo de puntos que nadie rellena.
 *
 * Se apagan por espacio y no se quitan del código: quien sí trabaja así no
 * pierde nada, y apagar no borra datos —`sprint_id`, los registros de horas y
 * los puntos se quedan en la base, solo se dejan de mirar—. Encender otra vez
 * los devuelve tal cual.
 *
 * **Es la única fuente.** Ninguna página ni endpoint mira `feat_*` por su
 * cuenta: si cada uno escribiera su `if (ws.feat_time)`, la próxima función
 * que se añada quedaría encendida en un sitio y apagada en otro.
 */

export type Funcion = 'sprints' | 'tiempo' | 'puntos';
export type Funciones = Record<Funcion, boolean>;

const COLUMNA: Record<Funcion, string> = {
  sprints: 'feat_sprints',
  tiempo: 'feat_time',
  puntos: 'feat_points',
};

export const NINGUNA: Funciones = { sprints: false, tiempo: false, puntos: false };

export function funciones(workspaceId: string): Funciones {
  const fila = db.prepare(
    'SELECT feat_sprints, feat_time, feat_points FROM workspaces WHERE id = ?'
  ).get(workspaceId) as { feat_sprints: number; feat_time: number; feat_points: number } | undefined;
  if (!fila) return { ...NINGUNA };
  return {
    sprints: fila.feat_sprints === 1,
    tiempo: fila.feat_time === 1,
    puntos: fila.feat_points === 1,
  };
}

/** Las de un espacio a partir de una de sus tareas. `null` si la tarea no existe. */
export function funcionesDeTarea(issueId: string): { workspaceId: string; funciones: Funciones } | null {
  const fila = db.prepare('SELECT workspace_id FROM issues WHERE id = ?').get(issueId) as { workspace_id: string } | undefined;
  if (!fila) return null;
  return { workspaceId: fila.workspace_id, funciones: funciones(fila.workspace_id) };
}

/**
 * Cambiar lo encendido. Solo toca las claves que vengan.
 *
 * Apagar el tiempo con un cronómetro en marcha lo **para y lo registra**: si
 * no, la sesión quedaría abierta sin ningún botón para pararla, contando horas
 * hasta que alguien volviera a encender la función.
 */
export function cambiarFunciones(workspaceId: string, cambios: Partial<Funciones>): Funciones {
  const antes = funciones(workspaceId);
  db.transaction(() => {
    for (const [nombre, valor] of Object.entries(cambios) as Array<[Funcion, unknown]>) {
      if (!(nombre in COLUMNA) || typeof valor !== 'boolean') continue;
      db.prepare(`UPDATE workspaces SET ${COLUMNA[nombre]} = ? WHERE id = ?`).run(valor ? 1 : 0, workspaceId);
    }
    if (antes.tiempo && cambios.tiempo === false) {
      const abiertas = db.prepare(`
        SELECT DISTINCT t.issue_id FROM time_tracking_sessions t
        JOIN issues i ON i.id = t.issue_id
        WHERE i.workspace_id = ?
      `).all(workspaceId) as Array<{ issue_id: string }>;
      for (const { issue_id } of abiertas) finalizeIssueSessions(issue_id, 'Auto-registrado al apagar el tiempo');
    }
  })();
  return funciones(workspaceId);
}

/**
 * La respuesta de un endpoint cuya función está apagada.
 *
 * 403 y no 404: el recurso existe, lo que no está es la función. Y con un
 * `error_code` para que la interfaz pueda decirlo en vez de «algo falló».
 */
export function funcionApagada(funcion: Funcion): Response {
  return new Response(JSON.stringify({ error_code: 'feature_disabled', feature: funcion }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
