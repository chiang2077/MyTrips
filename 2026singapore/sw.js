// 新加坡城市慢行誌：離線瀏覽（由產生器建立，內容變動時版本號會跟著換）
const PREFIX='mytrips-2026singapore-';
const CACHE=PREFIX+'f2e30fced695';
const FILES=[
  './',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'img/arts.jpg',
  'img/barrage.jpg',
  'img/boat.jpg',
  'img/botanic.jpg',
  'img/chinatown.jpg',
  'img/chinatownfood.jpg',
  'img/clarke.jpg',
  'img/cruise.jpg',
  'img/eastcoast.jpg',
  'img/flyer.jpg',
  'img/fort.jpg',
  'img/fullerton.jpg',
  'img/gallery.jpg',
  'img/gardens.jpg',
  'img/helix.jpg',
  'img/hotel.jpg',
  'img/ion.jpg',
  'img/jewel.jpg',
  'img/kampong.jpg',
  'img/lau.jpg',
  'img/littleindia.jpg',
  'img/marina.jpg',
  'img/maxwell.jpg',
  'img/merlion.jpg',
  'img/newton.jpg',
  'img/night.jpg',
  'img/oceanarium.jpg',
  'img/oldairport.jpg',
  'img/paragon.jpg',
  'img/pier.jpg',
  'img/raffles.jpg',
  'img/sands.jpg',
  'img/scotts.jpg',
  'img/sentosa.jpg',
  'img/spectra.jpg',
  'img/takashimaya.jpg',
  'img/tangs.jpg',
  'img/zoo.jpg',
  'journal.css',
  'journal.js',
  'manifest.webmanifest'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))).then(()=>self.skipWaiting()));
});

// 同一個網域底下還有其他行程頁，只清自己的舊版本
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

const scope=new URL(self.registration.scope);
const fromCache=req=>caches.open(CACHE).then(c=>c.match(req,{ignoreSearch:true}));

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;

  // 頁面本身：有網路就拿最新的；網路太慢（4 秒）或斷線就用存好的
  if(req.mode==='navigate'){
    e.respondWith(new Promise(resolve=>{
      let done=false;
      const finish=r=>{if(!done&&r){done=true;resolve(r);}};
      const saved=()=>fromCache('./');
      const timer=setTimeout(()=>saved().then(finish),4000);
      fetch(req).then(r=>{clearTimeout(timer);finish(r);})
        .catch(()=>{clearTimeout(timer);saved().then(r=>finish(r||Response.error()));});
    }));
    return;
  }

  // 照片、樣式、圖示：先用存好的，沒有才上網抓
  e.respondWith(fromCache(req).then(r=>r||fetch(req)));
});
