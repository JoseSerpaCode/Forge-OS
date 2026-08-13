import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseChangelog } from '../src/lib/changelog';

const SAMPLE = `# Changelog

> Una cita que no debe salir.

## [2.0.0] - 2026-01-15

### Added

- **Algo nuevo.** Con su explicación detrás.
- **Otro con coma**, que sigue tras la negrita.
- Un punto sin negrita ninguna.
  - Uno anidado que no debe contarse.

### Fixed

- **Un arreglo:** con dos puntos dentro de la negrita.

| tabla | que |
|---|---|
| no | sale |

## [1.9.0] - 2026-01-01

### Security

- **Un parche de seguridad.**
`;

describe('parseo del changelog', () => {
  const rel = parseChangelog(SAMPLE, 5);

  it('encuentra las versiones y sus fechas', () => {
    expect(rel.map((r) => r.version)).toEqual(['2.0.0', '1.9.0']);
    expect(rel[0].date).toBe('2026-01-15');
  });

  it('clasifica por sección', () => {
    expect(rel[0].items.map((i) => i.kind)).toEqual(['added', 'added', 'added', 'fixed']);
    expect(rel[1].items[0].kind).toBe('security');
  });

  it('separa titular y detalle', () => {
    expect(rel[0].items[0]).toEqual({ kind: 'added', title: 'Algo nuevo.', body: 'Con su explicación detrás.' });
  });

  it('no deja comas ni dos puntos colgando en los bordes', () => {
    // `**Otro con coma**, que sigue` partía en un cuerpo que empezaba por coma.
    expect(rel[0].items[1].title).toBe('Otro con coma');
    expect(rel[0].items[1].body).toBe('que sigue tras la negrita.');
    expect(rel[0].items[3].title).toBe('Un arreglo');
  });

  it('un punto sin negrita queda como titular solo', () => {
    expect(rel[0].items[2]).toEqual({ kind: 'added', title: 'Un punto sin negrita ninguna.', body: '' });
  });

  it('ignora tablas, citas y puntos anidados', () => {
    const todo = rel.flatMap((r) => r.items).map((i) => i.title + i.body).join(' ');
    expect(todo).not.toContain('anidado');
    expect(todo).not.toContain('no debe salir');
    expect(todo).not.toContain('tabla');
  });

  it('respeta el límite de versiones', () => {
    expect(parseChangelog(SAMPLE, 1)).toHaveLength(1);
  });

  it('funciona sobre el changelog real del proyecto', () => {
    // La portada lo pinta en cada carga: si el formato del archivo cambia y
    // esto devuelve vacío, la sección desaparece sin que nadie se entere.
    const real = parseChangelog(fs.readFileSync('CHANGELOG.md', 'utf8'), 3);
    expect(real).toHaveLength(3);
    // Basta con que la última versión traiga **algo**. Antes se exigían más de
    // tres puntos, y eso ata la prueba al tamaño de la release: una versión de
    // parche con dos arreglos la rompía sin que nada estuviera mal. Lo que hay
    // que proteger es que el parseo siga devolviendo contenido, no que las
    // notas sean largas.
    expect(real[0].items.length).toBeGreaterThan(0);
    for (const r of real) {
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
      for (const i of r.items) {
        expect(i.title.length).toBeGreaterThan(0);
        // Sin marcado crudo. Un `*` suelto sí es legítimo: hay entradas que
        // citan `text-red-*`, donde el asterisco es parte del nombre.
        expect(i.title).not.toContain('**');
        expect(i.title).not.toContain('`');
      }
    }
  });
});
