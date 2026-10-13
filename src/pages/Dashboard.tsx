import { useMemo } from "react";
import { Badge, Button, Card, Money, StatCard } from "@/components/ui";
import { DonutChart, IncomeExpenseBars } from "@/components/charts";
import { TransactionList } from "@/components/TransactionList";
import { Icon } from "@/lib/icons";
import { formatNumber, formatRupiah } from "@/lib/money";
import { monthLabel, sortChronological } from "@/lib/date";
import { buildMonthReport, monthlyTrends } from "@/lib/stats";
import { useApp } from "@/store/AppStore";
import { useUI } from "@/store/UiStore";

export function Dashboard() {
  const { transactions, categories, settings, balance } = useApp();
  const { openTransactionForm, openCategoryManager, navigate, deleteTransaction } = useUI();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const report = useMemo(
    () => buildMonthReport(transactions, categories, settings.initialBalance, year, month),
    [transactions, categories, settings.initialBalance, year, month],
  );
  const trends = useMemo(() => monthlyTrends(transactions, year, month, 6), [transactions, year, month]);
  const recent = useMemo(
    () => sortChronological(transactions, false).slice(0, 8),
    [transactions],
  );

  const slices = report.expenseByCategory.map((r) => ({
    label: r.category.name,
    value: r.total,
    color: r.category.color,
    icon: r.category.icon,
  }));

  const hasData = transactions.length > 0;

  return (
    <div className="space-y-4">
      {/* Hero saldo */}
      <section className="anim-fade-up relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-base-800 via-base-850 to-base-900 p-5 sm:p-7">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-500/15 text-mint-400">
              <Icon name="wallet" size={18} />
            </span>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Saldo saat ini</p>
            <Badge tone="neutral">per {new Date().toLocaleDateString("id-ID")}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
            <Money value={balance} className="text-3xl font-semibold tracking-tight sm:text-[2.6rem]" />
            <span className="text-xs text-slate-500">
              dari saldo awal {settings.hideAmounts ? "Rp••••••" : formatRupiah(settings.initialBalance)}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => openTransactionForm({ type: "income" })}>
              <Icon name="plus" size={16} /> Tambah Pemasukan
            </Button>
            <Button variant="expense" onClick={() => openTransactionForm({ type: "expense" })}>
              <Icon name="minus" size={16} /> Tambah Pengeluaran
            </Button>
            <Button variant="outline" onClick={() => navigate("transactions")}>
              <Icon name="receipt" size={16} /> Semua Transaksi
            </Button>
            <Button variant="outline" onClick={() => navigate("reports")}>
              <Icon name="chart" size={16} /> Laporan Bulanan
            </Button>
          </div>
        </div>
      </section>

      {!settings.onboarded && (
        <Card
          title="Selesaikan pengaturan awal"
          subtitle="Atur saldo awal agar perhitungan saldo dan laporan bulanan akurat."
          action={
            <Button size="sm" variant="primary" onClick={() => navigate("settings")}>
              Atur sekarang
            </Button>
          }
        >
          <p className="text-xs leading-relaxed text-slate-400">
            Saldo awal adalah jumlah uang yang Anda miliki sebelum mulai mencatat. Nilai ini tidak dihitung sebagai
            pemasukan sehingga laporan tidak menjadi dobel.
          </p>
        </Card>
      )}

      {/* Ringkasan bulan ini */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`Pemasukan ${monthLabel(year, month).split(" ")[0]}`}
          value={<Money value={report.income} type="income" />}
          icon="arrowDown"
          tone="income"
          hint={`${report.incomeByCategory.reduce((s, r) => s + r.count, 0)} transaksi masuk`}
          className="anim-fade-up"
        />
        <StatCard
          label={`Pengeluaran ${monthLabel(year, month).split(" ")[0]}`}
          value={<Money value={report.expense} type="expense" />}
          icon="arrowUp"
          tone="expense"
          hint={`${report.count} transaksi keluar`}
          className="anim-fade-up"
        />
        <StatCard
          label="Selisih bulan ini"
          value={<Money value={report.net} type={report.net >= 0 ? "income" : "expense"} signed />}
          icon="scale"
          tone={report.net >= 0 ? "income" : "expense"}
          hint={report.net >= 0 ? "Surplus" : "Defisit"}
          className="anim-fade-up"
        />
        <StatCard
          label="Jumlah transaksi"
          value={<span className="font-mono">{formatNumber(report.count)}</span>}
          icon="receipt"
          hint={`${report.analysis.transactionDays} hari aktif`}
          className="anim-fade-up"
        />
      </div>

      {/* Grafik */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card
          title="Pemasukan vs Pengeluaran"
          subtitle="Enam bulan terakhir termasuk bulan ini"
          className="anim-fade-up"
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate("reports")}>
              Laporan <Icon name="chevronRight" size={14} />
            </Button>
          }
        >
          <IncomeExpenseBars data={trends} onSelect={() => navigate("reports")} />
        </Card>

        <Card
          title="Pengeluaran per Kategori"
          subtitle={monthLabel(year, month)}
          className="anim-fade-up"
          action={
            <Button size="sm" variant="ghost" onClick={() => openCategoryManager("expense")}>
              <Icon name="tag" size={14} /> Kelola
            </Button>
          }
        >
          {report.expense > 0 ? (
            <DonutChart slices={slices} total={report.expense} centerLabel="Total keluar" />
          ) : (
            <div className="flex h-[168px] flex-col items-center justify-center gap-2 text-center">
              <span className="text-2xl">🧾</span>
              <p className="text-xs text-slate-500">Belum ada pengeluaran bulan ini</p>
              <Button size="sm" variant="outline" onClick={() => openTransactionForm({ type: "expense" })}>
                Catat pengeluaran
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Kategori terbesar + transaksi terbaru */}
      <div className="grid gap-3 lg:grid-cols-5">
        <Card
          title="Kategori pengeluaran terbesar"
          subtitle={monthLabel(year, month)}
          className="anim-fade-up lg:col-span-2"
        >
          {report.analysis.topExpenseCategory ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-base-900/50 p-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border text-xl"
                  style={{
                    background: `color-mix(in srgb, ${report.analysis.topExpenseCategory.category.color} 20%, transparent)`,
                    borderColor: `color-mix(in srgb, ${report.analysis.topExpenseCategory.category.color} 40%, transparent)`,
                  }}
                >
                  {report.analysis.topExpenseCategory.category.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {report.analysis.topExpenseCategory.category.name}
                  </p>
                  <Money
                    value={report.analysis.topExpenseCategory.total}
                    type="expense"
                    className="text-lg font-semibold"
                  />
                  <p className="text-[11px] text-slate-500">
                    {report.analysis.topExpenseCategory.count} transaksi ·{" "}
                    {report.analysis.topExpenseCategory.pct.toFixed(1).replace(".", ",")}% dari pengeluaran
                  </p>
                </div>
              </div>
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Rata-rata pengeluaran harian</dt>
                  <dd>
                    <Money value={report.analysis.avgExpensePerDay} type="expense" />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Hari pengeluaran tertinggi</dt>
                  <dd className="text-right">
                    {report.analysis.heaviestDay ? (
                      <>
                        <span className="text-slate-200">
                          {report.analysis.heaviestDay.date.slice(8, 10)}{" "}
                          {monthLabel(year, month).split(" ")[0]}
                        </span>{" "}
                        <Money value={report.analysis.heaviestDay.expense} type="expense" />
                      </>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Pengeluaran bulan lalu</dt>
                  <dd className="flex items-center gap-2">
                    <Money value={report.prev.expense} type="expense" />
                    <Badge tone={report.analysis.expenseDelta <= 0 ? "income" : "expense"}>
                      {report.analysis.expenseDelta === 0
                        ? "sama"
                        : report.analysis.expenseDelta > 0
                          ? `+${formatNumber(report.analysis.expenseDelta)}`
                          : `−${formatNumber(Math.abs(report.analysis.expenseDelta))}`}
                    </Badge>
                  </dd>
                </div>
              </dl>
              <p className="rounded-xl border border-line bg-base-900/50 p-3 text-xs leading-relaxed text-slate-400">
                {report.analysis.summary}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="text-2xl">📉</span>
              <p className="text-xs text-slate-500">Belum ada pengeluaran pada bulan ini</p>
            </div>
          )}
        </Card>

        <Card
          title="Transaksi Terbaru"
          subtitle="Delapan transaksi terakhir"
          className="anim-fade-up lg:col-span-3"
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate("transactions")}>
              Lihat semua <Icon name="chevronRight" size={14} />
            </Button>
          }
          bodyClassName="p-0 pb-2"
        >
          <div className="px-2">
            <TransactionList
              transactions={recent}
              onEdit={(t) => openTransactionForm({ initial: t })}
              onDelete={deleteTransaction}
              emptyTitle={hasData ? "Belum ada transaksi" : "Mulai catat keuangan Anda"}
              emptyDescription={
                hasData
                  ? undefined
                  : "Tekan tombol Tambah Pemasukan atau Tambah Pengeluaran di atas. Setiap transaksi otomatis memperbarui saldo, grafik, dan laporan."
              }
              emptyAction={
                !hasData ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" variant="primary" onClick={() => openTransactionForm({ type: "income" })}>
                      <Icon name="plus" size={14} /> Pemasukan
                    </Button>
                    <Button size="sm" variant="expense" onClick={() => openTransactionForm({ type: "expense" })}>
                      <Icon name="minus" size={14} /> Pengeluaran
                    </Button>
                  </div>
                ) : undefined
              }
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
