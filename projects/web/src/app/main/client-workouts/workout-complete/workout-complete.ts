import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';
import { Toast } from 'primeng/toast';

import {
  LoggedExercise,
  LoggedSet,
  WorkoutLog,
  WorkoutLogService,
  WorkoutLogStatus,
  showApiError,
} from 'core';

interface FeelingOption {
  value: number;
  glyph: string;
  label: string;
}

/**
 * Workout complete summary (S12).
 *
 * Shown after the client finishes the active log. Headline stats use
 * the locked V1 multi-metric pattern — render only the tiles that the
 * session actually populates. So a strength session shows Duration /
 * Sets / Volume; a bodyweight session shows Duration / Sets / Reps;
 * a cardio session (when we add it) would show Duration / Distance.
 *
 * Feeling rating uses the emoji affordance (decision: emoji as
 * *rating control* is acceptable, even though the no-emoji-in-strings
 * rule applies to copy). Falls back to numeric on read-back screens.
 *
 * "Share to feed" stays disabled in V1 as a forward-compat placeholder.
 */
@Component({
  selector: 'mh-workout-complete',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    TextareaModule,
    Toast,
  ],
  providers: [MessageService],
  templateUrl: './workout-complete.html',
  styleUrl: './workout-complete.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutComplete implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _service = inject(WorkoutLogService);
  private readonly _messageService = inject(MessageService);

  readonly log = signal<WorkoutLog | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly feelingRating = signal<number | null>(null);
  readonly notes = signal('');

  readonly feelingOptions: FeelingOption[] = [
    { value: 1, glyph: '😣', label: 'Rough' },
    { value: 2, glyph: '😕', label: 'Tough' },
    { value: 3, glyph: '😐', label: 'OK' },
    { value: 4, glyph: '🙂', label: 'Good' },
    { value: 5, glyph: '💪', label: 'Great' },
  ];

  // ── Derived stats ────────────────────────────────────────────────

  readonly exercises = computed<LoggedExercise[]>(
    () => this.log()?.exercises ?? [],
  );

  readonly allSets = computed<LoggedSet[]>(() =>
    this.exercises().flatMap((e) => e.sets ?? []),
  );

  readonly setsDone = computed(
    () => this.allSets().filter((s) => s.isCompleted).length,
  );

  readonly setsPlanned = computed(() => this.allSets().length);

  /** Σ(reps × weightKg) over loaded sets that were completed. */
  readonly totalVolumeKg = computed(() => {
    let v = 0;
    for (const s of this.allSets()) {
      if (s.isCompleted && s.reps != null && s.weightKg != null) {
        v += s.reps * s.weightKg;
      }
    }
    return Math.round(v);
  });

  /** Total reps for bodyweight (sets that have reps but no weight). */
  readonly totalReps = computed(() => {
    let n = 0;
    for (const s of this.allSets()) {
      if (s.isCompleted && s.reps != null && s.weightKg == null) {
        n += s.reps;
      }
    }
    return n;
  });

  readonly totalDistanceM = computed(() => {
    let n = 0;
    for (const s of this.allSets()) {
      if (s.isCompleted && s.distanceMeters != null) {
        n += s.distanceMeters;
      }
    }
    return n;
  });

  readonly hasVolume = computed(() => this.totalVolumeKg() > 0);
  readonly hasReps = computed(() => this.totalReps() > 0);
  readonly hasDistance = computed(() => this.totalDistanceM() > 0);

  readonly personalRecords = computed(() => this.log()?.personalRecords ?? []);
  readonly prCount = computed(() => this.personalRecords().length);

  readonly durationLabel = computed(() => {
    const d = this.log()?.durationSeconds;
    if (d == null) return '—';
    const m = Math.floor(d / 60);
    const s = d % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  });

  readonly isCompleted = computed(
    () => this.log()?.status === WorkoutLogStatus.Completed,
  );

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this._router.navigate(['/my/plans']);
      return;
    }
    this.fetch(id);
  }

  // ── Actions ──────────────────────────────────────────────────────

  selectFeeling(value: number): void {
    this.feelingRating.set(value);
  }

  saveFeedback(): void {
    const cur = this.log();
    if (!cur) return;
    // S12 is shown after the workout is already marked complete by the
    // log screen. This second call just persists the feeling rating +
    // notes if they were filled in here.
    if (this.feelingRating() == null && !this.notes().trim()) {
      this.backToPlan();
      return;
    }
    this.saving.set(true);
    this._service
      .complete(cur.id, {
        ...(this.feelingRating() != null
          ? { feelingRating: this.feelingRating() as number }
          : {}),
        ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this._messageService.add({
            severity: 'success',
            summary: 'Feedback saved',
            life: 2000,
          });
          this.backToPlan();
        },
        error: (err) => {
          this.saving.set(false);
          showApiError(
            this._messageService,
            "Couldn't save feedback",
            'Please retry.',
            err,
          );
        },
      });
  }

  backToPlan(): void {
    const cur = this.log();
    if (cur?.programAssignmentId) {
      this._router.navigate(['/my/plans', cur.programAssignmentId]);
    } else {
      this._router.navigate(['/my/plans']);
    }
  }

  // ── Internals ────────────────────────────────────────────────────

  private fetch(id: string): void {
    this.loading.set(true);
    this._service.get(id).subscribe({
      next: (l) => {
        this.log.set(l);
        this.feelingRating.set(l.feelingRating);
        this.notes.set(l.notes ?? '');
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
        this._router.navigate(['/my/plans']);
      },
    });
  }
}
