import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

/** How much a nudge moves the finish line. */
const NUDGE_SECONDS = 10;

/**
 * The rest timer, docked where the keypad sits.
 *
 * Deliberately NOT an overlay: the set grid above it is what the user is
 * reading between sets, and a full-screen countdown hides exactly the thing
 * they are resting to go back to.
 *
 * The timer is **deadline-based** — it holds the instant rest ends, not a
 * number it decrements. A Capacitor WebView is throttled in the background
 * and suspended outright on iOS, so a ticking counter drifts or freezes;
 * deriving the remainder from a deadline means resuming the app is correct
 * with no correction step. The interval here only drives repaint.
 */
@Component({
  selector: 'mh-rest-timer-bar',
  imports: [IonIcon],
  templateUrl: './rest-timer-bar.html',
  styleUrl: './rest-timer-bar.scss',
})
export class RestTimerBar {
  /** Epoch ms when rest is over. Null parks the bar. */
  readonly endsAt = input.required<number | null>();
  /** The set the user is resting before, so they stay in flow. */
  readonly nextTarget = input('');

  readonly nudge = output<number>();
  readonly skip = output<void>();
  /** Fired once, the moment the deadline passes. */
  readonly finished = output<void>();

  private readonly _now = signal(Date.now());
  private readonly _destroyRef = inject(DestroyRef);
  private _handle: ReturnType<typeof setInterval> | null = null;
  private _announced = false;

  readonly remainingMs = computed(() => {
    const end = this.endsAt();
    return end === null ? 0 : Math.max(0, end - this._now());
  });

  readonly display = computed(() => {
    const total = Math.ceil(this.remainingMs() / 1000);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  });

  readonly done = computed(() => this.endsAt() !== null && this.remainingMs() === 0);

  constructor() {
    // One interval, owned by this component and torn down with it — the
    // concern behind the app-wide tick-free ClockService does not apply to a
    // repaint loop that lives only while a timer is on screen.
    effect(() => {
      const end = this.endsAt();
      this._stop();
      this._announced = false;
      if (end === null) return;

      this._now.set(Date.now());
      this._handle = setInterval(() => {
        this._now.set(Date.now());
        if (!this._announced && Date.now() >= end) {
          this._announced = true;
          this.finished.emit();
          this._stop();
        }
      }, 250);
    });

    this._destroyRef.onDestroy(() => this._stop());
  }

  add(): void {
    this.nudge.emit(NUDGE_SECONDS);
  }

  subtract(): void {
    this.nudge.emit(-NUDGE_SECONDS);
  }

  private _stop(): void {
    if (this._handle !== null) {
      clearInterval(this._handle);
      this._handle = null;
    }
  }
}
