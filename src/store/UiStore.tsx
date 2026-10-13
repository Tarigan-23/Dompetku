import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CategoryManager } from "@/components/CategoryManager";
import { TransactionForm } from "@/components/TransactionForm";
import { ConfirmDialog } from "@/components/ui";
import { useApp } from "@/store/AppStore";
import type { Transaction, TxType } from "@/lib/types";

export type Page = "dashboard" | "transactions" | "reports" | "settings";

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireText?: string;
}

interface UiContextValue {
  page: Page;
  navigate: (page: Page) => void;
  openTransactionForm: (opts?: { initial?: Transaction; type?: TxType }) => void;
  openCategoryManager: (type?: TxType) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  deleteTransaction: (tx: Transaction) => Promise<void>;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const { deleteTransaction: doDelete, notify, settings } = useApp();
  const [page, setPage] = useState<Page>("dashboard");
  const [formState, setFormState] = useState<{ open: boolean; initial?: Transaction; type: TxType }>({
    open: false,
    type: "expense",
  });
  const [categoryState, setCategoryState] = useState<{ open: boolean; type: TxType }>({
    open: false,
    type: "expense",
  });
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);

  const navigate = useCallback(
    (next: Page) => {
      setPage(next);
      window.scrollTo({ top: 0, behavior: settings.reduceMotion ? "auto" : "smooth" });
    },
    [settings.reduceMotion],
  );

  const openTransactionForm = useCallback((opts?: { initial?: Transaction; type?: TxType }) => {
    setFormState({ open: true, initial: opts?.initial, type: opts?.initial?.type ?? opts?.type ?? "expense" });
  }, []);

  const openCategoryManager = useCallback((type: TxType = "expense") => {
    setCategoryState({ open: true, type });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  const deleteTransaction = useCallback(
    async (tx: Transaction) => {
      const ok = await confirm({
        title: "Hapus transaksi?",
        message: (
          <>
            Transaksi sebesar{" "}
            <span className={tx.type === "income" ? "font-medium text-mint-400" : "font-medium text-flame-400"}>
              Rp{new Intl.NumberFormat("id-ID").format(tx.amount)}
            </span>{" "}
            pada tanggal {tx.date.split("-").reverse().join("/")} akan dihapus permanen. Saldo, grafik, dan seluruh
            laporan akan dihitung ulang.
          </>
        ),
        confirmLabel: "Hapus Transaksi",
      });
      if (!ok) return;
      try {
        await doDelete(tx.uid);
        notify({ type: "success", title: "Transaksi dihapus", message: "Saldo dan laporan diperbarui." });
      } catch (err) {
        notify({
          type: "error",
          title: "Gagal menghapus",
          message: err instanceof Error ? err.message : "Terjadi kesalahan.",
        });
      }
    },
    [confirm, doDelete, notify],
  );

  const value = useMemo<UiContextValue>(
    () => ({ page, navigate, openTransactionForm, openCategoryManager, confirm, deleteTransaction }),
    [page, navigate, openTransactionForm, openCategoryManager, confirm, deleteTransaction],
  );

  return (
    <UiContext.Provider value={value}>
      {children}
      <TransactionForm
        open={formState.open}
        initial={formState.initial}
        defaultType={formState.type}
        onClose={() => setFormState((s) => ({ ...s, open: false }))}
      />
      <CategoryManager
        open={categoryState.open}
        initialType={categoryState.type}
        onClose={() => setCategoryState((s) => ({ ...s, open: false }))}
      />
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? null}
        confirmLabel={confirmState?.confirmLabel}
        requireText={confirmState?.requireText}
        danger={confirmState?.danger !== false}
        onClose={() => {
          confirmState?.resolve(false);
          setConfirmState(null);
        }}
        onConfirm={() => {
          confirmState?.resolve(true);
          setConfirmState(null);
        }}
      />
    </UiContext.Provider>
  );
}

export function useUI(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUI harus dipakai di dalam UiProvider");
  return ctx;
}
