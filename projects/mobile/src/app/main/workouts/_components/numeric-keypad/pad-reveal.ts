import type { IonContent } from '@ionic/angular/standalone';

/** A vertical span on screen, in viewport pixels. */
export interface ScreenSpan {
  top: number;
  bottom: number;
}

/** Air kept between the row being typed and the header above it, and the pad below it. */
const HEADER_GAP = 8;
const PAD_GAP = 16;

/** The list's scroll to a row the pad hides, when the pad is already up. */
export const PAD_REVEAL_MS = 200;

/**
 * The part of a page's list a person can actually see. A `[fullscreen]`
 * content runs behind the header and the docked footer (the pad, the rest
 * bar), and Ionic measures that overlap only on a window resize, so a footer
 * that comes and goes mid-page leaves it stale: both bars are measured here
 * instead. `page` is the page component's host, whose own bars are its
 * children (a sheet's header or footer further down never counts).
 */
export function visibleSpan(page: HTMLElement, scroller: HTMLElement): ScreenSpan {
  const box = scroller.getBoundingClientRect();
  const header = page.querySelector(':scope > ion-header')?.getBoundingClientRect();
  const footer = page.querySelector(':scope > ion-footer')?.getBoundingClientRect();
  return {
    top: Math.max(box.top, header?.bottom ?? box.top),
    bottom: footer && footer.height > 0 ? Math.min(box.bottom, footer.top) : box.bottom,
  };
}

/**
 * How far the list scrolls so a row shows whole: up when the pad covers it,
 * down when the header does, 0 when it already shows. A row taller than the
 * room left keeps its top in view rather than its bottom.
 */
export function revealDelta(row: ScreenSpan, visible: ScreenSpan): number {
  const belowHeader = row.top - (visible.top + HEADER_GAP);
  if (belowHeader < 0) return belowHeader;
  const underPad = row.bottom - (visible.bottom - PAD_GAP);
  return underPad > 0 ? Math.min(underPad, belowHeader) : 0;
}

/**
 * Scrolls the page's list so `row`, the one the pad is typing into, shows
 * between the header and the pad. With `durationMs` 0 the move lands in the
 * frame the pad first draws in, so the row never shows under it first.
 * `beforeScroll` runs only when the list moves (the logger marks its own
 * scrolls, so they are not read as the person's).
 */
export async function revealAbovePad(
  content: IonContent,
  page: HTMLElement,
  row: HTMLElement,
  durationMs: number,
  beforeScroll?: () => void,
): Promise<void> {
  const visible = visibleSpan(page, await content.getScrollElement());
  const delta = revealDelta(row.getBoundingClientRect(), visible);
  if (delta === 0) return;
  beforeScroll?.();
  await content.scrollByPoint(0, delta, durationMs);
}
