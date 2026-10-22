import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { IonBadge, IonSkeletonText, IonSpinner } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { Exercise, ExerciseMediaKind, ExerciseService } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { exerciseSubline, kindIcon, kindTone, levelLabel, levelTone } from '../../exercises.config';

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
    this.frameIndex.set(index);
  }

  submit(): void {
    const exercise = this.shown();
    if (exercise) this.toggle.emit(exercise);
    this.open.set(false);
  }
}
