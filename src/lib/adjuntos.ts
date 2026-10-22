/**
 * Adjuntos de una tarea en el disco del servidor (`/api/upload`).
 *
 * La lista de tipos vive aquí para que la lean el endpoint y el navegador: el
 * alta y el panel avisan antes de subir algo que el servidor va a rechazar.
 */

/** El tope del endpoint. El panel avisaba de 20 MB, en inglés, y el servidor cortaba en 10. */
export const MAXIMO_ADJUNTO = 10 * 1024 * 1024;

export const TIPOS_ADJUNTO = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
