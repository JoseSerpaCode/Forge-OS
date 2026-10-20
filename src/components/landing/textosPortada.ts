/**
 * Los textos de la portada, en los dos idiomas.
 *
 * Van aquí y no en `i18n/*\/landing.ts` porque la mitad no son frases sueltas
 * sino datos de la demostración —las tarjetas del tablero, las cifras de cada
 * función—, y una lista de tarjetas se lee mejor como lista que repartida en
 * cuarenta claves.
 *
 * Todo lo que se afirma tiene que ser cierto en el código. La maqueta
 * prometía que una nota enlazada a una tarea «aparece en la tarea»; eso no
 * existe en la interfaz, así que aquí no se dice.
 */

export interface Tarjeta {
  titulo: string;
  tipo: string;
  color: string;
  pts: number;
  etiqueta: [string, string];
  quien: 'avery' | 'blake' | 'noor';
  pie?: string;
  tarde?: boolean;
  reloj?: boolean;
  pin?: number;
  arrastrando?: boolean;
}

const E = {
  facturacion: ['Facturación', '#9A3412'],
  busqueda: ['Búsqueda', '#0E7490'],
  interfaz: ['Interfaz', '#4D7C0F'],
  api: ['API', '#334155'],
  incorporacion: ['Incorporación', '#6D28D9'],
} as const;
const EN_E = {
  facturacion: ['Billing', '#9A3412'],
  busqueda: ['Search', '#0E7490'],
  interfaz: ['Interface', '#4D7C0F'],
  api: ['API', '#334155'],
  incorporacion: ['Onboarding', '#6D28D9'],
} as const;

const es = {
  meta: {
    title: 'Forge OS — tablero, notas y archivos en un servidor tuyo',
    desc: 'Tablero con sprints opcionales, notas por bloques y archivos en tu Drive. Un proceso de Node y un archivo de SQLite. Software libre.',
  },
  nav: { cambios: 'Cambios', codigo: 'Código', entrar: 'Entrar', crear: 'Crear cuenta', abrir: 'Abrir Forge OS', tema: 'Cambiar entre tema claro y oscuro' },
  hero: {
    l1: 'Tablero,', l2: 'notas', l3: 'y archivos', l4: 'en un servidor tuyo.',
    col: 'En curso', nota: 'Arquitectura general', archivo: 'factura.pdf',
    texto: 'Un tablero con sprints si los quieres, notas por bloques y archivos que se guardan en tu Drive. Todo en un proceso de Node y un archivo de SQLite. Software libre, sin cuotas por persona.',
    probar: 'Probar sin cuenta',
    instalar: 'Instalarlo',
    aviso: 'Crea un espacio temporal que dura 30 días. Si luego te registras, te lo llevas.',
    avisoInvitado: 'Tu espacio es temporal. Crea una cuenta para conservarlo.',
    conservar: 'Conservar mi espacio',
  },
  muestra: {
    sprint: 'Sprint 14 · Facturación y búsqueda',
    meta: 'quedan 4 días · 32 h de 121 h',
    soltar: 'Soltar en «Hecho»',
    enMarcha: 'En marcha',
    parar: 'Parar',
    notas: [
      'El reloj corre en el servidor: cerrar el portátil no pierde la hora, y se para solo al pasar a revisión o a «Hecho».',
      'Las tarjetas se arrastran entre columnas. En el móvil, donde arrastrar no funciona, se mueven con un selector.',
      'Lo que vence hoy se marca en rojo en la propia tarjeta, sin abrirla.',
    ],
  },
  queHace: {
    titulo: 'Qué hace',
    entrada: 'Cuatro piezas en un solo proceso de Node. Lo que se enseña aquí son las mismas piezas de la aplicación.',
    tablero: {
      nombre: 'Tablero',
      texto: 'Cuatro columnas, sprints si el equipo los usa y un reloj por tarea que corre en el servidor. Se para solo al pasar a revisión o a «Hecho»: cerrar el portátil no pierde la hora.',
      cifras: [
        ['4', 'columnas: por hacer, en curso, en revisión y hecho.'],
        ['1', 'reloj por tarea; corre en el servidor, no en tu pestaña.'],
        ['0 h', 'perdidas por cerrar el portátil.'],
      ],
      aviso: 'Movida a «Hecho». El reloj se paró.',
      deshacer: 'Deshacer',
    },
    notas: {
      nombre: 'Notas',
      texto: 'Editor por bloques con títulos, listas, tablas y código. Las etiquetas son las mismas que las de las tareas y los archivos, y con @ mencionas a un contacto.',
      cifras: [
        ['3 sitios', 'para una misma etiqueta: tareas, notas y archivos.'],
        ['1 esquema', 'el editor y el servidor validan lo mismo: lo que ves es lo que se guarda.'],
        ['0 HTML', 'el texto no viaja como HTML; no hay nada que sanear.'],
      ],
      doc: 'Arquitectura general',
      quien: 'avery · editando',
      p1a: 'Cada consulta va filtrada por', p1b: 'Ese filtro es la frontera entre espacios', p1c: ', así que vive en la capa de datos y no en la interfaz.',
      p2: 'Las facturas las revisa',
      mencion: 'Menciona a alguien',
      contactos: [['Lucía Gómez', 'Contacto'], ['Lucas Pérez', 'Contacto']],
      vuelta: 'La etiqueta «API» es la misma en la nota, en la tarea y en el archivo: filtrando por ella salen los tres.',
    },
    archivos: {
      nombre: 'Archivos',
      texto: 'Se suben directamente al Drive de quien conecta el espacio. El servidor no guarda los bytes ni ve el token de acceso. Las etiquetas son las mismas que las de las tareas.',
      cifras: [
        ['0 bytes', 'pasan por el servidor al subir: el navegador los manda directo a Drive.'],
        ['drive.file', 'el permiso mínimo: Forge solo ve lo que él mismo crea.'],
        ['AES-256', 'cifra el token de refresco; la llave se queda en tu servidor.'],
      ],
      flujo: 'Al subir un archivo, el servidor solo entrega la dirección de subida; los bytes van del navegador directamente al Drive.',
      servidor: 'Servidor', servidorSub: 'abre la sesión y entrega solo la URL',
      navegador: 'Tu navegador', directos: 'los bytes, directos',
      drive: 'Tu Drive', driveSub: 'carpeta del espacio',
    },
    metricas: {
      nombre: 'Métricas',
      texto: 'Avance del sprint, velocidad y carga por persona, con el tiempo que se registró de verdad y no con lo que se estimó. Sin sprints, la carga sigue ahí.',
      cifras: [
        ['1 / día', 'foto del avance, con la fecha local del espacio.'],
        ['4', 'gráficas: avance, velocidad, carga y estimado frente a registrado.'],
        ['Tabla', 'cada gráfica tiene sus datos en tabla, para copiarlos.'],
      ],
      sinCerrar: 'puntos sin cerrar', dias: 'días para el cierre', sobre: 'sobre el ideal',
      fecha: '23 oct', prevision: 'Al ritmo actual, 14 puntos se quedan sin cerrar.',
      real: 'Real', ideal: 'Ideal', grafica: 'Gráfica', tabla: 'Tabla', vista: 'Vista de la gráfica',
      hoy: 'Hoy',
      aria: 'Avance del sprint 14: quedan 14 de 40 puntos con 4 días por delante; la línea ideal marcaría unos 6.',
      ejes: ['26 sep', '3 oct', '10 oct', '17 oct', '23 oct'],
      tip1: '13 oct · 21 pts', tip2: 'ideal 15,7 · +5,3',
    },
  },
  ficha: {
    titulo: 'Ficha técnica',
    filas: [
      ['Licencia', 'MIT. Todas las funciones, sin plan de pago.'],
      ['Datos', 'Un archivo de SQLite en tu servidor. Copia de seguridad con scripts/backup.sh.'],
      ['Requisitos', 'Node 22.12 o superior. Funciona en una e2-micro de Google Cloud.'],
      ['Personas', 'Sin límite por espacio.'],
      ['Terceros', 'Ninguno en la página. Google o GitHub solo si entras con su cuenta; Drive, solo si lo conectas.'],
    ],
  },
  cambios: { titulo: 'Cambios recientes', todos: 'Ver todos los cambios' },
  final: {
    titulo: 'Pruébalo con un sprint de verdad.',
    texto: 'Sin cuenta y sin tarjeta. El espacio de prueba dura 30 días y te lo llevas al registrarte.',
  },
  pie: { licencia: 'MIT · código abierto' },
  columnas: { todo: 'Por hacer', progreso: 'En curso', revision: 'En revisión', hecho: 'Hecho' },
};

type Textos = typeof es;

const en: Textos = {
  meta: {
    title: 'Forge OS — board, notes and files on a server of your own',
    desc: 'A board with optional sprints, block notes and files in your Drive. One Node process and one SQLite file. Free software.',
  },
  nav: { cambios: 'Changes', codigo: 'Code', entrar: 'Sign in', crear: 'Create account', abrir: 'Open Forge OS', tema: 'Switch between light and dark theme' },
  hero: {
    l1: 'Board,', l2: 'notes', l3: 'and files', l4: 'on a server of yours.',
    col: 'In progress', nota: 'System overview', archivo: 'invoice.pdf',
    texto: 'A board with sprints if you want them, block notes, and files that live in your Drive. All of it in one Node process and one SQLite file. Free software, no per-seat fees.',
    probar: 'Try it without an account',
    instalar: 'Install it',
    aviso: 'Creates a temporary workspace that lasts 30 days. If you sign up later, you keep it.',
    avisoInvitado: 'Your workspace is temporary. Create an account to keep it.',
    conservar: 'Keep my workspace',
  },
  muestra: {
    sprint: 'Sprint 14 · Billing and search',
    meta: '4 days left · 32 h of 121 h',
    soltar: 'Drop in “Done”',
    enMarcha: 'Running',
    parar: 'Stop',
    notas: [
      'The timer runs on the server: closing the laptop loses nothing, and it stops on its own when the task moves to review or “Done”.',
      'Cards drag between columns. On a phone, where dragging doesn’t work, you move them with a picker.',
      'Anything due today is marked red on the card itself, without opening it.',
    ],
  },
  queHace: {
    titulo: 'What it does',
    entrada: 'Four pieces in a single Node process. What you see here are the same pieces the app uses.',
    tablero: {
      nombre: 'Board',
      texto: 'Four columns, sprints if the team uses them, and a timer per task that runs on the server. It stops on its own at review or “Done”: closing the laptop loses nothing.',
      cifras: [
        ['4', 'columns: to do, in progress, in review and done.'],
        ['1', 'timer per task; it runs on the server, not in your tab.'],
        ['0 h', 'lost by closing the laptop.'],
      ],
      aviso: 'Moved to “Done”. The timer stopped.',
      deshacer: 'Undo',
    },
    notas: {
      nombre: 'Notes',
      texto: 'A block editor with headings, lists, tables and code. Labels are the same ones tasks and files use, and @ mentions a contact.',
      cifras: [
        ['3 places', 'for one label: tasks, notes and files.'],
        ['1 schema', 'the editor and the server validate the same thing: what you see is what gets saved.'],
        ['0 HTML', 'text doesn’t travel as HTML; there is nothing to sanitize.'],
      ],
      doc: 'System overview',
      quien: 'avery · editing',
      p1a: 'Every query is filtered by', p1b: 'That filter is the boundary between workspaces', p1c: ', so it lives in the data layer, not in the UI.',
      p2: 'Invoices are reviewed by',
      mencion: 'Mention someone',
      contactos: [['Lucía Gómez', 'Contact'], ['Lucas Pérez', 'Contact']],
      vuelta: 'The “API” label is the same on the note, the task and the file: filter by it and all three show up.',
    },
    archivos: {
      nombre: 'Files',
      texto: 'They upload straight to the Drive of whoever connects the workspace. The server never stores the bytes or sees the access token. Labels are the same ones tasks use.',
      cifras: [
        ['0 bytes', 'pass through the server on upload: the browser sends them straight to Drive.'],
        ['drive.file', 'the narrowest scope: Forge only sees what it creates itself.'],
        ['AES-256', 'encrypts the refresh token; the key stays on your server.'],
      ],
      flujo: 'When a file is uploaded, the server only hands out the upload address; the bytes go from the browser straight to Drive.',
      servidor: 'Server', servidorSub: 'opens the session and hands out only the URL',
      navegador: 'Your browser', directos: 'the bytes, directly',
      drive: 'Your Drive', driveSub: 'workspace folder',
    },
    metricas: {
      nombre: 'Metrics',
      texto: 'Sprint progress, velocity and workload per person, using the time that was actually logged, not what was estimated. Without sprints, workload is still there.',
      cifras: [
        ['1 / day', 'progress snapshot, on the workspace’s local date.'],
        ['4', 'charts: progress, velocity, workload and estimated versus logged.'],
        ['Table', 'every chart has its data as a table, to copy.'],
      ],
      sinCerrar: 'points still open', dias: 'days until close', sobre: 'above ideal',
      fecha: 'Oct 23', prevision: 'At this pace, 14 points stay open.',
      real: 'Actual', ideal: 'Ideal', grafica: 'Chart', tabla: 'Table', vista: 'Chart view',
      hoy: 'Today',
      aria: 'Sprint 14 progress: 14 of 40 points left with 4 days to go; the ideal line would be about 6.',
      ejes: ['Sep 26', 'Oct 3', 'Oct 10', 'Oct 17', 'Oct 23'],
      tip1: 'Oct 13 · 21 pts', tip2: 'ideal 15.7 · +5.3',
    },
  },
  ficha: {
    titulo: 'Spec sheet',
    filas: [
      ['License', 'MIT. Every feature, no paid plan.'],
      ['Data', 'One SQLite file on your server. Backups with scripts/backup.sh.'],
      ['Requirements', 'Node 22.12 or later. Runs on a Google Cloud e2-micro.'],
      ['People', 'No limit per workspace.'],
      ['Third parties', 'None on the page. Google or GitHub only if you sign in with them; Drive, only if you connect it.'],
    ],
  },
  cambios: { titulo: 'Recent changes', todos: 'See every change' },
  final: {
    titulo: 'Try it with a real sprint.',
    texto: 'No account, no card. The trial workspace lasts 30 days and comes with you when you sign up.',
  },
  pie: { licencia: 'MIT · open source' },
  columnas: { todo: 'To do', progreso: 'In progress', revision: 'In review', hecho: 'Done' },
};

function tarjetas(lang: 'es' | 'en'): Record<'todo' | 'progreso' | 'revision' | 'hecho', Tarjeta[]> {
  const e = lang === 'es' ? E : EN_E;
  const tipo = lang === 'es'
    ? { historia: 'Historia', tarea: 'Tarea', epica: 'Épica', error: 'Error' }
    : { historia: 'Story', tarea: 'Task', epica: 'Epic', error: 'Bug' };
  const s = (es: string, en: string) => (lang === 'es' ? es : en);
  return {
    todo: [
      { titulo: s('Búsqueda de texto completo en páginas', 'Full-text search across pages'), tipo: tipo.historia, color: '#2E7D6B', pts: 5, etiqueta: [...e.busqueda], quien: 'avery' },
      { titulo: s('Ventana de ayuda con los atajos de teclado', 'Help window with keyboard shortcuts'), tipo: tipo.tarea, color: '#5F6B7A', pts: 2, etiqueta: [...e.interfaz], quien: 'noor' },
      { titulo: s('Lista de pasos para espacios nuevos', 'Checklist for new workspaces'), tipo: tipo.historia, color: '#2E7D6B', pts: 3, etiqueta: [...e.incorporacion], quien: 'blake', pie: s('24 oct', 'Oct 24') },
    ],
    progreso: [
      { titulo: s('Facturación por uso', 'Usage-based billing'), tipo: tipo.epica, color: '#6B3FA0', pts: 13, etiqueta: [...e.facturacion], quien: 'avery', reloj: true, pin: 1 },
      { titulo: s('Generar facturas en PDF', 'Generate PDF invoices'), tipo: tipo.historia, color: '#2E7D6B', pts: 5, etiqueta: [...e.facturacion], quien: 'blake', pie: s('Vence hoy', 'Due today'), tarde: true, pin: 3 },
      { titulo: s('La búsqueda pierde resultados después de la página 3', 'Search drops results after page 3'), tipo: tipo.error, color: '#B42318', pts: 3, etiqueta: [...e.busqueda], quien: 'noor' },
    ],
    revision: [
      { titulo: s('La subida de avatar rechaza PNG válidos', 'Avatar upload rejects valid PNGs'), tipo: tipo.error, color: '#B42318', pts: 2, etiqueta: [...e.interfaz], quien: 'avery' },
    ],
    hecho: [
      { titulo: s('Selector de plan en ajustes', 'Plan picker in settings'), tipo: tipo.tarea, color: '#5F6B7A', pts: 3, etiqueta: [...e.facturacion], quien: 'blake', pin: 2, arrastrando: true },
      { titulo: s('API de medición de consumo', 'Usage metering API'), tipo: tipo.historia, color: '#2E7D6B', pts: 5, etiqueta: [...e.api], quien: 'blake', pie: s('6,5 h registradas', '6.5 h logged') },
      { titulo: s('Límite de peticiones por IP en la API pública', 'Per-IP rate limit on the public API'), tipo: tipo.tarea, color: '#5F6B7A', pts: 3, etiqueta: [...e.api], quien: 'noor', pie: s('4 h registradas', '4 h logged') },
    ],
  };
}

export function textosPortada(lang: string) {
  const l = lang === 'es' ? 'es' : 'en';
  return { ...(l === 'es' ? es : en), tarjetas: tarjetas(l), etiquetaApi: (l === 'es' ? E : EN_E).api };
}
