export interface User {
  id: string;
  username: string;
  password_hash: string;
  is_sysadmin: 0 | 1;
  avatar_url: string;
  theme_preference: string;
  last_workspace_id: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
}

export interface Workspace {
  id: string;
  name: string;
  sys_tag: string;
  icon: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
}

export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  ws_role: WorkspaceRole;
  joined_at: string;
}

export interface Sprint {
  id: string;
  workspace_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: 'planned' | 'active' | 'completed';
  goal: string | null;
}

export interface Issue {
  id: string;
  workspace_id: string;
  sprint_id: string | null;
  parent_issue_id: string | null;
  type: 'epic' | 'story' | 'task' | 'bug';
  title: string;
  description: string | null;
  status: string;
  priority: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  story_points: number;
  estimated_hours: number;
  logged_hours: number;
  position: number;
  reporter_id: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
}

export interface WorkLog {
  id: string;
  issue_id: string;
  user_id: string;
  hours_spent: number;
  description: string | null;
  logged_at: string;
}

export interface Page {
  id: string;
  workspace_id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  cover_image: string | null;
  content_json: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Orden dentro de su nivel del árbol (migración 39). */
  position: number;
}

export interface DocumentChunk {
  id: string;
  entity_id: string;
  workspace_id: string;
  chunk_text: string;
  embedding_vector: any; // Blob/Buffer
}

export interface DynamicDatabase {
  id: string;
  workspace_id: string;
  name: string;
  schema_json: string;
}

export interface DynamicEntry {
  id: string;
  database_id: string;
  payload_json: string;
  created_by: string;
  created_at: string;
}

export interface EntryRelation {
  source_entry_id: string;
  target_entry_id: string;
}

export interface PublicForm {
  id: string;
  dynamic_database_id: string;
  title: string;
  description: string | null;
  is_active: 0 | 1;
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  type: 'public' | 'private';
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  is_edited: 0 | 1;
  created_at: string;
}

export interface Attachment {
  id: string;
  entity_type: 'issue' | 'page' | 'dynamic_entry' | 'message';
  entity_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface Automation {
  id: string;
  workspace_id: string;
  name: string;
  trigger_type: string;
  trigger_condition: string;
  action_type: string;
  action_payload: string;
  is_active: 0 | 1;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details_json: string | null;
  timestamp: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: 0 | 1;
  link_url: string | null;
  created_at: string;
  type: string;
}

export interface Label {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export interface IssueLabel {
  issue_id: string;
  label_id: string;
}

export interface PageLabel {
  page_id: string;
  label_id: string;
}

export interface IssuePageLink {
  issue_id: string;
  page_id: string;
  linked_by: string;
  linked_at: string;
}

export interface Milestone {
  id: string;
  workspace_id: string;
  name: string;
  target_date: string | null;
  status: 'planned' | 'achieved' | 'missed';
  description: string | null;
  created_at: string;
}
