// NOx service worker: opens offline with the last forecast it saw.
const V = 'nox-v2'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png']))); self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
const keep = (r, res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((ch) => ch.put(r, c)) } return res }
self.addEventListener('fetch', (e) => {
  const r = e.request
  const u = new URL(r.url)
  if (r.method !== 'GET' || u.origin !== location.origin) return          // map tiles and fonts: browser handles them
  if (u.pathname.startsWith('/api/')) {                                    // forecast: newest if online, last copy if not
    e.respondWith(fetch(r).then((res) => keep(r, res)).catch(() => caches.match(r)))
    return
  }
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then((res) => keep(r, res)).catch(() => caches.match('/'))); return }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => keep(r, res))))
})

// ---- push alerts ----
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.title || 'NOx air alert', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag || 'nox', renotify: true,
    vibrate: [140, 70, 140], requireInteraction: d.level === 'severe', data: { url: d.url || '/' },
  }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ('focus' in c) return c.navigate(url).then(() => c.focus()).catch(() => c.focus())
    return self.clients.openWindow(url)
  }))
})
