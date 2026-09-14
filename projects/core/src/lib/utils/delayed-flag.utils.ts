import { DestroyRef, Signal, effect, inject, signal } from '@angular/core';

/** How long a flag must stay true before a spinner is worth showing. */
export const SPINNER_DELAY_MS = 300;

/**
 * `injectDelayedFlag(source)` — mirrors a boolean signal, but only after
 * it has stayed true for `delayMs`. It drops back to false immediately.
 *
 * Progress indicators are for waits people notice. Showing one for an
 * operation that finishes in 80ms produces a flicker that reads as a
 * glitch rather than as feedback, so a send that lands quickly should
 * simply look instant:
 *
 *   protected readonly sending = computed(() => this.store.isSending(id()));
 *   protected readonly showSpinner = injectDelayedFlag(this.sending);
 *
 * The timer is cleared when the host component is destroyed.
 */
export function injectDelayedFlag(
  source: Signal<boolean>,
  delayMs: number = SPINNER_DELAY_MS,
): Signal<boolean> {
  const destroyRef = inject(DestroyRef);
  const delayed = signal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clear = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  effect(() => {
    if (source()) {
      // Already armed from a previous true — don't restart the clock.
      if (timer !== undefined || delayed()) return;
      timer = setTimeout(() => {
        timer = undefined;
        delayed.set(true);
      }, delayMs);
    } else {
      clear();
      delayed.set(false);
    }
  });

  destroyRef.onDestroy(clear);

  return delayed.asReadonly();
}
