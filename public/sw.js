/* Service worker do SongState: deixa o app abrir offline e instalável.
 * - Navegação: rede primeiro (sempre pega a versão nova), cache como reserva offline.
 * - /assets/ (arquivos com hash no nome): cache primeiro, são imutáveis.
 * - Demais arquivos do próprio site: devolve o cache e atualiza em segundo plano.
 * - Requisições para outros domínios (YouTube, Spotify, Google) NÃO passam por aqui.
 */
// __BUILD__ é trocado por um carimbo a cada build (vite.config.ts): cada publicação gera um service worker novo
const VERSION = '__BUILD__';
const STATIC = `songstate-static-${VERSION}`;
const RUNTIME = `songstate-runtime-${VERSION}`;
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icons/logo-96.png', './icons/favicon-32.png'];  // ícones grandes (192/512) só são baixados na instalação do app

/** Guarda o shell do app e os arquivos com hash que o index.html referencia (JS e CSS), para abrir offline. */
async function precache() {
  const cache = await caches.open(STATIC);
  await cache.addAll(PRECACHE);
  const html = await (await fetch('./index.html', { cache: 'reload' })).text();
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll(assets);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await withTimeout(fetch(request), 4000);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || (await caches.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(RUNTIME)).put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return; // áudio/vídeo em partes: deixa o navegador cuidar

  if (request.mode === 'navigate') event.respondWith(networkFirst(request));
  else if (url.pathname.includes('/assets/')) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(request));
});
