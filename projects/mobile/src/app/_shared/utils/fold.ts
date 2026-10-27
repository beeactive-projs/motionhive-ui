import { prefersReducedMotion } from './motion';
import { AnimationCallbackEvent } from '@angular/core';

/**
 * Folding a header part in and out as search opens and closes, for
 * `(animate.enter)` / `(animate.leave)`.
 *
 * Without it the title bar and the pills vanished in one frame and the field
 * jumped up under the thumb that had just tapped it. Folding the height
 * instead keeps the field moving, so the eye can follow it to its new place.
 *
 * The size is measured, not guessed: a toolbar is 56px on md and 44px on
 * iOS, and a hard-coded `max-height` leaves a dead stretch at the start of
 * the motion. A part folds down to its top padding, not to zero, because the
 * first toolbar in a header carries the safe area there: the leaving title
 * keeps it until it is gone and the search toolbar takes it over in the same
 * frame, so nothing jumps by a notch.
 */

export const FoldAxes = {
  Block: 'block',
  Inline: 'inline',
} as const;

export type FoldAxis = (typeof FoldAxes)[keyof typeof FoldAxes];

/** Ease-out on both ways: the motion answers a tap, so it starts fast. */
const EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';
const ENTER_MS = 260;
/** Leaving is a little quicker; nobody needs to watch a thing go. */
const LEAVE_MS = 200;

/** The back chevron's folded width; see `SearchHeaderFold.backIn`. */
const BACK_CLOSED = '0.75rem';

/**
 * `closed` is the size the part folds from or to, as a CSS length. Left out,
 * it is the part's top padding on the block axis and nothing on the inline one.
 */
export function foldIn(
  event: AnimationCallbackEvent,
  axis: FoldAxis = FoldAxes.Block,
  closed?: string,
): void {
  void fold(event, axis, true, closed);
}

export function foldOut(
  event: AnimationCallbackEvent,
  axis: FoldAxis = FoldAxes.Block,
  closed?: string,
): void {
  void fold(event, axis, false, closed);
}

/**
 * The fold for one search header. `animate.enter` also fires when the page
 * first renders, and a title folding in on every visit to the tab is noise,
 * so entering stays still until search has been opened once (`arm()`).
 * Leaving only ever follows a tap.
 */
export class SearchHeaderFold {
  private _armed = false;

  arm(): void {
    this._armed = true;
  }

  readonly in = (event: AnimationCallbackEvent, axis?: FoldAxis, closed?: string): void => {
    if (this._armed) foldIn(event, axis, closed);
    else event.animationComplete();
  };

  readonly out = (event: AnimationCallbackEvent, axis?: FoldAxis, closed?: string): void => {
    foldOut(event, axis, closed);
  };

  /**
   * The back chevron opens sideways, pushing the field over. It starts at the
   * width that leaves the field where it was: in an app header the chevron's
   * margin is the gutter less 0.75rem (`ion-header.css`), and the field sat
   * on the gutter, so 0.75rem more puts its start in the same place.
   */
  readonly backIn = (event: AnimationCallbackEvent): void =>
    this.in(event, FoldAxes.Inline, BACK_CLOSED);

  readonly backOut = (event: AnimationCallbackEvent): void =>
    this.out(event, FoldAxes.Inline, BACK_CLOSED);
}

async function fold(
  event: AnimationCallbackEvent,
  axis: FoldAxis,
  entering: boolean,
  closed: string | undefined,
): Promise<void> {
  const element = event.target as HTMLElement;
  if (prefersReducedMotion() || typeof element.animate !== 'function') {
    event.animationComplete();
    return;
  }

  const property = axis === FoldAxes.Block ? 'height' : 'width';
  const shut = closed ?? (axis === FoldAxes.Block ? getComputedStyle(element).paddingTop : '0px');
  element.style.overflow = 'hidden';

  if (entering) {
    // A part that has just been inserted measures nothing until Ionic has
    // rendered it and the buttons inside it: measured now it folded from
    // nothing to nothing, then snapped open. Held shut until it can be.
    element.style.setProperty(property, shut);
    element.style.opacity = '0';
    await ionicRendered(element);
    element.style.removeProperty(property);
    element.style.opacity = '';
  }

  const rect = element.getBoundingClientRect();
  const open = `${axis === FoldAxes.Block ? rect.height : rect.width}px`;
  const openFrame = { [property]: open, opacity: 1 };
  const shutFrame = { [property]: shut, opacity: 0 };

  const animation = element.animate(entering ? [shutFrame, openFrame] : [openFrame, shutFrame], {
    duration: entering ? ENTER_MS : LEAVE_MS,
    easing: EASING,
    // A leaving part holds its folded frame until Angular removes it, or it
    // springs back to full size for the frame in between.
    fill: entering ? 'none' : 'forwards',
  });

  const settle = () => {
    element.style.overflow = '';
    event.animationComplete();
  };
  animation.finished.then(settle, settle);
}

/** Ionic's own elements, this one included, once each has drawn its shadow DOM. */
type IonicElement = Element & { componentOnReady?: () => Promise<unknown> };

function ionicRendered(element: Element): Promise<unknown> {
  const parts = [element, ...element.querySelectorAll('*')] as IonicElement[];
  return Promise.all(parts.map((part) => part.componentOnReady?.()));
}

