import { DatePipe, DecimalPipe, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import {
  LoggedExercise,
  LoggedSet,
  WorkoutLog,
  WorkoutLogService,
  showApiError,
} from 'core';

/**
 * Read-only replay of a completed (or abandoned) workout log.
 *
 * One screen, two callers:
 *   - Client opens it from `/my/workouts` history rows.
 *   - Coach opens it from a client-profile Workouts tab row, with
 *     `?coach=1` — the BE hits its coach endpoint instead, gated by
 *     ACTIVE instructor_client.
 *
 * Pure render — no inputs, no rest timer, no mutate paths. Renders
 * the log tree, completed-set count vs prescribed, PR badges, and
 * the per-set actuals (reps × weight, or duration / distance for
 * cardio-shaped sets). Feeling rating + notes show at the top when
 * present.
 */
@Component({
  selector: 'mh-workout-log-replay',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ButtonModule, Toast],
  providers: [MessageService],
  templateUrl: './workout-log-replay.html',
  styleUrl: './workout-log-replay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutLogReplay implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _location = inject(Location);
  private readonly _service = inject(WorkoutLogService);
  private readonly _messageService = inject(MessageService);

  readonly log = signal<WorkoutLog | null>(null);
  readonly loading = signal(false);
  readonly isCoachView = signal(false);

  readonly exercises = computed<LoggedExercise[]>(
    () => this.log()?.exercises ?? [],
  );

  readonly setsDone = computed(() =>
    this.exercises()
      .flatMap((e) => e.sets ?? [])
      .filter((s) => s.isCompleted).length,
  );

  readonly setsPlanned = computed(() =>
    this.exercises().flatMap((e) => e.sets ?? []).length,
  );

  readonly totalVolumeKg = computed(() => {
    let v = 0;
    for (const ex of this.exercises()) {
      for (const s of ex.sets ?? []) {
        if (s.isCompleted && s.reps != null && s.weightKg != null) {
          v += s.reps * s.weightKg;
        }
      }
    }
    return Math.round(v);
  });

  readonly hasVolume = computed(() => this.totalVolumeKg() > 0);

  readonly durationLabel = computed(() => {
    const d = this.log()?.durationSeconds;
    if (d == null) return '—';
    const m = Math.floor(d / 60);
    const s = d % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  });

  readonly personalRecords = computed(() => this.log()?.personalRecords ?? []);
  readonly prCount = computed(() => this.personalRecords().length);

  readonly feelingGlyph = computed(() => {
    const r = this.log()?.feelingRating;
    if (r == null) return null;
    const glyphs = ['😣', '😕', '😐', '🙂', '💪'];
    return glyphs[Math.max(1, Math.min(5, r)) - 1];
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.goBack();
      return;
    }
    this.isCoachView.set(
      this._route.snapshot.queryParamMap.get('coach') === '1',
    );
    this.fetch(id);
  }

  goBack(): void {
    this._location.back();
  }

  exerciseSetsDone(ex: LoggedExercise): number {
    return (ex.sets ?? []).filter((s) => s.isCompleted).length;
  }

  exerciseTotal(ex: LoggedExercise): number {
    return (ex.sets ?? []).length;
  }

  /**
   * Pretty-print the actuals for a set:
   *   strength → "5 × 80 kg"
   *   bodyweight → "12 reps"
   *   cardio → "30 min" or "5 km"
   *   nothing logged → "—"
   */
  setActualLabel(s: LoggedSet): string {
    if (s.reps != null && s.weightKg != null) {
      return `${s.reps} × ${s.weightKg} kg`;
    }
    if (s.reps != null) return `${s.reps} reps`;
    if (s.durationSeconds != null) {
      const m = Math.round(s.durationSeconds / 60);
      return m > 0 ? `${m} min` : `${s.durationSeconds}s`;
    }
    if (s.distanceMeters != null) {
      return s.distanceMeters >= 1000
        ? `${(s.distanceMeters / 1000).toFixed(2)} km`
        : `${s.distanceMeters} m`;
    }
    return '—';
  }

  /** True if this exercise produced a 1RM PR in this session. */
  hasPr(ex: LoggedExercise): boolean {
    if (!ex.exerciseId) return false;
    return this.personalRecords().some((p) => p.exerciseId === ex.exerciseId);
  }

  prForExercise(ex: LoggedExercise) {
    return this.personalRecords().find((p) => p.exerciseId === ex.exerciseId);
  }

  private fetch(id: string): void {
    this.loading.set(true);
    const req$ = this.isCoachView()
      ? this._service.getForCoach(id)
      : this._service.get(id);
    req$.subscribe({
      next: (l) => {
        this.log.set(l);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          "Couldn't load workout",
          'It may have been removed or you may not have access.',
          err,
        );
      },
    });
  }
}
