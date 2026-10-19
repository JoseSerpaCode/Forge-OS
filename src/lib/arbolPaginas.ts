import db from './db';

/**
 * El árbol de notas: dónde cuelga cada una y en qué orden.
 *
 * Hasta la migración 39 las notas salían por fecha de creación y el padre se
 * fijaba al crearlas, sin forma de cambiarlo: para meter una nota dentro de
 * otra había que crear una subpágina y copiar el contenido a mano.
 */

const PASO = 1000;

/** Posición para una nota nueva: al final de su nivel. */
export function posicionAlFinal(workspaceId: string, padreId: string | null): number {
  const fila = db
    .prepare('SELECT MAX(position) AS m FROM pages WHERE workspace_id = ? AND parent_page_id IS ?')
    .get(workspaceId, padreId) as { m: number | null };
  return (fila?.m ?? 0) + PASO;
}

export type ErrorMover = 'not_found' | 'parent_not_found' | 'cycle';
export type ResultadoMover = { ok: true } | { ok: false; error: ErrorMover };

/**
 * ¿Es `posibleDescendiente` la propia `paginaId` o algo que cuelga de ella?
 *
 * Se sube desde el candidato hacia la raíz. Con tope: una base con un ciclo ya
 * metido —que no debería existir, pero no se puede descartar en datos viejos—
 * colgaría el servidor en un bucle infinito.
 */
function cuelgaDe(posibleDescendiente: string, paginaId: string): boolean {
  const padreDe = db.prepare('SELECT parent_page_id FROM pages WHERE id = ?');
  let actual: string | null = posibleDescendiente;
  for (let i = 0; actual && i < 10_000; i++) {
    if (actual === paginaId) return true;
    actual = (padreDe.get(actual) as { parent_page_id: string | null } | undefined)?.parent_page_id ?? null;
  }
  return false;
}

/**
 * Mueve una nota bajo `padreId` (o a la raíz con `null`), en la posición
 * `indice` entre sus nuevas hermanas.
 *
 * Tres comprobaciones, las tres en el servidor porque el cliente no es de
 * fiar:
 *
 * - la nota existe **en este espacio**;
 * - el padre existe y es **del mismo espacio** — si no, una nota se podría
 *   colgar de una página ajena y aparecer en su árbol;
 * - el padre no es la nota ni algo que cuelga de ella. Meter una nota dentro
 *   de su propia hija la desengancharía del árbol entero: dejaría de salir en
 *   el índice, junto con todo lo que cuelga de ella, sin que nada se hubiera
 *   borrado.
 *
 * El nivel de destino se renumera entero. Con decenas de notas por nivel es
 * barato, y evita que las posiciones se vuelvan decimales cada vez más finos.
 */
export function moverPagina(
  workspaceId: string,
  paginaId: string,
  padreId: string | null,
  indice: number
): ResultadoMover {
  const pagina = db
    .prepare('SELECT id FROM pages WHERE id = ? AND workspace_id = ?')
    .get(paginaId, workspaceId);
  if (!pagina) return { ok: false, error: 'not_found' };

  if (padreId !== null) {
    const padre = db
      .prepare('SELECT id FROM pages WHERE id = ? AND workspace_id = ?')
      .get(padreId, workspaceId);
    if (!padre) return { ok: false, error: 'parent_not_found' };
    if (cuelgaDe(padreId, paginaId)) return { ok: false, error: 'cycle' };
  }

  const hermanas = db
    .prepare(
      `SELECT id FROM pages
       WHERE workspace_id = ? AND parent_page_id IS ? AND id != ?
       ORDER BY position, created_at, id`
    )
    .all(workspaceId, padreId, paginaId) as Array<{ id: string }>;

  const donde = Number.isFinite(indice) ? Math.min(Math.max(Math.trunc(indice), 0), hermanas.length) : hermanas.length;
  const orden = hermanas.map((h) => h.id);
  orden.splice(donde, 0, paginaId);

  const ponerPadre = db.prepare('UPDATE pages SET parent_page_id = ? WHERE id = ? AND workspace_id = ?');
  const ponerPosicion = db.prepare('UPDATE pages SET position = ? WHERE id = ? AND workspace_id = ?');

  db.transaction(() => {
    ponerPadre.run(padreId, paginaId, workspaceId);
    orden.forEach((id, i) => ponerPosicion.run((i + 1) * PASO, id, workspaceId));
  })();

  return { ok: true };
}
