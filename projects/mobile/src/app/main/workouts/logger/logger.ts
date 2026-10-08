import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonProgressBar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  NavController,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  Exercise,
  ExerciseKind,
  LoggedExercise,
  LoggedSet,
  SetField,
  SetFields,
  WorkoutLogService,
  appLocale,
  setFieldsFor,
} from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { RestAlertService } from '../../../_shared/services/rest-alert.service';
import { ActiveWorkoutService } from '../_services/active-workout.service';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { ExerciseCard } from '../_components/exercise-card/exercise-card';
import { NumericKeypad } from '../_components/numeric-keypad/numeric-keypad';
import { RestTimerBar } from '../_components/rest-timer-bar/rest-timer-bar';
import { SetRow } from '../_components/set-row/set-row';
import { ExerciseActionsSheet } from '../_sheets/exercise-actions-sheet/exercise-actions-sheet';
import {
  ExerciseActionId,
  ExerciseActionIds,
  KeypadField,
  KeypadFields,
  WORKOUT_ICONS,
  elapsedLabel,
  formatMeasure,
  secondsToClock,
  setPlaceholder,
  exerciseDoneSummary,
  exerciseSetSummary,
  isExerciseDone,
  lastTimeSummary,
} from '../workouts.config';
import { LoggerStore } from './logger.store';

/** Which cell the keypad is bound to. */
interface EditTarget {
  exerciseId: string;
  setId: string;
  field: SetField;
}

/**
 * Rest to use when nothing prescribes one — freestyle sets, mostly. Without a
 * fallback the timer would almost never fire outside a coached plan, which is
 * the opposite of what a rest timer is for. Ninety seconds is the common
 * default across trackers; it is a product choice, not a constraint.
 */
const DEFAULT_REST_SECONDS = 90;

/** The keypad's step size is keyed to the field, not the exercise kind. */
const KEYPAD_FIELD: Record<SetField, KeypadField> = {
  [SetFields.Weight]: KeypadFields.Weight,
  [SetFields.Reps]: KeypadFields.Reps,
  [SetFields.Duration]: KeypadFields.Duration,
  [SetFields.Distance]: KeypadFields.Distance,
};

/** The set grid's column heading for each field — translation keys. */
const COLUMN_LABELS: Record<SetField, string> = {
  [SetFields.Weight]: 'workouts.logger.columns.weight',
  [SetFields.Reps]: 'workouts.logger.columns.reps',
  [SetFields.Duration]: 'workouts.logger.columns.time',
  [SetFields.Distance]: 'workouts.logger.columns.distance',
};

/**
 * The active workout — the screen a trainee looks at for an hour.
 *
 * One long scrolling list of exercises rather than a pager: the design's
 * argument is that scanning beats swiping when you are re-planning mid
 * session, and add/swap/reorder all fight a pager.
 *
 * The bottom slot is shared and mutually exclusive — the keypad while a cell
 * is being edited, the rest timer while resting, and nothing otherwise. Both
 * dock rather than overlay so the set grid stays readable.
 *
 * Leaving is not ending. The chevron takes you back to the Workouts tab with
 * the session still open, where the resume banner waits; Finish and Discard
 * are the two ways a session actually ends.
 */
@Component({
  selector: 'mh-logger',
  imports: [
    ConfirmSheet,
    EmptyState,
    ExerciseActionsSheet,
    ExerciseCard,
    ExercisePickerSheet,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonProgressBar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NumericKeypad,
    RestTimerBar,
    SetRow,
    TranslatePipe,
  ],
  providers: [LoggerStore],
  templateUrl: './logger.html',
  styleUrl: './logger.scss',
})
export class Logger implements ViewWillEnter, ViewWillLeave {
  readonly store = inject(LoggerStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _restAlertService = inject(RestAlertService);
  private readonly _translateService = inject(TranslateService);
  private readonly _navController = inject(NavController);
  private readonly _activeWorkoutService = inject(ActiveWorkoutService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly skeletonCards = [1, 2];

  /** The cell bound to the keypad, or null when nothing is being edited. */
  readonly editing = signal<EditTarget | null>(null);
  readonly draft = signal('');
  /** What the keypad has typed so far, echoed into the open cell. */
  readonly typed = signal('');

  /**
   * Ticks once a second for as long as this page exists — the session clock
   * is the one number here that should visibly move. Not tied to Ionic's
   * enter/leave hooks: a missed re-enter would leave the clock frozen on a
   * workout that is still running. One page at a time, one signal write a
   * second; the time itself always comes from `startedAt`, never a count.
   */
  private readonly _now = signal(Date.now());
  private _ticker: ReturnType<typeof setInterval> | null = null;

  /**
   * Done exercises the user has opened again. Folding is otherwise automatic:
   * tick the last set and the exercise folds to its check row.
   */
  private readonly _unfolded = signal<ReadonlySet<string>>(new Set());

  /** Epoch ms when rest ends. Null parks the timer and frees the slot. */
  readonly restEndsAt = signal<number | null>(null);
  /** When the current rest began — the bar's progress measures from it. */
  readonly restStartedAt = signal<number | null>(null);
  /** The exercise whose set started the rest; "next up" looks on from there. */
  private readonly _restFrom = signal<string | null>(null);

  readonly pickerOpen = signal(false);
  /**
   * Bodyweight exercises the user has chosen to load. Per exercise and
   * opt-in, so weighted pull-ups get a weight column without cluttering
   * push-ups with one.
   */
  private readonly _loaded = signal<ReadonlySet<string>>(new Set());
  /**
   * The exercise being swapped out, or null when the picker is adding. One
   * sheet serves both: swapping is adding with something taken away.
   */
  readonly swapTarget = signal<LoggedExercise | null>(null);

  /** The exercise whose verb sheet is open. */
  readonly actionsFor = signal<LoggedExercise | null>(null);
  readonly actionsOpen = signal(false);

  /** Confirms that would otherwise lose logged work without asking. */
  readonly removeConfirmOpen = signal(false);
  readonly discardConfirmOpen = signal(false);
  readonly finishConfirmOpen = signal(false);
  readonly discarding = signal(false);

  /**
   * Finish and discard both navigate once confirmed, so those two sheets are
   * dismissed through their own `close()` rather than by flipping `open` —
   * routing away in the same turn would otherwise leave the sheet presented
   * over the page it just opened. Named refs: the logger owns three confirm
   * sheets, so a bare `viewChild(ConfirmSheet)` would pick the wrong one.
   */
  private readonly _discardSheet = viewChild<ConfirmSheet>('discardSheet');
  /** Read when focus jumps to another cell, so what was typed is kept. */
  private readonly _keypad = viewChild(NumericKeypad);
  private readonly _finishSheet = viewChild<ConfirmSheet>('finishSheet');

  /** Per-exercise "last time" sets, keyed by exercise id. */
  private readonly _previous = signal<Record<string, LoggedSet[]>>({});

  /** Identifies the open cell for the keypad, so it re-seeds on every move. */
  readonly editingKey = computed(() => {
    const target = this.editing();
    return target ? `${target.setId}:${target.field}` : '';
  });

  readonly keypadField = computed<KeypadField>(() => {
    const target = this.editing();
    return target ? KEYPAD_FIELD[target.field] : KeypadFields.Reps;
  });

  /** "Back squat · Set 3 · kg" — which cell the pad is filling, in the grid's words. */
  readonly keypadLabel = computed(() => {
    const target = this.editing();
    if (!target) return '';
    const exercise = this.store.exercises().find((e) => e.id === target.exerciseId);
    const index = (exercise?.sets ?? []).findIndex((s) => s.id === target.setId);
    return [
      exercise?.exerciseNameSnapshot,
      this._translateService.instant('workouts.logger.setNumber', { number: index + 1 }),
      exercise ? this._columnLabel(exercise, target.field) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  readonly elapsed = computed(() => {
    const log = this.store.log();
    return log ? elapsedLabel(log.startedAt, this._now()) : '';
  });

  readonly progressRatio = computed(() => {
    const { done, total } = this.store.progress();
    return total > 0 ? done / total : 0;
  });

  readonly pickerTitle = computed(() =>
    this._translateService.instant(
      this.swapTarget() ? 'workouts.exerciseActions.swap' : 'workouts.common.addExercises',
    ),
  );

  readonly pickerContext = computed(() => {
    const target = this.swapTarget();
    return target
      ? this._translateService.instant('workouts.logger.picker.replacing', {
          name: target.exerciseNameSnapshot,
        })
      : (this.store.log()?.name ?? '');
  });

  /** Already in this workout, so the sheet does not offer them again. */
  readonly addedIds = computed(() =>
    this.store
      .exercises()
      .map((e) => e.exerciseId)
      .filter((id): id is string => !!id),
  );

  /** What removing this exercise would throw away. */
  readonly removeBody = computed(() => {
    const exercise = this.actionsFor();
    if (!exercise) return '';
    const done = (exercise.sets ?? []).filter((s) => s.isCompleted).length;
    const name = exercise.exerciseNameSnapshot;
    return done > 0
      ? this._translateService.instant('workouts.logger.remove.messageWithSets', { name, count: done })
      : this._translateService.instant('workouts.logger.remove.message', { name });
  });

  readonly finishBody = computed(() => {
    const { done, total } = this.store.progress();
    return this._translateService.instant('workouts.logger.finishConfirm.message', {
      count: total - done,
    });
  });

  /**
   * The set to do after this rest: the next unticked one in the exercise just
   * worked, then on through the exercises below, wrapping round to any left
   * open above. Null once everything is ticked.
   */
  readonly nextUp = computed(() => {
    const exercises = this.store.exercises().filter((e) => !e.isSkipped);
    const from = Math.max(0, exercises.findIndex((e) => e.id === this._restFrom()));
    const order = [...exercises.slice(from), ...exercises.slice(0, from)];

    for (const exercise of order) {
      const sets = exercise.sets ?? [];
      const index = sets.findIndex((s) => !s.isCompleted);
      if (index < 0) continue;

      const set = sets[index];
      const target = this._targetText(exercise, set, index);
      const isLast = sets.slice(index + 1).every((s) => s.isCompleted);
      return {
        title: [
          this._translateService.instant('workouts.logger.setNumber', { number: index + 1 }),
          target,
        ]
          .filter(Boolean)
          .join(' · '),
        detail: [
          exercise.exerciseNameSnapshot,
          isLast ? this._translateService.instant('workouts.restTimer.lastSet') : '',
        ]
          .filter(Boolean)
          .join(' · '),
      };
    }
    return null;
  });

  readonly showKeypad = computed(() => this.editing() !== null);
  readonly showRest = computed(() => !this.showKeypad() && this.restEndsAt() !== null);

  constructor() {
    addIcons(WORKOUT_ICONS);

    // One place to mirror the countdown to the OS. Every path that starts,
    // extends, skips or abandons rest already routes through `restEndsAt`,
    // so the alert follows it without a call at each of those sites. The
    // service only reaches the OS once the app is backgrounded.
    effect(() => this._restAlertService.track(this.restEndsAt()));

    this._startTicker();
    this._destroyRef.onDestroy(() => this._stopTicker());
  }

  ionViewWillEnter(): void {
    // Catch the clock up at once rather than on the next tick.
    this._now.set(Date.now());

    const id = this._route.snapshot.paramMap.get('id');
    if (!id) return;

    if (id === 'new') this._startFreestyle();
    else this.store.load(id, () => this._loadLastTimes());
  }

  ionViewWillLeave(): void {
    // Leaving the screen must not leave a countdown running against a
    // workout the user is no longer looking at.
    this.restEndsAt.set(null);
    this.editing.set(null);
  }

  /** Back to the Workouts tab with the session still running. */
  leave(): void {
    void this._navController.navigateBack('/tabs/workouts');
  }

  retry(): void {
    this.ionViewWillEnter();
  }

  // ─── Sets ─────────────────────────────────────────────────────

  toggleSet(exercise: LoggedExercise, set: LoggedSet): void {
    // A tick while typing is a Done: keep the number, close the pad.
    this._keepTyped();
    this.editing.set(null);

    const next = !set.isCompleted;
    this.store.logSet(exercise.id, set.id, { isCompleted: next });

    // Completing a set starts the rest it prescribes. Un-ticking cancels it —
    // the user is correcting a mistake, not resting.
    if (next) {
      const now = Date.now();
      this._restFrom.set(exercise.id);
      this.restStartedAt.set(now);
      this.restEndsAt.set(now + this._restSecondsFor(set) * 1000);
    } else {
      this.restEndsAt.set(null);
    }
  }

  /**
   * What the user set for this set wins, then what the coach prescribed, then
   * the default. The prescription lives on `assignedSet` — the deep copy into
   * the log deliberately leaves `restAfterSeconds` null until someone edits
   * it, so reading only the logged row finds nothing on a coached workout.
   */
  private _restSecondsFor(set: LoggedSet): number {
    return (
      set.restAfterSeconds ?? set.assignedSet?.restAfterSeconds ?? DEFAULT_REST_SECONDS
    );
  }

  editCell(exercise: LoggedExercise, set: LoggedSet, field: SetField): void {
    // Tapping another cell is a Done for this one: what was typed stays.
    this._keepTyped();
    this.editing.set({ exerciseId: exercise.id, setId: set.id, field });
    this.typed.set('');
    const current = cellValue(set, field);
    this.draft.set(current == null ? '' : String(current));
  }

  commitCell(typed: string): void {
    this._save(typed);
    this.editing.set(null);
  }

  /**
   * "Next field": save this cell and open the one after it — across the row,
   * then down to the next set, then into the next exercise. Past the last
   * cell the pad simply closes.
   */
  nextCell(typed: string): void {
    const target = this.editing();
    this._save(typed);
    if (!target) return;

    const cells = this.store
      .exercises()
      .filter((e) => !e.isSkipped)
      .flatMap((exercise) =>
        (exercise.sets ?? []).flatMap((set) =>
          this._fieldsFor(exercise).map((field) => ({ exercise, set, field })),
        ),
      );
    const at = cells.findIndex(
      (c) => c.set.id === target.setId && c.field === target.field,
    );
    const next = at >= 0 ? cells[at + 1] : undefined;
    if (!next) {
      this.editing.set(null);
      return;
    }
    // The store has the value just saved; read the next cell from it fresh.
    this.editCell(next.exercise, next.set, next.field);
  }

  /**
   * "82.5 kg × 6–8": what the set asks for, field by field — the number
   * already typed, else the target or last time, the same grey the cell shows.
   */
  private _targetText(exercise: LoggedExercise, set: LoggedSet, index: number): string {
    const previous = this.previousFor(exercise, index);
    return this._fieldsFor(exercise)
      .map((field) => {
        const typed = cellValue(set, field);
        const text =
          typed == null
            ? setPlaceholder(set, field, previous)
            : field === SetFields.Duration
              ? secondsToClock(typed)
              : formatMeasure(typed);
        if (!text) return '';
        if (field === SetFields.Weight) {
          return this._translateService.instant('workouts.units.kg', { value: text });
        }
        if (field === SetFields.Distance) {
          return this._translateService.instant('workouts.units.meters', { value: text });
        }
        return text;
      })
      .filter(Boolean)
      .join(' × ');
  }

  /** Saves whatever the open keypad holds — before focus leaves its cell. */
  private _keepTyped(): void {
    const keypad = this._keypad();
    if (this.editing() && keypad) this._save(keypad.committed());
  }

  /** Writes the typed value into the cell the pad is bound to. */
  private _save(typed: string): void {
    const target = this.editing();
    if (!target) return;

    const raw = typed.trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;

    // Unchanged is not a write: moving through cells should not hit the API.
    const set = this.store
      .exercises()
      .find((e) => e.id === target.exerciseId)
      ?.sets?.find((s) => s.id === target.setId);
    // `?? null`: a cleared cell is patched to undefined locally, never null.
    if (set && (cellValue(set, target.field) ?? null) === value) return;

    this.store.logSet(target.exerciseId, target.setId, {
      [PAYLOAD_KEY[target.field]]: value ?? undefined,
    });
  }

  /** Offer the weight column only where it is missing and would mean something. */
  canAddWeight(exercise: LoggedExercise): boolean {
    return exercise.exercise?.kind === ExerciseKind.Bodyweight && !this.hasAddedWeight(exercise);
  }

  hasAddedWeight(exercise: LoggedExercise): boolean {
    return this._loaded().has(exercise.id);
  }

  addWeight(exercise: LoggedExercise): void {
    this._loaded.update((set) => new Set(set).add(exercise.id));
  }

  isUnilateral(exercise: LoggedExercise): boolean {
    return exercise.exercise?.isUnilateral ?? false;
  }

  /** Column headings for this exercise, which vary with its kind. */
  columnsFor(exercise: LoggedExercise): string[] {
    return this._fieldsFor(exercise).map((field) => this._columnLabel(exercise, field));
  }

  /** The cells a set row draws for this exercise, in order — the same rule `mh-set-row` uses. */
  private _fieldsFor(exercise: LoggedExercise): SetField[] {
    const fields = setFieldsFor(exercise.exercise?.kind);
    return this.hasAddedWeight(exercise) && !fields.includes(SetFields.Weight)
      ? [SetFields.Weight, ...fields]
      : fields;
  }

  private _columnLabel(exercise: LoggedExercise, field: SetField): string {
    return this._translateService.instant(
      field === SetFields.Reps && this.isUnilateral(exercise)
        ? 'workouts.logger.columns.repsEach'
        : COLUMN_LABELS[field],
    );
  }

  /**
   * Under the name: what last time held, when there was a last time — the
   * number you are trying to beat. Otherwise "2 of 4 sets".
   */
  cardMeta(exercise: LoggedExercise): string {
    const previous = exercise.exerciseId ? this._previous()[exercise.exerciseId] : undefined;
    const summary = previous ? lastTimeSummary(previous) : '';
    return summary
      ? this._translateService.instant('workouts.setRow.lastTime', { value: summary })
      : exerciseSetSummary(exercise);
  }

  // ─── Folding ──────────────────────────────────────────────────

  /** A finished exercise folds to its check row unless it was opened again. */
  isFolded(exercise: LoggedExercise): boolean {
    return isExerciseDone(exercise) && !this._unfolded().has(exercise.id);
  }

  unfold(exercise: LoggedExercise): void {
    this._unfolded.update((set) => new Set(set).add(exercise.id));
  }

  /** "3 sets done · 2,140 kg". */
  doneSummary(exercise: LoggedExercise): string {
    return exerciseDoneSummary(exercise);
  }

  editingFieldFor(setId: string): SetField | null {
    const target = this.editing();
    return target?.setId === setId ? target.field : null;
  }

  previousFor(exercise: LoggedExercise, index: number): LoggedSet | null {
    const id = exercise.exerciseId;
    if (!id) return null;
    return this._previous()[id]?.[index] ?? null;
  }

  addSet(exercise: LoggedExercise): void {
    this.store.addSet(exercise.id);
  }

  removeSet(exercise: LoggedExercise, set: LoggedSet): void {
    if (this.editing()?.setId === set.id) this.editing.set(null);
    this.store.removeSet(exercise.id, set.id, () => {
      void this._feedbackService.error(
        null,
        this._translateService.instant('workouts.logger.toast.removeSetFailed'),
      );
    });
  }

  // ─── Rest ─────────────────────────────────────────────────────

  nudgeRest(seconds: number): void {
    const end = this.restEndsAt();
    if (end === null) return;
    this.restEndsAt.set(Math.max(Date.now(), end + seconds * 1000));
  }

  skipRest(): void {
    this.restEndsAt.set(null);
  }

  onRestFinished(): void {
    void this._feedbackService.success(
      this._translateService.instant('workouts.restTimer.restOver'),
    );
  }

  // ─── Exercises ────────────────────────────────────────────────

  openActions(exercise: LoggedExercise): void {
    this.actionsFor.set(exercise);
    this.actionsOpen.set(true);
  }

  onAction(id: ExerciseActionId): void {
    const exercise = this.actionsFor();
    this.actionsFor.set(null);
    if (!exercise) return;

    switch (id) {
      case ExerciseActionIds.Swap:
        this.swapTarget.set(exercise);
        this.pickerOpen.set(true);
        return;
      case ExerciseActionIds.Skip:
        this.store.setSkipped(exercise.id, !exercise.isSkipped);
        return;
      case ExerciseActionIds.Remove:
        // Asked, not assumed: an exercise can hold sets that are already logged.
        this.actionsFor.set(exercise);
        this.removeConfirmOpen.set(true);
        return;
    }
  }

  confirmRemove(): void {
    const exercise = this.actionsFor();
    this.removeConfirmOpen.set(false);
    this.actionsFor.set(null);
    if (!exercise) return;
    this.store.removeExercise(exercise.id);
    void this._feedbackService.success(
      this._translateService.instant('workouts.logger.toast.removed', {
        name: exercise.exerciseNameSnapshot,
      }),
    );
  }

  /** Abandon the whole session — the "changed my mind" path, not a skip. */
  confirmDiscard(): void {
    const log = this.store.log();
    if (!log || this.discarding()) return;
    this.discarding.set(true);
    this._workoutLogService
      .discard(log.id)
      .pipe(take(1))
      .subscribe({
        next: async () => {
          this.discarding.set(false);
          await this._discardSheet()?.close();
          void this._feedbackService.success(
            this._translateService.instant('workouts.logger.toast.discarded'),
          );
          void this._router.navigate(['/tabs/workouts'], { replaceUrl: true });
        },
        error: (err) => {
          this.discarding.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.logger.toast.discardFailed'),
          );
        },
      });
  }

  addExercise(): void {
    this.swapTarget.set(null);
    this.pickerOpen.set(true);
  }

  /** One handler for both jobs — whether it swaps depends on `swapTarget`. */
  onPicked(picked: Exercise[]): void {
    this.pickerOpen.set(false);
    if (!picked.length) return;

    const target = this.swapTarget();
    this.swapTarget.set(null);

    if (target) {
      this.store.swapExercise(target.id, picked[0].id, () => this._loadLastTimes());
      return;
    }
    this.store.addExercises(
      picked.map((e) => e.id),
      () => this._loadLastTimes(),
    );
  }

  /** The catalog page for this movement, pushed onto the workouts stack. */
  openExercise(exercise: LoggedExercise): void {
    if (!exercise.exerciseId) return;
    void this._router.navigate(['/tabs/workouts/exercise', exercise.exerciseId]);
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  /**
   * Finishing with sets still unticked is allowed — an explicit finish marks
   * the workout complete even when partial — but it is worth one question,
   * because the alternative reading is "I tapped the wrong thing".
   */
  finish(): void {
    if (!this.store.log()) return;
    const { done, total } = this.store.progress();
    if (total > 0 && done < total) {
      this.finishConfirmOpen.set(true);
      return;
    }
    this._goToFinish();
  }

  async confirmFinish(): Promise<void> {
    await this._finishSheet()?.close();
    this._goToFinish();
  }

  private _goToFinish(): void {
    const log = this.store.log();
    if (log) void this._router.navigate(['/tabs/workouts/finish', log.id]);
  }

  private _startFreestyle(): void {
    // `from` is a Repeat off the history list: same movements, new session.
    const from = this._route.snapshot.queryParamMap.get('from');
    const name = this._translateService.instant('workouts.logger.defaultName', {
      date: new Date().toLocaleDateString(appLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }),
    });

    // `new` means "start one", so with one already open this route becomes
    // that one — replaced, so back does not land on `new` and try again.
    this._activeWorkoutService.startOrResume(
      () =>
        this._workoutLogService
          .start({ name })
          .pipe(take(1))
          .subscribe({
            next: (log) => {
              this.store.adopt(log);
              // Replace, so a back-swipe does not start a second empty workout.
              void this._router.navigate(['/tabs/workouts/log', log.id], {
                replaceUrl: true,
              });
              if (from) this._carryOver(from);
            },
            error: (err) =>
              void this._feedbackService.error(
                err,
                this._translateService.instant('workouts.common.startFailed'),
              ),
          }),
      {
        onBlocked: (open) => this.store.load(open.id, () => this._loadLastTimes()),
        replaceUrl: true,
      },
    );
  }

  /**
   * "Last time" for every movement in the workout, one call each.
   *
   * Fetched once on open rather than per row: the set grid renders before
   * these land and simply shows an em dash until they do, which is also the
   * honest answer for a movement never done before.
   */
  private _loadLastTimes(): void {
    const ids = Array.from(
      new Set(
        this.store
          .exercises()
          .map((e) => e.exerciseId)
          .filter((id): id is string => !!id),
      ),
    ).filter((id) => !(id in this._previous()));
    if (!ids.length) return;

    for (const id of ids) {
      this._workoutLogService
        .lastForExercise(id)
        .pipe(take(1), catchError(() => of([] as LoggedSet[])))
        .subscribe((sets) => {
          this._previous.update((map) => ({ ...map, [id]: sets }));
        });
    }
  }

  /** Copy the movements out of a past workout into the one just started. */
  private _carryOver(sourceLogId: string): void {
    this._workoutLogService
      .get(sourceLogId)
      .pipe(take(1))
      .subscribe({
        next: (source) => {
          const ids = (source.exercises ?? [])
            .filter((e) => !e.isSkipped)
            .map((e) => e.exerciseId)
            .filter((id): id is string => !!id);
          if (!ids.length) {
            void this._feedbackService.info(
              this._translateService.instant('workouts.logger.toast.nothingToRepeat'),
            );
            return;
          }
          this.store.addExercises(ids);
        },
        error: () =>
          void this._feedbackService.info(
            this._translateService.instant('workouts.logger.toast.repeatFailed'),
          ),
      });
  }

  private _startTicker(): void {
    this._stopTicker();
    this._now.set(Date.now());
    this._ticker = setInterval(() => this._now.set(Date.now()), 1000);
  }

  private _stopTicker(): void {
    if (this._ticker !== null) clearInterval(this._ticker);
    this._ticker = null;
  }
}

/** Which log column each set field writes to. */
const PAYLOAD_KEY: Record<SetField, 'weightKg' | 'reps' | 'durationSeconds' | 'distanceMeters'> = {
  [SetFields.Weight]: 'weightKg',
  [SetFields.Reps]: 'reps',
  [SetFields.Duration]: 'durationSeconds',
  [SetFields.Distance]: 'distanceMeters',
};

function cellValue(set: LoggedSet, field: SetField): number | null {
  return set[PAYLOAD_KEY[field]];
}
