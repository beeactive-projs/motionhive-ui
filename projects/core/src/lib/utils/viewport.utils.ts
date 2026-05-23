import { DestroyRef, Signal, inject, signal } from '@angular/core';

/**
 * `injectIsMobile()` — returns a `Signal<boolean>` that is true while
 * the viewport is at or under the mobile breakpoint (default 600px).
 *
 * Wraps the `matchMedia` listener boilerplate that was previously
 * duplicated across every page that branches on viewport (sessions
 * list, session-detail, create dialog, cancel dialog, calendar…).
 * Each call site reduces to:
 *
 *   protected readonly isMobile = injectIsMobile();
 *
 * Internally uses the current `DestroyRef` so the matchMedia listener
 * is detached when the host component is destroyed — no leaks even
 * when the user navigates away mid-listener.
 *
 * Pass a custom `query` to gate at a different breakpoint, e.g.
 * `injectIsMobile('(max-width: 960px)')` for tablet-and-below.
 */
export function injectIsMobile(
  query: string = '(max-width: 600px)',
): Signal<boolean> {
  const destroyRef = inject(DestroyRef);

  // SSR / pre-hydration: matchMedia is unavailable; default to false
  // (desktop) so SSR HTML matches the most common first-paint case
  // and the client-side hydration fixes it after the listener attaches.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return signal(false).asReadonly();
  }

  const mql = window.matchMedia(query);
  const isMobile = signal<boolean>(mql.matches);
  const update = (e: MediaQueryListEvent) => isMobile.set(e.matches);

  mql.addEventListener('change', update);
  destroyRef.onDestroy(() => mql.removeEventListener('change', update));

  return isMobile.asReadonly();
}
