// Service worker for the installed test app. Network first, so testers always get the latest version;
// the cached copy is used only when the phone is offline. Sign-in and data calls (other sites) are never cached.
const CACHE = 'ss-app-v42';
const SHELL = ['./', './index.html', './app.js', './meals.js', './facesheet.js', './cleaning.js', './monitor.js', './mar.js', './grievance.js', './safety.js', './notes.js', './academy-data.js', './academy.js', './wages-data.js', './trial.js', './data.js', './peer-data.js', './schedule.js', './access.js', './time.js', './insights.js', './isp-library.js', './isp.js', './labor.js', './station.js', './tablet.js', './outlook.js', './reports.js', './money.js', './intake.js', './intake-samples.js', './choices.js', './assistant.js', './search.js', './hr-data.js', './hr.js', './vendors.js', './reminders.js', './residents.js', './family.js', './outside.js', './alerts.js', './schedule.css', './manifest.webmanifest', './icons/icon-192.png',
  '../desk/config.js', '../desk/pw.js', '../desk/idle.js', '../desk/vendor/supabase-js-2.118.0.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('./index.html')))
  );
});
