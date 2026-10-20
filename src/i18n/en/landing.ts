/**
 * Traducciones de landing.
 *
 * `ui.ts` era un solo fichero de 2.048 líneas y 939 claves por idioma, y era el
 * segundo que más cambiaba del repositorio. Cualquier trabajo en paralelo
 * chocaba ahí: dos ramas que añaden una clave tocan la misma zona del mismo
 * fichero. Partido por dominio, cada una toca el suyo.
 *
 * El orden de las claves y sus valores son los mismos que tenía; esto fue un
 * corte mecánico, no una reescritura.
 */

export const en = {
  'show.title': 'Four screens, one file',
  'show.board.tab': 'Board',
  'show.board.cap': 'Sprint board with a server-side timer on every card.',
  'show.kb.tab': 'Knowledge base',
  'show.kb.cap': 'Block editor with tables, code and two-way links to issues.',
  'show.metrics.tab': 'Metrics',
  'show.metrics.cap': 'Velocity, burndown and workload, computed from logged hours.',
  'show.dash.tab': 'Dashboard',
  'show.dash.cap': 'Assigned work, gathered from every workspace in the account.',
  'show.dash.alt': 'Forge OS dashboard showing assigned work and sprint progress',
  'about.title': 'About Forge OS',
  'about.guide': 'User Guide',
  'about.shortcuts': 'Keyboard Shortcuts',
  'about.shortcuts.desc': 'Speed up your workflow with these shortcuts.',
  'about.sc.palette': 'Command palette / Search',
  'about.sc.new_issue': 'Create an issue',
  'about.sc.close': 'Close modal / palette',
  'about.sc.or': 'or',
  'about.docs': 'Documentation',
  'about.legal': 'License & Legal',
  'about.kanban.empty_title': 'No tasks yet.',
  'about.kanban.empty_desc': 'The first one you create shows up in “To do”.',
  'about.kanban.empty_cta_movil': 'Tap “New task” to create the first one.',
  'about.kanban.empty_cta_1': 'Press',
  'about.kanban.empty_cta_2': 'to create one.',
  'about.kanban.title': 'Kanban & Sprints',
  'about.kanban.desc': 'An interactive board where you can drag and drop cards (issues). Organize your work in Sprints, assign tasks and watch your team\'s real-time progress.',
  'about.kb.title': 'Knowledge Base',
  'about.kb.desc': 'A rich text editor for writing wikis, manuals and notes. Allows unlimited organization in pages and sub-pages.',
  'about.db.title': 'Dynamic Databases',
  'about.db.desc': 'Create your own data tables with custom columns. Ideal for inventories, contact lists or any structured information collection.',
  'about.docs.desc': 'All technical documentation is available in our official repository.',
  'about.docs.readme': 'View README.md',
  'about.docs.contributing': 'Contribution Guide',
  'about.legal.license': 'MIT License',
  'about.legal.desc': 'You can freely use, modify and distribute this software, without warranty.',
  'about.legal.read': 'Read Full License',
  'about.legal.copyright': '© 2026 José Serpa Medina (JoseSerpaCode).',
  'about.legal.distributed': 'Distributed under MIT license.',
  'about.repo': 'Official Repository',
  'about.close': 'Close',
} as const;
