import { Extension } from '@tiptap/core';
import Suggestion, { exitSuggestion } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { crearMenu, type ItemMenu } from './slashMenu';
import type { TipoMencion } from '../../../lib/notes/mention';

/**
 * Menú «@» para mencionar a alguien en una nota: miembros del espacio y tus
 * contactos sin cuenta. La lista llega del servidor con la página
 * (`EditorClient.astro`); no se pregunta nada mientras se escribe.
 */

export type Persona = { id: string; nombre: string; tipo: TipoMencion };
type ItemPersona = ItemMenu & { persona: Persona };

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const MentionMenu = Extension.create<{ personas: Persona[]; emptyLabel: string; hintContacto: string; hintMiembro: string }>({
  name: 'mentionMenu',

  addOptions() {
    return { personas: [], emptyLabel: '', hintContacto: '', hintMiembro: '' };
  },

  addProseMirrorPlugins() {
    const { personas, emptyLabel, hintContacto, hintMiembro } = this.options;
    const key = new PluginKey('mentionMenu');
    const todos: ItemPersona[] = personas.map((p) => ({
      id: `${p.tipo}:${p.id}`,
      label: p.nombre,
      hint: p.tipo === 'contacto' ? hintContacto : hintMiembro,
      persona: p,
    }));
    return [
      Suggestion<ItemPersona, ItemPersona>({
        pluginKey: key,
        editor: this.editor,
        char: '@',
        // Tras un espacio o al empezar la línea: un correo no abre el menú.
        allowedPrefixes: [' '],
        allow: ({ editor }) => !editor.isActive('codeBlock'),
        items: ({ query }) => {
          const q = sinTildes(query.trim());
          return (q ? todos.filter((it) => sinTildes(it.label).includes(q)) : todos).slice(0, 8);
        },
        command: ({ editor, range, props }) => {
          editor.chain().focus().insertContentAt(range, [
            { type: 'mention', attrs: { id: props.persona.id, label: props.persona.nombre, tipo: props.persona.tipo } },
            { type: 'text', text: ' ' },
          ]).run();
        },
        render: () => {
          const menu = crearMenu<ItemPersona>(emptyLabel);
          let unmount: (() => void) | undefined;
          return {
            onStart: (props) => {
              menu.reset();
              menu.update(props);
              unmount = props.mount(menu.el);
            },
            onUpdate: (props) => menu.update(props),
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                exitSuggestion(props.view, key);
                return true;
              }
              return menu.onKeyDown(props);
            },
            onExit: () => {
              unmount?.();
              unmount = undefined;
            },
          };
        },
      }),
    ];
  },
});
