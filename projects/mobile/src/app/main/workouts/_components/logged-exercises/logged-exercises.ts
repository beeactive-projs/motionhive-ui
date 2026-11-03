import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  AccordionGroupCustomEvent,
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { take } from 'rxjs';

import { ExerciseProgress, LoggedExercise, ProgressService, WorkoutLog, translate } from 'core';

import { BadgeTones } from '../../../exercises/exercises.config';
import { exerciseBlocks, memberTag, roundCount } from '../../logger/logger-flow';
import { recordSessionIds, shortDayLabel } from '../../workouts.config';
import {
  Comparison,
  SetLine,
  compareWithLastTime,
  exerciseHistoryLink,
  exerciseLine,
  recordFor,
  setLines,
} from './logged-exercises.config';

/** An exercise's history, read once when the exercise is first opened. */
type History =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; progress: ExerciseProgress };

interface Row {
  kind: 'exercise';
  /** The accordion's value: the exercise's id. */
  key: string;
  exercise: LoggedExercise;
  /** Only an exercise with sets opens; a skipped one or an empty one is a plain row. */
  openable: boolean;
  line: string;
  record: boolean;
  sets: SetLine[];
  /** The history is being read; the comparison lands when it is. */
  comparing: boolean;
  /** How the top set compares with last time; null until known, or when it can't be. */
  comparison: Comparison | null;
}

/**
 * A superset as one block (Workouts R2, 4d): its exercises tagged A1, A2,
 * then the sets round by round. Opened, each exercise says how it went
 * against last time and links to its history.
 */
interface SupersetRow {
  kind: 'superset';
  /** The accordion's value: the first member's id. */
  key: string;
  /** "Superset · 3 rounds". */
  kicker: string;
  members: { tag: string; row: Row }[];
  /** "A1 22 × 10 · A2 × 15", one per round. */
  rounds: { index: number; line: string; done: boolean }[];
  record: boolean;
}

/**
 * What a finished workout held, exercise by exercise: a row per exercise
 * ("3 sets · top 62.5 × 7") that opens on its sets, how its top set compares
 * with the time before, and a link to the exercise's history.
 *
 * The person's own workout (the finish page) and a client's workout read by
 * their coach (`clientId`) share it; the history it reads and links to is
 * that person's, in the stack the page is in.
 */
@Component({
  selector: 'mh-logged-exercises',
  imports: [
    IonAccordion,
    IonAccordionGroup,
    IonBadge,
    IonButton,
    IonItem,
    IonLabel,
    IonList,
    IonSkeletonText,
    TranslatePipe,
  ],
  templateUrl: './logged-exercises.html',
  styleUrl: './logged-exercises.scss',
})
export class LoggedExercises {
  readonly log = input.required<WorkoutLog>();
  /** The client whose workout a coach is reading; null for the person's own. */
  readonly clientId = input<string | null>(null);

  private readonly _progressService = inject(ProgressService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  readonly Tones = BadgeTones;

  /** By exercise id, so the same exercise twice in a workout reads once. */
  private readonly _history = signal<Record<string, History>>({});

  readonly rows = computed<(Row | SupersetRow)[]>(() => {
    const log = this.log();
    const history = this._history();
    const rowOf = (exercise: LoggedExercise): Row => {
      const state = exercise.exerciseId ? history[exercise.exerciseId] : undefined;
      const record = recordFor(exercise, log.personalRecords);
      const recordFromHistory =
        state?.status === 'ready' && recordSessionIds(state.progress).has(log.id);
      return {
        kind: 'exercise',
        key: exercise.id,
        exercise,
        openable: !exercise.isSkipped && (exercise.sets ?? []).length > 0,
        line: exerciseLine(exercise),
        record: !!record || recordFromHistory,
        sets: setLines(exercise, record),
        comparing: state?.status === 'loading',
        comparison:
          state?.status === 'ready'
            ? compareWithLastTime(exercise, log, state.progress.sessions, shortDayLabel)
            : null,
      };
    };

    return exerciseBlocks(log.exercises ?? []).flatMap((block): (Row | SupersetRow)[] => {
      if (block.letter === null) return block.exercises.map(rowOf);
      const members = block.exercises.map((exercise) => ({
        tag: memberTag(block, exercise.id) ?? '',
        row: rowOf(exercise),
      }));
      const live = members.filter((m) => !m.row.exercise.isSkipped);
      const total = roundCount({ ...block, exercises: live.map((m) => m.row.exercise) });
      const rounds = Array.from({ length: total }, (_, index) => {
        const parts = live
          .map((m) => ({ tag: m.tag, set: m.row.sets[index] }))
          .filter((p) => !!p.set);
        return {
          index,
          line: parts.map((p) => `${p.tag} ${p.set.value || '–'}`).join(' · '),
          done: parts.every((p) => p.set.done),
        };
      });
      return [
        {
          kind: 'superset',
          key: block.exercises[0].id,
          kicker: translate('workouts.superset.summary', { count: total }),
          members,
          rounds,
          record: members.some((m) => m.row.record),
        },
      ];
    });
  });

  onChange(event: AccordionGroupCustomEvent): void {
    // Only the group's own change: an Ionic control inside would bubble one too.
    if (event.target !== event.currentTarget) return;
    const value = event.detail.value;
    const open: unknown[] = Array.isArray(value) ? value : value ? [value] : [];
    for (const id of open) {
      const row = this.rows().find((r) => r.key === id);
      const exercises =
        row?.kind === 'superset' ? row.members.map((m) => m.row.exercise) : row ? [row.exercise] : [];
      for (const exercise of exercises) {
        if (exercise.exerciseId) this._read(exercise.exerciseId);
      }
    }
  }

  openHistory(exercise: LoggedExercise): void {
    if (!exercise.exerciseId) return;
    void this._router.navigate(
      exerciseHistoryLink(this._router.url, exercise.exerciseId, this.clientId()),
    );
  }

  private _read(exerciseId: string): void {
    const known = this._history()[exerciseId];
    if (known && known.status !== 'failed') return;
    this._set(exerciseId, { status: 'loading' });
    const clientId = this.clientId();
    const request = clientId
      ? this._progressService.forClientExercise(clientId, exerciseId)
      : this._progressService.forExercise(exerciseId, { silent: true });
    request.pipe(take(1), takeUntilDestroyed(this._destroyRef)).subscribe({
      next: (progress) => this._set(exerciseId, { status: 'ready', progress }),
      // Quiet: the sets are still there; only the comparison is missing.
      error: () => this._set(exerciseId, { status: 'failed' }),
    });
  }

  private _set(exerciseId: string, state: History): void {
    this._history.update((all) => ({ ...all, [exerciseId]: state }));
  }
}
