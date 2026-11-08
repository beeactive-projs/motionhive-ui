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
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { pauseOutline, playOutline } from 'ionicons/icons';

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
 * Discover's spotlight: a few coaches taking turns in one card
 * (`spotlightCoaches` picks who and in what order).
 *
 * Built to the usual rules for content that moves by itself (WCAG 2.2.2,
 * the ARIA carousel pattern, NN/g on auto-forwarding): a turn lasts long
 * enough to read the card (`SPOTLIGHT_INTERVAL_MS`), the coming change is
 * shown on the lit dot as it fills, and a visible Pause stops it. A finger
 * on the card holds the turn; a tap, a swipe, a dot or focus (a keyboard,
 * VoiceOver) stops the turns for good, since the reader is now doing the
 * choosing. Turns wait while the page is behind another, the app is in the
 * background or the card is scrolled away, and never start under Reduce
 * Motion (Play still starts them). A tap that lands just as the next coach
 * comes in opens nobody.
 *
 * Every card sits in the same grid cell, so the spotlight keeps the height
 * of its tallest card and nothing under it moves when the coach changes;
 * only the shown one can be reached, the others are inert and hidden.
 */
@Component({
  selector: 'mh-coach-spotlight',
  imports: [FeaturedCoach, IonButton, IonIcon, TranslatePipe],
  templateUrl: './coach-spotlight.html',
  styleUrl: './coach-spotlight.scss',
  host: {
    '[style.--mh-spotlight-turn]': 'turnDuration',
    '(focusin)': 'stop()',
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

  /** Stopped by the reader for this visit (or by Reduce Motion until they press Play). */
  private readonly _stopped = signal(prefersReducedMotion());
  /** A finger is resting on the card. */
  private readonly _held = signal(false);
  private readonly _onScreen = signal(true);
  private readonly _appVisible = signal(document.visibilityState !== 'hidden');

  /** The turns are on: what Pause and Play say. */
  readonly rotating = computed(() => this.coaches().length > 1 && !this._stopped());

  /** The turns are on and moving now. */
  readonly playing = computed(
    () => this.rotating() && this.active() && this._onScreen() && this._appVisible() && !this._held(),
  );

  readonly toggleLabel = computed(() => {
    if (this.rotating()) {
      return 'discover.spotlight.pause';
    }
    return 'discover.spotlight.play';
  });

  readonly toggleIcon = computed(() => {
    if (this.rotating()) {
      return 'pause-outline';
    }
    return 'play-outline';
  });

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
    addIcons({ pauseOutline, playOutline });

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

  /** A dot: that coach, and the reader chooses from here on. */
  show(position: number): void {
    this.stop();
    this.index.set(position);
  }

  /** Pause or Play. */
  toggle(): void {
    if (this.rotating()) {
      this.stop();
      return;
    }
    this._stopped.set(false);
    this._turn();
  }

  stop(): void {
    this._stopped.set(true);
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
    this.stop();
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
