import { Node as PMNodeClass } from '@tiptap/pm/model';
import { noteSchema, isSafeHref } from './schema';
import { fromEditorjs, isEditorjsData, type PMNode } from './fromEditorjs';
import { limpiarMencion } from './mention';

/**
 * Cómo se guarda una nota en `pages.content_json`.
 *
 * `{"format":"tiptap","doc":{…}}`. La marca de formato existe para distinguir
 * sin adivinar una nota nueva de una de Editor.js (`{"blocks":[…]}`), que
 * pueden convivir mientras dure la migración o si se restaura un backup viejo.
 */
export const NOTE_FORMAT = 'tiptap';

export type StoredNote = { format: typeof NOTE_FORMAT; doc: PMNode };

export const emptyDoc = (): PMNode => ({ type: 'doc', content: [{ type: 'paragraph' }] });

export const serializeNote = (doc: PMNode): string =>
  JSON.stringify({ format: NOTE_FORMAT, doc } satisfies StoredNote);

export const EMPTY_NOTE_JSON = serializeNote(emptyDoc());

export function isStoredNote(value: unknown): value is StoredNote {
  return Boolean(
    value && typeof value === 'object' &&
    (value as any).format === NOTE_FORMAT &&
    (value as any).doc && typeof (value as any).doc === 'object'
  );
}

export type LoadedNote =
  | { ok: true; doc: PMNode; legacy: boolean; dropped: string[] }
  | { ok: false };

/**
 * Lee lo que haya en la columna y devuelve siempre un documento de Tiptap.
 *
 * - Nota nueva → tal cual.
 * - Nota de Editor.js → se convierte al vuelo (`legacy: true`). El primer
 *   guardado ya la escribe en el formato nuevo.
 * - Vacía, `null` o `{}` → documento vacío.
 * - JSON que no se puede leer → `ok: false`, y el editor **no** deja guardar:
 *   un documento ilegible es recuperable; uno sobrescrito con nada, no.
 */
export function loadNote(raw: string | null | undefined): LoadedNote {
  if (raw == null || raw === '' || raw === 'null') {
    return { ok: true, doc: emptyDoc(), legacy: false, dropped: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false };
  }

  if (isStoredNote(parsed)) return { ok: true, doc: parsed.doc, legacy: false, dropped: [] };

  if (isEditorjsData(parsed)) {
    const { doc, dropped } = fromEditorjs(parsed);
    return { ok: true, doc, legacy: true, dropped };
  }

  // `{}` es como nacían las páginas hasta ahora.
  if (parsed && typeof parsed === 'object' && Object.keys(parsed).length === 0) {
    return { ok: true, doc: emptyDoc(), legacy: false, dropped: [] };
  }

  return { ok: false };
}

// ── Validación en el servidor ───────────────────────────────────────────────

/** Tope de anidamiento: un documento hecho a mano podría agotar la pila. */
const MAX_DEPTH = 40;

export type ValidationResult =
  | { ok: true; doc: PMNode; dropped: string[] }
  | { ok: false; error: string };

/**
 * Limpieza previa a ProseMirror:
 *
 * - Los bloques de primer nivel de un tipo desconocido se quitan y se
 *   **anotan**, igual que hacía el sanitizador: descartar en silencio y
 *   contestar «guardado» es como desaparecían las tablas.
 * - Los enlaces con un destino no permitido (`javascript:`…) pierden el
 *   enlace, no el texto.
 * - Solo se conservan los atributos que el esquema conoce.
 */
function limpiar(node: any, depth: number): PMNode {
  if (depth > MAX_DEPTH) throw new Error('too_deep');
  const schema = noteSchema();
  const out: PMNode = { type: String(node?.type) };

  // Una mención con atributos raros no se cuela tal cual: el `label` se pinta
  // en la nota de todo el espacio. Si no se puede sanear, queda como texto.
  if (node?.type === 'mention') {
    const m = limpiarMencion(node.attrs);
    if (m) return { type: 'mention', attrs: m };
    const texto = typeof node.attrs?.label === 'string' ? node.attrs.label.trim().slice(0, 80) : '';
    return { type: 'text', text: `@${texto}` };
  }

  if (node?.type === 'text') {
    out.text = typeof node.text === 'string' ? node.text : '';
  }

  const tipo = schema.nodes[out.type];
  if (tipo && node?.attrs && typeof node.attrs === 'object') {
    const attrs: Record<string, unknown> = {};
    for (const k of Object.keys(tipo.spec.attrs ?? {})) {
      if (k in node.attrs) attrs[k] = node.attrs[k];
    }
    if (Object.keys(attrs).length) out.attrs = attrs;
  }

  if (Array.isArray(node?.marks)) {
    const marks = node.marks
      .filter((m: any) => m && schema.marks[m.type])
      .filter((m: any) => m.type !== 'link' || isSafeHref(m.attrs?.href))
      .map((m: any) => {
        if (m.type !== 'link') return { type: m.type };
        // De un enlace solo se guarda el destino; `target` y `rel` los pone
        // el editor al pintarlo, no quien envía el documento.
        return { type: 'link', attrs: { href: m.attrs.href } };
      });
    if (marks.length) out.marks = marks;
  }

  if (Array.isArray(node?.content)) {
    out.content = node.content.map((c: unknown) => limpiar(c, depth + 1));
  }

  return out;
}

export function validateNoteDoc(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || (input as any).type !== 'doc') {
    return { ok: false, error: 'invalid_doc' };
  }

  const schema = noteSchema();
  const dropped: string[] = [];
  const hijos = Array.isArray((input as any).content) ? (input as any).content : [];
  const conocidos = hijos.filter((c: any) => {
    if (c && schema.nodes[c.type] && c.type !== 'doc' && c.type !== 'text') return true;
    dropped.push(String(c?.type ?? 'unknown'));
    return false;
  });

  if (hijos.length > 0 && conocidos.length === 0) {
    return { ok: false, error: 'only_unsupported' };
  }

  let limpio: PMNode;
  try {
    limpio = limpiar({ type: 'doc', content: conocidos.length ? conocidos : [{ type: 'paragraph' }] }, 0);
  } catch {
    return { ok: false, error: 'too_deep' };
  }

  // ProseMirror decide si el documento es válido: tipos de nodo y de marca,
  // qué puede ir dentro de qué, y textos vacíos. Es el mismo esquema con el
  // que escribe el editor, así que lo que el editor produce siempre pasa.
  try {
    const node = PMNodeClass.fromJSON(schema, limpio);
    node.check();
    return { ok: true, doc: node.toJSON() as PMNode, dropped };
  } catch {
    return { ok: false, error: 'invalid_doc' };
  }
}
