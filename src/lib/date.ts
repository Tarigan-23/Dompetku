import type { DateFormat, Transaction } from "./types";

/** Nama bulan Indonesia */
export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/* ------------------------------------------------------------------ */
/* Parsing dasar                                                       */
/* ------------------------------------------------------------------ */

/** "YYYY-MM-DD" -> { y, m (0-11), d } atau null bila tidak valid */
export function parseISODate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const check = new Date(y, m, d);
  if (check.getMonth() !== m || check.getDate() !== d) return null;
  return { y, m, d };
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function nowTime(): string {
  const d = new Date();
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

export function fromISO(iso: string): Date {
  const parsed = parseISODate(iso);
  if (parsed) return new Date(parsed.y, parsed.m, parsed.d);
  return new Date(iso);
}

export function isValidISODate(iso: string): boolean {
  return parseISODate(iso) !== null;
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/* ------------------------------------------------------------------ */
/* Format tampilan                                                     */
/* ------------------------------------------------------------------ */

export function formatDate(iso: string, format: DateFormat): string {
  const parsed = parseISODate(iso);
  if (!parsed) return iso;
  const { y, m, d } = parsed;
  const dd = `${d}`.padStart(2, "0");
  const mm = `${m + 1}`.padStart(2, "0");
  switch (format) {
    case "dd-MM-yyyy":
      return `${dd}-${mm}-${y}`;
    case "yyyy-MM-dd":
      return `${y}-${mm}-${dd}`;
    case "d MMMM yyyy":
      return `${d} ${MONTH_NAMES[m]} ${y}`;
    case "dd/MM/yyyy":
    default:
      return `${dd}/${mm}/${y}`;
  }
}

/** "12/08/2026" atau "12-08-2026" -> "2026-08-12" (null bila tidak valid) */
export function parseUserDate(value: string, format: DateFormat): string | null {
  const raw = (value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return isValidISODate(raw) ? raw : null;
  const sep = format === "dd-MM-yyyy" ? "-" : "/";
  const parts = raw.split(sep);
  if (parts.length !== 3) return null;
  const d = Number(parts[0]);
  const m = Number(parts[1]);
  const y = Number(parts[2]);
  if (!d || !m || !y || y < 1900 || y > 2999) return null;
  const iso = `${y}-${`${m}`.padStart(2, "0")}-${`${d}`.padStart(2, "0")}`;
  return isValidISODate(iso) ? iso : null;
}

export function formatLongDate(iso: string): string {
  const parsed = parseISODate(iso);
  if (!parsed) return iso;
  const dt = new Date(parsed.y, parsed.m, parsed.d);
  return `${DAY_NAMES[dt.getDay()]}, ${parsed.d} ${MONTH_NAMES[parsed.m]} ${parsed.y}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** "09:05" -> "09.05" untuk tampilan yang konsisten */
export function formatTimeLabel(time: string): string {
  return (time || "").replace(":", ".");
}

/* ------------------------------------------------------------------ */
/* Perhitungan periode                                                 */
/* ------------------------------------------------------------------ */

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function addDaysISO(iso: string, delta: number): string {
  const parsed = parseISODate(iso);
  if (!parsed) return iso;
  const d = new Date(parsed.y, parsed.m, parsed.d);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

/** Kunci bulan "YYYY-MM" untuk pengelompokan cepat */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Rentang ISO [mulai, selesai] dari pekan berisi `iso` */
export function weekRange(iso: string, weekStart: 0 | 1): { start: string; end: string } {
  const parsed = parseISODate(iso);
  if (!parsed) return { start: iso, end: iso };
  const d = new Date(parsed.y, parsed.m, parsed.d);
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  const start = toISODate(d);
  const end = addDaysISO(start, 6);
  return { start, end };
}

export function addWeeks(iso: string, weeks: number, weekStart: 0 | 1): string {
  const { start } = weekRange(iso, weekStart);
  return addDaysISO(start, weeks * 7);
}

/** Daftar tanggal ISO dalam sebulan */
export function monthDates(year: number, month: number): string[] {
  const total = daysInMonth(year, month);
  const list: string[] = [];
  for (let d = 1; d <= total; d++) {
    list.push(`${year}-${`${month + 1}`.padStart(2, "0")}-${`${d}`.padStart(2, "0")}`);
  }
  return list;
}

export function datesBetween(startISO: string, endISO: string): string[] {
  if (!startISO || !endISO || startISO > endISO) return [];
  const out: string[] = [];
  let cursor = startISO;
  let guard = 0;
  while (cursor <= endISO && guard < 4000) {
    out.push(cursor);
    cursor = addDaysISO(cursor, 1);
    guard++;
  }
  return out;
}

/** Urutan kronologis transaksi (tanggal + waktu + waktu dibuat) */
export function sortChronological(list: Transaction[], asc = true): Transaction[] {
  const copy = [...list];
  copy.sort((a, b) => {
    const ka = `${a.date}T${a.time || "00:00"}`;
    const kb = `${b.date}T${b.time || "00:00"}`;
    if (ka !== kb) return asc ? ka.localeCompare(kb) : kb.localeCompare(ka);
    if (a.createdAt !== b.createdAt) return asc ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
    return asc ? a.uid.localeCompare(b.uid) : b.uid.localeCompare(a.uid);
  });
  return copy;
}

/** Perbedaan hari antar dua tanggal ISO (a - b) */
export function diffDays(aISO: string, bISO: string): number {
  const a = fromISO(aISO).getTime();
  const b = fromISO(bISO).getTime();
  return Math.round((a - b) / 86_400_000);
}
