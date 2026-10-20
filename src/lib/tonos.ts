/**
 * El tono de cada persona: el color de su avatar y de su barra de carga.
 *
 * Sale del nombre, así que es estable y no hay que guardarlo. Son tonos
 * oscuros a propósito: van **en tinte** (24 % sobre el panel) detrás de las
 * iniciales en tinta, y con cualquiera de ellos el texto queda por encima de
 * 4,5:1 en los dos temas (docs/rediseno/componentes.html, «Colores que elige
 * el equipo»). Nunca tiñen texto.
 */
const TONOS = ['#7044B8', '#0E7490', '#A16207', '#B42318', '#2E7D6B', '#6D28D9', '#9A3412', '#334155'];

export function tonoDe(nombre: string | null | undefined): string {
  let h = 0;
  for (const c of nombre ?? '') h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return TONOS[h % TONOS.length];
}

/** La foto por defecto no es una foto: mejor las iniciales. */
export const esFotoReal = (url: string | null | undefined) => !!url && !url.includes('default-avatar');
