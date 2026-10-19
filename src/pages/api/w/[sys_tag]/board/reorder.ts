import type { APIRoute } from 'astro';
import crypto from 'crypto';
import db from '../../../../../lib/db';
import { abrirEspacio, json, cuerpo } from '../../../../../lib/apiWorkspace';
import { funciones } from '../../../../../lib/funcionesEspacio';

/**
 * Ordenar el tablero: una acción, no una vista.
 *
 * Antes «ordenar por prioridad» cambiaba solo el `ORDER BY` de la página y no
 * tocaba `position`. La razón era buena —reescribir `position` destruye el
 * orden que alguien colocó a mano— pero el precio era peor: con un orden
 * activo, lo que se veía no era lo guardado, así que arrastrar no podía
 * funcionar y el tablero pedía volver al orden manual antes de dejar mover
 * nada.
 *
 * Ahora sí se reescribe, y la objeción se resuelve de otra forma: `POST`
 * devuelve las posiciones de antes y `PUT` las restaura. El tablero ofrece
 * «Deshacer» con eso. Después de ordenar, el tablero sigue en su orden de
 * siempre y se puede arrastrar desde ahí.
 *
 * Solo las columnas de trabajo. «Hecho» va por fecha de cierre y no se ordena.
 */

const COLUMNAS = ['todo', 'in_progress', 'review'];

/**
 * El criterio de cada orden. `NULLS LAST` a mano: SQLite pone los nulos
 * primero, y ordenar por fecha empezando por las tareas **sin** fecha entierra
 * justo lo que se buscaba. La prioridad va por `CASE` y no alfabética: 'high'
 * va antes que 'low' en el diccionario y dejaría lo urgente en medio.
 */
const ORDENES: Record<string, string> = {
  priority: `CASE priority WHEN 'highest' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 WHEN 'lowest' THEN 4 ELSE 2 END ASC, position ASC`,
  due: `due_date IS NULL ASC, due_date ASC, due_time IS NULL ASC, due_time ASC, position ASC`,
  title: `title COLLATE NOCASE ASC, position ASC`,
  created: `created_at DESC, position ASC`,
  points: `story_points DESC, position ASC`,
};

const HUECO = 100000;
const MAXIMO_DESHACER = 5000;

export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'editor');
  if (error) return error;

  const datos = await cuerpo(request);
  const por = datos?.by;
  // `hasOwn` y no `in`: `'toString' in ORDENES` es cierto por la cadena de prototipos.
  if (typeof por !== 'string' || !Object.hasOwn(ORDENES, por)) return json({ error_code: 'bad_order' }, 400);

  const funcs = funciones(ws.id);
  if (por === 'points' && !funcs.puntos) return json({ error_code: 'feature_disabled', feature: 'puntos' }, 403);

  /**
   * El ámbito: la columna entera del sprint que se mira (o de todo el espacio
   * sin sprints). Con un filtro de etiqueta solo se **ordenan** las filtradas,
   * pero se renumera la columna entera: las filtradas se reparten, en su nuevo
   * orden, por los huecos que ya ocupaban, y las demás no se mueven de sitio.
   *
   * Renumerar solo las filtradas —lo que se hacía— les daba posiciones 100000,
   * 200000… que caían encima de las del resto: al quitar el filtro, la columna
   * salía entremezclada. Cada filtro se comprueba como del espacio, o un id
   * ajeno serviría para reordenar en otro.
   */
  const donde: string[] = ['workspace_id = ?', 'status = ?', 'parent_issue_id IS NULL'];
  const extra: unknown[] = [];
  let etiqueta: string | null = null;
  if (datos.label) {
    if (!db.prepare('SELECT 1 FROM labels WHERE id = ? AND workspace_id = ?').get(datos.label, ws.id)) return json({ error_code: 'bad_label' }, 400);
    etiqueta = datos.label;
  }
  if (funcs.sprints && datos.sprint) {
    if (datos.sprint === 'backlog') donde.push('sprint_id IS NULL');
    else {
      if (!db.prepare('SELECT 1 FROM sprints WHERE id = ? AND workspace_id = ?').get(datos.sprint, ws.id)) return json({ error_code: 'bad_sprint' }, 400);
      donde.push('sprint_id = ?');
      extra.push(datos.sprint);
    }
  }

  const previo: Array<{ id: string; position: number }> = [];
  const poner = db.prepare('UPDATE issues SET position = ? WHERE id = ?');
  db.transaction(() => {
    for (const estado of COLUMNAS) {
      const columna = db.prepare(
        `SELECT id, position FROM issues WHERE ${donde.join(' AND ')} ORDER BY position ASC, id ASC`
      ).all(ws.id, estado, ...extra) as Array<{ id: string; position: number }>;
      const filtro = etiqueta ? ' AND EXISTS (SELECT 1 FROM issue_labels il WHERE il.issue_id = issues.id AND il.label_id = ?)' : '';
      const ordenadas = db.prepare(
        `SELECT id FROM issues WHERE ${donde.join(' AND ')}${filtro} ORDER BY ${ORDENES[por]}, id ASC`
      ).all(ws.id, estado, ...extra, ...(etiqueta ? [etiqueta] : [])) as Array<{ id: string }>;
      const afectadas = new Set(ordenadas.map((o) => o.id));
      let siguiente = 0;
      const nueva = columna.map((f) => (afectadas.has(f.id) ? ordenadas[siguiente++].id : f.id));
      columna.forEach((f) => previo.push({ id: f.id, position: f.position }));
      nueva.forEach((id, i) => poner.run((i + 1) * HUECO, id));
    }
    db.prepare('INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), ws.id, user.id, 'BOARD_REORDERED', 'workspace', ws.id, JSON.stringify({ by: por, count: previo.length }));
  })();

  // Si son demasiadas para deshacer con seguridad, se ordena igual pero sin
  // ofrecer deshacer: mandar diez mil posiciones de vuelta no es un «deshacer».
  return json({ success: true, previo: previo.length <= MAXIMO_DESHACER ? previo : [] });
};

/** Deshacer: vuelve a poner las posiciones que devolvió el `POST`. */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'editor');
  if (error) return error;

  const datos = await cuerpo(request);
  const previo = datos?.previo;
  if (!Array.isArray(previo) || previo.length === 0 || previo.length > MAXIMO_DESHACER) return json({ error_code: 'bad_request' }, 400);
  const validas = previo.every((p: any) => p && typeof p.id === 'string' && typeof p.position === 'number' && Number.isFinite(p.position));
  if (!validas) return json({ error_code: 'bad_request' }, 400);

  // `AND workspace_id = ?`: una lista con ids de otro espacio no toca nada fuera de este.
  const poner = db.prepare('UPDATE issues SET position = ? WHERE id = ? AND workspace_id = ?');
  let tocadas = 0;
  db.transaction(() => {
    for (const p of previo) tocadas += poner.run(p.position, p.id, ws.id).changes;
  })();
  return json({ success: true, restored: tocadas });
};
