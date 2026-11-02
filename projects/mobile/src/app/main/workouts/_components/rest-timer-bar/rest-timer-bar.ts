import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TIMER_HEX_SHAPE, cellFigure } from '../../../../_shared/config/hexagon.config';
import { secondsToClock } from '../../workouts.config';

/** How much a nudge moves the finish line. */
export const NUDGE_SECONDS = 15;
/** The last stretch, drawn lighter, with one light tap. */
const SOON_SECONDS = 10;
/** How long "Go" shows before the count turns to overtime. */
const GO_SECONDS = 3;
/** Past this much overtime it stops being rest: the bar goes and the logger asks. */
export const OVERTIME_CEILING_SECONDS = 600;
/** Hold −15 / +15 this long and they start repeating. */
const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 150;

/** The four looks of the bar. */
export const RestStates = {
  Counting: 'counting',
  Soon: 'soon',
  Go: 'go',
  Over: 'over',
} as const;
export type RestState = (typeof RestStates)[keyof typeof RestStates];

let clipIds = 0;

/**
 * The rest timer, docked where the number pad sits (Workouts R2, section 4).
 *
 * A honey hexagon drains as the rest passes, so how much is left reads
 * without the numbers. Four states: counting; the last ten seconds, lighter;
 * zero, a green "Go"; then overtime, a calm grey "+0:25" counting up, never
 * red, because a longer rest is not a mistake. At zero the honey Start set
 * ends the rest (and so measures it exactly); Skip does the same before
 * zero. Tapping the hexagon or the time changes the rest.
 *
 * Deadline-based: it holds the instant rest ends, not a number it counts
 * down, so a WebView suspended in the background is right again on return.
 * The interval only repaints.
 */
@Component({
  selector: 'mh-rest-timer-bar',
  imports: [IonIcon, TranslatePipe],
  templateUrl: './rest-timer-bar.html',
  styleUrl: './rest-timer-bar.scss',
})
export class RestTimerBar {
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);

  /** Epoch ms when rest is over. Null parks the bar. */
  readonly endsAt = input.required<number | null>();
  /** Epoch ms when rest began: the planned length is measured from here. */
  readonly startedAt = input<number | null>(null);
  /** "Bench press · Set 3 · 62.5 kg × 8": what comes after the rest. */
  readonly next = input('');

  readonly nudge = output<number>();
  /** Skip, before zero: ends the rest now. */
  readonly skip = output<void>();
  /** Start set, from zero on: ends the rest now. */
  readonly start = output<void>();
  /** Hide, in overtime: puts the bar away without ending the rest. */
  readonly hide = output<void>();
  /** The hexagon or the time was tapped. */
  readonly change = output<void>();
  /** Fired once, at ten seconds to go. */
  readonly soon = output<void>();
  /** Fired once, the moment the deadline passes. */
  readonly finished = output<void>();
  /** Fired once, ten minutes into overtime. */
  readonly expired = output<void>();

  readonly States = RestStates;
  readonly nudgeSeconds = NUDGE_SECONDS;
  readonly hex = cellFigure(TIMER_HEX_SHAPE);
  readonly clipId = `rest-hex-${++clipIds}`;

  private readonly _now = signal(Date.now());
  private _handle: ReturnType<typeof setInterval> | null = null;
  private _hold: ReturnType<typeof setTimeout> | null = null;
  private _fired = { soon: false, finished: false, expired: false };

  /** Seconds left: negative in overtime. */
  readonly remaining = computed(() => {
    const end = this.endsAt();
    return end === null ? 0 : (end - this._now()) / 1000;
  });

  readonly planned = computed(() => {
    const start = this.startedAt();
    const end = this.endsAt();
    return start === null || end === null ? 0 : Math.max(0, Math.round((end - start) / 1000));
  });

  readonly state = computed<RestState>(() => {
    const left = this.remaining();
    if (left > SOON_SECONDS) return RestStates.Counting;
    if (left > 0) return RestStates.Soon;
    if (left > -GO_SECONDS) return RestStates.Go;
    return RestStates.Over;
  });

  readonly counting = computed(
    () => this.state() === RestStates.Counting || this.state() === RestStates.Soon,
  );

  readonly display = computed(() => {
    const left = this.remaining();
    switch (this.state()) {
      case RestStates.Go:
        return this._translateService.instant('workouts.restTimer.go');
      case RestStates.Over:
        return `+${secondsToClock(Math.floor(-left))}`;
      default:
        return secondsToClock(Math.ceil(left));
    }
  });

  readonly sub = computed(() => {
    const total = secondsToClock(this.planned());
    switch (this.state()) {
      case RestStates.Counting:
        return this._translateService.instant('workouts.restTimer.of', { total });
      case RestStates.Soon:
        return this._translateService.instant('workouts.restTimer.getReady');
      case RestStates.Go:
        return this._translateService.instant('workouts.restTimer.restDone');
      case RestStates.Over:
        return this._translateService.instant('workouts.restTimer.over', { total });
    }
  });

  /** The honey left in the hexagon, as a share of its height. */
  private readonly _fill = computed(() => {
    if (!this.counting()) return 1;
    const planned = this.planned();
    return planned > 0 ? Math.min(1, Math.max(0, this.remaining() / planned)) : 0;
  });

  readonly fillHeight = computed(() => this.hex.height * this._fill());
  readonly fillY = computed(() => this.hex.y + this.hex.height - this.fillHeight());

  constructor() {
    effect(() => {
      const end = this.endsAt();
      this._stop();
      this._fired = { soon: false, finished: false, expired: false };
      if (end === null) return;
      untracked(() => this._now.set(Date.now()));
      this._handle = setInterval(() => this._tick(end), 250);
    });

    this._destroyRef.onDestroy(() => {
      this._stop();
      this.holdEnd();
    });
  }

  /** −15 / +15: one step on press, repeating while held. */
  holdStart(direction: 1 | -1, event: PointerEvent): void {
    event.preventDefault();
    this.holdEnd();
    this.nudge.emit(direction * NUDGE_SECONDS);
    this._hold = setTimeout(() => {
      this._hold = setInterval(
        () => this.nudge.emit(direction * NUDGE_SECONDS),
        HOLD_REPEAT_MS,
      );
    }, HOLD_DELAY_MS);
  }

  holdEnd(): void {
    if (this._hold !== null) {
      clearTimeout(this._hold);
      clearInterval(this._hold);
    }
    this._hold = null;
  }

  /** Keyboard and switch access: a click with no pointer behind it. */
  stepByKey(direction: 1 | -1, event: MouseEvent): void {
    if (event.detail === 0) this.nudge.emit(direction * NUDGE_SECONDS);
  }

  private _tick(end: number): void {
    const now = Date.now();
    this._now.set(now);
    const left = (end - now) / 1000;
    if (!this._fired.soon && left <= SOON_SECONDS && left > 0) {
      this._fired.soon = true;
      this.soon.emit();
    }
    if (!this._fired.finished && left <= 0) {
      this._fired.finished = true;
      this.finished.emit();
    }
    if (!this._fired.expired && left <= -OVERTIME_CEILING_SECONDS) {
      this._fired.expired = true;
      this.expired.emit();
    }
  }

  private _stop(): void {
    if (this._handle !== null) clearInterval(this._handle);
    this._handle = null;
  }
}
