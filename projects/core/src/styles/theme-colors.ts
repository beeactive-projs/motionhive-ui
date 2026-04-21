/**
 * Single source of truth for the MotionHive color palette.
 *
 * - Consumed by PrimeNG via `styles.primeng.ts`
 * - Bridged to Tailwind automatically through `tailwindcss-primeui`
 * - Navy is Tailwind-only (defined in theme.css @theme as --color-navy-*)
 */

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface SurfaceScale {
  0: string;
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

/* ─────────────────────────────────────────────
   Primary — Honey Amber
   Used for: CTAs, active nav items (dark),
   highlight accents, notification dots, badges
   ───────────────────────────────────────────── */
export const primary: ColorScale = {
  50: '#FFF8EB',
  100: '#FEEDC7',
  200: '#FDD98A',
  300: '#FCC254',
  400: '#FBAE2C',
  500: '#F59E0B',
  600: '#D97706',
  700: '#B45309',
  800: '#92400E',
  900: '#78350F',
  950: '#451A03',
};

/* ─────────────────────────────────────────────
   Success — Emerald
   Used for: up-trend indicators, active badges,
   progress fills, avatar backgrounds
   ───────────────────────────────────────────── */
export const success: ColorScale = {
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981',
  600: '#059669',
  700: '#047857',
  800: '#065f46',
  900: '#064e3b',
  950: '#022c22',
};

/* ─────────────────────────────────────────────
   Info — Sky Blue
   Used for: info badges, informational states
   ───────────────────────────────────────────── */
export const info: ColorScale = {
  50: '#f0f9ff',
  100: '#e0f2fe',
  200: '#bae6fd',
  300: '#7dd3fc',
  400: '#38bdf8',
  500: '#0ea5e9',
  600: '#0284c7',
  700: '#0369a1',
  800: '#075985',
  900: '#0c4a6e',
  950: '#082f49',
};

/* ─────────────────────────────────────────────
   Warning — Honey Gold (mirrors Primary)
   Warning states share the brand gold palette
   ───────────────────────────────────────────── */
export const warning: ColorScale = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
};

/* ─────────────────────────────────────────────
   Danger — Red
   Used for: down-trend indicators, danger badges,
   overdue/paused states
   ───────────────────────────────────────────── */
export const danger: ColorScale = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#450a0a',
};

/* ─────────────────────────────────────────────
   Surface — Light
   Derived from the light dashboard:
     0    → card / sidebar / topbar background (#ffffff)
     50   → page-level background (#f6f8fb → nearest Tailwind: #f8fafc)
     100  → input / search background (#f1f5f9)
     200  → dividers, borders, chart-bar-bg (#e5e9ef → #e2e8f0)
     300  → muted border variant (#cbd5e1)
     400  → placeholder / icon muted (#94a3b8)
     500  → secondary text / subtitles (#6b7280 → #64748b)
     600  → table sub-text (#9ca3af → #475569)
     700  → body text muted (#334155)
     800  → topbar / primary text (#1e3a5f → #1e293b)
     900  → darkest text — navy-900 (#0f1720 → #0f172a)
     950  → deepest shade (#020617)
   ───────────────────────────────────────────── */
export const surfaceLight: SurfaceScale = {
  0: '#ffffff',
  // 50: '#f6f8fb',
  // 100: '#f1f5f9',
  // 200: '#e5e9ef',
  // 300: '#cbd5e1',
  // 400: '#94a3b8',
  // 500: '#6b7280',
  // 600: '#9ca3af',
  // 700: '#334155',
  // 800: '#1e293b',
  // 900: '#0f172a',
  // 950: '#020617',

  50: '#f0f4f8',
  100: '#d9e2ec',
  200: '#bcccdc',
  300: '#9fb3c8',
  400: '#829ab1',
  500: '#1e3a5f',
  600: '#1a3354',
  700: '#162b48',
  800: '#12233d',
  900: '#0e1b31',
  950: '#0a1323',
};

/* ─────────────────────────────────────────────
   Surface — Dark
   Derived from the Navy palette so dark-mode
   surfaces feel on-brand.
   PrimeNG dark mode: 0 = lightest (text), 950 = deepest (bg).
     0    → brightest text  (#F4F6FA = navy-50)
     50   → heading text    (#E0E5EE = navy-100)
     100  → body text       (#CBD2E0 = navy-200)
     200  → muted text      (#A0A8B8 = navy-300)
     300  → placeholder     (#757E90 = navy-400)
     400  → mid-tone        (#4A5368 = navy-500)
     500  → dark mid-tone   (#3A4256 = navy-600)
     600  → input bg        (#2A3245 = navy-700)
     700  → card bg         (#1A2133 = navy-800)
     800  → page bg         (#131827 = navy-900)  ← .dark body bg
     900  → hero/sidebar bg (#0B0F1C = navy-950)
     950  → deepest bg      (#07090F)
   ───────────────────────────────────────────── */
export const surfaceDark: SurfaceScale = {
  0: '#F4F6FA',
  // 50: '#F4F6FA',
  // 100: '#CBD2E0',
  // 200: '#CBD2E0',
  // 300: '#6B7690',
  // 400: '#4A5368',
  // 500: '#4A5368',
  // 600: '#232B3D',
  // 700: '#1A2133',
  // 800: '#1A2133',
  // 900: '#131827',
  // 950: '#0B0F1C',

  50: '#f0f4f8',
  100: '#d9e2ec',
  200: '#bcccdc',
  300: '#9fb3c8',
  400: '#829ab1',
  500: '#1e3a5f',
  600: '#1a3354',
  700: '#162b48',
  800: '#12233d',
  900: '#0e1b31',
  950: '#0a1323',
};
