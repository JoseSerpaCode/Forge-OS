import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Lo que el navegador manda y lo que el servidor lee.
 *
 * Es el fallo más caro de este proyecto porque no lo ve nada: el typecheck no
 * cruza los dos lados —el cuerpo va como `JSON.stringify` de un objeto suelto—,
 * el endpoint responde 200 igual, y el campo simplemente llega `undefined`.
 *
 * Ha pasado dos veces ya:
 *
 *   - `targetSprintId` desde el tablero contra `target_sprint_id` en el
 *     endpoint. Mover los tickets al cerrar un sprint no habría funcionado.
 *   - `workspaceId` contra `workspace_id` al crear un ticket, que devolvía 400
 *     con un mensaje que no decía cuál de los dos era.
 *
 * Esta comprobación es deliberadamente **heurística**: lee los `fetch` de los
 * `.astro`, saca las claves del cuerpo, resuelve la ruta al fichero del endpoint
 * y mira si ese fichero menciona cada clave. No entiende JavaScript; solo busca
 * el nombre. Eso deja pasar cosas, pero **no deja pasar un nombre que no
 * aparece en ninguna parte del destino**, que es justo el fallo que se repite.
 *
 * Prefiere callar a mentir: si no resuelve la ruta a un fichero, no acusa.
 */

const RAIZ = path.join(process.cwd(), 'src');
const API = path.join(RAIZ, 'pages/api');

function ficheros(dir: string, ext: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, ext, acc);
    else if (e.name.endsWith(ext)) acc.push(p);
  }
  return acc;
}

const ASTRO = ficheros(RAIZ, '.astro');
const ENDPOINTS = ficheros(API, '.ts');

/** `/api/w/${sysTag}/issues` → expresión que casa con `.../w/[sys_tag]/issues.ts`. */
function comoRegex(ruta: string): RegExp {
  const limpia = ruta
    .replace(/\?.*$/, '')
    .replace(/\/$/, '')
    .replace(/\$\{[^}]*\}/g, '\u0000');
  const partes = limpia.split('/').filter(Boolean).slice(1); // fuera 'api'
  const patron = partes
    .map((p) => (p === '\u0000' ? '\\[[^/]+\\]' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`/pages/api/${patron}(/index)?\\.ts$`);
}

function endpointDe(ruta: string): string | null {
  const re = comoRegex(ruta);
  return ENDPOINTS.find((f) => re.test(f)) ?? null;
}

/**
 * El texto donde buscar los nombres: el endpoint y, si delega, su servicio.
 *
 * Muchos endpoints no nombran ni un campo: hacen `await request.json()` y se lo
 * pasan entero a `IssueService.create(data, ...)`. Buscar solo en el endpoint
 * los acusaba a todos de ignorar el cuerpo. Se sigue **un** nivel de
 * delegación, que es el que usa este proyecto.
 */
function leePeticion(fichero: string): string {
  let txt = fs.readFileSync(fichero, 'utf-8');

  for (const m of txt.matchAll(/^import\s+(?:\{[^}]*\}|\w+)\s+from\s+['"](\.[^'"]+)['"]/gm)) {
    const destino = path.resolve(path.dirname(fichero), m[1]);
    for (const cand of [`${destino}.ts`, path.join(destino, 'index.ts')]) {
      if (fs.existsSync(cand)) { txt += '\n' + fs.readFileSync(cand, 'utf-8'); break; }
    }
  }
  return txt;
}

/**
 * Las claves que el endpoint saca del cuerpo, si lo desestructura.
 *
 * Devuelve `null` cuando no encuentra ese patrón, para que quien llama sepa que
 * no puede ser estricto y no acuse a un endpoint que delega en un servicio.
 */
function clavesAceptadas(codigo: string): Set<string> | null {
  const patron = /const\s*\{([^}]+)\}\s*=\s*(?:await\s+request\.json\(\)|datos|data|body|cuerpo)\b/g;
  const encontradas = new Set<string>();
  let alguna = false;

  for (const m of codigo.matchAll(patron)) {
    alguna = true;
    for (const trozo of m[1].split(',')) {
      // De `label_id: labelId` interesa `label_id`, que es lo que viaja.
      const nombre = trozo.split(':')[0].replace(/\.\.\./, '').trim();
      if (/^[a-zA-Z_$][\w$]*$/.test(nombre)) encontradas.add(nombre);
    }
  }
  return alguna ? encontradas : null;
}

interface Llamada {
  origen: string;
  ruta: string;
  claves: string[];
}

/**
 * El literal que va detrás de `body:`, con las llaves balanceadas.
 *
 * Un cuerpo puede llevar objetos dentro —`action_payload: JSON.stringify({url})`—
 * y una expresión que corta en la primera `}` se queda con el interior y lo
 * confunde con el nivel de arriba.
 */
function literalesDeCuerpo(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(/body:\s*JSON\.stringify\(\s*\{/g)) {
    let i = m.index! + m[0].length;
    let prof = 1;
    const desde = i;
    while (i < texto.length && prof > 0) {
      if (texto[i] === '{') prof++;
      else if (texto[i] === '}') prof--;
      i++;
    }
    if (prof === 0) out.push(texto.slice(desde, i - 1));
  }
  return out;
}

/** Las claves de un literal de objeto, ignorando los valores. */
function clavesDeLiteral(cuerpo: string): string[] {
  // Los objetos anidados se sustituyen por un hueco para que sus comas no
  // partan las claves del nivel de arriba.
  const plano = cuerpo.replace(/\{[^{}]*\}/g, '0');
  return [...new Set(
    plano
      .split(',')
      .map((trozo) => {
        const t = trozo.trim();
        if (!t) return '';
        // `{ entity_id: entityId }` manda `entity_id`; quedarse con `entityId`
        // —el nombre de la variable local— acusaría al endpoint de no leer algo
        // que nunca se le mandó.
        const dosPuntos = t.indexOf(':');
        const nombre = (dosPuntos === -1 ? t : t.slice(0, dosPuntos)).trim();
        return /^[a-zA-Z_$][\w$]*$/.test(nombre) ? nombre : '';
      })
      .filter(Boolean)
  )];
}

function llamadas(): Llamada[] {
  const out: Llamada[] = [];

  for (const f of ASTRO) {
    const txt = fs.readFileSync(f, 'utf-8');
    const origen = f.replace(process.cwd() + '/', '');

    // Los `fetch` de este fichero, para poder acotar cada ventana entre uno y
    // el siguiente.
    const puntos = [...txt.matchAll(/fetch\(/g)].map((x) => x.index!);

    for (const m of txt.matchAll(/fetch\(\s*[`'"](\/api[^`'"]*)[`'"]/g)) {
      const ruta = m[1];

      /**
       * La ventana se corta en la llamada de al lado.
       *
       * Con una ventana fija de 1.200 caracteres hacia atrás, el cuerpo del
       * `fetch` anterior se colaba en este: la comprobación acusaba a
       * `/api/user/notifications` de no leer `notifId`, que en realidad va al
       * `/api/user/invites` de tres líneas más arriba. Un aviso falso en una
       * prueba así es caro: enseña a ignorarla.
       */
      /**
       * Dos ventanas, y cada una mira a un lado por un motivo.
       *
       * El cuerpo en línea —`body: JSON.stringify({...})`— va **siempre después**
       * del `fetch(`, así que se busca solo hacia delante y cortando en la
       * llamada siguiente. Mirar hacia atrás traía el cuerpo del `fetch`
       * anterior: la comprobación acusaba a `/api/user/notifications` de no
       * leer `notifId`, que en realidad va al `/api/user/invites` de tres
       * líneas más arriba. Un aviso falso en una prueba así es caro, porque
       * enseña a ignorarla.
       *
       * Hacia atrás solo se mira para el otro caso: el cuerpo armado en una
       * variable, y únicamente para **esa** variable, cuyo nombre se saca
       * primero de la ventana de delante.
       */
      const siguiente = puntos.find((p) => p > m.index!) ?? txt.length;
      const delante = txt.slice(m.index!, Math.min(siguiente, m.index! + 700));
      const detras = txt.slice(Math.max(0, m.index! - 1200), m.index!);
      const claves = new Set<string>();

      // (1) Cuerpo en línea: el que va detrás de `body:`, con las llaves
      // balanceadas.
      //
      // Sin balancear, `action_payload: JSON.stringify({ url })` colaba `url`
      // como si fuera una clave de primer nivel del cuerpo, y la comprobación
      // acusaba al endpoint de no leer algo que nunca recibe suelto.
      for (const lit of literalesDeCuerpo(delante)) {
        clavesDeLiteral(lit).forEach((k) => claves.add(k));

        /**
         * `{ status, workspaceId, ...cuerpo }` — el spread hay que seguirlo.
         *
         * Al cerrar un sprint, el tablero arma el cuerpo en una función y lo
         * esparce en la llamada, y esa función está muy lejos del `fetch`.
         * Buscando solo en la ventana, el fallo original —`targetSprintId` por
         * `target_sprint_id`— pasaba en verde. Con el spread se busca en el
         * fichero entero, que para un nombre de variable concreto no genera
         * ruido.
         */
        for (const sp of lit.matchAll(/\.\.\.\s*([a-zA-Z_$][\w$]*)/g)) {
          const asigs = new RegExp(`\\b${sp[1]}\\.([a-zA-Z_$][\\w$]*)\\s*=[^=]`, 'g');
          for (const a of txt.matchAll(asigs)) claves.add(a[1]);
        }
      }

      // (2) Cuerpo armado en una variable.
      //
      // Es lo que dejaba escapar el fallo que motivó esta prueba: al cerrar un
      // sprint el tablero hace `cuerpo.target_sprint_id = ...` y luego
      // `JSON.stringify(cuerpo)`. Mirando solo literales, pasaba en verde.
      for (const ref of delante.matchAll(/JSON\.stringify\(\s*([a-zA-Z_$][\w$]*)\s*\)/g)) {
        const nombre = ref[1];
        const asignaciones = new RegExp(`\\b${nombre}\\.([a-zA-Z_$][\\w$]*)\\s*=[^=]`, 'g');
        for (const texto of [detras, delante]) {
          for (const asig of texto.matchAll(asignaciones)) claves.add(asig[1]);
        }
        const decl = detras.match(new RegExp(`${nombre}\\s*(?::[^=]*)?=\\s*\\{([^}]*)\\}`));
        if (decl) clavesDeLiteral(decl[1]).forEach((k) => claves.add(k));
      }

      if (claves.size) out.push({ origen, ruta, claves: [...claves] });
    }
  }
  return out;
}

describe('contratos entre el navegador y la API', () => {
  const todas = llamadas();

  it('se encuentran llamadas que analizar', () => {
    // Si un cambio de estilo hace que la expresión deje de casar, esta prueba
    // pasaría sin mirar nada. Que falle en vez de aprobar en vacío.
    expect(todas.length).toBeGreaterThan(20);
  });

  it('cada ruta llamada existe como endpoint', () => {
    const rotas = todas
      .filter((l) => !endpointDe(l.ruta))
      .map((l) => `${l.origen} → ${l.ruta}`);
    expect(rotas, `rutas sin endpoint:\n  ${rotas.join('\n  ')}`).toEqual([]);
  });

  it('cada clave del cuerpo aparece en el endpoint que la recibe', () => {
    const huerfanas: string[] = [];

    for (const l of todas) {
      const destino = endpointDe(l.ruta);
      if (!destino) continue; // ya lo cubre la prueba de arriba
      const codigo = leePeticion(destino);

      /**
       * Cuando el endpoint desestructura el cuerpo, esa lista es la verdad.
       *
       * Buscar el nombre suelto no vale: `assign.ts` hace
       * `const { label_id: labelId } = datos`, así que la palabra `labelId`
       * **sí** aparece en el fichero aunque la clave que acepta sea `label_id`.
       * Mandarle `labelId` pasaba la comprobación y llegaba `undefined`.
       *
       * Donde no hay desestructuración —el endpoint reenvía el cuerpo entero a
       * un servicio— se vuelve a la búsqueda por nombre, que es laxa pero no
       * inventa avisos.
       */
      const aceptadas = clavesAceptadas(codigo);

      for (const clave of l.claves) {
        const conocida = aceptadas
          ? aceptadas.has(clave)
          : new RegExp(`\\b${clave}\\b`).test(codigo);
        if (!conocida) {
          huerfanas.push(
            `${l.origen} manda '${clave}' a ${l.ruta}, pero ${destino.replace(process.cwd() + '/', '')} no lo nombra`
          );
        }
      }
    }

    expect(huerfanas, `claves que el servidor nunca lee:\n  ${huerfanas.join('\n  ')}`).toEqual([]);
  });
});
