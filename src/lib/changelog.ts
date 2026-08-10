/**
 * Lee `CHANGELOG.md` y lo convierte en algo que se pueda pintar.
 *
 * La alternativa era escribir las novedades a mano en la portada. Duraría un
 * par de versiones: nadie se acuerda de actualizar dos sitios, y una sección de
 * «últimas novedades» que anuncia lo de hace seis meses es peor que no tenerla,
 * porque dice que el proyecto está parado.
 *
 * Así que la fuente es el changelog de verdad. Si una entrada no está ahí, no
 * sale en la portada — que es exactamente el incentivo correcto.
 */

export type ChangeKind = 'added' | 'changed' | 'fixed' | 'removed' | 'security' | 'other';

export type ChangeItem = {
  kind: ChangeKind;
  /** La frase en negrita que abre el punto, si la hay. */
  title: string;
  /** El resto del punto. Puede quedar vacío. */
  body: string;
};

export type Release = {
  version: string;
  date: string;
  items: ChangeItem[];
};

const KINDS: Record<string, ChangeKind> = {
  added: 'added',
  añadido: 'added',
  changed: 'changed',
  cambiado: 'changed',
  fixed: 'fixed',
  corregido: 'fixed',
  removed: 'removed',
  eliminado: 'removed',
  security: 'security',
  seguridad: 'security',
};

/** Quita el marcado en línea: la portada pinta texto, no Markdown. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // enlaces → su texto
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae las últimas versiones.
 *
 * Se salta las tablas, las citas y todo lo que no sea un punto de lista: el
 * changelog trae tablas de medidas de Lighthouse que son útiles leyéndolo y
 * ruido en una portada.
 */
export function parseChangelog(markdown: string, limit = 3): Release[] {
  const releases: Release[] = [];
  const lines = markdown.split('\n');

  let current: Release | null = null;
  let kind: ChangeKind = 'other';

  for (const raw of lines) {
    const line = raw.trimEnd();

    const version = line.match(/^##\s+\[?([\d.]+)\]?\s*[-–]\s*(.+)$/);
    if (version) {
      if (current && current.items.length) releases.push(current);
      if (releases.length >= limit) break;
      current = { version: version[1], date: version[2].trim(), items: [] };
      kind = 'other';
      continue;
    }

    if (!current) continue;

    const section = line.match(/^###\s+(.+)$/);
    if (section) {
      kind = KINDS[section[1].trim().toLowerCase()] ?? 'other';
      continue;
    }

    // Solo puntos de primer nivel. Los anidados amplían el de arriba y en una
    // lista suelta se leen como afirmaciones sin contexto.
    const bullet = line.match(/^-\s+(.+)$/);
    if (!bullet) continue;

    const content = bullet[1];
    const lead = content.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);

    // La negrita de cabecera no siempre acaba la frase: hay entradas del tipo
    // `**Correo en el registro**, con índice único parcial: …`, que partidas en
    // crudo dejan un título con dos puntos colgando y un cuerpo que empieza por
    // coma. Se limpian los bordes de las dos mitades.
    const title = stripMarkdown(lead ? lead[1] : content).replace(/[:,;]+$/, '');
    const body = stripMarkdown(lead ? lead[2] : '').replace(/^[,;:—-]+\s*/, '');

    // Una entrada sin frase de cabecera y larguísima es un párrafo, no un
    // titular: se parte por la primera frase para que la tarjeta respire.
    if (!lead && title.length > 120) {
      const cut = title.indexOf('. ');
      if (cut > 20) {
        current.items.push({ kind, title: title.slice(0, cut + 1), body: title.slice(cut + 2) });
        continue;
      }
    }

    current.items.push({ kind, title, body });
  }

  if (current && current.items.length && releases.length < limit) releases.push(current);
  return releases;
}
