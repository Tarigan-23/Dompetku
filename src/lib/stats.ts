import type { Category, Transaction } from "./types";
import {
  DAY_SHORT,
  MONTH_NAMES,
  datesBetween,
  daysInMonth,
  fromISO,
  parseISODate,
  sortChronological,
} from "./date";
import { formatRupiah, formatPct, pct } from "./money";

/* ------------------------------------------------------------------ */
/* Tipe hasil                                                          */
/* ------------------------------------------------------------------ */

export interface CategoryTotal {
  category: Category;
  total: number;
  count: number;
  pct: number;
}

export interface DailyRow {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  /** saldo setelah transaksi hari tersebut */
  balance: number;
}

export interface PeriodReport {
  start: string;
  end: string;
  label: string;
  sublabel: string;
  transactions: Transaction[];
  income: number;
  expense: number;
  net: number;
  count: number;
  /** saldo sebelum periode (saldo awal aplikasi + seluruh transaksi sebelum periode) */
  startBalance: number;
  /** saldo setelah seluruh transaksi periode */
  endBalance: number;
  incomeByCategory: CategoryTotal[];
  expenseByCategory: CategoryTotal[];
  daily: DailyRow[];
}

export interface CategoryDelta {
  category: Category;
  current: number;
  previous: number;
  diff: number;
}

export interface MonthAnalysis {
  topExpenseCategory: CategoryTotal | null;
  topIncomeCategory: CategoryTotal | null;
  heaviestDay: DailyRow | null;
  avgExpensePerDay: number;
  daysConsidered: number;
  prevIncome: number;
  prevExpense: number;
  prevNet: number;
  prevCount: number;
  incomeDelta: number;
  expenseDelta: number;
  increases: CategoryDelta[];
  decreases: CategoryDelta[];
  summary: string;
  transactionDays: number;
}

export interface MonthReport extends PeriodReport {
  year: number;
  month: number;
  /** laporan bulan sebelumnya (ringkasan pembanding) */
  prev: PeriodReport;
  analysis: MonthAnalysis;
}

/* ------------------------------------------------------------------ */
/* Dasar                                                               */
/* ------------------------------------------------------------------ */

export function netOf(list: Transaction[]): number {
  let net = 0;
  for (const t of list) net += t.type === "income" ? t.amount : -t.amount;
  return net;
}

export function balanceBefore(all: Transaction[], isoDate: string, initialBalance: number): number {
  let balance = initialBalance;
  for (const t of all) if (t.date < isoDate) balance += t.type === "income" ? t.amount : -t.amount;
  return balance;
}

export function inRange(list: Transaction[], start: string, end: string): Transaction[] {
  return list.filter((t) => t.date >= start && t.date <= end);
}

export function totalsOf(list: Transaction[]): { income: number; expense: number; net: number; count: number } {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense, count: list.length };
}

/** Saldo saat ini = saldo awal + seluruh pemasukan − seluruh pengeluaran */
export function currentBalance(all: Transaction[], initialBalance: number): number {
  return initialBalance + netOf(all);
}

export function categoryTotals(list: Transaction[], categories: Category[], type: "income" | "expense"): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  let grand = 0;
  for (const t of list) {
    if (t.type !== type) continue;
    const entry = map.get(t.categoryId) ?? { total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    map.set(t.categoryId, entry);
    grand += t.amount;
  }
  const rows: CategoryTotal[] = [];
  for (const [categoryId, entry] of map) {
    const category = categories.find((c) => c.uid === categoryId);
    if (!category) continue;
    rows.push({ category, total: entry.total, count: entry.count, pct: pct(entry.total, grand) });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

export function buildDailyRows(
  list: Transaction[],
  dates: string[],
  startBalance: number,
): DailyRow[] {
  const byDate = new Map<string, Transaction[]>();
  for (const t of list) {
    const arr = byDate.get(t.date);
    if (arr) arr.push(t);
    else byDate.set(t.date, [t]);
  }
  let running = startBalance;
  return dates.map((date) => {
    const dayTx = sortChronological(byDate.get(date) ?? [], true);
    const { income, expense, net, count } = totalsOf(dayTx);
    running += net;
    return { date, income, expense, net, count, balance: running };
  });
}

/* ------------------------------------------------------------------ */
/* Laporan periode (dipakai harian & mingguan)                         */
/* ------------------------------------------------------------------ */

export function buildPeriodReport(
  all: Transaction[],
  categories: Category[],
  initialBalance: number,
  start: string,
  end: string,
  label: string,
  sublabel: string,
): PeriodReport {
  const inPeriod = inRange(all, start, end);
  const sorted = sortChronological(inPeriod, true);
  const { income, expense, net, count } = totalsOf(sorted);
  const startBalance = balanceBefore(all, start, initialBalance);
  const daily = buildDailyRows(sorted, datesBetween(start, end), startBalance);
  return {
    start,
    end,
    label,
    sublabel,
    transactions: sorted,
    income,
    expense,
    net,
    count,
    startBalance,
    endBalance: startBalance + net,
    incomeByCategory: categoryTotals(sorted, categories, "income"),
    expenseByCategory: categoryTotals(sorted, categories, "expense"),
    daily,
  };
}

/* ------------------------------------------------------------------ */
/* Laporan bulanan                                                     */
/* ------------------------------------------------------------------ */

export function monthRange(year: number, month: number): { start: string; end: string } {
  const mm = `${month + 1}`.padStart(2, "0");
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${`${daysInMonth(year, month)}`.padStart(2, "0")}`,
  };
}

export function buildMonthReport(
  all: Transaction[],
  categories: Category[],
  initialBalance: number,
  year: number,
  month: number,
): MonthReport {
  const { start, end } = monthRange(year, month);
  const report = buildPeriodReport(
    all,
    categories,
    initialBalance,
    start,
    end,
    `${MONTH_NAMES[month]} ${year}`,
    "Laporan bulanan",
  );
  const prevDate = new Date(year, month, 1);
  prevDate.setDate(0);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();
  const prev = buildPeriodReport(
    all,
    categories,
    initialBalance,
    monthRange(prevYear, prevMonth).start,
    monthRange(prevYear, prevMonth).end,
    `${MONTH_NAMES[prevMonth]} ${prevYear}`,
    "Laporan bulanan",
  );
  const analysis = analyseMonth(report, prev, categories, year, month);
  return { ...report, year, month, prev, analysis };
}

function analyseMonth(
  cur: PeriodReport,
  prev: PeriodReport,
  categories: Category[],
  year: number,
  month: number,
): MonthAnalysis {
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  const total = daysInMonth(year, month);
  const daysConsidered = isCurrentMonth ? Math.min(now.getDate(), total) : total;

  const dailyWithExpense = cur.daily.filter((d) => d.count > 0);
  const heaviestDay = cur.daily.reduce<DailyRow | null>(
    (best, d) => (!best || d.expense > best.expense ? d : best),
    null,
  );

  const expenseDelta = cur.expense - prev.expense;
  const incomeDelta = cur.income - prev.income;

  const currentMap = new Map(cur.expenseByCategory.map((r) => [r.category.uid, r.total]));
  const prevMap = new Map(prev.expenseByCategory.map((r) => [r.category.uid, r.total]));
  const deltas: CategoryDelta[] = [];
  const allIds = new Set([...currentMap.keys(), ...prevMap.keys()]);
  for (const id of allIds) {
    const category = categories.find((c) => c.uid === id);
    if (!category) continue;
    const c = currentMap.get(id) ?? 0;
    const p = prevMap.get(id) ?? 0;
    if (c === 0 && p === 0) continue;
    deltas.push({ category, current: c, previous: p, diff: c - p });
  }
  const increases = deltas.filter((d) => d.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 4);
  const decreases = deltas.filter((d) => d.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 4);

  return {
    topExpenseCategory: cur.expenseByCategory[0] ?? null,
    topIncomeCategory: cur.incomeByCategory[0] ?? null,
    heaviestDay: heaviestDay && heaviestDay.expense > 0 ? heaviestDay : null,
    avgExpensePerDay: daysConsidered > 0 ? Math.round(cur.expense / daysConsidered) : cur.expense,
    daysConsidered,
    prevIncome: prev.income,
    prevExpense: prev.expense,
    prevNet: prev.net,
    prevCount: prev.count,
    incomeDelta,
    expenseDelta,
    increases,
    decreases,
    transactionDays: dailyWithExpense.length,
    summary: buildSummary(cur, prev, increases, daysConsidered),
  };
}

function buildSummary(cur: PeriodReport, prev: PeriodReport, increases: CategoryDelta[], days: number): string {
  if (cur.count === 0) {
    return "Belum ada transaksi pada bulan ini. Catat pemasukan atau pengeluaran pertama Anda agar laporan terisi otomatis.";
  }
  const parts: string[] = [];
  const ratio = cur.income > 0 ? cur.expense / cur.income : cur.expense > 0 ? Infinity : 0;

  if (cur.income === 0) {
    parts.push(`Bulan ini tidak ada pemasukan tercatat, sementara pengeluaran mencapai ${formatRupiah(cur.expense)}.`);
  } else if (ratio <= 0.5) {
    parts.push(
      `Keuangan sangat sehat: pengeluaran hanya ${formatPct(pct(cur.expense, cur.income))} dari pemasukan, sehingga saldo bertambah ${formatRupiah(cur.net)}.`,
    );
  } else if (ratio <= 0.85) {
    parts.push(
      `Keuangan stabil: pengeluaran ${formatPct(pct(cur.expense, cur.income))} dari pemasukan dan sisa bulan ini ${formatRupiah(cur.net)}.`,
    );
  } else if (ratio <= 1) {
    parts.push(
      `Pengeluaran hampir menyamai pemasukan (${formatPct(pct(cur.expense, cur.income))}). Sisa hanya ${formatRupiah(cur.net)}.`,
    );
  } else {
    parts.push(
      `Pengeluaran melebihi pemasukan sebesar ${formatRupiah(Math.abs(cur.net))}. Perlu penyesuaian agar saldo tidak terus berkurang.`,
    );
  }

  const top = cur.expenseByCategory[0];
  if (top) {
    parts.push(`Pos terbesar adalah ${top.category.name} sebesar ${formatRupiah(top.total)} (${formatPct(top.pct)} dari total pengeluaran).`);
  }
  if (days > 0 && cur.expense > 0) {
    parts.push(`Rata-rata pengeluaran ${formatRupiah(Math.round(cur.expense / days))} per hari.`);
  }
  if (prev.count > 0) {
    const diff = cur.expense - prev.expense;
    if (diff > 0) parts.push(`Dibanding bulan lalu, pengeluaran naik ${formatRupiah(diff)}.`);
    else if (diff < 0) parts.push(`Dibanding bulan lalu, pengeluaran turun ${formatRupiah(Math.abs(diff))}.`);
    else parts.push("Pengeluaran sama persis dengan bulan lalu.");
  }
  if (increases.length > 0) {
    parts.push(`Kenaikan terbesar pada kategori ${increases[0].category.name}.`);
  }
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Deret untuk grafik                                                  */
/* ------------------------------------------------------------------ */

export interface MonthlyTrend {
  year: number;
  month: number;
  label: string;
  income: number;
  expense: number;
  net: number;
}

/** Grafik pemasukan vs pengeluaran N bulan terakhir (termasuk bulan acuan). */
export function monthlyTrends(all: Transaction[], year: number, month: number, count = 6): MonthlyTrend[] {
  const out: MonthlyTrend[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const { start, end } = monthRange(y, m);
    const { income, expense, net } = totalsOf(inRange(all, start, end));
    out.push({ year: y, month: m, label: MONTH_NAMES[m].slice(0, 3), income, expense, net });
  }
  return out;
}

/** Deret harian (untuk grafik mingguan/bulanan) */
export function dailySeries(all: Transaction[], dates: string[]): Array<{ date: string; income: number; expense: number }> {
  const map = new Map<string, { income: number; expense: number }>();
  for (const t of all) {
    const e = map.get(t.date) ?? { income: 0, expense: 0 };
    if (t.type === "income") e.income += t.amount;
    else e.expense += t.amount;
    map.set(t.date, e);
  }
  return dates.map((date) => ({ date, ...(map.get(date) ?? { income: 0, expense: 0 }) }));
}

export function dayNameShort(iso: string): string {
  const p = parseISODate(iso);
  if (!p) return "";
  return DAY_SHORT[fromISO(iso).getDay()];
}

export function weekLabel(start: string, end: string, weekStart: 0 | 1): string {
  const s = parseISODate(start);
  const e = parseISODate(end);
  if (!s || !e) return "";
  const fmt = (p: { d: number; m: number; y: number }) =>
    `${p.d} ${MONTH_NAMES[p.m].slice(0, 3)}${p.y !== e.y ? ` ${p.y}` : ""}`;
  return `${fmt(s)} – ${fmt(e)}${weekStart === 1 ? " (Sen–Min)" : " (Min–Sab)"}`;
}
