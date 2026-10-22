import crypto from 'crypto';
import db from './db';
import { IssueService } from './IssueService';
import { esPrioridad } from './prioridad';
import { esRegla } from './recurrencia';
import { diasHasta } from './fechas';
import { normalizarHora } from './hora';

/**
 * Plantillas de tareas: «Parcial», con su descripción, su etiqueta, sus pasos y
 * la entrega a los siete días.
 *
 * Son del espacio. Lo que se guarda pasa por una lista blanca de campos, igual
 * que el alta: una plantilla es una tarea en conserva, y nada entra en una
 * tarea por aquí que no pudiera entrar por el formulario.
 *
 * La entrega se guarda **relativa** (`due_offset`, días desde el día en que se
 * usa): una plantilla con fecha fija serviría una vez.
 */

export interface Contenido {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  label_ids?: string[];
  subtareas?: string[];
  recurrence?: string;
  due_offset?: number;
  due_time?: string;
}

const LARGO_NOMBRE = 60;
const MAX_SUBTAREAS = 30;

export function limpiarContenido(entrada: unknown): Contenido | null {
  const c = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  const titulo = typeof c.title === 'string' ? c.title.trim().slice(0, 200) : '';
  if (!titulo) return null;
  const fuera: Contenido = { title: titulo };
  if (typeof c.description === 'string' && c.description.trim()) fuera.description = c.description.slice(0, 20_000);
  if (typeof c.type === 'string' && /^[a-z0-9-]{1,30}$/.test(c.type)) fuera.type = c.type;
  if (esPrioridad(c.priority)) fuera.priority = c.priority;
  if (Array.isArray(c.label_ids)) fuera.label_ids = c.label_ids.filter((x): x is string => typeof x === 'string').slice(0, 20);
  if (Array.isArray(c.subtareas)) {
    fuera.subtareas = c.subtareas.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim().slice(0, 200)).slice(0, MAX_SUBTAREAS);
  }
  if (esRegla(c.recurrence)) fuera.recurrence = c.recurrence as string;
  const off = Number(c.due_offset);
  if (c.due_offset !== undefined && c.due_offset !== null && Number.isInteger(off) && off >= 0 && off <= 365) fuera.due_offset = off;
  const hora = normalizarHora(c.due_time);
  if (hora) fuera.due_time = hora;
  // Repetir necesita fecha: sin desplazamiento, la regla no tiene de dónde contar.
  if (fuera.recurrence && fuera.due_offset === undefined) delete fuera.recurrence;
  return fuera;
}

export interface Plantilla { id: string; name: string; contenido: Contenido }

export function listar(workspaceId: string): Plantilla[] {
  const filas = db.prepare('SELECT id, name, payload_json FROM task_templates WHERE workspace_id = ? ORDER BY name COLLATE NOCASE')
    .all(workspaceId) as Array<{ id: string; name: string; payload_json: string }>;
  return filas.flatMap((f) => {
    let c: Contenido | null = null;
    try { c = limpiarContenido(JSON.parse(f.payload_json)); } catch { /* fila rota */ }
    return c ? [{ id: f.id, name: f.name, contenido: c }] : [];
  });
}

export type Resultado =
  | { ok: true; id: string }
  | { ok: false; error: 'nombre_vacio' | 'nombre_largo' | 'titulo_vacio' | 'no_existe' };

function nombreValido(nombre: unknown): string | { error: 'nombre_vacio' | 'nombre_largo' } {
  const n = typeof nombre === 'string' ? nombre.trim() : '';
  if (!n) return { error: 'nombre_vacio' };
  if (n.length > LARGO_NOMBRE) return { error: 'nombre_largo' };
  return n;
}

/**
 * Lo que llega del formulario de ajustes, limpio y con las etiquetas de
 * **este** espacio: una plantilla no guarda ids de etiquetas ajenas, aunque al
 * usarla se saltarían igual.
 */
function contenidoDelEspacio(entrada: unknown, workspaceId: string): Contenido | null {
  const c = limpiarContenido(entrada);
  if (!c) return null;
  if (c.label_ids?.length) {
    c.label_ids = c.label_ids.filter((l) => db.prepare('SELECT 1 FROM labels WHERE id = ? AND workspace_id = ?').get(l, workspaceId));
    if (!c.label_ids.length) delete c.label_ids;
  }
  return c;
}

/** Crear una plantilla desde cero (ajustes del espacio), sin pasar por una tarea. */
export function crear(workspaceId: string, nombre: unknown, entrada: unknown, userId: string): Resultado {
  const n = nombreValido(nombre);
  if (typeof n !== 'string') return { ok: false, error: n.error };
  const contenido = contenidoDelEspacio(entrada, workspaceId);
  if (!contenido) return { ok: false, error: 'titulo_vacio' };
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO task_templates (id, workspace_id, name, payload_json, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, workspaceId, n, JSON.stringify(contenido), userId);
  return { ok: true, id };
}

/** Cambiar el nombre o el contenido de una plantilla del espacio. */
export function actualizar(id: string, workspaceId: string, nombre: unknown, entrada: unknown): Resultado {
  const n = nombreValido(nombre);
  if (typeof n !== 'string') return { ok: false, error: n.error };
  const contenido = contenidoDelEspacio(entrada, workspaceId);
  if (!contenido) return { ok: false, error: 'titulo_vacio' };
  const cambios = db.prepare('UPDATE task_templates SET name = ?, payload_json = ? WHERE id = ? AND workspace_id = ?')
    .run(n, JSON.stringify(contenido), id, workspaceId).changes;
  return cambios ? { ok: true, id } : { ok: false, error: 'no_existe' };
}

/**
 * Guardar una tarea como plantilla: su título, descripción, tipo, prioridad,
 * etiquetas, los títulos de sus subtareas y su regla. La entrega, como días
 * desde hoy (lo que se pase, o lo que falte hasta su fecha).
 */
export function desdeTarea(issueId: string, workspaceId: string, nombre: unknown, userId: string, desplazamiento?: unknown): Resultado {
  const n = nombreValido(nombre);
  if (typeof n !== 'string') return { ok: false, error: n.error };
  const t = db.prepare('SELECT * FROM issues WHERE id = ? AND workspace_id = ?').get(issueId, workspaceId) as any;
  if (!t) return { ok: false, error: 'no_existe' };
  const etiquetas = (db.prepare('SELECT label_id FROM issue_labels WHERE issue_id = ?').all(issueId) as Array<{ label_id: string }>).map((r) => r.label_id);
  // `null`: sin fecha, a propósito. Sin indicar: lo que falta hasta la entrega.
  const pedido = Number(desplazamiento);
  const offset = desplazamiento === null || desplazamiento === ''
    ? undefined
    : desplazamiento !== undefined && Number.isInteger(pedido)
      ? pedido
      : t.due_date ? Math.max(0, diasHasta(t.due_date) ?? 0) : undefined;
  const contenido = limpiarContenido({
    title: t.title, description: t.description, type: t.type, priority: t.priority, label_ids: etiquetas,
    subtareas: IssueService.listarSubtareas(issueId).map((s) => s.title),
    recurrence: t.recurrence, due_offset: offset, due_time: t.due_time,
  });
  if (!contenido) return { ok: false, error: 'no_existe' };
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO task_templates (id, workspace_id, name, payload_json, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, workspaceId, n, JSON.stringify(contenido), userId);
  return { ok: true, id };
}

export function borrar(id: string, workspaceId: string): boolean {
  return db.prepare('DELETE FROM task_templates WHERE id = ? AND workspace_id = ?').run(id, workspaceId).changes > 0;
}
