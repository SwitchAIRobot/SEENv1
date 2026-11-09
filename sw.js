const V='sis-v1',FILES=['./','index.html','styles.css','app.js','manifest.webmanifest','timetable.json','parliament_bills.json','reports.json','articles.json','icon-192.png','icon-512.png','logo.png','fuse.min.js','leaflet.js','leaflet.css'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>0))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);
 if(u.origin!==location.origin)return; // map tiles/network only
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c=n.clone();caches.open(V).then(x=>x.put(e.request,c));return n}).catch(()=>caches.match('index.html'))))});
