import db from './db';
import crypto from 'crypto';

/**
 * Los archivos y carpetas de un espacio, tal y como los ve Forge.
 *
 * Aquí solo hay **metadatos**. Los bytes están en el Drive de quien conectó la
 * cuenta y no pasan por esta máquina ni al subir ni al descargar.
 *
 * Por eso la lista puede desincronizarse: alguien puede borrar un archivo desde
 * su Drive, o revocar el permiso. Cuando eso se detecta, la fila **no se
 * borra**: se marca. Una lista que encoge sola parece pérdida de datos, y el
 * nombre de lo que había es justamente lo que hace falta para ir a buscarlo.
 */

export type Carpeta = {
  id: string;
  name: string;
  parentId: string | null;
  driveId: string | null;
};

export type Archivo = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  webViewLink: string | null;
  driveId: string;
  folderId: string | null;
  status: 'ok' | 'missing';
  createdAt: string;
  uploadedBy: string | null;
  uploaderName: string | null;
};

const LARGO_MAXIMO_NOMBRE = 200;

/** Limpia un nombre de archivo o carpeta. Devuelve `null` si no queda nada. */
export function limpiarNombre(bruto: unknown): string | null {
  if (typeof bruto !== 'string') return null;
  // Se quitan las barras y los caracteres de control: el nombre se enseña y se
  // manda a Drive, y una barra dentro convierte «informe.pdf» en algo que
  // parece una ruta. Los guiones y los puntos se respetan: forman parte de
  // cómo llama la gente a sus archivos.
  const limpio = bruto
    .replace(/[/\\]/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!limpio || limpio === '.' || limpio === '..') return null;
  return limpio.slice(0, LARGO_MAXIMO_NOMBRE);
}

// ── Carpetas ─────────────────────────────────────────────────────────────────

/** Las carpetas que cuelgan de una, o de la raíz del espacio si es `null`. */
export function carpetasDe(workspaceId: string, parentId: string | null): Carpeta[] {
  return db.prepare(`
    SELECT id, name, parent_id AS parentId, drive_id AS driveId
    FROM drive_folders
    WHERE workspace_id = ? AND ${parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'}
    ORDER BY name COLLATE NOCASE ASC
  `).all(...(parentId === null ? [workspaceId] : [workspaceId, parentId])) as Carpeta[];
}

/** Una carpeta concreta, siempre acotada al espacio. */
export function carpeta(id: string, workspaceId: string): Carpeta | null {
  return (db.prepare(
    'SELECT id, name, parent_id AS parentId, drive_id AS driveId FROM drive_folders WHERE id = ? AND workspace_id = ?'
  ).get(id, workspaceId) as Carpeta | undefined) ?? null;
}

/**
 * El camino desde la raíz hasta una carpeta, para las migas de pan.
 *
 * Con un tope de profundidad: las carpetas apuntan a su padre y un ciclo
 * —imposible por el flujo normal, posible si alguien toca la base a mano—
 * colgaría la página en un bucle infinito.
 */
export function caminoDe(id: string | null, workspaceId: string): Carpeta[] {
  const camino: Carpeta[] = [];
  let actual = id;
  for (let i = 0; actual && i < 20; i++) {
    const c = carpeta(actual, workspaceId);
    if (!c) break;
    camino.unshift(c);
    actual = c.parentId;
  }
  return camino;
}

export type ResultadoCarpeta =
  | { ok: true; carpeta: Carpeta }
  | { ok: false; error: 'bad_name' | 'duplicate' | 'parent_not_found' };

export function crearCarpeta(datos: {
  workspaceId: string;
  parentId: string | null;
  nombre: unknown;
  driveId: string | null;
  createdBy: string;
}): ResultadoCarpeta {
  const nombre = limpiarNombre(datos.nombre);
  if (!nombre) return { ok: false, error: 'bad_name' };

  // La carpeta padre tiene que ser de este espacio: si no, se podría colgar
  // una carpeta del árbol de otro equipo mandando su id.
  if (datos.parentId && !carpeta(datos.parentId, datos.workspaceId)) {
    return { ok: false, error: 'parent_not_found' };
  }

  const nueva: Carpeta = { id: crypto.randomUUID(), name: nombre, parentId: datos.parentId, driveId: datos.driveId };
  try {
    db.prepare(
      'INSERT INTO drive_folders (id, workspace_id, parent_id, name, drive_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(nueva.id, datos.workspaceId, datos.parentId, nombre, datos.driveId, datos.createdBy);
  } catch {
    return { ok: false, error: 'duplicate' };
  }
  return { ok: true, carpeta: nueva };
}

// ── Archivos ─────────────────────────────────────────────────────────────────

/** Los archivos de una carpeta, o de la raíz del espacio. */
export function archivosDe(workspaceId: string, folderId: string | null, limite = 200): Archivo[] {
  return db.prepare(`
    SELECT f.id, f.name, f.mime_type AS mimeType, f.size_bytes AS sizeBytes,
           f.web_view_link AS webViewLink, f.drive_id AS driveId, f.folder_id AS folderId,
           f.status, f.created_at AS createdAt, f.uploaded_by AS uploadedBy,
           u.username AS uploaderName
    FROM drive_files f
    LEFT JOIN users u ON u.id = f.uploaded_by
    WHERE f.workspace_id = ? AND ${folderId === null ? 'f.folder_id IS NULL' : 'f.folder_id = ?'}
    ORDER BY f.created_at DESC
    LIMIT ?
  `).all(...(folderId === null ? [workspaceId, limite] : [workspaceId, folderId, limite])) as Archivo[];
}

export function archivo(id: string, workspaceId: string): Archivo | null {
  return (db.prepare(`
    SELECT f.id, f.name, f.mime_type AS mimeType, f.size_bytes AS sizeBytes,
           f.web_view_link AS webViewLink, f.drive_id AS driveId, f.folder_id AS folderId,
           f.status, f.created_at AS createdAt, f.uploaded_by AS uploadedBy,
           u.username AS uploaderName
    FROM drive_files f
    LEFT JOIN users u ON u.id = f.uploaded_by
    WHERE f.id = ? AND f.workspace_id = ?
  `).get(id, workspaceId) as Archivo | undefined) ?? null;
}

/**
 * Da de alta un archivo ya subido.
 *
 * Los datos vienen de preguntarle a Drive, **no** de lo que dice el navegador:
 * lo único que este manda es el id, y sin comprobarlo se podría meter en la
 * lista un archivo que no se ha subido o que ni está en la carpeta del espacio.
 */
export function registrar(datos: {
  workspaceId: string;
  folderId: string | null;
  driveId: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  webViewLink: string | null;
  uploadedBy: string;
}): { ok: true; id: string } | { ok: false; error: 'duplicate' } {
  const id = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO drive_files
        (id, workspace_id, folder_id, drive_id, name, mime_type, size_bytes, web_view_link, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, datos.workspaceId, datos.folderId, datos.driveId, datos.name,
      datos.mimeType, datos.sizeBytes, datos.webViewLink, datos.uploadedBy
    );
  } catch {
    return { ok: false, error: 'duplicate' };
  }
  return { ok: true, id };
}

/** Marca un archivo como no encontrado. No borra la fila. */
export function marcarPerdido(id: string, workspaceId: string): void {
  db.prepare("UPDATE drive_files SET status = 'missing' WHERE id = ? AND workspace_id = ?").run(id, workspaceId);
}

/** Quita el archivo de la lista de Forge. Lo de Drive lo decide quien llama. */
export function olvidar(id: string, workspaceId: string): boolean {
  return db.prepare('DELETE FROM drive_files WHERE id = ? AND workspace_id = ?').run(id, workspaceId).changes > 0;
}

/** Cuántos archivos hay en el espacio y cuánto ocupan, para poder decirlo. */
export function resumen(workspaceId: string): { total: number; bytes: number } {
  const r = db.prepare(
    "SELECT COUNT(*) AS total, COALESCE(SUM(size_bytes), 0) AS bytes FROM drive_files WHERE workspace_id = ? AND status = 'ok'"
  ).get(workspaceId) as any;
  return { total: r?.total ?? 0, bytes: r?.bytes ?? 0 };
}
