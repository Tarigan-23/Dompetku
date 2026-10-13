import { useMemo, useState } from "react";
import { Badge, Button, ConfirmDialog, Field, Modal, Segmented, TextInput } from "./ui";
import { COLOR_PALETTE, EMOJI_PALETTE, Icon } from "@/lib/icons";
import { useApp } from "@/store/AppStore";
import type { Category, TxType } from "@/lib/types";
import { cn } from "@/utils/cn";
import { formatRupiah } from "@/lib/money";

interface Draft {
  uid?: string;
  name: string;
  icon: string;
  color: string;
  archived: boolean;
}

const EMPTY_DRAFT: Draft = { name: "", icon: "📦", color: COLOR_PALETTE[0], archived: false };

export function CategoryManager({
  open,
  onClose,
  initialType = "expense",
}: {
  open: boolean;
  onClose: () => void;
  initialType?: TxType;
}) {
  const { categories, transactions, saveCategory, setCategoryArchived, deleteCategory, notify } = useApp();
  const [type, setType] = useState<TxType>(initialType);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  const list = useMemo(
    () => categories.filter((c) => c.type === type).sort((a, b) => Number(a.archived) - Number(b.archived) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories, type],
  );

  const totalsByCategory = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const t of transactions) {
      const e = map.get(t.categoryId) ?? { total: 0, count: 0 };
      e.total += t.type === "income" ? t.amount : -t.amount;
      e.count += 1;
      map.set(t.categoryId, e);
    }
    return map;
  }, [transactions]);

  function startCreate() {
    setError(null);
    setDraft({ ...EMPTY_DRAFT, color: type === "income" ? COLOR_PALETTE[0] : COLOR_PALETTE[11] });
  }

  async function submitDraft() {
    if (!draft) return;
    setError(null);
    if (!draft.name.trim()) {
      setError("Nama kategori wajib diisi.");
      return;
    }
    try {
      await saveCategory({
        uid: draft.uid,
        type,
        name: draft.name,
        icon: draft.icon,
        color: draft.color,
        archived: draft.archived,
      });
      notify({
        type: "success",
        title: draft.uid ? "Kategori diperbarui" : "Kategori dibuat",
        message: `${draft.icon} ${draft.name}`,
      });
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan kategori.");
    }
  }

  async function handleDelete(cat: Category) {
    try {
      await deleteCategory(cat.uid);
      notify({ type: "success", title: "Kategori dihapus", message: cat.name });
    } catch (err) {
      notify({
        type: "error",
        title: "Kategori tidak dapat dihapus",
        message: err instanceof Error ? err.message : "Terjadi kesalahan.",
      });
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title="Kelola Kategori"
        subtitle="Buat kategori sendiri, ganti nama, ubah ikon dan warna, arsipkan, atau hapus."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-500">
              Kategori yang diarsipkan tidak muncul di form transaksi, tetapi tetap tampil di laporan lama.
            </p>
            <Button variant="primary" size="sm" onClick={startCreate}>
              <Icon name="plus" size={14} /> Kategori Baru
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Segmented
            value={type}
            onChange={(v) => {
              setType(v);
              setDraft(null);
              setError(null);
            }}
            options={[
              { value: "expense" as TxType, label: "Kategori Pengeluaran" },
              { value: "income" as TxType, label: "Kategori Pemasukan" },
            ]}
            className="w-full"
          />

          {draft && (
            <div className="anim-fade-up space-y-3 rounded-xl border border-mint-500/25 bg-mint-500/5 p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-mint-300">
                  {draft.uid ? "Ubah kategori" : "Kategori baru"}
                </p>
                <button
                  onClick={() => setDraft(null)}
                  className="rounded p-1 text-slate-400 hover:text-slate-100"
                  aria-label="Tutup form kategori"
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Nama kategori" error={error}>
                  <TextInput
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 40) })}
                    placeholder={type === "income" ? "Contoh: Dividen saham" : "Contoh: Biaya admin bank"}
                    autoFocus
                  />
                </Field>
                <div className="flex items-end">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl border text-xl"
                    style={{
                      background: `color-mix(in srgb, ${draft.color} 20%, transparent)`,
                      borderColor: `color-mix(in srgb, ${draft.color} 40%, transparent)`,
                    }}
                  >
                    {draft.icon}
                  </span>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-300">Ikon kategori</p>
                <div className="no-scrollbar flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-xl border border-line bg-base-900/50 p-2">
                  {EMOJI_PALETTE.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setDraft({ ...draft, icon: e })}
                      className={cn(
                        "h-8 w-8 rounded-lg border text-base transition-all",
                        draft.icon === e ? "border-mint-500 bg-mint-500/15" : "border-line hover:border-base-600",
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
                      onClick={() => setDraft({ ...draft, color: col })}
                      style={{ background: col }}
                      className={cn(
                        "h-6 w-6 rounded-full transition-transform",
                        draft.color === col && "ring-2 ring-white/70 ring-offset-2 ring-offset-base-850",
                      )}
                      aria-label={`Warna ${col}`}
                    />
                  ))}
                </div>
              </div>
              {draft.uid && (
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={draft.archived}
                    onChange={(e) => setDraft({ ...draft, archived: e.target.checked })}
                    className="h-4 w-4 accent-mint-500"
                  />
                  Arsipkan kategori ini (tidak tampil di form transaksi)
                </label>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                  Batal
                </Button>
                <Button variant="primary" size="sm" onClick={submitDraft}>
                  <Icon name="save" size={14} /> Simpan
                </Button>
              </div>
            </div>
          )}

          <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line">
            {list.map((c) => {
              const stat = totalsByCategory.get(c.uid);
              return (
                <li key={c.uid} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base"
                    style={{
                      background: `color-mix(in srgb, ${c.color} 18%, transparent)`,
                      borderColor: `color-mix(in srgb, ${c.color} 35%, transparent)`,
                    }}
                  >
                    {c.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-100">{c.name}</p>
                      {c.archived && <Badge tone="warn">Diarsipkan</Badge>}
                      {stat && stat.count > 0 && (
                        <Badge tone={c.type === "income" ? "income" : "expense"}>
                          {stat.count} transaksi · {formatRupiah(Math.abs(stat.total))}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {stat && stat.count > 0
                        ? c.type === "income"
                          ? "Total pemasukan tercatat"
                          : "Total pengeluaran tercatat"
                        : "Belum pernah dipakai"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => {
                        setError(null);
                        setDraft({ uid: c.uid, name: c.name, icon: c.icon, color: c.color, archived: c.archived });
                      }}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-base-700 hover:text-mint-300"
                      title="Ubah nama, ikon, atau warna"
                      aria-label="Ubah kategori"
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      onClick={() => setCategoryArchived(c.uid, !c.archived).catch(() => notify({ type: "error", title: "Gagal mengarsipkan kategori" }))}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-base-700 hover:text-amber-300"
                      title={c.archived ? "Aktifkan kembali kategori" : "Arsipkan kategori"}
                      aria-label={c.archived ? "Aktifkan kembali" : "Arsipkan"}
                    >
                      <Icon name="archive" size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-base-700 hover:text-rose-450"
                      title="Hapus kategori"
                      aria-label="Hapus kategori"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-slate-500">Belum ada kategori pada jenis ini.</li>
            )}
          </ul>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Hapus kategori?"
        message={
          confirmDelete ? (
            <>
              Kategori <span className="font-medium text-slate-100">{confirmDelete.icon} {confirmDelete.name}</span> akan
              dihapus permanen.
              {(totalsByCategory.get(confirmDelete.uid)?.count ?? 0) > 0 ? (
                <span className="mt-2 block text-amber-300">
                  Kategori ini masih dipakai {totalsByCategory.get(confirmDelete.uid)?.count} transaksi. Untuk menjaga
                  riwayat laporan, arsipkan kategori ini alih-alih menghapusnya.
                </span>
              ) : (
                <span className="mt-2 block text-slate-400">
                  Kategori ini belum dipakai transaksi mana pun, jadi aman untuk dihapus.
                </span>
              )}
            </>
          ) : null
        }
        confirmLabel="Hapus Kategori"
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />
    </>
  );
}
