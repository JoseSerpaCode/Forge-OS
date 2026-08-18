import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { colorDeNotificacion } from '../src/lib/notificaciones';

describe('el color de una notificación significa lo mismo en todas partes', () => {
  it('cada tipo tiene su color', () => {
    expect(colorDeNotificacion('assign')).toBe('bg-forge-info');
    expect(colorDeNotificacion('mention')).toBe('bg-forge-warning');
    expect(colorDeNotificacion('system')).toBe('bg-forge-error');
    expect(colorDeNotificacion('cualquier-otra')).toBe('bg-forge-primary');
  });

  it('una notificación leída pierde el color', () => {
    // Ya no compite por la atención.
    expect(colorDeNotificacion('system', true)).toBe('bg-forge-border');
  });

  it('nadie vuelve a calcularlo por su cuenta', () => {
    /**
     * Estaba escrito cuatro veces y las cuatro no coincidían: `activity.astro`
     * solo distinguía «leída» de «sistema», así que la misma notificación salía
     * de un color en la campana y de otro en la página de actividad.
     */
    const copias: string[] = [];
    for (const f of ['src/components/layout/TopBar.astro', 'src/pages/activity.astro']) {
      const txt = fs.readFileSync(f, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
      // El patrón inconfundible: el ternario encadenado sobre el tipo.
      for (const m of txt.matchAll(/type === '(assign|mention)'/g)) {
        copias.push(`${f}: ${m[0]}`);
      }
    }
    expect(copias, `color calculado a mano en:\n  ${copias.join('\n  ')}`).toEqual([]);
  });
});
