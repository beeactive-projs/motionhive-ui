import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { InstructorSearchResult } from 'core';

import { prefersReducedMotion } from '../../../../_shared/utils/motion';
import { SPOTLIGHT_INTERVAL_MS, coachName } from '../../discover.config';
import { FeaturedCoach } from '../featured-coach/featured-coach';

/**
 * A tap that lands this soon after the spotlight moved on by itself was
 * aimed at the coach who just left, so it opens nobody.
 */
const LATE_TAP_MS = 500;

/** How far a finger travels sideways before it is a swipe to the next coach. */
const SWIPE_PX = 40;

/** Half the spotlight on screen counts as on screen: turns wait while it is scrolled away. */
const ON_SCREEN_RATIO = 0.5;

/**
 * After the reader touches the spotlight (a tap, a swipe, a dot), the turns
 * wait this long before they go on: one more turn's time to read the coach
 * they chose.
 */
export const RESUME_AFTER_MS = SPOTLIGHT_INTERVAL_MS;

/** Focus a keyboard or a screen reader moved, as opposed to a tap's. */
function isVisibleFocus(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true;
  }
  try {
    return target.matches(':focus-visible');
  } catch {
    // A browser without the selector: hold, the careful answer.
    return true;
  }
}

/**
 * Discover's spotlight: a few coaches taking turns in one card
 * (the directory's `spotlight` order picks who and in what order).
 *
 * The turns start by themselves and have no Play or Pause button (owner,
 * 2026-11-18). A turn lasts long enough to read the card
 * (`SPOTLIGHT_INTERVAL_MS`) and the coming change is shown on the lit dot
 * as it fills. A finger on the card holds the turn; a tap, a swipe or a dot
 * picks a coach and the turns wait `RESUME_AFTER_MS` before going on, and
 * focus inside (a keyboard, VoiceOver) holds them until it leaves. Turns
 * also wait while the page is behind another, the app is in the background
 * or the card is scrolled away. Under Reduce Motion they never start: the
 * reader moves the coaches with the dots or a swipe, which is the way to
 * keep them still. A tap that lands just as the next coach comes in opens
 * nobody.
 *
 * Every card sits in the same grid cell, so the spotlight keeps the height
 * of its tallest card and nothing under it moves when the coach changes;
 * only the shown one can be reached, the others are inert and hidden.
 */
@Component({
  selector: 'mh-coach-spotlight',
  imports: [FeaturedCoach, TranslatePipe],
  templateUrl: './coach-spotlight.html',
  styleUrl: './coach-spotlight.scss',
  host: {
    '[style.--mh-spotlight-turn]': 'turnDuration',
    '(focusin)': 'onFocusIn($event)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class CoachSpotlight {
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly coaches = input.required<readonly InstructorSearchResult[]>();
  /** The page is the one on screen (Ionic keeps a page alive under the next). */
  readonly active = input(true);

  readonly viewProfile = output<InstructorSearchResult>();
  readonly message = output<InstructorSearchResult>();

  readonly turnDuration = `${SPOTLIGHT_INTERVAL_MS}ms`;

  /** The shown coach's place; back to the first whenever the coaches change (a city, a topic). */
  readonly index = linkedSignal<string, number>({
    source: () => this.coaches().map((coach) => coach.id).join(','),
    computation: () => 0,
  });

  /** Reduce Motion: the turns never start; the reader moves the coaches. */
  private readonly _still = signal(prefersReducedMotion());
  /** The reader just picked a coach: the turns wait a turn's time. */
  private readonly _resting = signal(false);
  /** Focus is inside (a keyboard, VoiceOver): the turns wait until it leaves. */
  private readonly _focused = signal(false);
  /** A finger is resting on the card. */
  private readonly _held = signal(false);
  private readonly _onScreen = signal(true);
  private readonly _appVisible = signal(document.visibilityState !== 'hidden');
  private _restTimer: ReturnType<typeof setTimeout> | null = null;

  /** The turns are on: nobody is choosing and the reader allows motion. */
  readonly rotating = computed(
    () => this.coaches().length > 1 && !this._still() && !this._resting() && !this._focused(),
  );

  /** The turns are on and moving now. */
  readonly playing = computed(
    () => this.rotating() && this.active() && this._onScreen() && this._appVisible() && !this._held(),
  );

  /**
   * Screen readers hear nothing while the turns run (a card read out every
   * few seconds would talk over the page), and the new coach once the
   * reader moves it themselves.
   */
  readonly live = computed(() => {
    if (this.rotating()) {
      return 'off';
    }
    return 'polite';
  });

  private _lastTurnAt = 0;
  private _tapTooLate = false;
  private _pointer: { x: number; y: number } | null = null;

  constructor() {
    // One turn at a time: the timer starts over whenever the turns pause,
    // as the lit dot's fill does.
    effect((onCleanup) => {
      if (!this.playing()) {
        return;
      }
      this.index();
      const timer = setTimeout(() => this._turn(), SPOTLIGHT_INTERVAL_MS);
      onCleanup(() => clearTimeout(timer));
    });

    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this._clearRest());

    const onVisibility = () => this._appVisible.set(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisibility));

    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            this._onScreen.set(entry.intersectionRatio >= ON_SCREEN_RATIO);
          }
        },
        { threshold: [0, ON_SCREEN_RATIO, 1] },
      );
      observer.observe(this._host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    }
  }

  isShown(position: number): boolean {
    return position === this.index();
  }

  dotLabel(coach: InstructorSearchResult): string {
    return coachName(coach);
  }

  /** A dot: that coach, and the turns wait a turn's time before going on. */
  show(position: number): void {
    this.rest();
    this.index.set(position);
  }

  /** The reader chose: the turns wait `RESUME_AFTER_MS`, counted from the last choice. */
  rest(): void {
    this._clearRest();
    this._resting.set(true);
    this._restTimer = setTimeout(() => {
      this._restTimer = null;
      this._resting.set(false);
    }, RESUME_AFTER_MS);
  }

  /**
   * Keyboard or VoiceOver focus holds the turns. A tap focuses a button on
   * Android and the desktop too; that is a touch, which only rests them.
   */
  onFocusIn(event?: FocusEvent): void {
    if (event && !isVisibleFocus(event.target)) {
      return;
    }
    this._focused.set(true);
  }

  /** Focus moved out of the spotlight: the turns go on after a rest. */
  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this._host.nativeElement.contains(next)) {
      return;
    }
    this._focused.set(false);
    this.rest();
  }

  onPointerDown(event: PointerEvent): void {
    this._pointer = { x: event.clientX, y: event.clientY };
    this._tapTooLate = performance.now() - this._lastTurnAt < LATE_TAP_MS;
    this._held.set(true);
  }

  /** A tap or a swipe is a choice; the finger leaving without one lets the turns go on. */
  onPointerUp(event: PointerEvent): void {
    this._held.set(false);
    const start = this._pointer;
    this._pointer = null;
    if (!start) {
      return;
    }
    this.rest();
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) {
      return;
    }
    if (dx < 0) {
      this._step(1);
    } else {
      this._step(-1);
    }
  }

  /** The page took the finger for a scroll: nothing was chosen. */
  onPointerCancel(): void {
    this._held.set(false);
    this._pointer = null;
  }

  open(coach: InstructorSearchResult): void {
    if (this._consumeLateTap()) {
      return;
    }
    this.viewProfile.emit(coach);
  }

  write(coach: InstructorSearchResult): void {
    if (this._consumeLateTap()) {
      return;
    }
    this.message.emit(coach);
  }

  private _clearRest(): void {
    if (this._restTimer) {
      clearTimeout(this._restTimer);
      this._restTimer = null;
    }
  }

  private _consumeLateTap(): boolean {
    const late = this._tapTooLate;
    this._tapTooLate = false;
    return late;
  }

  private _turn(): void {
    this._lastTurnAt = performance.now();
    this._step(1);
  }

  private _step(by: number): void {
    const count = this.coaches().length;
    if (count < 2) {
      return;
    }
    this.index.update((position) => (position + by + count) % count);
  }
}
