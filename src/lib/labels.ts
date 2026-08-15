import db from './db';
import crypto from 'crypto';

/**
 * Etiquetas de un espacio de trabajo.
 *
 * Las tablas existían desde hace tiempo —`labels`, `issue_labels`,
 * `page_labels`— pero no las usaba nadie: esquema muerto. Lo que faltaba era
 * todo lo demás.
 *
 * Una etiqueta es **del espacio**, no de quien la crea ni de un tablero
 * concreto: la misma «Parcial 2» sirve para un ticket del kanban y para una
 * página de apuntes, y ese es justo el punto —poder cruzar las dos cosas.
 *
 * ## El color no decide la legibilidad
 *
 * Las etiquetas se pintan con un punto del color elegido y el texto en el color
 * normal de la interfaz, no con el color de fondo. Es deliberado: con fondos de
 * color hay que calcular el contraste del texto para cada color y cada tema, y
 * en cuanto alguien elige un amarillo el texto blanco desaparece. Así el color
 * distingue, pero no puede romper la lectura.
 */

/** Los colores que se ofrecen. Cerrada a propósito: un selector libre acaba en púrpuras sobre púrpuras. */
export const COLORES = [
  '#E5484D', // rojo
  '#FF5D00', // naranja, el de la marca
  '#FFB224', // ámbar
  '#30A46C', // verde
  '#12A594', // turquesa
  '#0091FF', // azul
  '#8E4EC6', // violeta
  '#E93D82', // rosa
  '#8B8D98', // gris
] as const;

export const COLOR_POR_DEFECTO = COLORES[1];

const LARGO_MAXIMO = 40;
/** Tope por espacio. Cien etiquetas ya no se eligen, se buscan. */
const MAXIMO_POR_ESPACIO = 100;

export type TipoEntidad = 'issue' | 'page' | 'file';

/** La tabla puente y la columna de cada tipo de entidad. */
const PUENTES: Record<TipoEntidad, { tabla: string; columna: string; origen: string }> = {
  issue: { tabla: 'issue_labels', columna: 'issue_id', origen: 'issues' },
  page: { tabla: 'page_labels', columna: 'page_id', origen: 'pages' },
  // Los archivos de Drive llevan las mismas etiquetas del espacio. Ese es el
  // punto de que sean del espacio: filtrar «Parcial 2» y que salgan la tarea,
  // los apuntes y el PDF.
  file: { tabla: 'file_labels', columna: 'file_id', origen: 'drive_files' },
};

export function esTipoEntidad(valor: unknown): valor is TipoEntidad {
  return valor === 'issue' || valor === 'page' || valor === 'file';
}

export function esColor(valor: unknown): boolean {
  return typeof valor === 'string' && (COLORES as readonly string[]).includes(valor);
}

export type Etiqueta = { id: string; name: string; color: string };
export type EtiquetaConUso = Etiqueta & { usos: number };

/**
 * Las etiquetas del espacio, con cuántas cosas llevan puestas.
 *
 * El recuento va en la misma consulta: es lo que permite avisar de «esto se
 * quita de 12 tickets» antes de borrar, en vez de después.
 */
export function listar(workspaceId: string): EtiquetaConUso[] {
  return db.prepare(`
    SELECT l.id, l.name, l.color,
           (SELECT COUNT(*) FROM issue_labels il WHERE il.label_id = l.id) +
           (SELECT COUNT(*) FROM page_labels pl WHERE pl.label_id = l.id) +
           (SELECT COUNT(*) FROM file_labels fl WHERE fl.label_id = l.id) AS usos
    FROM labels l
    WHERE l.workspace_id = ?
    ORDER BY l.name COLLATE NOCASE ASC
  `).all(workspaceId) as EtiquetaConUso[];
}

export type ResultadoAlta =
  | { ok: true; etiqueta: Etiqueta }
  | { ok: false; error: 'required' | 'too_long' | 'duplicate' | 'too_many' | 'bad_color' };

export function crear(workspaceId: string, nombre: unknown, color: unknown): ResultadoAlta {
  const limpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (!limpio) return { ok: false, error: 'required' };
  if (limpio.length > LARGO_MAXIMO) return { ok: false, error: 'too_long' };
  if (color !== undefined && color !== null && !esColor(color)) return { ok: false, error: 'bad_color' };

  const cuantas = (db.prepare('SELECT COUNT(*) AS n FROM labels WHERE workspace_id = ?').get(workspaceId) as any).n;
  if (cuantas >= MAXIMO_POR_ESPACIO) return { ok: false, error: 'too_many' };

  // Se comprueba antes para poder dar un error con sentido, pero quien de
  // verdad lo impide es el índice único: entre la comprobación y el alta cabe
  // otra petición.
  const yaEsta = db.prepare(
    'SELECT 1 FROM labels WHERE workspace_id = ? AND name = ? COLLATE NOCASE'
  ).get(workspaceId, limpio);
  if (yaEsta) return { ok: false, error: 'duplicate' };

  const etiqueta = { id: crypto.randomUUID(), name: limpio, color: (color as string) || COLOR_POR_DEFECTO };
  try {
    db.prepare('INSERT INTO labels (id, workspace_id, name, color) VALUES (?, ?, ?, ?)')
      .run(etiqueta.id, workspaceId, etiqueta.name, etiqueta.color);
  } catch {
    return { ok: false, error: 'duplicate' };
  }
  return { ok: true, etiqueta };
}

export type ResultadoEdicion = { ok: true } | { ok: false; error: 'not_found' | 'required' | 'too_long' | 'duplicate' | 'bad_color' };

/** Cambia nombre y/o color. El `workspace_id` va en el WHERE: una etiqueta de otro espacio no se toca. */
export function editar(id: string, workspaceId: string, cambios: { name?: unknown; color?: unknown }): ResultadoEdicion {
  const actual = db.prepare('SELECT id, name, color FROM labels WHERE id = ? AND workspace_id = ?')
    .get(id, workspaceId) as Etiqueta | undefined;
  if (!actual) return { ok: false, error: 'not_found' };

  let nombre = actual.name;
  if (cambios.name !== undefined) {
    const limpio = typeof cambios.name === 'string' ? cambios.name.trim().replace(/\s+/g, ' ') : '';
    if (!limpio) return { ok: false, error: 'required' };
    if (limpio.length > LARGO_MAXIMO) return { ok: false, error: 'too_long' };
    nombre = limpio;
  }

  let color = actual.color;
  if (cambios.color !== undefined) {
    if (!esColor(cambios.color)) return { ok: false, error: 'bad_color' };
    color = cambios.color as string;
  }

  try {
    db.prepare('UPDATE labels SET name = ?, color = ? WHERE id = ? AND workspace_id = ?')
      .run(nombre, color, id, workspaceId);
  } catch {
    return { ok: false, error: 'duplicate' };
  }
  return { ok: true };
}

/**
 * Borra una etiqueta.
 *
 * Se lleva por CASCADE sus asignaciones, que es lo correcto: una etiqueta que
 * ya no existe no puede seguir puesta en un ticket. Lo que **no** se toca es el
 * ticket. Por eso `listar` devuelve el recuento: para poder avisar antes.
 */
export function borrar(id: string, workspaceId: string): boolean {
  return db.prepare('DELETE FROM labels WHERE id = ? AND workspace_id = ?').run(id, workspaceId).changes > 0;
}

/**
 * Comprueba que la entidad es **de este espacio**.
 *
 * Sin esto se podría poner una etiqueta propia en un ticket ajeno sabiendo su
 * id, y aparecería en el tablero de otro equipo.
 */
function esDelEspacio(tipo: TipoEntidad, entidadId: string, workspaceId: string): boolean {
  const { origen } = PUENTES[tipo];
  return Boolean(db.prepare(`SELECT 1 FROM ${origen} WHERE id = ? AND workspace_id = ?`).get(entidadId, workspaceId));
}

export type ResultadoAsignacion = { ok: true } | { ok: false; error: 'label_not_here' | 'entity_not_here' };

export function asignar(labelId: string, workspaceId: string, tipo: TipoEntidad, entidadId: string): ResultadoAsignacion {
  const suya = db.prepare('SELECT 1 FROM labels WHERE id = ? AND workspace_id = ?').get(labelId, workspaceId);
  if (!suya) return { ok: false, error: 'label_not_here' };
  if (!esDelEspacio(tipo, entidadId, workspaceId)) return { ok: false, error: 'entity_not_here' };

  const { tabla, columna } = PUENTES[tipo];
  // Poner dos veces la misma etiqueta no es un error, es no hacer nada.
  db.prepare(`INSERT OR IGNORE INTO ${tabla} (${columna}, label_id) VALUES (?, ?)`).run(entidadId, labelId);
  return { ok: true };
}

export function quitar(labelId: string, workspaceId: string, tipo: TipoEntidad, entidadId: string): ResultadoAsignacion {
  if (!esDelEspacio(tipo, entidadId, workspaceId)) return { ok: false, error: 'entity_not_here' };
  const { tabla, columna } = PUENTES[tipo];
  db.prepare(`DELETE FROM ${tabla} WHERE ${columna} = ? AND label_id = ?`).run(entidadId, labelId);
  return { ok: true };
}

/** Las etiquetas de una cosa concreta. */
export function deEntidad(tipo: TipoEntidad, entidadId: string): Etiqueta[] {
  const { tabla, columna } = PUENTES[tipo];
  return db.prepare(`
    SELECT l.id, l.name, l.color
    FROM ${tabla} x JOIN labels l ON l.id = x.label_id
    WHERE x.${columna} = ?
    ORDER BY l.name COLLATE NOCASE ASC
  `).all(entidadId) as Etiqueta[];
}

/**
 * Las etiquetas de muchas cosas a la vez.
 *
 * El tablero pinta decenas de tarjetas; pedirlas de una en una son decenas de
 * consultas por carga. Aquí van todas en una y se reparten en memoria.
 */
export function deVarias(tipo: TipoEntidad, ids: string[]): Map<string, Etiqueta[]> {
  const salida = new Map<string, Etiqueta[]>();
  if (ids.length === 0) return salida;

  const { tabla, columna } = PUENTES[tipo];
  const huecos = ids.map(() => '?').join(',');
  const filas = db.prepare(`
    SELECT x.${columna} AS entidad, l.id, l.name, l.color
    FROM ${tabla} x JOIN labels l ON l.id = x.label_id
    WHERE x.${columna} IN (${huecos})
    ORDER BY l.name COLLATE NOCASE ASC
  `).all(...ids) as Array<Etiqueta & { entidad: string }>;

  for (const f of filas) {
    if (!salida.has(f.entidad)) salida.set(f.entidad, []);
    salida.get(f.entidad)!.push({ id: f.id, name: f.name, color: f.color });
  }
  return salida;
}
