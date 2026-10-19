CREATE TABLE users (
 id TEXT PRIMARY KEY,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 is_sysadmin BOOLEAN DEFAULT 0 CHECK(is_sysadmin IN (0, 1)),
 avatar_url TEXT DEFAULT '/default-avatar.svg',
 theme_preference TEXT DEFAULT 'orion_neon',
 last_workspace_id TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sessions (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
 CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sys_tag TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  created_by TEXT NOT NULL,
  is_public BOOLEAN DEFAULT 0 CHECK(is_public IN (0, 1)),
  join_policy TEXT DEFAULT 'disabled' CHECK(join_policy IN ('open', 'friends_only', 'disabled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Funciones del tablero que se encienden por espacio (migración 40).
  feat_sprints INTEGER NOT NULL DEFAULT 0 CHECK (feat_sprints IN (0, 1)),
  feat_time INTEGER NOT NULL DEFAULT 0 CHECK (feat_time IN (0, 1)),
  feat_points INTEGER NOT NULL DEFAULT 0 CHECK (feat_points IN (0, 1)),
  FOREIGN KEY (created_by) REFERENCES users(id)
 );
CREATE TABLE workspace_members (
 workspace_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 ws_role TEXT NOT NULL CHECK(ws_role IN ('owner', 'editor', 'commenter', 'viewer')),
 joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (workspace_id, user_id),
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_ws_members_user ON workspace_members(user_id);
CREATE TABLE sprints (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 name TEXT NOT NULL,
 start_date DATETIME,
 end_date DATETIME,
 status TEXT CHECK(status IN ('planned', 'active', 'completed')) DEFAULT 'planned', goal TEXT,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE issues (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 sprint_id TEXT,
 parent_issue_id TEXT,
 type TEXT NOT NULL CHECK(type IN ('epic', 'story', 'task', 'bug')),
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
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, due_date DATETIME,
 done_at DATETIME, -- cuándo pasó a Hecho (migración 41)
 due_time TEXT CHECK (due_time IS NULL OR due_time GLOB '[0-2][0-9]:[0-5][0-9]'), -- hora de pared, sin zona (migración 42)
 recurrence TEXT, -- regla de repetición, ver src/lib/recurrencia.ts (migración 45)
 next_issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL, -- la siguiente creada al completar (migración 45)
 planned_date DATE, -- el día en que se piensa hacer; due_date es la entrega (migración 46)
 reminder_minutes INTEGER, -- antelación del recordatorio (migración 50)
 reminded_at DATETIME, -- cuándo se avisó (migración 50)
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
 FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
 FOREIGN KEY (parent_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
 FOREIGN KEY (reporter_id) REFERENCES users(id),
 FOREIGN KEY (assignee_id) REFERENCES users(id)
);
CREATE INDEX idx_issues_workspace ON issues(workspace_id);
CREATE TABLE work_logs (
 id TEXT PRIMARY KEY,
 issue_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 hours_spent REAL NOT NULL,
 description TEXT,
 logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE pages (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 parent_page_id TEXT,
 title TEXT NOT NULL DEFAULT 'Untitled',
 icon TEXT,
 cover_image TEXT,
 content_json TEXT, -- {"format":"tiptap","doc":…}; ver src/lib/notes/content.ts
 created_by TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 position REAL NOT NULL DEFAULT 0, -- orden dentro de su nivel (migración 39)
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
 FOREIGN KEY (parent_page_id) REFERENCES pages(id) ON DELETE CASCADE,
 FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE document_chunks (
 id TEXT PRIMARY KEY,
 entity_id TEXT NOT NULL,
 workspace_id TEXT NOT NULL,
 chunk_text TEXT NOT NULL,
 embedding_vector BLOB, -- Serialized Float32Array para búsqueda vectorial LLM
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE dynamic_databases (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 name TEXT NOT NULL,
 schema_json TEXT NOT NULL,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE dynamic_entries (
 id TEXT PRIMARY KEY,
 database_id TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (database_id) REFERENCES dynamic_databases(id) ON DELETE CASCADE,
 FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE entry_relations (
 source_entry_id TEXT NOT NULL,
 target_entry_id TEXT NOT NULL,
 PRIMARY KEY (source_entry_id, target_entry_id),
 FOREIGN KEY (source_entry_id) REFERENCES dynamic_entries(id) ON DELETE CASCADE,
 FOREIGN KEY (target_entry_id) REFERENCES dynamic_entries(id) ON DELETE CASCADE
);
CREATE TABLE public_forms (
 id TEXT PRIMARY KEY,
 dynamic_database_id TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT,
 is_active BOOLEAN DEFAULT 1 CHECK(is_active IN (0, 1)),
 FOREIGN KEY (dynamic_database_id) REFERENCES dynamic_databases(id) ON DELETE CASCADE
);
CREATE TABLE channels (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 name TEXT NOT NULL,
 type TEXT DEFAULT 'public' CHECK(type IN ('public', 'private')),
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE messages (
 id TEXT PRIMARY KEY,
 channel_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 content TEXT NOT NULL,
 is_edited BOOLEAN DEFAULT 0 CHECK(is_edited IN (0, 1)),
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE attachments (
 id TEXT PRIMARY KEY,
 entity_type TEXT NOT NULL CHECK(entity_type IN ('issue', 'page', 'dynamic_entry', 'message')),
 entity_id TEXT NOT NULL,
 file_name TEXT NOT NULL,
 file_path TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 uploaded_by TEXT NOT NULL,
 uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE TABLE automations (
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
CREATE TABLE audit_logs (
 id TEXT PRIMARY KEY,
 user_id TEXT,
 action TEXT NOT NULL,
 entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 details_json TEXT,
 timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE notifications (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 is_read BOOLEAN DEFAULT 0 CHECK(is_read IN (0, 1)),
 link_url TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP, type TEXT DEFAULT 'info',
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE labels (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#00E5FF',
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_labels_workspace ON labels(workspace_id);
CREATE TABLE issue_labels (
  issue_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (issue_id, label_id),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);
CREATE TABLE page_labels (
  page_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (page_id, label_id),
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);
CREATE TABLE issue_page_links (
  issue_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  linked_by TEXT NOT NULL,
  linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (issue_id, page_id),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_by) REFERENCES users(id)
);
CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target_date DATETIME,
  status TEXT CHECK(status IN ('planned', 'achieved', 'missed')) DEFAULT 'planned',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_milestones_workspace ON milestones(workspace_id);
CREATE TABLE time_tracking_sessions (
 id TEXT PRIMARY KEY,
 issue_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE friendships (
  id TEXT PRIMARY KEY,
  user_a_id TEXT NOT NULL,
  user_b_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected','ended','blocked')),
  action_user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK (user_a_id < user_b_id),
  CHECK (user_a_id != user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE user_blocks (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE TABLE workspace_join_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, user_id)
);

-- Tablero (migraciones 44–50): ver src/lib/db.ts.
CREATE INDEX IF NOT EXISTS idx_issues_parent ON issues(parent_issue_id);
CREATE TABLE IF NOT EXISTS saved_views (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 name TEXT NOT NULL,
 query_json TEXT NOT NULL,
 position INTEGER NOT NULL DEFAULT 0,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS task_templates (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 name TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 created_by TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
 FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS calendar_feeds (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 workspace_id TEXT,
 token_hash TEXT NOT NULL UNIQUE,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 last_fetched_at DATETIME,
 revoked_at DATETIME,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
