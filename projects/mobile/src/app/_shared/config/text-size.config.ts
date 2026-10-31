/**
 * The app's text follows the phone's text size, within limits. Every size in
 * the theme is rem, so the root font size alone scales the whole interface;
 * this file works out that root size from what the phone reports.
 *
 * The phones report it in two different ways, and each is one factor here
 * (the other one is then 1):
 * - iOS: the `-apple-system-body` font, 17px at the default Dynamic Type
 *   size, larger or smaller with the setting. Nothing else in the WebView
 *   follows it, so the root carries the whole scale.
 * - Android: the WebView's text zoom, the system font scale as a factor
 *   (1.3 at 130%). It multiplies every computed font size, the root's
 *   included, but not the boxes: a rem padding or height stays put. The
 *   cap is the native side's job (MainActivity clamps the text zoom); here
 *   the root only corrects what can be corrected without shrinking a box.
 */
export const TEXT_SIZE = {
  /** iOS's body style at the default Dynamic Type size (Large). */
  iosDefaultBodyPx: 17,
  /**
   * Never below the designed size: the type scale's floor is 11px, the
   * smallest text iOS and Material set, and a smaller phone setting would
   * take kickers and badges under it.
   */
  minScale: 1,
  /**
   * The cap. Past about 130% the rows, bars and tiles built for a phone's
   * width start to break their lines and clip; the largest accessibility
   * sizes reach 300%.
   */
  maxScale: 1.3,
} as const;

/** Readings outside these bounds are a broken measurement, not a setting. */
const PLAUSIBLE_BODY_PX = { min: 8, max: 80 } as const;
const PLAUSIBLE_TEXT_ZOOM = { min: 0.25, max: 4 } as const;

/**
 * The phone's text scale, 1 at the default setting. `appleBodyPx` is the
 * computed size of `-apple-system-body` (null where the platform has no such
 * font), `textZoom` the factor a 100px font size actually renders at.
 */
export function systemTextScale(appleBodyPx: number | null, textZoom: number): number {
  const ios =
    appleBodyPx !== null &&
    Number.isFinite(appleBodyPx) &&
    appleBodyPx >= PLAUSIBLE_BODY_PX.min &&
    appleBodyPx <= PLAUSIBLE_BODY_PX.max
      ? appleBodyPx / TEXT_SIZE.iosDefaultBodyPx
      : 1;
  return ios * plausibleTextZoom(textZoom);
}

/** The scale the app uses: the phone's, held between the floor and the cap. */
export function clampTextScale(scale: number): number {
  if (!Number.isFinite(scale)) return TEXT_SIZE.minScale;
  return Math.min(TEXT_SIZE.maxScale, Math.max(TEXT_SIZE.minScale, scale));
}

/**
 * The root font size, as a percentage of the browser's 16px default; 100
 * means "leave the root alone". Rounded to two decimals.
 *
 * The aim is text at 16px times the clamped scale. Android's text zoom
 * multiplies the root again, so it is divided out, but never below 100%: a
 * smaller root would also shrink every rem box (tap targets included) while
 * the zoom only grows the text. So under a zoom past the cap the text stays
 * the WebView's until the native cap lands, and under a zoom below 1 the
 * text comes back to 16px with the boxes a little roomier.
 */
export function rootFontSizePercent(appleBodyPx: number | null, textZoom: number): number {
  const scale = clampTextScale(systemTextScale(appleBodyPx, textZoom));
  const percent = (scale / plausibleTextZoom(textZoom)) * 100;
  return Math.round(Math.max(100, percent) * 100) / 100;
}

function plausibleTextZoom(textZoom: number): number {
  return Number.isFinite(textZoom) &&
    textZoom >= PLAUSIBLE_TEXT_ZOOM.min &&
    textZoom <= PLAUSIBLE_TEXT_ZOOM.max
    ? textZoom
    : 1;
}
