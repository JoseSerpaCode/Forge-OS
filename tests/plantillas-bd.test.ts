import { describe, it, expect } from 'vitest';
import { PLANTILLAS, plantillasTraducidas } from '../src/lib/dbTemplates';
import { ICONOS, ICONOS_ELEGIBLES, ICONO_POR_DEFECTO, esIcono } from '../src/lib/icons';
import { ui, useTranslations } from '../src/i18n/ui';

/**
 * Plantillas de bases de datos.
 *
 * Una plantilla se escribe con claves de traducción, y una clave que no existe
 * no falla: `t()` devuelve la propia clave. Sin estas comprobaciones, una
 * plantilla mal escrita crearía una tabla con una columna llamada literalmente
 * `dbt.col.status` y nadie se enteraría hasta verla en pantalla.
 *
 * Lo mismo con las listas de opciones: van en una sola cadena separada por
 * comas, así que una coma dentro de una opción la partiría en dos en silencio.
 */

const en = ui.en as Record<string, string>;
const es = ui.es as Record<string, string>;

describe('catálogo de plantillas', () => {
  it('no repite identificadores', () => {
    const ids = PLANTILLAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('trae plantillas y ninguna vacía', () => {
    expect(PLANTILLAS.length).toBeGreaterThan(0);
    for (const p of PLANTILLAS) {
      expect(p.columnas.length, `${p.id} no tiene columnas`).toBeGreaterThan(0);
      expect(p.icono, `${p.id} no tiene icono`).toBeTruthy();
    }
  });

  it('todas sus claves existen en los dos idiomas', () => {
    const claves: string[] = [];
    for (const p of PLANTILLAS) {
      claves.push(p.nombre, p.descripcion);
      for (const c of p.columnas) {
        claves.push(c.nombre);
        if (c.opciones) claves.push(c.opciones);
      }
    }

    for (const clave of claves) {
      expect(en[clave], `falta en inglés: ${clave}`).toBeTruthy();
      expect(es[clave], `falta en español: ${clave}`).toBeTruthy();
    }
  });

  it('solo usa tipos que el esquema acepta', () => {
    for (const p of PLANTILLAS) {
      for (const c of p.columnas) {
        expect(['text', 'number', 'select']).toContain(c.tipo);
        // Un `select` sin opciones deja un desplegable vacío que no se puede
        // rellenar; y opciones en una columna que no es `select` se pierden.
        expect(c.tipo === 'select', `${p.id}/${c.nombre}`).toBe(Boolean(c.opciones));
      }
    }
  });

  it('ninguna opción lleva una coma dentro', () => {
    for (const idioma of [en, es]) {
      for (const p of PLANTILLAS) {
        for (const c of p.columnas) {
          if (!c.opciones) continue;
          const opciones = idioma[c.opciones].split(',').map((o) => o.trim());
          expect(opciones.length, `${c.opciones} necesita al menos dos opciones`).toBeGreaterThan(1);
          for (const o of opciones) expect(o, `opción vacía en ${c.opciones}`).toBeTruthy();
        }
      }
    }
  });
});

describe('iconos', () => {
  it('cada plantilla usa un icono que existe', () => {
    for (const p of PLANTILLAS) {
      expect(esIcono(p.icono), `icono desconocido en ${p.id}: ${p.icono}`).toBe(true);
    }
  });

  it('el selector ofrece todos los iconos y el de por defecto está entre ellos', () => {
    expect(ICONOS_ELEGIBLES).toEqual(Object.keys(ICONOS));
    expect(ICONOS_ELEGIBLES).toContain(ICONO_POR_DEFECTO);
  });

  it('los trazos son solo dibujo, sin nada ejecutable', () => {
    // Estos trazos se inyectan como marcado dentro del `<svg>`. Salen de esta
    // tabla y no de nadie de fuera, pero si algún día alguien pega aquí un
    // fragmento copiado de internet, esto lo para.
    for (const [nombre, trazos] of Object.entries(ICONOS)) {
      expect(trazos, `${nombre} lleva algo que no es un trazo`).toMatch(/^(<(path|circle|rect|ellipse|line|polyline|polygon)\b[^<>]*\/>)+$/);
      expect(trazos.toLowerCase()).not.toContain('script');
      expect(trazos.toLowerCase()).not.toContain('on');
    }
  });

  it('esIcono rechaza lo que no está en la tabla', () => {
    expect(esIcono('database')).toBe(true);
    expect(esIcono('🗄️')).toBe(false);
    expect(esIcono('<script>')).toBe(false);
    expect(esIcono('')).toBe(false);
    expect(esIcono(null)).toBe(false);
    expect(esIcono('toString')).toBe(false);
  });
});

describe('plantillasTraducidas', () => {
  it('devuelve el catálogo en el idioma pedido', () => {
    const espanol = plantillasTraducidas(useTranslations('es'));
    const ingles = plantillasTraducidas(useTranslations('en'));

    const cursosEs = espanol.find((p) => p.id === 'courses')!;
    const cursosEn = ingles.find((p) => p.id === 'courses')!;

    expect(cursosEs.nombre).toBe('Asignaturas');
    expect(cursosEn.nombre).toBe('Courses');
    expect(cursosEs.columnas.map((c) => c.name)).toContain('Profesor');
    expect(cursosEn.columnas.map((c) => c.name)).toContain('Teacher');
  });

  it('parte las opciones y las deja limpias', () => {
    const espanol = plantillasTraducidas(useTranslations('es'));
    const estado = espanol
      .find((p) => p.id === 'courses')!
      .columnas.find((c) => c.type === 'select')!;

    expect(estado.options).toEqual(['Cursando', 'Aprobada', 'Pendiente', 'Retirada']);
  });

  it('no deja ninguna clave sin traducir', () => {
    // `t()` devuelve la clave cuando no la encuentra, así que un nombre con un
    // punto y un prefijo `dbt.` es una plantilla rota, no una traducción.
    for (const idioma of ['en', 'es'] as const) {
      for (const p of plantillasTraducidas(useTranslations(idioma))) {
        expect(p.nombre.startsWith('dbt.')).toBe(false);
        expect(p.descripcion.startsWith('dbt.')).toBe(false);
        for (const c of p.columnas) expect(c.name.startsWith('dbt.')).toBe(false);
      }
    }
  });
});

describe('traducciones', () => {
  it('inglés y español tienen exactamente las mismas claves', () => {
    // Cuando falta una clave en español, `t()` cae al inglés sin avisar: la
    // pantalla se queda a medias en dos idiomas, que es justo lo que se quiere
    // evitar. Vale también para lo contrario: una clave solo en español es
    // código muerto o un olvido en el otro lado.
    const soloEn = Object.keys(en).filter((k) => !(k in es));
    const soloEs = Object.keys(es).filter((k) => !(k in en));

    expect(soloEn, 'claves sin traducir al español').toEqual([]);
    expect(soloEs, 'claves que no existen en inglés').toEqual([]);
  });
});
