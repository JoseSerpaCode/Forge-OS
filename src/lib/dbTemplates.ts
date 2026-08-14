import type { ui, defaultLang } from '../i18n/ui';

/**
 * Plantillas para las bases de datos dinámicas.
 *
 * Una base dinámica no es más que un `schema_json` con la forma
 * `{"columns":[{ id, name, type, options? }]}`. Una plantilla, por tanto, no
 * necesita tabla ni API propia: es ese esquema ya escrito. Se aplica en el
 * navegador rellenando el formulario de creación, y sale por el mismo POST que
 * valida los tipos y **genera los `col_id` en el servidor**. Así una plantilla
 * no puede colar una columna que el formulario no permitiría a mano.
 *
 * Lo que sí resuelve este módulo es el idioma. Los nombres de columna y las
 * opciones de los desplegables **se convierten en datos** en cuanto se crea la
 * tabla: quedan escritos en el esquema y en cada fila. Por eso se traducen aquí,
 * antes de crear, con el idioma de quien crea, y luego ya no se vuelven a tocar
 * —cambiar el idioma de la interfaz no puede renombrar columnas que ya tienen
 * contenido debajo.
 */

type ClaveI18n = keyof typeof ui[typeof defaultLang];

/** Los tipos que acepta el esquema. No hay fecha todavía; van como texto. */
export type TipoColumna = 'text' | 'number' | 'select';

type ColumnaPlantilla = {
  /** Clave de traducción del nombre de la columna. */
  nombre: ClaveI18n;
  tipo: TipoColumna;
  /**
   * Solo para `select`: clave cuyo valor es la lista de opciones separadas por
   * comas. Una clave por lista, y no una por opción, porque son decenas de
   * cadenas de dos palabras y el fichero de traducciones ya es largo. Ninguna
   * opción puede llevar una coma dentro, y la prueba lo comprueba.
   */
  opciones?: ClaveI18n;
};

export type Plantilla = {
  id: string;
  icono: string;
  nombre: ClaveI18n;
  descripcion: ClaveI18n;
  columnas: ColumnaPlantilla[];
};

/**
 * El catálogo.
 *
 * Elegidas por lo que de verdad se apunta en una tabla: las asignaturas del
 * semestre, lo que uno lee, en qué se va el dinero, la gente con la que trata,
 * lo que tiene guardado y las solicitudes que ha mandado. Deliberadamente
 * cortas —cinco o seis columnas—: una plantilla de veinte campos se rellena una
 * vez y se abandona.
 */
export const PLANTILLAS: Plantilla[] = [
  {
    id: 'courses',
    icono: '🎓',
    nombre: 'dbt.courses.name',
    descripcion: 'dbt.courses.desc',
    columnas: [
      { nombre: 'dbt.col.subject', tipo: 'text' },
      { nombre: 'dbt.col.teacher', tipo: 'text' },
      { nombre: 'dbt.col.credits', tipo: 'number' },
      { nombre: 'dbt.col.schedule', tipo: 'text' },
      { nombre: 'dbt.col.status', tipo: 'select', opciones: 'dbt.opt.course_status' },
    ],
  },
  {
    id: 'reading',
    icono: '📚',
    nombre: 'dbt.reading.name',
    descripcion: 'dbt.reading.desc',
    columnas: [
      { nombre: 'dbt.col.title', tipo: 'text' },
      { nombre: 'dbt.col.author', tipo: 'text' },
      { nombre: 'dbt.col.kind', tipo: 'select', opciones: 'dbt.opt.reading_kind' },
      { nombre: 'dbt.col.status', tipo: 'select', opciones: 'dbt.opt.reading_status' },
      { nombre: 'dbt.col.rating', tipo: 'number' },
      { nombre: 'dbt.col.notes', tipo: 'text' },
    ],
  },
  {
    id: 'expenses',
    icono: '💸',
    nombre: 'dbt.expenses.name',
    descripcion: 'dbt.expenses.desc',
    columnas: [
      { nombre: 'dbt.col.concept', tipo: 'text' },
      { nombre: 'dbt.col.amount', tipo: 'number' },
      { nombre: 'dbt.col.category', tipo: 'select', opciones: 'dbt.opt.expense_category' },
      { nombre: 'dbt.col.date', tipo: 'text' },
      { nombre: 'dbt.col.payment', tipo: 'select', opciones: 'dbt.opt.payment_method' },
    ],
  },
  {
    id: 'contacts',
    icono: '👤',
    nombre: 'dbt.contacts.name',
    descripcion: 'dbt.contacts.desc',
    columnas: [
      { nombre: 'dbt.col.name', tipo: 'text' },
      { nombre: 'dbt.col.email', tipo: 'text' },
      { nombre: 'dbt.col.phone', tipo: 'text' },
      { nombre: 'dbt.col.org', tipo: 'text' },
      { nombre: 'dbt.col.relation', tipo: 'select', opciones: 'dbt.opt.relation' },
      { nombre: 'dbt.col.notes', tipo: 'text' },
    ],
  },
  {
    id: 'inventory',
    icono: '📦',
    nombre: 'dbt.inventory.name',
    descripcion: 'dbt.inventory.desc',
    columnas: [
      { nombre: 'dbt.col.item', tipo: 'text' },
      { nombre: 'dbt.col.quantity', tipo: 'number' },
      { nombre: 'dbt.col.location', tipo: 'text' },
      { nombre: 'dbt.col.condition', tipo: 'select', opciones: 'dbt.opt.condition' },
      { nombre: 'dbt.col.value', tipo: 'number' },
    ],
  },
  {
    id: 'applications',
    icono: '📮',
    nombre: 'dbt.applications.name',
    descripcion: 'dbt.applications.desc',
    columnas: [
      { nombre: 'dbt.col.position', tipo: 'text' },
      { nombre: 'dbt.col.org', tipo: 'text' },
      { nombre: 'dbt.col.sent_on', tipo: 'text' },
      { nombre: 'dbt.col.status', tipo: 'select', opciones: 'dbt.opt.application_status' },
      { nombre: 'dbt.col.link', tipo: 'text' },
      { nombre: 'dbt.col.notes', tipo: 'text' },
    ],
  },
];

/** Una plantilla ya traducida, lista para volcar en el formulario. */
export type PlantillaResuelta = {
  id: string;
  icono: string;
  nombre: string;
  descripcion: string;
  columnas: Array<{ name: string; type: TipoColumna; options?: string[] }>;
};

/**
 * Traduce el catálogo al idioma de quien está creando la tabla.
 *
 * Se resuelve en el servidor y viaja al navegador ya en texto plano: el script
 * del modal solo tiene que rellenar campos, sin saber nada de traducciones.
 */
export function plantillasTraducidas(t: (clave: ClaveI18n) => string): PlantillaResuelta[] {
  return PLANTILLAS.map((p) => ({
    id: p.id,
    icono: p.icono,
    nombre: t(p.nombre),
    descripcion: t(p.descripcion),
    columnas: p.columnas.map((c) => {
      const col: PlantillaResuelta['columnas'][number] = { name: t(c.nombre), type: c.tipo };
      if (c.opciones) {
        col.options = t(c.opciones).split(',').map((o) => o.trim()).filter(Boolean);
      }
      return col;
    }),
  }));
}
