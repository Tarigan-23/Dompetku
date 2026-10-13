# DompetKu — Aplikasi Pencatatan Keuangan Pribadi Offline

DompetKu adalah aplikasi pencatatan keuangan pribadi (uang masuk & uang keluar) yang **100% offline** untuk fungsi utamanya. Seluruh transaksi, kategori, dan pengaturan disimpan di **IndexedDB pada perangkat Anda** — tanpa server, tanpa akun, tanpa Firebase/Supabase, tanpa analytics, dan tanpa aset dari CDN saat aplikasi berjalan.

---

## 1. Fitur utama

| Bagian | Fitur |
| --- | --- |
| **Dashboard** | Saldo saat ini, pemasukan/pengeluaran/selisih bulan ini, jumlah transaksi, grafik pemasukan vs pengeluaran (6 bulan), diagram donat pengeluaran per kategori, kategori terbesar, rata-rata harian, transaksi terbaru, tombol cepat |
| **Transaksi** | Pencarian (catatan/kategori), filter jenis, filter kategori, filter tanggal & rentang tanggal, filter bulan/tahun, preset periode, urut terbaru/terlama, edit, hapus dengan dialog konfirmasi, saldo berjalan per transaksi, paginasi |
| **Laporan Bulanan** | Navigasi bulan sebelumnya/berikutnya, pilihan bulan & tahun, total pemasukan/pengeluaran/selisih, saldo awal & akhir bulan, jumlah transaksi, rincian per kategori (nominal, jumlah transaksi, persentase, donat + bar), grafik arus harian, analisis (kategori terbesar, hari terberat, rata-rata per hari, perbandingan bulan lalu, kategori naik/turun, ringkasan naratif), daftar transaksi |
| **Laporan Mingguan** | Rentang pekan sesuai preferensi awal pekan, rekap harian (tabel + grafik), total per kategori, daftar transaksi dengan saldo berjalan |
| **Laporan Harian** | Navigasi tanggal, pemasukan/pengeluaran/selisih, saldo awal & akhir hari, total per kategori, urutan transaksi |
| **Kategori** | 15 kategori pengeluaran + 10 kategori pemasukan bawaan, buat kategori baru, ganti nama, ubah ikon & warna, arsipkan/aktifkan, hapus (ditolak bila masih dipakai transaksi) |
| **Backup** | Ekspor JSON, impor/pemulihan JSON dengan validasi struktur + mode *ganti semua* / *gabungkan*, ekspor CSV (Excel), salin ringkasan laporan, cetak/simpan PDF |
| **Pengaturan** | Saldo awal, format tanggal, awal pekan, sembunyikan nominal, kurangi animasi, kelola kategori, hapus seluruh data (konfirmasi berlapis + ketik `HAPUS`) |

### Logika perhitungan

```
Saldo saat ini       = saldo awal + Σ pemasukan − Σ pengeluaran
Saldo awal bulan     = saldo awal + Σ (transaksi sebelum tanggal 1 bulan tsb)
Saldo akhir bulan    = saldo awal bulan + pemasukan bulan − pengeluaran bulan
Selisih bulan        = pemasukan bulan − pengeluaran bulan
```

- Semua nominal disimpan sebagai **integer Rupiah bulat** (tanpa desimal) sehingga tidak ada kesalahan floating-point.
- Saldo awal **bukan** pemasukan dan tidak pernah dihitung dua kali.
- Setiap tambah/edit/hapus transaksi langsung memperbarui saldo, statistik, grafik, dan semua laporan (data dihitung ulang dari transaksi asli, bukan angka manual).
- Laporan bulan lalu tidak berubah ketika ada transaksi baru pada bulan berikutnya.

### Skenario uji (sesuai spesifikasi)

Saldo awal Rp1.000.000 → pemasukan gaji Rp4.000.000 → lemburan Rp300.000 → pengeluaran makan Rp50.000 → BBM Rp100.000:

| Hasil | Nilai |
| --- | --- |
| Total pemasukan | Rp4.300.000 |
| Total pengeluaran | Rp150.000 |
| Selisih | Rp4.150.000 |
| Saldo akhir | Rp5.150.000 |
| Laporan kategori | Makan Rp50.000 · BBM Rp100.000 |

---

## 2. Menjalankan dan membangun

```bash
# mode pengembangan (butuh koneksi hanya untuk dev server Vite)
npm install
npm run dev

# build produksi (hasil: dist/index.html — satu berkas mandiri)
npm run build

# pratinjau hasil build
npm run preview
```

Hasil build adalah **satu berkas `dist/index.html`** yang sudah berisi seluruh HTML, CSS, JavaScript, dan ikon (inline SVG). Berkas `sw.js`, `manifest.webmanifest`, `icon.svg`, dan `icon-512.png` dari folder `public/` disalin ke `dist/` untuk kemampuan PWA.

### Memasang sebagai aplikasi (PWA)

1. Jalankan `npm run build`, lalu sajikan folder `dist/` lewat HTTPS atau `localhost` (mis. `npm run preview`).
2. **Windows/macOS (Chrome/Edge):** buka alamatnya → menu browser → **Pasang DompetKu / Install app**.
3. **Android (Chrome):** menu → **Tambahkan ke layar utama**.
4. **iOS (Safari):** tombol Bagikan → **Tambah ke Layar Utama**.

Setelah terpasang, aplikasi dibuka dari ikon dan **tetap berfungsi tanpa internet**. Service worker menyimpan app shell ke cache; bila service worker tidak tersedia, aplikasi tetap offline-capable karena seluruh aset berada di dalam satu berkas HTML.

> Catatan: mode `file://` tidak mendukung service worker & beberapa fitur penyimpanan. Gunakan `localhost` atau HTTPS.

---

## 3. Lokasi penyimpanan data

| Item | Lokasi |
| --- | --- |
| Transaksi, kategori, pengaturan | IndexedDB database bernama **`dompetku`** (tabel `transactions`, `categories`, `settings`) pada profil browser/perangkat Anda |
| Saldo awal & preferensi | IndexedDB `dompetku` → `settings` (kunci `app`) |
| Cache app shell | Cache Storage API, entri `dompetku-v1` |
| Cookie / pelacakan / server | **tidak ada** |

Cara melihat datanya (untuk verifikasi): Chrome/Edge → DevTools → **Application** → **Storage** → **IndexedDB** → `dompetku`.

**Penting:** karena data hanya ada di perangkat, data bisa hilang bila Anda menghapus data situs pada pengaturan browser, mencopot instalasi aplikasi, memakai mode penjelajahan pribadi, atau bila perangkat rusak. **Lakukan backup secara berkala.**

---

## 4. Backup dan pemulihan

### Ekspor
- **Pengaturan → Backup dan Pemulihan → Ekspor backup JSON**: berkas `dompetku-backup-YYYYMMDD-HHMM.json` berisi seluruh transaksi, kategori, dan pengaturan.
- **Ekspor transaksi CSV**: `dompetku-semua-transaksi-….csv` (pemisah `;`, BOM UTF-8) — langsung rapi dibuka di Microsoft Excel.
- **Halaman Transaksi → CSV**: mengekspor hanya hasil filter aktif.
- **Halaman Laporan → Cetak / Simpan PDF**: gunakan dialog cetak browser lalu pilih *Save as PDF* (tata letak cetak sudah disiapkan, hanya area laporan yang tercetak).

### Impor / pemulihan
1. **Pengaturan → Impor backup JSON**.
2. Aplikasi memvalidasi struktur berkas (jenis, nominal, tanggal, kategori) dan menampilkan ringkasan isi berkas sebelum data dipulihkan.
3. Pilih mode:
   - **Ganti semua** — hapus data saat ini lalu muat isi berkas (untuk pindah perangkat / pemulihan).
   - **Gabungkan** — tambahkan data berkas; transaksi dengan ID sama akan ditimpa sehingga tidak ada duplikat.
4. Baris yang tidak valid dilewati dan jumlahnya dilaporkan, tidak ada data yang dihapus diam-diam.

### Menghapus semua data
**Pengaturan → Hapus Semua Data** → konfirmasi pertama → konfirmasi kedua dengan mengetik `HAPUS`. Kategori bawaan dibuat ulang dan saldo awal kembali ke Rp0.

---

## 5. Keamanan dan keandalan

- Tidak ada permintaan jaringan untuk data: tidak ada fetch ke API eksternal, tidak ada analytics, tidak ada CDN font/ikon/library.
- Ikon antarmuka digambar sebagai SVG lokal; ikon kategori memakai emoji sistem.
- Operasi tulis penting memakai **transaksi Dexie/IndexedDB**; bila gagal, perubahan tidak diterapkan pada tampilan dan pengguna mendapat pesan error yang jelas.
- ID transaksi dibuat dengan `crypto.randomUUID()` (dengan fallback) sehingga unik.
- Validasi masukan: nominal wajib angka > 0 dan ≤ Rp9.999.999.999, tanggal divalidasi kalender, waktu divalidasi format `HH:MM`, catatan dibatasi 300 karakter.
- Pencegahan penyimpanan ganda: tombol dinonaktifkan saat menyimpan + penanda tangan transaksi terakhir (transaksi identik dalam 2,5 detik ditolak).
- Kategori yang masih dipakai transaksi tidak dapat dihapus (gunakan arsip) agar riwayat laporan tetap utuh.
- Migrasi basis data aman: Dexie versi 1 → 2 dengan `upgrade()` yang mengisi nilai default pada data lama tanpa menghapus data pengguna.

---

## 6. Struktur kode

```
src/
├── App.tsx                 # Shell aplikasi, navigasi, sidebar, onboarding
├── main.tsx                # Entry point + registrasi service worker
├── db/db.ts                # Dexie (IndexedDB), schema, migrasi, seed kategori, backup/reset
├── lib/
│   ├── types.ts            # Tipe data & konstanta versi
│   ├── money.ts            # Format/parsing Rupiah (integer), validasi nominal
│   ├── date.ts             # Helper tanggal Indonesia, periode pekan/bulan
│   ├── stats.ts            # Mesin hitung: saldo, laporan periode/bulanan, analisis
│   ├── exporters.ts        # Backup JSON, CSV, teks ringkasan, unduhan lokal
│   └── icons.tsx           # Ikon SVG lokal + palet ikon/warna kategori
├── store/
│   ├── AppStore.tsx        # State + CRUD ke IndexedDB, notifikasi
│   └── UiStore.tsx         # Navigasi & modal bersama (form, kategori, konfirmasi)
├── components/
│   ├── ui.tsx              # Card, Button, Modal, Field, Money, Badge, Toast, dll.
│   ├── charts.tsx          # Grafik SVG lokal: batang, donat, harian
│   ├── TransactionForm.tsx # Form tambah/edit transaksi
│   ├── TransactionList.tsx # Daftar transaksi dikelompokkan per tanggal + saldo
│   └── CategoryManager.tsx# Kelola kategori (CRUD, arsip, hapus)
└── pages/
    ├── Dashboard.tsx
    ├── Transactions.tsx
    ├── Reports.tsx         # Bulanan, mingguan, harian
    └── Settings.tsx        # Saldo awal, preferensi, backup, hapus data
public/
├── sw.js                   # Service worker (cache app shell)
├── manifest.webmanifest    # Manifest PWA
└── icon.svg, icon-512.png  # Ikon aplikasi
```

---

## 7. Rencana versi desktop

Arsitektur ini siap dibawa ke desktop: lapisan data sudah dipisahkan di `src/db/db.ts`. Untuk versi native (Windows/macOS), bungkus dengan **Tauri** dan ganti implementasi `db/db.ts` menjadi modul setara yang memakai **SQLite** melalui `@tauri-apps/plugin-sql`, dengan tanda tangan fungsi yang sama (`addTransaction`, `updateTransaction`, `saveCategory`, dsb.) sehingga seluruh UI dan mesin perhitungan tidak perlu diubah.
