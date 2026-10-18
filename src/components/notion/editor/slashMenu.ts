import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, { exitSuggestion, type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

/**
 * Menú «/» para insertar bloques.
 *
 * Sustituye al «+» de Editor.js, que obligaba a soltar el teclado para cambiar
 * de tipo de bloque. Los atajos tipo Markdown («1. », «- », «# ») ya los trae
 * Tiptap; esto es para lo que no tiene atajo —tablas, separador— o para quien
 * no se los sabe.
 */

export type SlashItem = {
  id: string;
  label: string;
  /** Palabras por las que también se encuentra: «h1», «todo», «ul»… */
  keywords: string;
  hint?: string;
  run: (editor: Editor, range: Range) => void;
};

export function slashItems(t: Record<string, string>): SlashItem[] {
  const chain = (e: Editor, r: Range) => e.chain().focus().deleteRange(r);
  return [
    { id: 'text', label: t.text, keywords: 'texto parrafo paragraph p', run: (e, r) => chain(e, r).setParagraph().run() },
    { id: 'h1', label: t.h1, keywords: 'h1 titulo heading', hint: '#', run: (e, r) => chain(e, r).setHeading({ level: 1 }).run() },
    { id: 'h2', label: t.h2, keywords: 'h2 titulo heading', hint: '##', run: (e, r) => chain(e, r).setHeading({ level: 2 }).run() },
    { id: 'h3', label: t.h3, keywords: 'h3 titulo heading', hint: '###', run: (e, r) => chain(e, r).setHeading({ level: 3 }).run() },
    { id: 'bullet', label: t.bullet, keywords: 'lista viñetas bullet ul', hint: '-', run: (e, r) => chain(e, r).toggleBulletList().run() },
    { id: 'ordered', label: t.ordered, keywords: 'lista numerada ordered ol', hint: '1.', run: (e, r) => chain(e, r).toggleOrderedList().run() },
    { id: 'task', label: t.task, keywords: 'tareas checklist todo casilla', hint: '[]', run: (e, r) => chain(e, r).toggleTaskList().run() },
    { id: 'quote', label: t.quote, keywords: 'cita quote blockquote', hint: '>', run: (e, r) => chain(e, r).toggleBlockquote().run() },
    { id: 'code', label: t.code, keywords: 'codigo code', hint: '```', run: (e, r) => chain(e, r).toggleCodeBlock().run() },
    { id: 'table', label: t.table, keywords: 'tabla table', run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: 'divider', label: t.divider, keywords: 'separador divider hr linea', hint: '---', run: (e, r) => chain(e, r).setHorizontalRule().run() },
  ];
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function filtrar(items: SlashItem[], query: string): SlashItem[] {
  const q = sinTildes(query.trim());
  if (!q) return items;
  return items.filter((it) => sinTildes(`${it.label} ${it.keywords}`).includes(q));
}

/** La lista desplegable: un `listbox` navegable con flechas, Enter y Escape. */
function crearMenu(emptyLabel: string) {
  const el = document.createElement('div');
  el.className = 'note-slash-menu';
  el.setAttribute('role', 'listbox');

  let items: SlashItem[] = [];
  let activo = 0;
  let elegir: (item: SlashItem) => void = () => {};

  const pintar = () => {
    el.replaceChildren();
    if (!items.length) {
      const vacio = document.createElement('div');
      vacio.className = 'note-slash-empty';
      vacio.textContent = emptyLabel;
      el.append(vacio);
      return;
    }
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'note-slash-item';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(i === activo));
      b.dataset.id = it.id;
      const nombre = document.createElement('span');
      nombre.textContent = it.label;
      b.append(nombre);
      if (it.hint) {
        const pista = document.createElement('kbd');
        pista.textContent = it.hint;
        b.append(pista);
      }
      // `mousedown` y no `click`: con `click` el editor pierde el foco antes y
      // el rango de la sugerencia deja de ser válido.
      b.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        elegir(it);
      });
      el.append(b);
    });
    el.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };

  return {
    el,
    update(props: SuggestionProps<SlashItem>) {
      items = props.items;
      activo = Math.min(activo, Math.max(items.length - 1, 0));
      elegir = (it) => props.command(it);
      pintar();
    },
    onKeyDown({ event }: SuggestionKeyDownProps): boolean {
      if (!items.length) return false;
      if (event.key === 'ArrowDown') {
        activo = (activo + 1) % items.length;
        pintar();
        return true;
      }
      if (event.key === 'ArrowUp') {
        activo = (activo - 1 + items.length) % items.length;
        pintar();
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        elegir(items[activo]);
        return true;
      }
      return false;
    },
    reset() {
      activo = 0;
    },
  };
}

export const SlashMenu = Extension.create<{ items: SlashItem[]; emptyLabel: string }>({
  name: 'slashMenu',

  addOptions() {
    return { items: [], emptyLabel: '' };
  },

  addProseMirrorPlugins() {
    const { items, emptyLabel } = this.options;
    const key = new PluginKey('slashMenu');
    return [
      Suggestion<SlashItem, SlashItem>({
        pluginKey: key,
        editor: this.editor,
        char: '/',
        // Solo al empezar una línea o tras un espacio: una URL o «a/b» no
        // abren el menú.
        allowedPrefixes: [' '],
        // Dentro de un bloque de código «/» es texto.
        allow: ({ editor }) => !editor.isActive('codeBlock'),
        items: ({ query }) => filtrar(items, query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          const menu = crearMenu(emptyLabel);
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
                // Cerrar la sugerencia entera, no solo esconder la lista: si
                // no, la siguiente tecla la vuelve a abrir.
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
