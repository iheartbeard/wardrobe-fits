/* Service worker капсулы: страница поездки работает без сети. Общие модули берутся из корня сайта. */
const CACHE_VERSION = 'kapsula-v1';

const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'trip.css',
  '../css/styles.css',
  '../js/trip/app.js',
  '../js/trip/capsule.js',
  '../js/trip/forecast.js',
  '../js/trip/summer.js',
  '../js/model.js',
  '../js/config.js',
  '../js/ui/templates.js',
  '../js/lib/color.js',
  '../js/lib/temperature.js',
  '../js/data/autumn.js',
  '../js/data/winter.js',
  '../js/data/looks.js',
  '../js/data/seasons.js',
  '../js/data/wada.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

const FONT_HOST = /fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith('kapsula-') && key !== CACHE_VERSION).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function remember(request, response) {
  const copy = response.clone();
  caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
}

function networkFirst(request) {
  return fetch(request, {cache: 'no-cache'})
    .then((response) => {
      if (response && response.ok) {
        remember(request, response);
      }
      return response;
    })
    .catch(() => caches.match(request, {ignoreSearch: true}).then((hit) => hit || caches.match('index.html')));
}

function cacheFirst(request) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          remember(request, response);
        }
        return response;
      }),
  );
}

/* Погода и геокодер идут мимо service worker: последняя погода хранится в localStorage. */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request));
  } else if (FONT_HOST.test(url.host)) {
    event.respondWith(cacheFirst(event.request));
  }
});
