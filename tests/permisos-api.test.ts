import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Qué rol exige cada endpoint del espacio.
 *
 * Al unificar las nueve copias de `abrirEspacio`, tres llevaban el rol escrito
 * dentro y la llamada se quedó sin argumento. `files/upload.ts` pasó de exigir
 * `editor` a aceptar `viewer`: **quien solo mira podía subir archivos**. Lo cazó
 * una prueba de navegador; el typecheck no vio nada.
 *
 * El parámetro ya es obligatorio, así que olvidarlo no compila. Pero eso no
 * impide poner el rol **equivocado**, que es igual de grave y más fácil de
 * colar en un refactor. Esta lista es el contrato: si alguien lo cambia, tiene
 * que cambiarlo aquí también y explicarlo en la revisión.
 */

const BASE = path.join(process.cwd(), 'src/pages/api/w/[sys_tag]');

/** Lo que exige cada endpoint hoy, por método cuando difiere. */
const ESPERADO: Record<string, string[]> = {
  'drive.ts':                 ['owner', 'viewer'],  // leer el estado es viewer; conectar y desconectar, owner
  'files/index.ts':           ['viewer', 'editor'],
  'files/link.ts':            ['viewer', 'editor'],
  'files/search.ts':          ['viewer'],  // buscar es leer
  'files/upload.ts':          ['editor'],  // el que se rompió
  'issue-types/index.ts':     ['viewer', 'owner'],
  'issue-types/[id].ts':      ['owner'],   // borrar un tipo reescribe la columna de todos los tickets
  'labels/index.ts':          ['viewer', 'editor'],
  'labels/assign.ts':         ['editor'],
  'members/search.ts':        ['owner'],   // listar personas invitables
  'resources.ts':             ['viewer', 'editor'],
};

function ficheros(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, acc);
    else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const rolesDe = (fichero: string) => {
  const txt = fs.readFileSync(fichero, 'utf-8');
  return [...new Set(
    [...txt.matchAll(/abrirEspacio(?:DeRecurso)?\([^)]*?'(owner|editor|viewer)'\s*\)/g)].map((m) => m[1])
  )].sort();
};

describe('cada endpoint del espacio exige el rol que le toca', () => {
  const todos = ficheros(BASE).map((f) => f.replace(BASE + '/', ''));

  it('se encuentran endpoints que revisar', () => {
    // Que falle en vez de aprobar en vacío si cambia la estructura.
    expect(todos.length).toBeGreaterThan(8);
  });

  it('la lista de arriba cubre todos los que usan abrirEspacio', () => {
    const usan = todos.filter((f) => rolesDe(path.join(BASE, f)).length > 0);
    const sinDeclarar = usan.filter((f) => !(f in ESPERADO));
    expect(
      sinDeclarar,
      `endpoints nuevos sin su rol declarado aquí:\n  ${sinDeclarar.join('\n  ')}`
    ).toEqual([]);
  });

  for (const [fichero, roles] of Object.entries(ESPERADO)) {
    it(`${fichero} exige ${roles.join(' y ')}`, () => {
      const p = path.join(BASE, fichero);
      expect(fs.existsSync(p), `${fichero} ya no existe; actualiza la lista`).toBe(true);
      expect(rolesDe(p)).toEqual([...roles].sort());
    });
  }
});

describe('nadie se salta el módulo común', () => {
  it('no quedan copias locales del preámbulo', () => {
    const copias: string[] = [];
    for (const f of ficheros(BASE)) {
      const txt = fs.readFileSync(f, 'utf-8');
      // Una copia local vuelve a partir el comportamiento en dos: el día que se
      // corrija algo aquí, esa se queda atrás. Ya pasó con la comprobación
      // anti-IDOR de `db/[id]/entries.ts`, que llegó a una sola de treinta y dos.
      if (/^(export )?function abrirEspacio\(/m.test(txt)) copias.push(f.replace(BASE + '/', ''));
      if (/^const json = \(body: unknown/m.test(txt)) copias.push(f.replace(BASE + '/', '') + ' (json)');
    }
    expect(copias).toEqual([]);
  });
});
