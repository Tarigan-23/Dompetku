/**
 * Tipe data inti DompetKu.
 * Semua nominal uang disimpan sebagai integer Rupiah bulat (tanpa desimal)
 * untuk menghindari kesalahan floating-point.
 */

export type TxType = "income" | "expense";

export interface Transaction {
  /** ID unik (UUID) — dipakai sebagai primary key di IndexedDB */
  uid: string;
  type: TxType;
  /** Nominal dalam Rupiah bulat, selalu > 0 */
  amount: number;
  categoryId: string;
  /** Format YYYY-MM-DD (tanpa timezone) */
  date: string;
  /** Format HH:MM, string kosong bila tidak diisi */
  time: string;
  note: string;
  /** epoch ms saat data dibuat */
  createdAt: number;
  /** epoch ms saat data terakhir diubah */
  updatedAt: number;
}

export interface Category {
  uid: string;
  type: TxType;
  name: string;
  /** Emoji / nama ikon dari palet ikon lokal */
  icon: string;
  /** Warna heksadesimal, mis. #34d399 */
  color: string;
  archived: boolean;
  sortOrder: number;
  createdAt: number;
}

export type DateFormat = "dd/MM/yyyy" | "dd-MM-yyyy" | "yyyy-MM-dd" | "d MMMM yyyy";

export interface Settings {
  /** Saldo awal aplikasi — BUKAN pemasukan */
  initialBalance: number;
  onboarded: boolean;
  dateFormat: DateFormat;
  /** 0 = Minggu, 1 = Senin */
  weekStart: 0 | 1;
  /** Sembunyikan nominal (privasi) */
  hideAmounts: boolean;
  /** Nonaktifkan animasi */
  reduceMotion: boolean;
  updatedAt: number;
}

export const APP_NAME = "DompetKu";
export const APP_VERSION = "1.0.0";
export const DB_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  initialBalance: 0,
  onboarded: false,
  dateFormat: "dd/MM/yyyy",
  weekStart: 1,
  hideAmounts: false,
  reduceMotion: false,
  updatedAt: 0,
};
