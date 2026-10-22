import { MAXIMO_ADJUNTO, TIPOS_ADJUNTO } from '../adjuntos';
import { redimensionar } from './imagen';

/**
 * Subir un archivo como adjunto de una tarea. Lo usan el panel de la tarea y el
 * alta, que antes no podía adjuntar nada: había que crear la tarea, abrirla y
 * subir desde ahí.
 *
 * Las fotos (no los GIF, que perderían la animación, ni los SVG) se pasan a
 * WebP con 1920 px de ancho como mucho: una foto del móvil pesa diez veces más
 * de lo que hace falta para leerla en pantalla.
 */
export type ResultadoAdjunto = { ok: true } | { ok: false; motivo: 'demasiado_grande' | 'tipo' | 'fallo_subida' };

const ANCHO_FOTO = 1920;

export async function subirAdjunto(file: File, issueId: string): Promise<ResultadoAdjunto> {
  let blob: Blob = file;
  let nombre = file.name;
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
    const reducida = await redimensionar(file, ANCHO_FOTO);
    if (reducida) {
      blob = reducida;
      nombre = `${file.name.replace(/\.[^/.]+$/, '')}.webp`;
    }
  }
  if (!TIPOS_ADJUNTO.includes(blob.type)) return { ok: false, motivo: 'tipo' };
  if (blob.size > MAXIMO_ADJUNTO) return { ok: false, motivo: 'demasiado_grande' };

  const datos = new FormData();
  datos.append('entity_type', 'issue');
  datos.append('entity_id', issueId);
  datos.append('file', blob, nombre);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: datos });
    if (res.ok) return { ok: true };
    console.error('subir adjunto:', await res.text());
    return { ok: false, motivo: res.status === 413 ? 'demasiado_grande' : 'fallo_subida' };
  } catch (err) {
    console.error('subir adjunto:', err);
    return { ok: false, motivo: 'fallo_subida' };
  }
}
