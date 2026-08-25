import { describe, it, expect } from 'vitest';
import { nombreVisible } from '../src/lib/issueTypes';

/**
 * Qué nombre se enseña de un tipo de ticket.
 *
 * La regla estaba copiada cinco veces y las cinco ignoraban `name` cuando el
 * tipo era de fábrica, así que renombrar «Task» a «Incidencia» no se veía en
 * ninguna parte salvo en el propio diálogo de renombrar.
 *
 * La regla buena es la que el proyecto ya aplica a etiquetas y tipos propios:
 * lo que escribe una persona no se traduce. Pero hay que conservar la
 * traducción para quien nunca renombra, que es casi todo el mundo — de ahí que
 * se compare contra el nombre original en vez de mirar solo `isBuiltin`.
 */
const es = (clave: string) => ({
  'type.task': 'Tarea',
  'type.bug': 'Error',
  'type.story': 'Historia',
  'type.epic': 'Épica',
}[clave]);

const en = (clave: string) => ({
  'type.task': 'Task',
  'type.bug': 'Bug',
}[clave]);

describe('nombreVisible', () => {
  it('un tipo de fábrica intacto se traduce', () => {
    const tarea = { key: 'task', name: 'Task', isBuiltin: true };
    expect(nombreVisible(tarea, es)).toBe('Tarea');
    expect(nombreVisible(tarea, en)).toBe('Task');
  });

  it('un tipo de fábrica renombrado gana en los dos idiomas', () => {
    const renombrado = { key: 'task', name: 'Incidencia', isBuiltin: true };
    expect(nombreVisible(renombrado, es)).toBe('Incidencia');
    expect(nombreVisible(renombrado, en)).toBe('Incidencia');
  });

  it('un tipo propio nunca se traduce', () => {
    const propio = { key: 'preventivo', name: 'Preventivo', isBuiltin: false };
    expect(nombreVisible(propio, es)).toBe('Preventivo');
  });

  it('si falta la traducción cae al nombre, no a la clave', () => {
    const sinTraducir = { key: 'story', name: 'Story', isBuiltin: true };
    expect(nombreVisible(sinTraducir, en)).toBe('Story');
  });

  it('sin tipo resuelto devuelve vacío, no «undefined»', () => {
    expect(nombreVisible(null, es)).toBe('');
    expect(nombreVisible(undefined, es)).toBe('');
  });
});
