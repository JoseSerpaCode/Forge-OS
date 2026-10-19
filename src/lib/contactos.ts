import crypto from 'crypto';
import db from './db';

/**
 * Contactos: personas sin cuenta en Forge.
 *
 * Un compañero de clase al que le toca una parte del trabajo, pero que no
 * está en la aplicación ni hace falta que esté. Con un contacto se le puede
 * asignar una tarea y mencionarlo en una nota.
 *
 * Son de **una cuenta** (migración 54), no de un espacio. Solo su dueño los
 * lista, los usa al asignar o mencionar y los edita. Quien comparte espacio
 * ve el nombre en las tareas y notas donde aparece, pero no puede usarlos.
 */

export interface Contacto {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
}

export type ErrorContacto = 'nombre' | 'nota' | 'no_existe' | 'invitado';

const limpiarNombre = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const nombreValido = (n: string) => n.length >= 1 && n.length <= 80;
const limpiarNota = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function listar(ownerId: string): Contacto[] {
  return db
    .prepare('SELECT id, name, note, created_at FROM contacts WHERE owner_id = ? ORDER BY name COLLATE NOCASE')
    .all(ownerId) as Contacto[];
}

export function deDueno(ownerId: string, id: string): Contacto | null {
  return (db
    .prepare('SELECT id, name, note, created_at FROM contacts WHERE id = ? AND owner_id = ?')
    .get(id, ownerId) as Contacto | undefined) ?? null;
}

export function crear(
  owner: { id: string; is_guest?: number | null },
  nombre: unknown,
  nota?: unknown
): { ok: true; contacto: Contacto } | { ok: false; error: ErrorContacto } {
  // Un invitado no tiene libreta: su cuenta es temporal.
  if (owner.is_guest === 1) return { ok: false, error: 'invitado' };
  const name = limpiarNombre(nombre);
  if (!nombreValido(name)) return { ok: false, error: 'nombre' };
  const note = limpiarNota(nota);
  if (note && note.length > 200) return { ok: false, error: 'nota' };
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO contacts (id, owner_id, name, note) VALUES (?, ?, ?, ?)').run(id, owner.id, name, note);
  return { ok: true, contacto: deDueno(owner.id, id)! };
}

export function editar(
  ownerId: string,
  id: string,
  cambios: { name?: unknown; note?: unknown }
): { ok: true } | { ok: false; error: ErrorContacto } {
  if (!deDueno(ownerId, id)) return { ok: false, error: 'no_existe' };
  if ('name' in cambios) {
    const name = limpiarNombre(cambios.name);
    if (!nombreValido(name)) return { ok: false, error: 'nombre' };
    db.prepare('UPDATE contacts SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?').run(name, id, ownerId);
  }
  if ('note' in cambios) {
    const note = limpiarNota(cambios.note);
    if (note && note.length > 200) return { ok: false, error: 'nota' };
    db.prepare('UPDATE contacts SET note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?').run(note, id, ownerId);
  }
  return { ok: true };
}

/**
 * Borrar un contacto. Sus tareas quedan **sin asignar** (`SET NULL`) y sus
 * menciones en notas se quedan como texto: no se borra nada en cascada salvo
 * el índice de menciones.
 */
export function borrar(ownerId: string, id: string): boolean {
  return db.prepare('DELETE FROM contacts WHERE id = ? AND owner_id = ?').run(id, ownerId).changes > 0;
}

/**
 * La ficha de un contacto: sus tareas y las notas donde se le menciona.
 *
 * Solo de espacios de los que el dueño **sigue siendo miembro**: si te vas de
 * un espacio, la ficha deja de enseñarte lo que hay dentro.
 */
export function ficha(ownerId: string, id: string) {
  const contacto = deDueno(ownerId, id);
  if (!contacto) return null;
  const tareas = db.prepare(`
    SELECT i.id, i.title, i.status, i.due_date, i.due_time, w.sys_tag, w.name AS workspace_name
    FROM issues i
    JOIN workspaces w ON w.id = i.workspace_id
    JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = ?
    WHERE i.assignee_contact_id = ?
    ORDER BY i.status = 'done', i.due_date IS NULL, i.due_date, i.title
    LIMIT 200
  `).all(ownerId, id) as Array<{ id: string; title: string; status: string; due_date: string | null; due_time: string | null; sys_tag: string; workspace_name: string }>;
  const notas = db.prepare(`
    SELECT p.id, p.title, w.sys_tag, w.name AS workspace_name
    FROM page_mentions pm
    JOIN pages p ON p.id = pm.page_id
    JOIN workspaces w ON w.id = p.workspace_id
    JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = ?
    WHERE pm.contact_id = ?
    ORDER BY p.updated_at DESC
    LIMIT 200
  `).all(ownerId, id) as Array<{ id: string; title: string; sys_tag: string; workspace_name: string }>;
  return { contacto, tareas, notas };
}

/**
 * Rehace el índice de menciones de una nota a partir de su documento.
 *
 * Solo cuentan los contactos de **quien guarda**: un id ajeno metido a mano en
 * el JSON no crea una mención a un contacto de otra persona.
 */
export function indexarMenciones(pageId: string, doc: unknown, autorId: string) {
  const ids = new Set<string>();
  const recorrer = (n: any, profundidad: number) => {
    if (!n || typeof n !== 'object' || profundidad > 60) return;
    if (n.type === 'mention' && n.attrs?.tipo === 'contacto' && typeof n.attrs.id === 'string') ids.add(n.attrs.id);
    if (Array.isArray(n.content)) for (const c of n.content) recorrer(c, profundidad + 1);
  };
  recorrer(doc, 0);

  const propios = [...ids].filter((id) => deDueno(autorId, id));
  db.transaction(() => {
    // Las menciones de contactos de otras personas que ya había se conservan:
    // quien edita la nota no es su dueño, pero no por eso dejan de estar.
    const borrarPropias = db.prepare(`
      DELETE FROM page_mentions WHERE page_id = ? AND contact_id IN (SELECT id FROM contacts WHERE owner_id = ?)
    `);
    borrarPropias.run(pageId, autorId);
    const poner = db.prepare('INSERT OR IGNORE INTO page_mentions (page_id, contact_id) VALUES (?, ?)');
    for (const id of propios) poner.run(pageId, id);
  })();
}
