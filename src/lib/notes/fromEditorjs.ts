/**
 * Conversión de una nota de Editor.js al documento de Tiptap.
 *
 * Función pura: no toca la base ni el DOM, para que la puedan usar igual el
 * script de migración, la lectura de una nota que llegue en formato viejo (un
 * backup restaurado, por ejemplo) y los tests.
 *
 * La regla es la misma que siguió el sanitizador después de sus cuatro
 * pérdidas silenciosas: **lo que no se sabe convertir, se dice**. Cada bloque
 * desconocido acaba en `dropped`, nunca desaparece sin más.
 */

import { isSafeHref } from './href';

export type PMMark = { type: string; attrs?: Record<string, unknown> };
export type PMNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
};

export type ConversionResult = { doc: PMNode; dropped: string[] };

// ── Texto en línea ──────────────────────────────────────────────────────────
//
// Editor.js guarda el formato en línea como HTML dentro de cada bloque. El
// sanitizador solo dejaba pasar `b i u mark code a br`, así que basta un
// analizador pequeño; no hace falta un DOM entero en el servidor. Las
// etiquetas que no se reconocen se ignoran **conservando su texto**.

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
};

function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (entera, cuerpo: string) => {
    const c = cuerpo.toLowerCase();
    if (c in ENTIDADES) return ENTIDADES[c];
    if (c.startsWith('#x')) return String.fromCodePoint(Number.parseInt(c.slice(2), 16));
    if (c.startsWith('#')) return String.fromCodePoint(Number.parseInt(c.slice(1), 10));
    return entera;
  });
}

const MARCA_DE: Record<string, string> = {
  b: 'bold', strong: 'bold',
  i: 'italic', em: 'italic',
  u: 'underline',
  s: 'strike', strike: 'strike', del: 'strike',
  mark: 'highlight',
  code: 'code',
  a: 'link',
};

function hrefDe(atributos: string): string | null {
  const m = atributos.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return null;
  return decodificar(m[2] ?? m[3] ?? m[4] ?? '');
}

export function inlineFromHtml(entrada: unknown): PMNode[] {
  if (typeof entrada !== 'string' || !entrada) return [];
  // De `<script>` y `<style>` no se conserva ni el texto: no es contenido de
  // quien escribió la nota.
  const html = entrada.replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');

  const salida: PMNode[] = [];
  // Pila de marcas abiertas, con la etiqueta que las abrió para poder cerrar
  // la correcta aunque el HTML venga mal anidado.
  const abiertas: { tag: string; mark: PMMark }[] = [];

  const emitir = (texto: string) => {
    if (!texto) return;
    const marks = abiertas.map((a) => a.mark);
    // Una marca repetida (`<b><b>x</b></b>`) no se puede aplicar dos veces.
    let unicas = marks.filter((m, i) => marks.findIndex((o) => o.type === m.type) === i);
    // En Tiptap el código en línea excluye cualquier otra marca: `<b><code>`
    // dejaría un documento que ProseMirror rechaza. Se queda el código.
    if (unicas.some((m) => m.type === 'code')) unicas = [{ type: 'code' }];
    const nodo: PMNode = { type: 'text', text: texto };
    if (unicas.length) nodo.marks = unicas;
    // Juntar con el anterior si lleva exactamente las mismas marcas.
    const prev = salida[salida.length - 1];
    if (prev?.type === 'text' && JSON.stringify(prev.marks ?? []) === JSON.stringify(nodo.marks ?? [])) {
      prev.text += texto;
    } else {
      salida.push(nodo);
    }
  };

  const re = /<\s*(\/)?\s*([a-z0-9]+)([^>]*)>/gi;
  let ultimo = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    emitir(decodificar(html.slice(ultimo, m.index)));
    ultimo = re.lastIndex;

    const cierra = Boolean(m[1]);
    const tag = m[2].toLowerCase();

    if (tag === 'br') {
      salida.push({ type: 'hardBreak' });
      continue;
    }

    const tipo = MARCA_DE[tag];
    if (!tipo) continue;

    if (cierra) {
      for (let i = abiertas.length - 1; i >= 0; i--) {
        if (abiertas[i].tag === tag) {
          abiertas.splice(i, 1);
          break;
        }
      }
      continue;
    }

    if (tipo === 'link') {
      const href = hrefDe(m[3]);
      // Un enlace sin destino válido se queda como texto: el sanitizador ya
      // quitaba esos href, así que no se pierde nada que antes funcionara.
      if (!isSafeHref(href)) {
        abiertas.push({ tag, mark: { type: '__nada' } });
        continue;
      }
      abiertas.push({ tag, mark: { type: 'link', attrs: { href } } });
      continue;
    }

    abiertas.push({ tag, mark: { type: tipo } });
  }
  emitir(decodificar(html.slice(ultimo)));

  // Quitar las marcas de relleno de los enlaces sin destino.
  for (const n of salida) {
    if (n.marks) {
      n.marks = n.marks.filter((mk) => mk.type !== '__nada');
      if (!n.marks.length) delete n.marks;
    }
  }

  return salida;
}

// ── Bloques ─────────────────────────────────────────────────────────────────

const parrafo = (html: unknown): PMNode => {
  const content = inlineFromHtml(html);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
};

const parrafoDeNodos = (content: PMNode[]): PMNode =>
  content.length ? { type: 'paragraph', content } : { type: 'paragraph' };

const MAX_PROFUNDIDAD = 10;

type ItemV2 = { content?: unknown; meta?: { checked?: unknown }; items?: unknown };

/**
 * Listas de `@editorjs/list`, en sus dos formatos: v1 (`items: string[]`) y
 * v2 (`{ content, meta, items }` anidados). La v2 tiene además el estilo
 * `checklist`, que se convierte a lista de tareas igual que el bloque
 * `checklist` propio.
 */
function lista(estilo: string, items: unknown, start: unknown, profundidad: number): PMNode | null {
  if (!Array.isArray(items) || !items.length || profundidad > MAX_PROFUNDIDAD) return null;

  const deTareas = estilo === 'checklist';
  const tipoLista = deTareas ? 'taskList' : estilo === 'ordered' ? 'orderedList' : 'bulletList';
  const tipoItem = deTareas ? 'taskItem' : 'listItem';

  const content: PMNode[] = items.map((item) => {
    if (typeof item === 'string') {
      const nodo: PMNode = { type: tipoItem, content: [parrafo(item)] };
      if (deTareas) nodo.attrs = { checked: false };
      return nodo;
    }
    const it = (item && typeof item === 'object' ? item : {}) as ItemV2;
    const hijos: PMNode[] = [parrafo(it.content)];
    const anidada = lista(estilo, it.items, undefined, profundidad + 1);
    if (anidada) hijos.push(anidada);
    const nodo: PMNode = { type: tipoItem, content: hijos };
    if (deTareas) nodo.attrs = { checked: it.meta?.checked === true };
    return nodo;
  });

  const nodo: PMNode = { type: tipoLista, content };
  if (tipoLista === 'orderedList' && typeof start === 'number' && start > 1) {
    nodo.attrs = { start };
  }
  return nodo;
}

function tabla(data: any): PMNode | null {
  const filas = Array.isArray(data?.content) ? data.content.filter(Array.isArray) : [];
  if (!filas.length) return null;

  // ProseMirror exige que todas las filas tengan las mismas celdas.
  const ancho = Math.max(...filas.map((f: unknown[]) => f.length));
  if (ancho === 0) return null;

  const conCabecera = data?.withHeadings === true;
  return {
    type: 'table',
    content: filas.map((fila: unknown[], i: number) => ({
      type: 'tableRow',
      content: Array.from({ length: ancho }, (_, j) => ({
        type: conCabecera && i === 0 ? 'tableHeader' : 'tableCell',
        content: [parrafo(fila[j])],
      })),
    })),
  };
}

function bloque(b: any): PMNode[] | null {
  const data = b?.data && typeof b.data === 'object' ? b.data : {};

  switch (b?.type) {
    case 'paragraph':
      return [parrafo(data.text)];

    case 'header': {
      const nivel = Math.min(Math.max(Number(data.level) || 1, 1), 3);
      const content = inlineFromHtml(data.text);
      return [content.length ? { type: 'heading', attrs: { level: nivel }, content } : { type: 'heading', attrs: { level: nivel } }];
    }

    case 'list': {
      const estilo = typeof data.style === 'string' ? data.style : 'unordered';
      const l = lista(estilo, data.items, data.meta?.start, 0);
      return l ? [l] : [];
    }

    case 'checklist': {
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) return [];
      return [{
        type: 'taskList',
        content: items.map((it: any) => ({
          type: 'taskItem',
          attrs: { checked: it?.checked === true },
          content: [parrafo(it?.text)],
        })),
      }];
    }

    case 'quote': {
      const content = [parrafo(data.text)];
      const pie = inlineFromHtml(data.caption);
      if (pie.length) content.push(parrafoDeNodos([{ type: 'text', text: '— ' }, ...pie]));
      return [{ type: 'blockquote', content }];
    }

    case 'warning': {
      // Tiptap no trae un bloque de aviso. Una cita con el título en negrita
      // conserva todo el texto y se lee igual de destacada.
      const content: PMNode[] = [];
      const titulo = inlineFromHtml(data.title).map((n) =>
        n.type === 'text' ? { ...n, marks: [...(n.marks ?? []).filter((m) => m.type !== 'bold'), { type: 'bold' }] } : n
      );
      if (titulo.length) content.push(parrafoDeNodos(titulo));
      const mensaje = inlineFromHtml(data.message);
      if (mensaje.length) content.push(parrafoDeNodos(mensaje));
      return content.length ? [{ type: 'blockquote', content }] : [];
    }

    case 'table': {
      const t = tabla(data);
      return t ? [t] : [];
    }

    case 'code': {
      // El código de Editor.js es texto plano, sin escapar (ver el
      // historial del sanitizador): va tal cual, sin decodificar entidades.
      const codigo = typeof data.code === 'string' ? data.code : '';
      return [codigo ? { type: 'codeBlock', content: [{ type: 'text', text: codigo }] } : { type: 'codeBlock' }];
    }

    case 'delimiter':
      return [{ type: 'horizontalRule' }];

    default:
      return null;
  }
}

export function isEditorjsData(value: unknown): value is { blocks: unknown[] } {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as any).blocks));
}

export function fromEditorjs(data: unknown): ConversionResult {
  const blocks = isEditorjsData(data) ? data.blocks : [];
  const content: PMNode[] = [];
  const dropped: string[] = [];

  for (const b of blocks) {
    const nodos = bloque(b);
    if (nodos === null) {
      dropped.push(String((b as any)?.type ?? 'unknown'));
      continue;
    }
    content.push(...nodos);
  }

  // El documento necesita al menos un bloque.
  if (!content.length) content.push({ type: 'paragraph' });

  return { doc: { type: 'doc', content }, dropped };
}
