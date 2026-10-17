// 一度開いたページとフォントを保存して、通信がなくても表示できるようにする。
// ページ（index.html）は毎回まず最新を取りに行き、通信できないときだけ保存したものを出す（2026-10-12 v12。
// それまでは保存したものを先に出していたので、ホーム画面に追加した Web アプリでは更新が出なかった）。
// アイコン・フォントは保存したものをすぐ出しつつ、裏で最新に入れかえる。version.json は保存しない（更新の確認用）。
const CACHE = 'drill-v25';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png'];
self.addEventListener('install', e => {
  // ブラウザーの一時保存（HTTPキャッシュ）を通さずに取る
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, {cache: 'reload'})))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function page(e) {
  return caches.open(CACHE).then(c => {
    const net = fetch(e.request.url, {cache: 'no-cache', credentials: 'same-origin'}).then(r => {
      if (r && r.ok) { c.put('./index.html', r.clone()); c.put('./', r.clone()); }
      return r;
    });
    // 通信が遅い・つながらないときは保存したもの（4秒まで待つ）
    const slow = new Promise(res => setTimeout(res, 4000)).then(() => c.match('./index.html'));
    return Promise.race([net.catch(() => c.match('./index.html')), slow.then(h => h || net)])
      .then(r => r || net);
  });
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const same = u.origin === location.origin;
  if (same && /\/version\.json$/.test(u.pathname)) return;
  if (same && (e.request.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname))) { e.respondWith(page(e)); return; }
  if (!same && !/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, {ignoreSearch: same}).then(hit => {
    const net = fetch(e.request).then(r => {
      if (r && (r.ok || r.type === 'opaque')) c.put(e.request, r.clone());
      return r;
    }).catch(() => hit);
    return hit || net;
  })));
});
