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

// ── Vínculos con tickets y páginas ───────────────────────────────────────────

/**
 * Cuelga un archivo de un ticket o de una página **y le pasa sus etiquetas**.
 *
 * La herencia es el motivo de que esto exista. Si una tarea está etiquetada
 * «Parcial 2» y se le adjunta la guía del laboratorio, la guía queda etiquetada
 * igual sin que nadie lo haga a mano — y a partir de ahí, filtrar por «Parcial
 * 2» en Archivos la encuentra.
 *
 * Se **añaden**, nunca se quitan: si el archivo ya tenía etiquetas propias, se
 * quedan. Adjuntarlo a una tarea es decir «esto también es de aquí», no «esto
 * ahora es solo de aquí».
 */
export function vincular(
  fileId: string,
  workspaceId: string,
  tipo: 'issue' | 'page',
  entidadId: string
): { ok: true; heredadas: number } | { ok: false; error: 'file_not_here' | 'entity_not_here' } {
  const suyo = db.prepare('SELECT 1 FROM drive_files WHERE id = ? AND workspace_id = ?').get(fileId, workspaceId);
  if (!suyo) return { ok: false, error: 'file_not_here' };

  const tabla = tipo === 'issue' ? 'issues' : 'pages';
  const deAqui = db.prepare(`SELECT 1 FROM ${tabla} WHERE id = ? AND workspace_id = ?`).get(entidadId, workspaceId);
  if (!deAqui) return { ok: false, error: 'entity_not_here' };

  const puente = tipo === 'issue' ? 'issue_labels' : 'page_labels';
  const columna = tipo === 'issue' ? 'issue_id' : 'page_id';

  const tx = db.transaction(() => {
    db.prepare(
      'INSERT OR IGNORE INTO drive_file_links (file_id, entity_type, entity_id) VALUES (?, ?, ?)'
    ).run(fileId, tipo, entidadId);

    // `INSERT OR IGNORE ... SELECT`: las que ya tuviera no se tocan y no hay
    // que leerlas antes para compararlas.
    return db.prepare(`
      INSERT OR IGNORE INTO file_labels (file_id, label_id)
      SELECT ?, label_id FROM ${puente} WHERE ${columna} = ?
    `).run(fileId, entidadId).changes;
  });

  return { ok: true, heredadas: tx() };
}

export function desvincular(fileId: string, workspaceId: string, tipo: 'issue' | 'page', entidadId: string): boolean {
  const suyo = db.prepare('SELECT 1 FROM drive_files WHERE id = ? AND workspace_id = ?').get(fileId, workspaceId);
  if (!suyo) return false;
  // Las etiquetas heredadas **no** se quitan: ya son suyas, y no hay forma de
  // saber cuáles vinieron de aquí sin guardar de dónde vino cada una.
  return db.prepare(
    'DELETE FROM drive_file_links WHERE file_id = ? AND entity_type = ? AND entity_id = ?'
  ).run(fileId, tipo, entidadId).changes > 0;
}

/** Los archivos colgados de un ticket o de una página. */
export function deEntidad(tipo: 'issue' | 'page', entidadId: string): Archivo[] {
  return db.prepare(`
    SELECT f.id, f.name, f.mime_type AS mimeType, f.size_bytes AS sizeBytes,
           f.web_view_link AS webViewLink, f.drive_id AS driveId, f.folder_id AS folderId,
           f.status, f.created_at AS createdAt, f.uploaded_by AS uploadedBy,
           u.username AS uploaderName
    FROM drive_file_links l
    JOIN drive_files f ON f.id = l.file_id
    LEFT JOIN users u ON u.id = f.uploaded_by
    WHERE l.entity_type = ? AND l.entity_id = ?
    ORDER BY l.created_at DESC
  `).all(tipo, entidadId) as Archivo[];
}

// ── Búsqueda ─────────────────────────────────────────────────────────────────

/**
 * Busca por nombre en todo el espacio, no solo en la carpeta abierta.
 *
 * Buscar dentro de una carpeta sería un filtro, no una búsqueda: quien busca
 * «laboratorio» no sabe en qué carpeta lo dejó, y por eso lo busca.
 *
 * `LIKE` con comodines a los dos lados. No hay índice que valga para eso, pero
 * tampoco hace falta: son los archivos de un espacio, no de la instancia.
 */
export function buscar(
  workspaceId: string,
  texto: string,
  opciones: { labelId?: string | null; limite?: number } = {}
): Archivo[] {
  const patron = `%${texto.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const filtro = opciones.labelId
    ? 'AND EXISTS (SELECT 1 FROM file_labels fl WHERE fl.file_id = f.id AND fl.label_id = ?)'
    : '';
  const params: any[] = [workspaceId, patron];
  if (opciones.labelId) params.push(opciones.labelId);
  params.push(opciones.limite ?? 100);

  return db.prepare(`
    SELECT f.id, f.name, f.mime_type AS mimeType, f.size_bytes AS sizeBytes,
           f.web_view_link AS webViewLink, f.drive_id AS driveId, f.folder_id AS folderId,
           f.status, f.created_at AS createdAt, f.uploaded_by AS uploadedBy,
           u.username AS uploaderName
    FROM drive_files f
    LEFT JOIN users u ON u.id = f.uploaded_by
    WHERE f.workspace_id = ? AND f.name LIKE ? ESCAPE '\\' ${filtro}
    ORDER BY f.created_at DESC
    LIMIT ?
  `).all(...params) as Archivo[];
}

/** Cuántas búsquedas se recuerdan por persona y espacio. */
const RECUERDOS = 10;

/**
 * Guarda una búsqueda para poder repetirla.
 *
 * Repetir una consulta la sube al principio en vez de duplicarla, y solo se
 * guardan las últimas: esto es una comodidad, no un registro de lo que la gente
 * busca. Guardarlo todo para siempre sería otra cosa, y no se ha pedido.
 */
export function recordarBusqueda(userId: string, workspaceId: string, texto: string): void {
  const limpio = texto.trim().slice(0, 100);
  if (!limpio) return;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO file_searches (id, user_id, workspace_id, query)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, workspace_id, query COLLATE NOCASE)
      DO UPDATE SET created_at = CURRENT_TIMESTAMP
    `).run(crypto.randomUUID(), userId, workspaceId, limpio);

    db.prepare(`
      DELETE FROM file_searches
      WHERE user_id = ? AND workspace_id = ? AND id NOT IN (
        SELECT id FROM file_searches
        WHERE user_id = ? AND workspace_id = ?
        ORDER BY created_at DESC LIMIT ?
      )
    `).run(userId, workspaceId, userId, workspaceId, RECUERDOS);
  });
  tx();
}

/** Las últimas búsquedas de esta persona en este espacio. */
export function busquedasRecientes(userId: string, workspaceId: string): string[] {
  return (db.prepare(`
    SELECT query FROM file_searches
    WHERE user_id = ? AND workspace_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(userId, workspaceId, RECUERDOS) as Array<{ query: string }>).map((f) => f.query);
}

/** Olvida el historial de esta persona en este espacio. */
export function olvidarBusquedas(userId: string, workspaceId: string): void {
  db.prepare('DELETE FROM file_searches WHERE user_id = ? AND workspace_id = ?').run(userId, workspaceId);
}
