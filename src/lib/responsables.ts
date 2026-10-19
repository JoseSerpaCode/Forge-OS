import db from './db';
import { ApiError } from './errors';

/**
 * A quién va una tarea: una persona con cuenta o un contacto (migración 54).
 *
 * Es el único sitio que sabe que hay dos clases de responsable. La tarjeta, el
 * panel, el alta y los filtros pasan por aquí en vez de leer
 * `assignee_id` y unir `users` cada uno por su cuenta.
 */

export type Responsable =
  | { tipo: 'usuario'; id: string; nombre: string; avatar: string | null }
  | { tipo: 'contacto'; id: string; nombre: string; avatar: null }
  | null;

/**
 * En los desplegables, un solo valor por opción: el id a secas para una
 * persona con cuenta y `c:<id>` para un contacto. Así un `<select>` sigue
 * valiendo para los dos.
 */
export const PREFIJO_CONTACTO = 'c:';
export const valorDeContacto = (id: string) => `${PREFIJO_CONTACTO}${id}`;

export function desdeValor(valor: unknown): { assignee_id: string | null; assignee_contact_id: string | null } {
  if (typeof valor !== 'string' || !valor) return { assignee_id: null, assignee_contact_id: null };
  return valor.startsWith(PREFIJO_CONTACTO)
    ? { assignee_id: null, assignee_contact_id: valor.slice(PREFIJO_CONTACTO.length) }
    : { assignee_id: valor, assignee_contact_id: null };
}

/** Columnas y unión para traer el responsable en la misma consulta que la tarea. */
export const COLUMNAS_RESPONSABLE = `
  u2.username AS assignee_username,
  u2.avatar_url AS assignee_avatar,
  ct.name AS assignee_contact_name
`;
export const UNIR_RESPONSABLE = (alias = 'i') =>
  `LEFT JOIN users u2 ON ${alias}.assignee_id = u2.id LEFT JOIN contacts ct ON ${alias}.assignee_contact_id = ct.id`;

export function deFila(fila: {
  assignee_id?: string | null;
  assignee_username?: string | null;
  assignee_avatar?: string | null;
  assignee_contact_id?: string | null;
  assignee_contact_name?: string | null;
}): Responsable {
  if (fila.assignee_id && fila.assignee_username) {
    return { tipo: 'usuario', id: fila.assignee_id, nombre: fila.assignee_username, avatar: fila.assignee_avatar ?? null };
  }
  if (fila.assignee_contact_id && fila.assignee_contact_name) {
    return { tipo: 'contacto', id: fila.assignee_contact_id, nombre: fila.assignee_contact_name, avatar: null };
  }
  return null;
}

/** «Juan Camilo Luna» → «JC». Para la tarjeta, donde no hay foto. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((p) => [...p][0] ?? '');
  return letras.join('').toLocaleUpperCase() || '?';
}

/**
 * Comprueba y normaliza a quién se asigna una tarea.
 *
 * - Una persona con cuenta tiene que ser **miembro del espacio**. Al editar no
 *   se comprobaba: cualquier editor podía asignar la tarea a cualquier cuenta
 *   de Forge, que recibía una notificación con su título y su espacio.
 * - Un contacto tiene que ser **de quien asigna**. Se acepta también el que ya
 *   tenía la tarea, para que otra persona del espacio pueda editarla sin
 *   tener que desasignarlo.
 * - Nunca los dos a la vez: poner uno quita el otro.
 *
 * Devuelve solo los campos que cambian, listos para el `UPDATE` o el `INSERT`.
 */
export function resolver(args: {
  workspaceId: string;
  actorId: string;
  assignee_id?: unknown;
  assignee_contact_id?: unknown;
  contactoActual?: string | null;
}): { assignee_id?: string | null; assignee_contact_id?: string | null } {
  const tocaUsuario = args.assignee_id !== undefined;
  const tocaContacto = args.assignee_contact_id !== undefined;
  if (!tocaUsuario && !tocaContacto) return {};

  const usuario = typeof args.assignee_id === 'string' && args.assignee_id ? args.assignee_id : null;
  const contacto = typeof args.assignee_contact_id === 'string' && args.assignee_contact_id ? args.assignee_contact_id : null;
  if (usuario && contacto) throw new ApiError(400, 'An issue has one assignee: a member or a contact, not both');

  if (usuario) {
    const miembro = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(args.workspaceId, usuario);
    if (!miembro) throw new ApiError(400, 'Assignee is not a member of this workspace');
    return { assignee_id: usuario, assignee_contact_id: null };
  }
  if (contacto) {
    const propio = db.prepare('SELECT 1 FROM contacts WHERE id = ? AND owner_id = ?').get(contacto, args.actorId);
    if (!propio && contacto !== args.contactoActual) throw new ApiError(400, 'Contact not found');
    return { assignee_id: null, assignee_contact_id: contacto };
  }
  // Se pidió quitar el responsable (null o cadena vacía).
  return { assignee_id: null, assignee_contact_id: null };
}
