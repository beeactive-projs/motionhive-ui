import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { IonBadge, IonSkeletonText, IonSpinner } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { Exercise, ExerciseMediaKind, ExerciseService } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { prefersReducedMotion } from '../../../../_shared/utils/motion';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { exerciseSubline, kindIcon, kindTone, levelLabel, levelTone } from '../../exercises.config';

/** How long each position holds. Matches the full exercise page. */
const FRAME_MS = 1400;

/** Past this much travel a drag is a swipe; under it, a tap. */
const SWIPE_PX = 30;

/**
 * What one exercise is, without leaving the picker.
 *
 * Picking is a commitment to a movement, and the row only has room for a
 * name and a line of facts. Opening the full page would close the sheet and
 * lose the selections made so far, so the answer comes to the reader
 * instead: the same photographs, level and muscles, over the list they were
 * reading.
 */
@Component({
  selector: 'mh-exercise-preview-sheet',
  imports: [HexAvatar, IonBadge, IonSkeletonText, IonSpinner, SheetShell, TranslatePipe],
  templateUrl: './exercise-preview-sheet.html',
  styleUrl: './exercise-preview-sheet.scss',
})
export class ExercisePreviewSheet {
  readonly open = model(false);
  /** The row that was asked about: enough to draw the sheet before it loads. */
  readonly exercise = input<Exercise | null>(null);
  /** Whether it is already picked, so the sheet's button says the right verb. */
  readonly selected = input(false);

  /** Pick or unpick from in here, so looking and choosing are one motion. */
  readonly toggle = output<Exercise>();

  private readonly _exerciseService = inject(ExerciseService);

  /** The full record, which the list rows do not carry (media, cues). */
  readonly full = signal<Exercise | null>(null);
  readonly loading = signal(false);

  /** The row until the full record lands, so the sheet never opens empty. */
  readonly shown = computed(() => this.full() ?? this.exercise());

  readonly frames = computed(() =>
    (this.shown()?.media ?? [])
      .filter((media) => media.kind === ExerciseMediaKind.Image)
      .sort((a, b) => a.displayOrder - b.displayOrder),
  );

  readonly frameIndex = signal(0);

  /** Set once a reader drives the frames, so the timer stops fighting them. */
  private readonly _steppedByHand = signal(false);

  /** Where a swipe started, in page coordinates. Null between gestures. */
  private _swipeStartX: number | null = null;

  readonly currentFrame = computed(() => {
    const frames = this.frames();
    return frames.length ? (frames[this.frameIndex() % frames.length] ?? null) : null;
  });

  /** A thumbnail is better than a tile where there is no frame pair. */
  readonly still = computed(() =>
    this.frames().length ? null : (this.shown()?.thumbnailUrl ?? null),
  );

  readonly name = computed(() => this.shown()?.name ?? '');
  readonly originalName = computed(() => this.shown()?.originalName ?? null);
  readonly subline = computed(() => {
    const exercise = this.shown();
    return exercise ? exerciseSubline(exercise) : '';
  });
  readonly levelLabel = computed(() => {
    const exercise = this.shown();
    return exercise ? levelLabel(exercise.level) : null;
  });
  readonly levelTone = computed(() => {
    const exercise = this.shown();
    return exercise ? levelTone(exercise.level) : null;
  });
  readonly kindTone = computed(() => {
    const exercise = this.shown();
    return exercise ? kindTone(exercise.kind) : 'medium';
  });
  readonly kindIcon = computed(() => {
    const exercise = this.shown();
    return exercise ? kindIcon(exercise.kind) : null;
  });

  readonly instructions = computed(() => this.full()?.instructions?.trim() || null);

  constructor() {
    // The pair alternates here as it does on the full page, so the sheet
    // shows the movement rather than a photograph of its start. Stops once
    // a reader steps the frames themselves, and never runs for one who
    // asked the OS for less motion: the dots are their control.
    effect((onCleanup) => {
      const count = this.frames().length;
      if (!this.open() || count < 2 || prefersReducedMotion() || this._steppedByHand()) return;
      const timer = setInterval(
        () => this.frameIndex.update((index) => (index + 1) % count),
        FRAME_MS,
      );
      onCleanup(() => clearInterval(timer));
    });

    // Fetch when it opens, not when the row is rendered: a list of forty
    // rows would otherwise be forty requests nobody asked for.
    effect(() => {
      const exercise = this.exercise();
      if (!this.open() || !exercise) return;
      if (this.full()?.id === exercise.id) return;
      this._load(exercise.id);
    });
  }

  private _load(id: string): void {
    this.full.set(null);
    this.frameIndex.set(0);
    this._steppedByHand.set(false);
    this.loading.set(true);
    this._exerciseService
      .get(id)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((exercise) => {
        this.loading.set(false);
        // On failure the row stays on screen: less than the full record, but
        // more use than an error over a list the reader was part way through.
        if (exercise) this.full.set(exercise);
      });
  }

  stepFrame(index: number): void {
    this._steppedByHand.set(true);
    this.frameIndex.set(index);
  }

  /** Tap or swipe the photo itself, as on the full exercise page. */
  private _step(delta: number): void {
    const count = this.frames().length;
    if (count < 2) return;
    this._steppedByHand.set(true);
    this.frameIndex.update((index) => (index + delta + count) % count);
  }

  onFrameTouchStart(event: TouchEvent): void {
    this._swipeStartX = event.changedTouches[0]?.clientX ?? null;
  }

  onFrameTouchEnd(event: TouchEvent): void {
    const start = this._swipeStartX;
    this._swipeStartX = null;
    if (start === null) return;
    const travelled = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(travelled) < SWIPE_PX) {
      this._step(1);
      return;
    }
    this._step(travelled < 0 ? 1 : -1);
  }

  submit(): void {
    const exercise = this.shown();
    if (exercise) this.toggle.emit(exercise);
    this.open.set(false);
  }
}
