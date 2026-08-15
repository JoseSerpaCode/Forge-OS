/**
 * Iconos con nombre.
 *
 * El resto de la interfaz dibuja iconos de línea de 24×24 con `currentColor`;
 * las tablas eran lo único que usaba emoji, y un emoji no hereda el color del
 * tema, cambia de dibujo según el sistema operativo y desentona con todo lo
 * demás. Aquí van solo los trazos: el `<svg>` que los envuelve lo pone
 * `Icon.astro`, para que el grosor y el tamaño se decidan en un único sitio.
 *
 * Lo que se guarda en la base de datos es **el nombre**, no el dibujo. Un
 * nombre desconocido no se pinta: `esIcono` lo filtra antes, y así lo que se
 * inyecta como marcado sale siempre de esta tabla y nunca de lo que haya
 * escrito nadie.
 */
export const ICONOS = {
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  'graduation-cap': '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M22 10v6"/><path d="M6 12v5a6 3 0 0 0 12 0v-5"/>',
  'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 12h3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  package: '<path d="m7.5 4.3 9 5.2"/><path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  'chart-column': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><path d="M7.5 7.5h.01"/>',
} as const;

export type NombreIcono = keyof typeof ICONOS;

/** El que se usa cuando una tabla no tiene ninguno elegido. */
export const ICONO_POR_DEFECTO: NombreIcono = 'database';

/** El orden en que salen en el selector. */
export const ICONOS_ELEGIBLES = Object.keys(ICONOS) as NombreIcono[];

export function esIcono(valor: unknown): valor is NombreIcono {
  // `hasOwn` y no `in`: `in` recorre el prototipo, así que `'toString' in ICONOS`
  // es cierto y `ICONOS['toString']` devolvería una función, que acabaría
  // volcada dentro del `<svg>` como texto.
  return typeof valor === 'string' && Object.hasOwn(ICONOS, valor);
}
