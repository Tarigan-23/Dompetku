import { useEffect, useMemo, useState } from "react";
import { Button, Field, MoneyInput, Modal, Money, Textarea, TextInput } from "./ui";
import { COLOR_PALETTE, EMOJI_PALETTE, Icon } from "@/lib/icons";
import { parseAmount, validateAmount, formatNumber } from "@/lib/money";
import { nowTime, todayISO } from "@/lib/date";
import { useApp } from "@/store/AppStore";
import type { Transaction, TxType } from "@/lib/types";
import { cn } from "@/utils/cn";

const QUICK_AMOUNTS = [10_000, 25_000, 50_000, 100_000];

export function TransactionForm({
  open,
  onClose,
  initial,
  defaultType = "expense",
}: {
  open: boolean;
  onClose: () => void;
  initial?: Transaction;
  defaultType?: TxType;
}) {
  const { categories, addTransaction, updateTransaction, notify, saveCategory } = useApp();
  const [type, setType] = useState<TxType>(defaultType);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📦");
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);
  const [catError, setCatError] = useState<string | null>(null);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.type === type && (!c.archived || c.uid === categoryId)),
    [categories, type, categoryId],
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setType(initial.type);
      setAmount(formatNumber(initial.amount));
      setCategoryId(initial.categoryId);
      setDate(initial.date);
      setTime(initial.time);
      setNote(initial.note);
    } else {
      setType(defaultType);
      setAmount("");
      setNote("");
      setDate(todayISO());
      setTime(nowTime());
    }
    setErrors({});
    setShowNewCat(false);
    setNewCatName("");
    setCatError(null);
  }, [open, initial, defaultType]);

  useEffect(() => {
    if (!categoryId) return;
    const cat = categories.find((c) => c.uid === categoryId);
    if (cat && cat.type !== type) setCategoryId("");
  }, [type, categoryId, categories]);

  const selected = categories.find((c) => c.uid === categoryId);

  async function handleSave() {
    const nextErrors: Record<string, string> = {};
    const amountError = validateAmount(amount);
    if (amountError) nextErrors.amount = amountError;
    if (!categoryId) nextErrors.categoryId = "Pilih kategori terlebih dahulu.";
    if (!date) nextErrors.date = "Tanggal wajib diisi.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const parsed = parseAmount(amount)!;
    setSaving(true);
    try {
      if (initial) {
        await updateTransaction(initial.uid, { type, amount: parsed, categoryId, date, time, note });
        notify({ type: "success", title: "Transaksi diperbarui", message: "Saldo dan laporan sudah dihitung ulang." });
      } else {
        await addTransaction({ type, amount: parsed, categoryId, date, time, note });
        notify({
          type: "success",
          title: type === "income" ? "Pemasukan dicatat" : "Pengeluaran dicatat",
          message: `Rp${formatNumber(parsed)} · ${selected?.name ?? "-"}`,
        });
      }
      onClose();
    } catch (err) {
      notify({
        type: "error",
        title: "Gagal menyimpan",
        message: err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCategory() {
    setCatError(null);
    if (!newCatName.trim()) {
      setCatError("Nama kategori wajib diisi.");
      return;
    }
    try {
      const created = await saveCategory({ type, name: newCatName, icon: newCatIcon, color: newCatColor });
      setCategoryId(created.uid);
      setShowNewCat(false);
      setNewCatName("");
      notify({ type: "success", title: "Kategori baru dibuat", message: created.name });
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Gagal membuat kategori.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Transaksi" : type === "income" ? "Tambah Pemasukan" : "Tambah Pengeluaran"}
      subtitle={
        initial
          ? "Perubahan langsung memperbarui saldo, statistik, dan laporan."
          : "Data disimpan di perangkat Anda, tanpa koneksi internet."
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button variant={type === "income" ? "primary" : "expense"} loading={saving} onClick={handleSave}>
            <Icon name="save" size={16} />
            {saving ? "Menyimpan…" : initial ? "Simpan Perubahan" : "Simpan Transaksi"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Jenis transaksi */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-base-900/60 p-1">
          {(["expense", "income"] as TxType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
                type === t
                  ? t === "income"
                    ? "bg-mint-500/15 text-mint-300 shadow-[0_0_0_1px_rgba(16,185,129,0.4)_inset]"
                    : "bg-flame-500/15 text-flame-400 shadow-[0_0_0_1px_rgba(249,115,22,0.4)_inset]"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              <Icon name={t === "income" ? "arrowDown" : "arrowUp"} size={16} />
              {t === "income" ? "Uang Masuk" : "Uang Keluar"}
            </button>
          ))}
        </div>

        <Field label="Jumlah uang" required error={errors.amount}>
          <MoneyInput value={amount} onChange={setAmount} invalid={Boolean(errors.amount)} autoFocus={!initial} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(formatNumber(q))}
                className="rounded-lg border border-line bg-base-800/70 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-mint-500/50 hover:text-mint-300"
              >
                {formatNumber(q)}
              </button>
            ))}
            {amount && (
              <button
                type="button"
                onClick={() => setAmount("")}
                className="rounded-lg px-2.5 py-1 text-[11px] text-slate-500 transition-colors hover:text-rose-450"
              >
                Hapus
              </button>
            )}
          </div>
        </Field>

        <Field label="Kategori" required error={errors.categoryId}>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {activeCategories.map((c) => (
              <button
                key={c.uid}
                type="button"
                onClick={() => setCategoryId(c.uid)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition-all",
                  categoryId === c.uid
                    ? "border-mint-500/60 bg-mint-500/10 text-slate-100"
                    : "border-line bg-base-900/60 text-slate-300 hover:border-base-600",
                )}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                  style={{ background: `color-mix(in srgb, ${c.color} 20%, transparent)` }}
                >
                  {c.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                {c.archived && <span className="text-[10px] text-slate-500">(arsip)</span>}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNewCat((v) => !v)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-base-600 px-2.5 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-mint-500/50 hover:text-mint-300"
            >
              <Icon name="plus" size={13} /> Kategori baru
            </button>
          </div>
        </Field>

        {showNewCat && (
          <div className="anim-fade-up space-y-3 rounded-xl border border-mint-500/25 bg-mint-500/5 p-3">
            <Field label={`Nama kategori ${type === "income" ? "pemasukan" : "pengeluaran"} baru`} error={catError}>
              <TextInput
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={type === "income" ? "Contoh: Dividen" : "Contoh: Biaya admin bank"}
                maxLength={40}
              />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-300">Ikon</p>
              <div className="no-scrollbar flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                {EMOJI_PALETTE.slice(0, 32).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewCatIcon(e)}
                    className={cn(
                      "h-8 w-8 rounded-lg border text-base transition-all",
                      newCatIcon === e ? "border-mint-500 bg-mint-500/15" : "border-line bg-base-900/60 hover:border-base-600",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-300">Warna</p>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNewCatColor(col)}
                    style={{ background: col }}
                    className={cn(
                      "h-6 w-6 rounded-full transition-transform",
                      newCatColor === col ? "ring-2 ring-white/70 ring-offset-2 ring-offset-base-850" : "",
                    )}
                    aria-label={`Warna ${col}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNewCat(false)}>
                Batal
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateCategory}>
                <Icon name="plus" size={14} /> Buat kategori
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal" required error={errors.date}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Waktu (opsional)">
            <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <Field label="Catatan (opsional)" hint="Maksimal 300 karakter. Catatan bisa dicari di halaman Transaksi.">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder={type === "income" ? "Contoh: Gaji bulan ke-8 ditransfer" : "Contoh: Isi penuh SPBU dekat kantor"}
          />
        </Field>

        {amount && parseAmount(amount) ? (
          <div className="rounded-xl border border-line bg-base-900/70 px-3 py-2.5 text-xs text-slate-400">
            Akan dicatat sebagai{" "}
            <span className={type === "income" ? "font-medium text-mint-400" : "font-medium text-flame-400"}>
              {type === "income" ? "pemasukan" : "pengeluaran"}
            </span>{" "}
            sebesar <Money value={parseAmount(amount)!} className="font-semibold" />
            {selected ? ` pada kategori ${selected.icon} ${selected.name}.` : "."}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}


