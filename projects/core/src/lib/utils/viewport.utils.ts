import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';

/**
 * Viewport tier boundaries (px). Mirror these in SCSS `@media` queries so
 * the TS branching and the CSS layout agree on where each surface flips.
 *
 * | Surface | Desktop (≥1024px) | Tablet (768–1023px) | Mobile (<768px) |
 */
export const Breakpoints = {
  /** Lower bound of the tablet tier — anything below this is mobile. */
  Tablet: 768,
  /** Lower bound of the desktop tier. */
  Desktop: 1024,
} as const;

/** The current viewport tier. */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * `matchMedia` strings for each boundary. We listen on the two `min-width`
 * boundaries and derive the tier from them — two listeners cover all three
 * tiers, and there is never an ambiguous gap (sub-pixel widths can't fall
 * between `max-width: 767.98px` and `min-width: 768px`).
 */
const TABLET_UP_QUERY = `(min-width: ${Breakpoints.Tablet}px)`;
const DESKTOP_UP_QUERY = `(min-width: ${Breakpoints.Desktop}px)`;

/** Convenience `max-width` query for "mobile only" (< tablet). */
export const MOBILE_QUERY = `(max-width: ${Breakpoints.Tablet - 0.02}px)`;

/**
 * `injectBreakpoint()` — returns a `Signal<Breakpoint>` that tracks which
 * viewport tier ('mobile' | 'tablet' | 'desktop') is currently active and
 * updates live as the window is resized.
 *
 * Wraps the `matchMedia` listener boilerplate that was previously duplicated
 * across every page that branches on viewport (sessions list, session-detail,
 * create dialog, cancel dialog, calendar…). Each call site reduces to:
 *
 *   protected readonly breakpoint = injectBreakpoint();
 *
 *   // template
 *   @switch (breakpoint()) { @case ('desktop') { … } @case ('tablet') { … } … }
 *
 * Internally uses the current `DestroyRef` so the matchMedia listeners are
 * detached when the host component is destroyed — no leaks even when the user
 * navigates away mid-listener.
 */
export function injectBreakpoint(): Signal<Breakpoint> {
  const destroyRef = inject(DestroyRef);

  // SSR / pre-hydration: matchMedia is unavailable; default to 'desktop' so
  // SSR HTML matches the most common first-paint case and the client-side
  // hydration fixes it after the listeners attach.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return signal<Breakpoint>('desktop').asReadonly();
  }

  const tabletUpMql = window.matchMedia(TABLET_UP_QUERY);
  const desktopUpMql = window.matchMedia(DESKTOP_UP_QUERY);

  const resolve = (): Breakpoint =>
    desktopUpMql.matches ? 'desktop' : tabletUpMql.matches ? 'tablet' : 'mobile';

  const breakpoint = signal<Breakpoint>(resolve());
  const update = () => breakpoint.set(resolve());

  tabletUpMql.addEventListener('change', update);
  desktopUpMql.addEventListener('change', update);
  destroyRef.onDestroy(() => {
    tabletUpMql.removeEventListener('change', update);
    desktopUpMql.removeEventListener('change', update);
  });

  return breakpoint.asReadonly();
}

/**
 * `injectIsMobile()` — returns a `Signal<boolean>` that is true while the
 * viewport is in the mobile tier (< {@link Breakpoints.Tablet}px).
 *
 *   protected readonly isMobile = injectIsMobile();
 *
 * Pass a custom `query` to gate at a different breakpoint, e.g.
 * `injectIsMobile('(max-width: 960px)')` for tablet-and-below.
 */
export function injectIsMobile(query: string = MOBILE_QUERY): Signal<boolean> {
  const destroyRef = inject(DestroyRef);

  // SSR / pre-hydration: matchMedia is unavailable; default to false (desktop)
  // so SSR HTML matches the most common first-paint case and client-side
  // hydration fixes it after the listener attaches.
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

/**
 * `injectIsTablet()` — true while the viewport is in the tablet tier
 * (768–1023px). Derived from {@link injectBreakpoint}.
 */
export function injectIsTablet(): Signal<boolean> {
  const breakpoint = injectBreakpoint();
  return computed(() => breakpoint() === 'tablet');
}

/**
 * `injectIsDesktop()` — true while the viewport is in the desktop tier
 * (≥1024px). Derived from {@link injectBreakpoint}.
 */
export function injectIsDesktop(): Signal<boolean> {
  const breakpoint = injectBreakpoint();
  return computed(() => breakpoint() === 'desktop');
}
