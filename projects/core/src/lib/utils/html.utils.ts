/** Minimal HTML escape — use whenever interpolating user-supplied
 *  strings into markup rendered with `escape=false` (eg. PrimeNG
 *  tooltips). Mirrors the BE helper in `src/common/utils/html.utils.ts`. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
