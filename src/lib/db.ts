import Database from 'better-sqlite3';
import path from 'path';

/**
 * DATABASE ARCHITECTURE DECISION
 * ──────────────────────────────────────────────────────────────────────────
 * This project uses two coexisting database access strategies intentionally:
 *
 * 1. better-sqlite3 (raw SQL) — used for ALL core tables.
 *    Rationale: synchronous I/O fits Astro SSR's request lifecycle, explicit
 *    queries are easy to audit, and there is no runtime ORM overhead.
 *    Location: this file (db.ts), all src/lib/ services, all src/pages/api/
 *    routes EXCEPT those under /w/[sys_tag]/db/.
 *
 * 2. Drizzle ORM — used ONLY for the Dynamic Databases module.
 *    Rationale: dynamic_databases/entries/views require runtime-generated
 *    queries from user-defined schemas; Drizzle's type-safe query builder
 *    is a better fit than string-concatenated raw SQL there.
 *    Location: src/lib/db/drizzle.ts + src/pages/api/w/[sys_tag]/db/*.
 *
 * RULE: Do NOT use Drizzle for features outside the /db module.
 *       Do NOT use raw SQL inside the /db module.
 * ──────────────────────────────────────────────────────────────────────────
 */

// Asegurar que la base de datos se guarda en la raíz del proyecto
const dbPath = process.env.DATABASE_URL ? process.env.DATABASE_URL : (process.env.NODE_ENV === 'test' ? path.join(process.cwd(), 'forge_test.db') : 
path.join(process.cwd(), 'forge.db'));
const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });

// Esperar al lock en vez de fallar al instante con SQLITE_BUSY.
//
// Va PRIMERO, y el orden importa: `journal_mode = WAL` necesita un lock
// exclusivo, así que si varios procesos abren una base nueva a la vez y el
// timeout aún no está puesto, ese mismo pragma revienta con SQLITE_BUSY.
// Varios procesos sobre el mismo archivo es lo normal aquí: workers de test,
// un servidor y un script, o un despliegue multiproceso.
db.pragma('busy_timeout = 15000');

/** Espera síncrona, acorde con el resto de la inicialización del módulo. */
function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Pasar a WAL exige un lock exclusivo y, a diferencia del resto de
 * operaciones, ese cambio de modo no respeta `busy_timeout`: si otro proceso
 * está haciendo exactamente lo mismo en ese instante, falla con SQLITE_BUSY.
 *
 * Se consulta el modo antes de intentar cambiarlo, porque leerlo no necesita
 * lock: en cuanto un proceso lo ha puesto, los demás no tienen nada que hacer.
 */
function enableWal() {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      if (String(db.pragma('journal_mode', { simple: true })).toLowerCase() === 'wal') return;
      if (String(db.pragma('journal_mode = WAL', { simple: true })).toLowerCase() === 'wal') return;
    } catch (e: any) {
      if (e.code !== 'SQLITE_BUSY') throw e;
    }
    sleepSync(25);
  }
  throw new Error('[DB] No se pudo pasar la base de datos a modo WAL: sigue bloqueada tras 20 intentos');
}

// Optimizaciones Críticas Obligatorias
enableWal();
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON'); // Vital para los CASCADE DELETES
db.pragma('temp_store = MEMORY');
db.pragma('cache_size = -64000'); // 64MB de caché

process.on('SIGINT', () => { db.close(); process.exit(); });
process.on('SIGTERM', () => { db.close(); process.exit(); });

// 2. Diccionario de Datos: Global System & Auth Layer
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 is_guest BOOLEAN DEFAULT 0 CHECK(is_guest IN (0, 1)),
 is_sysadmin BOOLEAN DEFAULT 0 CHECK(is_sysadmin IN (0, 1)),
 avatar_url TEXT DEFAULT '/default-avatar.svg',
 -- Claro por defecto, igual que la portada: quien se registra venía de una
 -- página clara y saltar a una aplicación oscura al entrar es un tropiezo.
 -- Quien ya tenga preferencia guardada no se ve afectado.
 theme_preference TEXT DEFAULT 'light',
  last_workspace_id TEXT,
  bio TEXT,
  pronouns TEXT,
  public_email TEXT,
  github_id TEXT,
  google_id TEXT,
  last_page_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspaces (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 sys_tag TEXT NOT NULL UNIQUE,
 icon TEXT,
 description TEXT,
 created_by TEXT NOT NULL,
 is_public BOOLEAN DEFAULT 0 CHECK(is_public IN (0, 1)),
 join_policy TEXT DEFAULT 'disabled' CHECK(join_policy IN ('open', 'friends_only', 'disabled')),
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (created_by) REFERENCES users(id)
);
`);


// 3. Diccionario de Datos: Aislamiento Multi-Tenant (El Pivote)
db.exec(`
CREATE TABLE IF NOT EXISTS workspace_members (
 workspace_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 ws_role TEXT NOT NULL CHECK(ws_role IN ('owner', 'editor', 'viewer')),
 joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (workspace_id, user_id),
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS workspace_join_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  user_a_id TEXT NOT NULL,
  user_b_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected','ended','blocked')),
  action_user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (action_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (user_a_id < user_b_id),
  CHECK (user_a_id != user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE IF NOT EXISTS user_blocks (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);
`);

// 4. Diccionario de Datos: Módulos de Operación
db.exec(`
CREATE TABLE IF NOT EXISTS sprints (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 name TEXT NOT NULL,
 start_date DATETIME,
 end_date DATETIME,
 status TEXT CHECK(status IN ('planned', 'active', 'completed')) DEFAULT 'planned',
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issues (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 sprint_id TEXT,
 parent_issue_id TEXT,
 type TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT,
 status TEXT DEFAULT 'todo',
 priority TEXT CHECK(priority IN ('lowest', 'low', 'medium', 'high', 'highest')) DEFAULT 'medium',
 story_points INTEGER DEFAULT 0,
 estimated_hours REAL DEFAULT 0.0,
 logged_hours REAL DEFAULT 0.0,
 position REAL DEFAULT 0.0,
 reporter_id TEXT NOT NULL,
 assignee_id TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
 FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
 FOREIGN KEY (parent_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
 FOREIGN KEY (reporter_id) REFERENCES users(id),
 FOREIGN KEY (assignee_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_issues_workspace ON issues(workspace_id);
CREATE INDEX IF NOT EXISTS idx_issues_metrics ON issues(workspace_id, sprint_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_workspace_status ON issues(workspace_id, status);


CREATE TABLE IF NOT EXISTS work_logs (
 id TEXT PRIMARY KEY,
 issue_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 hours_spent REAL NOT NULL,
 description TEXT,
 work_date DATETIME DEFAULT CURRENT_TIMESTAMP,
 logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Triggers para mantener sincronizado logged_hours en issues (Opción B: Denormalización Atómica Segura)
CREATE TRIGGER IF NOT EXISTS trg_work_logs_insert
AFTER INSERT ON work_logs
BEGIN
  UPDATE issues SET logged_hours = logged_hours + NEW.hours_spent WHERE id = NEW.issue_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_work_logs_delete
AFTER DELETE ON work_logs
BEGIN
  UPDATE issues SET logged_hours = MAX(0.0, logged_hours - OLD.hours_spent) WHERE id = OLD.issue_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_work_logs_update
AFTER UPDATE OF hours_spent ON work_logs
BEGIN
  UPDATE issues SET logged_hours = MAX(0.0, logged_hours - OLD.hours_spent + NEW.hours_spent) WHERE id = NEW.issue_id;
END;

CREATE TABLE IF NOT EXISTS pages (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 parent_page_id TEXT,
 title TEXT NOT NULL DEFAULT 'Untitled',
 icon TEXT,
 cover_image TEXT,
 content_json TEXT, -- Payload de Editor.js o Excalidraw
 created_by TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
 FOREIGN KEY (parent_page_id) REFERENCES pages(id) ON DELETE CASCADE,
 FOREIGN KEY (created_by) REFERENCES users(id)
);

-- El árbol de páginas (PageTree.astro) lee todas las páginas del espacio en
-- cada renderizado del lateral: es la consulta que más veces se ejecuta de todo
-- el producto, y la tabla pages no tenía ningun indice. Sin esto, cada pintado del
-- lateral era un recorrido completo de la tabla.
CREATE INDEX IF NOT EXISTS idx_pages_workspace ON pages(workspace_id, parent_page_id);

CREATE TABLE IF NOT EXISTS document_chunks (
 id TEXT PRIMARY KEY,
 entity_id TEXT NOT NULL,
 workspace_id TEXT NOT NULL,
 chunk_text TEXT NOT NULL,
 embedding_vector BLOB, -- Serialized Float32Array para búsqueda vectorial LLM
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS entry_relations (
 source_entry_id TEXT NOT NULL,
 target_entry_id TEXT NOT NULL,
 PRIMARY KEY (source_entry_id, target_entry_id),
 FOREIGN KEY (source_entry_id) REFERENCES dynamic_entries(id) ON DELETE CASCADE,
 FOREIGN KEY (target_entry_id) REFERENCES dynamic_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public_forms (
 id TEXT PRIMARY KEY,
 dynamic_database_id TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT,
 is_active BOOLEAN DEFAULT 1 CHECK(is_active IN (0, 1)),
 FOREIGN KEY (dynamic_database_id) REFERENCES dynamic_databases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS channels (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 name TEXT NOT NULL,
 type TEXT DEFAULT 'public' CHECK(type IN ('public', 'private')),
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY,
 channel_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 content TEXT NOT NULL,
 is_edited BOOLEAN DEFAULT 0 CHECK(is_edited IN (0, 1)),
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

// 5. Diccionario de Datos: Automatización y Trazabilidad Forense
db.exec(`
CREATE TABLE IF NOT EXISTS attachments (
 id TEXT PRIMARY KEY,
 entity_type TEXT NOT NULL CHECK(entity_type IN ('issue', 'page', 'dynamic_entry', 'message', 'user', 'workspace')),
 entity_id TEXT NOT NULL,
 file_name TEXT NOT NULL,
 file_path TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 uploaded_by TEXT NOT NULL,
 uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS automations (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 name TEXT NOT NULL,
 trigger_type TEXT NOT NULL,
 trigger_condition TEXT NOT NULL, -- JSON config
 action_type TEXT NOT NULL,
 action_payload TEXT NOT NULL, -- JSON config
 is_active BOOLEAN DEFAULT 1 CHECK(is_active IN (0, 1)),
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 user_id TEXT,
 action TEXT NOT NULL,
 entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 details_json TEXT,
 timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Dynamic Databases (Fase 1)
CREATE TABLE IF NOT EXISTS dynamic_databases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sys_tag TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  schema_json TEXT NOT NULL, -- { columns: [{ id: 'col_xxx', name: 'Precio', type: 'number', indexed: true }] }
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dynamic_entries (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL,
  payload_json TEXT NOT NULL, -- { col_xxx: 125.50 }
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (database_id) REFERENCES dynamic_databases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dynamic_views (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'table', 'gallery'
  filters_json TEXT,
  sort_json TEXT,
  visible_columns_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (database_id) REFERENCES dynamic_databases(id) ON DELETE CASCADE
);

-- Indexes for basic lookup
CREATE INDEX IF NOT EXISTS idx_dynamic_databases_ws ON dynamic_databases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_entries_db ON dynamic_entries(database_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_views_db ON dynamic_views(database_id);

CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 type TEXT DEFAULT 'info',
 is_read BOOLEAN DEFAULT 0 CHECK(is_read IN (0, 1)),
 link_url TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- notifications tampoco tenía índice, y se consulta por destinatario en cada
-- carga de la campana, y por tipo desde los ajustes del espacio.
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_join_requests_user ON workspace_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_ws ON workspace_join_requests(workspace_id);
`);

// Insert SYSTEM user for automated messages
db.exec(`INSERT OR IGNORE INTO users (id, username, password_hash, is_sysadmin) VALUES ('system', 'Forge System', 'none', 0)`);

// 6. KB ↔ Kanban Integration: Bidirectional links + shared labels
db.exec(`
CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#FF5D00',
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_labels_workspace ON labels(workspace_id);

CREATE TABLE IF NOT EXISTS issue_labels (
  issue_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (issue_id, label_id),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_labels (
  page_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (page_id, label_id),
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

-- Bidirectional Issue ↔ Page links (KB integration)
CREATE TABLE IF NOT EXISTS issue_page_links (
  issue_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  linked_by TEXT NOT NULL,
  linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (issue_id, page_id),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_by) REFERENCES users(id)
);

-- Milestones for roadmap view
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target_date DATETIME,
  status TEXT CHECK(status IN ('planned', 'achieved', 'missed')) DEFAULT 'planned',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_milestones_workspace ON milestones(workspace_id);

CREATE TABLE IF NOT EXISTS time_tracking_sessions (
 id TEXT PRIMARY KEY,
 issue_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// ── Infrastructure tables for migration tracking and rate limiting ────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rate_limit_attempts (
    key      TEXT    NOT NULL PRIMARY KEY,
    count    INTEGER NOT NULL DEFAULT 1,
    reset_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_attempts(reset_at);
`);

const migrations = [
  "ALTER TABLE workspaces ADD COLUMN is_public BOOLEAN DEFAULT 0 CHECK(is_public IN (0, 1))",
  "ALTER TABLE workspaces ADD COLUMN join_policy TEXT DEFAULT 'disabled' CHECK(join_policy IN ('open', 'friends_only', 'disabled'))",
  "ALTER TABLE sprints ADD COLUMN goal TEXT",
  "ALTER TABLE users ADD COLUMN bio TEXT",
  "ALTER TABLE users ADD COLUMN pronouns TEXT",
  "ALTER TABLE users ADD COLUMN public_email TEXT",
  "ALTER TABLE users ADD COLUMN github_id TEXT",
  "ALTER TABLE users ADD COLUMN google_id TEXT",
  "ALTER TABLE users ADD COLUMN last_page_id TEXT",
  "ALTER TABLE users ADD COLUMN notif_mute_all BOOLEAN DEFAULT 0",
  "ALTER TABLE users ADD COLUMN notif_mute_assign BOOLEAN DEFAULT 0",
  "ALTER TABLE users ADD COLUMN notif_mute_mention BOOLEAN DEFAULT 0",
  "ALTER TABLE users ADD COLUMN notif_mute_sprint BOOLEAN DEFAULT 0",
  "ALTER TABLE users ADD COLUMN notif_mute_system BOOLEAN DEFAULT 0",
  "ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'info'",
  "ALTER TABLE issues ADD COLUMN due_date DATETIME",
  "ALTER TABLE audit_logs ADD COLUMN workspace_id TEXT",
  "ALTER TABLE work_logs ADD COLUMN work_date DATETIME DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE dynamic_databases ADD COLUMN sys_tag TEXT DEFAULT ''",
  "ALTER TABLE dynamic_databases ADD COLUMN description TEXT",
  "ALTER TABLE dynamic_databases ADD COLUMN icon TEXT",
  "ALTER TABLE dynamic_databases ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE dynamic_entries ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"
];

// ── Versioned Migration System ────────────────────────────────────────────────
// Helper: check if a column already exists (makes migrations idempotent)
function hasColumn(table: string, col: string): boolean {
  return (db.prepare(`PRAGMA table_info("${table}")`).all() as any[])
    .some((c: any) => c.name === col);
}

type Migration = { version: number; description: string; run: () => void };

const MIGRATIONS: Migration[] = [
  // v1-v3: early columns that were previously in bare try/catch blocks
  { version: 1,  description: 'users: add is_guest',              run: () => { if (!hasColumn('users', 'is_guest'))              db.exec("ALTER TABLE users ADD COLUMN is_guest BOOLEAN DEFAULT 0 CHECK(is_guest IN (0, 1))"); } },
  { version: 2,  description: 'users: add is_public',             run: () => { if (!hasColumn('users', 'is_public'))             db.exec("ALTER TABLE users ADD COLUMN is_public BOOLEAN DEFAULT 1 CHECK(is_public IN (0, 1))"); } },
  { version: 3,  description: 'users: add banner_url',            run: () => { if (!hasColumn('users', 'banner_url'))            db.exec('ALTER TABLE users ADD COLUMN banner_url TEXT'); } },
  // v4-v26: former flat migrations array
  { version: 4,  description: 'workspaces: add is_public',        run: () => { if (!hasColumn('workspaces', 'is_public'))        db.exec("ALTER TABLE workspaces ADD COLUMN is_public BOOLEAN DEFAULT 0 CHECK(is_public IN (0, 1))"); } },
  { version: 5,  description: 'workspaces: add join_policy',      run: () => { if (!hasColumn('workspaces', 'join_policy'))      db.exec("ALTER TABLE workspaces ADD COLUMN join_policy TEXT DEFAULT 'disabled' CHECK(join_policy IN ('open', 'friends_only', 'disabled'))"); } },
  { version: 6,  description: 'sprints: add goal',                run: () => { if (!hasColumn('sprints', 'goal'))                db.exec('ALTER TABLE sprints ADD COLUMN goal TEXT'); } },
  { version: 7,  description: 'users: add bio',                   run: () => { if (!hasColumn('users', 'bio'))                   db.exec('ALTER TABLE users ADD COLUMN bio TEXT'); } },
  { version: 8,  description: 'users: add pronouns',              run: () => { if (!hasColumn('users', 'pronouns'))              db.exec('ALTER TABLE users ADD COLUMN pronouns TEXT'); } },
  { version: 9,  description: 'users: add public_email',          run: () => { if (!hasColumn('users', 'public_email'))          db.exec('ALTER TABLE users ADD COLUMN public_email TEXT'); } },
  { version: 10, description: 'users: add github_id',             run: () => { if (!hasColumn('users', 'github_id'))             db.exec('ALTER TABLE users ADD COLUMN github_id TEXT'); } },
  { version: 11, description: 'users: add google_id',             run: () => { if (!hasColumn('users', 'google_id'))             db.exec('ALTER TABLE users ADD COLUMN google_id TEXT'); } },
  { version: 12, description: 'users: add last_page_id',          run: () => { if (!hasColumn('users', 'last_page_id'))          db.exec('ALTER TABLE users ADD COLUMN last_page_id TEXT'); } },
  { version: 13, description: 'users: add notif_mute_all',        run: () => { if (!hasColumn('users', 'notif_mute_all'))        db.exec('ALTER TABLE users ADD COLUMN notif_mute_all BOOLEAN DEFAULT 0'); } },
  { version: 14, description: 'users: add notif_mute_assign',     run: () => { if (!hasColumn('users', 'notif_mute_assign'))     db.exec('ALTER TABLE users ADD COLUMN notif_mute_assign BOOLEAN DEFAULT 0'); } },
  { version: 15, description: 'users: add notif_mute_mention',    run: () => { if (!hasColumn('users', 'notif_mute_mention'))    db.exec('ALTER TABLE users ADD COLUMN notif_mute_mention BOOLEAN DEFAULT 0'); } },
  { version: 16, description: 'users: add notif_mute_sprint',     run: () => { if (!hasColumn('users', 'notif_mute_sprint'))     db.exec('ALTER TABLE users ADD COLUMN notif_mute_sprint BOOLEAN DEFAULT 0'); } },
  { version: 17, description: 'users: add notif_mute_system',     run: () => { if (!hasColumn('users', 'notif_mute_system'))     db.exec('ALTER TABLE users ADD COLUMN notif_mute_system BOOLEAN DEFAULT 0'); } },
  { version: 18, description: 'notifications: add type',          run: () => { if (!hasColumn('notifications', 'type'))          db.exec("ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'info'"); } },
  { version: 19, description: 'issues: add due_date',             run: () => { if (!hasColumn('issues', 'due_date'))             db.exec('ALTER TABLE issues ADD COLUMN due_date DATETIME'); } },
  { version: 20, description: 'audit_logs: add workspace_id',     run: () => { if (!hasColumn('audit_logs', 'workspace_id'))     db.exec('ALTER TABLE audit_logs ADD COLUMN workspace_id TEXT'); } },
  { version: 21, description: 'work_logs: add work_date',         run: () => { if (!hasColumn('work_logs', 'work_date'))         db.exec('ALTER TABLE work_logs ADD COLUMN work_date DATETIME DEFAULT CURRENT_TIMESTAMP'); } },
  { version: 22, description: 'dynamic_databases: add sys_tag',   run: () => { if (!hasColumn('dynamic_databases', 'sys_tag'))   db.exec("ALTER TABLE dynamic_databases ADD COLUMN sys_tag TEXT DEFAULT ''"); } },
  { version: 23, description: 'dynamic_databases: add description',run: () => { if (!hasColumn('dynamic_databases', 'description'))db.exec('ALTER TABLE dynamic_databases ADD COLUMN description TEXT'); } },
  { version: 24, description: 'dynamic_databases: add icon',      run: () => { if (!hasColumn('dynamic_databases', 'icon'))      db.exec('ALTER TABLE dynamic_databases ADD COLUMN icon TEXT'); } },
  { version: 25, description: 'dynamic_databases: add created_at',run: () => { if (!hasColumn('dynamic_databases', 'created_at'))db.exec('ALTER TABLE dynamic_databases ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP'); } },
  { version: 26, description: 'dynamic_entries: add updated_at',  run: () => { if (!hasColumn('dynamic_entries', 'updated_at'))  db.exec('ALTER TABLE dynamic_entries ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'); } },
  {
    // Reconstruct attachments table to fix CHECK constraint (add 'user' and 'workspace' entity types)
    version: 27,
    description: 'attachments: fix CHECK constraint to include user and workspace',
    run: () => {
      const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='attachments'").get() as any;
      if (schema && !schema.sql.includes("'user'")) {
        // Ojo: aquí NO se toca `foreign_keys`. PRAGMA foreign_keys es un no-op
        // dentro de una transacción, y las migraciones ahora corren dentro de
        // una. Se desactiva antes de abrirla (ver applyMigrations más abajo).
        db.exec('ALTER TABLE attachments RENAME TO attachments_old');
        db.exec(`
          CREATE TABLE attachments (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL CHECK(entity_type IN ('issue', 'page', 'dynamic_entry', 'message', 'user', 'workspace')),
            entity_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
          )
        `);
        db.exec('INSERT INTO attachments SELECT * FROM attachments_old');
        db.exec('DROP TABLE attachments_old');
      }
    }
  },
  {
    version: 28,
    description: 'users: add email',
    run: () => {
      // Sin NOT NULL: hay cuentas creadas antes de que el registro pidiera
      // correo, y los invitados no tienen ninguno que dar. La obligatoriedad la
      // aplica el endpoint de registro, que es quien sabe si está creando una
      // cuenta de verdad.
      if (!hasColumn('users', 'email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT');
      // Índice único parcial: SQLite trata cada NULL como distinto, así que los
      // NULL conviven sin chocar, pero dos cuentas no pueden compartir correo.
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');
    }
  },
  {
    version: 29,
    description: 'users: replace third-party avatar URLs with the local default',
    run: () => {
      // El registro asignaba `https://api.dicebear.com/...?seed=<username>` como
      // avatar. Cada visita a un perfil mandaba entonces el nombre de usuario y
      // la IP del visitante a un servidor ajeno — en un producto cuya portada
      // promete «sin terceros» y «sin scripts de terceros».
      //
      // Solo toca las URL de dicebear: los avatares subidos por el usuario
      // viven en /api/storage/ y no se tocan.
      db.prepare(
        "UPDATE users SET avatar_url = '/default-avatar.svg' WHERE avatar_url LIKE '%dicebear.com%'"
      ).run();
    }
  },
  {
    version: 30,
    description: 'sprints: add completed_at, created_by, created_at, updated_at',
    run: () => {
      // Sin `DEFAULT CURRENT_TIMESTAMP` en el ALTER: SQLite lo rechaza con
      // «Cannot add a column with non-constant default». La columna se añade
      // vacía y se rellena después con un UPDATE, que sí lo admite.
      //
      // Hay migraciones anteriores con este mismo patrón (v21, v25) que nunca
      // han dado problemas porque esas columnas ya están en el esquema base:
      // `hasColumn` devuelve cierto y el ALTER no llega a ejecutarse. Aquí no
      // era el caso.
      if (!hasColumn('sprints', 'completed_at')) db.exec('ALTER TABLE sprints ADD COLUMN completed_at DATETIME');
      if (!hasColumn('sprints', 'created_by')) db.exec('ALTER TABLE sprints ADD COLUMN created_by TEXT');
      if (!hasColumn('sprints', 'created_at')) {
        db.exec('ALTER TABLE sprints ADD COLUMN created_at DATETIME');
        db.exec('UPDATE sprints SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL');
      }
      if (!hasColumn('sprints', 'updated_at')) {
        db.exec('ALTER TABLE sprints ADD COLUMN updated_at DATETIME');
        db.exec('UPDATE sprints SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL');
      }
    }
  },
  {
    version: 31,
    description: 'sprints: enforce a single active sprint per workspace',
    run: () => {
      // La regla «un solo sprint activo por espacio» vivía solo en la
      // aplicación, y una regla que solo vive en el código se salta con una
      // petición concurrente: dos personas activando dos sprints a la vez
      // pasan las dos comprobaciones antes de que ninguna escriba.
      //
      // Antes de poner el índice hay que dejar los datos en paz consigo mismos:
      // si ya hay dos activos, el CREATE INDEX falla y con él toda la
      // migración. Se conserva el más reciente —el que se activó al final es el
      // que la gente cree que está corriendo— y los demás vuelven a
      // 'planned'. No se tocan los completados.
      db.exec(`
        UPDATE sprints SET status = 'planned'
        WHERE status = 'active'
          AND id NOT IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY workspace_id ORDER BY COALESCE(start_date, created_at, '') DESC, rowid DESC
              ) AS n
              FROM sprints WHERE status = 'active'
            ) WHERE n = 1
          )
      `);
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sprints_one_active ON sprints(workspace_id) WHERE status = 'active'");
    }
  },
  {
    version: 32,
    description: 'sprint_snapshots: daily burndown points',
    run: () => {
      // El burndown se recalculaba al vuelo desde los work_logs en cada carga
      // de Métricas. Además de costar, es **irreproducible**: si un ticket
      // cambia de puntos o se mueve de sprint, la gráfica de ayer cambia hoy.
      // Una foto diaria congela lo que de verdad pasó.
      db.exec(`
        CREATE TABLE IF NOT EXISTS sprint_snapshots (
          id TEXT PRIMARY KEY,
          sprint_id TEXT NOT NULL,
          taken_on DATE NOT NULL,
          points_total INTEGER NOT NULL DEFAULT 0,
          points_done INTEGER NOT NULL DEFAULT 0,
          issues_total INTEGER NOT NULL DEFAULT 0,
          issues_done INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE
        )
      `);
      // Una foto por sprint y día: si el proceso se repite, actualiza en vez de
      // duplicar.
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_sprint_snapshots_day ON sprint_snapshots(sprint_id, taken_on)');
    }
  },
  {
    version: 33,
    description: 'resources: tablas del módulo de Recursos',
    run: () => {
      // Tabla de primera clase, no una tabla dinámica.
      //
      // La idea original era crear Recursos como una tabla dinámica más, pero
      // esas solo ofrecen Text, Number y Select: un recurso necesita adjuntos,
      // MIME, tamaño, vínculos a issues y sprints y marcas de enriquecimiento.
      // Modelarlo con tres tipos obliga a un EAV imposible de consultar, y deja
      // el esquema en manos de quien pueda editar la tabla.
      db.exec(`
        CREATE TABLE IF NOT EXISTS resources (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('link','file','note','snippet','repo')),
          title TEXT NOT NULL,
          description TEXT,

          url TEXT,
          url_normalized TEXT,
          favicon_url TEXT,
          site_name TEXT,

          file_path TEXT,
          mime_type TEXT,
          size_bytes INTEGER,

          body TEXT,
          language TEXT,

          enriched_at DATETIME,
          enrich_status TEXT DEFAULT 'pending' CHECK (enrich_status IN ('pending','ok','failed','skipped')),

          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          archived_at DATETIME,

          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // Deduplicación por URL normalizada, dentro del espacio.
      //
      // `archived_at IS NULL` en la condición no es un adorno: el borrado es
      // lógico, y sin esa parte un recurso archivado bloquearía para siempre
      // dar de alta la misma URL otra vez.
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_dedup
        ON resources(workspace_id, url_normalized)
        WHERE url_normalized IS NOT NULL AND archived_at IS NULL
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_resources_ws ON resources(workspace_id, archived_at, created_at DESC)');

      // Una misma URL citada en cinco issues es **un** recurso con cinco
      // vínculos, no cinco filas repetidas.
      db.exec(`
        CREATE TABLE IF NOT EXISTS resource_links (
          resource_id TEXT NOT NULL,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('issue','page','sprint')),
          entity_id TEXT NOT NULL,
          sprint_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (resource_id, entity_type, entity_id),
          FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
          FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_resource_links_entity ON resource_links(entity_type, entity_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_resource_links_sprint ON resource_links(sprint_id)');

      db.exec(`
        CREATE TABLE IF NOT EXISTS resource_tags (
          resource_id TEXT NOT NULL,
          tag TEXT NOT NULL,
          PRIMARY KEY (resource_id, tag),
          FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
        )
      `);
    }
  },
  {
    version: 34,
    description: 'workspace_drive: la conexión con Google Drive de cada espacio',
    run: () => {
      // Una fila por espacio: los archivos de un espacio viven en **un** Drive,
      // el de quien lo conectó. La clave primaria sobre `workspace_id` lo
      // impone; dos conexiones a la vez significarían archivos repartidos entre
      // dos cuentas sin forma de saber cuál manda.
      //
      // Conectar de nuevo sobreescribe la fila, y eso es justo lo que hace
      // falta cuando la persona que conectó se va: otro propietario conecta la
      // suya y la sección vuelve, apuntando a una carpeta nueva. Los archivos
      // anteriores se quedan en el Drive de quien se fue —no hay forma de
      // moverlos sin su permiso—, así que sus metadatos no se borran: se
      // marcan como sin acceso, que es la verdad.
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspace_drive (
          workspace_id TEXT PRIMARY KEY,
          google_email TEXT,
          root_folder_id TEXT,
          folder_id TEXT,
          folder_link TEXT,
          -- Cifrado con AES-256-GCM (ver lib/secretBox). Nunca en claro: es una
          -- llave permanente al Drive de una persona y la base se copia entera
          -- a un bucket cada noche.
          refresh_token_enc TEXT NOT NULL,
          -- 'ok' | 'revoked'. Se pasa a 'revoked' cuando Google rechaza el
          -- token, para poder enseñar «vuelve a conectar» en vez de una lista
          -- vacía que parece pérdida de datos.
          status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','revoked')),
          connected_by TEXT,
          connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_error_at DATETIME,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (connected_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
    }
  },
  {
    version: 35,
    description: 'labels: nombres únicos por espacio e índices para el filtrado',
    run: () => {
      // Las tablas de etiquetas existían desde el principio pero no las usaba
      // nadie. Antes de ponerlas en marcha hay que cerrar dos huecos.

      // 1. Nada impedía dos «Urgente» en el mismo espacio. Con el filtro por
      //    etiqueta eso son dos entradas idénticas en la lista y ninguna forma
      //    de saber cuál es cuál. Se limpian los duplicados que hubiera —en la
      //    práctica ninguno, porque la tabla está vacía— antes de crear el
      //    índice, porque si no el CREATE falla y con él la migración entera.
      db.exec(`
        DELETE FROM labels WHERE id NOT IN (
          SELECT MIN(id) FROM labels GROUP BY workspace_id, name COLLATE NOCASE
        )
      `);
      // COLLATE NOCASE: «Urgente» y «urgente» son la misma etiqueta para
      // cualquiera que las lea, y tenerlas separadas solo reparte lo mismo en
      // dos sitios.
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_labels_nombre_unico
        ON labels(workspace_id, name COLLATE NOCASE)
      `);

      // 2. Las puentes solo tenían índice por su clave primaria, que empieza
      //    por la entidad. «Qué tickets llevan esta etiqueta» —justo lo que
      //    hace el filtro— recorría la tabla entera.
      db.exec('CREATE INDEX IF NOT EXISTS idx_issue_labels_label ON issue_labels(label_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_page_labels_label ON page_labels(label_id)');
    }
  },
  {
    version: 36,
    description: 'drive_folders y drive_files: los archivos que viven en Drive',
    run: () => {
      // Tablas propias, y no `attachments`.
      //
      // Un adjunto está siempre colgado de algo —un ticket, una página— y muere
      // con ello. Un archivo de esta sección es del **espacio**: vive en una
      // carpeta, puede no estar atado a nada y puede estarlo a varias cosas a
      // la vez. Meter las dos ideas en la misma tabla obliga a que la mitad de
      // las columnas estén siempre a nulo y a que cada consulta explique cuál
      // de los dos casos está mirando.
      //
      // Lo que se guarda aquí son **metadatos**. Los bytes están en el Drive de
      // quien conectó la cuenta y no pasan por esta máquina en ningún momento.
      db.exec(`
        CREATE TABLE IF NOT EXISTS drive_folders (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          -- NULL = cuelga de la carpeta del espacio.
          parent_id TEXT,
          name TEXT NOT NULL,
          -- Id de la carpeta en Drive. Puede faltar si se creó aquí y la
          -- llamada a Drive falló: la carpeta existe en Forge y se sincroniza
          -- después, en vez de perder lo que la persona ya había ordenado.
          drive_id TEXT,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_id) REFERENCES drive_folders(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_drive_folders_ws ON drive_folders(workspace_id, parent_id)');
      // Dos carpetas con el mismo nombre en el mismo sitio son indistinguibles
      // para quien las mira. `IFNULL` porque en SQLite dos NULL no chocan en un
      // índice único, y la raíz del espacio es justamente `parent_id IS NULL`.
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_drive_folders_nombre
        ON drive_folders(workspace_id, IFNULL(parent_id, ''), name COLLATE NOCASE)
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS drive_files (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          folder_id TEXT,
          -- Id del archivo en Drive. Único: el mismo archivo no puede estar dos
          -- veces en la lista.
          drive_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          mime_type TEXT,
          size_bytes INTEGER,
          web_view_link TEXT,
          uploaded_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          -- 'ok' | 'missing'. Se marca cuando Drive dice que ya no está —lo
          -- borraron desde el Drive, o se perdió el acceso—. La fila **no** se
          -- borra: una lista que encoge sola parece pérdida de datos.
          status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','missing')),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (folder_id) REFERENCES drive_folders(id) ON DELETE SET NULL,
          FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_drive_files_ws ON drive_files(workspace_id, folder_id, created_at DESC)');
    }
  },
  {
    version: 37,
    description: 'archivos: etiquetas, vínculos con tickets y páginas, e historial de búsqueda',
    run: () => {
      // Las mismas etiquetas del espacio que llevan los tickets y las páginas.
      // Ese es el punto: poder filtrar «Parcial 2» y que salgan la tarea, los
      // apuntes y el PDF.
      db.exec(`
        CREATE TABLE IF NOT EXISTS file_labels (
          file_id TEXT NOT NULL,
          label_id TEXT NOT NULL,
          PRIMARY KEY (file_id, label_id),
          FOREIGN KEY (file_id) REFERENCES drive_files(id) ON DELETE CASCADE,
          FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_file_labels_label ON file_labels(label_id)');

      // Un archivo colgado de un ticket o de una página.
      //
      // Tabla aparte y no una columna en `drive_files`: el mismo PDF puede
      // estar en tres tareas —la guía del laboratorio vale para las tres
      // prácticas— y una columna obligaría a subirlo tres veces.
      db.exec(`
        CREATE TABLE IF NOT EXISTS drive_file_links (
          file_id TEXT NOT NULL,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('issue','page')),
          entity_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (file_id, entity_type, entity_id),
          FOREIGN KEY (file_id) REFERENCES drive_files(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_drive_file_links_entidad ON drive_file_links(entity_type, entity_id)');

      // Historial de búsqueda, por persona y espacio.
      //
      // No es un registro de auditoría: es para poder repetir una búsqueda de
      // ayer sin volver a escribirla. Por eso se guarda poco y se limpia solo
      // (ver `lib/driveFiles`), en vez de acumular todo lo que alguien ha
      // buscado nunca.
      db.exec(`
        CREATE TABLE IF NOT EXISTS file_searches (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          query TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        )
      `);
      // Una consulta repetida sube al principio en vez de duplicarse.
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_file_searches_unica
        ON file_searches(user_id, workspace_id, query COLLATE NOCASE)
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_file_searches_recientes ON file_searches(user_id, workspace_id, created_at DESC)');
    }
  },
  {
    version: 38,
    description: 'tipos de ticket propios por espacio, y quitar la CHECK que los impedía',
    run: () => {
      // El alcance es **el espacio**, no la cuenta.
      //
      // Un tipo de ticket describe cómo trabaja un equipo: si «Incidencia» y
      // «Mantenimiento» fueran de la persona, aparecerían en el tablero de otro
      // equipo que no los usa, y al irse esa persona el espacio se quedaría con
      // tickets de un tipo que ya no existe para nadie.
      db.exec(`
        CREATE TABLE IF NOT EXISTS issue_types (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          key TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          -- Los de fábrica se distinguen para poder traducir su nombre. Los
          -- propios no se traducen: los escribió alguien, en su idioma.
          is_builtin INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_types_clave ON issue_types(workspace_id, key)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_issue_types_espacio ON issue_types(workspace_id, position)');

      /**
       * `issues.type` sigue guardando la **clave**, no el id de la fila.
       *
       * Es lo que evita reescribir la columna de todos los tickets que ya
       * existen: 'task' seguía significando lo mismo antes y después. Con ids,
       * esta migración tendría que tocar cada ticket del sistema y una base a
       * medio migrar dejaría tickets sin tipo.
       */
      const espacios = db.prepare('SELECT id FROM workspaces').all() as Array<{ id: string }>;
      const insertaTipo = db.prepare(`
        INSERT OR IGNORE INTO issue_types (id, workspace_id, key, name, color, position, is_builtin)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `);
      // Los colores salen de la paleta de etiquetas, que ya pasa contraste en
      // los dos temas.
      const DE_FABRICA = [
        { key: 'task',  name: 'Task',  color: '#3B82F6' },
        { key: 'bug',   name: 'Bug',   color: '#EF4444' },
        { key: 'story', name: 'Story', color: '#22C55E' },
        { key: 'epic',  name: 'Epic',  color: '#A855F7' },
      ];
      for (const ws of espacios) {
        DE_FABRICA.forEach((t, i) => {
          insertaTipo.run(`${ws.id}:${t.key}`, ws.id, t.key, t.name, t.color, i);
        });
      }

      /**
       * Quitar `CHECK(type IN ('epic','story','task','bug'))`.
       *
       * Sin esto, un tipo propio se guarda bien en `issue_types` y **revienta**
       * al crear el primer ticket que lo use: la función queda montada entera y
       * solo falla en el último paso.
       *
       * SQLite no sabe quitar una restricción; hay que rehacer la tabla. El
       * orden importa mucho más de lo que parece: se crea la nueva con un
       * nombre temporal, se copia, se **suelta la vieja** y solo entonces se
       * renombra la nueva.
       *
       * Lo intuitivo —renombrar `issues` a `issues_old` primero— corrompe la
       * base en silencio. Desde SQLite 3.25, `ALTER TABLE RENAME` reescribe las
       * cláusulas `REFERENCES` de las **demás** tablas para que sigan apuntando
       * al nombre nuevo, así que `issue_labels`, `work_logs` y las otras tres
       * acaban apuntando a `issues_old`; al soltarla quedan con una clave
       * ajena hacia una tabla que no existe. No da ningún error al migrar:
       * salta semanas después, al borrar un espacio, con «no such table:
       * main.issues_old». Renombrando al final, la que se renombra no tiene a
       * nadie apuntándola y no hay nada que reescribir.
       *
       * `foreign_keys` está desactivado durante todo esto —lo hace el runner,
       * fuera de la transacción, porque el PRAGMA no hace nada dentro de una—,
       * que es lo que impide que soltar la tabla vieja arrastre en cascada los
       * tickets de las tablas que cuelgan de ella.
       *
       * Los índices se van con la tabla y hay que rehacerlos: perderlos no da
       * ningún error, solo un tablero cada vez más lento sin explicación.
       */
      const esquema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='issues'").get() as any;
      if (esquema && esquema.sql.includes("CHECK(type IN")) {
        db.exec(`
          CREATE TABLE issues_nueva (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            sprint_id TEXT,
            parent_issue_id TEXT,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'todo',
            priority TEXT CHECK(priority IN ('lowest', 'low', 'medium', 'high', 'highest')) DEFAULT 'medium',
            story_points INTEGER DEFAULT 0,
            estimated_hours REAL DEFAULT 0.0,
            logged_hours REAL DEFAULT 0.0,
            position REAL DEFAULT 0.0,
            reporter_id TEXT NOT NULL,
            assignee_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            due_date DATETIME,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
            FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
            FOREIGN KEY (parent_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
            FOREIGN KEY (reporter_id) REFERENCES users(id),
            FOREIGN KEY (assignee_id) REFERENCES users(id)
          )
        `);
        // Por nombre de columna y no `SELECT *`: el orden de la tabla vieja no
        // es el del CREATE de arriba —`due_date` se añadió después y quedó al
        // final—, y un `INSERT ... SELECT *` casaría columnas por posición.
        db.exec(`
          INSERT INTO issues_nueva (
            id, workspace_id, sprint_id, parent_issue_id, type, title, description,
            status, priority, story_points, estimated_hours, logged_hours, position,
            reporter_id, assignee_id, created_at, updated_at, due_date
          )
          SELECT
            id, workspace_id, sprint_id, parent_issue_id, type, title, description,
            status, priority, story_points, estimated_hours, logged_hours, position,
            reporter_id, assignee_id, created_at, updated_at, due_date
          FROM issues
        `);
        db.exec('DROP TABLE issues');

        /**
         * `legacy_alter_table` para el renombrado final.
         *
         * Sin él, `RENAME` reparsea todos los triggers y vistas del esquema
         * para reescribir las referencias, y los tres triggers de `work_logs`
         * nombran a `issues`, que en este punto acaba de soltarse. El renombrado
         * muere con «error in trigger trg_work_logs_insert: no such table:
         * main.issues» y la migración se queda sin tabla de tickets.
         *
         * Activándolo, `RENAME` vuelve a ser lo que dice ser: cambiar el nombre
         * y nada más. Es justo lo que hace falta aquí, porque lo que las demás
         * tablas y los triggers dicen —`issues`— ya es lo correcto en cuanto
         * termina.
         */
        const legado = db.pragma('legacy_alter_table', { simple: true });
        db.pragma('legacy_alter_table = ON');
        try {
          db.exec('ALTER TABLE issues_nueva RENAME TO issues');
        } finally {
          db.pragma(`legacy_alter_table = ${legado ? 'ON' : 'OFF'}`);
        }
        db.exec('CREATE INDEX IF NOT EXISTS idx_issues_workspace ON issues(workspace_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_issues_metrics ON issues(workspace_id, sprint_id, status)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_issues_workspace_status ON issues(workspace_id, status)');
      }
    }
  },
];

// El bucle entero va dentro de una transacción IMMEDIATE.
//
// Comprobar `schema_migrations` y luego aplicar la migración es un
// check-then-act: no es atómico entre procesos. Si varios abren una base nueva
// a la vez, todos leen la misma versión como pendiente y todos ejecutan el
// mismo ALTER TABLE. Uno gana y el resto muere con "duplicate column name" o
// "UNIQUE constraint failed: schema_migrations.version".
//
// BEGIN IMMEDIATE toma el lock de escritura de entrada, así que solo un proceso
// migra. Los demás esperan (busy_timeout, arriba), y cuando entran leen
// schema_migrations ya actualizada y no les queda nada por hacer.
const applyMigrations = db.transaction(() => {
  for (const m of MIGRATIONS) {
    const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(m.version);
    if (applied) continue;
    try {
      m.run();
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version);
    } catch (e: any) {
      // Fail loudly so broken migrations are never silently ignored
      console.error(`[DB] Migration v${m.version} (${m.description}) failed: ${e.message}`);
      throw e;
    }
  }
});

// PRAGMA foreign_keys no hace nada dentro de una transacción, así que hay que
// desactivarlo aquí y no dentro de la migración que reconstruye `attachments`.
// Es además lo que recomienda SQLite para cambios de esquema.
db.pragma('foreign_keys = OFF');
try {
  applyMigrations.immediate();
} finally {
  db.pragma('foreign_keys = ON');
}

// ── Expired Guest Cleanup ─────────────────────────────────────────────────────
// Runs once at startup. Removes guest accounts whose session has expired.
// These users never converted to real accounts and can no longer log in.
// SQLite CASCADE handles sessions and workspace_members automatically.
// Workspaces must be deleted first since created_by has no CASCADE.
try {
  const expiredGuests = db.prepare(`
    SELECT id FROM users
    WHERE is_guest = 1
      AND id NOT IN (SELECT user_id FROM sessions WHERE expires_at > ?)
      AND id != 'system'
  `).all(Date.now()) as { id: string }[];

  if (expiredGuests.length > 0) {
    const ids = expiredGuests.map(g => g.id);
    const placeholders = ids.map(() => '?').join(',');
    const guestCleanup = db.transaction(() => {
      // Delete owned workspaces first (workspaces.created_by has no CASCADE)
      db.prepare(`DELETE FROM workspaces WHERE created_by IN (${placeholders})`).run(...ids);
      // Delete users — CASCADE removes sessions and workspace_members
      db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...ids);
    });
    guestCleanup();
    console.log(`[DB] Cleaned up ${ids.length} expired guest account(s).`);
  }
} catch (e) {
  // Non-fatal: log and continue. The app is still usable.
  console.error('[DB] Guest cleanup failed:', e);
}

/**
 * Fotos diarias de los sprints activos.
 *
 * Sin esto, `sprint_snapshots` estaba **permanentemente vacía**: el módulo que
 * la llena (`lib/sprintSnapshots.ts`) se escribió, se probó y no lo llamaba
 * nadie. El CHANGELOG anunció el arreglo del burndown en la v1.12.0 y doce
 * versiones después el endpoint seguía recalculando desde el estado actual.
 *
 * Va aquí, junto a la limpieza de invitados, porque es el mismo tipo de tarea y
 * el mismo sitio donde ya se hace: al arrancar y luego cada día. No hace falta
 * un cron ni un timer aparte para una foto que cuesta una consulta por sprint
 * activo.
 *
 * Dos detalles que no se ven:
 *
 *  - `tomarFoto` es idempotente por día, así que reiniciar el servicio cinco
 *    veces en una tarde no ensucia nada: refresca la foto de hoy y no toca las
 *    anteriores.
 *  - El intervalo lleva `unref()`. Sin él, un temporizador vivo mantiene el
 *    proceso de Node arrancado y los tests que importan este módulo se quedan
 *    colgados al terminar sin que nada explique por qué.
 */
function fotografiarHoy() {
  try {
    const activos = db.prepare("SELECT id FROM sprints WHERE status = 'active'").all() as Array<{ id: string }>;
    if (activos.length === 0) return;

    const hoy = new Date().toISOString().slice(0, 10);
    const medir = db.prepare(`
      SELECT
        COUNT(*) AS issuesTotal,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS issuesDone,
        COALESCE(SUM(story_points), 0) AS pointsTotal,
        COALESCE(SUM(CASE WHEN status = 'done' THEN story_points ELSE 0 END), 0) AS pointsDone
      FROM issues WHERE sprint_id = ?
    `);
    const guardar = db.prepare(`
      INSERT INTO sprint_snapshots (id, sprint_id, taken_on, points_total, points_done, issues_total, issues_done)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sprint_id, taken_on) DO UPDATE SET
        points_total = excluded.points_total,
        points_done  = excluded.points_done,
        issues_total = excluded.issues_total,
        issues_done  = excluded.issues_done
    `);

    const tx = db.transaction(() => {
      for (const s of activos) {
        const m = medir.get(s.id) as any;
        guardar.run(crypto.randomUUID(), s.id, hoy, m.pointsTotal, m.pointsDone, m.issuesTotal, m.issuesDone);
      }
    });
    tx();
  } catch (e) {
    // No es fatal: sin foto de hoy el burndown enseña hasta ayer.
    console.error('[DB] Foto diaria de sprints fallida:', e);
  }
}

if (process.env.NODE_ENV !== 'test') {
  fotografiarHoy();
  setInterval(fotografiarHoy, 6 * 60 * 60 * 1000).unref();
}

export default db;
