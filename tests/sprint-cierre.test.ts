import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

/**
 * Lo que se comprueba aquí no es el servidor —eso ya está cubierto— sino el
 * **tablero**, que es donde estaban los dos fallos que se reportaron:
 *
 *  1. Elegir «Backlog» quitaba `?sprint=` de la URL. El servidor, sin ese
 *     parámetro, aplica la cookie del último sprint y redirige; volvías al
 *     sprint del que salías y el backlog era inalcanzable.
 *  2. Al cerrar un sprint con trabajo dentro, la respuesta 409 del servidor se
 *     pintaba con `res.text()`, así que al usuario le salía el JSON crudo
 *     `{"error_code":"unfinished_issues",...}` en un aviso.
 *
 * Son fallos de una línea cada uno, invisibles en un typecheck y que no rompen
 * ningún test de API. Se fijan leyendo el fuente.
 */
const board = fs.readFileSync('src/pages/w/[sys_tag]/board.astro', 'utf-8');

describe('tablero: selector de sprint', () => {
  it('elegir backlog pone ?sprint=backlog en vez de borrar el parámetro', () => {
    const i = board.indexOf("'sprint-selector'");
    const manejador = board.slice(i, board.indexOf('});', i));
    expect(manejador).toContain("url.searchParams.set('sprint', val)");
    expect(manejador).not.toContain("searchParams.delete('sprint')");
  });

  it('el servidor entiende sprint=backlog como elección, no como ausencia', () => {
    // `search.includes('sprint=')` es verdadero, así que no redirige por cookie.
    expect(board).toContain("!Astro.url.search.includes('sprint=')");
    expect(board).toContain("requestedSprintId !== 'backlog'");
  });
});

describe('tablero: cerrar sprint con trabajo pendiente', () => {
  it('no enseña el cuerpo de la respuesta al usuario', () => {
    // `showToast(await res.text())` es lo que sacaba el JSON a pantalla.
    expect(board).not.toMatch(/showToast\(\s*await res\.text\(\)/);
  });

  it('trata el 409 abriendo el diálogo en vez de dando error', () => {
    expect(board).toContain("res.status === 409");
    expect(board).toContain("datos?.error_code === 'unfinished_issues'");
    expect(board).toContain('abrirDialogoCierre(datos.pending');
  });

  it('ofrece las tres estrategias que acepta el servidor', () => {
    for (const e of ['backlog', 'next', 'keep']) {
      expect(board).toContain(`v: '${e}'`);
    }
  });

  it('manda el destino con el nombre que lee el servidor', () => {
    // El endpoint desestructura `target_sprint_id`; `targetSprintId` llegaría
    // como `undefined` y respondería 400.
    const api = fs.readFileSync('src/pages/api/sprints/[id].ts', 'utf-8');
    expect(api).toContain('target_sprint_id');
    expect(board).toContain('cuerpo.target_sprint_id');
    expect(board).not.toContain('targetSprintId');
  });

  it('no cuenta las tarjetas pendientes en el navegador', () => {
    // El tablero solo pinta 100 por columna: contar ahí mentía en sprints
    // grandes. La cuenta la da el servidor en el 409.
    expect(board).not.toContain(".issue-card').length");
  });

  it('no quedan frases de sprint escritas a mano en inglés', () => {
    expect(board).not.toContain('Are you sure you want to');
    expect(board).not.toContain('Deactivate this sprint');
    expect(board).not.toContain('WARNING: There are');
  });
});

describe('claves de traducción del diálogo', () => {
  const ui = fs.readFileSync('src/i18n/ui.ts', 'utf-8');
  const usadas = [...board.matchAll(/t\('(sprint\.[a-z_]+)'\)/g)].map((m) => m[1]);

  it('el tablero usa claves y no texto suelto', () => {
    expect(usadas.length).toBeGreaterThan(5);
  });

  it('cada clave existe en los dos idiomas', () => {
    const [, en, es] = ui.split(/^\s{2}(?:en|es): \{/m);
    for (const k of new Set(usadas)) {
      expect(en, `falta ${k} en inglés`).toContain(`'${k}':`);
      expect(es, `falta ${k} en español`).toContain(`'${k}':`);
    }
  });
});
