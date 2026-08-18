/**
 * Redimensionar y subir una imagen, desde el navegador.
 *
 * Estaba escrito **tres veces**, con tres comportamientos distintos:
 *
 *   `pages/settings.astro`        512 px de ancho, WebP 0.85, textos traducidos
 *   `pages/w/[sys_tag]/settings`  512 px de ancho **y alto**, WebP 0.80, textos en inglés
 *   `pages/u/[username].astro`    **sin redimensionar**: subía el archivo entero
 *
 * La tercera no era un descuido menor: quien cambiaba su avatar desde su propio
 * perfil —en vez de desde Ajustes— mandaba la foto de cuatro megas del móvil
 * para servirla luego a 24×24 píxeles en cada tarjeta del tablero. Con 1 GB de
 * salida de red al mes, doscientas cargas de esa página se llevan la cuota.
 *
 * El recorte tiene que pasar aquí porque el servidor acepta hasta 10 MB sin
 * procesar nada (`api/upload.ts`): guarda el búfer tal cual.
 *
 * Este módulo se importa desde `<script>` de Astro, que se empaqueta como
 * módulo. No sirve para los `<script is:inline>`, que no admiten imports.
 */

export interface OpcionesImagen {
  /** Ancho máximo en píxeles. El alto se ajusta solo, manteniendo la proporción. */
  maxAncho: number;
  /** Nombre con el que se sube. Solo se usa para el `FormData`. */
  nombre?: string;
  /** A qué entidad pertenece, para que el servidor sepa dónde ponerla. */
  entidad?: { tipo: string; id: string };
}

/** Tope de entrada. El servidor tiene el suyo; este evita el viaje. */
export const MAXIMO_BYTES = 10 * 1024 * 1024;

export type ResultadoImagen =
  | { ok: true; url: string }
  | { ok: false; motivo: 'demasiado_grande' | 'ilegible' | 'fallo_subida' };

/**
 * Reduce la imagen a `maxAncho` y la convierte a WebP.
 *
 * Solo reduce: una imagen más pequeña que el tope se deja como está en vez de
 * ampliarla, que solo añadiría peso sin añadir detalle.
 *
 * Calidad 0.85. La copia que usaba 0.80 no lo hacía por ninguna razón
 * documentada, y en avatares pequeños la diferencia de peso es de unos pocos
 * kilobytes mientras que los artefactos sí se ven.
 */
export function redimensionar(file: File, maxAncho: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxAncho) {
          height = Math.round(height * (maxAncho / width));
          width = maxAncho;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((b) => resolve(b), 'image/webp', 0.85);
      };
      img.onerror = () => resolve(null);
      img.src = String(ev.target?.result ?? '');
    };

    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Redimensiona y sube, devolviendo la URL o el motivo del fallo.
 *
 * Devuelve un motivo en vez de una cadena para que quien llama enseñe el texto
 * en el idioma que toca. Las tres copias anteriores tenían sus propias frases,
 * dos de ellas en inglés a mano.
 */
export async function subirImagen(file: File, opciones: OpcionesImagen): Promise<ResultadoImagen> {
  if (file.size > MAXIMO_BYTES) return { ok: false, motivo: 'demasiado_grande' };

  const blob = await redimensionar(file, opciones.maxAncho);
  if (!blob) return { ok: false, motivo: 'ilegible' };

  const formData = new FormData();
  formData.append('file', blob, opciones.nombre ?? 'imagen.webp');
  if (opciones.entidad) {
    formData.append('entity_type', opciones.entidad.tipo);
    formData.append('entity_id', opciones.entidad.id);
  }

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      // El cuerpo va al registro, no a la pantalla.
      console.error('subir imagen:', await res.text());
      return { ok: false, motivo: 'fallo_subida' };
    }
    const datos = await res.json();
    return { ok: true, url: datos.url };
  } catch (e) {
    console.error('subir imagen:', e);
    return { ok: false, motivo: 'fallo_subida' };
  }
}

/**
 * Anchos de referencia.
 *
 * Estaban repartidos como números sueltos en cada copia, y el del banner ni
 * existía: se subía a 512 px y se estiraba al ancho de la tarjeta, borroso.
 */
export const ANCHOS = {
  /** El avatar más grande que se pinta son 96 px; el doble cubre pantallas densas. */
  avatar: 512,
  /** El banner ocupa el ancho de la tarjeta de perfil. */
  banner: 1600,
  /** El icono de un espacio se ve a 40 px como mucho. */
  icono: 256,
} as const;
