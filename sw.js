/* Service Worker de My Fitness Tracker.
   Para que la app funcione en el gimnasio sin cobertura.

   ── Reglas que sostienen esto ──
   1. El HTML va SIEMPRE a la red primero. La app se actualiza desde Ajustes
      comparando APP_VERSION con la publicada; si el HTML se sirviera de caché,
      esa comprobación mentiría y quedarías clavado en una versión vieja. Sin
      red, entonces sí, se sirve el del caché.
   2. Lo que NO es de esta app no se toca. Firestore y Firebase Auth tienen que
      ir a la red siempre: cachear respuestas de la base de datos es la forma
      más rápida de enseñar datos viejos como si fueran buenos.
   3. Solo GET. Un POST cacheado no tiene sentido y sí consecuencias.
   4. Todo lo que falle cae a la red sin ruido: un Service Worker roto no puede
      dejar la app inservible. */

const CACHE = 'fitness-v1';

/* Lo imprescindible para arrancar sin red. Las fotos de músculo entran porque
   son el contenido pesado que se mira en mitad de una serie; los 102 SVG de
   siluetas no, porque solo se usan de reserva y son 850 KB. Esos se guardan
   solos la primera vez que se ven. */
const ESENCIALES = [
  './',
  './index.html',
  './img/ejercicios/lista.js',
  './img/ejercicios/musculos.js',
  './manifest.json',
  /* La fuente de las cifras (2,1 KB). Entra de entrada y no bajo demanda: con
     font-display:swap, llegar tarde significa ver los números saltar de una
     fuente a otra delante de ti. */
  './fuentes/oswald-cifras.woff2',
  './icons/icono-192.png',
  './icons/icono-512.png',
  /* Las 16 fotos de músculo entran de entrada (~1,1 MB) y no bajo demanda: son
     lo que miras al abrir un ejercicio, y sin cobertura no da tiempo a que se
     guarden solas la primera vez. Los 102 SVG de siluetas NO: solo se usan de
     reserva para los músculos sin foto y son otros 850 KB. */
  './img/musculos/abdominal.webp',
  './img/musculos/abductor.webp',
  './img/musculos/antebrazo.webp',
  './img/musculos/biceps.webp',
  './img/musculos/cuadriceps.webp',
  './img/musculos/deltoides.webp',
  './img/musculos/deltoides_post.webp',
  './img/musculos/dorsal.webp',
  './img/musculos/gemelo.webp',
  './img/musculos/gluteo.webp',
  './img/musculos/isquios.webp',
  './img/musculos/lumbar.webp',
  './img/musculos/oblicuo.webp',
  './img/musculos/pectoral.webp',
  './img/musculos/romboides.webp',
  './img/musculos/triceps.webp',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Uno a uno: si falla un fichero, no se cae la instalación entera.
    await Promise.all(ESENCIALES.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Dominios que NUNCA se interceptan: son datos vivos o autenticación. */
const FUERA = ['firestore.googleapis.com', 'identitytoolkit.googleapis.com',
               'securetoken.googleapis.com', 'firebaseinstallations.googleapis.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FUERA.some(d => url.hostname.includes(d))) return;

  const esHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (esHTML) {
    // Red primero, caché como red de seguridad.
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', res.clone()).catch(() => {});
        return res;
      } catch (err) {
        const c = await caches.open(CACHE);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  /* El resto (imágenes, JS, Chart.js): se sirve del caché al instante y se
     refresca por detrás. Así una imagen que cambie se actualiza sola en la
     siguiente visita, sin tener que renombrar el caché a mano. */
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const guardada = await c.match(req);
    const enRed = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    return guardada || (await enRed) || Response.error();
  })());
});

/* La app pide vaciarlo desde Ajustes si algo va mal. Es la salida de
   emergencia: un Service Worker se queda instalado, y sin esto habría que
   explicarle a alguien cómo borrar datos del sitio desde el navegador. */
self.addEventListener('message', e => {
  if (e.data === 'limpiar') {
    e.waitUntil((async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.map(n => caches.delete(n)));
      await self.registration.unregister();
    })());
  }
});
