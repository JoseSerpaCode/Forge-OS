import path from 'path';

/**
 * Directorio donde viven los archivos subidos (avatares, banners, adjuntos).
 *
 * Nunca dentro de `public/`: se sirven a través de `/api/storage/[filename]`,
 * que comprueba permisos antes de entregar el archivo.
 *
 * En producción debe apuntar **fuera del directorio de despliegue**
 * (p. ej. `/var/lib/forge-os/storage`). Si vive dentro del checkout, un
 * despliegue que limpie el directorio se lleva por delante todo lo subido, que
 * a diferencia del código no se puede reconstruir.
 *
 * El valor por defecto conserva el comportamiento de desarrollo.
 */
export const STORAGE_DIR =
  process.env.STORAGE_DIR || path.join(process.cwd(), '.data', 'storage');
