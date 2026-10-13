import type { SVGProps } from "react";

/**
 * Seluruh ikon antarmuka digambar sebagai SVG lokal.
 * Tidak ada font ikon atau aset dari CDN agar aplikasi tetap berjalan offline.
 */
const PATHS: Record<string, string> = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6V11h-6v9Zm0-16v4h6V4h-6Z",
  receipt:
    "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h3",
  chart: "M4 20V10m5 10V4m5 16v-7m5 7V8",
  settings:
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.14-1.5l2-1.4-2-3.4-2.3.9a8 8 0 0 0-2.6-1.5L14.6 2H9.4L9 5.1a8 8 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.4A8 8 0 0 0 4 12c0 .5.05 1 .14 1.5l-2 1.4 2 3.4 2.3-.9a8 8 0 0 0 2.6 1.5l.4 3.1h5.2l.4-3.1a8 8 0 0 0 2.6-1.5l2.3.9 2-3.4-2-1.4c.09-.5.14-1 .14-1.5Z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5.5-1.5L21 21",
  filter: "M4 5h16M7 12h10M10 19h4",
  edit: "M4 20h4l10-10-4-4L4 16v4Zm10-14 4 4",
  trash: "M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6M14 11v6",
  download: "M12 4v11m0 0 4-4m-4 4-4-4M4 20h16",
  upload: "M12 20V9m0 0 4 4m-4-4-4 4M4 4h16",
  print: "M7 8V4h10v4M7 18H5v-6h14v6h-2M7 14h10v6H7v-6Z",
  close: "M6 6l12 12M18 6 6 18",
  chevronLeft: "M14 6l-6 6 6 6",
  chevronRight: "M10 6l6 6-6 6",
  chevronDown: "M6 10l6 6 6-6",
  check: "M5 13l4 4L19 7",
  warning: "M12 4l9 16H3l9-16Zm0 5v6m0 3h.01",
  calendar: "M4 8h16M8 4v3m8-3v3M5 8v12h14V8M8 12h3m5 0h.01M8 16h3m5 0h.01",
  wallet: "M3 8V6a2 2 0 0 1 2-2h11v4m0 0H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2H3m14 5h.01",
  arrowUp: "M12 20V5m0 0-6 6m6-6 6 6",
  arrowDown: "M12 4v15m0 0 6-6m-6 6-6-6",
  tag: "M4 12V5h7l9 9-7 7-9-9Zm3.5-4.5h.01",
  archive: "M4 7h16v3H4V7Zm1 3v10h14V10M10 14h4",
  refresh: "M4 12a8 8 0 0 1 13.7-5.7L20 8M20 4v4h-4m4 8a8 8 0 0 1-13.7 5.7L4 16m0 4v-4h4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13h.01M11 12h1v5h1",
  eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  eyeOff: "M4 4l16 16M9.5 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 6 10 6a17 17 0 0 1-2.4 3M6.2 7.7A17 17 0 0 0 2 11s3.5 6 10 6c1 0 1.9-.1 2.7-.4",
  menu: "M4 7h16M4 12h16M4 17h16",
  save: "M5 4h11l3 3v13H5V4Zm3 0v6h7V4m-7 11h7",
  swap: "M4 8h12m0 0-3-3m3 3-3 3M20 16H8m0 0 3-3m-3 3 3 3",
  scale: "M12 4v16M6 8h12M6 8 3 15h6L6 8Zm12 0-3 7h6l-3-7Z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Zm-3 9 2 2 4-4",
  cloudOff: "M4 4l16 16M8 19h9a3.5 3.5 0 0 0 .5-7 5.5 5.5 0 0 0-8-3.4",
};

export type IconName = keyof typeof PATHS;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: string;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  const d = PATHS[name] ?? PATHS.info;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}

/** Palet ikon kategori (emoji lokal — tidak memuat aset eksternal) */
export const EMOJI_PALETTE: string[] = [
  "🍚", "🍜", "🥗", "🍞", "☕", "🧋", "🥤", "🍺",
  "⛽", "🚌", "🚆", "🛵", "🚗", "🅿️", "🛒", "🧺",
  "📱", "💡", "💧", "🏠", "🏢", "📚", "✏️", "🎓",
  "🩺", "💊", "🏥", "🎬", "🎮", "🎵", "⚽", "🏋️",
  "💳", "🏦", "🧾", "🤲", "🎁", "💼", "⏱️", "💻",
  "🏪", "↩️", "🐾", "👶", "👕", "✂️", "🧴", "🔧",
  "✈️", "🚀", "🌱", "📈", "🔒", "📦",
];

export const COLOR_PALETTE: string[] = [
  "#10b981", "#34d399", "#4ade80", "#22d3ee", "#38bdf8", "#60a5fa",
  "#818cf8", "#a78bfa", "#c084fc", "#f472b6", "#fb7185", "#f87171",
  "#f97316", "#fb923c", "#facc15", "#eab308", "#d9a35b", "#94a3b8",
];

export function CategoryAvatar({
  icon,
  color,
  size = 38,
  rounded = "rounded-xl",
}: {
  icon: string;
  color: string;
  size?: number;
  rounded?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${rounded} border`}
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 38%, transparent)`,
        fontSize: size * 0.5,
        lineHeight: 1,
      }}
    >
      <span className="leading-none">{icon}</span>
    </span>
  );
}
