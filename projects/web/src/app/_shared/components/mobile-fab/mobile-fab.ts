import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';

/**
 * `mh-mobile-fab` — floating action button for the single primary
 * "create" verb on a mobile screen.
 *
 * Behavior:
 *   - 52px circle, primary tint, drop-shadowed honey.
 *   - Hides on scroll-down (deltaY > 6), reappears on scroll-up.
 *   - Sits at right: 16px, bottom: 16px + safe-area-inset-bottom.
 *   - Visible only at ≤767px (mobile) by default. Pass `[force]="true"`
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
 * Hides automatically when the window scrolls down. We listen on window
 * scroll; for first cut we use window-scroll only.
 */
@Component({
  selector: 'mh-mobile-fab',
  standalone: true,
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mobile-fab.html',
  styleUrl: './mobile-fab.scss',
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
