// RPG Hub — Service Worker
// Estratégia de cache:
//   • /assets/* (bundles hasheados do Vite) → cache-first: o hash no nome garante
//     imutabilidade, então um deploy novo referencia arquivos novos e os antigos
//     simplesmente deixam de ser pedidos.
//   • index.html / navegação → network-first com fallback ao cache: o usuário
//     sempre recebe o deploy mais novo quando online, e o app abre offline.
//   • Qualquer requisição cross-origin (Supabase, CDNs de áudio) → passa direto.

// O token __BUILD_ID__ é substituído no build pelo plugin sw-build-id
// (vite.config.ts) por um id único por deploy (SHA curto do git). Em dev o
// public/ é servido sem build, então o token sobrevive e cai no 'dev'.
const BUILD_ID = '__BUILD_ID__';
const CACHE = 'rpghub-' + (BUILD_ID.indexOf('__') === 0 ? 'dev' : BUILD_ID);

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/CDNs: rede direta

  // Bundles hasheados + estáticos imutáveis → cache-first
  const isHashedAsset = url.pathname.includes('/assets/') ||
    /\.(?:woff2?|ttf|png|jpg|jpeg|webp|svg|ico|wav|ogg|mp3)$/.test(url.pathname);
  if (isHashedAsset) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const resp = await fetch(req);
      if (resp && resp.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, resp.clone());
      }
      return resp;
    })());
    return;
  }

  // Navegação / index.html → network-first (deploy novo vence), fallback cache (offline)
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req);
        if (resp && resp.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, resp.clone());
        }
        return resp;
      } catch (_) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw _;
      }
    })());
  }
  // Demais GETs same-origin: rede normal (sem cache)
});
