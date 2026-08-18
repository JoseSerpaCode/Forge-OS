import db from './db';

/**
 * Cuando alguien entra en su cuenta desde una sesión de invitado.
 *
 * Es lo más delicado que hace este producto sin avisar: la persona ha estado
 * probando como invitado, ha creado un espacio con trabajo dentro, y ahora se
 * identifica. Hay que decidir qué se queda y qué se tira, y hacerlo mal
 * significa borrar trabajo real de alguien que acaba de registrarse.
 *
 * Estaba escrito dentro del controlador de `login.ts`, con once consultas en
 * línea y un comentario final que decía «el invitado queda huérfano para
 * limpiarse luego, o simplemente bórralo si no hay restricción». Eso no es un
 * comentario, es una duda sin resolver en la ruta de entrada.
 *
 * Las reglas, ahora explícitas:
 *
 *  - **Solo se adopta lo que la persona pidió conservar.** Nada por defecto.
 *  - **Solo si el invitado era miembro** de ese espacio: sin esa comprobación,
 *    mandar un id cualquiera en el cuerpo adoptaría un espacio ajeno.
 *  - **Se reatribuye, no se copia.** Los tickets y páginas del invitado pasan a
 *    ser de la cuenta real, con su historial.
 *  - **Lo que no se conserva se borra**, pero solo lo que el invitado **creó**;
 *    de los espacios donde le invitaron, se sale sin tocar nada de nadie.
 */

export interface ResultadoAdopcion {
  adoptados: number;
  borrados: number;
}

export function adoptarTrabajoDeInvitado(
  invitadoId: string,
  usuarioId: string,
  conservar: unknown
): ResultadoAdopcion {
  const aConservar: string[] = Array.isArray(conservar)
    ? conservar.filter((x): x is string => typeof x === 'string')
    : [];

  const esMiembro = db.prepare(
    'SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  );
  const traspasos = [
    db.prepare('UPDATE workspaces SET created_by = ? WHERE id = ? AND created_by = ?'),
    db.prepare('UPDATE issues SET reporter_id = ? WHERE reporter_id = ? AND workspace_id = ?'),
    db.prepare('UPDATE issues SET assignee_id = ? WHERE assignee_id = ? AND workspace_id = ?'),
    db.prepare('UPDATE pages SET created_by = ? WHERE created_by = ? AND workspace_id = ?'),
  ];
  const hacerMiembro = db.prepare(
    'INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)'
  );

  let adoptados = 0;
  let borrados = 0;

  /**
   * Todo en una transacción.
   *
   * Sin ella, un fallo a mitad deja el espacio con el dueño cambiado pero los
   * tickets todavía a nombre del invitado, que está a punto de borrarse. El
   * resultado sería trabajo apuntando a una cuenta que ya no existe.
   */
  db.transaction(() => {
    for (const wsId of aConservar) {
      // Sin esta comprobación, mandar un id cualquiera en el cuerpo de la
      // petición adoptaría un espacio del que el invitado no formaba parte.
      if (!esMiembro.get(wsId, invitadoId)) continue;

      // El primer traspaso lleva los argumentos en otro orden que los tres
      // siguientes; por eso van sueltos y no en un bucle ciego.
      traspasos[0].run(usuarioId, wsId, invitadoId);
      for (const t of traspasos.slice(1)) t.run(usuarioId, invitadoId, wsId);
      hacerMiembro.run(wsId, usuarioId, 'owner');
      adoptados++;
    }

    // Lo que el invitado creó y no se conserva, se va. Borrar el espacio
    // arrastra en cascada sus tickets, sprints y páginas.
    const suyos = db
      .prepare('SELECT id FROM workspaces WHERE created_by = ?')
      .all(invitadoId) as Array<{ id: string }>;

    const borrar = db.prepare('DELETE FROM workspaces WHERE id = ?');
    for (const w of suyos) {
      if (!aConservar.includes(w.id)) {
        borrar.run(w.id);
        borrados++;
      }
    }

    // Y se sale de aquellos a los que solo estaba invitado, sin tocar su
    // contenido: ahí no hay nada suyo que adoptar ni que borrar.
    db.prepare('DELETE FROM workspace_members WHERE user_id = ?').run(invitadoId);
  })();

  return { adoptados, borrados };
}
