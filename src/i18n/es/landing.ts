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

export const es = {
  'show.title': 'Cuatro pantallas, un archivo',
  'show.board.tab': 'Tablero',
  'show.board.cap': 'Tablero de sprint con un temporizador de servidor en cada tarjeta.',
  'show.kb.tab': 'Conocimiento',
  'show.kb.cap': 'Editor por bloques con tablas, código y enlaces de ida y vuelta a los issues.',
  'show.metrics.tab': 'Métricas',
  'show.metrics.cap': 'Velocidad, burndown y carga de trabajo, calculados sobre las horas registradas.',
  'show.dash.tab': 'Panel',
  'show.dash.cap': 'El trabajo asignado, reunido de todos los espacios de la cuenta.',
  'show.dash.alt': 'Panel de Forge OS con el trabajo asignado y el avance del sprint',
  'about.title': 'Acerca de Forge OS',
  'about.guide': 'Guía de Uso',
  'about.shortcuts': 'Atajos de Teclado',
  'about.shortcuts.desc': 'Acelera tu flujo de trabajo con estos atajos.',
  'about.sc.palette': 'Paleta de comandos / Buscar',
  'about.sc.new_issue': 'Crear un ticket',
  'about.sc.close': 'Cerrar el modal o la paleta',
  'about.sc.or': 'o',
  'about.docs': 'Documentación',
  'about.legal': 'Licencia & Legal',
  'about.kanban.empty_title': 'Todo despejado.',
  'about.kanban.empty_desc': 'La primera tarea que crees aparece en «Por hacer». Escribe «mañana» o «#etiqueta» en el título y se entiende sola.',
  'about.kanban.empty_cta_1': 'o pulsa',
  'about.kanban.empty_cta_2': 'desde cualquier pantalla del espacio.',
  'about.kanban.title': 'Kanban & Sprints',
  'about.kanban.desc': 'Un tablero interactivo donde puedes arrastrar y soltar tarjetas (issues). Organiza tu trabajo en Sprints, asigna tareas y observa el progreso en tiempo real de tu equipo.',
  'about.kb.title': 'Base de Conocimiento',
  'about.kb.desc': 'Un editor de documentos enriquecido para la redacción de wikis, manuales y notas. Permite la organización en páginas y sub-páginas de forma ilimitada.',
  'about.db.title': 'Bases de Datos Dinámicas',
  'about.db.desc': 'Crea tus propias tablas de datos con columnas personalizadas. Ideal para inventarios, listas de contactos o cualquier colección de información estructurada.',
  'about.docs.desc': 'Toda la documentación técnica está disponible en nuestro repositorio oficial.',
  'about.docs.readme': 'Ver README.md',
  'about.docs.contributing': 'Guía de Contribución',
  'about.legal.license': 'Licencia MIT',
  'about.legal.desc': 'Puedes usar, modificar y distribuir este software libremente, sin garantía.',
  'about.legal.read': 'Leer Licencia Completa',
  'about.legal.copyright': '© 2026 José Serpa Medina (JoseSerpaCode).',
  'about.legal.distributed': 'Distribuido bajo licencia MIT.',
  'about.repo': 'Repositorio Oficial',
  'about.close': 'Cerrar',
} as const;
