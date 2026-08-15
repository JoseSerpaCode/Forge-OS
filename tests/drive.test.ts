import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';

/**
 * Conexión con Drive: cifrado del token y estado firmado.
 *
 * Son las dos piezas donde un fallo no se ve. Un token mal cifrado no rompe
 * nada visible —la aplicación sigue funcionando— pero deja una llave permanente
 * al Drive de alguien en un fichero que se copia entero a un bucket cada noche.
 * Y un estado que se pueda falsificar permitiría atar el permiso que estás
 * concediendo a un espacio que no es el que estás mirando.
 */

let caja: typeof import('../src/lib/secretBox');
let drive: typeof import('../src/lib/drive');

beforeAll(async () => {
  // `drive.ts` importa `db.ts`, que abre una base nada más cargarse. Sin esto
  // abriría la del resto de pruebas de punta a punta y le aplicaría las
  // migraciones de paso.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-drive-'));
  process.env.DATABASE_URL = path.join(tmp, 'drive.db');
  process.env.SESSION_SECRET = 'secreto-de-pruebas-largo-y-aburrido';
  process.env.DRIVE_TOKEN_KEY = 'a'.repeat(64);
  caja = await import('../src/lib/secretBox');
  drive = await import('../src/lib/drive');
});

describe('cifrado de secretos', () => {
  it('lo cifrado se vuelve a leer igual', () => {
    const token = '1//0abcdefghijklmnop_token-de-refresco';
    expect(caja.descifrar(caja.cifrar(token))).toBe(token);
  });

  it('el texto original no aparece en lo cifrado', () => {
    const token = 'token-secretisimo';
    expect(caja.cifrar(token)).not.toContain(token);
  });

  it('dos cifrados del mismo texto salen distintos', () => {
    // Cada uno con su IV. Repetir IV con la misma clave en GCM no rompe solo el
    // mensaje repetido: compromete el cifrado entero.
    expect(caja.cifrar('igual')).not.toBe(caja.cifrar('igual'));
  });

  it('un byte cambiado se detecta y no devuelve basura', () => {
    const partes = caja.cifrar('token-de-refresco').split('.');

    // Se decodifica, se le da la vuelta a un bit **de un byte real** y se
    // vuelve a codificar. Cambiar el último carácter del base64 no vale: los
    // bits sobrantes del final se descartan al decodificar, así que la mitad
    // de las veces el texto cifrado sale idéntico y el cambio no se nota.
    const bytes = Buffer.from(partes[3], 'base64url');
    bytes[0] ^= 0x01;
    partes[3] = bytes.toString('base64url');

    expect(caja.descifrar(partes.join('.'))).toBeNull();
  });

  it('una etiqueta de autenticación cambiada tampoco pasa', () => {
    const partes = caja.cifrar('token').split('.');
    partes[2] = Buffer.alloc(16, 7).toString('base64url');
    expect(caja.descifrar(partes.join('.'))).toBeNull();
  });

  it('lo que no tiene forma de secreto devuelve nulo, no lanza', () => {
    for (const malo of ['', 'cualquier-cosa', 'v1.a.b', 'v2.a.b.c', null, 42, undefined, {}]) {
      expect(caja.descifrar(malo as any)).toBeNull();
    }
  });
});

describe('estado firmado de la conexión', () => {
  it('lo que se firma se lee', () => {
    const estado = drive.crearEstado('ws-1', 'user-1');
    expect(drive.leerEstado(estado)).toEqual({ workspaceId: 'ws-1', userId: 'user-1' });
  });

  it('cambiar el espacio invalida la firma', () => {
    // El ataque concreto: que el permiso que estás concediendo acabe atado a un
    // espacio distinto del que estás mirando.
    const partes = drive.crearEstado('ws-1', 'user-1').split('.');
    partes[0] = 'ws-de-otro';
    expect(drive.leerEstado(partes.join('.'))).toBeNull();
  });

  it('cambiar la persona invalida la firma', () => {
    const partes = drive.crearEstado('ws-1', 'user-1').split('.');
    partes[1] = 'user-2';
    expect(drive.leerEstado(partes.join('.'))).toBeNull();
  });

  it('un estado viejo no vale', () => {
    const hace20min = Date.now() - 20 * 60 * 1000;
    const estado = drive.crearEstado('ws-1', 'user-1');
    const partes = estado.split('.');
    partes[2] = String(hace20min);
    // Aunque se refirmara con la marca vieja, caducaría igual; sin refirmar
    // falla antes, en la firma. Las dos salidas son `null`, que es lo que se
    // quiere: por fuera no se distingue qué parte falló.
    expect(drive.leerEstado(partes.join('.'))).toBeNull();
  });

  it('lo que no tiene forma de estado devuelve nulo', () => {
    for (const malo of ['', 'a.b.c', 'a.b.c.d.e', null, 7, undefined]) {
      expect(drive.leerEstado(malo as any)).toBeNull();
    }
  });
});

describe('url de consentimiento', () => {
  it('pide acceso sin la persona delante y solo sobre sus propios archivos', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id-de-pruebas';
    process.env.GOOGLE_CLIENT_SECRET = 'secreto-de-pruebas';
    // El módulo lee las credenciales en cada llamada, así que basta con
    // ponerlas antes de pedir la URL.
    const url = drive.urlDeConsentimiento(drive.crearEstado('ws-1', 'user-1'));
    expect(url).toBeTruthy();

    const u = new URL(url!);
    expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
    // Sin `offline` no llega token de refresco y no se podría subir nada
    // cuando esa persona no está delante.
    expect(u.searchParams.get('access_type')).toBe('offline');
    // Google entrega el token de refresco solo la primera vez que se acepta;
    // sin forzar la pantalla, una segunda conexión llegaría sin él.
    expect(u.searchParams.get('prompt')).toBe('consent');
    expect(u.searchParams.get('redirect_uri')).toContain('/api/drive/callback');
  });
});
