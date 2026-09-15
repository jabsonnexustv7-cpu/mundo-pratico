const CACHE = 'mundo-pratico-preview-v9';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './mp-data.js', './manifest.webmanifest', './icon.svg',
  './assets/images/01-frango-crocante-batatas.png',
  './assets/images/02-carne-acebolada-arroz-legumes.png',
  './assets/images/03-tilapia-dourada-batatas-salada.png',
  './assets/images/04-mini-pizzas-praticas.png',
  './assets/images/05-ingredientes-em-casa.png',
  './assets/images/06-lista-compras-mercado.png',
  './assets/images/07-frango-cremoso-gratinado.png',
  './assets/images/08-batatas-recheadas.png',
  './assets/images/09-macarrao-cremoso-tomate-queijo.png',
  './assets/images/10-omelete-completa-salada.png',
  './assets/images/11-frango-barbecue-batatas-rusticas.png',
  './assets/images/12-arroz-de-forno.png'
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
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  // Never store Supabase/API responses or resources belonging to another page/system.
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const relativePath = url.pathname.slice(scope.pathname.length);
  // Auth must use current network files; callback query strings must never enter the cache.
  if (['acesso.html', 'acesso.js', 'acesso.css', 'supabase-config.js'].includes(relativePath)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => new Response(
      'O acesso requer internet. Reconecte-se e recarregue esta página.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }
    )));
    return;
  }

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
