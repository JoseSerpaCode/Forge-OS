import crypto from 'crypto';
import db from './db';
import { cifrar, descifrar } from './secretBox';
import { credentialsFor } from './oauth';

/**
 * Conexión de un espacio con Google Drive.
 *
 * Los archivos de un espacio no se guardan en el servidor: viven en el Drive de
 * quien conectó la cuenta. El motivo es prosaico y contundente —la máquina
 * tiene 1 GB de salida de red al mes y unos pocos PDF se lo comen—, pero
 * también cambia quién manda: los archivos son de esa persona, en su Drive, y
 * puede llevárselos cerrando el grifo.
 *
 * ## Por qué `drive.file` y no acceso completo
 *
 * `drive.file` da acceso **solo a lo que crea la propia aplicación**. El acceso
 * completo a Drive es un ámbito restringido y Google exige para ellos una
 * auditoría de seguridad anual de terceros que cuesta miles de dólares. La
 * consecuencia que hay que asumir: Forge gestiona su carpeta y lo que pase por
 * ella, y no ve el resto del Drive de nadie.
 *
 * ## Qué pasa cuando se pierde el acceso
 *
 * Puede pasar y hay que darlo por hecho: se revoca el permiso desde la cuenta
 * de Google, se borra la cuenta, esa persona se va del espacio. Entonces el
 * token deja de valer y los archivos siguen donde están, en un Drive ajeno.
 *
 * La conexión se marca como `revoked` y **los metadatos no se borran**. Una
 * lista vacía parecería que el trabajo se ha perdido; una lista con los nombres
 * y un aviso de «hay que volver a conectar» dice la verdad. Otro propietario
 * puede conectar la suya y la sección vuelve, apuntando a una carpeta nueva.
 */

const env = (key: string): string | undefined =>
  process.env[key] || (import.meta.env as Record<string, string | undefined>)[key];

/** Lo mínimo: crear y gestionar lo que la propia aplicación sube. */
export const AMBITO = 'https://www.googleapis.com/auth/drive.file';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';

/** El nombre de la carpeta raíz dentro del Drive de la persona. */
export const CARPETA_RAIZ = 'Forge OS';

export function driveDisponible(): boolean {
  return credentialsFor('google') !== null;
}

export function redirectUri(): string {
  const base = env('PUBLIC_SITE_URL') || 'http://localhost:4321';
  return new URL('/api/drive/callback', base).href;
}

// ── Estado firmado ───────────────────────────────────────────────────────────
//
// Mismo razonamiento que en el `state` del login (ver `lib/oauth`), con una
// diferencia: aquí el estado además **lleva a qué espacio conectar**. Si el
// espacio viniera por otro sitio, alguien podría hacer que el permiso que estás
// concediendo se guardara en un espacio distinto del que estás mirando.
//
// Va firmado y sin guardar nada en servidor. La persona se incluye en la firma
// para que un estado robado no sirva en otra sesión.

const SECRET = env('SESSION_SECRET') || crypto.randomBytes(32).toString('hex');
const STATE_TTL_MS = 10 * 60 * 1000;

function firmar(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function crearEstado(workspaceId: string, userId: string): string {
  const payload = `${workspaceId}.${userId}.${Date.now()}.${crypto.randomBytes(9).toString('base64url')}`;
  return `${payload}.${firmar(payload)}`;
}

export type EstadoLeido = { workspaceId: string; userId: string } | null;

/** Comprueba la firma y devuelve lo que lleva dentro, o `null`. */
export function leerEstado(estado: unknown): EstadoLeido {
  if (typeof estado !== 'string' || !estado) return null;

  const partes = estado.split('.');
  if (partes.length !== 5) return null;
  const [workspaceId, userId, emitido, nonce, mac] = partes;

  const bueno = firmar(`${workspaceId}.${userId}.${emitido}.${nonce}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(bueno);
  // En tiempo constante: un `===` sobre la firma filtra byte a byte cuánto se
  // ha acertado, y con eso se llega a forjarla.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const ts = Number(emitido);
  if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return null;

  return { workspaceId, userId };
}

/**
 * La URL a la que mandar a la persona para que dé permiso.
 *
 * `access_type=offline` es lo que hace que Google entregue un *refresh token*,
 * sin el cual no se podría subir nada cuando esa persona no está delante.
 *
 * `prompt=consent` fuerza la pantalla aunque ya hubiera dado permiso antes:
 * Google **solo entrega el refresh token la primera vez** que se acepta, así
 * que sin esto una segunda conexión llegaría sin token y fallaría de un modo
 * desconcertante —todo parece ir bien y luego nada funciona.
 */
export function urlDeConsentimiento(estado: string): string | null {
  const cred = credentialsFor('google');
  if (!cred) return null;

  const u = new URL(AUTH_URL);
  u.searchParams.set('client_id', cred.clientId);
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', AMBITO);
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('include_granted_scopes', 'true');
  u.searchParams.set('state', estado);
  return u.href;
}

type RespuestaToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

/** Cambia el código de autorización por tokens. */
export async function canjearCodigo(code: string): Promise<RespuestaToken | null> {
  const cred = credentialsFor('google');
  if (!cred) return null;

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cred.clientId,
        client_secret: cred.clientSecret,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as RespuestaToken;
  } catch {
    return null;
  }
}

/**
 * Un acceso nuevo a partir del token de refresco.
 *
 * Los accesos duran una hora; el de refresco no caduca, pero **sí se puede
 * revocar**. Cuando Google contesta que ya no vale, no se reintenta: se marca
 * la conexión y se deja que la interfaz pida volver a conectar.
 */
export async function refrescarAcceso(refreshToken: string): Promise<string | null> {
  const cred = credentialsFor('google');
  if (!cred) return null;

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: cred.clientId,
        client_secret: cred.clientSecret,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const datos = (await res.json()) as RespuestaToken;
    return datos.access_token ?? null;
  } catch {
    return null;
  }
}

/** El correo de la cuenta que ha dado el permiso, para poder enseñarlo. */
export async function correoDeLaCuenta(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/about?fields=user(emailAddress)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const datos = (await res.json()) as any;
    return datos?.user?.emailAddress ?? null;
  } catch {
    return null;
  }
}

// ── Carpetas ─────────────────────────────────────────────────────────────────

type Carpeta = { id: string; webViewLink?: string };

/**
 * Busca una carpeta por nombre dentro de otra, o la crea.
 *
 * Buscar antes de crear evita el montón de carpetas repetidas que salen cuando
 * alguien desconecta y vuelve a conectar. Con `drive.file` la búsqueda solo ve
 * lo que creó la propia aplicación, que es exactamente lo que interesa.
 *
 * El nombre se escapa antes de meterlo en la consulta: una comilla simple
 * partiría la expresión, y los nombres de espacio los escribe cualquiera.
 */
export async function carpeta(accessToken: string, nombre: string, padre?: string): Promise<Carpeta | null> {
  const escapado = nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = [
    `name = '${escapado}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
    padre ? `'${padre}' in parents` : "'root' in parents",
  ].join(' and ');

  try {
    const busca = await fetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,webViewLink)&pageSize=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (busca.ok) {
      const datos = (await busca.json()) as any;
      if (datos?.files?.length) return datos.files[0] as Carpeta;
    }

    const crea = await fetch(`${API}/files?fields=id,webViewLink`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nombre,
        mimeType: 'application/vnd.google-apps.folder',
        parents: padre ? [padre] : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!crea.ok) return null;
    return (await crea.json()) as Carpeta;
  } catch {
    return null;
  }
}

/**
 * Deja la carpeta en «cualquiera con el enlace puede ver».
 *
 * Es lo que permite que el resto del equipo abra los archivos sin tener cuenta
 * de Google ni pedir permiso uno a uno. El precio, que la interfaz tiene que
 * decir en voz alta: **el enlace es la llave**. Quien lo tenga entra, sea o no
 * del espacio.
 */
export async function compartirPorEnlace(accessToken: string, folderId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/files/${folderId}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── La conexión guardada ─────────────────────────────────────────────────────

export type Conexion = {
  workspaceId: string;
  googleEmail: string | null;
  rootFolderId: string | null;
  folderId: string | null;
  folderLink: string | null;
  status: 'ok' | 'revoked';
  connectedBy: string | null;
  connectedAt: string | null;
};

/** La conexión de un espacio, sin el token. */
export function conexionDe(workspaceId: string): Conexion | null {
  const fila = db.prepare(`
    SELECT workspace_id AS workspaceId, google_email AS googleEmail, root_folder_id AS rootFolderId,
           folder_id AS folderId, folder_link AS folderLink, status,
           connected_by AS connectedBy, connected_at AS connectedAt
    FROM workspace_drive WHERE workspace_id = ?
  `).get(workspaceId) as Conexion | undefined;
  return fila ?? null;
}

export function guardarConexion(datos: {
  workspaceId: string;
  refreshToken: string;
  googleEmail: string | null;
  rootFolderId: string | null;
  folderId: string | null;
  folderLink: string | null;
  connectedBy: string;
}): void {
  db.prepare(`
    INSERT INTO workspace_drive
      (workspace_id, google_email, root_folder_id, folder_id, folder_link, refresh_token_enc, status, connected_by, connected_at)
    VALUES (?, ?, ?, ?, ?, ?, 'ok', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(workspace_id) DO UPDATE SET
      google_email = excluded.google_email,
      root_folder_id = excluded.root_folder_id,
      folder_id = excluded.folder_id,
      folder_link = excluded.folder_link,
      refresh_token_enc = excluded.refresh_token_enc,
      status = 'ok',
      connected_by = excluded.connected_by,
      connected_at = CURRENT_TIMESTAMP,
      last_error_at = NULL
  `).run(
    datos.workspaceId,
    datos.googleEmail,
    datos.rootFolderId,
    datos.folderId,
    datos.folderLink,
    cifrar(datos.refreshToken),
    datos.connectedBy,
  );
}

/** Marca la conexión como caducada. No borra nada. */
export function marcarRevocada(workspaceId: string): void {
  db.prepare(
    "UPDATE workspace_drive SET status = 'revoked', last_error_at = CURRENT_TIMESTAMP WHERE workspace_id = ?"
  ).run(workspaceId);
}

/** Quita la conexión del espacio. Los archivos se quedan en el Drive. */
export function desconectar(workspaceId: string): boolean {
  return db.prepare('DELETE FROM workspace_drive WHERE workspace_id = ?').run(workspaceId).changes > 0;
}

/**
 * Un acceso válido para operar contra el Drive de este espacio.
 *
 * Devuelve `null` cuando no hay conexión, cuando el token guardado no se puede
 * descifrar —la clave ha cambiado— o cuando Google lo rechaza. En los dos
 * últimos casos deja la conexión marcada, porque el resultado práctico es el
 * mismo: hay que volver a conectar.
 */
export async function accesoPara(workspaceId: string): Promise<string | null> {
  const fila = db.prepare('SELECT refresh_token_enc, status FROM workspace_drive WHERE workspace_id = ?')
    .get(workspaceId) as { refresh_token_enc: string; status: string } | undefined;
  if (!fila) return null;

  const refresh = descifrar(fila.refresh_token_enc);
  if (!refresh) {
    marcarRevocada(workspaceId);
    return null;
  }

  const acceso = await refrescarAcceso(refresh);
  if (!acceso) {
    marcarRevocada(workspaceId);
    return null;
  }

  // Si venía marcada y ahora funciona, se vuelve a dar por buena: puede haber
  // sido un corte de red y no una revocación.
  if (fila.status !== 'ok') {
    db.prepare("UPDATE workspace_drive SET status = 'ok', last_error_at = NULL WHERE workspace_id = ?").run(workspaceId);
  }

  return acceso;
}
