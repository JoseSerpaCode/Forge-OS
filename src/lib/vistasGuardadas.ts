import crypto from 'crypto';
import db from './db';

/**
 * Vistas guardadas del tablero: «#Cálculo, lo que vence en 7 días».
 *
 * Una vista es un puñado de parámetros de la URL del tablero con nombre. Se
 * guardan **solo** claves de una lista blanca, con sus valores validados, al
 * guardar y otra vez al leer: lo que se guarda acaba en una URL y en una
 * consulta, y nada que venga del cliente entra tal cual en ninguna de las dos.
 *
 * Son personales: las ve y las borra solo quien las creó.
 */

export interface Consulta {
  vista?: 'tablero' | 'hoy' | 'proximos';
  label?: string;
  group?: 'label';
  prioridad?: 'highest' | 'high' | 'medium' | 'low';
  /** Vence en los próximos N días (1–60). */
  vence?: number;
  /** Un id de usuario, o `yo`. */
  responsable?: string;
}

const LARGO_NOMBRE = 40;
const MAXIMO_POR_PERSONA = 30;

/** Deja solo lo que se reconoce y es válido. Nunca lanza: lo que no vale, se cae. */
export function limpiarConsulta(entrada: unknown): Consulta {
  const q = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  const fuera: Consulta = {};
  if (q.vista === 'tablero' || q.vista === 'hoy' || q.vista === 'proximos') fuera.vista = q.vista;
  if (typeof q.label === 'string' && /^[\w-]{1,64}$/.test(q.label)) fuera.label = q.label;
  if (q.group === 'label') fuera.group = 'label';
  if (q.prioridad === 'highest' || q.prioridad === 'high' || q.prioridad === 'medium' || q.prioridad === 'low') fuera.prioridad = q.prioridad;
  const vence = Number(q.vence);
  if (Number.isInteger(vence) && vence >= 1 && vence <= 60) fuera.vence = vence;
  if (typeof q.responsable === 'string' && /^[\w-]{1,64}$/.test(q.responsable)) fuera.responsable = q.responsable;
  return fuera;
}

/** La consulta como parámetros de URL del tablero. */
export function aParametros(q: Consulta): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && !(k === 'vista' && v === 'tablero')) p.set(k, String(v));
  return p.toString();
}

export interface VistaGuardada { id: string; name: string; query: Consulta; url: string }

export function listar(userId: string, workspaceId: string, sysTag: string): VistaGuardada[] {
  const filas = db.prepare(
    'SELECT id, name, query_json FROM saved_views WHERE user_id = ? AND workspace_id = ? ORDER BY position, created_at'
  ).all(userId, workspaceId) as Array<{ id: string; name: string; query_json: string }>;
  return filas.map((f) => {
    let q: Consulta = {};
    try { q = limpiarConsulta(JSON.parse(f.query_json)); } catch { /* fila rota: vista vacía */ }
    const params = aParametros(q);
    return { id: f.id, name: f.name, query: q, url: `/w/${sysTag}/board${params ? `?${params}` : ''}` };
  });
}

export type Resultado = { ok: true; id: string } | { ok: false; error: 'nombre_vacio' | 'nombre_largo' | 'demasiadas' | 'no_existe' | 'clave_desconocida' };

/**
 * Guardar una vista. Una clave fuera de la lista blanca es un error y no se
 * descarta en silencio: quien manda `{"sql": …}` no está guardando una vista.
 */
export function crear(userId: string, workspaceId: string, nombre: unknown, query: unknown): Resultado {
  const n = typeof nombre === 'string' ? nombre.trim() : '';
  if (!n) return { ok: false, error: 'nombre_vacio' };
  if (n.length > LARGO_NOMBRE) return { ok: false, error: 'nombre_largo' };
  const claves = Object.keys((query && typeof query === 'object' ? query : {}) as object);
  const permitidas = ['vista', 'label', 'group', 'prioridad', 'vence', 'responsable'];
  if (claves.some((k) => !permitidas.includes(k))) return { ok: false, error: 'clave_desconocida' };
  const cuantas = (db.prepare('SELECT COUNT(*) AS n FROM saved_views WHERE user_id = ? AND workspace_id = ?').get(userId, workspaceId) as any).n;
  if (cuantas >= MAXIMO_POR_PERSONA) return { ok: false, error: 'demasiadas' };
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO saved_views (id, workspace_id, user_id, name, query_json, position) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, workspaceId, userId, n, JSON.stringify(limpiarConsulta(query)), cuantas);
  return { ok: true, id };
}

export function renombrar(userId: string, workspaceId: string, id: string, nombre: unknown): Resultado {
  const n = typeof nombre === 'string' ? nombre.trim() : '';
  if (!n) return { ok: false, error: 'nombre_vacio' };
  if (n.length > LARGO_NOMBRE) return { ok: false, error: 'nombre_largo' };
  const r = db.prepare('UPDATE saved_views SET name = ? WHERE id = ? AND user_id = ? AND workspace_id = ?').run(n, id, userId, workspaceId);
  return r.changes ? { ok: true, id } : { ok: false, error: 'no_existe' };
}

/** Solo las propias: la de otra persona da «no existe», igual que una inventada. */
export function borrar(userId: string, workspaceId: string, id: string): boolean {
  return db.prepare('DELETE FROM saved_views WHERE id = ? AND user_id = ? AND workspace_id = ?').run(id, userId, workspaceId).changes > 0;
}
