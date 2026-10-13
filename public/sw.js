/* DompetKu — Service Worker (offline-first)
 * Seluruh aset aplikasi sudah berada di dalam satu berkas HTML sehingga
 * aplikasi dapat berjalan tanpa koneksi. Service worker ini menyimpan salinan
 * app shell ke cache agar aplikasi tetap terbuka saat perangkat offline.
 */
const CACHE_NAME = "dompetku-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman: coba jaringan, gunakan cache bila offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match("./index.html")) ||
            (await cache.match("./")) ||
            new Response("<h1>DompetKu offline</h1>", {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  // Aset lain: cache dulu, perbarui di latar belakang.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) {
        fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
          })
          .catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })(),
  );
});
