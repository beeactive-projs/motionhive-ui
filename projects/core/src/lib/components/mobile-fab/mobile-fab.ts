import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * `mh-mobile-fab` — floating action button for the single primary
 * "create" verb on a mobile screen.
 *
 * Behavior:
 *   - 52px circle, primary tint, drop-shadowed honey.
 *   - Hides on scroll-down (deltaY > 6), reappears on scroll-up.
 *   - Sits at right: 16px, bottom: 16px + safe-area-inset-bottom.
 *   - Visible only at ≤600px (mobile) by default. Pass `[force]="true"`
 *     to override at any width — used in storybook / debug routes.
 *
 * Inputs:
 *   - `icon`  — PrimeIcons class (default 'pi pi-plus').
 *   - `label` — aria-label.
 *   - `force` — show on desktop too. Default false.
 *
 * Output:
 *   - `tap` — emits when pressed.
 *
 * Hides automatically when any scroll container scrolls down. We
 * listen on window scroll; if the page-level scroll isn't the right
 * container, host can pass `[scrollTarget]="elRef"` for an element.
 * For first cut we use window-scroll only.
 */
@Component({
  selector: 'mh-mobile-fab',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="mh-fab"
      [class.mh-fab--hidden]="hidden()"
      [class.mh-fab--force]="force()"
      [attr.aria-label]="label() || 'Create'"
      (click)="tap.emit()"
    >
      <i [class]="icon()" aria-hidden="true"></i>
    </button>
  `,
  styles: `
    :host { display: contents; }
    .mh-fab {
      position: fixed;
      right: 16px;
      bottom: calc(16px + env(safe-area-inset-bottom, 0));
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: none;
      background: var(--p-primary-500);
      color: var(--p-primary-contrast-color, #fff);
      box-shadow: 0 6px 16px rgba(228, 137, 19, 0.4);
      cursor: pointer;
      z-index: 60;
      display: none;
      align-items: center;
      justify-content: center;
      transition:
        transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
        opacity 200ms ease;
    }
    .mh-fab i { font-size: 20px; }
    .mh-fab:active { transform: scale(0.94); }

    /* Only renders on mobile by default. */
    @media (max-width: 600px) {
      .mh-fab { display: inline-flex; }
    }
    /* force-mode shows it everywhere: used for the bottom-nav tabbar
       pages that already lift the FAB above the tabbar themselves. */
    .mh-fab--force { display: inline-flex !important; }

    .mh-fab--hidden {
      transform: translateY(96px);
      opacity: 0;
      pointer-events: none;
    }
  `,
})
export class MobileFab {
  readonly icon = input<string>('pi pi-plus');
  readonly label = input<string>('');
  readonly force = input(false);

  readonly tap = output<void>();

  protected readonly hidden = signal(false);

  private _lastY = 0;
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    // Throttle via rAF — scroll handlers fire constantly.
    let scheduled = false;
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const y = window.scrollY;
        const dy = y - this._lastY;
        // Hysteresis: 6px down hides, 4px up shows. Below 60px from
        // top the FAB is always visible — no point hiding it at the
        // very top of the page.
        if (y < 60) this.hidden.set(false);
        else if (dy > 6) this.hidden.set(true);
        else if (dy < -4) this.hidden.set(false);
        this._lastY = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    this._destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
    });
  }
}
