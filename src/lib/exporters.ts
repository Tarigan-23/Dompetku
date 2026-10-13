import type { BackupFile } from "@/db/db";
import { formatDate, formatTimeLabel } from "./date";
import { formatNumber } from "./money";
import type { Category, Settings, Transaction } from "./types";

/** Unduh berkas secara lokal (tanpa server). */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEADERS = [
  "Tanggal",
  "Waktu",
  "Jenis",
  "Kategori",
  "Nominal (Rp)",
  "Catatan",
  "ID Transaksi",
  "Dibuat Pada",
];

/**
 * Ekspor transaksi ke CSV (pemisah ";" + BOM UTF-8 agar langsung rapi di Microsoft Excel Indonesia).
 */
export function transactionsToCSV(
  transactions: Transaction[],
  categories: Category[],
  settings: Settings,
): string {
  const catName = new Map(categories.map((c) => [c.uid, `${c.icon} ${c.name}`.trim()]));
  const rows = [CSV_HEADERS.join(";")];
  for (const t of transactions) {
    rows.push(
      [
        formatDate(t.date, settings.dateFormat),
        t.time ? formatTimeLabel(t.time) : "",
        t.type === "income" ? "Pemasukan" : "Pengeluaran",
        catName.get(t.categoryId) ?? "Kategori terhapus",
        t.amount,
        t.note,
        t.uid,
        new Date(t.createdAt).toISOString(),
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  return `\ufeff${rows.join("\r\n")}`;
}

export function stampName(prefix: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}

export function backupToJSON(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Ringkasan teks laporan untuk disalin/cetak */
export function reportToText(
  title: string,
  lines: Array<[string, string | number]>,
): string {
  const width = Math.max(...lines.map(([k]) => k.length), 20);
  const body = lines
    .map(([k, v]) => `${k.padEnd(width, ".")}: ${typeof v === "number" ? formatNumber(v) : v}`)
    .join("\n");
  return `${title}\n${"-".repeat(Math.max(title.length, width + 10))}\n${body}\n`;
}
