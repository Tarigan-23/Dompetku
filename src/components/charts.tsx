import { useMemo, useState } from "react";
import { cn } from "@/utils/cn";
import { formatNumber, formatRupiahShort } from "@/lib/money";
import type { MonthlyTrend } from "@/lib/stats";
import { Money } from "./ui";

function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(value));
  const scaled = value / pow;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * pow;
}

/* ------------------------------------------------------------------ */
/* Grafik batang: pemasukan vs pengeluaran                            */
/* ------------------------------------------------------------------ */

export function IncomeExpenseBars({ data, onSelect }: { data: MonthlyTrend[]; onSelect?: (t: MonthlyTrend) => void }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 340;
  const H = 170;
  const padL = 4;
  const padB = 20;
  const padT = 6;
  const max = useMemo(
    () => niceMax(Math.max(1, ...data.flatMap((d) => [d.income, d.expense]))),
    [data],
  );
  const slot = (W - padL * 2) / Math.max(1, data.length);
  const barW = Math.max(6, Math.min(16, slot / 2.8));
  const plotH = H - padB - padT;

  const current = active !== null ? data[active] : data[data.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2 pb-2">
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-mint-500" /> Pemasukan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-flame-500" /> Pengeluaran
          </span>
        </div>
        {current && (
          <div className="text-right text-[11px] leading-tight">
            <p className="font-medium text-slate-300">
              {current.label} {current.year}
            </p>
            <p className="text-slate-500">
              <span className="text-mint-400">+{formatRupiahShort(current.income)}</span>
              {" · "}
              <span className="text-flame-400">−{formatRupiahShort(current.expense)}</span>
            </p>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik pemasukan dan pengeluaran bulanan">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padL}
            y1={padT + plotH * f}
            y2={padT + plotH * f}
            stroke="#1c2723"
            strokeWidth={1}
          />
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const hIn = (d.income / max) * plotH;
          const hEx = (d.expense / max) * plotH;
          const isActive = active === i;
          return (
            <g
              key={`${d.year}-${d.month}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={() => onSelect?.(d)}
              className="cursor-pointer"
            >
              <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
              <rect
                x={cx - barW - 1}
                y={padT + plotH - hIn}
                width={barW}
                height={Math.max(hIn, d.income > 0 ? 2 : 0)}
                rx={3}
                className="bar-grow"
                fill={isActive ? "#34d399" : "#10b981"}
                style={{ animationDelay: `${i * 40}ms` }}
              />
              <rect
                x={cx + 1}
                y={padT + plotH - hEx}
                width={barW}
                height={Math.max(hEx, d.expense > 0 ? 2 : 0)}
                rx={3}
                className="bar-grow"
                fill={isActive ? "#fb923c" : "#f97316"}
                style={{ animationDelay: `${i * 40 + 60}ms` }}
              />
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                fontSize={9}
                fill={isActive ? "#a7f3d0" : "#64748b"}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-slate-500">
        Skala maksimum {formatRupiahShort(max)} · arahkan kursor ke batang untuk detail
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Diagram donat: komposisi kategori                                   */
/* ------------------------------------------------------------------ */

export interface Slice {
  label: string;
  value: number;
  color: string;
  icon?: string;
  count?: number;
  pct?: number;
}

export function DonutChart({ slices, total, centerLabel }: { slices: Slice[]; total: number; centerLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const size = 150;
  const stroke = 18;
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const usable = slices.filter((s) => s.value > 0);
  // Bila kategori terlalu banyak, gabungkan sisanya menjadi "Lainnya" agar legenda tetap terbaca.
  let shown: Slice[] = usable;
  if (usable.length > 8) {
    const head = usable.slice(0, 7);
    const tail = usable.slice(7);
    shown = [
      ...head,
      {
        label: `Lainnya (${tail.length} kategori)`,
        value: tail.reduce((s, x) => s + x.value, 0),
        color: "#475569",
        icon: "📦",
      },
    ];
  }

  let offset = 0;
  const arcs = shown.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0;
    const len = frac * c;
    const arc = { s, i, len, offset };
    offset += len;
    return arc;
  });

  const activeSlice = active !== null && shown[active] ? shown[active] : null;

  if (usable.length === 0) {
    return (
      <div className="flex h-[150px] flex-col items-center justify-center gap-2 text-center">
        <span className="text-2xl">🪙</span>
        <p className="text-xs text-slate-500">Belum ada data untuk ditampilkan</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Diagram donat kategori">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#17201c" strokeWidth={stroke} />
          {arcs.map(({ s, i, len, offset: off }) => (
            <circle
              key={`${s.label}-${i}`}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={active === i ? stroke + 4 : stroke}
              strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`}
              strokeDashoffset={-off}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className="cursor-pointer transition-all duration-200"
              opacity={active === null || active === i ? 1 : 0.55}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">{centerLabel}</span>
          {activeSlice ? (
            <>
              <span className="mt-0.5 max-w-[86px] truncate text-[11px] font-medium text-slate-200">
                {activeSlice.icon ? `${activeSlice.icon} ` : ""}
                {activeSlice.label}
              </span>
              <Money value={activeSlice.value} className="text-sm font-semibold" />
              <span className="text-[10px] text-slate-500">
                {((activeSlice.value / total) * 100).toFixed(1).replace(".", ",")}%
              </span>
            </>
          ) : (
            <Money value={total} className="mt-0.5 text-base font-semibold" />
          )}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {shown.map((s, i) => (
          <li
            key={`${s.label}-legend-${i}`}
            onMouseEnter={() => setActive(usable.indexOf(s) >= 0 ? usable.indexOf(s) : null)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors",
              active === usable.indexOf(s) ? "bg-base-800" : "",
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-300">
              {s.icon ? `${s.icon} ` : ""}
              {s.label}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-slate-400">{formatRupiahShort(s.value)}</span>
            <span className="w-11 shrink-0 text-right text-slate-500">
              {((s.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grafik batang harian                                                */
/* ------------------------------------------------------------------ */

export function DailyBars({
  data,
  labels,
}: {
  data: Array<{ income: number; expense: number }>;
  labels: string[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const W = 340;
  const H = 130;
  const padB = 18;
  const padT = 6;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.income, d.expense])));
  const slot = W / Math.max(1, data.length);
  const barW = Math.max(4, Math.min(12, slot / 3));
  const plotH = H - padB - padT;
  const current = active !== null ? data[active] : null;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik harian">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={padT + plotH * f} y2={padT + plotH * f} stroke="#1c2723" />
        ))}
        {data.map((d, i) => {
          const cx = slot * i + slot / 2;
          const hIn = (d.income / max) * plotH;
          const hEx = (d.expense / max) * plotH;
          return (
            <g key={i} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
              <rect x={slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
              <rect
                x={cx - barW - 1}
                y={padT + plotH - hIn}
                width={barW}
                height={Math.max(hIn, d.income > 0 ? 2 : 0)}
                rx={2}
                fill="#10b981"
                opacity={active === null || active === i ? 1 : 0.5}
              />
              <rect
                x={cx + 1}
                y={padT + plotH - hEx}
                width={barW}
                height={Math.max(hEx, d.expense > 0 ? 2 : 0)}
                rx={2}
                fill="#f97316"
                opacity={active === null || active === i ? 1 : 0.5}
              />
              <text x={cx} y={H - 5} textAnchor="middle" fontSize={8} fill="#64748b">
                {labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 h-4 text-center text-[11px] text-slate-400">
        {current ? (
          <>
            {labels[active ?? 0]} · <span className="text-mint-400">+{formatNumber(current.income)}</span> ·{" "}
            <span className="text-flame-400">−{formatNumber(current.expense)}</span>
          </>
        ) : (
          <span className="text-slate-600">Arahkan kursor ke batang untuk detail harian</span>
        )}
      </p>
    </div>
  );
}
