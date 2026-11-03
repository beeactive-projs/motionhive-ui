/**
 * How every QR code in the product is drawn, for `toString` from `qrcode`:
 * web's share dialog and the mobile app's profile share sheet both pass it.
 *
 * SVG so it stays crisp at any size. Always dark on white, dark mode
 * included: a scanner needs the contrast, and an inverted code reads badly on
 * many of them. The colours are the code's, not the theme's, and the
 * one-module white margin travels with the image, so it scans on any surface.
 *
 * The encoder itself stays out of core: each app loads it on demand with
 * `await import('qrcode')` (it is a large table of constants only the share
 * screens need), so the apps that never draw a code never bundle it.
 *
 * The SVG it emits holds only the code's path data, never the encoded text,
 * so it is safe to trust into `[innerHTML]`. It has to be: Angular strips the
 * `<path>` out of an untrusted SVG string.
 */
export const QR_CODE_SVG_OPTIONS = {
  type: 'svg',
  margin: 1,
  errorCorrectionLevel: 'M',
  color: { dark: '#000000', light: '#ffffff' },
} as const;
