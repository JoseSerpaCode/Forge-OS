import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizado de los bloques de Editor.js antes de guardarlos.
 *
 * Este módulo perdía datos de forma silenciosa. Cuatro casos distintos, todos
 * con el mismo patrón: el servidor respondía 200, el editor en memoria seguía
 * enseñando el contenido correcto, y la pérdida solo se descubría al recargar
 * —cuando ya era irrecuperable—.
 *
 * La regla que se sigue ahora: **si un bloque no se puede sanitizar, se dice**.
 * `sanitizeEditorBlocks` devuelve también qué se descartó, para que el endpoint
 * lo comunique en vez de contestar «guardado».
 */

DOMPurify.addHook('afterSanitizeAttributes', function (node) {
  // Validación de Protocolos en Href
  if (node.hasAttribute('href')) {
    const href = node.getAttribute('href') || '';
    // Protocolos seguros (http/https/mailto), rutas absolutas (/), o anclas (#)
    // El doble slash (//) se rechaza explícitamente para evitar protocol-relative URLs engañosas (ej. //evil.com)
    if (!/^(https?|mailto):/i.test(href) && !(href.startsWith('/') && !href.startsWith('//')) && !href.startsWith('#')) {
      node.removeAttribute('href');
    }
  }

  // Prevención de Reverse Tabnabbing
  if (node.hasAttribute('target')) {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Etiquetas en línea permitidas.
 *
 * Tiene que cubrir lo que emiten las herramientas registradas en
 * `EditorClient.astro`, o su formato se borra en el primer guardado:
 *
 *   Bold/Italic (nativas) → `b`, `i`      Marker    → `mark`
 *   InlineCode            → `code`        Underline → `u`
 *   Link                  → `a`
 *
 * `u` y `br` faltaban: subrayar un texto o pulsar Shift+Enter parecía funcionar
 * hasta que se recargaba la página.
 */
const sanitizeOptions = {
  ALLOWED_TAGS: ['b', 'i', 'mark', 'code', 'a', 'u', 'br'],
  ALLOWED_ATTR: ['href', 'target'],
  ALLOW_DATA_URI: false,
};

const cleanHTML = (dirty: string) => DOMPurify.sanitize(dirty, sanitizeOptions);

const cleanText = (value: unknown): string => (typeof value === 'string' ? cleanHTML(value) : '');

/**
 * Ítem de lista de `@editorjs/list` **v2**.
 *
 * v1 devolvía `items: string[]`. v2.0.9 —la instalada— devuelve objetos
 * `{ content, meta, items }`, con anidamiento arbitrario. El código anterior
 * comprobaba `typeof item === 'string'` y, al no cumplirse nunca, sustituía
 * **cada ítem por cadena vacía**. Toda lista guardada desde entonces perdió su
 * texto y su estructura.
 *
 * Se aceptan los dos formatos: el paquete todavía declara `OldListData`, así
 * que puede alimentarnos cualquiera de los dos según de dónde venga el
 * documento.
 */
type ListItem = { content?: unknown; meta?: unknown; items?: unknown };

function sanitizeListItems(items: unknown, depth = 0): unknown[] {
  if (!Array.isArray(items)) return [];

  // Tope de anidamiento: un documento manipulado a mano podría traer una
  // estructura de miles de niveles y agotar la pila del servidor.
  if (depth > 10) return [];

  return items.map((item) => {
    // Formato v1: el ítem es directamente el texto.
    if (typeof item === 'string') return cleanHTML(item);

    if (item && typeof item === 'object') {
      const it = item as ListItem;
      return {
        ...it,
        content: cleanText(it.content),
        // El anidamiento va dentro de cada ítem, así que hay que bajar.
        items: sanitizeListItems(it.items, depth + 1),
      };
    }

    return { content: '', meta: {}, items: [] };
  });
}

export type SanitizeResult = {
  blocks: any[];
  /** Tipos de bloque que se han descartado, para poder decírselo al usuario. */
  dropped: string[];
};

export function sanitizeEditorBlocksDetailed(blocks: any[]): SanitizeResult {
  if (!Array.isArray(blocks)) return { blocks: [], dropped: [] };

  const safeBlocks: any[] = [];
  const dropped: string[] = [];

  for (const block of blocks) {
    // Clon superficial para no mutar los originales en memoria
    const safeBlock = { ...block, data: { ...block.data } };

    switch (block.type) {
      case 'paragraph':
      case 'header':
        safeBlock.data.text = cleanText(safeBlock.data.text);
        safeBlocks.push(safeBlock);
        break;

      case 'quote':
        safeBlock.data.text = cleanText(safeBlock.data.text);
        safeBlock.data.caption = cleanText(safeBlock.data.caption);
        safeBlocks.push(safeBlock);
        break;

      case 'list':
        safeBlock.data.items = sanitizeListItems(safeBlock.data.items);
        safeBlocks.push(safeBlock);
        break;

      case 'checklist':
        if (Array.isArray(safeBlock.data.items)) {
          safeBlock.data.items = safeBlock.data.items.map((item: any) => ({
            ...item,
            text: cleanText(item?.text),
          }));
        }
        safeBlocks.push(safeBlock);
        break;

      case 'table':
        // Estaba registrada en el editor pero no aquí, así que caía en el
        // `default` y **se borraba entera** en el primer guardado.
        if (Array.isArray(safeBlock.data.content)) {
          safeBlock.data.content = safeBlock.data.content.map((row: any) =>
            Array.isArray(row) ? row.map(cleanText) : []
          );
        }
        safeBlocks.push(safeBlock);
        break;

      case 'code':
        // El código va como **texto plano**, sin escapar.
        //
        // Antes se reemplazaban `&`, `<` y `>` por entidades en cada guardado.
        // `@editorjs/code` guarda y restaura por `textarea.value`, que no
        // interpreta HTML, así que el escapado no protegía de nada y en cambio
        // se acumulaba: `<` se guardaba como `&lt;`, al recargar el textarea
        // mostraba `&lt;` literal, y el siguiente autoguardado lo convertía en
        // `&amp;lt;`. Cada segundo, indefinidamente.
        //
        // No hay riesgo de XSS porque nada renderiza este campo como HTML: la
        // página se pinta entera en el cliente desde el JSON (ver
        // `EditorClient.astro`). Si algún día se renderiza en servidor, hay que
        // escapar **al pintar**, no al guardar.
        if (typeof safeBlock.data.code !== 'string') safeBlock.data.code = '';
        safeBlocks.push(safeBlock);
        break;

      case 'delimiter':
        // Delimiters have no user-editable content, safe to pass through
        safeBlocks.push(safeBlock);
        break;

      case 'warning':
        safeBlock.data.title = cleanText(safeBlock.data.title);
        safeBlock.data.message = cleanText(safeBlock.data.message);
        safeBlocks.push(safeBlock);
        break;

      default:
        // Cierre crítico de brecha: cualquier tipo de bloque desconocido —o el
        // peligroso `raw`— se descarta. Pero **se anota**: descartar en
        // silencio y responder 200 es lo que hizo que las tablas
        // desaparecieran sin que nadie se enterara.
        dropped.push(String(block?.type ?? 'unknown'));
        break;
    }
  }

  return { blocks: safeBlocks, dropped };
}

/** Forma corta, para quien solo necesita los bloques. */
export function sanitizeEditorBlocks(blocks: any[]): any[] {
  return sanitizeEditorBlocksDetailed(blocks).blocks;
}
