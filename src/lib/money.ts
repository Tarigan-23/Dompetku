/**
 * Utilitas uang — semua perhitungan memakai integer Rupiah bulat.
 * Tidak ada operasi pecahan/koma agar hasil selalu akurat.
 */

export const MAX_AMOUNT = 9_999_999_999;

/** Format angka dengan pemisah ribuan gaya Indonesia: 1500000 -> "1.500.000" */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const neg = value < 0;
  const digits = Math.abs(Math.round(value)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + grouped;
}

/** "Rp1.500.000" — tanpa desimal */
export function formatRupiah(value: number): string {
  return `Rp${formatNumber(value)}`;
}

/** Versi ringkas: Rp1,5 jt / Rp3,4 rb */
export function formatRupiahShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp${trimZero(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}Rp${trimZero(abs / 1_000_000)} jt`;
  if (abs >= 100_000) return `${sign}Rp${trimZero(abs / 1000)} rb`;
  return `${sign}Rp${formatNumber(abs)}`;
}

function trimZero(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded.toString().replace(".", ",");
}

/**
 * Ubah masukan pengguna menjadi integer Rupiah.
 * Menerima "50.000", "50000", "1.500.000", " 1,5 " (dibuang), "Rp 50.000".
 * Mengembalikan null bila tidak valid / kosong.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input);
  }
  const cleaned = input
    .replace(/[^\d]/g, "")
    .replace(/^0+(?=\d)/, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

/** Validasi nominal untuk form. Mengembalikan pesan error (string) atau null bila valid. */
export function validateAmount(input: string | number | null | undefined): string | null {
  const value = parseAmount(input);
  if (value === null) return "Nominal wajib diisi dan harus berupa angka lebih dari 0.";
  if (value <= 0) return "Nominal harus lebih dari 0.";
  if (value > MAX_AMOUNT) return "Nominal terlalu besar (maksimal Rp9.999.999.999).";
  return null;
}

/** Format input bertahap saat mengetik: 50000 -> "50.000" */
export function formatInputDigits(input: string): string {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return "";
  return formatNumber(Number(digits));
}

/** Persentase aman (denominator 0 -> 0) */
export function pct(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

/** Format persen dengan 1 desimal: 12,5% */
export function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toString().replace(".", ",")}%`;
}

export function formatDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "—" : "baru";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${(Math.round(change * 10) / 10).toString().replace(".", ",")}%`;
}
