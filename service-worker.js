/*
  Service worker de FitTrack.
  Utilise uniquement des chemins RELATIFS (jamais commençant par "/")
  pour fonctionner aussi bien à la racine d'un domaine que dans un
  sous-dossier de type GitHub Pages (https://user.github.io/repo/).
*/

const CACHE_VERSION = 'fittrack-v1';

// Chemins relatifs au service worker lui-même (résolus via `new URL(..., self.location)`
// plus bas), donc valables quel que soit le dossier d'hébergement.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // On resout chaque chemin par rapport à l'emplacement du service worker
      const urls = CORE_ASSETS.map((p) => new URL(p, self.location).toString());
      return cache.addAll(urls).catch(() => {
        // Si un asset manque (ex: icônes pas encore déployées), on ne bloque pas
        // l'installation du service worker pour autant.
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Stratégie "stale-while-revalidate" : on sert immédiatement depuis le cache
// si possible (rapide, fonctionne hors-ligne), puis on met le cache à jour en
// arrière-plan avec la version réseau. On ne touche qu'aux requêtes GET du
// même site : les CDN externes (polices, icônes Lucide, Chart.js) passent
// directement au réseau sans interférence, pour ne rien casser.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
