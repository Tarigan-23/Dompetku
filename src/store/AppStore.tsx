import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  SETTINGS_KEY,
  buildBackup,
  createId,
  db,
  initDatabase,
  normalizeCategory,
  normalizeSettings,
  normalizeTransaction,
  parseBackup,
  resetDatabase,
  type BackupFile,
} from "@/db/db";
import { DEFAULT_SETTINGS, type Category, type Settings, type Transaction, type TxType } from "@/lib/types";
import { isValidISODate, isValidTime } from "@/lib/date";

export interface Toast {
  id: number;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
}

export interface TransactionInput {
  type: TxType;
  amount: number;
  categoryId: string;
  date: string;
  time?: string;
  note?: string;
}

export type RestoreMode = "replace" | "merge";

interface AppContextValue {
  ready: boolean;
  fatalError: string | null;
  transactions: Transaction[];
  categories: Category[];
  settings: Settings;
  balance: number;
  toasts: Toast[];
  notify: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  addTransaction: (input: TransactionInput) => Promise<Transaction>;
  updateTransaction: (uid: string, input: TransactionInput) => Promise<void>;
  deleteTransaction: (uid: string) => Promise<void>;
  getTransaction: (uid: string) => Transaction | undefined;
  categoryById: (uid: string) => Category | undefined;
  categoryUsage: (uid: string) => number;
  saveCategory: (input: Partial<Category> & { type: TxType; name: string }) => Promise<Category>;
  setCategoryArchived: (uid: string, archived: boolean) => Promise<void>;
  deleteCategory: (uid: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  completeOnboarding: (initialBalance: number) => Promise<void>;
  exportBackup: () => BackupFile;
  restoreBackup: (text: string, mode: RestoreMode) => Promise<{ added: number; skipped: number }>;
  wipeAllData: () => Promise<void>;
  reload: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);
  /** tanda tangan transaksi terakhir — mencegah penyimpanan ganda */
  const lastSignature = useRef<{ sig: string; at: number }>({ sig: "", at: 0 });

  const notify = useCallback((t: Omit<Toast, "id">) => {
    const id = toastId.current++;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, t.type === "error" ? 6000 : 3600);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const load = useCallback(async () => {
    await initDatabase();
    const [txs, cats, settingRow] = await Promise.all([
      db.transactions.toArray(),
      db.categories.toArray(),
      db.settings.get(SETTINGS_KEY),
    ]);
    setTransactions(
      txs
        .map((t) => normalizeTransaction(t))
        .filter((t): t is Transaction => t !== null),
    );
    setCategories(
      cats
        .map((c) => normalizeCategory(c))
        .filter((c): c is Category => c !== null)
        .sort((a, b) => a.type.localeCompare(b.type) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    );
    setSettings(normalizeSettings(settingRow?.value));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setFatalError(
            err instanceof Error
              ? `Penyimpanan lokal tidak dapat dibuka: ${err.message}. Data Anda tidak dihapus. Coba muat ulang halaman atau gunakan browser lain.`
              : "Penyimpanan lokal tidak dapat dibuka.",
          );
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  /* --------------------------- Transaksi --------------------------- */

  const validateInput = useCallback((input: TransactionInput): string | null => {
    if (input.type !== "income" && input.type !== "expense") return "Jenis transaksi tidak valid.";
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) return "Nominal harus berupa angka lebih dari 0.";
    if (input.amount > 9_999_999_999) return "Nominal terlalu besar.";
    if (!input.categoryId) return "Kategori wajib dipilih.";
    if (!isValidISODate(input.date)) return "Tanggal transaksi tidak valid.";
    if (input.time && !isValidTime(input.time)) return "Waktu transaksi tidak valid.";
    return null;
  }, []);

  const addTransaction = useCallback(
    async (input: TransactionInput) => {
      const invalid = validateInput(input);
      if (invalid) throw new Error(invalid);
      const sig = `${input.type}|${input.amount}|${input.categoryId}|${input.date}|${input.time ?? ""}|${input.note ?? ""}`;
      const now = Date.now();
      if (lastSignature.current.sig === sig && now - lastSignature.current.at < 2500) {
        throw new Error("Transaksi yang sama baru saja disimpan. Data tidak diduplikasi.");
      }
      const tx: Transaction = normalizeTransaction({
        uid: createId("tx"),
        type: input.type,
        amount: input.amount,
        categoryId: input.categoryId,
        date: input.date,
        time: input.time ?? "",
        note: (input.note ?? "").trim(),
        createdAt: now,
        updatedAt: now,
      }) as Transaction;
      try {
        await db.transactions.add(tx);
      } catch (err) {
        console.error(err);
        throw new Error("Gagal menyimpan transaksi ke penyimpanan lokal. Perubahan tidak diterapkan.");
      }
      lastSignature.current = { sig, at: now };
      setTransactions((prev) => [...prev, tx]);
      return tx;
    },
    [validateInput],
  );

  const updateTransaction = useCallback(
    async (uid: string, input: TransactionInput) => {
      const invalid = validateInput(input);
      if (invalid) throw new Error(invalid);
      const existing = await db.transactions.get(uid);
      if (!existing) throw new Error("Transaksi tidak ditemukan.");
      const updated: Transaction = {
        ...existing,
        type: input.type,
        amount: input.amount,
        categoryId: input.categoryId,
        date: input.date,
        time: input.time ?? "",
        note: (input.note ?? "").trim(),
        updatedAt: Date.now(),
      };
      try {
        await db.transactions.put(updated);
      } catch (err) {
        console.error(err);
        throw new Error("Gagal menyimpan perubahan transaksi.");
      }
      setTransactions((prev) => prev.map((t) => (t.uid === uid ? updated : t)));
    },
    [validateInput],
  );

  const deleteTransaction = useCallback(async (uid: string) => {
    try {
      await db.transactions.delete(uid);
    } catch (err) {
      console.error(err);
      throw new Error("Gagal menghapus transaksi dari penyimpanan lokal.");
    }
    setTransactions((prev) => prev.filter((t) => t.uid !== uid));
  }, []);

  const getTransaction = useCallback((uid: string) => transactions.find((t) => t.uid === uid), [transactions]);

  /* ---------------------------- Kategori --------------------------- */

  const categoryById = useCallback(
    (uid: string) => categories.find((c) => c.uid === uid),
    [categories],
  );

  const categoryUsage = useCallback(
    (uid: string) => transactions.filter((t) => t.categoryId === uid).length,
    [transactions],
  );

  const saveCategory = useCallback(
    async (input: Partial<Category> & { type: TxType; name: string }) => {
      const name = input.name.trim();
      if (!name) throw new Error("Nama kategori wajib diisi.");
      if (name.length > 40) throw new Error("Nama kategori maksimal 40 karakter.");
      const duplicate = categories.find(
        (c) => c.type === input.type && c.name.toLowerCase() === name.toLowerCase() && c.uid !== input.uid,
      );
      if (duplicate) throw new Error(`Kategori "${name}" sudah ada. Gunakan nama lain.`);
      const base = input.uid ? categories.find((c) => c.uid === input.uid) : undefined;
      if (input.uid && !base) throw new Error("Kategori tidak ditemukan.");
      const record: Category = {
        uid: base?.uid ?? createId("cat"),
        type: input.type,
        name,
        icon: input.icon ?? base?.icon ?? "📦",
        color: input.color ?? base?.color ?? "#34d399",
        archived: input.archived ?? base?.archived ?? false,
        sortOrder: input.sortOrder ?? base?.sortOrder ?? categories.length + 1,
        createdAt: base?.createdAt ?? Date.now(),
      };
      try {
        await db.categories.put(record);
      } catch (err) {
        console.error(err);
        throw new Error("Gagal menyimpan kategori.");
      }
      setCategories((prev) => {
        const next = prev.filter((c) => c.uid !== record.uid);
        return [...next, record].sort(
          (a, b) => a.type.localeCompare(b.type) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );
      });
      return record;
    },
    [categories],
  );

  const setCategoryArchived = useCallback(async (uid: string, archived: boolean) => {
    const existing = await db.categories.get(uid);
    if (!existing) throw new Error("Kategori tidak ditemukan.");
    const updated = { ...existing, archived };
    try {
      await db.categories.put(updated);
    } catch (err) {
      console.error(err);
      throw new Error("Gagal memperbarui kategori.");
    }
    setCategories((prev) => prev.map((c) => (c.uid === uid ? updated : c)).sort((a, b) => a.type.localeCompare(b.type) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
  }, []);

  const deleteCategory = useCallback(
    async (uid: string) => {
      const used = transactions.filter((t) => t.categoryId === uid).length;
      if (used > 0) {
        throw new Error(
          `Kategori masih dipakai ${used} transaksi. Arsipkan kategori ini atau pindahkan transaksinya terlebih dahulu agar laporan tetap utuh.`,
        );
      }
      try {
        await db.categories.delete(uid);
      } catch (err) {
        console.error(err);
        throw new Error("Gagal menghapus kategori.");
      }
      setCategories((prev) => prev.filter((c) => c.uid !== uid));
    },
    [transactions],
  );

  /* --------------------------- Pengaturan -------------------------- */

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next: Settings = normalizeSettings({ ...settings, ...patch, updatedAt: Date.now() });
    try {
      await db.settings.put({ key: SETTINGS_KEY, value: next });
    } catch (err) {
      console.error(err);
      throw new Error("Gagal menyimpan pengaturan.");
    }
    setSettings(next);
  }, [settings]);

  const completeOnboarding = useCallback(
    async (initialBalance: number) => {
      await updateSettings({ onboarded: true, initialBalance });
    },
    [updateSettings],
  );

  /* ------------------------ Backup & restore ----------------------- */

  const exportBackup = useCallback(
    () => buildBackup(settings, categories, transactions),
    [settings, categories, transactions],
  );

  const restoreBackup = useCallback(
    async (text: string, mode: RestoreMode) => {
      const parsed = parseBackup(text);
      if (mode === "replace") {
        // onboarding tidak perlu diulang setelah pemulihan data
        const restored = { ...parsed.settings, onboarded: true };
        await db.transaction("rw", db.transactions, db.categories, db.settings, async () => {
          await db.transactions.clear();
          await db.categories.clear();
          await db.categories.bulkPut(parsed.categories);
          await db.transactions.bulkPut(parsed.transactions);
          await db.settings.put({ key: SETTINGS_KEY, value: restored });
        });
        setCategories(
          [...parsed.categories].sort(
            (a, b) => a.type.localeCompare(b.type) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
          ),
        );
        setTransactions(parsed.transactions);
        setSettings(restored);
        return { added: parsed.transactions.length, skipped: parsed.skipped };
      }
      // mode gabung: tambah data baru, timpa data dengan uid sama
      const existingTxUids = new Set(transactions.map((t) => t.uid));
      const existingCatUids = new Set(categories.map((c) => c.uid));
      const catsToPut = parsed.categories.filter((c) => !existingCatUids.has(c.uid));
      const txsToPut = parsed.transactions;
      await db.transaction("rw", db.transactions, db.categories, async () => {
        await db.categories.bulkPut(catsToPut);
        await db.transactions.bulkPut(txsToPut);
      });
      setCategories((prev) => {
        const map = new Map(prev.map((c) => [c.uid, c]));
        for (const c of parsed.categories) map.set(c.uid, c);
        return [...map.values()].sort(
          (a, b) => a.type.localeCompare(b.type) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );
      });
      setTransactions((prev) => {
        const map = new Map(prev.map((t) => [t.uid, t]));
        for (const t of parsed.transactions) map.set(t.uid, t);
        return [...map.values()];
      });
      const addedNew = txsToPut.filter((t) => !existingTxUids.has(t.uid)).length;
      return { added: addedNew, skipped: parsed.skipped };
    },
    [categories, transactions],
  );

  const wipeAllData = useCallback(async () => {
    await resetDatabase();
    await load();
  }, [load]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const balance = useMemo(
    () => settings.initialBalance + transactions.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0),
    [settings.initialBalance, transactions],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      fatalError,
      transactions,
      categories,
      settings,
      balance,
      toasts,
      notify,
      dismissToast,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      getTransaction,
      categoryById,
      categoryUsage,
      saveCategory,
      setCategoryArchived,
      deleteCategory,
      updateSettings,
      completeOnboarding,
      exportBackup,
      restoreBackup,
      wipeAllData,
      reload,
    }),
    [
      ready,
      fatalError,
      transactions,
      categories,
      settings,
      balance,
      toasts,
      notify,
      dismissToast,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      getTransaction,
      categoryById,
      categoryUsage,
      saveCategory,
      setCategoryArchived,
      deleteCategory,
      updateSettings,
      completeOnboarding,
      exportBackup,
      restoreBackup,
      wipeAllData,
      reload,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp harus dipakai di dalam AppProvider");
  return ctx;
}
