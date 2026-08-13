import db from './db';
import crypto from 'crypto';

/**
 * Módulo de Recursos.
 *
 * Un recurso es algo que el equipo necesita a mano: un enlace, un archivo, una
 * nota o un fragmento de código. Lo que lo distingue de un adjunto suelto es que
 * **se comparte**: la misma URL citada en cinco issues es un recurso con cinco
 * vínculos, no cinco copias que hay que mantener a la vez.
 *
 * De ahí que la deduplicación sea el corazón del módulo, y que la clave sea una
 * URL **normalizada**: sin normalizar, `https://ejemplo.com/guia` y
 * `https://www.ejemplo.com/guia/?utm_source=slack` serían dos recursos
 * distintos, y la lista se llenaría de duplicados que nadie limpia.
 */

/** Parámetros de seguimiento que no cambian el destino. */
const PARAMS_DE_RASTREO = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src',
];

/**
 * La clave de deduplicación de una URL.
 *
 * Devuelve `null` si no es una URL http/https utilizable: un valor que no se
 * puede normalizar no debe participar en la deduplicación, porque haría chocar
 * entre sí a recursos que no tienen nada que ver.
 *
 * Lo que se normaliza, y por qué:
 *
 *  - **Esquema y host en minúsculas.** El host no distingue mayúsculas; la ruta
 *    sí, y por eso no se toca (`/Guia` y `/guia` pueden ser páginas distintas).
 *  - **Se quita `www.`**, que es un alias del mismo sitio en la práctica.
 *  - **Se quita el puerto por defecto** (80 en http, 443 en https).
 *  - **Se quitan los parámetros de rastreo** y se ordenan los demás: el mismo
 *    enlace compartido por dos canales llega con distinta cola y distinto orden.
 *  - **Se quita la barra final** salvo en la raíz.
 *  - **Se quita el fragmento** (`#seccion`): lleva a un sitio dentro del mismo
 *    documento, no a otro documento.
 */
export function normalizarUrl(bruta: unknown): string | null {
  if (typeof bruta !== 'string' || !bruta.trim()) return null;

  let u: URL;
  try {
    u = new URL(bruta.trim());
  } catch {
    return null;
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  u.hostname = u.hostname.toLowerCase();
  if (u.hostname.startsWith('www.')) u.hostname = u.hostname.slice(4);

  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
    u.port = '';
  }

  for (const p of PARAMS_DE_RASTREO) u.searchParams.delete(p);
  u.searchParams.sort();
  u.hash = '';

  let salida = u.toString();
  // La barra final sobra salvo cuando la ruta *es* la barra.
  if (salida.endsWith('/') && u.pathname !== '/') salida = salida.slice(0, -1);
  // `https://ejemplo.com/` y `https://ejemplo.com` son el mismo sitio.
  if (u.pathname === '/' && !u.search) salida = salida.replace(/\/$/, '');

  return salida;
}

export type TipoRecurso = 'link' | 'file' | 'note' | 'snippet' | 'repo';

export type NuevoRecurso = {
  workspaceId: string;
  type: TipoRecurso;
  title: string;
  description?: string | null;
  url?: string | null;
  body?: string | null;
  language?: string | null;
  createdBy: string;
};

export type Recurso = {
  id: string;
  /** Cierto si ya existía y se ha reutilizado en vez de crear un duplicado. */
  yaExistia: boolean;
};

/**
 * Da de alta un recurso, o devuelve el que ya hubiera con la misma URL.
 *
 * No lanza al encontrar un duplicado: reutilizarlo **es** el comportamiento
 * correcto. Quien pega dos veces el mismo enlace no está cometiendo un error,
 * está citando el mismo material; devolver un 409 le obligaría a buscar a mano
 * el recurso que ya existe.
 */
export function crearRecurso(datos: NuevoRecurso): Recurso {
  const urlNorm = datos.type === 'link' || datos.type === 'repo' ? normalizarUrl(datos.url) : null;

  if (urlNorm) {
    const existente = db.prepare(
      'SELECT id FROM resources WHERE workspace_id = ? AND url_normalized = ? AND archived_at IS NULL'
    ).get(datos.workspaceId, urlNorm) as any;
    if (existente) return { id: existente.id, yaExistia: true };
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO resources (id, workspace_id, type, title, description, url, url_normalized, body, language, created_by, enrich_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    datos.workspaceId,
    datos.type,
    datos.title.trim(),
    datos.description?.trim() || null,
    datos.url?.trim() || null,
    urlNorm,
    datos.body ?? null,
    datos.language ?? null,
    datos.createdBy,
    // Solo lo que tiene URL puede enriquecerse; el resto nace resuelto para no
    // quedarse esperando eternamente a una cola que nunca lo mirará.
    urlNorm ? 'pending' : 'skipped'
  );

  return { id, yaExistia: false };
}

/**
 * Ata un recurso a algo del espacio (un issue, una página, un sprint).
 *
 * `sprint_id` se guarda aquí a propósito, duplicado: permite responder «todos
 * los recursos del sprint 4» con un índice y sin cruzar tablas. El precio es
 * mantenerlo al día cuando un issue cambia de sprint.
 */
export function vincular(
  resourceId: string,
  entityType: 'issue' | 'page' | 'sprint',
  entityId: string,
  sprintId: string | null = null
) {
  db.prepare(`
    INSERT INTO resource_links (resource_id, entity_type, entity_id, sprint_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(resource_id, entity_type, entity_id) DO UPDATE SET sprint_id = excluded.sprint_id
  `).run(resourceId, entityType, entityId, sprintId);
}

/**
 * Archiva un recurso. **No lo borra.**
 *
 * Si se borrara de verdad y la URL siguiera citada en un issue, la próxima
 * ingesta automática lo recrearía: archivarlo es lo único que respeta la
 * decisión de quien lo quitó. Y como el índice de deduplicación solo mira los
 * no archivados, archivar tampoco impide volver a darlo de alta más adelante.
 */
export function archivar(resourceId: string, workspaceId: string): boolean {
  const r = db.prepare(
    'UPDATE resources SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND archived_at IS NULL'
  ).run(resourceId, workspaceId);
  return r.changes > 0;
}

/** Los recursos vivos de un espacio, del más reciente al más antiguo. */
export function listar(workspaceId: string, limite = 100) {
  return db.prepare(`
    SELECT id, type, title, description, url, site_name, favicon_url,
           mime_type, size_bytes, language, enrich_status, created_at
    FROM resources
    WHERE workspace_id = ? AND archived_at IS NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).all(workspaceId, limite);
}

/** Los recursos citados por una entidad concreta. */
export function deEntidad(entityType: string, entityId: string) {
  return db.prepare(`
    SELECT r.id, r.type, r.title, r.url, r.enrich_status
    FROM resource_links l
    JOIN resources r ON r.id = l.resource_id
    WHERE l.entity_type = ? AND l.entity_id = ? AND r.archived_at IS NULL
    ORDER BY l.created_at DESC
  `).all(entityType, entityId);
}
