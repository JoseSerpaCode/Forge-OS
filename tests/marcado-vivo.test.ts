import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Referencias del script a marcado que no existe.
 *
 * Esta clase de fallo no da ningún error: el typecheck pasa —`getElementById`
 * devuelve `HTMLElement | null` y el guard trata el nulo— la página carga, y la
 * función simplemente no hace nada.
 *
 * El caso que la motiva: el buscador de personas al invitar. Endpoint escrito,
 * script escrito, typecheck en verde, y faltaba el `<div id="add-member-results">`
 * donde pintar la lista. El script salía por `if (!lista) return` y el campo se
 * comportaba igual que antes de tener buscador. Se dio por arreglado sin abrir
 * el navegador.
 */

const RAIZ = path.join(process.cwd(), 'src');

function ficheros(dir: string, ext: string[], acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, ext, acc);
    else if (ext.some((x) => e.name.endsWith(x))) acc.push(p);
  }
  return acc;
}

const ASTRO = ficheros(RAIZ, ['.astro']);
const TODO = ASTRO.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');
const rel = (f: string) => f.replace(process.cwd() + '/', '');

/**
 * Sin comentarios.
 *
 * La primera versión señaló un `getElementById('btn-create-ws-modal')` que
 * estaba **dentro de un comentario** explicando que se había quitado. Una
 * prueba que lee comentarios acusa a quien documenta lo que arregló.
 */
const soloCodigo = (txt: string) =>
  txt
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/**
 * Ids que no se escriben literalmente en el marcado y aun así existen.
 *
 * `WorkspaceIcon` los recibe por props (`imgId`, `textId`), así que en el
 * fichero que los usa aparecen como `imgId="ws-icon-preview-img"` y no como
 * `id="..."`. Buscar la cadena a secas los encuentra igual; esta lista está
 * para documentar por qué se aceptan, no para saltárselos.
 */
const POR_PROPS = ['ws-icon-preview-img', 'ws-icon-preview-text'];

describe('el script no habla con marcado que no existe', () => {
  it('todo getElementById apunta a un id que se escribe en alguna parte', () => {
    const huerfanos: string[] = [];

    for (const f of ASTRO) {
      const txt = soloCodigo(fs.readFileSync(f, 'utf-8'));
      for (const m of txt.matchAll(/getElementById\(\s*['"]([a-zA-Z0-9_-]+)['"]/g)) {
        const id = m[1];
        if (POR_PROPS.includes(id)) continue;
        // Se busca en todo el proyecto: el id puede vivir en otro componente.
        const existe =
          TODO.includes(`id="${id}"`) ||
          TODO.includes(`id='${id}'`) ||
          // Pasado como prop a un componente: `imgId="ws-icon-preview-img"`.
          TODO.includes(`Id="${id}"`);
        if (!existe) {
          const linea = txt.slice(0, m.index).split('\n').length;
          huerfanos.push(`${rel(f)}:${linea} → #${id}`);
        }
      }
    }

    expect(huerfanos, `getElementById sin marcado detrás:\n  ${huerfanos.join('\n  ')}`).toEqual([]);
  });

  it('ningún data-* se lee sin que nadie lo escriba', () => {
    const huerfanos: string[] = [];

    for (const f of ASTRO) {
      const txt = soloCodigo(fs.readFileSync(f, 'utf-8'));
      // Solo lecturas: `x.dataset.foo = ...` es una escritura legítima.
      for (const m of txt.matchAll(/\.dataset\.([a-zA-Z0-9_]+)\s*(?![=\w])/g)) {
        const prop = m[1];
        const attr = 'data-' + prop.replace(/([A-Z])/g, (c) => '-' + c.toLowerCase());
        // Puede escribirse desde JavaScript en vez de en el marcado.
        if (TODO.includes(attr) || TODO.includes(`dataset.${prop} =`)) continue;
        const linea = txt.slice(0, m.index).split('\n').length;
        huerfanos.push(`${rel(f)}:${linea} → ${prop} (falta ${attr})`);
      }
    }

    expect(huerfanos, `data-* leídos y nunca escritos:\n  ${huerfanos.join('\n  ')}`).toEqual([]);
  });
});

describe('las traducciones no se quedan a medias', () => {
  /**
   * Se leen los ficheros de dominio, no `ui.ts`.
   *
   * `ui.ts` era un solo diccionario y esta prueba lo partía por la cadena
   * `  es: {`. Al repartir las claves por dominio, esa marca desapareció: la
   * expresión dejó de encontrar nada y la prueba **pasó comparando dos
   * conjuntos vacíos**. Una prueba que pasa por no encontrar nada es peor que
   * no tenerla, porque además da confianza.
   *
   * De ahí el `toBeGreaterThan` de abajo: si algún día vuelve a no encontrar
   * claves, falla en vez de aprobar en silencio.
   */
  const dominios = fs.readdirSync(path.join(RAIZ, 'i18n/en')).filter((f) => f.endsWith('.ts'));

  const claves = (idioma: 'en' | 'es') => {
    const todas = new Map<string, string>();
    for (const d of dominios) {
      const txt = fs.readFileSync(path.join(RAIZ, 'i18n', idioma, d), 'utf-8');
      for (const m of txt.matchAll(/^\s+'([a-z0-9][\w.]*)':/gm)) todas.set(m[1], d);
    }
    return todas;
  };

  it('hay ficheros de dominio y claves dentro', () => {
    expect(dominios.length).toBeGreaterThan(3);
    expect(claves('en').size).toBeGreaterThan(500);
    expect(claves('es').size).toBeGreaterThan(500);
  });

  it('los dos idiomas tienen los mismos ficheros de dominio', () => {
    const es = fs.readdirSync(path.join(RAIZ, 'i18n/es')).filter((f) => f.endsWith('.ts'));
    expect(es.sort()).toEqual(dominios.sort());
  });

  it('cada clave está en los dos idiomas', () => {
    const en = claves('en');
    const es = claves('es');
    const soloEs = [...es.keys()].filter((k) => !en.has(k));
    const soloEn = [...en.keys()].filter((k) => !es.has(k));
    expect({ soloEs, soloEn }).toEqual({ soloEs: [], soloEn: [] });
  });

  it('cada clave está en el mismo dominio en los dos idiomas', () => {
    // Si `board.sort` vive en `board.ts` en inglés y en `common.ts` en español,
    // el siguiente que la busque solo encontrará una mitad.
    const en = claves('en');
    const es = claves('es');
    const descolocadas = [...en.entries()]
      .filter(([k, d]) => es.has(k) && es.get(k) !== d)
      .map(([k, d]) => `${k}: en/${d} vs es/${es.get(k)}`);
    expect(descolocadas).toEqual([]);
  });

  it('ninguna clave está dos veces: la segunda gana en silencio', () => {
    for (const idioma of ['en', 'es'] as const) {
      const vistas = new Set<string>();
      const dup: string[] = [];
      for (const d of dominios) {
        const txt = fs.readFileSync(path.join(RAIZ, 'i18n', idioma, d), 'utf-8');
        for (const m of txt.matchAll(/^\s+'([a-z0-9][\w.]*)':/gm)) {
          if (vistas.has(m[1])) dup.push(`${m[1]} (${d})`);
          vistas.add(m[1]);
        }
      }
      expect(dup, `duplicadas en ${idioma}`).toEqual([]);
    }
  });
});

describe('Astro sustituye las traducciones, salvo dentro de una plantilla', () => {
  it('no hay {t(...)} suelto dentro de una cadena de JavaScript', () => {
    // Dentro de backticks, `{t('x')}` llega literal al navegador. `${t('x')}`
    // sí es válido, así que se exige que no haya `$` delante.
    const fallos: string[] = [];
    for (const f of ASTRO) {
      const txt = soloCodigo(fs.readFileSync(f, 'utf-8'));
      for (const plantilla of txt.matchAll(/`[^`]*`/gs)) {
        for (const m of plantilla[0].matchAll(/(?<!\$)\{t\(\s*['"]([^'"]+)/g)) {
          fallos.push(`${rel(f)} → {t('${m[1]}')}`);
        }
      }
    }
    expect(fallos).toEqual([]);
  });
});

describe('las claves que se construyen sobre la marcha también existen', () => {
  /**
   * El hueco por el que se coló `status.review`.
   *
   * La comprobación de paridad mira los dos diccionarios **entre sí**, así que
   * una clave que falta en los dos no la ve nadie. Y cuando la clave se arma
   * con una plantilla —`t(\`status.${'${'}x}\`)`— tampoco la ve el typecheck,
   * porque el argumento es `string` y no una de las 939 literales.
   *
   * Encima, `useTranslations` devuelve **la clave** cuando no la encuentra, y
   * una clave es una cadena no vacía: cualquier `|| respaldo` detrás nunca
   * entra. El resultado es el texto `status.review` pintado en pantalla, sin un
   * solo error en ninguna parte.
   *
   * Aquí los valores posibles se leen de donde viven de verdad, no de una lista
   * copiada: si mañana alguien añade una columna al tablero y se olvida de su
   * traducción, esto falla.
   */
  const dominio = (idioma: 'en' | 'es') =>
    fs.readdirSync(path.join(RAIZ, 'i18n', idioma))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => fs.readFileSync(path.join(RAIZ, 'i18n', idioma, f), 'utf-8'))
      .join('\n');

  const existe = (clave: string) =>
    dominio('en').includes(`'${clave}':`) && dominio('es').includes(`'${clave}':`);

  it('cada estado de columna del tablero tiene su `status.*`', () => {
    // Los ids salen de las columnas reales de KanbanBoard, no de una lista aquí.
    const kanban = fs.readFileSync(path.join(RAIZ, 'components/jira/KanbanBoard.astro'), 'utf-8');
    const estados = [...kanban.matchAll(/\{\s*id:\s*'([a-z_]+)'/g)].map((m) => m[1]);

    expect(estados.length, 'no se encontraron columnas: la forma del fichero cambió').toBeGreaterThan(3);
    const sinClave = estados.filter((e) => !existe(`status.${e}`));
    expect(sinClave, `estados sin 'status.<id>': ${sinClave.join(', ')}`).toEqual([]);
  });

  it('cada tipo de ticket de fábrica tiene su `type.*`', () => {
    const tipos = fs.readFileSync(path.join(RAIZ, 'lib/issueTypes.ts'), 'utf-8');
    const claves = [...tipos.matchAll(/\{\s*key:\s*'([a-z]+)'/g)].map((m) => m[1]);

    expect(claves.length, 'no se encontraron tipos de fábrica').toBeGreaterThan(3);
    const sinClave = claves.filter((k) => !existe(`type.${k}`));
    expect(sinClave, `tipos sin 'type.<key>': ${sinClave.join(', ')}`).toEqual([]);
  });

  it('cada código de error del registro tiene su `err.*`', () => {
    const ajustes = fs.readFileSync(path.join(RAIZ, 'pages/settings.astro'), 'utf-8');
    // Acotado al literal de array: sin el corte, la ventana se comía las
    // claves de las líneas siguientes y la prueba acusaba a códigos que no son.
    const desde = ajustes.indexOf('errores:');
    const bloque = ajustes.slice(desde, ajustes.indexOf('].map(', desde));
    const codigos = [...bloque.matchAll(/'([a-z]+\.[a-z_]+)'/g)].map((m) => m[1]);

    expect(codigos.length, 'no se encontró la lista de códigos de error').toBeGreaterThan(5);
    const sinClave = codigos.filter((c) => !existe(`err.${c}`));
    expect(sinClave, `códigos sin 'err.<code>': ${sinClave.join(', ')}`).toEqual([]);
  });
});
