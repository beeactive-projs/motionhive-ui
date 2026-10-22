/**
 * Whether the reader asked the OS for less motion.
 *
 * Read at the moment it matters rather than cached: the setting can change
 * while the app is open, and a cached answer would strand whoever changed it
 * with the behaviour they just turned off.
 *
 * Guarded for the server, where `matchMedia` does not exist.
 */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
