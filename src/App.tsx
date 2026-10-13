import { useEffect, useState } from "react";
import { AppProvider, useApp } from "@/store/AppStore";
import { UiProvider, useUI, type Page } from "@/store/UiStore";
import { Button, Money, MoneyInput, ToastHost } from "@/components/ui";
import { Dashboard } from "@/pages/Dashboard";
import { Transactions } from "@/pages/Transactions";
import { Reports } from "@/pages/Reports";
import { Settings } from "@/pages/Settings";
import { Icon } from "@/lib/icons";
import { formatNumber, parseAmount } from "@/lib/money";
import { APP_NAME, APP_VERSION } from "@/lib/types";
import { cn } from "@/utils/cn";

const NAV: Array<{ id: Page; label: string; icon: string; hint: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", hint: "Ringkasan keuangan" },
  { id: "transactions", label: "Transaksi", icon: "receipt", hint: "Semua catatan" },
  { id: "reports", label: "Laporan", icon: "chart", hint: "Harian, mingguan, bulanan" },
  { id: "settings", label: "Pengaturan", icon: "settings", hint: "Saldo awal, backup" },
];

export default function App() {
  return (
    <AppProvider>
      <UiProvider>
        <Shell />
        <ToastHost />
      </UiProvider>
    </AppProvider>
  );
}

function Shell() {
  const { ready, fatalError, settings } = useApp();
  const { page } = useUI();

  useEffect(() => {
    document.body.classList.toggle("no-anim", settings.reduceMotion);
  }, [settings.reduceMotion]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950">
        <div className="flex flex-col items-center gap-4">
          <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-mint-500/15 text-mint-400">
            <Icon name="wallet" size={26} />
          </span>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-200">{APP_NAME}</p>
            <p className="mt-1 text-xs text-slate-500">Membuka penyimpanan lokal…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-950 print:bg-white">
      {fatalError && <FatalErrorScreen message={fatalError} />}
      {!fatalError && !settings.onboarded && <Onboarding />}
      <div className={cn("lg:grid lg:grid-cols-[248px_1fr]", (fatalError || !settings.onboarded) && "pointer-events-none select-none")}>
        <Sidebar />
        <main className="print-root min-w-0 pb-24 lg:pb-8">
          <MobileHeader />
          <div className="mx-auto w-full max-w-[1360px] px-3 py-4 sm:px-5 lg:px-7 lg:py-6">
            <PageHeader />
            <div key={page} className="anim-fade-up">
              {page === "dashboard" && <Dashboard />}
              {page === "transactions" && <Transactions />}
              {page === "reports" && <Reports />}
              {page === "settings" && <Settings />}
            </div>
            <footer className="mt-8 hidden items-center justify-between gap-3 border-t border-line-soft pt-4 text-[11px] text-slate-600 lg:flex">
              <span>
                {APP_NAME} v{APP_VERSION} · data tersimpan lokal di perangkat Anda (IndexedDB)
              </span>
              <OfflineBadge />
            </footer>
          </div>
          <MobileNav />
        </main>
      </div>
    </div>
  );
}

function PageHeader() {
  const { page } = useUI();
  const current = NAV.find((n) => n.id === page);
  if (!current) return null;
  return (
    <div className="no-print mb-4 flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-base-850 text-mint-400">
        <Icon name={current.icon} size={19} />
      </span>
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-50">{current.label}</h1>
        <p className="text-xs text-slate-500">{current.hint}</p>
      </div>
    </div>
  );
}

function OfflineBadge() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        offline ? "border-mint-500/30 bg-mint-500/10 text-mint-300" : "border-line bg-base-800 text-slate-400",
      )}
    >
      <Icon name={offline ? "cloudOff" : "shield"} size={12} />
      {offline ? "Offline · semua fitur tetap berfungsi" : "Siap digunakan offline"}
    </span>
  );
}

function Sidebar() {
  const { page, navigate } = useUI();
  const { balance, transactions } = useApp();
  return (
    <aside className="no-print sticky top-0 hidden h-screen flex-col border-r border-line bg-base-900/60 px-3 py-5 lg:flex">
      <div className="flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mint-500/15 text-mint-400">
          <Icon name="wallet" size={20} />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-50">{APP_NAME}</p>
          <p className="text-[11px] text-slate-500">Keuangan pribadi offline</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-gradient-to-br from-base-800 to-base-850 p-3.5">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Saldo saat ini</p>
        <Money value={balance} className="mt-1 block text-lg font-semibold" />
        <p className="mt-1 text-[11px] text-slate-500">{formatNumber(transactions.length)} transaksi tersimpan</p>
      </div>

      <nav className="mt-4 flex-1 space-y-1">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => navigate(n.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
              page === n.id
                ? "bg-mint-500/12 font-medium text-mint-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]"
                : "text-slate-400 hover:bg-base-800 hover:text-slate-200",
            )}
          >
            <Icon name={n.icon} size={18} />
            <span className="flex-1 text-left">{n.label}</span>
            {page === n.id && <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />}
          </button>
        ))}
      </nav>

      <OfflineBadge />
    </aside>
  );
}

function MobileHeader() {
  const { balance } = useApp();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-base-950/90 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-500/15 text-mint-400">
            <Icon name="wallet" size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-50">{APP_NAME}</p>
            <p className="text-[10px] text-slate-500">offline · data lokal</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Saldo</p>
          <Money value={balance} className="text-sm font-semibold" />
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  const { page, navigate, openTransactionForm } = useUI();
  const [sheet, setSheet] = useState(false);
  return (
    <>
      {sheet && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" onClick={() => setSheet(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="anim-pop absolute inset-x-4 bottom-24 space-y-2 rounded-2xl border border-line bg-base-850 p-3">
            <p className="px-1 pb-1 text-xs font-medium text-slate-400">Catat transaksi baru</p>
            <Button variant="primary" className="w-full justify-start" onClick={() => { setSheet(false); openTransactionForm({ type: "income" }); }}>
              <Icon name="plus" size={16} /> Tambah Pemasukan
            </Button>
            <Button variant="expense" className="w-full justify-start" onClick={() => { setSheet(false); openTransactionForm({ type: "expense" }); }}>
              <Icon name="minus" size={16} /> Tambah Pengeluaran
            </Button>
          </div>
        </div>
      )}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-base-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch">
          {NAV.slice(0, 2).map((n) => (
            <NavButton key={n.id} n={n} active={page === n.id} onClick={() => navigate(n.id)} />
          ))}
          <button
            onClick={() => setSheet((v) => !v)}
            className="-mt-5 flex w-16 shrink-0 flex-col items-center justify-start"
            aria-label="Tambah transaksi"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-500 text-base-950 shadow-lg shadow-mint-500/25 transition-transform active:scale-95">
              <Icon name={sheet ? "close" : "plus"} size={22} />
            </span>
            <span className="mt-0.5 text-[10px] text-slate-500">Catat</span>
          </button>
          {NAV.slice(2).map((n) => (
            <NavButton key={n.id} n={n} active={page === n.id} onClick={() => navigate(n.id)} />
          ))}
        </div>
      </nav>
    </>
  );
}

function NavButton({
  n,
  active,
  onClick,
}: {
  n: { id: Page; label: string; icon: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-1/4 flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
        active ? "text-mint-300" : "text-slate-500",
      )}
    >
      <Icon name={n.icon} size={19} />
      {n.label}
    </button>
  );
}

function FatalErrorScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-base-950/95 p-4">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-base-850 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-450">
            <Icon name="warning" size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-50">Penyimpanan lokal bermasalah</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{message}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              DompetKu tidak pernah mengirim data Anda ke server, sehingga tidak ada salinan di tempat lain. Bila Anda
              memiliki berkas backup JSON, data dapat dipulihkan setelah penyimpanan dapat diakses kembali.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <Icon name="refresh" size={16} /> Muat ulang
          </Button>
        </div>
      </div>
    </div>
  );
}

function Onboarding() {
  const { completeOnboarding, notify } = useApp();
  const [value, setValue] = useState("0");
  const [saving, setSaving] = useState(false);

  async function finish(withBalance: boolean) {
    setSaving(true);
    const parsed = withBalance ? (parseAmount(value) ?? 0) : 0;
    try {
      await completeOnboarding(parsed);
      notify({
        type: "success",
        title: "Selamat datang di DompetKu",
        message: withBalance ? `Saldo awal ${formatNumber(parsed)} tersimpan.` : "Saldo awal Rp0. Mulailah mencatat transaksi.",
      });
    } catch (err) {
      notify({ type: "error", title: "Gagal menyimpan", message: err instanceof Error ? err.message : "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-base-950/90 backdrop-blur-sm" />
      <div className="anim-pop relative z-10 max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-base-850 p-5 sm:rounded-2xl sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-500/15 text-mint-400">
            <Icon name="wallet" size={22} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-50">Selamat datang di {APP_NAME}</h2>
            <p className="text-xs text-slate-500">Pencatatan keuangan pribadi · 100% offline</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-400">
          <li className="flex gap-2">
            <Icon name="check" size={14} className="mt-0.5 shrink-0 text-mint-400" />
            Catat uang masuk dan uang keluar dengan kategori yang bisa Anda atur sendiri.
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={14} className="mt-0.5 shrink-0 text-mint-400" />
            Saldo, grafik, serta laporan harian, mingguan, dan bulanan dihitung otomatis.
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={14} className="mt-0.5 shrink-0 text-mint-400" />
            Semua data disimpan di perangkat Anda (IndexedDB). Tidak perlu akun, tidak perlu internet.
          </li>
        </ul>

        <div className="mt-5 rounded-2xl border border-line bg-base-900/60 p-4">
          <p className="text-sm font-medium text-slate-200">Atur saldo awal</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Saldo awal adalah jumlah uang yang Anda miliki saat ini, sebelum mulai mencatat. Nilai ini{" "}
            <b className="text-slate-300">tidak dihitung sebagai pemasukan</b> agar laporan tidak dobel. Anda bisa
            mengubahnya nanti di menu Pengaturan.
          </p>
          <div className="mt-3">
            <MoneyInput value={value} onChange={setValue} />
          </div>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={saving} onClick={() => finish(false)}>
            Mulai dari Rp0
          </Button>
          <Button variant="primary" loading={saving} onClick={() => finish(true)}>
            <Icon name="check" size={16} /> Simpan dan mulai
          </Button>
        </div>
      </div>
    </div>
  );
}
