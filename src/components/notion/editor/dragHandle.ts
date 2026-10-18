import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Asa para arrastrar bloques de primer nivel.
 *
 * No es `@tiptap/extension-drag-handle` a propósito: esa extensión importa
 * `yjs` y `y-tiptap` para la edición colaborativa, que aquí no existe, y con
 * ellos dos copias de ProseMirror que no son las de `@tiptap/pm`. Era más
 * peso que todo el editor para una función que cabe en esto.
 *
 * El arrastre en sí lo hace ProseMirror: al empezar se selecciona el bloque y
 * se le pasa a `view.dragging` con `move: true`; al soltar, ProseMirror lo
 * inserta donde cae y borra el original, todo en una transacción que se puede
 * deshacer.
 */

/** El bloque de primer nivel que está a la altura del puntero. */
function bloqueEn(view: EditorView, y: number): { pos: number; dom: HTMLElement } | null {
  const caja = view.dom.getBoundingClientRect();
  // Un poco hacia dentro del borde izquierdo, para caer sobre el texto
  // aunque el puntero esté en el margen donde vive el asa.
  const hit = view.posAtCoords({ left: caja.left + 24, top: y });
  if (!hit) return null;

  // `inside` es el inicio del nodo bajo el puntero. Si ese nodo es ya de
  // primer nivel, es justo el que se busca; si está más dentro (un ítem de
  // una lista), se sube hasta el bloque que lo contiene.
  const base = hit.inside >= 0 ? hit.inside : hit.pos;
  const $pos = view.state.doc.resolve(base);
  const pos = $pos.depth > 0 ? $pos.before(1) : base;
  const node = view.state.doc.nodeAt(pos);
  if (!node) return null;

  const dom = view.nodeDOM(pos);
  return dom instanceof HTMLElement ? { pos, dom } : null;
}

export const DragHandle = Extension.create<{ label: string }>({
  name: 'noteDragHandle',

  addOptions() {
    return { label: '' };
  },

  addProseMirrorPlugins() {
    const label = this.options.label;

    return [
      new Plugin({
        key: new PluginKey('noteDragHandle'),
        view: (view) => {
          const marco = view.dom.parentElement;
          if (!marco || !view.editable) return {};

          const asa = document.createElement('div');
          asa.className = 'note-drag-handle';
          asa.draggable = true;
          asa.title = label;
          // Es una ayuda de ratón: el teclado mueve bloques cortando y
          // pegando, y un lector de pantalla no tiene nada que hacer con ella.
          asa.setAttribute('aria-hidden', 'true');
          asa.innerHTML =
            '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></svg>';
          marco.append(asa);

          let actual: { pos: number; dom: HTMLElement } | null = null;

          const esconder = () => {
            asa.classList.remove('is-visible');
            actual = null;
          };

          const mover = (ev: MouseEvent) => {
            if (view.dragging) return;
            if (ev.target === asa || asa.contains(ev.target as Node)) return;
            const b = bloqueEn(view, ev.clientY);
            if (!b) return esconder();
            actual = b;
            const rm = marco.getBoundingClientRect();
            const rb = b.dom.getBoundingClientRect();
            // Alineada con la primera línea del bloque, no con su centro: en
            // un párrafo largo el centro queda lejos de donde se lee.
            const linea = Number.parseFloat(getComputedStyle(b.dom).lineHeight) || 24;
            asa.style.top = `${rb.top - rm.top + Math.min(linea, rb.height) / 2 - 8}px`;
            asa.style.left = `${rb.left - rm.left - 22}px`;
            asa.classList.add('is-visible');
          };

          const salir = (ev: MouseEvent) => {
            if (ev.relatedTarget instanceof Node && marco.contains(ev.relatedTarget)) return;
            esconder();
          };

          asa.addEventListener('dragstart', (ev) => {
            if (!actual || !ev.dataTransfer) return;
            const sel = NodeSelection.create(view.state.doc, actual.pos);
            view.dispatch(view.state.tr.setSelection(sel));
            const slice = sel.content();
            const { dom, text } = view.serializeForClipboard(slice);
            ev.dataTransfer.clearData();
            ev.dataTransfer.setData('text/html', dom.innerHTML);
            ev.dataTransfer.setData('text/plain', text);
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setDragImage(actual.dom, 0, 0);
            view.dragging = { slice, move: true };
          });

          asa.addEventListener('dragend', () => {
            view.dragging = null;
            esconder();
          });

          marco.addEventListener('mousemove', mover);
          marco.addEventListener('mouseleave', salir);

          return {
            destroy() {
              marco.removeEventListener('mousemove', mover);
              marco.removeEventListener('mouseleave', salir);
              asa.remove();
            },
          };
        },
      }),
    ];
  },
});
