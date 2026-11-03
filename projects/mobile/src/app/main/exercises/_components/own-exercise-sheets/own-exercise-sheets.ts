import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import { Exercise, ExerciseService } from 'core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { ConfirmSheet } from '../../../../_shared/components/confirm-sheet/confirm-sheet';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { ExerciseFormSheet } from '../../_sheets/exercise-form-sheet/exercise-form-sheet';
import {
  OWN_EXERCISE_ACTIONS,
  OwnExerciseActionId,
  OwnExerciseActionIds,
} from '../../exercises.config';

/**
 * The sheets that act on an exercise of your own: the row's ⋯ menu, the
 * simple form (to make one or change one) and the delete confirmation.
 *
 * The library page, the Workouts page's Exercises tab and an exercise's own
 * page all offer the same few verbs; this keeps them, their order and their
 * copy in one place. A host drops it in once, calls `menu`, `create`, `edit`
 * or `confirmDelete`, and refreshes on the outputs, which fire once the
 * sheet that caused them has gone, so a host can navigate on them.
 *
 * Deleting is a soft delete on the server: past workouts keep the exercise
 * and its name, which is why the confirmation can be plain.
 */
@Component({
  selector: 'mh-own-exercise-sheets',
  imports: [ActionSheet, ConfirmSheet, ExerciseFormSheet, TranslatePipe],
  templateUrl: './own-exercise-sheets.html',
})
export class OwnExerciseSheets {
  /**
   * The delete confirmation's body, as a key. A coach's exercise may sit in
   * programs, so the library passes the coach's wording in coach mode.
   */
  readonly deleteBody = input('exercises.own.deleteBody');

  readonly created = output<Exercise>();
  readonly updated = output<Exercise>();
  /** The id of the exercise that is gone. */
  readonly deleted = output<string>();

  private readonly _exerciseService = inject(ExerciseService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly actions = OWN_EXERCISE_ACTIONS;

  /** The exercise the menu or the confirmation is about. */
  readonly target = signal<Exercise | null>(null);
  /** What the form is editing; null while it makes a new one. */
  readonly editing = signal<Exercise | null>(null);

  readonly menuOpen = signal(false);
  readonly formOpen = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);
  readonly createName = signal('');

  private readonly _deleteSheet = viewChild(ConfirmSheet);

  readonly menuTitle = computed(() => this.target()?.name ?? '');

  readonly deleteTitle = computed<string>(() => {
    const name = this.target()?.name;
    return name
      ? this._translateService.instant('exercises.edit.deleteConfirm.title', { name })
      : this._translateService.instant('exercises.edit.deleteConfirm.titleFallback');
  });

  menu(exercise: Exercise): void {
    this.target.set(exercise);
    this.menuOpen.set(true);
  }

  /** The form, started from the words a search already has, if any. */
  create(name = ''): void {
    this.editing.set(null);
    this.createName.set(name);
    this.formOpen.set(true);
  }

  edit(exercise: Exercise): void {
    this.editing.set(exercise);
    this.formOpen.set(true);
  }

  confirmDelete(exercise: Exercise): void {
    this.target.set(exercise);
    this.deleteOpen.set(true);
  }

  /** Reported once the menu has gone, so the next sheet opens on a clear screen. */
  onAction(id: OwnExerciseActionId): void {
    const exercise = this.target();
    if (!exercise) return;
    if (id === OwnExerciseActionIds.Edit) this.edit(exercise);
    else this.confirmDelete(exercise);
  }

  onSaved(exercise: Exercise): void {
    if (this.editing()) this.updated.emit(exercise);
    else this.created.emit(exercise);
  }

  remove(): void {
    const exercise = this.target();
    if (!exercise || this.deleting()) return;

    this.deleting.set(true);
    this._exerciseService
      .remove(exercise.id)
      .pipe(take(1))
      .subscribe({
        next: () => void this._afterDelete(exercise.id),
        error: (error: unknown) => {
          this.deleting.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('exercises.edit.toast.deleteFailed'),
          );
        },
      });
  }

  /** Close first, then tell the host: a host leaving the page must not strand the sheet. */
  private async _afterDelete(id: string): Promise<void> {
    await this._deleteSheet()?.close();
    this.deleting.set(false);
    void this._feedbackService.success(
      this._translateService.instant('exercises.edit.toast.deleted'),
    );
    this.deleted.emit(id);
  }
}
