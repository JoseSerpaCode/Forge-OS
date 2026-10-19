/**
 * Los colores de las gráficas, leídos del tema y no escritos a mano.
 *
 * Chart.js pinta en un `<canvas>`: no hereda CSS. Antes cada gráfica llevaba
 * sus hexadecimales (gris, azul y verde de Tailwind, un morado sin relación con
 * nada) y seguían iguales al cambiar a oscuro. Ahora salen de las variables
 * `--forge-*` de `themes.css`, y `alCambiarTema` avisa para repintar.
 *
 * Las series de estado usan los cuatro `--forge-st-*`, que pasan la validación
 * de paleta para daltonismo y ≥ 3:1 sobre el panel en los dos temas.
 */
const leer = (nombre: string) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

export function colores() {
  return {
    texto: leer('--forge-text'),
    tenue: leer('--forge-muted'),
    borde: leer('--forge-border'),
    panel: leer('--forge-panel'),
    acento: leer('--forge-accent-primary'),
    estado: {
      todo: leer('--forge-st-todo'),
      in_progress: leer('--forge-st-progress'),
      review: leer('--forge-st-review'),
      done: leer('--forge-st-done'),
    } as Record<string, string>,
  };
}

/** Valores por defecto de Chart.js con la letra y los colores de la interfaz. */
export function aplicarDefectos(Chart: any) {
  const c = colores();
  Chart.defaults.color = c.tenue;
  Chart.defaults.borderColor = c.borde;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 13;
  return c;
}

/** Llama a `fn` cada vez que cambia el tema de la aplicación. */
export function alCambiarTema(fn: () => void) {
  new MutationObserver((cambios) => {
    if (cambios.some((m) => m.attributeName === 'data-theme')) fn();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
