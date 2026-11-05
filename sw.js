'use strict';
/* נוצר אוטומטית על ידי tools/build.py. לא לערוך את הקובץ שב־dist. */
const CACHE = 'kore-tavim-a4d44d157f77';
const ASSETS = [
  "./",
  "css/styles.css",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "js/analysis.js",
  "js/app.js",
  "js/audio.js",
  "js/curriculum.js",
  "js/generator.js",
  "js/input.js",
  "js/levels.js",
  "js/mic.js",
  "js/modes/chords.js",
  "js/modes/path.js",
  "js/modes/profiles.js",
  "js/modes/progress.js",
  "js/modes/quiz.js",
  "js/modes/rhythm.js",
  "js/modes/sight.js",
  "js/render.js",
  "js/store.js",
  "js/theory.js",
  "js/ui.js",
  "manifest.webmanifest",
  "vendor/vexflow.js"
];

self.addEventListener('install', e => {
  // עוקפים את מטמון הדפדפן, אחרת גרסה חדשה עלולה לשמור קבצים ישנים
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('kore-tavim-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// גרסה חדשה נכנסת רק כשהאפליקציה מבקשת, כדי לא להחליף קוד באמצע אימון
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then(hit => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html', { cacheName: CACHE });
      return fetch(req);
    }),
  );
});
