import { Editor, type JSONContent } from '@tiptap/core';
import BubbleMenu from '@tiptap/extension-bubble-menu';
import { Placeholder } from '@tiptap/extensions';
import { NodeSelection } from '@tiptap/pm/state';
import { noteExtensions, isSafeHref } from '../../../lib/notes/schema';
import { SlashMenu, slashItems } from './slashMenu';
import { DragHandle } from './dragHandle';
import { MentionMenu, type Persona } from './mentionMenu';

/**
 * Monta el editor de una nota sobre `element`.
 *
 * El documento lo definen `noteExtensions()` —las mismas con las que valida el
 * servidor—; aquí se añade solo interfaz: el texto de ayuda, el menú «/», el
 * asa de arrastre y los dos menús flotantes (formato y tabla).
 */

export type NoteEditorTexts = Record<string, string>;

type Options = {
  element: HTMLElement;
  content: JSONContent;
  editable: boolean;
  t: NoteEditorTexts;
  formatMenu: HTMLElement | null;
  tableMenu: HTMLElement | null;
  /** A quién se puede mencionar con «@». */
  personas?: Persona[];
  onUpdate: () => void;
};

export function createNoteEditor({ element, content, editable, t, formatMenu, tableMenu, personas = [], onUpdate }: Options): Editor {
  // El menú de tabla necesita el editor para encontrar la tabla, y el editor
  // necesita el menú entre sus extensiones: se rellena al final.
  let editorRef: Editor | null = null;

  const extensions = [
    ...noteExtensions(),
    Placeholder.configure({
      // Solo en la línea donde está el cursor: un texto de ayuda en cada
      // párrafo vacío convierte una nota con huecos en un muro de avisos.
      placeholder: t.placeholder,
      showOnlyCurrent: true,
    }),
  ];

  if (editable) {
    extensions.push(
      SlashMenu.configure({
        items: slashItems({
          text: t['slash.text'], h1: t['slash.h1'], h2: t['slash.h2'], h3: t['slash.h3'],
          bullet: t['slash.bullet'], ordered: t['slash.ordered'], task: t['slash.task'],
          quote: t['slash.quote'], code: t['slash.code'], table: t['slash.table'], divider: t['slash.divider'],
        }),
        emptyLabel: t['slash.empty'],
      }),
      DragHandle.configure({ label: t['drag'] }),
      MentionMenu.configure({
        personas,
        emptyLabel: t['mention.empty'],
        hintContacto: t['mention.contact'],
        hintMiembro: t['mention.member'],
      }),
    );

    if (formatMenu) {
      extensions.push(
        // Cada menú con su propio nombre: dos extensiones que se llaman igual
        // se pisan, y solo funcionaba la última.
        BubbleMenu.extend({ name: 'formatMenu' }).configure({
          pluginKey: 'formatMenu',
          element: formatMenu,
          shouldShow: ({ editor, view, state, from, to, element }) => {
            // Igual que el menú por defecto de Tiptap —con foco, con texto
            // seleccionado, editable—, más dos casos en los que el formato no
            // tiene sentido: dentro de un bloque de código y con un bloque
            // entero cogido por el asa de arrastre.
            const conFoco = view.hasFocus() || element.contains(document.activeElement);
            if (!conFoco || !editor.isEditable || state.selection.empty) return false;
            if (state.selection instanceof NodeSelection || editor.isActive('codeBlock')) return false;
            return state.doc.textBetween(from, to).length > 0;
          },
          options: { placement: 'top' },
        }),
      );
    }

    if (tableMenu) {
      extensions.push(
        BubbleMenu.extend({ name: 'tableMenu' }).configure({
          pluginKey: 'tableMenu',
          element: tableMenu,
          shouldShow: ({ editor, view, element }) =>
            editor.isEditable &&
            (view.hasFocus() || element.contains(document.activeElement)) &&
            editor.isActive('table'),
          // Encima de la tabla entera, no del cursor: así no tapa la celda en
          // la que se escribe ni choca con el menú de formato.
          getReferencedVirtualElement: () => {
            const ed = editorRef;
            if (!ed) return null;
            const { node } = ed.view.domAtPos(ed.state.selection.from);
            const el = (node instanceof HTMLElement ? node : node.parentElement)?.closest('table');
            return el ? { getBoundingClientRect: () => el.getBoundingClientRect() } : null;
          },
          options: { placement: 'top-start' },
        }),
      );
    }
  }

  const editor = new Editor({
    element,
    extensions,
    content,
    editable,
    editorProps: {
      attributes: {
        class: 'note-content prose dark:prose-invert max-w-none focus:outline-none',
        'aria-label': t['aria'],
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: () => onUpdate(),
  });
  editorRef = editor;

  if (formatMenu) wireFormatMenu(editor, formatMenu, t);
  if (tableMenu) wireTableMenu(editor, tableMenu);

  return editor;
}

// ── Menú de formato ─────────────────────────────────────────────────────────

const MARCAS: Record<string, string> = {
  bold: 'toggleBold',
  italic: 'toggleItalic',
  underline: 'toggleUnderline',
  strike: 'toggleStrike',
  highlight: 'toggleHighlight',
  code: 'toggleCode',
};

function wireFormatMenu(editor: Editor, menu: HTMLElement, t: NoteEditorTexts) {
  const form = menu.querySelector<HTMLFormElement>('[data-link-form]');
  const input = menu.querySelector<HTMLInputElement>('[data-link-input]');
  const botones = menu.querySelector<HTMLElement>('[data-buttons]');

  const refrescar = () => {
    menu.querySelectorAll<HTMLButtonElement>('[data-mark]').forEach((b) => {
      b.setAttribute('aria-pressed', String(editor.isActive(b.dataset.mark!)));
    });
  };

  const cerrarEnlace = () => {
    form?.classList.add('hidden');
    botones?.classList.remove('hidden');
  };

  // `mousedown` + `preventDefault`: si el botón se lleva el foco, el editor
  // pierde la selección y el formato no tiene a qué aplicarse.
  menu.addEventListener('mousedown', (ev) => {
    if ((ev.target as HTMLElement).closest('input')) return;
    ev.preventDefault();
  });

  menu.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;

    if (b.dataset.mark) {
      const cmd = MARCAS[b.dataset.mark];
      (editor.chain().focus() as any)[cmd]().run();
      refrescar();
      return;
    }

    if (b.dataset.action === 'link') {
      if (editor.isActive('link')) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        refrescar();
        return;
      }
      botones?.classList.add('hidden');
      form?.classList.remove('hidden');
      if (input) {
        input.value = '';
        input.setCustomValidity('');
        input.focus();
      }
    }
  });

  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    let href = (input?.value ?? '').trim();
    if (!href) {
      cerrarEnlace();
      editor.commands.focus();
      return;
    }
    // «forge-os.online/x» es un enlace a un sitio, no una ruta relativa.
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('/') && !href.startsWith('#')) {
      href = `https://${href}`;
    }
    if (!isSafeHref(href)) {
      input?.setCustomValidity(t['link.invalid']);
      input?.reportValidity();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    cerrarEnlace();
    refrescar();
  });

  input?.addEventListener('input', () => input.setCustomValidity(''));
  input?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cerrarEnlace();
      editor.commands.focus();
    }
  });

  editor.on('selectionUpdate', () => {
    cerrarEnlace();
    refrescar();
  });
  editor.on('transaction', refrescar);
}

// ── Menú de tabla ───────────────────────────────────────────────────────────

const TABLA: Record<string, string> = {
  'row-add': 'addRowAfter',
  'col-add': 'addColumnAfter',
  'row-del': 'deleteRow',
  'col-del': 'deleteColumn',
  'header': 'toggleHeaderRow',
  'table-del': 'deleteTable',
};

function wireTableMenu(editor: Editor, menu: HTMLElement) {
  menu.addEventListener('mousedown', (ev) => ev.preventDefault());
  menu.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-table]');
    if (!b) return;
    const cmd = TABLA[b.dataset.table!];
    if (cmd) (editor.chain().focus() as any)[cmd]().run();
  });
}
