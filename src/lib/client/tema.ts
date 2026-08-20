/**
 * Cambiar de tema, desde el navegador.
 *
 * Estaba escrito dentro del `click` de un botón concreto de la barra superior
 * —`#btn-toggle-theme`, `hidden sm:block`—, así que la única forma de que otro
 * sitio cambiara el tema era buscar ese botón y hacerle `click()`. Es decir:
 * llamar a una función a través de un elemento del DOM que además está
 * escondido en la mitad de los tamaños de pantalla.
 *
 * Aquí las tres cosas que hay que hacer —pintar, recordar y guardar— van
 * juntas, que es lo que evita la versión a medias: cambiar el atributo sin
 * tocar `localStorage` deja el tema puesto hasta la siguiente carga y ni una
 * más, y es exactamente el fallo que se cuela al copiar el bloque a otro sitio.
 */
export type Tema = 'light' | 'dark';

/** El tema puesto ahora mismo. `dark` si no hay nada, como en el arranque. */
export function temaActual(): Tema {
  return (document.documentElement.getAttribute('data-theme') as Tema) || 'dark';
}

/**
 * Cambia al otro tema y devuelve el que queda.
 *
 * El guardado en el servidor va sin esperar a propósito: el tema ya se ve
 * cambiado, y bloquear la interfaz por una petición que solo sirve para la
 * próxima sesión sería pagar la latencia dos veces.
 */
export function alternarTema(): Tema {
  const nuevo: Tema = temaActual() === 'light' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', nuevo);
  localStorage.setItem('forge_theme', nuevo);

  fetch('/api/user/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme_preference: nuevo }),
  }).catch((err) => console.error('No se ha podido guardar la preferencia de tema', err));

  return nuevo;
}
