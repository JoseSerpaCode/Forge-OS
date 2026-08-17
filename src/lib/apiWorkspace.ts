import db from './db';
import { checkWorkspaceAccess, type WorkspaceRole } from './guard';

/**
 * El preámbulo de todo endpoint que cuelga de un espacio de trabajo.
 *
 * Estaba copiado a mano **nueve veces** bajo `api/w/[sys_tag]/`, con cinco
 * firmas distintas, dos `SELECT` distintos y el comentario que explica el
 * 404-frente-a-403 reescrito con otras palabras en cuatro de ellas. Y eso solo
 * contando las que llegaron a extraer una función: el patrón completo —resolver
 * el espacio, comprobar acceso, decidir qué devolver— está escrito **treinta y
 * dos veces** entre la API y las páginas.
 *
 * La prueba de que se podía extraer estaba dentro del propio código:
 * `issue-types/[id].ts` importa `abrirEspacio` de su hermano en vez de
 * copiarla. Alguien lo hizo bien una vez.
 *
 * ## Por qué esto importa más que ahorrar líneas
 *
 * `api/w/[sys_tag]/db/[id]/entries.ts` resuelve el espacio al revés —de la base
 * dinámica al espacio— y añade una comprobación que **ninguna de las otras
 * treinta y una tiene**: que el `sys_tag` de la URL coincida con el del recurso.
 * Sin ella, un id de otro espacio en la ruta pasa la comprobación de acceso
 * —eres miembro del espacio de la URL— y opera sobre datos ajenos.
 *
 * Esa corrección se escribió una vez y se quedó en su copia. Con una sola
 * función, la siguiente llega a todas.
 */

export interface EspacioAbierto {
  id: string;
  name: string;
  sys_tag: string;
}

type Resultado =
  | { ws: EspacioAbierto; error?: undefined }
  | { ws?: undefined; error: Response };

/**
 * Resuelve el espacio por su `sys_tag` y comprueba el acceso.
 *
 * **404 y no 403 a quien no es miembro.** Un 403 confirma que el espacio
 * existe, y eso ya es información sobre un sitio donde no se pinta nada: con
 * un puñado de peticiones se puede enumerar qué equipos hay en la instancia.
 * A quien sí es miembro pero le falta rango se le devuelve 403, porque ahí no
 * se filtra nada que no supiera.
 *
 * Devuelve siempre `id`, `name` y `sys_tag`: pedir solo el `id` obligaba a una
 * segunda consulta en cuanto alguien quería enseñar el nombre, y traer tres
 * columnas de una fila cuesta lo mismo que traer una.
 *
 * **El rol es obligatorio, sin valor por defecto.** Al unificar las nueve
 * copias, tres de ellas llevaban el rol escrito dentro y la llamada se quedó
 * sin argumento: `files/upload.ts` pasó de exigir `editor` a aceptar `viewer`,
 * o sea que quien solo mira podía subir archivos. Lo cazó una prueba de
 * navegador, no el typecheck. Con el parámetro obligatorio ese despiste ya no
 * compila, que es mejor que confiar en que alguien se acuerde.
 */
export function abrirEspacio(
  sysTag: string | undefined,
  user: { id: string; is_sysadmin: number },
  rol: WorkspaceRole
): Resultado {
  const ws = db
    .prepare('SELECT id, name, sys_tag FROM workspaces WHERE sys_tag = ?')
    .get(sysTag) as EspacioAbierto | undefined;

  if (!ws) return { error: new Response('Not Found', { status: 404 }) };

  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, ws.id, rol);
  if (!acceso.granted) {
    if (acceso.reason === 'not_member') return { error: new Response('Not Found', { status: 404 }) };
    return { error: new Response(acceso.error, { status: 403 }) };
  }

  return { ws };
}

/**
 * Lo mismo, pero cuando el recurso ya se ha resuelto por su id.
 *
 * Comprueba que el recurso **pertenece al espacio de la URL**. Es la
 * comprobación que solo tenía una de las treinta y dos copias, y sin ella un id
 * de otro espacio pasa: eres miembro del espacio que dice la ruta, así que el
 * control de acceso da luz verde, y a continuación se opera sobre un recurso
 * que no es de ahí.
 *
 * Devuelve 404 y no 400: que el recurso exista en otro sitio no es asunto de
 * quien pregunta.
 */
export function abrirEspacioDeRecurso(
  sysTag: string | undefined,
  workspaceIdDelRecurso: string | null | undefined,
  user: { id: string; is_sysadmin: number },
  rol: WorkspaceRole
): Resultado {
  const abierto = abrirEspacio(sysTag, user, rol);
  if (abierto.error) return abierto;

  if (!workspaceIdDelRecurso || workspaceIdDelRecurso !== abierto.ws.id) {
    return { error: new Response('Not Found', { status: 404 }) };
  }
  return abierto;
}

/**
 * Una respuesta JSON.
 *
 * Estaba copiada **catorce veces byte a byte**, y los otros sesenta y dos
 * endpoints ni siquiera usaban esa copia: escribían el `new Response(...)`
 * entero a mano, ciento veintitrés veces.
 */
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * El cuerpo de la petición, o `null` si no es JSON válido.
 *
 * Estaba copiada tres veces, y otras cuarenta y tres hacían el `try/catch` en
 * línea. Peor: dos de esas copias devolvían **códigos de error distintos para
 * lo mismo** —`bad_request` en una, `bad_json` en la otra— así que el cliente
 * no podía tratar el caso de una sola forma.
 */
export async function cuerpo<T = any>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** El error de un cuerpo ilegible, con un solo código para toda la API. */
export const cuerpoInvalido = () => json({ error_code: 'bad_json' }, 400);
