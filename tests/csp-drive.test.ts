import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

/**
 * La CSP tiene que permitir los hosts a los que el código llama de verdad.
 *
 * La subida a Drive estuvo rota con un arreglo puesto: se añadió
 * `storage.googleapis.com` a `connect-src` creyendo que era ahí donde iba el
 * archivo. La sesión reanudable la abre `lib/drive.ts` contra
 * **`www.googleapis.com`**, y Google devuelve una URL de ese mismo host. La CSP
 * cortaba el `PUT` y el usuario veía «No se ha podido subir el archivo», sin
 * más.
 *
 * Por eso los hosts se **leen del código**, no se escriben aquí a mano: una
 * lista copiada se equivoca igual que se equivocó la CSP.
 */
const MIDDLEWARE = fs.readFileSync('src/middleware.ts', 'utf-8');
const DRIVE = fs.readFileSync('src/lib/drive.ts', 'utf-8');

const connectSrc = () => {
  const m = MIDDLEWARE.match(/"connect-src ([^"]+)"/);
  expect(m, 'no se encontró la directiva connect-src').toBeTruthy();
  return m![1];
};

describe('CSP y los hosts que usa Drive', () => {
  it('se encuentran hosts que comprobar', () => {
    const hosts = [...DRIVE.matchAll(/https:\/\/([\w.-]*googleapis\.com)/g)].map((m) => m[1]);
    expect(hosts.length, 'lib/drive.ts ya no llama a googleapis: revisa esta prueba').toBeGreaterThan(0);
  });

  it('el host de la sesión de subida está en connect-src', () => {
    /**
     * Solo el host de **la subida**, no todos los de googleapis.
     *
     * La primera versión acusaba a `oauth2.googleapis.com`, que es donde el
     * servidor refresca el token: esa llamada no pasa por la CSP del navegador.
     * La que sí es el `PUT` del archivo a la URL de sesión, que Google devuelve
     * sobre el mismo host donde se abrió.
     */
    const sesion = DRIVE.match(/fetch\('https:\/\/([\w.-]+)\/upload\//);
    expect(sesion, 'no se encontró la apertura de sesión reanudable en lib/drive.ts').toBeTruthy();

    const host = sesion![1];
    const csp = connectSrc();
    expect(
      csp.includes(host),
      `el navegador sube a ${host} y la CSP no lo permite.\nconnect-src: ${csp}`
    ).toBe(true);
  });

  it('la subida no depende de un host que nadie usa', () => {
    // `storage.googleapis.com` se conserva a propósito —una sesión reanudable
    // puede redirigir ahí— y eso está explicado en el middleware. Que la
    // explicación siga ahí es parte del contrato.
    expect(MIDDLEWARE).toMatch(/storage\.googleapis\.com/);
    expect(MIDDLEWARE).toMatch(/redirigir/i);
  });
});
