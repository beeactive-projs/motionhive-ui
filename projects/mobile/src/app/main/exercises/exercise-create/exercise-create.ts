import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { ExerciseKind, ExerciseService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ExerciseDetailsFields } from '../_components/exercise-details-fields/exercise-details-fields';
import { LevelSegment } from '../_components/level-segment/level-segment';
import { MuscleEquipmentFields } from '../_components/muscle-equipment-fields/muscle-equipment-fields';
import { ExerciseDraftForm, MAX_NAME_LENGTH } from '../exercise-draft';
import { EXERCISE_ICONS, KIND_META, KIND_ORDER } from '../exercises.config';

const STEPS = [1, 2, 3] as const;
type Step = (typeof STEPS)[number];

/**
 * Writing a custom exercise, in three passes.
 *
 * The web form is a fourteen-field dialog. On a phone that is a wall, and
 * the fields are not equally important: a name, a kind and a muscle are what
 * make an exercise usable in a program, and everything else is refinement.
 * So the required half comes first over two short pages, and page three is
 * entirely optional — a coach who stops reading after step two still ends up
 * with something that works.
 *
 * Steps gate forward, never back: Next is disabled until the page is
 * answered, but Back always works and never discards what was typed.
 */
@Component({
  selector: 'mh-exercise-create',
  imports: [
    ExerciseDetailsFields,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
    LevelSegment,
    MuscleEquipmentFields,
  ],
  templateUrl: './exercise-create.html',
  styleUrl: './exercise-create.scss',
})
export class ExerciseCreate {
  private readonly _exerciseService = inject(ExerciseService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);

  readonly form = new ExerciseDraftForm();
  readonly step = signal<Step>(1);
  readonly saving = signal(false);

  readonly steps = STEPS;
  readonly maxNameLength = MAX_NAME_LENGTH;
  readonly kindCards = KIND_ORDER.map((kind) => ({ value: kind, ...KIND_META[kind] }));

  readonly canAdvance = computed(() => {
    switch (this.step()) {
      case 1:
        return this.form.isBasicsValid();
      case 2:
        return this.form.isMusclesValid();
      default:
        return this.form.isValid();
    }
  });

  readonly nextLabel = computed(() =>
    this.step() === 1 ? 'Next · Muscles & equipment' : 'Next · Details',
  );

  constructor() {
    addIcons(EXERCISE_ICONS);
  }

  selectKind(kind: ExerciseKind): void {
    this.form.patch({ kind });
  }

  back(): void {
    if (this.step() > 1) this.step.update((step) => (step - 1) as Step);
  }

  next(): void {
    if (!this.canAdvance()) return;
    if (this.step() < 3) {
      this.step.update((step) => (step + 1) as Step);
      return;
    }
    this.save();
  }

  cancel(): void {
    void this._router.navigateByUrl('/tabs/exercises');
  }

  save(): void {
    const payload = this.form.payload();
    if (!payload || this.saving()) return;

    this.saving.set(true);
    this._exerciseService
      .create(payload)
      .pipe(take(1))
      .subscribe({
        next: (exercise) => {
          this.saving.set(false);
          void this._feedbackService.success('Exercise created');
          // Replace, so Back from the new exercise returns to the library
          // rather than walking back into a form that has already been sent.
          void this._router.navigate(['/tabs/exercises', exercise.id], {
            replaceUrl: true,
          });
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(error, 'Could not create this exercise.');
        },
      });
  }
}
