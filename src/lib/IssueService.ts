import db from '../lib/db';
import { checkWorkspaceAccess } from '../lib/guard';
import type { Issue } from '../types/db';
import { NotificationService } from './NotificationService';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { STORAGE_DIR } from './storage';
import { finalizeIssueSessions } from './sesionesTiempo';
import { ApiError } from './errors';
import { escaparLike } from './texto';

export { ApiError } from './errors';
import { esPrioridad } from './prioridad';
import { esPaginaDelEspacio, vincular } from './apuntes';
import { esRegla, siguiente as siguienteFecha } from './recurrencia';
import { hoyEn, diaDeCalendario } from './fechas';

/**
 * El fragmento de `SET` que mantiene `done_at` al cambiar el estado.
 *
 * Entrar en Hecho pone la hora; quedarse en Hecho no la toca (editar una tarea
 * terminada no la vuelve «recién terminada»); salir de Hecho la borra. Dentro
 * de un `UPDATE`, `status` es el valor **anterior**, que es justo lo que hace
 * falta para distinguir «entra» de «ya estaba».
 *
 * Lo usan los dos caminos que cambian el estado —`update()` y `move.ts`—. Si
 * hubiera un tercero, tiene que usar esto: con dos copias, una acabaría
 * olvidándose de borrar la fecha al reabrir.
 *
 * Lleva un parámetro: el estado nuevo.
 */
export const SET_DONE_AT =
  "done_at = CASE WHEN ? = 'done' THEN (CASE WHEN status = 'done' AND done_at IS NOT NULL THEN done_at ELSE CURRENT_TIMESTAMP END) ELSE NULL END";

/** `AAAA-MM-DD` de un día que existe. */
export const esDia = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && diaDeCalendario(v) === v;

/** `HH:MM` válido o vacío. La `CHECK` de la base también lo exige; esto da un 400 en vez de un 500. */
export const esHora = (v: unknown) => v === null || v === '' || (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v));

export class IssueService {
  /**
   * Retrieves an issue by ID.
   */
  static async getById(issueId: string) {
    return db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
  }

  /**
   * Updates an issue dynamically. Solves the N+1 problem.
   */
  static async update(
    issueId: string, 
    data: Partial<Issue>, 
    userId: string, 
    isSysadmin: number,
    username: string
  ) {
    // El título entra en la consulta porque lo usa el aviso de asignación: sin
    // él, el mensaje solo podía enseñar un trozo del identificador.
    const issue = db.prepare('SELECT id, workspace_id, title FROM issues WHERE id = ?').get(issueId) as Pick<Issue, 'id' | 'workspace_id' | 'title'> | undefined;
    if (!issue) throw new ApiError(404, 'Issue Not Found');

    const access = checkWorkspaceAccess(userId, isSysadmin, issue.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Issue Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }

    // Whitelist allowed fields to prevent SQL injection via keys
    const allowedFields = ['title', 'description', 'status', 'priority', 'story_points', 'estimated_hours', 'type', 'assignee_id', 'sprint_id', 'position', 'due_date', 'due_time', 'recurrence', 'planned_date'];

    // Validar antes de escribir: la `CHECK` de la base rechazaría lo mismo,
    // pero con un 500 que no dice qué campo estaba mal.
    if ('priority' in data && !esPrioridad(data.priority)) throw new ApiError(400, 'Invalid priority');
    if ('due_time' in data && !esHora((data as any).due_time)) throw new ApiError(400, 'Invalid due_time');
    if ((data as any).due_time === '') (data as any).due_time = null;
    if ('planned_date' in data) {
      const dia = (data as any).planned_date;
      if (dia === '' || dia === null) (data as any).planned_date = null;
      else if (!esDia(dia)) throw new ApiError(400, 'Invalid planned_date');
    }
    if ('recurrence' in data) {
      const regla = (data as any).recurrence;
      if (regla === '' || regla === null) (data as any).recurrence = null;
      else if (!esRegla(regla)) throw new ApiError(400, 'Invalid recurrence');
      else {
        // Una regla sin fecha no tiene de dónde contar.
        const fecha = 'due_date' in data ? data.due_date : (db.prepare('SELECT due_date FROM issues WHERE id = ?').get(issueId) as any)?.due_date;
        if (!fecha) throw new ApiError(400, 'Recurrence needs a due date');
      }
    }
    const estadoAntes = 'status' in data
      ? (db.prepare('SELECT status FROM issues WHERE id = ?').get(issueId) as any)?.status
      : undefined;
    const safeData: any = {};
    for (const key of Object.keys(data)) {
      if (allowedFields.includes(key)) {
        safeData[key] = data[key as keyof Partial<Issue>];
      }
    }

    const keys = Object.keys(safeData);
    if (keys.length === 0) return { success: true };

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = Object.values(safeData);

    // Add updated_at, y `done_at` si cambia el estado.
    let finalClause = `${setClause}, updated_at = CURRENT_TIMESTAMP`;
    if ('status' in safeData) {
      finalClause += `, ${SET_DONE_AT}`;
      values.push(safeData.status);
    }
    values.push(issueId); // for WHERE id = ?

    db.prepare(`UPDATE issues SET ${finalClause} WHERE id = ?`).run(...values);
    if (estadoAntes !== undefined) IssueService.trasCambioDeEstado(issueId, estadoAntes, safeData.status, userId);

    // Automation logic could be hooked here (EventEmitter pattern)
    
    // Auto-stop time tracker on done
    if (safeData.status === 'done' || safeData.status === 'review') {
      finalizeIssueSessions(issueId, 'Auto-registrado al completar');
    }

    // Assignee Notification Hook
    if (data.assignee_id !== undefined && data.assignee_id !== null && data.assignee_id !== userId) {
      const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(issue.workspace_id) as any;
      if (ws) {
        // El título, no ocho caracteres del identificador: «te han asignado
        // 3f2a1b9c» no dice qué hay que hacer, y obliga a abrir el enlace solo
        // para saber si importa.
        NotificationService.notify(
          data.assignee_id,
          'assign',
          'Te han asignado un ticket',
          `${username}: ${data.title ?? issue.title ?? ''}`,
          `/w/${ws.sys_tag}/board?issue=${issueId}`
        );
      }
    }

    return { success: true };
  }

  static async delete(issueId: string, userId: string, isSysadmin: number) {
    const issue = db.prepare('SELECT id, workspace_id FROM issues WHERE id = ?').get(issueId) as Pick<Issue, 'id' | 'workspace_id'> | undefined;
    if (!issue) throw new ApiError(404, 'Issue Not Found');

    const access = checkWorkspaceAccess(userId, isSysadmin, issue.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Issue Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }

    IssueService.borrarSinComprobar([issueId]);
    return { success: true };
  }

  /**
   * Subtareas: pasos dentro de una tarea, en su panel.
   *
   * Tres reglas que no se ven en el esquema:
   * - **Un solo nivel.** Una subtarea no tiene subtareas: el panel enseña una
   *   lista, no un árbol, y un árbol en un tablero personal es organizar por
   *   organizar.
   * - **Del espacio de su madre**, siempre. El espacio se copia de la madre y no
   *   se acepta del cliente.
   * - **Fuera de los sprints** (`sprint_id` NULL). Así ninguna cuenta de sprint
   *   las incluye; las listas del espacio las excluyen con
   *   `parent_issue_id IS NULL`.
   */
  static listarSubtareas(madreId: string) {
    return db.prepare(`
      SELECT id, title, status, position FROM issues
      WHERE parent_issue_id = ? ORDER BY position ASC, created_at ASC
    `).all(madreId) as Array<{ id: string; title: string; status: string; position: number }>;
  }

  static crearSubtarea(madreId: string, titulo: unknown, userId: string, isSysadmin: number) {
    const madre = db.prepare('SELECT id, workspace_id, parent_issue_id, type FROM issues WHERE id = ?').get(madreId) as any;
    if (!madre) throw new ApiError(404, 'Issue Not Found');
    const access = checkWorkspaceAccess(userId, isSysadmin, madre.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Issue Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }
    if (madre.parent_issue_id) throw new ApiError(400, 'Subtasks cannot have subtasks');
    const limpio = typeof titulo === 'string' ? titulo.trim().slice(0, 200) : '';
    if (!limpio) throw new ApiError(400, 'Title is required');

    const ultima = db.prepare('SELECT MAX(position) AS p FROM issues WHERE parent_issue_id = ?').get(madreId) as any;
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO issues (id, workspace_id, sprint_id, parent_issue_id, type, title, status, reporter_id, position)
      VALUES (?, ?, NULL, ?, ?, ?, 'todo', ?, ?)
    `).run(id, madre.workspace_id, madreId, madre.type || 'task', limpio, userId, (ultima?.p ?? 0) + 100000);
    return { id, title: limpio, status: 'todo' };
  }

  /**
   * Lo que pasa al cambiar el estado de una tarea, sea por el camino que sea
   * (`update()` o `move.ts`): las tareas que se repiten.
   *
   * - **Entrar en Hecho** con regla y sin siguiente: se crea la siguiente con la
   *   fecha que toca y la regla **pasa** a ella. Cada ocurrencia es una tarea,
   *   para que Hecho cuente la verdad; la completada se queda sin regla y no
   *   genera nada si se reabre y se vuelve a cerrar. Comprobar
   *   `next_issue_id IS NULL` aquí es lo que impide que un doble clic cree dos.
   * - **Salir de Hecho** con siguiente: si nadie la ha tocado (sin cambios ni
   *   horas), se borra y la regla vuelve. Si ya se tocó, se queda.
   *
   * Devuelve lo que pasó, para que la interfaz lo diga.
   */
  static trasCambioDeEstado(issueId: string, antes: string | undefined, despues: string, userId: string, ahora: Date = new Date()):
    { creada?: { id: string; due_date: string }; deshecha?: boolean; conservada?: boolean } {
    if (antes === despues) return {};
    const t = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId) as any;
    if (!t) return {};

    if (despues === 'done' && t.recurrence && !t.next_issue_id && t.due_date) {
      // «Hoy» es el de quien la completa, no el del servidor (que corre en
      // UTC): una diaria completada a las 21:00 en Bogotá es del día de Bogotá.
      const zona = (db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as any)?.timezone;
      const fecha = siguienteFecha(t.recurrence, String(t.due_date).slice(0, 10), hoyEn(zona, ahora));
      if (!fecha) return {};
      // Si se planificaba hacerla unos días antes de la entrega, la siguiente
      // conserva esa misma distancia.
      let planificada: string | null = null;
      if (t.planned_date) {
        const dias = (Date.parse(`${String(t.due_date).slice(0, 10)}T00:00:00Z`) - Date.parse(`${t.planned_date}T00:00:00Z`)) / 86_400_000;
        planificada = new Date(Date.parse(`${fecha}T00:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
      }
      const id = crypto.randomUUID();
      db.transaction(() => {
        // Un sprint cerrado no recibe trabajo nuevo.
        const sprint = t.sprint_id ? db.prepare('SELECT status FROM sprints WHERE id = ?').get(t.sprint_id) as any : null;
        const sprintId = sprint && sprint.status !== 'completed' ? t.sprint_id : null;
        const ultima = db.prepare("SELECT MAX(position) AS p FROM issues WHERE workspace_id = ? AND status = 'todo'").get(t.workspace_id) as any;
        db.prepare(`
          INSERT INTO issues (id, workspace_id, sprint_id, type, title, description, status, priority, story_points,
                              estimated_hours, reporter_id, assignee_id, position, due_date, due_time, recurrence, planned_date)
          VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, t.workspace_id, sprintId, t.type, t.title, t.description, t.priority, t.story_points,
          t.estimated_hours, userId, t.assignee_id, (ultima?.p ?? 0) + 100000, fecha, t.due_time, t.recurrence, planificada);
        db.prepare('INSERT OR IGNORE INTO issue_labels (issue_id, label_id) SELECT ?, label_id FROM issue_labels WHERE issue_id = ?').run(id, issueId);
        db.prepare('INSERT OR IGNORE INTO issue_page_links (issue_id, page_id, linked_by) SELECT ?, page_id, ? FROM issue_page_links WHERE issue_id = ?').run(id, userId, issueId);
        IssueService.copiarSubtareas(issueId, id, userId);
        db.prepare('UPDATE issues SET recurrence = NULL, next_issue_id = ? WHERE id = ? AND next_issue_id IS NULL').run(id, issueId);
      })();
      return { creada: { id, due_date: fecha } };
    }

    if (antes === 'done' && t.next_issue_id) {
      const sig = db.prepare('SELECT id, recurrence, created_at, updated_at, logged_hours, status FROM issues WHERE id = ?').get(t.next_issue_id) as any;
      if (!sig) return {};
      if (!IssueService.siguienteIntacta(sig, issueId)) return { conservada: true };
      db.transaction(() => {
        db.prepare('UPDATE issues SET recurrence = ?, next_issue_id = NULL WHERE id = ?').run(sig.recurrence, issueId);
        IssueService.borrarSinComprobar([sig.id]);
      })();
      return { deshecha: true };
    }
    return {};
  }

  /**
   * ¿Se puede borrar la siguiente de una repetida sin perder trabajo?
   *
   * `updated_at` no basta: marcar una subtarea, ponerle una etiqueta, vincular
   * un apunte o adjuntar un archivo no lo cambia. Se mira todo lo que la
   * siguiente pudo recibir después de crearse, comparándolo con lo que se le
   * copió de la original. Ante la duda, se conserva.
   */
  static siguienteIntacta(sig: any, origenId: string): boolean {
    if (sig.created_at !== sig.updated_at || sig.logged_hours > 0 || sig.status !== 'todo') return false;
    const conjunto = (sql: string, id: string) =>
      (db.prepare(sql).all(id) as Array<{ v: string }>).map((r) => r.v).sort().join('\u0000');
    const etiquetas = 'SELECT label_id AS v FROM issue_labels WHERE issue_id = ?';
    const apuntes = 'SELECT page_id AS v FROM issue_page_links WHERE issue_id = ?';
    if (conjunto(etiquetas, sig.id) !== conjunto(etiquetas, origenId)) return false;
    if (conjunto(apuntes, sig.id) !== conjunto(apuntes, origenId)) return false;
    // Subtareas: las mismas, todas pendientes y sin tocar.
    const subs = db.prepare('SELECT title, status, created_at, updated_at FROM issues WHERE parent_issue_id = ? ORDER BY position').all(sig.id) as any[];
    const originales = IssueService.listarSubtareas(origenId).map((x) => x.title);
    if (subs.length !== originales.length || subs.some((x, i) => x.title !== originales[i] || x.status !== 'todo' || x.created_at !== x.updated_at)) return false;
    // Nada colgado que no se copió.
    const algo = (sql: string) => Boolean(db.prepare(sql).get(sig.id));
    if (algo("SELECT 1 FROM attachments WHERE entity_type = 'issue' AND entity_id = ?")) return false;
    if (algo("SELECT 1 FROM drive_file_links WHERE entity_type = 'issue' AND entity_id = ?")) return false;
    if (algo('SELECT 1 FROM work_logs WHERE issue_id = ?')) return false;
    if (algo('SELECT 1 FROM time_tracking_sessions WHERE issue_id = ?')) return false;
    return true;
  }

  /** Copiar las subtareas de una tarea a otra, todas pendientes. Sin comprobar permisos. */
  static copiarSubtareas(origenId: string, destinoId: string, userId: string) {
    const destino = db.prepare('SELECT workspace_id, type FROM issues WHERE id = ?').get(destinoId) as any;
    if (!destino) return;
    for (const st of IssueService.listarSubtareas(origenId)) {
      db.prepare(`
        INSERT INTO issues (id, workspace_id, sprint_id, parent_issue_id, type, title, status, reporter_id, position)
        VALUES (?, ?, NULL, ?, ?, ?, 'todo', ?, ?)
      `).run(crypto.randomUUID(), destino.workspace_id, destinoId, destino.type || 'task', st.title, userId, st.position);
    }
  }

  /**
   * Borrar tareas con lo que cuelga de ellas **sin clave foránea**.
   *
   * `DELETE FROM issues` a secas dejaba huérfanos: los adjuntos (`attachments`
   * es polimórfica, `entity_type`/`entity_id`, sin clave foránea) con sus
   * ficheros en disco, y los vínculos a archivos de Drive y a recursos. Lo que
   * sí tiene clave foránea —etiquetas, registros de horas, subtareas, apuntes
   * vinculados— cae en cascada.
   *
   * Los archivos de Drive **no** se borran: son del espacio y pueden estar en
   * otras tareas. Se quita el vínculo, nada más.
   *
   * Sin comprobar permisos: quien llama ya lo hizo. Lo usan el botón «Eliminar»
   * del panel y el borrado de un sprint con tareas que se descartan.
   */
  static borrarSinComprobar(idsPedidos: string[]) {
    const ficheros: string[] = [];
    // Las subtareas caen en cascada con su madre, pero sus adjuntos no: se
    // recorren también.
    const ids = [...idsPedidos];
    for (const id of idsPedidos) {
      for (const h of db.prepare('SELECT id FROM issues WHERE parent_issue_id = ?').all(id) as Array<{ id: string }>) ids.push(h.id);
    }
    db.transaction(() => {
      for (const id of [...ids].reverse()) {
        const adjuntos = db.prepare("SELECT file_path FROM attachments WHERE entity_type = 'issue' AND entity_id = ?").all(id) as Array<{ file_path: string }>;
        ficheros.push(...adjuntos.map((a) => a.file_path));
        db.prepare("DELETE FROM attachments WHERE entity_type = 'issue' AND entity_id = ?").run(id);
        db.prepare("DELETE FROM drive_file_links WHERE entity_type = 'issue' AND entity_id = ?").run(id);
        db.prepare("DELETE FROM resource_links WHERE entity_type = 'issue' AND entity_id = ?").run(id);
        db.prepare('DELETE FROM issues WHERE id = ?').run(id);
      }
    })();
    // Los ficheros, después de confirmar: borrados no vuelven si la
    // transacción fallara. Solo el nombre, nunca una ruta que venga de la base.
    for (const ruta of ficheros) {
      try { fs.unlinkSync(path.join(STORAGE_DIR, path.basename(ruta.replace('/api/storage/', '')))); }
      catch (err) { console.error('borrar adjunto del disco:', err); }
    }
  }
  static async create(data: Partial<Issue>, userId: string, isSysadmin: number) {
    if (!data.title || !data.workspace_id) throw new ApiError(400, 'Title and workspaceId are required');

    const access = checkWorkspaceAccess(userId, isSysadmin, data.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }

    if (data.sprint_id) {
      const sprint = db.prepare('SELECT id FROM sprints WHERE id = ? AND workspace_id = ?').get(data.sprint_id, data.workspace_id);
      if (!sprint) throw new ApiError(400, 'Sprint not found or belongs to another workspace');
    }

    if (data.assignee_id) {
      const isMember = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(data.workspace_id, data.assignee_id);
      if (!isMember) throw new ApiError(400, 'Assignee is not a member of this workspace');
    }

    /**
     * Etiquetas, apuntes, prioridad y hora **al crear**.
     *
     * El formulario de alta se había quedado atrás: no dejaba poner etiquetas
     * y había que crear la tarea y volver a abrirla. Se validan todas antes de
     * escribir nada —una etiqueta o un apunte de otro espacio rechaza el alta
     * entera— y se insertan en la misma transacción que la tarea, así que no
     * puede quedar una tarea a medio etiquetar.
     */
    const extra = data as Partial<Issue> & { label_ids?: unknown; page_ids?: unknown };
    const lista = (v: unknown, campo: string): string[] => {
      if (v === undefined || v === null) return [];
      if (!Array.isArray(v) || v.length > 20 || v.some((x) => typeof x !== 'string')) throw new ApiError(400, `Invalid ${campo}`);
      return [...new Set(v as string[])];
    };
    const etiquetas = lista(extra.label_ids, 'label_ids');
    const paginas = lista(extra.page_ids, 'page_ids');
    for (const id of etiquetas) {
      if (!db.prepare('SELECT 1 FROM labels WHERE id = ? AND workspace_id = ?').get(id, data.workspace_id)) {
        throw new ApiError(400, 'Label not found in this workspace');
      }
    }
    for (const id of paginas) {
      if (!esPaginaDelEspacio(id, data.workspace_id)) throw new ApiError(400, 'Page not found in this workspace');
    }
    if (data.priority !== undefined && data.priority !== null && !esPrioridad(data.priority)) throw new ApiError(400, 'Invalid priority');
    if (data.due_time !== undefined && !esHora(data.due_time)) throw new ApiError(400, 'Invalid due_time');
    const planificada = (data as any).planned_date || null;
    if (planificada && !esDia(planificada)) throw new ApiError(400, 'Invalid planned_date');
    const regla = (data as any).recurrence || null;
    if (regla && !esRegla(regla)) throw new ApiError(400, 'Invalid recurrence');
    if (regla && !data.due_date) throw new ApiError(400, 'Recurrence needs a due date');

    const issueId = crypto.randomUUID();
    const status = 'todo';
    
    let position = 100000;
    const lastIssue = db.prepare('SELECT position FROM issues WHERE workspace_id = ? AND status = ? ORDER BY position DESC LIMIT 1').get(data.workspace_id, status) as any;
    if (lastIssue) {
      position = lastIssue.position + 100000;
    }

    /**
     * Las horas estimadas se insertan al crear, no solo al editar.
     *
     * Faltaban en este `INSERT` mientras `update()` sí las tenía entre sus
     * `allowedFields`, así que la única forma de estimar un ticket era crearlo
     * y volver a abrirlo. `due_date`, que es un campo idéntico en dificultad,
     * sí estaba: fue un olvido, no una decisión.
     *
     * Se limpia aquí porque el número llega de fuera: un texto, un negativo o
     * un `Infinity` entrarían tal cual en una columna REAL y saldrían luego en
     * los totales del sprint.
     */
    const estimadas = Number(data.estimated_hours);
    const horas = Number.isFinite(estimadas) && estimadas > 0 ? estimadas : 0;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO issues (id, workspace_id, sprint_id, title, type, status, reporter_id, position, assignee_id, due_date, due_time, description, estimated_hours, priority, recurrence, planned_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(issueId, data.workspace_id, data.sprint_id || null, data.title, data.type || 'task', status, userId, position,
        data.assignee_id || null, data.due_date || null, (data.due_date && data.due_time) || null, data.description || null, horas,
        data.priority || 'medium', regla, planificada);
      const ponerEtiqueta = db.prepare('INSERT OR IGNORE INTO issue_labels (issue_id, label_id) VALUES (?, ?)');
      for (const id of etiquetas) ponerEtiqueta.run(issueId, id);
      for (const id of paginas) vincular(issueId, id, userId);
    })();

    // Avisar a quien queda asignado **al crear**, no solo al editar después.
    //
    // Este hueco explicaba por sí solo el «no me llega nunca nada»: crear el
    // ticket ya asignado es el camino normal —está en el propio formulario de
    // nuevo ticket—, y era el único que no avisaba. Había que crearlo sin
    // asignar y asignarlo en un segundo paso para que saliera la notificación.
    if (data.assignee_id && data.assignee_id !== userId) {
      const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(data.workspace_id) as any;
      const quien = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
      if (ws) {
        NotificationService.notify(
          data.assignee_id,
          'assign',
          'Te han asignado un ticket',
          `${quien?.username ?? 'Alguien'}: ${data.title}`,
          `/w/${ws.sys_tag}/board?issue=${issueId}`
        );
      }
    }

    const generalChannel = db.prepare("SELECT id FROM channels WHERE workspace_id = ? AND name = 'general'").get(data.workspace_id) as any;
    if (generalChannel) {
      process.emit('system_notification', { channelId: generalChannel.id, content: `🆕 New issue created: **${data.title}** (${data.type || 'task'})` });
    }

    return { id: issueId };
  }

  /**
   * Duplicar un ticket.
   *
   * Lo interesante no es lo que se copia, sino lo que **no**:
   *
   *  - **Las horas registradas se quedan a cero.** Son el registro de un tiempo
   *    que alguien trabajó de verdad. Copiarlas inventa trabajo que no ocurrió,
   *    y el tablero las suma para dar el total del sprint: duplicar tres veces
   *    un ticket de ocho horas añadiría veinticuatro horas de nada.
   *  - **El estado vuelve a «por hacer».** Se duplica sobre todo para repetir
   *    algo ya hecho, y una copia que nace en «Hecho» es trabajo invisible: no
   *    la mira nadie y cuenta como terminada.
   *  - **El cronómetro no se hereda.** Una sesión abierta pertenece a la
   *    persona que la arrancó sobre el ticket original.
   *
   * Sí se copian las etiquetas: son la clasificación del trabajo y siguen
   * valiendo. Y el sprint, **salvo que esté cerrado** — meter trabajo nuevo en
   * un sprint terminado descuadra lo que ese sprint dice que se hizo, así que
   * en ese caso la copia va al backlog.
   */
  static async duplicate(issueId: string, userId: string, isSysadmin: number) {
    const original = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId) as Issue | undefined;
    if (!original) throw new ApiError(404, 'Not Found');

    const access = checkWorkspaceAccess(userId, isSysadmin, original.workspace_id, 'editor');
    if (!access.granted) {
      if (access.reason === 'not_member') throw new ApiError(404, 'Not Found');
      throw new ApiError(403, access.error || 'Forbidden');
    }

    // Un sprint cerrado no recibe trabajo nuevo.
    let sprintId = original.sprint_id;
    if (sprintId) {
      const sprint = db.prepare("SELECT status FROM sprints WHERE id = ?").get(sprintId) as any;
      if (!sprint || sprint.status === 'completed') sprintId = null;
    }

    // Quien estaba asignado puede haberse ido del espacio desde entonces.
    let assigneeId = original.assignee_id;
    if (assigneeId) {
      const sigue = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .get(original.workspace_id, assigneeId);
      if (!sigue) assigneeId = null;
    }

    const nuevoId = crypto.randomUUID();
    const estado = 'todo';

    const ultima = db.prepare(
      'SELECT position FROM issues WHERE workspace_id = ? AND status = ? ORDER BY position DESC LIMIT 1'
    ).get(original.workspace_id, estado) as any;
    const position = ultima ? ultima.position + 100000 : 100000;

    // Título y etiquetas en la misma transacción: una copia a medias —el ticket
    // creado y las etiquetas no— es peor que ninguna, porque parece completa.
    const titulo = IssueService.tituloDeCopia(original.title, original.workspace_id);

    db.transaction(() => {
      db.prepare(`
        INSERT INTO issues (
          id, workspace_id, sprint_id, parent_issue_id, type, title, description,
          status, priority, story_points, estimated_hours, logged_hours,
          position, reporter_id, assignee_id, due_date, due_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
      `).run(
        nuevoId,
        original.workspace_id,
        sprintId,
        original.parent_issue_id ?? null,
        original.type,
        titulo,
        original.description ?? null,
        estado,
        original.priority ?? null,
        original.story_points ?? null,
        original.estimated_hours ?? null,
        position,
        // El autor de la copia es quien la hace, no quien escribió el original:
        // las preguntas sobre este ticket nuevo van a quien lo creó.
        userId,
        assigneeId,
        original.due_date ?? null,
        original.due_time ?? null
      );

      db.prepare(`
        INSERT OR IGNORE INTO issue_labels (issue_id, label_id)
        SELECT ?, label_id FROM issue_labels WHERE issue_id = ?
      `).run(nuevoId, issueId);

      // Los apuntes vinculados y las subtareas también: una copia que pierde
      // la lista de pasos no es una copia. Las subtareas empiezan pendientes.
      db.prepare(`
        INSERT OR IGNORE INTO issue_page_links (issue_id, page_id, linked_by)
        SELECT ?, page_id, ? FROM issue_page_links WHERE issue_id = ?
      `).run(nuevoId, userId, issueId);
      IssueService.copiarSubtareas(issueId, nuevoId, userId);
    })();

    if (assigneeId && assigneeId !== userId) {
      const ws = db.prepare('SELECT sys_tag FROM workspaces WHERE id = ?').get(original.workspace_id) as any;
      const quien = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
      if (ws) {
        NotificationService.notify(
          assigneeId,
          'assign',
          'Te han asignado un ticket',
          `${quien?.username ?? 'Alguien'}: ${titulo}`,
          `/w/${ws.sys_tag}/board?issue=${nuevoId}`
        );
      }
    }

    return { id: nuevoId, title: titulo, sprint_id: sprintId };
  }

  /**
   * «Informe semanal» → «Informe semanal (copia)» → «Informe semanal (copia 2)».
   *
   * Numerar desde la segunda evita el ridículo de un «(copia 1)» cuando solo hay
   * una, y evita también tres tarjetas idénticas en el tablero, que es lo que
   * pasa si el título se repite tal cual: son indistinguibles salvo abriéndolas.
   *
   * El tope de 200 caracteres es el de la columna en la práctica; el sufijo se
   * añade recortando el título, no reventándolo.
   */
  private static tituloDeCopia(titulo: string, workspaceId: string): string {
    const base = titulo.replace(/\s*\(copia(?: \d+)?\)$/i, '').trim();

    const usados = db.prepare(
      "SELECT title FROM issues WHERE workspace_id = ? AND (title = ? OR title LIKE ?)"
    ).all(workspaceId, base, `${escaparLike(base)} (copia%`) as Array<{ title: string }>;

    const nombres = new Set(usados.map((u) => u.title));
    const recorta = (t: string) => (t.length > 200 ? `${t.slice(0, 197)}...` : t);

    let candidato = `${base} (copia)`;
    for (let n = 2; nombres.has(candidato); n++) candidato = `${base} (copia ${n})`;
    return recorta(candidato);
  }
}
