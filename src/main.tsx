import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const rootEl = document.getElementById("root");

createRoot(rootEl!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Registrasi Service Worker untuk pemakaian offline.
 * Semua aset utama sudah berada di dalam satu berkas HTML, jadi aplikasi tetap
 * berjalan penuh tanpa koneksi. Service worker menambah kemampuan instalasi PWA.
 */
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", async () => {
    try {
      const probe = await fetch("sw.js", { method: "HEAD", cache: "no-store" });
      if (!probe.ok) return;
      await navigator.serviceWorker.register("sw.js", { scope: "./" });
    } catch {
      /* Service worker tidak tersedia — aplikasi tetap berfungsi offline
         karena seluruh skrip, gaya, dan ikon sudah berada di dalam berkas HTML. */
    }
  });
}
