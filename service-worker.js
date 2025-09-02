const CACHE = 'tomato-pomodoro-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/assets/start.mp3',
  '/assets/pause.mp3',
  '/assets/work_done.mp3',
  '/assets/break_done.mp3',
  '/assets/transition.mp3',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e)=>{
  const { request } = e;
  if(request.method !== 'GET') return;
  e.respondWith((async()=>{
    const cached = await caches.match(request);
    if(cached) return cached;
    try{
      const response = await fetch(request);
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
      return response;
    }catch{
      return cached || new Response('Offline', { status: 503, statusText:'Offline' });
    }
  })());
});


