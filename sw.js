/* 튼튼 업무수첩 폰 앱 — 서비스 워커
 *
 *  화면(껍데기)만 캐시합니다. 업무수첩 데이터는 절대 캐시하지 않습니다.
 *  구글 요청은 그냥 흘려보냅니다.
 *
 *  앱을 고칠 때는 아래 VER 숫자를 올리세요. 안 올리면 구매자 폰에
 *  옛 화면이 남습니다.
 */

const VER = 'tnwk-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './privacy.html',
  './terms.html',
  './page.css',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VER)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === VER ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 구글 · 폰트는 건드리지 않습니다
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(function (res) {
        const copy = res.clone();
        caches.open(VER).then(function (c) { c.put(req, copy); });
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
  );
});
