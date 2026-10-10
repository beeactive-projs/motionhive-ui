import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  inject,
  input,
  output,
} from '@angular/core';

/** Movement before a touch counts as a horizontal drag rather than a tap or a scroll. */
const SLOP_PX = 8;

/**
 * Swipe right to dismiss a panel anchored to the right edge.
 *
 * While the finger moves, the host gets the `is-dragging` class and the
 * `--swipe-x` custom property (px, never negative). The host's CSS applies it,
 * e.g. `transform: translateX(var(--swipe-x, 0px))` and `transition: none`
 * while dragging. On release past `threshold` it emits `dismissed` and leaves
 * the offset in place, so the close transition starts from the finger;
 * otherwise the offset resets and the panel springs back.
 *
 * Listeners are passive and attached in the browser only; vertical scrolling
 * inside the panel is left alone.
 */
@Directive({ selector: '[mhSwipeDismiss]' })
export class SwipeDismissDirective {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _destroyRef = inject(DestroyRef);

  /** Tracks swipes only while true (e.g. while the drawer is open). */
  readonly active = input(false, { alias: 'mhSwipeDismiss' });
  /** Drag distance in px past which releasing dismisses. */
  readonly threshold = input(60);

  readonly dismissed = output<void>();

  constructor() {
    // Every open starts from the resting position.
    afterRenderEffect(() => {
      if (this.active()) this._setOffset(0);
    });
    afterNextRender(() => this._listen());
  }

  private _listen(): void {
    const el = this._elementRef.nativeElement;
    let startX = 0;
    let startY = 0;
    let offset = 0;
    let tracking = false;
    let dragging = false;

    const onStart = (event: TouchEvent): void => {
      if (!this.active() || event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      offset = 0;
      tracking = true;
      dragging = false;
    };

    const onMove = (event: TouchEvent): void => {
      if (!tracking) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (!dragging) {
        if (Math.abs(dy) > SLOP_PX && Math.abs(dy) >= Math.abs(dx)) {
          tracking = false; // a vertical scroll, not a swipe
          return;
        }
        if (dx <= SLOP_PX) return;
        dragging = true;
        el.classList.add('is-dragging');
      }
      offset = Math.max(0, dx);
      this._setOffset(offset);
    };

    const onEnd = (event: TouchEvent): void => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-dragging');
      if (event.type === 'touchend' && offset > this.threshold()) {
        this.dismissed.emit();
      } else {
        this._setOffset(0);
      }
    };

    const options: AddEventListenerOptions = { passive: true };
    el.addEventListener('touchstart', onStart, options);
    el.addEventListener('touchmove', onMove, options);
    el.addEventListener('touchend', onEnd, options);
    el.addEventListener('touchcancel', onEnd, options);
    this._destroyRef.onDestroy(() => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    });
  }

  private _setOffset(px: number): void {
    this._elementRef.nativeElement.style.setProperty('--swipe-x', `${px}px`);
  }
}
