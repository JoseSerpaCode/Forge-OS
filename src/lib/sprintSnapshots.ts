import db from './db';
import crypto from 'crypto';

/**
 * Fotos diarias de un sprint, para el burndown.
 *
 * El burndown se dibujaba recalculando desde los datos actuales en cada carga
 * de Métricas. Además de costar, tiene un problema de fondo: **la historia
 * cambia**. Si a un ticket le suben los puntos, o se mueve de sprint, o se
 * borra, la curva de la semana pasada se redibuja distinta hoy. Una gráfica de
 * progreso que cambia hacia atrás no sirve para mirar atrás.
 *
 * Una foto por día congela lo que de verdad había ese día. La de hoy se
 * refresca —el día aún no ha terminado—; las de días anteriores no se tocan.
 */

export type Foto = {
  sprintId: string;
  takenOn: string;
  pointsTotal: number;
  pointsDone: number;
  issuesTotal: number;
  issuesDone: number;
};

/** Fecha en formato YYYY-MM-DD, en UTC, que es como guarda SQLite. */
function hoyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calcula el estado de un sprint **ahora mismo**, sin guardarlo.
 *
 * `story_points` puede ser nulo; un ticket sin estimar cuenta como 0 puntos
 * pero **sí** cuenta como ticket. Mezclar las dos cosas es lo que hace que un
 * burndown por puntos y otro por tickets cuenten historias distintas.
 */
export function medirSprint(sprintId: string): Omit<Foto, 'sprintId' | 'takenOn'> {
  const r = db.prepare(`
    SELECT
      COALESCE(SUM(COALESCE(story_points, 0)), 0) AS pointsTotal,
      COALESCE(SUM(CASE WHEN status = 'done' THEN COALESCE(story_points, 0) ELSE 0 END), 0) AS pointsDone,
      COUNT(*) AS issuesTotal,
      COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS issuesDone
    FROM issues WHERE sprint_id = ?
  `).get(sprintId) as any;

  return {
    pointsTotal: r?.pointsTotal ?? 0,
    pointsDone: r?.pointsDone ?? 0,
    issuesTotal: r?.issuesTotal ?? 0,
    issuesDone: r?.issuesDone ?? 0,
  };
}

/**
 * Guarda (o refresca) la foto de hoy de un sprint.
 *
 * El índice único `(sprint_id, taken_on)` hace que repetir la llamada el mismo
 * día actualice en vez de duplicar: puede ejecutarse tantas veces como haga
 * falta sin ensuciar la serie.
 */
export function tomarFoto(sprintId: string, fecha = hoyUTC()): Foto {
  const m = medirSprint(sprintId);
  db.prepare(`
    INSERT INTO sprint_snapshots (id, sprint_id, taken_on, points_total, points_done, issues_total, issues_done)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sprint_id, taken_on) DO UPDATE SET
      points_total = excluded.points_total,
      points_done  = excluded.points_done,
      issues_total = excluded.issues_total,
      issues_done  = excluded.issues_done
  `).run(crypto.randomUUID(), sprintId, fecha, m.pointsTotal, m.pointsDone, m.issuesTotal, m.issuesDone);

  return { sprintId, takenOn: fecha, ...m };
}

/** La serie guardada de un sprint, de la más antigua a la más reciente. */
export function serie(sprintId: string): Foto[] {
  return (db.prepare(`
    SELECT sprint_id AS sprintId, taken_on AS takenOn,
           points_total AS pointsTotal, points_done AS pointsDone,
           issues_total AS issuesTotal, issues_done AS issuesDone
    FROM sprint_snapshots WHERE sprint_id = ? ORDER BY taken_on ASC
  `).all(sprintId) as Foto[]);
}

/**
 * Toma la foto de hoy de todos los sprints activos.
 *
 * Pensado para llamarse una vez al día. Se hace en una transacción: o quedan
 * todas las fotos del día o ninguna, porque una serie a la que le falta un
 * sprint suelto es peor que una serie que no se tomó.
 */
export function fotografiarSprintsActivos(fecha = hoyUTC()): number {
  const activos = db.prepare("SELECT id FROM sprints WHERE status = 'active'").all() as Array<{ id: string }>;
  const tx = db.transaction(() => {
    for (const s of activos) tomarFoto(s.id, fecha);
  });
  tx();
  return activos.length;
}
