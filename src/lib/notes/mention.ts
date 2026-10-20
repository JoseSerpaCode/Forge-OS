import { Node, mergeAttributes } from '@tiptap/core';

/**
 * `@alguien` dentro de una nota: un miembro del espacio o un contacto sin
 * cuenta (`lib/contactos.ts`).
 *
 * Va en el esquema compartido, no solo en el editor: si no, el servidor
 * rechazaría cada guardado que lleve una mención (ver «Un solo esquema» en
 * docs/desarrollo.md).
 *
 * El nombre viaja **dentro** del documento (`label`). Quien comparte la nota no
 * puede leer tus contactos, así que es lo que ve; y si el contacto se borra, la
 * mención se queda como texto en vez de desaparecer.
 */
export const TIPOS_MENCION = ['contacto', 'usuario'] as const;
export type TipoMencion = (typeof TIPOS_MENCION)[number];

export const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute('data-id'), renderHTML: (a) => ({ 'data-id': a.id }) },
      label: { default: '', parseHTML: (el) => el.getAttribute('data-label') ?? '', renderHTML: (a) => ({ 'data-label': a.label }) },
      tipo: { default: 'contacto', parseHTML: (el) => el.getAttribute('data-tipo'), renderHTML: (a) => ({ 'data-tipo': a.tipo }) },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-mention]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-mention': '', class: 'note-mention' }, HTMLAttributes), `@${node.attrs.label}`];
  },

  renderText({ node }) {
    return `@${node.attrs.label}`;
  },
});

/**
 * Los atributos de una mención que llega de fuera, saneados. `null` si no se
 * puede salvar: entonces se guarda como texto.
 */
export function limpiarMencion(attrs: any): { id: string; label: string; tipo: TipoMencion } | null {
  const id = typeof attrs?.id === 'string' ? attrs.id.slice(0, 64) : '';
  const label = typeof attrs?.label === 'string' ? attrs.label.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  const tipo = TIPOS_MENCION.includes(attrs?.tipo) ? (attrs.tipo as TipoMencion) : null;
  if (!id || !label || !tipo) return null;
  return { id, label, tipo };
}
