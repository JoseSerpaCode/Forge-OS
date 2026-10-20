import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Barandillas del rediseño («Taller», docs/rediseno-diagnostico.md, 1.4).
 *
 * Cada patrón es una huella de interfaz generada o un fallo de accesibilidad
 * que ya costó una auditoría.
 *
 * Durante el rediseño la prueba exigía «no ir a peor» contra una lista de
 * excepciones por archivo, que cada fase iba bajando. En la fase 9 (2.0) la
 * lista llegó a cero y desapareció: ahora **no se admite ninguna**. Si una
 * hace falta de verdad, el sitio para justificarla es aquí, en un patrón más
 * fino, no una lista de excepciones que vuelva a crecer.
 */
const RAIZ = path.resolve(__dirname, '..');
const DIRS = ['src/components', 'src/layouts', 'src/pages'];

const PATRONES: Record<string, RegExp> = {
  // Color fuera de los tokens.
  paleta_tailwind: /\b(?:text|bg|border|ring|from|via|to|fill|stroke|outline|divide|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
  cian_viejo: /#00E5FF/gi,
  // Accesibilidad (docs/desarrollo.md): opacidad sobre texto, letra de menos de 12 px.
  texto_con_opacidad: /\btext-forge-[a-z-]+\/\d{1,3}\b/g,
  texto_minusculo: /\btext-\[(?:8|9|10|11)px\]/g,
  bg_opacity: /\bbg-opacity-\d+/g,
  texto_blanco: /\btext-white\b/g,
  // Huellas de 1.2: efectos que no codifican información.
  gradiente_radial: /radial-gradient/g,
  desenfoque: /\bbackdrop-blur(?:-[a-z0-9]+)?\b|backdrop-filter:\s*blur/g,
  halo: /shadow-\[0_0_|box-shadow:\s*0 0 \d+px/g,
  eleva_al_pasar: /hover:-translate-y-[\d.]+|hover:scale-\d+/g,
  animacion_perpetua: /\banimate-(?:ping|bounce)\b/g,
};

function archivos(dir: string): string[] {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return rel === path.join('src', 'pages', 'api') ? [] : archivos(rel);
    return /\.(astro|ts|tsx|css|mjs)$/.test(e.name) ? [rel] : [];
  });
}

function contar(): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const f of DIRS.flatMap(archivos).sort()) {
    const texto = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    for (const [nombre, re] of Object.entries(PATRONES)) {
      const n = texto.match(re)?.length ?? 0;
      if (n) (out[nombre] ??= {})[f.split(path.sep).join('/')] = n;
    }
  }
  return out;
}

describe('barandillas del rediseño', () => {
  const ahora = contar();

  for (const nombre of Object.keys(PATRONES)) {
    it(`${nombre}: no aparece`, () => {
      const hallazgos = Object.entries(ahora[nombre] ?? {}).map(([f, n]) => `${f}: ${n}`);
      expect(hallazgos, 'Huella del diseño anterior. Usa los tokens y componentes de «Taller».').toEqual([]);
    });
  }
});
