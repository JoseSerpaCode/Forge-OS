import type { Contenido } from './plantillas';

/**
 * Plantillas de tareas que trae Forge, para no empezar de cero.
 *
 * Como las de las tablas (`dbTemplates.ts`), no se guardan solas: rellenan el
 * formulario de «Nueva plantilla» y cada quien las ajusta antes de guardar. Al
 * guardarse, el texto pasa a ser del espacio y ya no se traduce; por eso se
 * resuelven aquí, en el idioma de quien la crea.
 *
 * Repetir va como `d:N` (cada N días desde la entrega) y no como un día de la
 * semana: una plantilla se usa cualquier día, y «cada lunes» con una entrega a
 * los siete días de un jueves caería en jueves.
 */

type Texto = { nombre: string; descripcion: string; contenido: Contenido };

export interface PlantillaDeSerie extends Texto {
  clave: string;
}

const CATALOGO: Array<{ clave: string; es: Texto; en: Texto }> = [
  {
    clave: 'entrega',
    es: {
      nombre: 'Entrega',
      descripcion: 'Un trabajo con fecha: leer el enunciado, hacerlo, revisarlo y subirlo.',
      contenido: { title: 'Entregar trabajo', priority: 'high', due_offset: 7, due_time: '23:59', subtareas: ['Leer el enunciado', 'Hacerlo', 'Revisarlo', 'Subirlo'] },
    },
    en: {
      nombre: 'Assignment',
      descripcion: 'Work with a deadline: read the brief, do it, review it and hand it in.',
      contenido: { title: 'Hand in assignment', priority: 'high', due_offset: 7, due_time: '23:59', subtareas: ['Read the brief', 'Do it', 'Review it', 'Hand it in'] },
    },
  },
  {
    clave: 'parcial',
    es: {
      nombre: 'Parcial',
      descripcion: 'Dos semanas para preparar un examen, con repaso y simulacro.',
      contenido: { title: 'Parcial', priority: 'high', due_offset: 14, subtareas: ['Reunir apuntes y temas', 'Repasar la teoría', 'Hacer ejercicios', 'Simulacro con tiempo'] },
    },
    en: {
      nombre: 'Exam',
      descripcion: 'Two weeks to prepare an exam, with review and a mock test.',
      contenido: { title: 'Exam', priority: 'high', due_offset: 14, subtareas: ['Gather notes and topics', 'Review the theory', 'Practice problems', 'Timed mock exam'] },
    },
  },
  {
    clave: 'informe',
    es: {
      nombre: 'Informe de laboratorio',
      descripcion: 'De los datos al PDF: medidas, gráficas, redacción y formato.',
      contenido: { title: 'Informe de laboratorio', due_offset: 7, due_time: '23:59', subtareas: ['Ordenar medidas y capturas', 'Hacer las gráficas', 'Redactar resultados y análisis', 'Revisar formato y referencias', 'Entregar'] },
    },
    en: {
      nombre: 'Lab report',
      descripcion: 'From data to PDF: measurements, plots, writing and format.',
      contenido: { title: 'Lab report', due_offset: 7, due_time: '23:59', subtareas: ['Sort measurements and captures', 'Make the plots', 'Write results and analysis', 'Check format and references', 'Hand it in'] },
    },
  },
  {
    clave: 'exposicion',
    es: {
      nombre: 'Exposición',
      descripcion: 'Una presentación: qué contar, diapositivas y ensayo.',
      contenido: { title: 'Exposición', due_offset: 7, subtareas: ['Decidir qué se va a contar', 'Hacer las diapositivas', 'Preparar la explicación', 'Ensayar con tiempo'] },
    },
    en: {
      nombre: 'Presentation',
      descripcion: 'A talk: what to say, slides and a rehearsal.',
      contenido: { title: 'Presentation', due_offset: 7, subtareas: ['Decide what to cover', 'Make the slides', 'Prepare the explanation', 'Rehearse with a timer'] },
    },
  },
  {
    clave: 'reunion',
    es: {
      nombre: 'Reunión semanal',
      descripcion: 'Se repite cada semana, con la agenda y los acuerdos en la descripción.',
      contenido: { title: 'Reunión semanal', description: 'Agenda:\n- \n\nAcuerdos:\n- ', due_offset: 7, recurrence: 'd:7' },
    },
    en: {
      nombre: 'Weekly meeting',
      descripcion: 'Repeats every week, with the agenda and decisions in the description.',
      contenido: { title: 'Weekly meeting', description: 'Agenda:\n- \n\nDecisions:\n- ', due_offset: 7, recurrence: 'd:7' },
    },
  },
  {
    clave: 'fallo',
    es: {
      nombre: 'Reporte de fallo',
      descripcion: 'Un error, con cómo reproducirlo y qué debería pasar.',
      contenido: { title: 'Corregir fallo', type: 'bug', priority: 'high', description: 'Pasos para reproducirlo:\n1. \n\nQué pasa:\n\nQué debería pasar:\n' },
    },
    en: {
      nombre: 'Bug report',
      descripcion: 'A bug, with how to reproduce it and what should happen.',
      contenido: { title: 'Fix bug', type: 'bug', priority: 'high', description: 'Steps to reproduce:\n1. \n\nWhat happens:\n\nWhat should happen:\n' },
    },
  },
];

export function plantillasDeSerie(lang: string): PlantillaDeSerie[] {
  return CATALOGO.map((p) => ({ clave: p.clave, ...(lang === 'es' ? p.es : p.en) }));
}
