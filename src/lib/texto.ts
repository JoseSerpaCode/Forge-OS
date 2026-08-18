/**
 * Escapado de texto, en un solo sitio.
 *
 * Había cuatro copias de cada cosa, y no idénticas:
 *
 *   `escapeHtml`  4 copias con **tres juegos de caracteres distintos**
 *   `escapeLike`  4 copias del mismo `.replace(/[%_]/g, ...)`
 *
 * Que difieran es peor que que se repitan: una escapaba `&<>"` y otra además
 * `'`, así que el mismo texto salía distinto según por dónde pasara.
 */

/**
 * Texto que va dentro de HTML construido a mano.
 *
 * **Solo al pintar, nunca al guardar.** Es la regla que el propio proyecto
 * documenta en `lib/sanitizer.ts`, y que `api/w/[sys_tag]/db/[id]/entries.ts`
 * incumplía: escapaba el valor de cada celda **antes de meterlo en la base**.
 * Eso no aporta seguridad —quien pinta ya escapa— y sí acumula: un `<` se
 * guarda como `&lt;`, y al reeditar la fila se guarda como `&amp;lt;`. El
 * usuario ve `&lt;` en su celda y no hay forma de escribir un signo de menor.
 *
 * Se escapa la comilla simple además de la doble: un valor puede acabar dentro
 * de un atributo delimitado por comillas simples, y ahí `"` no cierra nada pero
 * `'` sí.
 */
export function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Texto que va dentro de un `LIKE` de SQL.
 *
 * `%` y `_` son comodines. Sin escaparlos, buscar «100%» devuelve **todo**, y
 * buscar «a_b» casa con «axb». La consulta tiene que declarar `ESCAPE '\'` para
 * que la barra invertida cuente como escape.
 */
export function escaparLike(texto: string): string {
  return texto.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/**
 * Una URL que va en un `href`, o `#` si no es segura.
 *
 * `javascript:` en un enlace ejecuta código con solo pulsarlo. Se permiten
 * rutas propias y los esquemas http/https, y nada más: un `data:` en un enlace
 * también sirve para inyectar.
 */
export function hrefSeguro(url: unknown): string {
  const s = String(url ?? '').trim();
  if (!s) return '#';
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  return /^https?:\/\//i.test(s) ? s : '#';
}
