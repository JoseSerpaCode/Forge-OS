import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import db from '../../../../../lib/db';
import { abrirEspacio, json } from '../../../../../lib/apiWorkspace';
import { validarImportacion } from '../../../../../lib/importarTabla';

/**
 * Crear una tabla con sus filas desde un archivo (CSV o Excel).
 *
 * El archivo se lee en el navegador —ahí se elige la hoja y se ajustan los
 * tipos— y aquí llegan nombre, columnas y filas. Se valida todo con las mismas
 * reglas que la vista previa (`validarImportacion`) y se escribe en una sola
 * transacción: o queda la tabla con todas sus filas, o no queda nada.
 */
const MAX_CUERPO = 8 * 1024 * 1024;

export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user!;
  const { ws, error } = abrirEspacio(params.sys_tag, user, 'editor');
  if (error) return error;

  if (Number(request.headers.get('content-length') || 0) > MAX_CUERPO) return json({ error_code: 'too_large' }, 413);
  const crudo = await request.text();
  if (crudo.length > MAX_CUERPO) return json({ error_code: 'too_large' }, 413);
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return json({ error_code: 'bad_json' }, 400);
  }

  const r = validarImportacion(cuerpo);
  if ('error_code' in r) return json(r, 400);

  // Los ids de columna los pone el servidor, como al crear una tabla a mano.
  const columnas = r.columnas.map((c) => ({ id: `col_${crypto.randomUUID().split('-')[0]}`, ...c }));
  const dbId = crypto.randomUUID();

  db.transaction(() => {
    db.prepare('INSERT INTO dynamic_databases (id, workspace_id, name, sys_tag, schema_json) VALUES (?, ?, ?, ?, ?)')
      .run(dbId, ws.id, r.name, ws.sys_tag, JSON.stringify({ columns: columnas }));
    db.prepare("INSERT INTO dynamic_views (id, database_id, name, type, visible_columns_json) VALUES (?, ?, 'Default Table', 'table', ?)")
      .run(crypto.randomUUID(), dbId, JSON.stringify(columnas.map((c) => c.id)));
    const fila = db.prepare('INSERT INTO dynamic_entries (id, database_id, payload_json, created_by) VALUES (?, ?, ?, ?)');
    for (const valores of r.filas) {
      const payload = Object.fromEntries(columnas.map((c, i) => [c.id, valores[i]]));
      fila.run(crypto.randomUUID(), dbId, JSON.stringify(payload), user.id);
    }
  })();

  return json({ id: dbId, filas: r.filas.length }, 201);
};
