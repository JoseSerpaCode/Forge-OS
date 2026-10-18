import { getSchema, type AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import { isSafeHref } from './href';

export { isSafeHref };

/**
 * Lo que puede contener una nota, **en un solo sitio**.
 *
 * El navegador monta el editor con estas extensiones y el servidor valida lo
 * que recibe con el esquema que sale de ellas. Si las dos listas se
 * separaran, pasaría lo que pasó con Editor.js: el editor dejaba crear tablas,
 * el sanitizador del servidor no las conocía, y se borraban al guardar sin que
 * nadie se enterara hasta recargar.
 *
 * Aquí solo va lo que cambia el **documento**. Lo que es solo interfaz —el asa
 * de arrastre, el menú flotante, el texto de ayuda— se añade en el cliente.
 */

export function noteExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      // El título de la nota va aparte y ya hace de H1 visual; tres niveles
      // dentro del texto bastan. Los 4–6 de Editor.js se convierten a 3.
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => isSafeHref(url),
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Highlight,
  ];
}

let cached: ReturnType<typeof getSchema> | null = null;

/** Esquema de ProseMirror de las notas. Se calcula una vez por proceso. */
export function noteSchema() {
  cached ??= getSchema(noteExtensions());
  return cached;
}
