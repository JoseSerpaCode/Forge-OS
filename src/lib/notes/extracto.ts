import { loadNote } from './content';

/**
 * Las primeras palabras de una nota, en texto plano, para el índice.
 *
 * Pasa por `loadNote`, así que vale igual para las notas ya en Tiptap y para
 * las de Editor.js que aún no se han vuelto a guardar. Las menciones salen
 * como «@nombre»; los bloques de código y las tablas, como su texto.
 */
export function extracto(raw: string | null | undefined, max = 160): string {
  const nota = loadNote(raw);
  if (!nota.ok) return '';
  const trozos: string[] = [];
  let largo = 0;
  const recorrer = (n: any, profundidad: number) => {
    if (largo >= max || !n || typeof n !== 'object' || profundidad > 60) return;
    // Los títulos de sección no: pegados al párrafo de después se leen como
    // una frase rota («Cómo encaja todo Forge OS corre…»).
    if (n.type === 'heading') return;
    if (n.type === 'text' && typeof n.text === 'string') { trozos.push(n.text); largo += n.text.length; return; }
    if (n.type === 'mention' && n.attrs?.label) { trozos.push(`@${n.attrs.label}`); largo += n.attrs.label.length + 1; return; }
    if (Array.isArray(n.content)) {
      for (const c of n.content) recorrer(c, profundidad + 1);
      // Cada bloque termina en espacio: si no, dos párrafos se pegan.
      if (n.type !== 'doc') trozos.push(' ');
    }
  };
  recorrer(nota.doc, 0);
  const texto = trozos.join('').replace(/\s+/g, ' ').trim();
  return texto.length > max ? `${texto.slice(0, max).replace(/\s+\S*$/, '')}…` : texto;
}
