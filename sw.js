/* L-TEX Service Worker — bypass aggressive caching for data files.

   GitHub Pages serves /data/*.js with Cache-Control: max-age=600 and the
   browser caches the parent HTML page too — so a freshly uploaded photo
   appears only after a hard reload (Ctrl+Shift+R). This worker watches
   all fetches and, for /data/*.js and /admin.html, always re-fetches
   from the network with cache:'no-store'.

   Everything else (images, fonts, CSS, JS bundles) falls through to the
   browser cache — those rarely change, so we keep the speed-up.
*/

const VERSION = 'ltex-sw-v3';

self.addEventListener('install',  (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); }
  catch(e){ return; }

  /* Only intercept same-origin requests */
  if(url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isDataJs = /\/data\/[^/]+\.js$/i.test(path);
  const isAdminHtml = /\/admin\.html$/i.test(path);
  const isMainHtml = /\/(catalog|lots|product|index|cart|wishlist)\.html$/i.test(path) || path.endsWith('/');

  /* For these targets, always go to the network. */
  if(isDataJs || isAdminHtml || isMainHtml){
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .catch(() => fetch(req))  // fall back to default cache if offline
    );
  }
});
