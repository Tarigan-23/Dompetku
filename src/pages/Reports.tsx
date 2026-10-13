import { useMemo, useState } from "react";
import { Badge, Button, Card, CategoryRow, EmptyState, Money, Segmented, Select, StatCard } from "@/components/ui";
import { DailyBars, DonutChart } from "@/components/charts";
import { TransactionList } from "@/components/TransactionList";
import { Icon } from "@/lib/icons";
import {
  MONTH_NAMES,
  addDaysISO,
  addMonths,
  formatDate,
  formatLongDate,
  monthDates,
  todayISO,
  weekRange,
} from "@/lib/date";
import {
  buildMonthReport,
  buildPeriodReport,
  dailySeries,
  weekLabel,
  type CategoryTotal,
} from "@/lib/stats";
import { formatNumber, formatRupiah } from "@/lib/money";
import { downloadFile, reportToText, stampName, transactionsToCSV } from "@/lib/exporters";
import { useApp } from "@/store/AppStore";
import { useUI } from "@/store/UiStore";
import { cn } from "@/utils/cn";

type Tab = "month" | "week" | "day";

export function Reports() {
  const [tab, setTab] = useState<Tab>("month");
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "month" as Tab, label: "Bulanan" },
            { value: "week" as Tab, label: "Mingguan" },
            { value: "day" as Tab, label: "Harian" },
          ]}
        />
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Icon name="print" size={14} /> Cetak / Simpan PDF
        </Button>
      </div>
      {tab === "month" && <MonthlyReport />}
      {tab === "week" && <WeeklyReport />}
      {tab === "day" && <DailyReport />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Komponen bersama                                                    */
/* ------------------------------------------------------------------ */

function PeriodNav({
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  children,
}: {
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="icon" onClick={onPrev} disabled={prevDisabled} title="Periode sebelumnya">
        <Icon name="chevronLeft" size={16} />
      </Button>
      {children}
      <Button variant="secondary" size="icon" onClick={onNext} disabled={nextDisabled} title="Periode berikutnya">
        <Icon name="chevronRight" size={16} />
      </Button>
    </div>
  );
}

function CategoryTable({ rows, emptyLabel }: { rows: CategoryTotal[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-slate-500">{emptyLabel}</p>;
  }
  return (
    <div className="divide-y divide-line-soft">
      {rows.map((r) => (
        <CategoryRow
          key={r.category.uid}
          icon={r.category.icon}
          color={r.category.color}
          name={r.category.name}
          total={formatRupiah(r.total)}
          count={r.count}
          pctValue={r.pct}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Laporan bulanan                                                     */
/* ------------------------------------------------------------------ */

function MonthlyReport() {
  const { transactions, categories, settings, notify } = useApp();
  const { openTransactionForm, deleteTransaction } = useUI();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const report = useMemo(
    () => buildMonthReport(transactions, categories, settings.initialBalance, year, month),
    [transactions, categories, settings.initialBalance, year, month],
  );
  const a = report.analysis;
  const days = monthDates(year, month);
  const series = useMemo(() => dailySeries(transactions, days), [transactions, days]);
  const years = useMemo(() => {
    const set = new Set<number>(transactions.map((t) => Number(t.date.slice(0, 4))));
    set.add(now.getFullYear());
    set.add(year);
    return [...set].sort((x, y) => y - x);
  }, [transactions, year, now]);

  function shift(delta: number) {
    const next = addMonths(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  function copySummary() {
    const lines: Array<[string, string | number]> = [
      ["Total pemasukan", report.income],
      ["Total pengeluaran", report.expense],
      ["Selisih", report.net],
      ["Saldo awal bulan", report.startBalance],
      ["Saldo akhir bulan", report.endBalance],
      ["Jumlah transaksi", report.count],
      ["Kategori terbesar", a.topExpenseCategory ? a.topExpenseCategory.category.name : "—"],
      ["Rata-rata pengeluaran per hari", a.avgExpensePerDay],
    ];
    const text = reportToText(`DompetKu — Laporan ${MONTH_NAMES[month]} ${year}`, lines);
    const done = () => notify({ type: "success", title: "Ringkasan tersalin", message: "Dapat ditempel ke catatan atau pesan." });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(done)
        .catch(() => {
          downloadFile(`dompetku-ringkasan-${month + 1}-${year}.txt`, text, "text/plain");
          notify({ type: "info", title: "Ringkasan diunduh sebagai teks" });
        });
    } else {
      downloadFile(`dompetku-ringkasan-${month + 1}-${year}.txt`, text, "text/plain");
      notify({ type: "info", title: "Ringkasan diunduh sebagai teks" });
    }
  }

  function exportMonthCSV() {
    if (report.count === 0) {
      notify({ type: "info", title: "Tidak ada transaksi pada bulan ini" });
      return;
    }
    downloadFile(
      `dompetku-${MONTH_NAMES[month].toLowerCase()}-${year}.csv`,
      transactionsToCSV(report.transactions, categories, settings),
      "text/csv",
    );
    notify({ type: "success", title: "CSV bulanan dibuat", message: `${report.count} transaksi ${MONTH_NAMES[month]} ${year}.` });
  }

  return (
    <div className="print-root space-y-4">
      <Card
        title="Laporan Keuangan Bulanan"
        subtitle={`Dihitung otomatis dari ${report.count} transaksi lokal · format saldo awal ${settings.hideAmounts ? "disembunyikan" : formatRupiah(settings.initialBalance)}`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="no-print" onClick={copySummary}>
              <Icon name="receipt" size={14} /> Salin ringkasan
            </Button>
            <Button size="sm" variant="outline" className="no-print" onClick={exportMonthCSV}>
              <Icon name="download" size={14} /> CSV
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PeriodNav onPrev={() => shift(-1)} onNext={() => shift(1)}>
            <div className="flex items-center gap-2">
              <Select
                value={`${month}`}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-36"
                aria-label="Pilih bulan"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select
                value={`${year}`}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24"
                aria-label="Pilih tahun"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
          </PeriodNav>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-100">
              {MONTH_NAMES[month]} {year}
            </p>
            <p className="text-[11px] text-slate-500">
              {report.start} s.d. {report.end}
            </p>
          </div>
        </div>
      </Card>

      {/* Kop laporan saat dicetak */}
      <div className="hidden print:mb-4 print:block">
        <h1 className="text-lg font-bold">DompetKu — Laporan Keuangan Bulanan</h1>
        <p className="text-xs">
          Periode {MONTH_NAMES[month]} {year} ({formatDate(report.start, "dd/MM/yyyy")} –{" "}
          {formatDate(report.end, "dd/MM/yyyy")}) · {report.count} transaksi · dicetak{" "}
          {new Date().toLocaleString("id-ID")}
        </p>
        <p className="text-xs">
          Semua angka dihitung otomatis dari data transaksi lokal dan dinyatakan dalam Rupiah bulat.
        </p>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total pemasukan" value={<Money value={report.income} type="income" />} icon="arrowDown" tone="income" />
        <StatCard label="Total pengeluaran" value={<Money value={report.expense} type="expense" />} icon="arrowUp" tone="expense" />
        <StatCard
          label="Selisih"
          value={<Money value={report.net} type={report.net >= 0 ? "income" : "expense"} signed />}
          icon="scale"
          tone={report.net >= 0 ? "income" : "expense"}
        />
        <StatCard label="Saldo awal bulan" value={<Money value={report.startBalance} />} icon="wallet" hint="saldo sebelum tanggal 1" />
        <StatCard label="Saldo akhir bulan" value={<Money value={report.endBalance} />} icon="wallet" tone="accent" hint="awal + masuk − keluar" />
        <StatCard label="Jumlah transaksi" value={<span className="font-mono">{formatNumber(report.count)}</span>} icon="receipt" hint={`${a.transactionDays} hari bertransaksi`} />
      </div>

      {/* Grafik */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Arus harian" subtitle={`Pemasukan dan pengeluaran per tanggal · ${MONTH_NAMES[month]} ${year}`}>
          <DailyBars
            data={series.map((s) => ({ income: s.income, expense: s.expense }))}
            labels={series.map((s) => s.date.slice(8, 10))}
          />
        </Card>
        <Card title="Komposisi pengeluaran" subtitle={`${report.expenseByCategory.length} kategori terpakai`}>
          <DonutChart
            slices={report.expenseByCategory.map((r) => ({
              label: r.category.name,
              value: r.total,
              color: r.category.color,
              icon: r.category.icon,
            }))}
            total={report.expense}
            centerLabel="Total keluar"
          />
        </Card>
      </div>

      {/* Rincian kategori */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Rincian pengeluaran per kategori" subtitle="Total nominal, jumlah transaksi, dan persentase">
          <CategoryTable rows={report.expenseByCategory} emptyLabel="Belum ada pengeluaran pada bulan ini." />
        </Card>
        <Card title="Rincian pemasukan per kategori" subtitle="Gaji, lemburan, bonus, usaha, dan lainnya">
          <CategoryTable rows={report.incomeByCategory} emptyLabel="Belum ada pemasukan pada bulan ini." />
        </Card>
      </div>

      {/* Analisis */}
      <Card title="Analisis bulanan" subtitle={`Perbandingan dengan ${MONTH_NAMES[addMonths(year, month, -1).month]} ${addMonths(year, month, -1).year}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-base-900/50 p-3">
            <p className="text-[11px] text-slate-400">Kategori pengeluaran terbesar</p>
            {a.topExpenseCategory ? (
              <>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {a.topExpenseCategory.category.icon} {a.topExpenseCategory.category.name}
                </p>
                <Money value={a.topExpenseCategory.total} type="expense" className="text-sm" />
                <p className="text-[11px] text-slate-500">
                  {a.topExpenseCategory.pct.toFixed(1).replace(".", ",")}% dari total pengeluaran
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-500">—</p>
            )}
          </div>
          <div className="rounded-xl border border-line bg-base-900/50 p-3">
            <p className="text-[11px] text-slate-400">Hari pengeluaran tertinggi</p>
            {a.heaviestDay ? (
              <>
                <p className="mt-1 text-sm font-semibold text-slate-100">{formatLongDate(a.heaviestDay.date)}</p>
                <Money value={a.heaviestDay.expense} type="expense" className="text-sm" />
                <p className="text-[11px] text-slate-500">{a.heaviestDay.count} transaksi pada hari itu</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-500">—</p>
            )}
          </div>
          <div className="rounded-xl border border-line bg-base-900/50 p-3">
            <p className="text-[11px] text-slate-400">Rata-rata pengeluaran per hari</p>
            <p className="mt-1">
              <Money value={a.avgExpensePerDay} type="expense" className="text-sm font-semibold" />
            </p>
            <p className="text-[11px] text-slate-500">
              dihitung dari {a.daysConsidered} hari ({a.daysConsidered === days.length ? "bulan penuh" : "sampai hari ini"})
            </p>
          </div>
          <div className="rounded-xl border border-line bg-base-900/50 p-3">
            <p className="text-[11px] text-slate-400">Perbandingan bulan lalu</p>
            <div className="mt-1 space-y-1 text-xs">
              <p className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Pemasukan</span>
                <Badge tone={a.incomeDelta >= 0 ? "income" : "expense"}>
                  {a.incomeDelta >= 0 ? "+" : "−"}
                  {formatNumber(Math.abs(a.incomeDelta))}
                </Badge>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Pengeluaran</span>
                <Badge tone={a.expenseDelta <= 0 ? "income" : "expense"}>
                  {a.expenseDelta >= 0 ? "+" : "−"}
                  {formatNumber(Math.abs(a.expenseDelta))}
                </Badge>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Transaksi</span>
                <span className="text-slate-300">
                  {report.count} vs {a.prevCount}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-base-900/50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-300">Kategori dengan pengeluaran naik</p>
            {a.increases.length === 0 ? (
              <p className="text-xs text-slate-500">Tidak ada kategori yang naik dibanding bulan lalu.</p>
            ) : (
              <ul className="space-y-1.5">
                {a.increases.map((d) => (
                  <li key={d.category.uid} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-300">
                      {d.category.icon} {d.category.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-slate-500">{formatRupiah(d.previous)}</span>
                      <Icon name="arrowUp" size={12} className="text-rose-450" />
                      <span className="font-mono text-rose-450">{formatRupiah(d.current)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-line bg-base-900/50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-300">Kategori dengan pengeluaran turun</p>
            {a.decreases.length === 0 ? (
              <p className="text-xs text-slate-500">Tidak ada kategori yang turun dibanding bulan lalu.</p>
            ) : (
              <ul className="space-y-1.5">
                {a.decreases.map((d) => (
                  <li key={d.category.uid} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-300">
                      {d.category.icon} {d.category.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-slate-500">{formatRupiah(d.previous)}</span>
                      <Icon name="arrowDown" size={12} className="text-mint-400" />
                      <span className="font-mono text-mint-400">{formatRupiah(d.current)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="mt-3 rounded-xl border border-mint-500/20 bg-mint-500/5 p-3 text-xs leading-relaxed text-slate-300">
          <span className="font-semibold text-mint-300">Ringkasan: </span>
          {a.summary}
        </p>
      </Card>

      <Card title="Daftar transaksi bulan ini" subtitle="Diurutkan dari yang terbaru">
        <TransactionList
          transactions={report.transactions.slice().reverse()}
          onEdit={(t) => openTransactionForm({ initial: t })}
          onDelete={deleteTransaction}
          startBalance={report.startBalance}
          emptyTitle="Belum ada transaksi pada bulan ini"
          emptyDescription="Pilih bulan lain pada navigasi di atas atau catat transaksi baru."
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Laporan mingguan                                                    */
/* ------------------------------------------------------------------ */

function WeeklyReport() {
  const { transactions, categories, settings, notify } = useApp();
  const { openTransactionForm, deleteTransaction } = useUI();
  const [anchor, setAnchor] = useState(todayISO());
  const weekStartSetting = settings.weekStart;
  const { start, end } = weekRange(anchor, weekStartSetting);

  const report = useMemo(
    () => buildPeriodReport(transactions, categories, settings.initialBalance, start, end, weekLabel(start, end, weekStartSetting), "Laporan mingguan"),
    [transactions, categories, settings.initialBalance, start, end, weekStartSetting],
  );
  const series = useMemo(() => dailySeries(transactions, report.daily.map((d) => d.date)), [transactions, report.daily]);

  function shiftWeeks(delta: number) {
    const { start: s } = weekRange(anchor, weekStartSetting);
    setAnchor(addDaysISO(s, delta * 7));
  }

  function exportWeekCSV() {
    if (report.count === 0) {
      notify({ type: "info", title: "Tidak ada transaksi pada pekan ini" });
      return;
    }
    downloadFile(
      stampName(`dompetku-pekan-${start}`, "csv"),
      transactionsToCSV(report.transactions, categories, settings),
      "text/csv",
    );
    notify({ type: "success", title: "CSV mingguan dibuat", message: `${report.count} transaksi.` });
  }

  return (
    <div className="print-root space-y-4">
      <Card
        title="Laporan Mingguan"
        subtitle={`${report.count} transaksi pada periode ini`}
        action={
          <Button size="sm" variant="outline" className="no-print" onClick={exportWeekCSV}>
            <Icon name="download" size={14} /> CSV
          </Button>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PeriodNav onPrev={() => shiftWeeks(-1)} onNext={() => shiftWeeks(1)}>
            <input
              type="date"
              value={anchor}
              onChange={(e) => e.target.value && setAnchor(e.target.value)}
              className="rounded-xl border border-base-600 bg-base-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-mint-500"
              aria-label="Pilih tanggal dalam pekan"
            />
          </PeriodNav>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-100">{weekLabel(start, end, weekStartSetting)}</p>
            <p className="text-[11px] text-slate-500">
              {formatDate(start, settings.dateFormat)} – {formatDate(end, settings.dateFormat)}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Pemasukan" value={<Money value={report.income} type="income" />} icon="arrowDown" tone="income" />
        <StatCard label="Pengeluaran" value={<Money value={report.expense} type="expense" />} icon="arrowUp" tone="expense" />
        <StatCard label="Selisih" value={<Money value={report.net} type={report.net >= 0 ? "income" : "expense"} signed />} icon="scale" />
        <StatCard label="Saldo awal pekan" value={<Money value={report.startBalance} />} icon="wallet" />
        <StatCard label="Saldo akhir pekan" value={<Money value={report.endBalance} />} icon="wallet" tone="accent" />
        <StatCard label="Transaksi" value={<span className="font-mono">{formatNumber(report.count)}</span>} icon="receipt" />
      </div>

      <Card title="Rekap harian pekan ini" subtitle="Pemasukan, pengeluaran, dan saldo akhir setiap hari">
        <DailyBars
          data={series.map((s) => ({ income: s.income, expense: s.expense }))}
          labels={series.map((s) => {
            const d = new Date(s.date);
            return ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getDay()];
          })}
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="border-b border-line text-left text-slate-400">
                <th className="py-2 pr-3 font-medium">Hari</th>
                <th className="py-2 pr-3 font-medium">Tanggal</th>
                <th className="py-2 pr-3 text-right font-medium">Masuk</th>
                <th className="py-2 pr-3 text-right font-medium">Keluar</th>
                <th className="py-2 pr-3 text-right font-medium">Txn</th>
                <th className="py-2 text-right font-medium">Saldo akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {report.daily.map((d) => (
                <tr key={d.date} className={cn(d.count === 0 && "text-slate-500")}>
                  <td className="py-2 pr-3 font-medium text-slate-200">{formatLongDate(d.date).split(",")[0]}</td>
                  <td className="py-2 pr-3">{formatDate(d.date, settings.dateFormat)}</td>
                  <td className="py-2 pr-3 text-right">{d.income ? <Money value={d.income} type="income" /> : "—"}</td>
                  <td className="py-2 pr-3 text-right">{d.expense ? <Money value={-d.expense} type="expense" /> : "—"}</td>
                  <td className="py-2 pr-3 text-right font-mono">{d.count}</td>
                  <td className="py-2 text-right">
                    <Money value={d.balance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Pengeluaran per kategori" subtitle="Pekan ini">
          <CategoryTable rows={report.expenseByCategory} emptyLabel="Tidak ada pengeluaran pada pekan ini." />
        </Card>
        <Card title="Pemasukan per kategori" subtitle="Pekan ini">
          <CategoryTable rows={report.incomeByCategory} emptyLabel="Tidak ada pemasukan pada pekan ini." />
        </Card>
      </div>

      <Card title="Daftar transaksi pekan ini" subtitle="Lengkap dengan saldo berjalan">
        <TransactionList
          transactions={report.transactions.slice().reverse()}
          onEdit={(t) => openTransactionForm({ initial: t })}
          onDelete={deleteTransaction}
          startBalance={report.startBalance}
          emptyTitle="Belum ada transaksi pada pekan ini"
          emptyDescription="Geser ke pekan sebelumnya atau catat transaksi baru."
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Laporan harian                                                      */
/* ------------------------------------------------------------------ */

function DailyReport() {
  const { transactions, categories, settings } = useApp();
  const { openTransactionForm, deleteTransaction } = useUI();
  const [date, setDate] = useState(todayISO());
  const today = todayISO();

  const report = useMemo(
    () =>
      buildPeriodReport(
        transactions,
        categories,
        settings.initialBalance,
        date,
        date,
        formatLongDate(date),
        "Laporan harian",
      ),
    [transactions, categories, settings.initialBalance, date],
  );

  return (
    <div className="print-root space-y-4">
      <Card title="Laporan Harian" subtitle={`${report.count} transaksi pada tanggal ini`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PeriodNav onPrev={() => setDate(addDaysISO(date, -1))} onNext={() => setDate(addDaysISO(date, 1))} nextDisabled={date >= today}>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-xl border border-base-600 bg-base-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-mint-500"
              aria-label="Pilih tanggal"
            />
          </PeriodNav>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="no-print" onClick={() => setDate(today)}>
              <Icon name="calendar" size={14} /> Hari ini
            </Button>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-100">{formatLongDate(date)}</p>
              <p className="text-[11px] text-slate-500">{formatDate(date, settings.dateFormat)}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Pemasukan" value={<Money value={report.income} type="income" />} icon="arrowDown" tone="income" />
        <StatCard label="Pengeluaran" value={<Money value={report.expense} type="expense" />} icon="arrowUp" tone="expense" />
        <StatCard label="Selisih" value={<Money value={report.net} type={report.net >= 0 ? "income" : "expense"} signed />} icon="scale" />
        <StatCard label="Saldo awal hari" value={<Money value={report.startBalance} />} icon="wallet" />
        <StatCard label="Saldo akhir hari" value={<Money value={report.endBalance} />} icon="wallet" tone="accent" />
      </div>

      {report.count === 0 ? (
        <Card>
          <EmptyState
            icon="calendar"
            title="Tidak ada transaksi pada tanggal ini"
            description="Pilih tanggal lain atau catat transaksi baru untuk tanggal ini."
            action={
              <Button size="sm" variant="primary" className="no-print" onClick={() => openTransactionForm({ type: "expense" })}>
                <Icon name="plus" size={14} /> Catat transaksi
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Pengeluaran per kategori" subtitle="Hari ini">
              <CategoryTable rows={report.expenseByCategory} emptyLabel="Tidak ada pengeluaran pada tanggal ini." />
            </Card>
            <Card title="Pemasukan per kategori" subtitle="Hari ini">
              <CategoryTable rows={report.incomeByCategory} emptyLabel="Tidak ada pemasukan pada tanggal ini." />
            </Card>
          </div>
          <Card title="Urutan transaksi dan saldo" subtitle="Diurutkan berdasarkan tanggal dan waktu">
            <TransactionList
              transactions={report.transactions.slice().reverse()}
              onEdit={(t) => openTransactionForm({ initial: t })}
              onDelete={deleteTransaction}
              startBalance={report.startBalance}
              emptyTitle="Belum ada transaksi"
            />
          </Card>
        </>
      )}
    </div>
  );
}


