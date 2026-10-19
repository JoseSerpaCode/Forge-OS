import db from './db';
import crypto from 'crypto';

/**
 * Cerrar sesiones de cronómetro y convertirlas en registros de trabajo.
 *
 * Vivían dentro de `pages/api/issues/[id]/timer.ts` y las importaban
 * `IssueService` y `move.ts` desde allí. Apagar la función de tiempo de un
 * espacio también necesita cerrarlas, y `timer.ts` a su vez necesita saber si
 * la función está encendida: con las dos cosas en ficheros que se importan
 * mutuamente, el orden de carga decidía cuál llegaba vacía. Aquí no dependen
 * de nadie.
 */

// Shared utility for closing an active session for a specific user
export function finalizeActiveSession(userId: string) {
  const active = db.prepare('SELECT id, issue_id, started_at, user_id FROM time_tracking_sessions WHERE user_id = ?').get(userId) as any;
  if (!active) return null;
  return processSession(active);
}

// Shared utility for closing all active sessions for a specific issue (e.g. when moved to Done)
export function finalizeIssueSessions(issueId: string, message?: string) {
  const sessions = db.prepare('SELECT id, issue_id, started_at, user_id FROM time_tracking_sessions WHERE issue_id = ?').all(issueId) as any[];
  const results = [];
  for (const session of sessions) {
    const res = processSession(session, message);
    if (res) results.push(res);
  }
  return results;
}

function processSession(active: any, customMessage?: string) {
  
  // Calculate hours passed robustly
  let dateStr = active.started_at;
  if (!dateStr.endsWith('Z')) dateStr += 'Z';
  
  const started = new Date(dateStr).getTime();
  const now = Date.now();
  let hours = (now - started) / (1000 * 60 * 60);
  
  // Hard limit: 12 hours
  if (hours > 12) {
    hours = 12;
  }
  
  // If it's too short (e.g. less than 10 seconds), don't log it, just delete
  if (hours < 0.002) {
    db.prepare('DELETE FROM time_tracking_sessions WHERE id = ?').run(active.id);
    return null;
  }
  
  // Round to 4 decimals (sub-second precision)
  hours = Math.round(hours * 10000) / 10000;
  
  const logId = crypto.randomUUID();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO work_logs (id, issue_id, user_id, hours_spent, description, logged_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(logId, active.issue_id, active.user_id, hours, customMessage || 'Session auto-logged');

    
    db.prepare('DELETE FROM time_tracking_sessions WHERE id = ?').run(active.id);
  })();
  
  return { issueId: active.issue_id, hours, logId };
}
