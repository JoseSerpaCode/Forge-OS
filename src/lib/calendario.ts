import crypto from 'crypto';
import db from './db';

/**
 * El calendario `.ics` de solo lectura: las entregas, en Google Calendar.
 *
 * Google consulta el enlace solo, cada varias horas y sin sesión, así que el
 * enlace lleva un token. Tres decisiones que no se ven en el código:
 *
 * - **Solo se guarda el hash** del token. El token se enseña una vez, al
 *   crearlo; quien tenga la base (o su copia nocturna) no puede leer
 *   calendarios ajenos con ella.
 * - **La pertenencia se comprueba en cada petición.** Un enlace viejo no puede
 *   seguir enseñando un espacio del que la persona ya salió.
 * - **Sin descripción.** Título, fecha y enlace a la tarea, nada más: lo que se
 *   apuntó en la descripción no sale hacia Google.
 */

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function crearFeed(userId: string, workspaceId: string | null) {
  const token = crypto.randomBytes(24).toString('base64url');
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO calendar_feeds (id, user_id, workspace_id, token_hash) VALUES (?, ?, ?, ?)')
    .run(id, userId, workspaceId, hash(token));
  return { id, token };
}

export function listarFeeds(userId: string) {
  return db.prepare(`
    SELECT f.id, f.workspace_id, w.name AS workspace_name, f.created_at, f.last_fetched_at
    FROM calendar_feeds f LEFT JOIN workspaces w ON w.id = f.workspace_id
    WHERE f.user_id = ? AND f.revoked_at IS NULL ORDER BY f.created_at
  `).all(userId) as Array<{ id: string; workspace_id: string | null; workspace_name: string | null; created_at: string; last_fetched_at: string | null }>;
}

export function revocar(userId: string, id: string): boolean {
  return db.prepare('UPDATE calendar_feeds SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .run(id, userId).changes > 0;
}

export interface Feed { id: string; user_id: string; workspace_id: string | null; timezone: string | null }

export function feedPorToken(token: string): Feed | null {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  return (db.prepare(`
    SELECT f.id, f.user_id, f.workspace_id, u.timezone FROM calendar_feeds f JOIN users u ON u.id = f.user_id
    WHERE f.token_hash = ? AND f.revoked_at IS NULL
  `).get(hash(token)) as Feed | undefined) ?? null;
}

/**
 * Lo que se sirve. Es un GET que escribe (`last_fetched_at`): se acepta porque
 * no cambia nada que se vea ni que dependa de quien pide, y sirve para que la
 * persona sepa en Ajustes si Google está leyendo el enlace.
 */
export function marcarLeido(feedId: string) {
  db.prepare('UPDATE calendar_feeds SET last_fetched_at = CURRENT_TIMESTAMP WHERE id = ?').run(feedId);
}

export function tareasDelFeed(feed: Feed) {
  return db.prepare(`
    SELECT i.id, i.title, i.due_date, i.due_time, i.updated_at, w.sys_tag
    FROM issues i
    JOIN workspaces w ON w.id = i.workspace_id
    JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = ?
    WHERE i.status != 'done' AND i.due_date IS NOT NULL AND i.parent_issue_id IS NULL
      AND (? IS NULL OR i.workspace_id = ?)
    ORDER BY i.due_date
    LIMIT 500
  `).all(feed.user_id, feed.workspace_id, feed.workspace_id) as Array<{ id: string; title: string; due_date: string; due_time: string | null; updated_at: string; sys_tag: string }>;
}

/** Texto escapado según RFC 5545: `\`, `;`, `,` y saltos de línea. */
const escapar = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Líneas de 75 octetos como mucho, sin partir un carácter UTF-8 por la mitad. */
function plegar(linea: string): string {
  const trozos: string[] = [];
  let actual = '';
  let bytes = 0;
  for (const c of linea) {
    const b = Buffer.byteLength(c, 'utf8');
    const tope = trozos.length === 0 ? 75 : 74; // las continuaciones empiezan con un espacio
    if (bytes + b > tope) { trozos.push(actual); actual = ''; bytes = 0; }
    actual += c;
    bytes += b;
  }
  trozos.push(actual);
  return trozos.join('\r\n ');
}

/**
 * Una hora de pared en una zona → instante UTC.
 *
 * `due_time` es la hora tal como la apuntó la persona, sin zona. Para Google
 * hay que darla en UTC, y para eso hace falta su zona (`users.timezone`).
 */
export function instanteDePared(dia: string, hora: string, zona: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const supuesto = Date.UTC(a, m - 1, d, h, mi);
  const desfase = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  let t = supuesto - desfase(supuesto);
  t = supuesto - desfase(t); // una segunda vuelta corrige los cambios de horario
  return new Date(t);
}

const sello = (f: Date) => f.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const diaIcs = (iso: string) => iso.replace(/-/g, '');
const masUnDia = (iso: string) => { const f = new Date(`${iso}T00:00:00Z`); f.setUTCDate(f.getUTCDate() + 1); return f.toISOString().slice(0, 10); };

export function generarIcs(tareas: ReturnType<typeof tareasDelFeed>, zona: string | null, base: string, ahora: Date = new Date()): string {
  const z = zona && (() => { try { new Intl.DateTimeFormat('en-US', { timeZone: zona }); return true; } catch { return false; } })() ? zona : 'UTC';
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Forge OS//Entregas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Forge OS'];
  for (const t of tareas) {
    const dia = String(t.due_date).slice(0, 10);
    lineas.push('BEGIN:VEVENT', `UID:${t.id}@forge-os`, `DTSTAMP:${sello(ahora)}`);
    if (t.due_time && /^\d{2}:\d{2}$/.test(t.due_time)) {
      lineas.push(`DTSTART:${sello(instanteDePared(dia, t.due_time, z))}`, 'DURATION:PT30M');
    } else {
      lineas.push(`DTSTART;VALUE=DATE:${diaIcs(dia)}`, `DTEND;VALUE=DATE:${diaIcs(masUnDia(dia))}`);
    }
    lineas.push(`SUMMARY:${escapar(t.title)}`, `URL:${base}/w/${t.sys_tag}/board?issue=${t.id}`, 'END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n') + '\r\n';
}
