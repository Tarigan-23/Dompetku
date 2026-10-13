import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/utils/cn";
import { Icon } from "@/lib/icons";
import { formatInputDigits, formatNumber, parseAmount } from "@/lib/money";
import { useApp } from "@/store/AppStore";

/* ------------------------------------------------------------------ */
/* Kartu                                                               */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  printKeep,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  printKeep?: boolean;
}) {
  return (
    <section
      className={cn(
        "print-card rounded-2xl border border-line bg-base-850/70 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]",
        printKeep && "print-keep",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold tracking-tight text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{action}</div>}
        </header>
      )}
      <div className={cn("px-4 py-4 sm:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tombol                                                               */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "expense";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-mint-500 text-base-950 hover:bg-mint-400 active:bg-mint-600 shadow-lg shadow-mint-500/15",
  secondary: "bg-base-700 text-slate-100 hover:bg-base-600 border border-line",
  ghost: "text-slate-300 hover:bg-base-700/70",
  danger: "bg-rose-500/90 text-white hover:bg-rose-450",
  outline: "border border-line text-slate-200 hover:border-mint-500/60 hover:text-mint-300 bg-base-850/60",
  expense: "bg-flame-500 text-white hover:bg-flame-400 shadow-lg shadow-flame-500/15",
};

type Size = "sm" | "md" | "lg" | "icon";

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-500/50",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-300">
        {label}
        {required && <span className="text-mint-400">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-start gap-1 text-xs text-rose-450">
          <Icon name="warning" size={13} className="mt-0.5 shrink-0" />
          {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-base-600 bg-base-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-mint-500 focus:ring-2 focus:ring-mint-500/15 disabled:opacity-60";

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(inputBase, "appearance-none pr-9 [&>option]:bg-base-800 [&>option]:text-slate-100", className)}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

export function Textarea({ className, ...rest }: InputHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-20 resize-y", className)} {...rest} />;
}

/** Input nominal dengan pemisah ribuan otomatis */
export function MoneyInput({
  value,
  onChange,
  invalid,
  placeholder = "0",
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
        Rp
      </span>
      <input
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(formatInputDigits(e.target.value))}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text && /\d/.test(text)) {
            e.preventDefault();
            onChange(formatInputDigits(text));
          }
        }}
        className={cn(
          inputBase,
          "pl-10 text-right font-mono text-base tabular-nums tracking-tight",
          invalid && "border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/15",
        )}
      />
    </div>
  );
}

/** Tampilkan nominal sesuai preferensi privasi */
export function Money({
  value,
  type = "neutral",
  className,
  signed,
}: {
  value: number;
  type?: "income" | "expense" | "neutral";
  className?: string;
  signed?: boolean;
}) {
  const { settings } = useApp();
  const color =
    type === "income" ? "text-mint-400" : type === "expense" ? "text-flame-400" : "text-slate-100";
  if (settings.hideAmounts) {
    return <span className={cn("font-mono tabular-nums", color, className)}>Rp••••••</span>;
  }
  const sign = signed && value !== 0 ? (value > 0 ? "+" : "−") : "";
  return (
    <span className={cn("font-mono tabular-nums tracking-tight", color, className)}>
      {sign}Rp{formatNumber(Math.abs(value))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const maxW = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-3xl" : "max-w-lg";

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="anim-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "anim-pop relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-base-850 shadow-2xl sm:rounded-2xl",
          maxW,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-50">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-base-700 hover:text-slate-100"
            aria-label="Tutup"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-line-soft px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  danger = true,
  requireText,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** teks yang harus diketik pengguna untuk konfirmasi berlapis */
  requireText?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setText("");
      setBusy(false);
    }
  }, [open]);
  const id = useId();
  const blocked = Boolean(requireText) && text.trim().toUpperCase() !== (requireText ?? "").toUpperCase();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            disabled={blocked}
            onClick={() => {
              setBusy(true);
              onConfirm();
            }}
          >
            <Icon name={danger ? "trash" : "check"} size={16} />
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            danger ? "bg-rose-500/15 text-rose-450" : "bg-mint-500/15 text-mint-400",
          )}
        >
          <Icon name="warning" size={20} />
        </span>
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-300">{message}</div>
      </div>
      {requireText && (
        <div className="mt-4">
          <Field label={`Ketik "${requireText}" untuk mengonfirmasi`} htmlFor={id}>
            <TextInput id={id} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Lain-lain                                                           */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar inline-flex gap-1 overflow-x-auto rounded-xl border border-line bg-base-900/70 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            value === o.value
              ? "bg-mint-500/15 text-mint-300 shadow-[0_0_0_1px_rgba(16,185,129,0.35)_inset]"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  icon: string;
  tone?: "income" | "expense" | "neutral" | "accent";
  hint?: ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "income"
      ? "text-mint-400 bg-mint-500/10"
      : tone === "expense"
        ? "text-flame-400 bg-flame-500/10"
        : tone === "accent"
          ? "text-mint-300 bg-mint-500/10"
          : "text-slate-300 bg-base-700";
  return (
    <div
      className={cn(
        "print-card rounded-2xl border border-line bg-gradient-to-b from-base-800/90 to-base-850/60 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneClass)}>
          <Icon name={icon} size={16} />
        </span>
        <span className="text-xs font-medium text-slate-400">{label}</span>
      </div>
      <div className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon = "info",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-base-800 text-slate-400">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "income" | "expense" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "bg-base-700 text-slate-300 border-line",
    income: "bg-mint-500/12 text-mint-300 border-mint-500/30",
    expense: "bg-flame-500/12 text-flame-400 border-flame-500/30",
    warn: "bg-amber-500/12 text-amber-300 border-amber-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ToastHost() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "anim-slide-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur",
            t.type === "success" && "border-mint-500/40 bg-base-800/95",
            t.type === "error" && "border-rose-500/40 bg-base-800/95",
            t.type === "info" && "border-line bg-base-800/95",
          )}
          role="status"
        >
          <span
            className={cn(
              "mt-0.5 shrink-0",
              t.type === "success" ? "text-mint-400" : t.type === "error" ? "text-rose-450" : "text-slate-300",
            )}
          >
            <Icon name={t.type === "success" ? "check" : t.type === "error" ? "warning" : "info"} size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-100">{t.title}</p>
            {t.message && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.message}</p>}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:text-slate-200"
            aria-label="Tutup notifikasi"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Baris kategori dengan bar persentase (dipakai di laporan) */
export function CategoryRow({
  icon,
  color,
  name,
  total,
  count,
  pctValue,
  right,
}: {
  icon: string;
  color: string;
  name: string;
  total: ReactNode;
  count: number;
  pctValue: number;
  right?: ReactNode;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (barRef.current) barRef.current.style.width = `${Math.min(100, Math.max(pctValue, pctValue > 0 ? 2 : 0))}%`;
  }, [pctValue]);
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base"
          style={{
            background: `color-mix(in srgb, ${color} 18%, transparent)`,
            borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-medium text-slate-200">{name}</p>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-medium tabular-nums text-slate-100">{total}</span>
              {right}
            </div>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-base-700">
            <div
              ref={barRef}
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: 0, background: color }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {count} transaksi · {pctValue.toFixed(1).replace(".", ",")}% dari total
          </p>
        </div>
      </div>
    </div>
  );
}

export function formatAmountText(value: string): string {
  const n = parseAmount(value);
  return n ? formatNumber(n) : "";
}
