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
import { take } from 'rxjs/operators';

import { LoggedExercise, LoggedSet, SetField, WorkoutLogService } from 'core';

import { FeedbackService } from '../../../_shared/services/feedback.service';
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
  readonly showKeypad = computed(() => this.editing() !== null);
  readonly showRest = computed(() => !this.showKeypad() && this.restEndsAt() !== null);

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) return;

    if (id === 'new') this._startFreestyle();
    else this.store.load(id);
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

  // ─── Lifecycle ────────────────────────────────────────────────

  finish(): void {
    const log = this.store.log();
    if (log) void this._router.navigate(['/tabs/workouts/finish', log.id]);
  }

  private _startFreestyle(): void {
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
        },
        error: (err) => void this._feedback.error(err, 'Could not start the workout'),
      });
  }
}
