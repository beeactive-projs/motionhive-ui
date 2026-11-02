import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonNote,
  IonSkeletonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { Observable, firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { Exercise, PrescribedExercise, Program, ProgramService, ProgramWorkout } from 'core';

import { ChoiceSheet } from '../../../_shared/components/choice-sheet/choice-sheet';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { coachStackOf } from '../../clients/client-paths';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { ExerciseCard } from '../../workouts/_components/exercise-card/exercise-card';
import { DEFAULT_SETS, secondsToClock } from '../../workouts/workouts.config';
import {
  NO_REST,
  builderRestChoices,
  linkWithNext,
  supersetTags,
  unlinkFromNext,
} from '../../workouts/routine-builder/routine-builder.config';
import { PROGRAM_ICONS, dayLabel, weekLabel } from '../programs.config';

/**
 * One day of a program — the same job the routine builder does, over the
 * program's nested API rather than the routine service's flattened view.
 *
 * Deliberately not the routine-builder component reused literally: a routine
 * writes through `RoutineService` (one implied workout, exercises flattened)
 * while a day writes through `ProgramService` at
 * `programs/:id/workouts/:workoutId/exercises`. Same screen to a coach, two
 * different shapes underneath, and pretending otherwise is how the concepts
 * get mixed. The exercise card they share is the one piece that is the same.
 */
@Component({
  selector: 'mh-day-editor',
  imports: [
    ChoiceSheet,
    ConfirmSheet,
    EmptyState,
    ExerciseCard,
    ExercisePickerSheet,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonNote,
    IonSkeletonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
  templateUrl: './day-editor.html',
  styleUrl: './day-editor.scss',
})
export class DayEditor implements ViewWillEnter, ViewWillLeave {
  private readonly _programService = inject(ProgramService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  /** Programs, or Clients when the plan was opened from a client's page. */
  private readonly _stack = coachStackOf(this._router.url);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly skeletonCards = [1, 2];

  readonly program = signal<Program | null>(null);
  readonly workout = signal<ProgramWorkout | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly pickerOpen = signal(false);
  readonly removeTarget = signal<PrescribedExercise | null>(null);
  readonly removeOpen = signal(false);

  readonly name = signal('');
  readonly note = signal('');

  /** Which rest the sheet is choosing: the day's, the program's, or one exercise's. */
  readonly restFor = signal<
    { kind: 'day' } | { kind: 'program' } | { kind: 'exercise'; row: PrescribedExercise } | null
  >(null);
  readonly restOpen = signal(false);

  /** "A1", "A2": superset tags, one per exercise row. */
  readonly tags = computed(() => supersetTags(this.exercises()));
  readonly dayRest = computed(() => this.workout()?.defaultRestSeconds ?? null);
  readonly programRest = computed(() => this.program()?.defaultRestSeconds ?? null);
  readonly dayRestLabel = computed(() => this._restLabel(this.dayRest(), this.programRest()));
  readonly programRestLabel = computed(() => this._restLabel(this.programRest(), null));

  readonly restTitle = computed(() => {
    const target = this.restFor();
    if (target?.kind === 'exercise') {
      return this._translateService.instant('workouts.routineBuilder.rest.exercise', {
        name: this.exerciseName(target.row),
      });
    }
    return this._translateService.instant(
      target?.kind === 'program' ? 'programs.dayEditor.rest.program' : 'programs.dayEditor.rest.day',
    );
  });

  readonly restOptions = computed(() => {
    const target = this.restFor();
    const inherit =
      target?.kind === 'exercise'
        ? this._translateService.instant('programs.dayEditor.rest.sameAsDay', { value: this.dayRestLabel() })
        : target?.kind === 'day'
          ? this._translateService.instant('programs.dayEditor.rest.sameAsProgram', {
              value: this.programRestLabel(),
            })
          : this._translateService.instant('programs.dayEditor.rest.clientDefault');
    return builderRestChoices(inherit);
  });

  readonly restSelected = computed(() => {
    const target = this.restFor();
    const value =
      target?.kind === 'exercise'
        ? this.exerciseRest(target.row)
        : target?.kind === 'program'
          ? this.programRest()
          : this.dayRest();
    return value === null ? NO_REST : String(value);
  });

  private _programId: string | null = null;
  private _workoutId: string | null = null;
  /**
   * Whether name and note have been seeded from the server for this day.
   * `load` re-runs after every exercise change to refresh the list, and
   * re-seeding the fields then threw away whatever the user had typed but
   * not yet saved — a renamed day snapped back to "Day 4" on adding an
   * exercise. The fields are filled once per day, then left alone.
   */
  private _fieldsSeeded = false;
  /** Name and note as the server last confirmed them, so a blur that changed nothing writes nothing. */
  private _saved = { name: '', note: '' };
  private _pendingSave: Promise<boolean> | null = null;

  readonly showSkeleton = computed(() => this.loading() && !this.workout());
  readonly showError = computed(
    () => !this.loading() && !this.workout() && (this.error() || !!this.program()),
  );

  /** Where back lands when there is no stack to pop — a reload, a deep link. */
  readonly builderUrl = computed(() => {
    const id = this.program()?.id;
    return id ? `${this._stack}/program/${id}` : this._stack;
  });

  readonly eyebrow = computed(() => {
    const workout = this.workout();
    if (!workout) return '';
    return `${weekLabel(workout.weekIndex)} · ${dayLabel(workout.dayIndex)}`;
  });

  readonly exercises = computed<PrescribedExercise[]>(
    () => this.workout()?.exercises ?? [],
  );

  readonly addedIds = computed(() => this.exercises().map((e) => e.exerciseId));

  readonly removeBody = computed(() => {
    const row = this.removeTarget();
    return row
      ? this._translateService.instant('programs.dayEditor.remove.body', {
          name: this.exerciseName(row),
        })
      : '';
  });

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  ionViewWillEnter(): void {
    const programId = this._route.snapshot.paramMap.get('id');
    const workoutId = this._route.snapshot.paramMap.get('workoutId');
    if (!programId || !workoutId) return;
    if (programId === this._programId && workoutId === this._workoutId) return;

    this._programId = programId;
    this._workoutId = workoutId;
    this._fieldsSeeded = false;
    this.load();
  }

  /**
   * Leaving by the back button must not lose a rename. Everything else on
   * this screen saves as it happens; name and note do the same on blur,
   * with the leave hook catching a field still focused on the way out.
   */
  ionViewWillLeave(): void {
    void this.saveFields();
  }

  exerciseName(row: PrescribedExercise): string {
    return row.exercise?.name ?? this._translateService.instant('programs.dayEditor.exerciseFallback');
  }

  setsLabel(row: PrescribedExercise): string {
    return this._translateService.instant('count.sets', { count: (row.sets ?? []).length });
  }

  // ─── Rest and supersets ───────────────────────────────────────

  /** The exercise's own rest, when every set agrees on one; null when it takes the day's. */
  exerciseRest(row: PrescribedExercise): number | null {
    const rests = (row.sets ?? []).map((set) => set.restAfterSeconds ?? null);
    const first = rests[0] ?? null;
    return first !== null && rests.every((r) => r === first) ? first : null;
  }

  restChip(row: PrescribedExercise): string {
    const rest = this.exerciseRest(row);
    return rest === null ? '' : secondsToClock(rest);
  }

  openRest(target: 'day' | 'program' | PrescribedExercise): void {
    this.restFor.set(
      target === 'day' ? { kind: 'day' } : target === 'program' ? { kind: 'program' } : { kind: 'exercise', row: target },
    );
    this.restOpen.set(true);
  }

  pickRest(value: string): void {
    const seconds = value === NO_REST ? null : Number(value);
    const target = this.restFor();
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!target || !programId || !workoutId) return;
    if (target.kind === 'exercise') {
      this._write(
        this._programService.updateExercise(programId, workoutId, target.row.id, {
          restAfterSeconds: seconds,
        }),
      );
    } else if (target.kind === 'program') {
      this._write(this._programService.update(programId, { defaultRestSeconds: seconds }));
    } else {
      this._write(
        this._programService.updateWorkout(programId, workoutId, { defaultRestSeconds: seconds }),
      );
    }
  }

  /** Is this exercise linked to the one after it? */
  linkedToNext(index: number): boolean {
    const rows = this.exercises();
    const group = rows[index]?.supersetGroupId ?? null;
    return group !== null && rows[index + 1]?.supersetGroupId === group;
  }

  /**
   * Link with the next exercise, or undo it. The new groups are worked out
   * here, the same rules as the routine builder, and only the rows whose
   * group changed are saved.
   */
  toggleLink(index: number): void {
    const programId = this._programId;
    const workoutId = this._workoutId;
    const rows = this.exercises();
    if (!programId || !workoutId) return;
    const next = this.linkedToNext(index) ? unlinkFromNext(rows, index) : linkWithNext(rows, index);
    const changed = next.filter((row, i) => (row.supersetGroupId ?? null) !== (rows[i].supersetGroupId ?? null));
    if (!changed.length) return;
    this._write(
      forkJoin(
        changed.map((row) =>
          this._programService.updateExercise(programId, workoutId, row.id, {
            supersetGroupId: row.supersetGroupId ?? null,
          }),
        ),
      ),
    );
  }

  /** "1:30", or the rest it falls back to: "Program (1:30)", "Client's own". */
  private _restLabel(own: number | null, fallback: number | null): string {
    if (own !== null) return secondsToClock(own);
    return fallback !== null
      ? this._translateService.instant('programs.dayEditor.rest.fromProgram', { value: secondsToClock(fallback) })
      : this._translateService.instant('programs.dayEditor.rest.clientDefault');
  }

  private _write(request: Observable<unknown>): void {
    this.saving.set(true);
    request.pipe(take(1)).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        void this._feedbackService.error(
          err,
          this._translateService.instant('programs.dayEditor.toast.saveFailed'),
        );
      },
    });
  }

  // ─── Editing ──────────────────────────────────────────────────

  onPicked(picked: Exercise[]): void {
    this.pickerOpen.set(false);
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!programId || !workoutId || !picked.length) return;

    // `defaultSets` has the server create the empty sets with the
    // exercise: one request per movement, not one per set. A day with
    // nothing prescribed under its movements is not a day.
    this.saving.set(true);
    forkJoin(
      picked.map((exercise) =>
        this._programService
          .addExercise(programId, workoutId, {
            exerciseId: exercise.id,
            defaultSets: DEFAULT_SETS,
          })
          .pipe(catchError((err: unknown) => of(err))),
      ),
    )
      .pipe(take(1))
      .subscribe((results) => {
        this.saving.set(false);
        const failure = results.find((r) => !(r as PrescribedExercise)?.id);
        if (failure) {
          void this._feedbackService.error(
            failure,
            this._translateService.instant('programs.dayEditor.toast.someNotAdded'),
          );
        }
        this.load();
      });
  }

  askRemove(row: PrescribedExercise): void {
    this.removeTarget.set(row);
    this.removeOpen.set(true);
  }

  confirmRemove(): void {
    const row = this.removeTarget();
    this.removeOpen.set(false);
    this.removeTarget.set(null);
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!row || !programId || !workoutId) return;

    this._programService
      .removeExercise(programId, workoutId, row.id)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(() => this.load());
  }

  openExercise(row: PrescribedExercise): void {
    void this._router.navigate([this._stack, 'exercise', row.exerciseId]);
  }

  /**
   * Write name and note if they differ from what the server has. Resolves
   * to whether the day is now saved; a save already in flight is awaited
   * rather than duplicated.
   */
  saveFields(): Promise<boolean> {
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!programId || !workoutId || !this._fieldsSeeded) return Promise.resolve(true);

    const name =
      this.name().trim() || this._translateService.instant('programs.dayEditor.untitledDay');
    const note = this.note().trim();
    if (name === this._saved.name && note === this._saved.note) {
      return this._pendingSave ?? Promise.resolve(true);
    }

    const previous = this._saved;
    this._saved = { name, note };
    this._pendingSave = firstValueFrom(
      this._programService.updateWorkout(programId, workoutId, { name, notes: note }),
    )
      .then(() => true)
      .catch((err: unknown) => {
        this._saved = previous;
        void this._feedbackService.error(
          err,
          this._translateService.instant('programs.dayEditor.toast.saveFailed'),
        );
        return false;
      })
      .finally(() => {
        this._pendingSave = null;
      });
    return this._pendingSave;
  }

  async done(): Promise<void> {
    const programId = this._programId;
    if (!programId) return;

    this.saving.set(true);
    const saved = await this.saveFields();
    this.saving.set(false);
    // Back to the week card this came from, not the library — but only
    // with the day saved; leaving on a failed save is how a rename is lost.
    if (saved) void this._router.navigate([this._stack, 'program', programId]);
  }

  load(): void {
    const programId = this._programId;
    if (!programId) return;
    this.loading.set(true);
    this.error.set(false);

    this._programService
      .get(programId)
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this.program.set(program);
          const day = (program.workouts ?? []).find((w) => w.id === this._workoutId) ?? null;
          this.workout.set(day);
          if (day && !this._fieldsSeeded) {
            this.name.set(day.name);
            this.note.set(day.notes ?? '');
            this._saved = { name: day.name, note: day.notes ?? '' };
            this._fieldsSeeded = true;
          }
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
