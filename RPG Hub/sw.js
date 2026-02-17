// RPG Hub — Service Worker minimalista
// Necessário apenas para o PWA ser instalável.
// Não faz cache — o app sempre busca dados frescos do Supabase.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
// Sem handler de fetch: todas as requisições vão direto à rede normalmente.