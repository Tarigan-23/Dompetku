import Dexie, { type Table } from "dexie";
import {
  APP_VERSION,
  DB_VERSION,
  DEFAULT_SETTINGS,
  type Category,
  type Settings,
  type Transaction,
} from "@/lib/types";
import { isValidISODate, isValidTime } from "@/lib/date";

export class DompetKuDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("dompetku");

    // Versi 1 — rilis awal
    this.version(1).stores({
      transactions: "uid, date, type, categoryId, createdAt, [type+date], [categoryId+date]",
      categories: "uid, type, name, archived, sortOrder, [type+archived]",
      settings: "key",
    });

    // Versi 2 — menambah indeks [type+archived] & normalisasi field lama.
    // Upgrade aman: data lama tetap utuh, hanya diisi nilai default bila kosong.
    this.version(2)
      .stores({
        transactions: "uid, date, type, categoryId, createdAt, updatedAt, [type+date], [categoryId+date]",
        categories: "uid, type, name, archived, sortOrder, [type+archived], [type+name]",
        settings: "key",
      })
      .upgrade(async (tx) => {
        await tx
          .table("transactions")
          .toCollection()
          .modify((t: Record<string, unknown>) => {
            if (typeof t.updatedAt !== "number") t.updatedAt = t.createdAt ?? Date.now();
            if (typeof t.note !== "string") t.note = "";
            if (typeof t.time !== "string") t.time = "";
          });
        await tx
          .table("categories")
          .toCollection()
          .modify((c: Record<string, unknown>) => {
            if (typeof c.archived !== "boolean") c.archived = false;
            if (typeof c.sortOrder !== "number") c.sortOrder = 0;
          });
      });
  }
}

export const db = new DompetKuDB();

/* ------------------------------------------------------------------ */
/* Kategori bawaan                                                     */
/* ------------------------------------------------------------------ */

const EXPENSE_DEFAULTS: Array<[string, string, string]> = [
  ["Makan", "🍚", "#f97316"],
  ["Minuman", "☕", "#d9a35b"],
  ["BBM", "⛽", "#f43f5e"],
  ["Transportasi", "🚌", "#60a5fa"],
  ["Parkir", "🅿️", "#38bdf8"],
  ["Belanja kebutuhan", "🛒", "#a78bfa"],
  ["Pulsa dan internet", "📱", "#22d3ee"],
  ["Tagihan listrik dan air", "💡", "#facc15"],
  ["Kos atau tempat tinggal", "🏠", "#34d399"],
  ["Pendidikan", "📚", "#818cf8"],
  ["Kesehatan", "🩺", "#4ade80"],
  ["Hiburan", "🎬", "#fb7185"],
  ["Cicilan", "💳", "#f472b6"],
  ["Sedekah atau donasi", "🤲", "#2dd4bf"],
  ["Lainnya", "📦", "#94a3b8"],
];

const INCOME_DEFAULTS: Array<[string, string, string]> = [
  ["Gaji", "💼", "#10b981"],
  ["Lemburan", "⏱️", "#34d399"],
  ["Bonus", "🎁", "#4ade80"],
  ["Usaha atau bisnis", "🏪", "#22d3ee"],
  ["Freelance", "💻", "#60a5fa"],
  ["Komisi", "🧾", "#a78bfa"],
  ["Hadiah", "🎉", "#f472b6"],
  ["Bunga atau pendapatan lainnya", "🏦", "#facc15"],
  ["Pengembalian uang", "↩️", "#38bdf8"],
  ["Lainnya", "📦", "#94a3b8"],
];

function makeCategory(type: "income" | "expense", name: string, icon: string, color: string, order: number): Category {
  return {
    uid: `cat-${type}-${slug(name)}`,
    type,
    name,
    icon,
    color,
    archived: false,
    sortOrder: order,
    createdAt: Date.now(),
  };
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "x"
  );
}

export function defaultCategories(): Category[] {
  const list: Category[] = [];
  EXPENSE_DEFAULTS.forEach(([name, icon, color], i) => list.push(makeCategory("expense", name, icon, color, i)));
  INCOME_DEFAULTS.forEach(([name, icon, color], i) => list.push(makeCategory("income", name, icon, color, i)));
  return list;
}

export const SETTINGS_KEY = "app";

/* ------------------------------------------------------------------ */
/* Inisialisasi                                                        */
/* ------------------------------------------------------------------ */

let initPromise: Promise<void> | null = null;

/** Buka database, isi kategori bawaan & pengaturan bila belum ada (idempoten). */
export function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await db.open();
    const count = await db.categories.count();
    if (count === 0) {
      await db.transaction("rw", db.categories, async () => {
        await db.categories.bulkPut(defaultCategories());
      });
    }
    const existing = await db.settings.get(SETTINGS_KEY);
    if (!existing) {
      await db.settings.put({ key: SETTINGS_KEY, value: DEFAULT_SETTINGS });
    }
  })();
  return initPromise;
}

/* ------------------------------------------------------------------ */
/* Normalisasi & validasi data                                         */
/* ------------------------------------------------------------------ */

export function normalizeTransaction(raw: unknown): Transaction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r.type === "income" || r.type === "expense" ? r.type : null;
  const amount = Number(r.amount);
  const categoryId = typeof r.categoryId === "string" ? r.categoryId : "";
  const date = typeof r.date === "string" ? r.date : "";
  if (!type) return null;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 9_999_999_999) return null;
  if (!categoryId) return null;
  if (!isValidISODate(date)) return null;
  const time = typeof r.time === "string" && isValidTime(r.time) ? r.time : "";
  const note = typeof r.note === "string" ? r.note.slice(0, 300) : "";
  const createdAt = Number.isFinite(Number(r.createdAt)) ? Number(r.createdAt) : Date.now();
  const uid = typeof r.uid === "string" && r.uid.length >= 4 ? r.uid : createId();
  return {
    uid,
    type,
    amount,
    categoryId,
    date,
    time,
    note: note.trim(),
    createdAt,
    updatedAt: Number.isFinite(Number(r.updatedAt)) ? Number(r.updatedAt) : createdAt,
  };
}

export function normalizeCategory(raw: unknown): Category | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r.type === "income" || r.type === "expense" ? r.type : null;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!type || !name) return null;
  return {
    uid: typeof r.uid === "string" && r.uid.length >= 3 ? r.uid : createId("cat"),
    type,
    name: name.slice(0, 40),
    icon: typeof r.icon === "string" && r.icon ? r.icon.slice(0, 8) : "📦",
    color: /^#[0-9a-fA-F]{6}$/.test(String(r.color)) ? String(r.color) : "#34d399",
    archived: Boolean(r.archived),
    sortOrder: Number.isFinite(Number(r.sortOrder)) ? Number(r.sortOrder) : 99,
    createdAt: Number.isFinite(Number(r.createdAt)) ? Number(r.createdAt) : Date.now(),
  };
}

export function normalizeSettings(raw: unknown): Settings {
  const base = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const out: Settings = { ...base };
  const initial = Number(r.initialBalance);
  out.initialBalance = Number.isSafeInteger(initial) ? Math.max(0, Math.min(initial, 9_999_999_999)) : 0;
  out.onboarded = Boolean(r.onboarded);
  const formats = ["dd/MM/yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "d MMMM yyyy"];
  out.dateFormat = formats.includes(String(r.dateFormat)) ? (r.dateFormat as Settings["dateFormat"]) : base.dateFormat;
  out.weekStart = r.weekStart === 0 ? 0 : 1;
  out.hideAmounts = Boolean(r.hideAmounts);
  out.reduceMotion = Boolean(r.reduceMotion);
  out.updatedAt = Number.isFinite(Number(r.updatedAt)) ? Number(r.updatedAt) : 0;
  return out;
}

export function createId(prefix = "tx"): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `${prefix}_${cryptoObj.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Backup / restore / reset                                            */
/* ------------------------------------------------------------------ */

export interface BackupFile {
  app: string;
  version: number;
  appVersion: string;
  exportedAt: string;
  settings: Settings;
  categories: Category[];
  transactions: Transaction[];
}

export function buildBackup(
  settings: Settings,
  categories: Category[],
  transactions: Transaction[],
): BackupFile {
  return {
    app: "DompetKu",
    version: DB_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    categories,
    transactions,
  };
}

export interface RestoreResult {
  settings: Settings;
  categories: Category[];
  transactions: Transaction[];
  skipped: number;
}

/** Validasi struktur file backup sebelum dipulihkan. Melempar Error bila tidak valid. */
export function parseBackup(text: string): RestoreResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File bukan JSON yang valid.");
  }
  if (!data || typeof data !== "object") throw new Error("Struktur file backup tidak dikenali.");
  const obj = data as Record<string, unknown>;
  if (obj.app && typeof obj.app === "string" && !/dompetku/i.test(obj.app)) {
    throw new Error("File ini bukan backup DompetKu.");
  }
  if (!Array.isArray(obj.categories) || !Array.isArray(obj.transactions)) {
    throw new Error("File backup tidak memuat daftar kategori dan transaksi.");
  }
  const categories: Category[] = [];
  const seenCat = new Set<string>();
  let skipped = 0;
  for (const raw of obj.categories) {
    const cat = normalizeCategory(raw);
    if (!cat) {
      skipped++;
      continue;
    }
    if (seenCat.has(cat.uid)) {
      skipped++;
      continue;
    }
    seenCat.add(cat.uid);
    categories.push(cat);
  }
  const transactions: Transaction[] = [];
  const seenTx = new Set<string>();
  for (const raw of obj.transactions) {
    const tx = normalizeTransaction(raw);
    if (!tx || seenTx.has(tx.uid)) {
      skipped++;
      continue;
    }
    if (!seenCat.has(tx.categoryId)) {
      skipped++;
      continue;
    }
    seenTx.add(tx.uid);
    transactions.push(tx);
  }
  if (categories.length === 0) throw new Error("Backup tidak memiliki kategori yang valid.");
  return { settings: normalizeSettings(obj.settings), categories, transactions, skipped };
}

export async function resetDatabase(): Promise<void> {
  await db.transaction("rw", db.transactions, db.categories, db.settings, async () => {
    await db.transactions.clear();
    await db.settings.clear();
    await db.categories.clear();
    await db.categories.bulkPut(defaultCategories());
    await db.settings.put({ key: SETTINGS_KEY, value: DEFAULT_SETTINGS });
  });
}
