import db from './db';
import { deVarias } from './labels';

/**
 * Las tarjetas del tablero: qué se trae, en qué orden y cuántas.
 *
 * Vive aquí y no en `board.astro` porque la usan dos sitios —la página y el
 * parcial que carga más tareas hechas— y el SQL de un tablero es justo lo que
 * se desincroniza cuando está copiado: un filtro que se añade en uno y no en
 * el otro hace que «ver más» traiga tareas que el tablero no enseñaba.
 *
 * ## El orden
 *
 * Las columnas de trabajo van por `position`, el orden que la gente coloca
 * arrastrando. «Hecho» va por **cuándo se terminó** (`done_at`), lo más
 * reciente arriba: es un historial, no una lista que se ordene a mano.
 *
 * Ordenar por otra cosa ya no es una vista: es una acción que reescribe
 * `position` (ver `api/w/[sys_tag]/board/reorder.ts`). Por eso aquí no hay
 * parámetro de orden.
 *
 * ## Los topes
 *
 * Cien por columna de trabajo y **diez** en Hecho, contados por columna y no
 * sobre el total (con un tope global, trescientas por hacer dejarían Hecho
 * vacío). Hecho crece sin parar mientras se usa la app, y casi nunca se mira
 * más allá de lo último: lo demás se carga con «ver más». Lo que se corta se
 * cuenta y se dice en la cabecera de cada columna.
 */

export const TOPE_COLUMNA = 100;
export const TOPE_HECHAS = 10;
export const PAGINA_HECHAS = 20;

/** Cuándo cuenta una tarea como terminada. `updated_at` solo para las anteriores a `done_at`. */
const CIERRE = (c: string) => `COALESCE(${c}done_at, ${c}updated_at)`;

const ORDEN = (c: string) =>
  `CASE WHEN ${c}status = 'done' THEN -julianday(${CIERRE(c)}) ELSE ${c}position END ASC, ${c}id ASC`;

export interface FiltroTablero {
  workspaceId: string;
  userId: string;
  /**
   * `undefined`: sin filtro de sprint (la función está apagada).
   * `null`: el backlog. Un id: ese sprint.
   */
  sprintId?: string | null;
  /** Solo las que llevan esta etiqueta (ya comprobada como del espacio). */
  labelId?: string | null;
  /** Un carril por etiqueta. Una tarea con dos etiquetas sale en los dos. */
  agruparPorEtiqueta?: boolean;
}

function filtros(f: FiltroTablero, c = 'i.') {
  const donde: string[] = [`${c}workspace_id = ?`];
  const params: unknown[] = [f.workspaceId];
  if (f.sprintId === null) donde.push(`${c}sprint_id IS NULL`);
  else if (typeof f.sprintId === 'string') { donde.push(`${c}sprint_id = ?`); params.push(f.sprintId); }
  if (f.labelId) {
    donde.push(`EXISTS (SELECT 1 FROM issue_labels fl WHERE fl.issue_id = ${c}id AND fl.label_id = ?)`);
    params.push(f.labelId);
  }
  return { donde: donde.join(' AND '), params };
}

const COLUMNAS_TARJETA = `
  i.*,
  u1.username AS reporter_username,
  u2.username AS assignee_username,
  u2.avatar_url AS assignee_avatar,
  (SELECT started_at FROM time_tracking_sessions WHERE issue_id = i.id AND user_id = ?) AS active_session_start,
  (SELECT COUNT(*) FROM issue_page_links pl WHERE pl.issue_id = i.id) AS apuntes
`;

export interface Tablero {
  tarjetas: any[];
  /** Total real por columna, o por `carril|columna` si se agrupa. */
  conteos: Record<string, number>;
}

/** La clave de conteo de una columna, dentro de un carril o no. */
export const claveConteo = (estado: string, carril?: string | null) =>
  carril === undefined || carril === null ? estado : `${carril}|${estado}`;

export function cargarTablero(f: FiltroTablero): Tablero {
  const { donde, params } = filtros(f);
  const carril = f.agruparPorEtiqueta ? `COALESCE(il.label_id, '')` : `NULL`;
  const unirCarril = f.agruparPorEtiqueta ? 'LEFT JOIN issue_labels il ON il.issue_id = i.id' : '';
  const particion = f.agruparPorEtiqueta ? `${carril}, i.status` : 'i.status';

  const tarjetas = db.prepare(`
    SELECT * FROM (
      SELECT ${COLUMNAS_TARJETA},
             ${carril} AS carril,
             ROW_NUMBER() OVER (PARTITION BY ${particion} ORDER BY ${ORDEN('i.')}) AS rn
      FROM issues i
      LEFT JOIN users u1 ON i.reporter_id = u1.id
      LEFT JOIN users u2 ON i.assignee_id = u2.id
      ${unirCarril}
      WHERE ${donde}
    )
    WHERE rn <= CASE WHEN status = 'done' THEN ${TOPE_HECHAS} ELSE ${TOPE_COLUMNA} END
    ORDER BY ${ORDEN('')}
  `).all(f.userId, ...params) as any[];

  const conteos: Record<string, number> = {};
  const filas = db.prepare(`
    SELECT ${carril} AS carril, i.status AS status, COUNT(*) AS n
    FROM issues i ${unirCarril}
    WHERE ${donde}
    GROUP BY ${particion}
  `).all(...params) as Array<{ carril: string | null; status: string; n: number }>;
  for (const r of filas) conteos[claveConteo(r.status, f.agruparPorEtiqueta ? r.carril : null)] = r.n;

  ponerEtiquetas(tarjetas);
  return { tarjetas, conteos };
}

/**
 * La siguiente página de Hecho, después de un cursor.
 *
 * Cursor `cierre|id` y no `OFFSET`: si alguien termina una tarea mientras otra
 * persona pulsa «ver más», con un desplazamiento todo se corre una posición y
 * una tarea sale repetida o se salta.
 */
export function masHechas(
  f: FiltroTablero & { carril?: string | null; despues?: string | null }
): { tarjetas: any[]; hayMas: boolean } {
  const { donde, params } = filtros(f);
  const extra: string[] = [`i.status = 'done'`];
  const extraParams: unknown[] = [];

  if (f.agruparPorEtiqueta) {
    if (f.carril) { extra.push('EXISTS (SELECT 1 FROM issue_labels cl WHERE cl.issue_id = i.id AND cl.label_id = ?)'); extraParams.push(f.carril); }
    else extra.push('NOT EXISTS (SELECT 1 FROM issue_labels cl WHERE cl.issue_id = i.id)');
  }

  const cursor = (f.despues ?? '').split('|');
  if (cursor.length === 2 && cursor[0] && cursor[1]) {
    extra.push(`(${CIERRE('i.')} < ? OR (${CIERRE('i.')} = ? AND i.id > ?))`);
    extraParams.push(cursor[0], cursor[0], cursor[1]);
  }

  const filas = db.prepare(`
    SELECT ${COLUMNAS_TARJETA}, ${CIERRE('i.')} AS cierre
    FROM issues i
    LEFT JOIN users u1 ON i.reporter_id = u1.id
    LEFT JOIN users u2 ON i.assignee_id = u2.id
    WHERE ${donde} AND ${extra.join(' AND ')}
    ORDER BY ${CIERRE('i.')} DESC, i.id ASC
    LIMIT ?
  `).all(f.userId, ...params, ...extraParams, PAGINA_HECHAS + 1) as any[];

  const hayMas = filas.length > PAGINA_HECHAS;
  const tarjetas = filas.slice(0, PAGINA_HECHAS);
  for (const t of tarjetas) t.carril = f.agruparPorEtiqueta ? (f.carril ?? '') : null;
  ponerEtiquetas(tarjetas);
  return { tarjetas, hayMas };
}

/** El cursor que deja una tarjeta de Hecho, para pedir las de después. */
export const cursorDe = (t: any) => `${t.cierre ?? t.done_at ?? t.updated_at}|${t.id}`;

// Las etiquetas de todas las tarjetas en **una** consulta: una por tarjeta
// serían cien consultas por carga de tablero.
function ponerEtiquetas(tarjetas: any[]) {
  const porTarea = deVarias('issue', [...new Set(tarjetas.map((t) => t.id))]);
  for (const t of tarjetas) t.labels = porTarea.get(t.id) ?? [];
}
