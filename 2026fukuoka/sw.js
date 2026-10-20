// 九州慢行誌：離線瀏覽（由產生器建立，內容變動時版本號會跟著換）
// 改版後要做什麼：改完跑一次 py -3 tools/build_sw.py 2026fukuoka；忘了跑，連網的手機仍會更新文字內容，只有換掉同檔名的圖片才一定要跑。
const PREFIX = 'mytrips-2026fukuoka-';
const CACHE = PREFIX + '79f10074a0fd';
const FILES = [
  './',
  'film.html',
  'film/poster-wide.jpg',
  'htb.js',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'img/aerial-kyushu.jpg',
  'img/amsterdamhotel.jpg',
  'img/depachika.jpg',
  'img/forestvilla.jpg',
  'img/fvgarden.jpg',
  'img/gunkanjima.jpg',
  'img/htbillum.jpg',
  'img/htbnight.jpg',
  'img/huistenbosch.jpg',
  'img/miffyroom.jpg',
  'img/nagasaki.jpg',
  'img/nakasu-matsuri.jpg',
  'img/newotani.jpg',
  'img/porcelain.jpg',
  'img/takeoff.jpg',
  'img/tenjin.jpg',
  'img/toyokan-bath.jpg',
  'img/toyokan.jpg',
  'img/yanagibashi.jpg',
  'journal.css',
  'journey.js',
  'manifest.webmanifest',
  'typhoon.js',
  'weather.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// 同一個網域底下還有其他行程頁，只清自己的舊版本
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

const scope = new URL(self.registration.scope);
const fromCache = req => caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  // 影片與 AI 短片素材太大，不存、也不攔（交給瀏覽器自己處理分段下載）
  const rel = url.pathname.slice(scope.pathname.length);
  if (rel.endsWith('.mp4') || rel.startsWith('film2-ai/') || req.headers.has('range')) return;

  // 換頁：只接手首頁與封面影片頁，其他頁（例如 onetake.html）照一般方式上網抓
  let pageKey = null;
  if (req.mode === 'navigate') {
    if (rel === '' || rel === 'index.html') pageKey = './';
    else if (rel === 'film.html') pageKey = 'film.html';
    else return;
  }

  const isText = pageKey !== null ||
    rel.endsWith('.html') ||
    rel.endsWith('.css') ||
    rel.endsWith('.js') ||
    rel.endsWith('.webmanifest');

  // 文字類檔案（頁面、.css、.js、manifest）：網路優先，逾時 4 秒或斷線退回快取，成功抓到後寫回快取
  if (isText) {
    e.respondWith(new Promise(resolve => {
      let done = false;
      const finish = r => { if (!done && r) { done = true; resolve(r); } };
      const getFallback = () => fromCache(pageKey || req);

      const timer = setTimeout(() => {
        getFallback().then(r => finish(r));
      }, 4000);

      fetch(req.url, { cache: 'no-cache' })
        .then(res => {
          clearTimeout(timer);
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(pageKey || url.pathname, copy));
          }
          finish(res);
        })
        .catch(() => {
          clearTimeout(timer);
          getFallback().then(r => finish(r || Response.error()));
        });
    }));
    return;
  }

  // 圖片、圖示快取優先；快取沒有的抓到後寫回快取
  e.respondWith(
    fromCache(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(url.pathname, copy));
        }
        return res;
      });
    })
  );
});
