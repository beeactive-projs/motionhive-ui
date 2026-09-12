import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import { Exercise, LoggedExercise, LoggedSet, SetField, WorkoutLogService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import {
  ExerciseActionId,
  ExerciseActionsSheet,
} from '../_sheets/exercise-actions-sheet/exercise-actions-sheet';
import {
  KeypadField,
  NumericKeypad,
} from '../_components/numeric-keypad/numeric-keypad';
import { RestTimerBar } from '../_components/rest-timer-bar/rest-timer-bar';
import { SetRow } from '../_components/set-row/set-row';
import { WORKOUT_ICONS } from '../workouts.config';
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
  weight: 'weight',
  reps: 'reps',
  duration: 'duration',
  distance: 'distance',
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
 */
@Component({
  selector: 'mh-logger',
  imports: [
    ConfirmSheet,
    ExerciseActionsSheet,
    ExercisePickerSheet,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
    NumericKeypad,
    RestTimerBar,
    SetRow,
  ],
  providers: [LoggerStore],
  templateUrl: './logger.html',
  styleUrl: './logger.scss',
})
export class Logger implements ViewWillEnter, ViewWillLeave {
  readonly store = inject(LoggerStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _logService = inject(WorkoutLogService);
  private readonly _feedback = inject(FeedbackService);

  /** The cell bound to the keypad, or null when nothing is being edited. */
  readonly editing = signal<EditTarget | null>(null);
  readonly draft = signal('');

  /** Epoch ms when rest ends. Null parks the timer and frees the slot. */
  readonly restEndsAt = signal<number | null>(null);

  readonly pickerOpen = signal(false);
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

  /** Per-exercise "last time" sets, keyed by exercise id. */
  private readonly _previous = signal<Record<string, LoggedSet[]>>({});

  readonly keypadField = computed<KeypadField>(() => {
    const target = this.editing();
    return target ? KEYPAD_FIELD[target.field] : 'reps';
  });

  readonly keypadLabel = computed(() => {
    const target = this.editing();
    if (!target) return '';
    return target.field === 'weight' ? 'Weight (kg)' : target.field;
  });

  /** Keypad and rest timer share one slot; editing wins while it is open. */
  readonly pickerTitle = computed(() =>
    this.swapTarget() ? 'Swap exercise' : 'Add exercises',
  );

  readonly pickerContext = computed(() => {
    const target = this.swapTarget();
    return target
      ? `Replacing ${target.exerciseNameSnapshot}`
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
    return done > 0
      ? `${exercise.exerciseNameSnapshot} has ${done} completed ${done === 1 ? 'set' : 'sets'}. Removing it deletes them.`
      : `Remove ${exercise.exerciseNameSnapshot} from this workout?`;
  });

  readonly finishBody = computed(() => {
    const { done, total } = this.store.progress();
    const left = total - done;
    return `${left} ${left === 1 ? 'set is' : 'sets are'} still unticked. Finishing now records the workout as it stands.`;
  });

  readonly showKeypad = computed(() => this.editing() !== null);
  readonly showRest = computed(() => !this.showKeypad() && this.restEndsAt() !== null);

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
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

  // ─── Sets ─────────────────────────────────────────────────────

  toggleSet(exercise: LoggedExercise, set: LoggedSet): void {
    const next = !set.isCompleted;
    this.store.logSet(exercise.id, set.id, { isCompleted: next });

    // Completing a set starts the rest it prescribes. Un-ticking cancels it —
    // the user is correcting a mistake, not resting.
    if (next) {
      this.restEndsAt.set(Date.now() + this._restSecondsFor(set) * 1000);
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
    this.editing.set({ exerciseId: exercise.id, setId: set.id, field });
    const current =
      field === 'weight'
        ? set.weightKg
        : field === 'reps'
          ? set.reps
          : field === 'duration'
            ? set.durationSeconds
            : set.distanceMeters;
    this.draft.set(current == null ? '' : String(current));
  }

  commitCell(typed: string): void {
    const target = this.editing();
    if (!target) return;

    const raw = typed.trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) {
      this.editing.set(null);
      return;
    }

    const key =
      target.field === 'weight'
        ? 'weightKg'
        : target.field === 'reps'
          ? 'reps'
          : target.field === 'duration'
            ? 'durationSeconds'
            : 'distanceMeters';

    this.store.logSet(target.exerciseId, target.setId, { [key]: value ?? undefined });
    this.editing.set(null);
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
    void this._feedback.success('Rest over');
  }

  // ─── Exercises ────────────────────────────────────────────────

  toggleSkip(exercise: LoggedExercise): void {
    this.store.setSkipped(exercise.id, !exercise.isSkipped);
  }

  openActions(exercise: LoggedExercise): void {
    this.actionsFor.set(exercise);
    this.actionsOpen.set(true);
  }

  onAction(id: ExerciseActionId): void {
    const exercise = this.actionsFor();
    this.actionsFor.set(null);
    if (!exercise) return;

    if (id === 'swap') {
      this.swapTarget.set(exercise);
      this.pickerOpen.set(true);
    } else if (id === 'skip') {
      this.store.setSkipped(exercise.id, !exercise.isSkipped);
    } else {
      // Asked, not assumed: an exercise can hold sets that are already logged.
      this.actionsFor.set(exercise);
      this.removeConfirmOpen.set(true);
    }
  }

  confirmRemove(): void {
    const exercise = this.actionsFor();
    this.removeConfirmOpen.set(false);
    this.actionsFor.set(null);
    if (!exercise) return;
    this.store.removeExercise(exercise.id);
    void this._feedback.success(`Removed ${exercise.exerciseNameSnapshot}`);
  }

  /** Abandon the whole session — the "changed my mind" path, not a skip. */
  confirmDiscard(): void {
    const log = this.store.log();
    if (!log || this.discarding()) return;
    this.discarding.set(true);
    this._logService
      .discard(log.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.discarding.set(false);
          this.discardConfirmOpen.set(false);
          void this._feedback.success('Workout discarded');
          void this._router.navigate(['/tabs/workouts'], { replaceUrl: true });
        },
        error: (err) => {
          this.discarding.set(false);
          void this._feedback.error(err, 'Could not discard the workout');
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

  confirmFinish(): void {
    this.finishConfirmOpen.set(false);
    this._goToFinish();
  }

  private _goToFinish(): void {
    const log = this.store.log();
    if (log) void this._router.navigate(['/tabs/workouts/finish', log.id]);
  }

  private _startFreestyle(): void {
    // `from` is a Repeat off the history list: same movements, new session.
    const from = this._route.snapshot.queryParamMap.get('from');
    const name = `Workout — ${new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    })}`;

    this._logService
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
        error: (err) => void this._feedback.error(err, 'Could not start the workout'),
      });
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
      this._logService
        .lastForExercise(id)
        .pipe(take(1), catchError(() => of([] as LoggedSet[])))
        .subscribe((sets) => {
          this._previous.update((map) => ({ ...map, [id]: sets }));
        });
    }
  }

  /** Copy the movements out of a past workout into the one just started. */
  private _carryOver(sourceLogId: string): void {
    this._logService
      .get(sourceLogId)
      .pipe(take(1))
      .subscribe({
        next: (source) => {
          const ids = (source.exercises ?? [])
            .filter((e) => !e.isSkipped)
            .map((e) => e.exerciseId)
            .filter((id): id is string => !!id);
          if (!ids.length) {
            void this._feedback.info('That workout had no exercises to repeat');
            return;
          }
          this.store.addExercises(ids);
        },
        error: () => void this._feedback.info('Could not load that workout to repeat'),
      });
  }
}
