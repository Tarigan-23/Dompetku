import { useMemo, type ReactNode } from "react";
import { CategoryAvatar, Icon } from "@/lib/icons";
import { DAY_NAMES, formatLongDate, formatTimeLabel, parseISODate, sortChronological } from "@/lib/date";
import { Money, EmptyState } from "./ui";
import { useApp } from "@/store/AppStore";
import type { Transaction } from "@/lib/types";
import { cn } from "@/utils/cn";

export function TransactionList({
  transactions,
  onEdit,
  onDelete,
  emptyTitle,
  emptyDescription,
  emptyAction,
  startBalance,
  compact,
}: {
  transactions: Transaction[];
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  emptyTitle: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  /** saldo sebelum transaksi paling awal pada daftar ini */
  startBalance?: number;
  compact?: boolean;
}) {
  const { categoryById, settings } = useApp();

  /** saldo setelah setiap transaksi (dihitung kronologis) */
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (startBalance === undefined) return map;
    let running = startBalance;
    for (const t of sortChronological(transactions, true)) {
      running += t.type === "income" ? t.amount : -t.amount;
      map.set(t.uid, running);
    }
    return map;
  }, [transactions, startBalance]);

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const arr = byDate.get(t.date);
      if (arr) arr.push(t);
      else byDate.set(t.date, [t]);
    }
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [transactions]);

  if (transactions.length === 0) {
    return <EmptyState icon="receipt" title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="divide-y divide-line-soft">
      {groups.map(([date, items]) => {
        const sorted = sortChronological(items, false);
        const income = items.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expense = items.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const parsed = parseISODate(date);
        const isToday = parsed
          ? parsed.y === new Date().getFullYear() &&
            parsed.m === new Date().getMonth() &&
            parsed.d === new Date().getDate()
          : false;
        const dayBalance = balanceMap.get(sorted[0]?.uid ?? "");
        return (
          <div key={date} className="print-keep py-2">
            <div className="flex items-center justify-between gap-3 px-1 py-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  {parsed ? `${DAY_NAMES[new Date(parsed.y, parsed.m, parsed.d).getDay()]}` : ""}
                  {isToday && <span className="ml-1 text-mint-400">· hari ini</span>}
                </span>
                <span className="text-[11px] text-slate-500">{formatLongDate(date).replace(/^[^,]+, /, "")}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {income > 0 && <Money value={income} type="income" className="font-medium" />}
                {expense > 0 && <Money value={-expense} type="expense" className="font-medium" />}
                {dayBalance !== undefined && startBalance !== undefined && (
                  <span className="hidden rounded-md border border-line bg-base-800/70 px-1.5 py-0.5 text-slate-400 sm:inline">
                    saldo <Money value={dayBalance} className="font-medium" />
                  </span>
                )}
              </div>
            </div>
            <ul className={cn("space-y-0.5", compact && "space-y-0")}>
              {sorted.map((t) => {
                const cat = categoryById(t.categoryId);
                return (
                  <li key={t.uid}>
                    <div className="group flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-base-800/70">
                      <CategoryAvatar icon={cat?.icon ?? "📦"} color={cat?.color ?? "#94a3b8"} size={compact ? 34 : 38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-100">{cat?.name ?? "Kategori terhapus"}</p>
                          {t.time && (
                            <span className="shrink-0 font-mono text-[11px] text-slate-500">
                              {formatTimeLabel(t.time)}
                            </span>
                          )}
                        </div>
                        {t.note ? (
                          <p className="truncate text-xs text-slate-400">{t.note}</p>
                        ) : (
                          <p className="truncate text-xs text-slate-600">Tanpa catatan</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <Money
                          value={t.type === "income" ? t.amount : -t.amount}
                          type={t.type}
                          className={compact ? "text-sm font-semibold" : "text-sm font-semibold"}
                          signed
                        />
                        {startBalance !== undefined && balanceMap.get(t.uid) !== undefined && (
                          <p className="mt-0.5 hidden text-[10px] text-slate-500 sm:block">
                            saldo <Money value={balanceMap.get(t.uid)!} />
                          </p>
                        )}
                      </div>
                      {(onEdit || onDelete) && (
                        <div className="no-print flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(t)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-base-700 hover:text-mint-300"
                              aria-label="Edit transaksi"
                              title="Edit transaksi"
                            >
                              <Icon name="edit" size={15} />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(t)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-base-700 hover:text-rose-450"
                              aria-label="Hapus transaksi"
                              title="Hapus transaksi"
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p className="px-1 pt-2 text-[11px] text-slate-600">
        Format tanggal: {settings.dateFormat} · {transactions.length} transaksi ditampilkan
      </p>
    </div>
  );
}
