import db from './db';

/**
 * Borrado permanente de una cuenta.
 *
 * El problema de fondo es que `DELETE FROM users` **no funciona** en este
 * esquema. Ocho tablas apuntan a `users` con `NO ACTION` —`issues.reporter_id`,
 * `pages.created_by`, `work_logs.user_id`, `attachments.uploaded_by`,
 * `issue_page_links.linked_by`, `messages.user_id`, `workspaces.created_by` y
 * `issues.assignee_id`—, así que con `foreign_keys` activo (lo está) el borrado
 * de cualquier cuenta que haya trabajado algo revienta con
 * «FOREIGN KEY constraint failed».
 *
 * Se podría haber puesto CASCADE en todas y acabar antes, pero eso significa que
 * quien se va de un equipo se lleva por delante los tickets que reportó y las
 * páginas que escribió, para todo el mundo. El trabajo compartido no es suyo,
 * es del espacio.
 *
 * La regla, entonces:
 *
 *  - Lo **personal** desaparece: sesiones, notificaciones, amistades, bloqueos,
 *    solicitudes y membresías. Ya estaba en CASCADE, no hace falta tocarlo.
 *  - Lo **compartido** se queda, atribuido a una cuenta lápida. El tablero del
 *    equipo no pierde su historia; solo deja de tener un nombre detrás.
 *  - Los espacios donde **no queda nadie más** se borran enteros. Son suyos y
 *    nadie podría volver a entrar.
 *  - Si es la única propietaria de un espacio **con más gente dentro**, el
 *    borrado se **detiene**. Dejar un espacio sin dueño lo convierte en algo que
 *    nadie puede administrar ni borrar; hay que traspasarlo antes.
 */

/** Cuenta a la que se reatribuye el trabajo compartido de quien se va. */
export const TOMBSTONE_ID = 'deleted-user';

export type WorkspaceRef = { id: string; name: string; sysTag: string };

export type DeletionPreview = {
  /** Espacios que se borran enteros: no queda nadie más dentro. */
  workspacesDeleted: WorkspaceRef[];
  /**
   * Espacios que **impiden** el borrado: es la única propietaria y hay más
   * gente dentro. Hay que traspasar la propiedad primero.
   */
  blocking: (WorkspaceRef & { otherMembers: number })[];
  /** Espacios de los que solo se va, sin más consecuencias. */
  membershipsLeft: number;
  /** Trabajo compartido que sobrevive, ya sin su nombre. */
  issuesReported: number;
  pagesCreated: number;
  workLogs: number;
};

/** ¿Puede llevarse a cabo el borrado tal cual está la cuenta? */
export function canDelete(preview: DeletionPreview): boolean {
  return preview.blocking.length === 0;
}

export function previewAccountDeletion(userId: string): DeletionPreview {
  const memberships = db.prepare(`
    SELECT w.id, w.name, w.sys_tag AS sysTag, wm.ws_role AS role,
           (SELECT COUNT(*) FROM workspace_members x WHERE x.workspace_id = w.id) AS members,
           (SELECT COUNT(*) FROM workspace_members o
             WHERE o.workspace_id = w.id AND o.ws_role = 'owner' AND o.user_id <> ?) AS otherOwners
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = ?
  `).all(userId, userId) as any[];

  const workspacesDeleted: WorkspaceRef[] = [];
  const blocking: (WorkspaceRef & { otherMembers: number })[] = [];
  let membershipsLeft = 0;

  for (const m of memberships) {
    const ref = { id: m.id, name: m.name, sysTag: m.sysTag };
    if (m.members <= 1) {
      workspacesDeleted.push(ref);
    } else if (m.role === 'owner' && m.otherOwners === 0) {
      blocking.push({ ...ref, otherMembers: m.members - 1 });
    } else {
      membershipsLeft++;
    }
  }

  // Los recuentos solo cubren lo que **sobrevive**. Lo que está dentro de un
  // espacio que se borra entero no se «conserva sin nombre»: desaparece, y
  // contarlo aquí daría una cifra tranquilizadora y falsa.
  const doomed = workspacesDeleted.map((w) => w.id);
  const notIn = doomed.length ? `AND workspace_id NOT IN (${doomed.map(() => '?').join(',')})` : '';
  const count = (sql: string) => (db.prepare(sql).get(userId, ...doomed) as any)?.n ?? 0;

  return {
    workspacesDeleted,
    blocking,
    membershipsLeft,
    issuesReported: count(`SELECT COUNT(*) AS n FROM issues WHERE reporter_id = ? ${notIn}`),
    pagesCreated: count(`SELECT COUNT(*) AS n FROM pages WHERE created_by = ? ${notIn}`),
    workLogs: count(
      `SELECT COUNT(*) AS n FROM work_logs WHERE user_id = ?
       ${doomed.length ? `AND issue_id NOT IN (SELECT id FROM issues WHERE workspace_id IN (${doomed.map(() => '?').join(',')}))` : ''}`
    ),
  };
}

export class AccountDeletionBlocked extends Error {
  constructor(public readonly preview: DeletionPreview) {
    super('workspace_ownership');
    this.name = 'AccountDeletionBlocked';
  }
}

function ensureTombstone() {
  // `password_hash` no es un hash de bcrypt —los de bcrypt empiezan por `$2`—,
  // así que `bcrypt.compareSync` devuelve falso contra cualquier contraseña y
  // por esta cuenta no se puede entrar. Es el mismo truco que usa el marcador
  // 'oauth' para las cuentas sin contraseña.
  db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash, is_sysadmin, is_guest, is_public)
    VALUES (?, '[cuenta eliminada]', 'deleted', 0, 0, 0)
  `).run(TOMBSTONE_ID);

  // `is_public = 0` no es decorativo: la búsqueda de personas
  // (`api/sys/state.ts`) filtra por `is_public = 1`, y con el valor por defecto
  // de la columna —que es 1— la lápida saldría en las sugerencias como si
  // fuera alguien a quien escribir. El UPDATE cubre las instalaciones donde la
  // fila ya se hubiera creado antes de este arreglo, porque el INSERT de
  // arriba, al ser OR IGNORE, no las tocaría.
  db.prepare('UPDATE users SET is_public = 0 WHERE id = ? AND is_public <> 0').run(TOMBSTONE_ID);
}

/**
 * Borra la cuenta. Lanza `AccountDeletionBlocked` si hay espacios sin otro
 * propietario, **sin tocar nada**.
 */
export function deleteAccount(userId: string): DeletionPreview {
  const preview = previewAccountDeletion(userId);
  if (!canDelete(preview)) throw new AccountDeletionBlocked(preview);

  const run = db.transaction(() => {
    ensureTombstone();

    // Primero los espacios que se van enteros: al caer, se llevan por CASCADE
    // sus issues, páginas, sprints y demás, y así el reatribuido de después no
    // tiene que tocar filas que ya no existen.
    const dropWs = db.prepare('DELETE FROM workspaces WHERE id = ?');
    for (const ws of preview.workspacesDeleted) dropWs.run(ws.id);

    // Un ticket asignado a «[cuenta eliminada]» es peor que uno sin asignar:
    // el segundo se ve en los filtros de trabajo sin dueño, el primero no.
    db.prepare('UPDATE issues SET assignee_id = NULL WHERE assignee_id = ?').run(userId);

    // El resto son columnas NOT NULL: llevan lápida, no nulo.
    for (const [table, column] of [
      ['issues', 'reporter_id'],
      ['pages', 'created_by'],
      ['work_logs', 'user_id'],
      ['attachments', 'uploaded_by'],
      ['issue_page_links', 'linked_by'],
      ['messages', 'user_id'],
      ['workspaces', 'created_by'],
    ] as const) {
      db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(TOMBSTONE_ID, userId);
    }

    // Y ahora sí. CASCADE se encarga de sesiones, notificaciones, amistades,
    // bloqueos, membresías, solicitudes y sesiones de cronómetro.
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  run();
  return preview;
}
