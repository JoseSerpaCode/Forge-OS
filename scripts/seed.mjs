#!/usr/bin/env node
/**
 * Development seed.
 *
 *   npm run seed            # refuses if the target database already has data
 *   npm run seed -- --force # wipes it first
 *
 * Populates a demo workspace with a sprint, a backlog spread across the four
 * Kanban columns, work logs (so the metrics charts have something to draw) and
 * a small knowledge base whose pages are linked back to issues.
 *
 * The password comes from TEST_PASSWORD, defaulting to LocalDevPass123!.
 * Everything here is fictional — never point this at a database you care about.
 */
import bcrypt from 'bcryptjs';
import db from '../src/lib/db.ts';

const FORCE = process.argv.includes('--force');
const PASSWORD = process.env.TEST_PASSWORD || 'LocalDevPass123!';

// Tables are ordered so that children go before their parents.
const TABLES = [
  'issue_page_links', 'work_logs', 'attachments', 'pages', 'issues', 'sprints',
  'notifications', 'workspace_members', 'workspace_join_requests', 'workspaces',
  'sessions', 'friendships', 'user_blocks',
];

// src/lib/db.ts always inserts a 'system' account, used as the author of system
// notifications and messages. It is infrastructure, not data: never count it as
// pre-existing content and never delete it, or those foreign keys break.
const SYSTEM_USER = 'system';

function existingRows() {
  return db.prepare('SELECT COUNT(*) AS n FROM users WHERE id != ?').get(SYSTEM_USER).n;
}

function wipe() {
  db.exec(TABLES.map((t) => `DELETE FROM ${t};`).join('\n'));
  db.prepare('DELETE FROM users WHERE id != ?').run(SYSTEM_USER);
}

/** Days from now as an ISO string; negative values are in the past. */
function daysOut(n) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

/** Minimal Editor.js payload: a heading followed by paragraphs and a list. */
function doc(heading, paragraphs, listItems = []) {
  const blocks = [
    { type: 'header', data: { text: heading, level: 2 } },
    ...paragraphs.map((text) => ({ type: 'paragraph', data: { text } })),
  ];
  if (listItems.length) {
    blocks.push({ type: 'list', data: { style: 'unordered', items: listItems } });
  }
  return JSON.stringify({ time: Date.now(), blocks, version: '2.31.6' });
}

const users = [
  { id: 'demo-user-avery', username: 'avery', sysadmin: 1, bio: 'Product lead. Keeps the roadmap honest.', pronouns: 'they/them' },
  { id: 'demo-user-blake', username: 'blake', sysadmin: 0, bio: 'Backend. SQLite maximalist.', pronouns: 'he/him' },
  { id: 'demo-user-noor', username: 'noor', sysadmin: 0, bio: 'Design systems and accessibility.', pronouns: 'she/her' },
];

const WS = { id: 'demo-ws-atlas', name: 'Atlas Platform', tag: 'atlas' };
const SPRINT = { id: 'demo-sprint-14', name: 'Sprint 14 — Billing & Search' };

// Closed sprints, so the velocity chart has a trend to draw. Without at least a
// couple of completed sprints the metrics page renders "Not enough completed
// sprints" and the screenshot looks broken.
const PAST_SPRINTS = [
  { id: 'demo-sprint-11', name: 'Sprint 11 — Attachments', start: -66, end: -52, points: [3, 5, 8] },
  { id: 'demo-sprint-12', name: 'Sprint 12 — Audit trail', start: -52, end: -38, points: [5, 5, 3, 2] },
  { id: 'demo-sprint-13', name: 'Sprint 13 — Public forms', start: -38, end: -24, points: [8, 3, 5, 5] },
];

const PAST_TITLES = [
  'Attachment storage abstraction', 'Signed download URLs', 'Thumbnail generation',
  'Audit log schema', 'Record membership changes', 'Audit retention policy', 'Export audit CSV',
  'Public form builder', 'Form submission throttling', 'Embed snippet generator', 'Form response inbox',
];

// [id, type, title, status, priority, points, estimated, assignee, description]
const issues = [
  ['demo-issue-1', 'epic',  'Usage-based billing',                'in_progress', 'highest', 21, 40, 'demo-user-avery', 'Umbrella epic covering metering, invoicing and the customer-facing billing page.'],
  ['demo-issue-2', 'story', 'Meter API requests per workspace',   'done',        'high',     8, 12, 'demo-user-blake', 'Persist a rolling counter per workspace so invoices can be generated from real usage.'],
  ['demo-issue-3', 'story', 'Invoice PDF generation',             'in_progress', 'high',     5, 10, 'demo-user-blake', 'Render invoices server-side and store them as attachments.'],
  ['demo-issue-4', 'task',  'Add plan selector to settings',      'review',      'medium',   3,  6, 'demo-user-noor',  'Plan cards with monthly and annual toggles, matching the design tokens.'],
  ['demo-issue-5', 'bug',   'Search drops results past page 3',   'in_progress', 'highest',  3,  4, 'demo-user-blake', 'Offset is computed before the tenant filter is applied, so later pages come back short.'],
  ['demo-issue-6', 'story', 'Full-text search across pages',      'todo',        'high',     8, 16, 'demo-user-blake', 'Back the knowledge base with an FTS5 virtual table kept in sync by triggers.'],
  ['demo-issue-7', 'task',  'Keyboard shortcuts help modal',      'todo',        'low',      2,  3, 'demo-user-noor',  'Triggered by ?, listing every global shortcut grouped by area.'],
  ['demo-issue-8', 'task',  'Rate limit the public form endpoint','done',        'high',     3,  5, 'demo-user-blake', 'Per-IP token bucket persisted so restarts do not reset the window.'],
  ['demo-issue-9', 'story', 'Onboarding checklist for new spaces','todo',        'medium',   5,  8, 'demo-user-avery', 'Walk owners through inviting a teammate, creating a board and writing a first page.'],
  ['demo-issue-10','bug',   'Avatar upload rejects valid PNGs',   'review',      'medium',   2,  3, 'demo-user-noor',  'MIME sniffing rejects PNGs whose header carries a non-standard chunk order.'],
  ['demo-issue-11','task',  'Dark mode contrast pass',            'done',        'low',      2,  4, 'demo-user-noor',  'Bring every text/background pair up to WCAG AA.'],
  ['demo-issue-12','story', 'Audit log viewer',                   'todo',        'low',      5, 10, 'demo-user-avery', 'Filterable table over audit_logs with CSV export.'],
];

// [issueId, userId, hours, dayOffset, note]
const workLogs = [
  ['demo-issue-2',  'demo-user-blake', 4.5, -9, 'Counter schema and migration'],
  ['demo-issue-2',  'demo-user-blake', 3.0, -8, 'Backfill plus tests'],
  ['demo-issue-2',  'demo-user-avery', 1.5, -8, 'Reviewed the aggregation query'],
  ['demo-issue-8',  'demo-user-blake', 2.5, -7, 'Token bucket implementation'],
  ['demo-issue-8',  'demo-user-blake', 1.5, -6, 'Persistence across restarts'],
  ['demo-issue-11', 'demo-user-noor',  3.0, -6, 'Contrast audit and token fixes'],
  ['demo-issue-3',  'demo-user-blake', 5.0, -4, 'PDF renderer spike'],
  ['demo-issue-3',  'demo-user-blake', 2.0, -2, 'Wired invoices to attachments'],
  ['demo-issue-5',  'demo-user-blake', 1.5, -2, 'Reproduced with a seeded tenant'],
  ['demo-issue-4',  'demo-user-noor',  4.0, -3, 'Plan cards and annual toggle'],
  ['demo-issue-1',  'demo-user-avery', 2.0, -1, 'Scope review with the team'],
  ['demo-issue-10', 'demo-user-noor',  1.5, -1, 'Narrowed down the MIME check'],
];

const pages = [
  {
    id: 'demo-page-arch', title: 'Architecture overview', icon: '🏗️', parent: null,
    content: doc('How it fits together', [
      'Forge OS runs as a single Astro SSR process backed by SQLite. There is no separate API tier: route handlers under <code>src/pages/api</code> are the API.',
      'Every query is scoped by <code>workspace_id</code>. That scoping is the multi-tenant boundary, so it is enforced in the data layer rather than in the UI.',
    ], [
      'Astro SSR with the Node adapter',
      'better-sqlite3 for synchronous, in-process reads',
      'Socket.IO for realtime notifications',
    ]),
  },
  {
    id: 'demo-page-billing', title: 'Billing design notes', icon: '💳', parent: 'demo-page-arch',
    content: doc('Metering and invoicing', [
      'Usage is metered per workspace and rolled up nightly. Invoices are generated from the rollup, never from live counters, so a replay always produces the same document.',
      'Plan changes take effect at the start of the next cycle. Mid-cycle upgrades are prorated; downgrades are not.',
    ], [
      'Meter on request completion, not on request start',
      'Store invoices as attachments so they inherit workspace access rules',
    ]),
  },
  {
    id: 'demo-page-onboarding', title: 'Onboarding runbook', icon: '🚀', parent: null,
    content: doc('First five minutes', [
      'A new workspace owner should reach a populated board within five minutes. Anything that takes longer than that belongs in this runbook as a fix, not as a step.',
    ], [
      'Invite one teammate',
      'Create a board and a first sprint',
      'Write one knowledge base page',
    ]),
  },
];

// Pages surfaced as backlinks on the issue, and vice versa.
const pageLinks = [
  ['demo-issue-1', 'demo-page-billing'],
  ['demo-issue-3', 'demo-page-billing'],
  ['demo-issue-6', 'demo-page-arch'],
  ['demo-issue-9', 'demo-page-onboarding'],
];

const notifications = [
  ['demo-notif-1', 'demo-user-avery', 'Review requested', 'noor moved "Add plan selector to settings" to Review.', 0, 'info'],
  ['demo-notif-2', 'demo-user-avery', 'Sprint 14 is halfway', '6 of 12 issues remain. Velocity is tracking to plan.', 0, 'sprint'],
  ['demo-notif-3', 'demo-user-avery', 'Assigned to you', 'blake assigned "Usage-based billing" to you.', 1, 'assign'],
];

function seed() {
  const created = db.transaction(() => {
    const pwHash = bcrypt.hashSync(PASSWORD, 10);

    const insertUser = db.prepare(
      `INSERT INTO users (id, username, password_hash, is_sysadmin, bio, pronouns, is_public)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    );
    for (const u of users) insertUser.run(u.id, u.username, pwHash, u.sysadmin, u.bio, u.pronouns);

    db.prepare(
      `INSERT INTO workspaces (id, name, sys_tag, icon, description, created_by, is_public)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(WS.id, WS.name, WS.tag, '🛰️', 'Core platform team: billing, search and the public API.', users[0].id);

    const insertMember = db.prepare(
      'INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES (?, ?, ?)'
    );
    insertMember.run(WS.id, users[0].id, 'owner');
    insertMember.run(WS.id, users[1].id, 'editor');
    insertMember.run(WS.id, users[2].id, 'editor');

    db.prepare(
      `INSERT INTO sprints (id, workspace_id, name, start_date, end_date, status, goal)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`
    ).run(
      SPRINT.id, WS.id, SPRINT.name, daysOut(-10), daysOut(4),
      'Ship usage-based billing end to end and make search correct past the first page.'
    );

    const insertSprint = db.prepare(
      `INSERT INTO sprints (id, workspace_id, name, start_date, end_date, status, goal)
       VALUES (?, ?, ?, ?, ?, 'completed', ?)`
    );
    for (const s of PAST_SPRINTS) {
      insertSprint.run(s.id, WS.id, s.name, daysOut(s.start), daysOut(s.end), `Delivered in ${s.name}.`);
    }

    const insertIssue = db.prepare(
      `INSERT INTO issues (id, workspace_id, sprint_id, type, title, description, status,
                           priority, story_points, estimated_hours, position, reporter_id, assignee_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    issues.forEach(([id, type, title, status, priority, points, est, assignee, description], i) => {
      insertIssue.run(
        id, WS.id, SPRINT.id, type, title, description, status,
        priority, points, est, i * 100, users[0].id, assignee, daysOut(-12 + i)
      );
    });

    // Closed work from earlier sprints — all done, so velocity has real numbers.
    let t = 0;
    PAST_SPRINTS.forEach((s) => {
      s.points.forEach((pts, j) => {
        const title = PAST_TITLES[t % PAST_TITLES.length];
        insertIssue.run(
          `${s.id}-issue-${j + 1}`, WS.id, s.id, 'story', title,
          `Shipped as part of ${s.name}.`, 'done', 'medium',
          pts, pts * 2, j * 100, users[0].id, users[(t % 3)].id, daysOut(s.start)
        );
        t++;
      });
    });

    // The insert trigger on work_logs keeps issues.logged_hours in sync.
    const insertLog = db.prepare(
      `INSERT INTO work_logs (id, issue_id, user_id, hours_spent, description, logged_at, work_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    workLogs.forEach(([issueId, userId, hours, offset, note], i) => {
      insertLog.run(`demo-log-${i + 1}`, issueId, userId, hours, note, daysOut(offset), daysOut(offset));
    });

    const insertPage = db.prepare(
      `INSERT INTO pages (id, workspace_id, parent_page_id, title, icon, content_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of pages) {
      insertPage.run(p.id, WS.id, p.parent, p.title, p.icon, p.content, users[0].id);
    }

    const insertLink = db.prepare(
      'INSERT INTO issue_page_links (issue_id, page_id, linked_by) VALUES (?, ?, ?)'
    );
    for (const [issueId, pageId] of pageLinks) insertLink.run(issueId, pageId, users[0].id);

    const insertNotif = db.prepare(
      `INSERT INTO notifications (id, user_id, title, message, is_read, type, link_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [id, userId, title, message, read, type] of notifications) {
      insertNotif.run(id, userId, title, message, read, type, `/w/${WS.tag}/board`);
    }

    const pastIssues = PAST_SPRINTS.reduce((n, s) => n + s.points.length, 0);
    return {
      users: users.length,
      issues: issues.length + pastIssues,
      sprints: PAST_SPRINTS.length + 1,
      logs: workLogs.length,
      pages: pages.length,
    };
  })();

  return created;
}

// Nunca en producción con la contraseña por defecto.
//
// El seed crea `avery` con una contraseña que está escrita en el README, en el
// .env.example y en este archivo. En una instancia local eso es comodidad; en
// una expuesta a internet es una cuenta de administrador con la contraseña
// publicada. Y `--force` además borra todas las tablas, que es lo último que
// uno quiere teclear por costumbre contra la base de producción.
if (process.env.NODE_ENV === 'production' && !process.env.TEST_PASSWORD) {
  console.error(
    `\nRefusing to seed with NODE_ENV=production.\n\n` +
    `The demo account's password is published in the README, so seeding a\n` +
    `public instance hands out an account to anyone who read it.\n\n` +
    `If you really mean to seed production, set your own password first:\n\n` +
    `  TEST_PASSWORD='...' npm run seed\n`
  );
  process.exit(1);
}

const rows = existingRows();
if (rows > 0 && !FORCE) {
  console.error(
    `\nRefusing to seed: the target database already has ${rows} user(s).\n` +
    `Re-run with --force to wipe it first:\n\n  npm run seed -- --force\n`
  );
  process.exit(1);
}

if (rows > 0) wipe();

const summary = seed();

console.log(`
Seeded the "${WS.name}" workspace.

  users     ${summary.users}   (${users.map((u) => u.username).join(', ')})
  sprints   ${summary.sprints}   (${PAST_SPRINTS.length} completed + 1 active)
  issues    ${summary.issues}  across To Do / In Progress / Review / Done
  worklogs  ${summary.logs}
  pages     ${summary.pages}

  Sign in as   ${users[0].username} / ${PASSWORD}
  Board        /w/${WS.tag}/board
`);
