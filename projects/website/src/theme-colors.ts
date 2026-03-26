// /**
//  * Single source of truth for the BeeActive color palette.
//  *
//  * - Consumed by PrimeNG via `styles.primeng.ts`
//  * - Bridged to Tailwind automatically through `tailwindcss-primeui`
//  * - Secondary & Accent are Tailwind-only (defined in styles.css @theme)
//  */

// export interface ColorScale {
//   50: string;
//   100: string;
//   200: string;
//   300: string;
//   400: string;
//   500: string;
//   600: string;
//   700: string;
//   800: string;
//   900: string;
//   950: string;
// }

// export interface SurfaceScale {
//   0: string;
//   50: string;
//   100: string;
//   200: string;
//   300: string;
//   400: string;
//   500: string;
//   600: string;
//   700: string;
//   800: string;
//   900: string;
//   950: string;
// }

// /* Primary — Honey Gold */
// export const primary: ColorScale = {
//   50: '#fffbeb',
//   100: '#fef3c7',
//   200: '#fde68a',
//   300: '#fcd34d',
//   400: '#fbbf24',
//   500: '#f59e0b',
//   600: '#d97706',
//   700: '#b45309',
//   800: '#92400e',
//   900: '#78350f',
//   950: '#451a03',
// };

// /* Success */
// export const success: ColorScale = {
//   50: '#ecfdf5',
//   100: '#d1fae5',
//   200: '#a7f3d0',
//   300: '#6ee7b7',
//   400: '#34d399',
//   500: '#10b981',
//   600: '#059669',
//   700: '#047857',
//   800: '#065f46',
//   900: '#064e3b',
//   950: '#022c22',
// };

// /* Info */
// export const info: ColorScale = {
//   50: '#f0f9ff',
//   100: '#e0f2fe',
//   200: '#bae6fd',
//   300: '#7dd3fc',
//   400: '#38bdf8',
//   500: '#0ea5e9',
//   600: '#0284c7',
//   700: '#0369a1',
//   800: '#075985',
//   900: '#0c4a6e',
//   950: '#082f49',
// };

// /* Warning */
// export const warning: ColorScale = {
//   50: '#fffbeb',
//   100: '#fef3c7',
//   200: '#fde68a',
//   300: '#fcd34d',
//   400: '#fbbf24',
//   500: '#f59e0b',
//   600: '#d97706',
//   700: '#b45309',
//   800: '#92400e',
//   900: '#78350f',
//   950: '#451a03',
// };

// /* Danger */
// export const danger: ColorScale = {
//   50: '#fef2f2',
//   100: '#fee2e2',
//   200: '#fecaca',
//   300: '#fca5a5',
//   400: '#f87171',
//   500: '#ef4444',
//   600: '#dc2626',
//   700: '#b91c1c',
//   800: '#991b1b',
//   900: '#7f1d1d',
//   950: '#450a0a',
// };

// /* Surface — Light */
// export const surfaceLight: SurfaceScale = {
//   0: '#ffffff',
//   50: '#f8fafc',
//   100: '#f1f5f9',
//   200: '#e2e8f0',
//   300: '#cbd5e1',
//   400: '#94a3b8',
//   500: '#64748b',
//   600: '#475569',
//   700: '#334155',
//   800: '#1e293b',
//   900: '#0f172a',
//   950: '#020617',
// };

// /* Surface — Dark */
// export const surfaceDark: SurfaceScale = {
//   0: '#0f1720',
//   50: '#1a2332',
//   100: '#212b3d',
//   200: '#293548',
//   300: '#324054',
//   400: '#3d4d62',
//   500: '#4a5b71',
//   600: '#5a6c83',
//   700: '#6d7f96',
//   800: '#8394aa',
//   900: '#9caabf',
//   950: '#b7c2d4',
// };

/**
 * Single source of truth for the BeeActive color palette.
 *
 * - Consumed by PrimeNG via `styles.primeng.ts`
 * - Bridged to Tailwind automatically through `tailwindcss-primeui`
 * - Secondary (Navy) is Tailwind-only (defined in styles.css @theme)
 *
 * Palette derived from the Royal Hive design system (beeactive-dashboard-mockup.html).
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
   Primary — Honey Gold
   Used for: active nav items (dark), CTAs,
   highlight accents, notification dots, badges
   ───────────────────────────────────────────── */
export const primary: ColorScale = {
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

  // 50: '#fffbeb',
  // 100: '#fef3c7',
  // 200: '#fde68a',
  // 300: '#fcd34d',
  // 400: '#fbbf24',
  // 500: '#f59e0b',
  // 600: '#d97706',
  // 700: '#b45309',
  // 800: '#92400e',
  // 900: '#78350f',
  // 950: '#451a03',
};

/* ─────────────────────────────────────────────
   Secondary — Royal Navy
   Tailwind-only (@theme in styles.css).
   Used for: sidebar background (light), active
   nav items (light), chart bars, avatars,
   primary action buttons (light mode)
   ───────────────────────────────────────────── */
export const secondary: ColorScale = {
  // 50: ' #f8fafc', //'#eef4fa',
  // 100: ' #f1f5f9', //'#dce9f5',
  // 200: ' #e2e8f0', //'#b5d2ec',
  // 300: ' #cbd5e1', //'#88b3dd',
  // 400: ' #94a3b8', //'#5a92cc',
  // 500: ' #64748b', //'#3672b4',
  // 600: ' #475569', //'#2e5d96',
  // 700: ' #334155', //'#264b7a',
  // 800: ' #1e293b', //'#1e3a5f',
  // 900: ' #0f172a', //'#0f1720',
  // 950: ' #020617', //'#080e16',
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
  50: '#f6f8fb',
  100: '#f1f5f9',
  200: '#e5e9ef',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#6b7280',
  600: '#9ca3af',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

/* ─────────────────────────────────────────────
   Surface — Dark
   Derived from the dark dashboard:
     0    → deepest background — content area (#0b1017)
     50   → sidebar / topbar background (#0f1720)
     100  → card / stat-card background (#111c2a)
     200  → schedule item / input background (#162030)
     300  → border / divider (#1c2a3a)
     400  → chart-bar-bg / progress-bg (#1c2a3a — same as 300; distinct slot)
     500  → muted icon / placeholder (#4a5e75)
     600  → table-head / sub text (#5a6e84)
     700  → sidebar nav default text (#7a8a9e)
     800  → table row text / hover text (#c8d5e2)
     900  → card title / heading text (#e2e8f0)
     950  → brightest text — logo / stat values (#f0f4f8)
   ───────────────────────────────────────────── */
export const surfaceDark: SurfaceScale = {
  0: '#f0f4f8',
  50: '#e2e8f0',
  100: '#c8d5e2',
  200: '#7a8a9e',
  300: '#5a6e84',
  400: '#4a5e75',
  500: '#293548',
  600: '#1c2a3a',
  700: '#162030',
  800: '#111c2a',
  900: '#0f1720',
  950: '#0b1017',
};
