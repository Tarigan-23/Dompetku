import { useMemo, useState } from "react";
import { Badge, Button, Card, Field, Money, Segmented, Select, TextInput } from "@/components/ui";
import { TransactionList } from "@/components/TransactionList";
import { Icon } from "@/lib/icons";
import { MONTH_NAMES, addMonths, formatDate, sortChronological, todayISO } from "@/lib/date";
import { balanceBefore, monthRange } from "@/lib/stats";
import { downloadFile, stampName, transactionsToCSV } from "@/lib/exporters";
import { useApp } from "@/store/AppStore";
import { useUI } from "@/store/UiStore";
import { cn } from "@/utils/cn";

type TypeFilter = "all" | "income" | "expense";
type SortDir = "desc" | "asc";

const PAGE_SIZE = 40;

export function Transactions() {
  const { transactions, categories, settings, notify } = useApp();
  const { openTransactionForm, deleteTransaction } = useUI();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showFilters, setShowFilters] = useState(false);

  const now = new Date();

  const yearOptions = useMemo(() => {
    const years = new Set<number>(transactions.map((t) => Number(t.date.slice(0, 4))));
    years.add(now.getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [transactions, now]);

  const monthOptions = useMemo(() => {
    if (yearFilter === "all") return MONTH_NAMES.map((m, i) => ({ value: `${i}`, label: m }));
    const months = new Set<number>(
      transactions.filter((t) => t.date.slice(0, 4) === yearFilter).map((t) => Number(t.date.slice(5, 7)) - 1),
    );
    if (months.size === 0) return MONTH_NAMES.map((m, i) => ({ value: `${i}`, label: m }));
    return MONTH_NAMES.map((m, i) => ({ value: `${i}`, label: m })).filter((o) => months.has(Number(o.value)));
  }, [transactions, yearFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = transactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryFilter !== "all" && t.categoryId !== categoryFilter) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (yearFilter !== "all" && !t.date.startsWith(yearFilter)) return false;
      if (monthFilter !== "all" && Number(t.date.slice(5, 7)) - 1 !== Number(monthFilter)) return false;
      if (q) {
        const cat = categories.find((c) => c.uid === t.categoryId);
        const haystack = `${t.note} ${cat?.name ?? ""} ${t.amount}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return sortChronological(list, sortDir === "asc");
  }, [transactions, categories, search, typeFilter, categoryFilter, from, to, monthFilter, yearFilter, sortDir]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const shown = filtered.slice(0, visible);
  const listStartBalance = useMemo(
    () => balanceBefore(transactions, sortChronological(filtered, true)[0]?.date ?? "9999-12-31", settings.initialBalance),
    [transactions, filtered, settings.initialBalance],
  );

  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (monthFilter !== "all" ? 1 : 0) +
    (yearFilter !== "all" ? 1 : 0) +
    (search ? 1 : 0);

  function resetFilters() {
    setSearch("");
    setTypeFilter("all");
    setCategoryFilter("all");
    setFrom("");
    setTo("");
    setMonthFilter("all");
    setYearFilter("all");
    setVisible(PAGE_SIZE);
  }

  function setPreset(kind: "thisMonth" | "lastMonth" | "last30" | "thisYear" | "all") {
    const y = now.getFullYear();
    const m = now.getMonth();
    setVisible(PAGE_SIZE);
    if (kind === "all") {
      setFrom("");
      setTo("");
      setMonthFilter("all");
      setYearFilter("all");
      return;
    }
    if (kind === "thisMonth") {
      const r = monthRange(y, m);
      setFrom(r.start);
      setTo(r.end);
      setMonthFilter(`${m}`);
      setYearFilter(`${y}`);
      return;
    }
    if (kind === "lastMonth") {
      const prev = addMonths(y, m, -1);
      const r = monthRange(prev.year, prev.month);
      setFrom(r.start);
      setTo(r.end);
      setMonthFilter(`${prev.month}`);
      setYearFilter(`${prev.year}`);
      return;
    }
    if (kind === "last30") {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setFrom(`${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`);
      setTo(todayISO());
      setMonthFilter("all");
      setYearFilter("all");
      return;
    }
    setFrom(`${y}-01-01`);
    setTo(`${y}-12-31`);
    setMonthFilter("all");
    setYearFilter(`${y}`);
  }

  function exportCSV() {
    if (filtered.length === 0) {
      notify({ type: "info", title: "Tidak ada data untuk diekspor", message: "Ubah filter terlebih dahulu." });
      return;
    }
    const csv = transactionsToCSV(filtered, categories, settings);
    downloadFile(stampName("dompetku-transaksi", "csv"), csv, "text/csv");
    notify({
      type: "success",
      title: "CSV berhasil dibuat",
      message: `${filtered.length} transaksi diunduh. Buka berkas dengan Microsoft Excel (pemisah ; dan UTF-8).`,
    });
  }

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => typeFilter === "all" || c.type === typeFilter)
        .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)),
    [categories, typeFilter],
  );

  return (
    <div className="space-y-4">
      <Card
        title="Semua Transaksi"
        subtitle="Cari, filter, urutkan, lalu edit atau hapus transaksi Anda."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Icon name="download" size={14} /> CSV
            </Button>
            <Button size="sm" variant="primary" onClick={() => openTransactionForm({ type: "income" })}>
              <Icon name="plus" size={14} /> Baru
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Cari catatan atau kategori…"
                className="w-full rounded-xl border border-base-600 bg-base-900/80 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-mint-500 focus:ring-2 focus:ring-mint-500/15"
              />
            </div>
            <Button
              variant={showFilters ? "primary" : "secondary"}
              onClick={() => setShowFilters((v) => !v)}
              className="sm:w-auto"
            >
              <Icon name="filter" size={16} /> Filter
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-base-950/40 px-1.5 text-[11px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Segmented
              value={sortDir}
              onChange={(v) => setSortDir(v)}
              options={[
                { value: "desc" as SortDir, label: "Terbaru" },
                { value: "asc" as SortDir, label: "Terlama" },
              ]}
            />
          </div>

          {showFilters && (
            <div className="anim-fade-up space-y-3 rounded-xl border border-line bg-base-900/40 p-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["thisMonth", "Bulan ini"],
                  ["lastMonth", "Bulan lalu"],
                  ["last30", "30 hari terakhir"],
                  ["thisYear", "Tahun ini"],
                  ["all", "Semua waktu"],
                ].map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setPreset(kind as "thisMonth" | "lastMonth" | "last30" | "thisYear" | "all")}
                    className="rounded-lg border border-line bg-base-800/70 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-mint-500/50 hover:text-mint-300"
                  >
                    {label}
                  </button>
                ))}
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-rose-450 transition-colors hover:bg-rose-500/10"
                  >
                    Reset semua filter
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Jenis transaksi">
                  <Segmented
                    value={typeFilter}
                    onChange={(v) => {
                      setTypeFilter(v);
                      setCategoryFilter("all");
                    }}
                    options={[
                      { value: "all" as TypeFilter, label: "Semua" },
                      { value: "income" as TypeFilter, label: "Masuk" },
                      { value: "expense" as TypeFilter, label: "Keluar" },
                    ]}
                    className="w-full"
                  />
                </Field>
                <Field label="Kategori">
                  <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="all">Semua kategori</option>
                    {categoryOptions.map((c) => (
                      <option key={c.uid} value={c.uid}>
                        {c.archived ? "(arsip) " : ""}
                        {c.icon} {c.name} · {c.type === "income" ? "masuk" : "keluar"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Bulan">
                  <Select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
                    <option value="all">Semua bulan</option>
                    {monthOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tahun">
                  <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                    <option value="all">Semua tahun</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={`${y}`}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Dari tanggal" hint={from ? formatDate(from, settings.dateFormat) : "opsional"}>
                  <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label="Sampai tanggal" hint={to ? formatDate(to, settings.dateFormat) : "opsional"}>
                  <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-base-900/50 px-3 py-2.5 text-xs">
            <Badge tone="neutral">{filtered.length} transaksi</Badge>
            <Badge tone="income">
              Masuk <Money value={totals.income} type="income" />
            </Badge>
            <Badge tone="expense">
              Keluar <Money value={-totals.expense} type="expense" />
            </Badge>
            <Badge tone={totals.net >= 0 ? "income" : "expense"}>
              Selisih <Money value={totals.net} type={totals.net >= 0 ? "income" : "expense"} signed />
            </Badge>
            {filtered.length > 0 && (
              <span className="text-slate-500">
                Periode {formatDate(sortChronological(filtered, true)[0].date, settings.dateFormat)} –{" "}
                {formatDate(sortChronological(filtered, false)[0].date, settings.dateFormat)}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card bodyClassName="p-0 pb-2">
        <div className="px-2">
          <TransactionList
            transactions={shown}
            onEdit={(t) => openTransactionForm({ initial: t })}
            onDelete={deleteTransaction}
            startBalance={listStartBalance}
            emptyTitle={activeFilterCount > 0 ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi"}
            emptyDescription={
              activeFilterCount > 0
                ? "Coba ubah kata kunci pencarian atau reset filter untuk melihat seluruh transaksi."
                : "Setiap transaksi yang Anda catat akan tampil di sini, lengkap dengan saldo berjalan."
            }
            emptyAction={
              activeFilterCount > 0 ? (
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  <Icon name="refresh" size={14} /> Reset filter
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={() => openTransactionForm()}>
                  <Icon name="plus" size={14} /> Catat transaksi
                </Button>
              )
            }
          />
        </div>
        {visible < filtered.length && (
          <div className={cn("flex justify-center pb-2")}>
            <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Muat {Math.min(PAGE_SIZE, filtered.length - visible)} transaksi lagi
              <span className="text-slate-500">({visible}/{filtered.length})</span>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
