import db from './db';
import { NotificationService } from './NotificationService';
import { instanteDePared } from './calendario';
import { esZona } from './fechas';
import { enviarPush } from './push';

/**
 * Recordatorios antes de una entrega.
 *
 * Un planificador (`iniciarRecordatorios`, cada minuto) busca las tareas cuyo
 * aviso ya toca y crea una notificación de las de siempre para quien tiene que
 * hacerla: la persona responsable o, sin responsable, quien la creó.
 *
 * Cinco reglas:
 * - Solo a quien sigue siendo miembro del espacio: el aviso lleva el título.
 * - La entrega se interpreta en la zona de **quien recibe el aviso**
 *   (`users.timezone`): «viernes 18:00» son las 18:00 de esa persona.
 * - Sin hora, la referencia son las 09:00 de ese día: avisar «un día antes» de
 *   una entrega sin hora a medianoche no le sirve a nadie.
 * - `reminded_at` se marca en la misma transacción que la notificación: un
 *   reinicio no repite avisos.
 * - Tras una caída larga solo se mandan los que vencieron hace menos de una
 *   hora; los demás se marcan sin mandar, para no despertar a nadie con una
 *   avalancha de avisos viejos.
 */

export const ANTELACIONES = [0, 60, 1440, 2880, 10080] as const;
export const esAntelacion = (v: unknown) =>
  v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 20160);

const TARDE_MAX_MS = 60 * 60 * 1000;

interface Candidata {
  id: string; title: string; due_date: string; due_time: string | null; reminder_minutes: number;
  destinatario: string; timezone: string | null; sys_tag: string;
}

export function procesarRecordatorios(ahora: Date = new Date()): { enviados: number; descartados: number } {
  const candidatas = db.prepare(`
    SELECT i.id, i.title, i.due_date, i.due_time, i.reminder_minutes,
           COALESCE(i.assignee_id, i.reporter_id) AS destinatario, u.timezone, w.sys_tag
    FROM issues i
    JOIN users u ON u.id = COALESCE(i.assignee_id, i.reporter_id)
    JOIN workspaces w ON w.id = i.workspace_id
    -- Solo a quien **sigue** en el espacio: el aviso lleva el título de la
    -- tarea, y alguien a quien sacaron no tiene por qué verlo.
    JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = COALESCE(i.assignee_id, i.reporter_id)
    WHERE i.reminder_minutes IS NOT NULL AND i.reminded_at IS NULL
      AND i.status != 'done' AND i.due_date IS NOT NULL AND i.parent_issue_id IS NULL
  `).all() as Candidata[];

  let enviados = 0;
  let descartados = 0;
  // Los Web Push salen **después** de las transacciones: es una petición de
  // red, y una transacción de SQLite no puede quedarse abierta esperándola.
  const pushes: Array<{ userId: string; aviso: { title: string; body: string; url: string } }> = [];
  const marcar = db.prepare('UPDATE issues SET reminded_at = CURRENT_TIMESTAMP WHERE id = ? AND reminded_at IS NULL');
  for (const c of candidatas) {
    const zona = esZona(c.timezone) ? c.timezone! : 'UTC';
    const entrega = instanteDePared(String(c.due_date).slice(0, 10), c.due_time ?? '09:00', zona);
    const toca = entrega.getTime() - c.reminder_minutes * 60_000;
    if (ahora.getTime() < toca) continue;
    const tarde = ahora.getTime() - toca > TARDE_MAX_MS;
    db.transaction(() => {
      if (marcar.run(c.id).changes === 0) return;
      if (tarde) { descartados++; return; }
      const hora = c.due_time ? ` · ${c.due_time}` : '';
      const cuerpo = `${c.title} · entrega ${String(c.due_date).slice(0, 10)}${hora}`;
      const url = `/w/${c.sys_tag}/board?issue=${c.id}`;
      // El silencio de notificaciones vale también para el aviso fuera de la app.
      if (NotificationService.notify(c.destinatario, 'info', 'Recordatorio', cuerpo, url)) {
        pushes.push({ userId: c.destinatario, aviso: { title: 'Recordatorio', body: cuerpo, url } });
      }
      enviados++;
    })();
  }
  for (const p of pushes) enviarPush(p.userId, p.aviso).catch((err) => console.error('[recordatorios] push:', err));
  return { enviados, descartados };
}

/**
 * Arranca el planificador una sola vez por proceso. `unref()` para que no
 * impida que el proceso termine (en pruebas, por ejemplo).
 */
export function iniciarRecordatorios() {
  const g = globalThis as any;
  if (g.__forgeRecordatorios || process.env.NODE_ENV === 'test') return;
  g.__forgeRecordatorios = setInterval(() => {
    try { procesarRecordatorios(); } catch (err) { console.error('[recordatorios]', err); }
  }, 60_000);
  g.__forgeRecordatorios.unref?.();
}
