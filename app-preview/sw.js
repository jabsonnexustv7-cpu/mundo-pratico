const CACHE = 'mundo-pratico-preview-v6';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg',
  './acesso.html', './acesso.css', './acesso.js', './supabase-config.js',
  './assets/images/01-frango-crocante-batatas.png',
  './assets/images/02-carne-acebolada-arroz-legumes.png',
  './assets/images/03-tilapia-dourada-batatas-salada.png',
  './assets/images/04-mini-pizzas-praticas.png',
  './assets/images/05-ingredientes-em-casa.png',
  './assets/images/06-lista-compras-mercado.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('mundo-pratico-preview-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
