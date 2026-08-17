import db from './db';
import crypto from 'crypto';
import { COLORES, COLOR_POR_DEFECTO, esColor } from './labels';

/**
 * Tipos de ticket de un espacio.
 *
 * Antes eran tres, escritos a mano en cuatro sitios distintos —el desplegable
 * del tablero, el del modal, la insignia de la tarjeta y una `CHECK` en la base
 * de datos— y no había forma de tocarlos. Un equipo de mantenimiento no tiene
 * «historias»; tiene «incidencias», «preventivos» y «garantías», y llamarlos
 * «task» a todos convierte el tipo en una columna que no dice nada.
 *
 * ## El alcance es el espacio
 *
 * Un tipo describe cómo trabaja un equipo, así que pertenece al espacio y no a
 * la cuenta de quien lo crea. Si fuera de la persona, sus tipos aparecerían en
 * el tablero de equipos que no los usan, y al borrarse esa cuenta el espacio se
 * quedaría con tickets de un tipo que ya no existe para nadie.
 *
 * ## La clave y el nombre son cosas distintas
 *
 * `issues.type` guarda la **clave** (`task`, `incidencia`), no el id de la
 * fila. Por eso renombrar «Task» a «Tarea» no toca ni un ticket, y por eso los
 * tickets que ya existían siguieron funcionando el día que esto se añadió.
 *
 * Los cuatro de fábrica llevan `is_builtin = 1` y su nombre se traduce; los
 * propios no, porque los escribió alguien y traducir lo que escribió una
 * persona es inventárselo.
 */

export { COLORES, COLOR_POR_DEFECTO };

export interface TipoTicket {
  id: string;
  key: string;
  name: string;
  color: string;
  position: number;
  isBuiltin: boolean;
}

const LARGO_MAXIMO = 30;
/** Un desplegable de más de veinte entradas ya no se elige: se busca. */
const MAXIMO_POR_ESPACIO = 20;

export type ResultadoAlta =
  | { ok: true; tipo: TipoTicket }
  | { ok: false; error: 'nombre_vacio' | 'nombre_largo' | 'color_invalido' | 'repetido' | 'demasiados' };

export type ResultadoBaja =
  | { ok: true; movidos: number }
  | { ok: false; error: 'no_existe' | 'ultimo' | 'en_uso' | 'sustituto_invalido'; enUso?: number };

/**
 * De «Incidencia crítica» a `incidencia-critica`.
 *
 * Se quitan los acentos para que la clave sea ASCII: acaba en URLs de filtro y
 * en atributos `data-*`, y un `data-type=incidencia-crítica` funciona hasta que
 * alguien lo compara con una cadena escrita en otro teclado.
 *
 * Si al final no queda nada —un nombre solo de emojis o de signos— se usa un
 * identificador aleatorio en vez de una clave vacía, que chocaría con la
 * siguiente igual de vacía.
 */
export function claveDesdeNombre(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return base || `tipo-${crypto.randomUUID().slice(0, 8)}`;
}

function aTipo(fila: any): TipoTicket {
  return {
    id: fila.id,
    key: fila.key,
    name: fila.name,
    color: fila.color,
    position: fila.position,
    isBuiltin: fila.is_builtin === 1,
  };
}

/**
 * Los tipos de un espacio, en su orden.
 *
 * Un espacio creado antes de que esto existiera no tiene ninguno: la migración
 * sembró los de fábrica en los que había entonces, pero no en los que se creen
 * después si el alta no los siembra. Aquí se siembra al vuelo en ese caso, en
 * vez de devolver una lista vacía que dejaría el desplegable del tablero sin
 * una sola opción y haría imposible crear un ticket.
 */
export function listar(workspaceId: string): TipoTicket[] {
  const filas = db.prepare(
    'SELECT * FROM issue_types WHERE workspace_id = ? ORDER BY position, name COLLATE NOCASE'
  ).all(workspaceId) as any[];

  if (filas.length > 0) return filas.map(aTipo);

  sembrarDeFabrica(workspaceId);
  return (db.prepare(
    'SELECT * FROM issue_types WHERE workspace_id = ? ORDER BY position, name COLLATE NOCASE'
  ).all(workspaceId) as any[]).map(aTipo);
}

/** Los cuatro de siempre, para un espacio que todavía no tiene ninguno. */
export function sembrarDeFabrica(workspaceId: string): void {
  const DE_FABRICA = [
    { key: 'task', name: 'Task', color: '#0091FF' },
    { key: 'bug', name: 'Bug', color: '#E5484D' },
    { key: 'story', name: 'Story', color: '#30A46C' },
    { key: 'epic', name: 'Epic', color: '#8E4EC6' },
  ];
  const insertar = db.prepare(`
    INSERT OR IGNORE INTO issue_types (id, workspace_id, key, name, color, position, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  db.transaction(() => {
    DE_FABRICA.forEach((t, i) => insertar.run(`${workspaceId}:${t.key}`, workspaceId, t.key, t.name, t.color, i));
  })();
}

export function crear(workspaceId: string, nombre: unknown, color: unknown): ResultadoAlta {
  const limpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (!limpio) return { ok: false, error: 'nombre_vacio' };
  if (limpio.length > LARGO_MAXIMO) return { ok: false, error: 'nombre_largo' };

  const tono = typeof color === 'string' && esColor(color) ? color : COLOR_POR_DEFECTO;

  const cuantos = (db.prepare('SELECT COUNT(*) AS n FROM issue_types WHERE workspace_id = ?')
    .get(workspaceId) as any).n as number;
  if (cuantos >= MAXIMO_POR_ESPACIO) return { ok: false, error: 'demasiados' };

  // Dos tipos con el mismo nombre son dos tipos indistinguibles en el
  // desplegable. Se compara sin distinguir mayúsculas: «Incidencia» e
  // «incidencia» son el mismo para quien mira.
  const yaEsta = db.prepare(
    'SELECT 1 FROM issue_types WHERE workspace_id = ? AND name = ? COLLATE NOCASE'
  ).get(workspaceId, limpio);
  if (yaEsta) return { ok: false, error: 'repetido' };

  // La clave puede chocar aunque el nombre no: «Cosa-1» y «Cosa 1» dan la
  // misma. Se numera hasta encontrar una libre en vez de fallar, porque el
  // choque es de un detalle interno que quien escribe el nombre no ve.
  const base = claveDesdeNombre(limpio);
  let clave = base;
  for (let n = 2; db.prepare('SELECT 1 FROM issue_types WHERE workspace_id = ? AND key = ?').get(workspaceId, clave); n++) {
    clave = `${base}-${n}`;
  }

  const siguiente = ((db.prepare('SELECT MAX(position) AS p FROM issue_types WHERE workspace_id = ?')
    .get(workspaceId) as any).p ?? -1) + 1;

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO issue_types (id, workspace_id, key, name, color, position, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(id, workspaceId, clave, limpio, tono, siguiente);

  return { ok: true, tipo: { id, key: clave, name: limpio, color: tono, position: siguiente, isBuiltin: false } };
}

export function editar(
  id: string,
  workspaceId: string,
  cambios: { name?: unknown; color?: unknown }
): ResultadoAlta | { ok: false; error: 'no_existe' } {
  const actual = db.prepare('SELECT * FROM issue_types WHERE id = ? AND workspace_id = ?')
    .get(id, workspaceId) as any;
  if (!actual) return { ok: false, error: 'no_existe' };

  let nombre = actual.name as string;
  if (cambios.name !== undefined) {
    const limpio = typeof cambios.name === 'string' ? cambios.name.trim().replace(/\s+/g, ' ') : '';
    if (!limpio) return { ok: false, error: 'nombre_vacio' };
    if (limpio.length > LARGO_MAXIMO) return { ok: false, error: 'nombre_largo' };
    const choca = db.prepare(
      'SELECT 1 FROM issue_types WHERE workspace_id = ? AND name = ? COLLATE NOCASE AND id != ?'
    ).get(workspaceId, limpio, id);
    if (choca) return { ok: false, error: 'repetido' };
    nombre = limpio;
  }

  let color = actual.color as string;
  if (cambios.color !== undefined) {
    if (typeof cambios.color !== 'string' || !esColor(cambios.color)) return { ok: false, error: 'color_invalido' };
    color = cambios.color;
  }

  /**
   * La clave **no** se toca al renombrar.
   *
   * Es la que llevan escrita todos los tickets del espacio en `issues.type`.
   * Regenerarla al cambiar el nombre dejaría cada ticket apuntando a un tipo
   * que ya no existe: el tablero seguiría cargando y las tarjetas saldrían sin
   * insignia, sin un solo error por ninguna parte.
   *
   * Que un tipo llamado «Incidencia» tenga la clave `bug` es feo por dentro y
   * no se nota por fuera. Perder el tipo de mil tickets sí se nota.
   */
  db.prepare('UPDATE issue_types SET name = ?, color = ? WHERE id = ?').run(nombre, color, id);
  return { ok: true, tipo: { ...aTipo(actual), name: nombre, color } };
}

/**
 * Borrar un tipo.
 *
 * Aquí está la decisión que no puede quedarse a medias: **qué pasa con los
 * tickets que ya son de ese tipo**. Las tres salidas posibles y por qué solo
 * una vale:
 *
 *  - *Borrarlos con el tipo* — descabellado: se pierde trabajo real por
 *    reorganizar un desplegable.
 *  - *Dejarlos apuntando a una clave muerta* — el tablero carga igual y las
 *    tarjetas se quedan sin insignia. Nadie se entera hasta que alguien filtra
 *    por tipo y no aparecen.
 *  - *Reasignarlos a otro tipo, dicho en voz alta* — es lo que se hace.
 *
 * Si el tipo está en uso hace falta un sustituto explícito. Sin él se devuelve
 * cuántos hay, para poder preguntar con el número delante en vez de con un
 * «puede que afecte a algunos tickets».
 */
export function borrar(id: string, workspaceId: string, sustitutoKey?: string): ResultadoBaja {
  const tipo = db.prepare('SELECT * FROM issue_types WHERE id = ? AND workspace_id = ?')
    .get(id, workspaceId) as any;
  if (!tipo) return { ok: false, error: 'no_existe' };

  // Un espacio sin ningún tipo no puede crear tickets: el desplegable se queda
  // sin opciones y el formulario no tiene nada que enviar.
  const total = (db.prepare('SELECT COUNT(*) AS n FROM issue_types WHERE workspace_id = ?')
    .get(workspaceId) as any).n as number;
  if (total <= 1) return { ok: false, error: 'ultimo' };

  const enUso = (db.prepare('SELECT COUNT(*) AS n FROM issues WHERE workspace_id = ? AND type = ?')
    .get(workspaceId, tipo.key) as any).n as number;

  if (enUso > 0) {
    if (!sustitutoKey) return { ok: false, error: 'en_uso', enUso };
    const sustituto = db.prepare('SELECT key FROM issue_types WHERE workspace_id = ? AND key = ? AND id != ?')
      .get(workspaceId, sustitutoKey, id) as any;
    if (!sustituto) return { ok: false, error: 'sustituto_invalido' };

    db.transaction(() => {
      db.prepare('UPDATE issues SET type = ? WHERE workspace_id = ? AND type = ?')
        .run(sustituto.key, workspaceId, tipo.key);
      db.prepare('DELETE FROM issue_types WHERE id = ?').run(id);
    })();
    return { ok: true, movidos: enUso };
  }

  db.prepare('DELETE FROM issue_types WHERE id = ?').run(id);
  return { ok: true, movidos: 0 };
}

/** Reordenar. El orden es el del desplegable, y lo más usado va arriba. */
export function reordenar(workspaceId: string, idsEnOrden: string[]): boolean {
  const suyos = new Set(
    (db.prepare('SELECT id FROM issue_types WHERE workspace_id = ?').all(workspaceId) as any[]).map((f) => f.id)
  );
  // Un id de otro espacio colado en la lista movería un tipo ajeno.
  if (idsEnOrden.some((id) => !suyos.has(id))) return false;

  const actualizar = db.prepare('UPDATE issue_types SET position = ? WHERE id = ? AND workspace_id = ?');
  db.transaction(() => {
    idsEnOrden.forEach((id, i) => actualizar.run(i, id, workspaceId));
  })();
  return true;
}

/**
 * El tipo de una clave, para pintar una tarjeta.
 *
 * Devuelve `null` si la clave no corresponde a ningún tipo del espacio. Pasa
 * con tickets viejos de un tipo que se borró antes de que el borrado exigiera
 * sustituto; quien pinta debe enseñar la clave cruda en vez de nada, que es
 * información aunque sea fea.
 */
export function porClave(workspaceId: string, clave: string): TipoTicket | null {
  const fila = db.prepare('SELECT * FROM issue_types WHERE workspace_id = ? AND key = ?')
    .get(workspaceId, clave) as any;
  return fila ? aTipo(fila) : null;
}

/** Todos los tipos de un espacio indexados por clave, para pintar un tablero sin una consulta por tarjeta. */
export function mapaPorClave(workspaceId: string): Map<string, TipoTicket> {
  return new Map(listar(workspaceId).map((t) => [t.key, t]));
}
