import db from './db';
import { checkWorkspaceAccess, type WorkspaceRole } from './guard';

/**
 * El preámbulo de toda página que cuelga de un espacio de trabajo.
 *
 * Las nueve páginas bajo `w/[sys_tag]/` repetían el mismo bloque —resolver el
 * espacio, comprobar el acceso, decidir qué hacer si no— con **cuatro
 * respuestas distintas** para la misma situación:
 *
 *   new Response('Access Denied', { status: 403 })   ← seis páginas
 *   Astro.redirect(`/w/${sys_tag}`)                  ← ajustes
 *   Astro.redirect('/404')                           ← índice de la base de conocimiento
 *   new Response(access.error, { status: 403 })      ← una página concreta
 *
 * Las dos primeras formas son peores de lo que parecen. Un `new Response` con
 * texto plano deja al navegador una pantalla en blanco con las palabras «Access
 * Denied» y nada más: ni cabecera, ni forma de volver, ni idioma. Y filtra
 * información, porque distingue «no existe» de «existe pero no eres miembro».
 *
 * La comprobación de invitado también divergía en el mismo bloque: `user.is_guest`
 * en unas páginas, `user.is_guest === 1` en otras, y **ausente** en el tablero,
 * el panel y la base de conocimiento.
 */

/**
 * La fila entera, no un subconjunto.
 *
 * Cada página pedía las columnas que necesitaba: unas `id, name`, otras
 * `id, name, icon, description`. Con un subconjunto fijo aquí, la primera
 * página que quisiera `join_policy` tendría que hacer una segunda consulta a la
 * misma fila. Son nueve columnas cortas de una tabla que se lee una vez por
 * carga: traerlas todas cuesta lo mismo.
 */
export interface EspacioDePagina {
  id: string;
  name: string;
  sys_tag: string;
  icon: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  is_public: number;
  join_policy: string;
}

/**
 * Discriminante explícito (`ok`), no una propiedad opcional.
 *
 * Con `{ ws; redirigir?: undefined } | { redirigir: string }`, TypeScript no
 * estrecha la unión al comprobar `if (acceso.redirigir)`: una propiedad
 * opcional no vale como discriminante. El resultado eran veinte errores de
 * «'workspace' is possibly 'undefined'» que solo se podían callar con `!`, que
 * es justamente apagar la comprobación que interesa.
 */
type Resultado =
  | { ok: true; ws: EspacioDePagina; rol: string }
  | { ok: false; redirigir: string };

/**
 * Resuelve el espacio de una página y decide a dónde mandar a quien no pasa.
 *
 * Devuelve una **ruta a la que redirigir** en vez de una `Response`, porque
 * quien llama está en el frontmatter de un `.astro` y ahí `Astro.redirect()` es
 * lo que corresponde. Devolver una `Response` desde aquí obligaría a importar el
 * contexto de Astro en un módulo de datos.
 *
 * Dos destinos, y la diferencia importa:
 *
 *  - **No existe, o no eres miembro → `/404`.** Igual que en la API: un 403
 *    confirma que el espacio existe, y con eso se puede enumerar qué equipos hay
 *    en la instancia. Que las dos situaciones sean indistinguibles es el punto.
 *  - **Eres miembro pero te falta rango → el panel del espacio.** Ahí no se
 *    filtra nada que no supieras ya, y se aterriza en un sitio útil en vez de en
 *    una pantalla en blanco. Si la página que se denegaba **era** el panel, se
 *    va al hub, porque si no el redirect se muerde la cola.
 */
export function abrirEspacioDePagina(
  sysTag: string | undefined,
  user: { id: string; is_sysadmin: number } | null | undefined,
  rol: WorkspaceRole
): Resultado {
  if (!user) return { ok: false, redirigir: '/login' };

  const ws = db
    .prepare('SELECT * FROM workspaces WHERE sys_tag = ?')
    .get(sysTag) as EspacioDePagina | undefined;

  if (!ws) return { ok: false, redirigir: '/404' };

  const acceso = checkWorkspaceAccess(user.id, user.is_sysadmin, ws.id, rol);
  if (!acceso.granted) {
    if (acceso.reason === 'not_member') return { ok: false, redirigir: '/404' };
    return { ok: false, redirigir: `/w/${ws.sys_tag}` };
  }

  return { ok: true, ws, rol: (acceso as { role: string }).role };
}
