import { sqliteTable, text, } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const dynamicDatabases = sqliteTable('dynamic_databases', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  sysTag: text('sys_tag').notNull(),
  description: text('description'),
  icon: text('icon'),
  schemaJson: text('schema_json').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const dynamicEntries = sqliteTable('dynamic_entries', {
  id: text('id').primaryKey(),
  databaseId: text('database_id').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdBy: text('created_by'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const dynamicViews = sqliteTable('dynamic_views', {
  id: text('id').primaryKey(),
  databaseId: text('database_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'table', 'gallery', etc.
  filtersJson: text('filters_json'),
  sortJson: text('sort_json'),
  visibleColumnsJson: text('visible_columns_json'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
