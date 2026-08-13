import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

import { execSync } from 'child_process';
import db from '../../src/lib/db';

export default function resetDb() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('SECURITY HALT: reset-db.ts no puede ejecutarse fuera de NODE_ENV=test.');
  }
  
  const dbPath = path.join(process.cwd(), 'forge_test.db');
  
  // Actually, importing db from src/lib/db automatically creates tables if they don't exist.
  // We just need to DELETE FROM all tables to clear them out, then insert test data.
  // Since db is already loaded, we can't delete the file, we just clear tables.
  
  db.exec(`
    DELETE FROM attachments;
    DELETE FROM pages;
    DELETE FROM issues;
    DELETE FROM sprints;
    DELETE FROM workspace_members;
    DELETE FROM workspace_join_requests;
    DELETE FROM workspaces;
    DELETE FROM sessions;
    DELETE FROM friendships;
    DELETE FROM user_blocks;
    DELETE FROM users;
  `);

  // Seed data
  const pwHash = bcrypt.hashSync((process.env.TEST_PASSWORD || 'LocalDevPass123!'), 10);
  
  // Re-add 'jose' because several legacy tests (kanban.spec.ts, ui_integrity.spec.ts) depend on it
  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-jose', 'jose', pwHash, 1);

  // Usuario dedicado para la prueba de renombrado en Settings.
  //
  // Antes esa prueba renombraba a 'jose' y lo deshacía al terminar. Como media
  // docena de specs inician sesión como 'jose' y Playwright los corre en
  // paralelo, cualquiera que cayera dentro de esa ventana fallaba con un
  // timeout de login — un fallo distinto en cada corrida, imposible de
  // reproducir aislando el test.
  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-rename', 'rename_me', pwHash, 0);

  // Usuario propio para las pruebas de Ajustes.
  //
  // Guardar el perfil escribe **todos** los campos a la vez, así que hacerlo
  // sobre 'jose' —que usan otros diez specs— le cambiaba la biografía y el
  // correo por debajo mientras otro test miraba su nombre de usuario. Falla uno
  // distinto en cada corrida y pasa al aislarlo, que es el síntoma de siempre.
  db.prepare(`
    INSERT INTO users (id, username, password_hash, email, is_sysadmin)
    VALUES (?, ?, ?, ?, ?)
  `).run('test-user-profile', 'profile_user', pwHash, 'profile@example.test', 0);

  // Y otro para las automatizaciones, que crean espacios de trabajo propios.
  // Hacerlo con 'jose' le cambiaba el `last_workspace_id` por debajo a los
  // specs que dependen de dónde está parado.
  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-autom', 'autom_user', pwHash, 0);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-invit', 'invit_user', pwHash, 0);

  // Para el borrado de cuenta. Se recrea en cada corrida justo porque la
  // prueba lo destruye: es su objeto de estudio.
  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-del', 'del_user', pwHash, 0);

  // El ómnibus renombra una cuenta y la devuelve a su nombre al terminar. Tenía
  // que compartir `rename_me` con `username-rules.spec.ts`, y como la suite
  // corre en paralelo, la limpieza de una carrera deshacía el renombrado de la
  // otra: el ómnibus fallaba una de cada cuatro veces con un «Received:
  // undefined» que parecía un fallo del guardado. No lo era — el UPDATE se
  // ejecutaba siempre y afectaba a su fila.
  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-omnibus', 'omnibus_user', pwHash, 0);

  // Para la prueba de silenciado de notificaciones. Aparte a propósito: ese
  // caso apaga una categoría, y compartir cuenta con el caso de «sí llega»
  // hacía que uno silenciara al otro en las corridas en paralelo.
  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-mute', 'mute_user', pwHash, 0);

  // Cuatro cuentas con los cuatro papeles posibles frente a un mismo espacio,
  // para la auditoría de permisos. Se montan aquí y no en el propio spec
  // porque son el escenario, no el sujeto: si cada prueba las creara, el
  // escenario formaría parte de lo que se está midiendo.
  for (const [id, nombre] of [
    ['aud-owner', 'aud_owner'],
    ['aud-editor', 'aud_editor'],
    ['aud-viewer', 'aud_viewer'],
    ['aud-fuera', 'aud_fuera'],
    // Propia para la prueba de sesiones: esa cambia la contraseña, y hacerlo
    // sobre una cuenta compartida le rompe el login a los demás casos.
    ['aud-pass', 'aud_pass'],
  ] as const) {
    db.prepare('INSERT INTO users (id, username, password_hash, is_sysadmin) VALUES (?, ?, ?, 0)')
      .run(id, nombre, pwHash);
  }

  db.prepare('INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES (?, ?, ?, ?)')
    .run('ws-auditoria', 'Auditoria', 'auditoria-ws', 'aud-owner');
  for (const [uid, rol] of [['aud-owner', 'owner'], ['aud-editor', 'editor'], ['aud-viewer', 'viewer']] as const) {
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)')
      .run('ws-auditoria', uid, rol);
  }
  db.prepare(`INSERT INTO issues (id, workspace_id, title, type, reporter_id, status)
              VALUES ('i-auditoria', 'ws-auditoria', 'Ticket privado', 'task', 'aud-owner', 'todo')`).run();
  db.prepare(`INSERT INTO pages (id, workspace_id, title, created_by)
              VALUES ('p-auditoria', 'ws-auditoria', 'Pagina privada', 'aud-owner')`).run();
  // Una segunda página para la prueba de inyección: comparte espacio con la
  // anterior pero no contenido, porque las dos escriben y en paralelo se
  // pisaban.
  db.prepare(`INSERT INTO pages (id, workspace_id, title, created_by)
              VALUES ('p-inyeccion', 'ws-auditoria', 'Pagina de inyeccion', 'aud-owner')`).run();

  db.prepare(`
    INSERT INTO workspaces (id, name, sys_tag, created_by)
    VALUES (?, ?, ?, ?)
  `).run('ws-jose-test', 'Test Workspace', 'test-workspace', 'test-user-jose');

  db.prepare(`
    INSERT INTO workspace_members (workspace_id, user_id, ws_role)
    VALUES (?, ?, ?)
  `).run('ws-jose-test', 'test-user-jose', 'owner');
  
  db.prepare(`
    INSERT INTO issues (id, workspace_id, type, title, reporter_id, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('test-kanban-issue-1', 'ws-jose-test', 'task', 'Test E2E Drag & Drop', 'test-user-jose', 'todo');
  
  // Insert TestUser1 for settings test
  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-settings', 'TestUserSettings', pwHash, 0);

  // Insert TestUser2 for sidebar active test
  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-sidebar', 'TestUserSidebar', pwHash, 1);
  
  db.prepare(`
    INSERT INTO workspace_members (workspace_id, user_id, ws_role)
    VALUES (?, ?, ?)
  `).run('ws-jose-test', 'test-user-sidebar', 'editor');

  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-notion-a', 'TestUserNotionA', pwHash, 0);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-notion-b', 'TestUserNotionB', pwHash, 0);

  db.prepare(`
    INSERT INTO workspaces (id, name, sys_tag, created_by)
    VALUES (?, ?, ?, ?)
  `).run('ws-notion-a', 'Notion Workspace A', 'notion-ws-a', 'test-user-notion-a');

  db.prepare(`
    INSERT INTO workspaces (id, name, sys_tag, created_by)
    VALUES (?, ?, ?, ?)
  `).run('ws-notion-b', 'Notion Workspace B', 'notion-ws-b', 'test-user-notion-b');

  db.prepare(`
    INSERT INTO workspace_members (workspace_id, user_id, ws_role)
    VALUES (?, ?, ?)
  `).run('ws-notion-a', 'test-user-notion-a', 'owner');

  db.prepare(`
    INSERT INTO workspace_members (workspace_id, user_id, ws_role)
    VALUES (?, ?, ?)
  `).run('ws-notion-b', 'test-user-notion-b', 'owner');

  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-notion-c', 'TestUserNotionC', pwHash, 0);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-notion-d', 'TestUserNotionD', pwHash, 0);

  db.prepare(`
    INSERT INTO workspaces (id, name, sys_tag, created_by)
    VALUES (?, ?, ?, ?)
  `).run('ws-notion-c', 'Notion Workspace C', 'notion-ws-c', 'test-user-notion-c');

  db.prepare(`
    INSERT INTO workspaces (id, name, sys_tag, created_by)
    VALUES (?, ?, ?, ?)
  `).run('ws-notion-d', 'Notion Workspace D', 'notion-ws-d', 'test-user-notion-d');

  db.prepare(`
    INSERT INTO workspace_members (workspace_id, user_id, ws_role)
    VALUES (?, ?, ?)
  `).run('ws-notion-c', 'test-user-notion-c', 'owner');

  db.prepare(`
    INSERT INTO workspace_members (workspace_id, user_id, ws_role)
    VALUES (?, ?, ?)
  `).run('ws-notion-d', 'test-user-notion-d', 'owner');

  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_sysadmin)
    VALUES (?, ?, ?, ?)
  `).run('test-user-notion-e', 'TestUserNotionE', pwHash, 0);

  db.prepare(`
    INSERT INTO workspace_members (workspace_id, user_id, ws_role)
    VALUES (?, ?, ?)
  `).run('ws-notion-c', 'test-user-notion-e', 'viewer');
}
