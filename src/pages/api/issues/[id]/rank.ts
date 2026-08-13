import type { APIRoute } from 'astro';
import db from '../../../../lib/db';
import { checkWorkspaceAccess } from '../../../../lib/guard';

/**
 * Reordenar un ticket dentro del backlog.
 *
 * La posición **la calcula el servidor**. El cliente dice entre qué dos tickets
 * quiere dejarlo (`before_id` / `after_id`) y aquí se decide el número. Aceptar
 * una `position` del cliente sería dejarle escribir directamente en la columna
 * que gobierna el orden: bastaría con mandar un número cualquiera para colar un
 * ticket donde no le toca, o para dejar el backlog de otro equipo desordenado.
 *
 * El hueco entre posiciones es de 100000 justamente para poder insertar en
 * medio muchas veces sin tocar nada más. Pero un `REAL` no da para siempre:
 * partiendo el hueco por la mitad una y otra vez se llega al límite de la doble
 * precisión, y a partir de ahí dos tickets empiezan a compartir posición. Por
 * eso, cuando el hueco se queda por debajo del mínimo, se reindexa la columna
 * entera y se sigue.
 */

/** Separación con la que se reparten las posiciones al reindexar. */
const PASO = 100_000;

/**
 * Por debajo de esta distancia, insertar en medio deja de ser fiable.
 *
 * No es un número mágico: con separaciones más pequeñas, la media de dos
 * vecinos deja de caer estrictamente entre ellos en coma flotante, y el orden
 * pasa a depender del desempate. Antes de llegar ahí se reindexa.
 */
const HUECO_MINIMO = 0.001;

type Vecino = { id: string; position: number } | undefined;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  const user = locals.user!;
  if (!id) return new Response('Bad Request', { status: 400 });

  try {
    const { before_id, after_id } = await request.json();

    const issue = db
      .prepare('SELECT id, workspace_id, sprint_id, status FROM issues WHERE id = ?')
      .get(id) as any;
    if (!issue) return new Response('Not Found', { status: 404 });

    const access = checkWorkspaceAccess(user.id, user.is_sysadmin, issue.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') return new Response('Not Found', { status: 404 });
      return new Response(access.error, { status: 403 });
    }

    // Los vecinos tienen que estar en la misma lista que el ticket que se
    // mueve. Sin esta comprobación se podría pedir «déjalo entre dos tickets de
    // otro sprint» y el número resultante no significaría nada en su columna.
    const mismaLista = (v: any) =>
      v && v.workspace_id === issue.workspace_id && (v.sprint_id ?? null) === (issue.sprint_id ?? null);

    const traer = (vid: unknown): Vecino => {
      if (typeof vid !== 'string' || !vid) return undefined;
      const v = db
        .prepare('SELECT id, position, workspace_id, sprint_id FROM issues WHERE id = ?')
        .get(vid) as any;
      return mismaLista(v) ? { id: v.id, position: v.position } : undefined;
    };

    const anterior = traer(before_id);
    const siguiente = traer(after_id);

    if (before_id && !anterior) {
      return new Response(JSON.stringify({ error_code: 'bad_neighbour' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (after_id && !siguiente) {
      return new Response(JSON.stringify({ error_code: 'bad_neighbour' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const nuevaPosicion = calcular(anterior, siguiente, issue);
    db.prepare('UPDATE issues SET position = ? WHERE id = ?').run(nuevaPosicion, id);

    return new Response(JSON.stringify({ success: true, position: nuevaPosicion }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

function calcular(anterior: Vecino, siguiente: Vecino, issue: any): number {
  // Al principio de la lista.
  if (!anterior && siguiente) return siguiente.position - PASO;
  // Al final.
  if (anterior && !siguiente) return anterior.position + PASO;
  // Lista vacía o sin referencias: se va al final de todo.
  if (!anterior && !siguiente) {
    const ultimo = db
      .prepare(
        `SELECT position FROM issues
         WHERE workspace_id = ? AND (sprint_id IS ? OR sprint_id = ?)
         ORDER BY position DESC LIMIT 1`
      )
      .get(issue.workspace_id, issue.sprint_id ?? null, issue.sprint_id ?? null) as any;
    return (ultimo?.position ?? 0) + PASO;
  }

  // En medio: la mitad del hueco, salvo que el hueco ya no dé más de sí.
  const hueco = siguiente!.position - anterior!.position;
  if (hueco > HUECO_MINIMO) return anterior!.position + hueco / 2;

  // Se agotó la precisión: se reparte la columna de nuevo y se recalcula.
  reindexar(issue.workspace_id, issue.sprint_id ?? null);
  const a = db.prepare('SELECT position FROM issues WHERE id = ?').get(anterior!.id) as any;
  const b = db.prepare('SELECT position FROM issues WHERE id = ?').get(siguiente!.id) as any;
  return a.position + (b.position - a.position) / 2;
}

/**
 * Vuelve a repartir las posiciones de una lista con la separación completa.
 *
 * Se conserva el orden visible: se leen por `position` y se reescriben con
 * huecos regulares. Nadie ve nada moverse; lo único que cambia son los números.
 */
export function reindexar(workspaceId: string, sprintId: string | null) {
  const filas = db
    .prepare(
      `SELECT id FROM issues
       WHERE workspace_id = ? AND (sprint_id IS ? OR sprint_id = ?)
       ORDER BY position ASC, rowid ASC`
    )
    .all(workspaceId, sprintId, sprintId) as Array<{ id: string }>;

  const escribir = db.prepare('UPDATE issues SET position = ? WHERE id = ?');
  const tx = db.transaction(() => {
    filas.forEach((f, i) => escribir.run((i + 1) * PASO, f.id));
  });
  tx();
}
