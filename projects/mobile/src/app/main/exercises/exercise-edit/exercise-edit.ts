import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { Exercise, ExerciseService } from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ExerciseDetailsFields } from '../_components/exercise-details-fields/exercise-details-fields';
import { LevelSegment } from '../_components/level-segment/level-segment';
import { MuscleEquipmentFields } from '../_components/muscle-equipment-fields/muscle-equipment-fields';
import { ExerciseDraftForm, MAX_NAME_LENGTH } from '../exercise-draft';
import { EXERCISE_ICONS, KIND_ORDER, kindLabel } from '../exercises.config';

/**
 * Editing an exercise you own — one page, no steps.
 *
 * Creating is a sequence because nothing is known yet; editing is not.
 * Everything already has a value, the coach came here to change one of them,
 * and making them page through two screens they do not care about to reach
 * it would be the wizard misapplied.
 *
 * Delete sits last and red, after everything else, because it is the one
 * action on the page that cannot be walked back. It confirms in a sheet.
 * The server soft-deletes, so programs that already reference the exercise
 * keep working — which is why the confirmation can be plain rather than
 * frightening.
 */
@Component({
  selector: 'mh-exercise-edit',
  imports: [
    ConfirmSheet,
    EmptyState,
    ExerciseDetailsFields,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSkeletonText,
    IonSpinner,
    IonTitle,
    IonToolbar,
    LevelSegment,
    MuscleEquipmentFields,
  ],
  templateUrl: './exercise-edit.html',
  styleUrl: './exercise-edit.scss',
})
export class ExerciseEdit {
  private readonly _exerciseService = inject(ExerciseService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  readonly exerciseId = signal('');
  readonly exercise = signal<Exercise | null>(null);
  readonly form = new ExerciseDraftForm();

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);

  /**
   * Deleting routes back to the library, so the sheet is dismissed through
   * `close()` rather than by flipping `open`: routing away in the same turn
   * detaches this view before `[isOpen]` is applied, and the sheet would sit
   * on top of the list.
   */
  private readonly _deleteSheet = viewChild(ConfirmSheet);

  readonly maxNameLength = MAX_NAME_LENGTH;
  readonly kinds = KIND_ORDER;
  readonly kindLabel = kindLabel;

  readonly backHref = computed(() => `/tabs/exercises/${this.exerciseId()}`);

  readonly deleteTitle = computed(() => `Delete ${this.form.draft().name || 'this exercise'}?`);

  /**
   * Published work has readers. A public exercise other coaches have forked
   * is theirs now — their copies survive, and saying so is kinder than
   * letting them wonder what they just broke.
   */
  readonly forkNote = computed(() => {
    const exercise = this.exercise();
    if (!exercise || exercise.forkCount <= 0) return null;
    const copies = exercise.forkCount === 1 ? '1 coach has' : `${exercise.forkCount} coaches have`;
    return `${copies} forked this. Their copies keep what they have — your changes do not reach them.`;
  });

  constructor() {
    addIcons(EXERCISE_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const id = params.get('exerciseId');
      if (!id || id === this.exerciseId()) return;
      this.exerciseId.set(id);
      this._load(id);
    });
  }

  save(): void {
    const payload = this.form.payload();
    if (!payload || this.saving()) return;

    this.saving.set(true);
    this._exerciseService
      .update(this.exerciseId(), payload)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          void this._feedbackService.success('Exercise updated');
          // The detail page is the one under this in the stack; `replaceUrl`
          // drops this form and lands back on it, and it re-reads on entry.
          void this._router.navigate(['/tabs/exercises', this.exerciseId()], {
            replaceUrl: true,
          });
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(error, 'Could not save this exercise.');
        },
      });
  }

  confirmDelete(): void {
    this.deleteOpen.set(true);
  }

  remove(): void {
    if (this.deleting()) return;

    this.deleting.set(true);
    this._exerciseService
      .remove(this.exerciseId())
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          void this._leaveAfterDelete();
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          void this._feedbackService.error(error, 'Could not delete this exercise.');
        },
      });
  }

  retry(): void {
    const id = this.exerciseId();
    if (id) this._load(id);
  }

  private async _leaveAfterDelete(): Promise<void> {
    await this._deleteSheet()?.close();
    await this._feedbackService.success('Exercise deleted');
    // `replaceUrl`, so Back cannot return to the detail page of a row that
    // no longer exists.
    await this._router.navigateByUrl('/tabs/exercises', { replaceUrl: true });
  }

  private _load(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);

    this._exerciseService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (exercise) => {
          this.exercise.set(exercise);
          this.form.seed(exercise);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('This exercise is not available to edit.');
          this.loading.set(false);
        },
      });
  }
}
