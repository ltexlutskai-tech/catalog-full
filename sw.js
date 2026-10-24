/* L-TEX legacy catalog service worker — self-destruct.
   The old catalog is permanently redirected to https://ltex.com.ua/catalog.
   This replaces the earlier SW: on activation it clears every cache,
   unregisters itself and sends open tabs to the new site. */

self.addEventListener('install', function(){ self.skipWaiting(); });

self.addEventListener('activate', function(event){
  event.waitUntil((async function(){
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
    } catch(err){}
    try { await self.clients.claim(); } catch(err){}
    try { await self.registration.unregister(); } catch(err){}
    try {
      var wins = await self.clients.matchAll({ type: 'window' });
      wins.forEach(function(c){
        try { c.navigate('https://ltex.com.ua/catalog'); } catch(err){}
      });
    } catch(err){}
  })());
});

/* No fetch handler: let the browser go to network for every request so
   the new redirect pages are served without SW interference. */
