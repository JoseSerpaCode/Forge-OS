/*
 * Service worker de Forge OS: solo avisos Web Push.
 *
 * No guarda nada en caché ni intercepta peticiones: una caché de páginas con
 * sesión enseñaría datos viejos o de otra cuenta. Lo único que hace es enseñar
 * el aviso que manda el servidor y, al pulsarlo, abrir la tarea.
 */
self.addEventListener('push', (evento) => {
  let datos = {};
  try { datos = evento.data ? evento.data.json() : {}; } catch { datos = {}; }
  const titulo = typeof datos.title === 'string' ? datos.title : 'Forge OS';
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: typeof datos.body === 'string' ? datos.body : '',
    icon: '/forge-icon.svg',
    badge: '/forge-icon.svg',
    data: { url: typeof datos.url === 'string' ? datos.url : '/' },
  }));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  // Solo rutas del propio sitio: el aviso no puede mandar a ninguna otra parte.
  // `//otro.com` y `/\otro.com` también empiezan por «/» y salen del dominio,
  // así que además se comprueba el origen de la URL resultante.
  const pedida = evento.notification.data && evento.notification.data.url;
  let destino = new URL('/', self.location.origin).href;
  if (typeof pedida === 'string' && pedida.startsWith('/')) {
    const url = new URL(pedida, self.location.origin);
    if (url.origin === self.location.origin) destino = url.href;
  }
  evento.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if (new URL(v.url).origin === self.location.origin && 'focus' in v) {
        await v.navigate(destino).catch(() => {});
        return v.focus();
      }
    }
    return self.clients.openWindow(destino);
  })());
});
