/**
 * MotionHive hexagon system — shared types + tone presets.
 *
 * Ported from the `Hexagon System.html` design (true rounded-vertex geometry,
 * independent bg / fg / ring props). Colors reference the app's theme tokens
 * so the hex re-tints with the palette / dark mode, with the design's exact
 * hex values kept as fallbacks for surfaces that don't bridge the token.
 */

/** Pointed up/down (logo + legacy app) vs pointed left/right (design file). */
export type HexOrientation = 'flat' | 'pointy';

/** Presence dot rendered bottom-right of the hex. */
export type HexStatus = 'online' | 'busy' | 'offline';

/** Named combinations of background + inner color + ring for recurring cases. */
export type HexTone =
  | 'navy'
  | 'navySolid'
  | 'amber'
  | 'amberSoft'
  | 'ghost'
  | 'outline'
  | 'slate'
  | 'success'
  | 'onDark'
  | 'gradient'
  | 'coral'
  | 'coralSoft'
  | 'teal'
  | 'tealSoft';

export interface HexToneSpec {
  /** Fill of the hex body. `'transparent'` skips the body, `'__grad'` = gradient. */
  bg: string;
  /** Color of the inner content (text / icon / projected glyph). */
  fg: string;
  /** Ring stroke color (`''` = no ring). */
  ring: string;
  /** Ring stroke width in the 100-unit viewBox (0 = no ring). */
  ringW: number;
}

/** Used when no tone and no explicit bg/fg are supplied. */
export const DEFAULT_TONE: HexToneSpec = {
  bg: 'var(--color-navy-800, #12233d)',
  fg: 'var(--color-primary-400, #fbbf24)',
  ring: '',
  ringW: 0,
};

/** Gradient stops for the `gradient` tone (amber → navy, top-left → bottom-right). */
export const GRADIENT_FROM = 'var(--color-primary-400, #fbbf24)';
export const GRADIENT_TO = 'var(--color-navy-700, #162b48)';

export const TONES: Record<HexTone, HexToneSpec> = {
  navy: { bg: 'var(--color-navy-800, #12233d)', fg: 'var(--color-primary-400, #fbbf24)', ring: '', ringW: 0 },
  navySolid: { bg: 'var(--color-navy-800, #12233d)', fg: '#ffffff', ring: '', ringW: 0 },
  amber: { bg: 'var(--color-primary-500, #f59e0b)', fg: 'var(--color-navy-900, #0e1b31)', ring: '', ringW: 0 },
  amberSoft: { bg: 'var(--color-primary-100, #fef3c7)', fg: 'var(--color-primary-700, #b45309)', ring: '', ringW: 0 },
  ghost: { bg: '#ffffff', fg: 'var(--color-navy-800, #12233d)', ring: 'var(--p-surface-200, #e2e8f0)', ringW: 3 },
  outline: { bg: 'transparent', fg: 'var(--color-primary-600, #d97706)', ring: 'var(--color-primary-500, #f59e0b)', ringW: 4 },
  slate: { bg: 'var(--p-surface-100, #f1f5f9)', fg: 'var(--p-surface-600, #475569)', ring: '', ringW: 0 },
  success: { bg: 'var(--p-green-50, #ecfdf5)', fg: 'var(--p-green-600, #059669)', ring: '', ringW: 0 },
  onDark: { bg: 'rgba(255,255,255,.08)', fg: '#ffffff', ring: 'rgba(255,255,255,.16)', ringW: 2 },
  gradient: { bg: '__grad', fg: '#ffffff', ring: '', ringW: 0 },
  coral: { bg: 'var(--color-coral-500, #f97066)', fg: '#ffffff', ring: '', ringW: 0 },
  coralSoft: { bg: 'var(--color-coral-100, #ffe4dc)', fg: 'var(--color-coral-700, #c4392f)', ring: '', ringW: 0 },
  teal: { bg: 'var(--color-accent-500, #14b8a6)', fg: '#ffffff', ring: '', ringW: 0 },
  tealSoft: { bg: 'var(--color-accent-100, #ccfbf1)', fg: 'var(--color-accent-700, #0f766e)', ring: '', ringW: 0 },
};
