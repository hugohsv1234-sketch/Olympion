/* Public application files only. Account/auth traffic is never intercepted. */
const CACHE='olympion-v1';
const BUILD='__BUILD__';
const CORE=__CORE__;
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const path of CORE){const response=await fetch(path,{cache:'reload'});if(!response.ok)throw new Error('Offline asset unavailable: '+path);await cache.put(path,response);}})());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/auth')||url.pathname.startsWith('/api/'))return;
  if(url.pathname==='/sw.js'||url.pathname.endsWith('source.tar.gz'))return;
  const publicFile=/^\/(?:_next\/static\/|fonts\/|images\/|icons\/|puzzles\/|engine\/)/.test(url.pathname)||url.pathname.endsWith('.txt')||url.pathname==='/manifest.webmanifest';
  if(publicFile){event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(url.pathname);if(cached)return cached;const response=await fetch(request);if(response.ok&&response.type!=='opaque')await cache.put(url.pathname,response.clone());return response;})());return;}
  if(request.mode==='navigate'){event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(request);if(response.ok&&!request.headers.has('RSC'))await cache.put(url.pathname,response.clone());return response;}catch{const cached=await cache.match(url.pathname);return cached||new Response('Diese Seite ist noch nicht offline verfügbar. Bitte einmal online öffnen.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}})());}
});
