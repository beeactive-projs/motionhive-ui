import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { LoggedExercise, WorkoutLog, WorkoutLogService } from 'core';

import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { PROGRAM_ICONS, workoutDurationOf } from '../programs.config';

/**
 * One of a client's workouts, as the coach sees it.
 *
 * Read-only by construction — this is a record of what someone did, and the
 * coach's job here is to read it, not to correct it. It deliberately mirrors
 * the trainee's own summary so the two are talking about the same thing.
 */
@Component({
  selector: 'mh-log-review',
  imports: [
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    StatTile,
  ],
  templateUrl: './log-review.html',
  styleUrl: './log-review.scss',
})
export class LogReview implements ViewWillEnter {
  private readonly _logService = inject(WorkoutLogService);
  private readonly _router = inject(Router);

  readonly log = signal<WorkoutLog | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);

  readonly durationLabel = computed(
    () => workoutDurationOf(this.log()?.durationSeconds) || '—',
  );

  readonly exercises = computed<LoggedExercise[]>(() => this.log()?.exercises ?? []);

  /** Only the modalities this session actually contained. */
  readonly tiles = computed(() => {
    const sets = this.exercises()
      .flatMap((e) => e.sets ?? [])
      .filter((s) => s.isCompleted);

    const volume = sets.reduce(
      (sum, s) => sum + (s.weightKg != null && s.reps != null ? s.weightKg * s.reps : 0),
      0,
    );
    const reps = sets
      .filter((s) => s.weightKg == null && s.reps != null)
      .reduce((sum, s) => sum + (s.reps ?? 0), 0);
    const seconds = sets.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);

    const tiles: { label: string; value: string }[] = [
      { label: 'Sets', value: String(sets.length) },
    ];
    if (volume > 0) tiles.push({ label: 'Volume', value: `${Math.round(volume)} kg` });
    if (reps > 0) tiles.push({ label: 'Reps', value: String(reps) });
    if (seconds > 0) tiles.push({ label: 'Time', value: `${Math.round(seconds / 60)} min` });
    return tiles;
  });

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  ionViewWillEnter(): void {
    const id = this._router.url.split('?')[0].split('/').pop() ?? null;
    if (!id) return;

    this.loading.set(true);
    this.failed.set(false);
    this._logService
      .getForCoach(id)
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          this.log.set(log);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  setSummary(exercise: LoggedExercise): string {
    const sets = exercise.sets ?? [];
    const done = sets.filter((s) => s.isCompleted).length;
    return `${done} of ${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  }
}
