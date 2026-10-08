import { Component, ElementRef, afterRenderEffect, input, output, signal, viewChild } from '@angular/core';
import { IonBadge, IonButton, IonCard, IonCardContent, IonList } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import {
  ExerciseRef,
  ExerciseRow,
} from '../../../exercises/_components/exercise-row/exercise-row';

/** One row of the exercise list, already worded by the page that owns the data. */
export interface OverviewExercise {
  key: string;
  exercise: ExerciseRef;
  /** "4 sets · 6–8 reps · 82.5 kg top set" — see `prescriptionLine`. */
  prescription: string;
}

/**
 * The pre-Start read of a workout: eyebrow, name, meta chips, the note, then
 * every exercise with its sets and targets.
 *
 * Shared by a plan's day and a saved routine, which hold different trees but
 * answer the same question — what am I about to do — so they should read the
 * same. The page keeps the data and the actions; this only lays them out.
 */
@Component({
  selector: 'mh-workout-overview',
  imports: [ExerciseRow, IonBadge, IonButton, IonCard, IonCardContent, IonList, TranslatePipe],
  templateUrl: './workout-overview.html',
  styleUrl: './workout-overview.scss',
})
export class WorkoutOverview {
  readonly eyebrow = input<string | null>(null);
  readonly title = input.required<string>();
  readonly chips = input<readonly string[]>([]);
  /** A quiet line under the chips — what a starter does when you start it. */
  readonly hint = input<string | null>(null);
  readonly note = input<string | null>(null);
  readonly noteLabel = input('');
  readonly exercises = input.required<readonly OverviewExercise[]>();

  readonly exerciseSelect = output<string>();

  readonly noteOpen = signal(false);
  /** Only a note longer than its two clamped lines gets a "Show more". */
  readonly noteOverflows = signal(false);

  private readonly _noteText = viewChild<ElementRef<HTMLElement>>('noteText');

  constructor() {
    afterRenderEffect(() => {
      this.note();
      const el = this._noteText()?.nativeElement;
      if (!el || this.noteOpen()) return;
      this.noteOverflows.set(el.scrollHeight > el.clientHeight + 1);
    });
  }

  toggleNote(): void {
    this.noteOpen.update((open) => !open);
  }
}
