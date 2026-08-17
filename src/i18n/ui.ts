import { en as enAuth } from './en/auth';
import { en as enBoard } from './en/board';
import { en as enCommon } from './en/common';
import { en as enDb } from './en/db';
import { en as enFiles } from './en/files';
import { en as enKb } from './en/kb';
import { en as enLanding } from './en/landing';
import { en as enUser } from './en/user';
import { en as enWorkspace } from './en/workspace';

import { es as esAuth } from './es/auth';
import { es as esBoard } from './es/board';
import { es as esCommon } from './es/common';
import { es as esDb } from './es/db';
import { es as esFiles } from './es/files';
import { es as esKb } from './es/kb';
import { es as esLanding } from './es/landing';
import { es as esUser } from './es/user';
import { es as esWorkspace } from './es/workspace';

/**
 * Los textos de la interfaz, ensamblados por dominio.
 *
 * Esto era un solo fichero de 2.048 líneas con 939 claves por idioma, y el
 * segundo que más cambiaba del repositorio. Cualquier trabajo en paralelo
 * acababa chocando aquí: dos ramas que añaden una clave tocan la misma zona del
 * mismo fichero, y el conflicto hay que resolverlo a mano cada vez.
 *
 * Partido por dominio, cada trabajo toca el suyo. Lo que **no** cambia es nada
 * de lo que se ve desde fuera: `ui`, `useTranslations`, `languages` y el tipo de
 * las claves siguen exactamente igual, así que ningún componente se entera.
 *
 * El tipo de `t()` sigue siendo la unión literal de las 939 claves —no
 * `string`— porque cada fichero de dominio lleva su `as const`. Perder eso
 * sería perder la única red que avisa de una clave mal escrita: sin ella,
 * `t('board.sortt')` compilaría y pintaría la clave cruda en pantalla.
 *
 * Al añadir un dominio hay que tocar tres sitios: el fichero en `en/`, el de
 * `es/` y las dos listas de abajo. `tests/marcado-vivo.test.ts` comprueba que
 * los dos idiomas tengan los mismos ficheros y las mismas claves, así que
 * olvidarse de una mitad falla en vez de pasar desapercibido.
 */
export const languages = { en: 'English', es: 'Español' };
export const defaultLang = 'en';

export const ui = {
  en: {
    ...enCommon,
    ...enAuth,
    ...enLanding,
    ...enBoard,
    ...enWorkspace,
    ...enUser,
    ...enFiles,
    ...enDb,
    ...enKb,
  },
  es: {
    ...esCommon,
    ...esAuth,
    ...esLanding,
    ...esBoard,
    ...esWorkspace,
    ...esUser,
    ...esFiles,
    ...esDb,
    ...esKb,
  },
} as const;

export type Language = keyof typeof ui;

export function useTranslations(lang: Language) {
  return function t(key: keyof typeof ui[typeof defaultLang]): string {
    const langDict = ui[lang] as Record<string, string>;
    const defaultDict = ui[defaultLang] as Record<string, string>;
    return langDict[key as string] || defaultDict[key as string] || key;
  }
}
