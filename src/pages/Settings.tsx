import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Field, Money, MoneyInput, Segmented, Select, TextInput } from "@/components/ui";
import { Icon } from "@/lib/icons";
import { formatNumber, formatRupiah, parseAmount } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { backupToJSON, downloadFile, stampName, transactionsToCSV } from "@/lib/exporters";
import { parseBackup } from "@/db/db";
import { useApp } from "@/store/AppStore";
import { useUI } from "@/store/UiStore";
import { APP_NAME, APP_VERSION, DB_VERSION, type DateFormat } from "@/lib/types";

export function Settings() {
  const {
    settings,
    updateSettings,
    transactions,
    categories,
    balance,
    exportBackup,
    restoreBackup,
    wipeAllData,
    notify,
  } = useApp();
  const { openCategoryManager, confirm, navigate } = useUI();

  const [initialBalance, setInitialBalance] = useState(formatNumber(settings.initialBalance));
  const [savingBalance, setSavingBalance] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [storageInfo, setStorageInfo] = useState<string>("—");
  const [importState, setImportState] = useState<{
    name: string;
    size: number;
    text: string;
    categories: number;
    transactions: number;
    skipped: number;
    exportedAt: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInitialBalance(formatNumber(settings.initialBalance));
  }, [settings.initialBalance]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          if (!cancelled && est.usage != null) {
            setStorageInfo(`${(est.usage / 1024).toFixed(1)} KB terpakai dari kuota ~${Math.round((est.quota ?? 0) / 1024 / 1024)} MB`);
          }
        } else if (!cancelled) {
          setStorageInfo("Tidak tersedia di browser ini");
        }
      } catch {
        if (!cancelled) setStorageInfo("Tidak tersedia");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transactions.length, categories.length]);

  const oldest = useMemo(
    () => transactions.map((t) => t.date).sort()[0],
    [transactions],
  );

  async function saveInitialBalance() {
    const parsed = parseAmount(initialBalance) ?? 0;
    setSavingBalance(true);
    try {
      await updateSettings({ initialBalance: parsed });
      notify({
        type: "success",
        title: "Saldo awal disimpan",
        message: `Saldo awal ${formatRupiah(parsed)}. Saldo saat ini menjadi ${formatRupiah(balance - settings.initialBalance + parsed)}.`,
      });
    } catch (err) {
      notify({ type: "error", title: "Gagal menyimpan saldo awal", message: err instanceof Error ? err.message : "" });
    } finally {
      setSavingBalance(false);
    }
  }

  function handleExportJSON() {
    const backup = exportBackup();
    downloadFile(stampName("dompetku-backup", "json"), backupToJSON(backup), "application/json");
    notify({
      type: "success",
      title: "Backup JSON dibuat",
      message: `${backup.transactions.length} transaksi dan ${backup.categories.length} kategori disimpan ke berkas unduhan.`,
    });
  }

  function handleExportCSV() {
    if (transactions.length === 0) {
      notify({ type: "info", title: "Belum ada transaksi untuk diekspor" });
      return;
    }
    downloadFile(
      stampName("dompetku-semua-transaksi", "csv"),
      transactionsToCSV([...transactions].sort((a, b) => a.date.localeCompare(b.date)), categories, settings),
      "text/csv",
    );
    notify({ type: "success", title: "CSV dibuat", message: `${transactions.length} transaksi diekspor untuk Excel.` });
  }

  async function handleRestore(mode: "replace" | "merge") {
    if (!importState) return;
    setRestoring(true);
    try {
      const result = await restoreBackup(importState.text, mode);
      notify({
        type: "success",
        title: mode === "replace" ? "Data berhasil dipulihkan" : "Data berhasil digabungkan",
        message: `${result.added} transaksi diproses${result.skipped ? `, ${result.skipped} baris tidak valid dilewati` : ""}.`,
      });
      setImportState(null);
    } catch (err) {
      notify({
        type: "error",
        title: "Pemulihan gagal",
        message: err instanceof Error ? err.message : "Berkas tidak dapat diproses.",
      });
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Baca & validasi struktur berkas backup sebelum data dipulihkan. */
  async function onPickFile(file: File) {
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      setImportState({
        name: file.name,
        size: file.size,
        text,
        categories: parsed.categories.length,
        transactions: parsed.transactions.length,
        skipped: parsed.skipped,
        exportedAt: parsed.settings.updatedAt ? new Date(parsed.settings.updatedAt).toLocaleString("id-ID") : "—",
      });
    } catch (err) {
      notify({
        type: "error",
        title: "Berkas backup tidak valid",
        message: err instanceof Error ? err.message : "Berkas tidak dapat diproses.",
      });
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setRestoring(false);
    }
  }

  async function handleWipe() {
    const ok = await confirm({
      title: "Hapus seluruh data aplikasi?",
      message: (
        <>
          Semua transaksi, kategori buatan Anda, dan pengaturan akan dihapus dari penyimpanan lokal perangkat ini.
          Tindakan ini tidak bisa dibatalkan. Sebaiknya unduh backup JSON terlebih dahulu.
        </>
      ),
      confirmLabel: "Lanjut ke konfirmasi akhir",
    });
    if (!ok) return;
    setWipeOpen(true);
  }

  async function confirmWipe() {
    setWipeOpen(false);
    try {
      await wipeAllData();
      notify({
        type: "success",
        title: "Semua data dihapus",
        message: "Aplikasi kembali ke kondisi awal. Silakan atur saldo awal kembali.",
      });
      navigate("dashboard");
    } catch (err) {
      notify({ type: "error", title: "Gagal menghapus data", message: err instanceof Error ? err.message : "" });
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Saldo Awal" subtitle="Jumlah uang yang Anda miliki sebelum mulai mencatat">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field
            label="Nominal saldo awal"
            hint="Saldo awal tidak dihitung sebagai pemasukan sehingga laporan tidak menjadi dobel."
          >
            <MoneyInput value={initialBalance} onChange={setInitialBalance} />
          </Field>
          <Button
            variant="primary"
            loading={savingBalance}
            onClick={saveInitialBalance}
            disabled={(parseAmount(initialBalance) ?? 0) === settings.initialBalance}
          >
            <Icon name="save" size={16} /> Simpan saldo awal
          </Button>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
          <p className="rounded-lg border border-line bg-base-900/50 px-3 py-2">
            Saldo awal: <Money value={settings.initialBalance} className="font-medium" />
          </p>
          <p className="rounded-lg border border-line bg-base-900/50 px-3 py-2">
            Total transaksi: {formatNumber(transactions.length)} transaksi
          </p>
          <p className="rounded-lg border border-line bg-base-900/50 px-3 py-2">
            Saldo saat ini: <Money value={balance} className="font-medium" />
          </p>
        </div>
      </Card>

      <Card title="Preferensi Tampilan" subtitle="Semua preferensi disimpan lokal di perangkat ini">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Format tanggal" hint={`Contoh: ${formatDate(new Date().toISOString().slice(0, 10), settings.dateFormat)}`}>
            <Select
              value={settings.dateFormat}
              onChange={(e) => updateSettings({ dateFormat: e.target.value as DateFormat }).catch(() => notify({ type: "error", title: "Gagal menyimpan format tanggal" }))}
            >
              <option value="dd/MM/yyyy">dd/MM/yyyy (12/08/2026)</option>
              <option value="dd-MM-yyyy">dd-MM-yyyy (12-08-2026)</option>
              <option value="yyyy-MM-dd">yyyy-MM-dd (2026-08-12)</option>
              <option value="d MMMM yyyy">d MMMM yyyy (12 Agustus 2026)</option>
            </Select>
          </Field>
          <Field label="Awal pekan" hint="Dipakai pada laporan mingguan">
            <Segmented
              value={`${settings.weekStart}`}
              onChange={(v) => updateSettings({ weekStart: v === "0" ? 0 : 1 }).catch(() => notify({ type: "error", title: "Gagal menyimpan preferensi" }))}
              options={[
                { value: "1", label: "Senin – Minggu" },
                { value: "0", label: "Minggu – Sabtu" },
              ]}
              className="w-full"
            />
          </Field>
          <label className="flex items-start gap-3 rounded-xl border border-line bg-base-900/50 p-3">
            <input
              type="checkbox"
              checked={settings.hideAmounts}
              onChange={(e) => updateSettings({ hideAmounts: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-mint-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-200">Sembunyikan nominal</span>
              <span className="block text-xs text-slate-500">
                Tampilkan Rp•••••• di seluruh aplikasi saat digunakan di tempat umum.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-line bg-base-900/50 p-3">
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => {
                updateSettings({ reduceMotion: e.target.checked }).catch(() => notify({ type: "error", title: "Gagal menyimpan preferensi" }));
                document.documentElement.style.setProperty("scroll-behavior", e.target.checked ? "auto" : "smooth");
              }}
              className="mt-0.5 h-4 w-4 accent-mint-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-200">Kurangi animasi</span>
              <span className="block text-xs text-slate-500">Matikan animasi grafik dan transisi kartu.</span>
            </span>
          </label>
        </div>
      </Card>

      <Card title="Kategori" subtitle="Kelola kategori pemasukan dan pengeluaran">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openCategoryManager("expense")}>
            <Icon name="tag" size={15} /> Kategori pengeluaran ({categories.filter((c) => c.type === "expense" && !c.archived).length})
          </Button>
          <Button variant="outline" onClick={() => openCategoryManager("income")}>
            <Icon name="tag" size={15} /> Kategori pemasukan ({categories.filter((c) => c.type === "income" && !c.archived).length})
          </Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Kategori bawaan sudah tersedia (Makan, BBM, Transportasi, Gaji, Lemburan, dan lainnya). Anda dapat membuat
          kategori baru, mengganti nama, mengubah ikon dan warna, mengarsipkan, atau menghapus kategori yang belum
          dipakai transaksi.
        </p>
      </Card>

      <Card title="Backup dan Pemulihan" subtitle="Data tersimpan hanya di perangkat Anda">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={handleExportJSON}>
            <Icon name="download" size={16} /> Ekspor backup JSON
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Icon name="download" size={16} /> Ekspor transaksi CSV
          </Button>
          <Button variant="outline" loading={restoring} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Impor backup JSON
          </Button>
          <Button variant="outline" onClick={() => navigate("reports")}>
            <Icon name="print" size={16} /> Cetak laporan
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPickFile(file);
            }}
          />
        </div>
        <div className="mt-4 space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200/90">
          <p className="flex items-start gap-2">
            <Icon name="warning" size={15} className="mt-0.5 shrink-0" />
            <span>
              Seluruh data DompetKu disimpan di penyimpanan lokal browser (IndexedDB) pada perangkat ini. Data bisa
              hilang bila Anda menghapus data situs pada pengaturan browser, mencopot instalasi aplikasi, memakai mode
              penjelajahan pribadi, atau jika perangkat rusak. Karena itu <b>unduh backup JSON secara berkala</b> dan
              simpan di tempat aman seperti penyimpanan berkas pribadi atau flashdisk.
            </span>
          </p>
        </div>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <p className="rounded-lg border border-line bg-base-900/50 px-3 py-2 text-slate-400">
            Berkas backup berisi {transactions.length} transaksi, {categories.length} kategori, dan pengaturan aplikasi.
          </p>
          <p className="rounded-lg border border-line bg-base-900/50 px-3 py-2 text-slate-400">
            {oldest
              ? `Data tercatat mulai ${formatDate(oldest, settings.dateFormat)} hingga sekarang.`
              : "Belum ada transaksi yang tercatat."}
          </p>
        </div>
      </Card>

      <Card title="Hapus Semua Data" subtitle="Tindakan permanen dengan konfirmasi berlapis">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs leading-relaxed text-slate-400">
            Menghapus seluruh transaksi, kategori buatan, dan pengaturan. Kategori bawaan akan dibuat ulang dan saldo
            awal kembali ke Rp0. Unduh backup terlebih dahulu bila masih diperlukan.
          </p>
          <Button variant="danger" onClick={handleWipe}>
            <Icon name="trash" size={16} /> Hapus semua data
          </Button>
        </div>
      </Card>

      <Card title="Informasi Aplikasi" subtitle="DompetKu bekerja sepenuhnya offline">
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          {[
            ["Nama aplikasi", `${APP_NAME} v${APP_VERSION}`],
            ["Versi struktur data", `v${DB_VERSION} (IndexedDB: dompetku)`],
            ["Penyimpanan lokal", storageInfo],
            ["Status koneksi", navigator.onLine ? "Online (tidak diperlukan)" : "Offline — semua fitur tetap berfungsi"],
            ["Server / akun online", "Tidak ada. Data tidak pernah dikirim ke pihak ketiga."],
            ["Analitik / pelacakan", "Tidak ada."],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line bg-base-900/50 px-3 py-2.5">
              <dt className="text-slate-500">{k}</dt>
              <dd className="mt-0.5 font-medium text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="income">
            <Icon name="shield" size={12} /> 100% lokal
          </Badge>
          <Badge tone="neutral">
            <Icon name="cloudOff" size={12} /> Tanpa CDN saat berjalan
          </Badge>
          <Badge tone="neutral">Rupiah bulat, tanpa pembulatan desimal</Badge>
        </div>
        <div className="mt-3 text-xs leading-relaxed text-slate-500">
          <p className="font-medium text-slate-400">Cara memasang sebagai aplikasi:</p>
          <p>
            Di Chrome/Edge desktop buka menu browser lalu pilih <b>Pasang DompetKu</b> (Install app). Di Android pilih
            menu <b>Tambahkan ke layar utama</b>, dan di iOS Safari gunakan <b>Bagikan → Tambah ke Layar Utama</b>.
            Setelah terpasang, aplikasi dibuka dari ikon dan tetap berfungsi tanpa internet.
          </p>
        </div>
      </Card>

      {/* Dialog pemulihan backup */}
      {importState && (
        <div className="no-print fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !restoring && setImportState(null)} />
          <div className="anim-pop relative z-10 w-full max-w-md rounded-t-3xl border border-mint-500/25 bg-base-850 p-5 sm:rounded-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint-500/15 text-mint-400">
                <Icon name="upload" size={19} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-50">Pulihkan data dari backup</h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">{importState.name}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {[
                ["Transaksi valid", `${importState.transactions}`],
                ["Kategori", `${importState.categories}`],
                ["Baris dilewati", `${importState.skipped}`],
                ["Ukuran berkas", `${(importState.size / 1024).toFixed(1)} KB`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line bg-base-900/60 px-3 py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-mono font-medium text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 rounded-xl border border-line bg-base-900/50 p-3 text-xs leading-relaxed text-slate-400">
              <b className="text-slate-200">Ganti semua</b> menghapus {transactions.length} transaksi yang ada sekarang
              lalu memuat isi berkas. <b className="text-slate-200">Gabungkan</b> menambah data berkas; transaksi dengan
              ID sama akan ditimpa sehingga tidak ada duplikasi.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" disabled={restoring} onClick={() => setImportState(null)}>
                Batal
              </Button>
              <Button variant="secondary" loading={restoring} onClick={() => handleRestore("merge")}>
                <Icon name="plus" size={15} /> Gabungkan
              </Button>
              <Button variant="danger" loading={restoring} onClick={() => handleRestore("replace")}>
                <Icon name="refresh" size={15} /> Ganti semua
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmWipeDialog open={wipeOpen} onClose={() => setWipeOpen(false)} onConfirm={confirmWipe} />
    </div>
  );
}

function ConfirmWipeDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setText("");
      setBusy(false);
    }
  }, [open]);
  return (
    <div className="no-print fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="anim-pop relative z-10 w-full max-w-md rounded-2xl border border-rose-500/30 bg-base-850 p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-450">
            <Icon name="warning" size={20} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-50">Konfirmasi terakhir</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Ketik <b className="text-rose-450">HAPUS</b> (huruf kapital) untuk mengonfirmasi penghapusan seluruh data
              keuangan Anda di perangkat ini. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="HAPUS" autoComplete="off" />
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            variant="danger"
            disabled={text.trim() !== "HAPUS"}
            loading={busy}
            onClick={() => {
              setBusy(true);
              onConfirm();
            }}
          >
            <Icon name="trash" size={16} /> Hapus permanen
          </Button>
        </div>
      </div>
    </div>
  );
}
