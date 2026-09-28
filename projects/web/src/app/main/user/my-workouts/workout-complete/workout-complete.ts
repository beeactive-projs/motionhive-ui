import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { Toast } from 'primeng/toast';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  LoggedExercise,
  LoggedSet,
  WorkoutLog,
  WorkoutLogService,
  WorkoutLogStatus,
  showApiError,
} from 'core';
import { KpiCard } from '../../../../_shared/components/kpi-card/kpi-card';

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
    ButtonDirective,
    Card,
    Dialog,
    InputTextModule,
    KpiCard,
    SelectButton,
    TextareaModule,
    Toast,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './workout-complete.html',
  styleUrl: './workout-complete.scss',
})
export class WorkoutComplete implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _service = inject(WorkoutLogService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly log = signal<WorkoutLog | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly feelingRating = signal<number | null>(null);
  readonly notes = signal('');

  // ── Save-as-routine dialog ──────────────────────────────────────
  readonly saveAsRoutineOpen = signal(false);
  readonly savingRoutine = signal(false);
  /** Carry today's numbers across, or keep the shape only. */
  readonly routineMode = signal<'TARGETS' | 'STRUCTURE'>('TARGETS');
  readonly routineModeOptions = [
    {
      label: this._translateService.instant('myWorkouts.complete.saveRoutine.mode.targets'),
      value: 'TARGETS' as const,
    },
    {
      label: this._translateService.instant('myWorkouts.complete.saveRoutine.mode.structure'),
      value: 'STRUCTURE' as const,
    },
  ];
  readonly routineName = signal('');
  readonly routineFolder = signal('');
  /** Tracks whether the user has already saved this log as a routine, so
   *  we can swap the CTA for a soft confirmation instead of letting them
   *  spam-create dupes. Per-session only — page reload resets it. */
  readonly savedRoutineId = signal<string | null>(null);

  readonly feelingOptions: FeelingOption[] = [
    { value: 1, glyph: '😣', label: this._translateService.instant('myWorkouts.complete.feeling.rough') },
    { value: 2, glyph: '😕', label: this._translateService.instant('myWorkouts.complete.feeling.tough') },
    { value: 3, glyph: '😐', label: this._translateService.instant('myWorkouts.complete.feeling.ok') },
    { value: 4, glyph: '🙂', label: this._translateService.instant('myWorkouts.complete.feeling.good') },
    { value: 5, glyph: '💪', label: this._translateService.instant('myWorkouts.complete.feeling.great') },
  ];

  // ── Derived stats ────────────────────────────────────────────────

  readonly exercises = computed<LoggedExercise[]>(() => this.log()?.exercises ?? []);

  readonly allSets = computed<LoggedSet[]>(() => this.exercises().flatMap((e) => e.sets ?? []));

  readonly setsDone = computed(() => this.allSets().filter((s) => s.isCompleted).length);

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

  readonly isCompleted = computed(() => this.log()?.status === WorkoutLogStatus.Completed);

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this._router.navigate(['/user/plans']);
      return;
    }
    this.fetch(id);
  }

  // ── Actions ──────────────────────────────────────────────────────

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
        ...(this.feelingRating() != null ? { feelingRating: this.feelingRating() as number } : {}),
        ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant('myWorkouts.complete.toast.feedbackSaved'),
            life: 2000,
          });
          this.backToPlan();
        },
        error: (err) => {
          this.saving.set(false);
          showApiError(
            this._messageService,
            this._translateService.instant('myWorkouts.complete.toast.saveFeedbackFailed'),
            this._translateService.instant('myWorkouts.common.pleaseRetry'),
            err,
          );
        },
      });
  }

  /** Whether there is anything to save. Drives the Skip affordance. */
  readonly hasFeedback = computed(
    () => this.feelingRating() != null || this.notes().trim().length > 0,
  );

  /** Coached work is visible to that coach; solo work is not. */
  readonly isCoached = computed(() => !!this.log()?.programAssignmentId);

  readonly notesPlaceholder = computed(() =>
    this._translateService.instant(
      this.isCoached()
        ? 'myWorkouts.complete.notes.placeholderCoached'
        : 'myWorkouts.complete.notes.placeholderSolo',
    ),
  );

  readonly notesAudience = computed(() =>
    this._translateService.instant(
      this.isCoached()
        ? 'myWorkouts.complete.notes.audienceCoached'
        : 'myWorkouts.complete.notes.audienceSolo',
    ),
  );

  /** Leave without persisting the note or the rating. */
  skipFeedback(): void {
    this.backToPlan();
  }

  /**
   * Back to Training, which is where you started and where the session
   * you just finished now appears. This used to land on "My plans",
   * which is not a tab any more — you finished a workout and arrived
   * somewhere with no obvious way back.
   */
  backToPlan(): void {
    void this._router.navigate(['/user/training']);
  }

  // ── Save as routine ─────────────────────────────────────────────

  /**
   * Only offered when something is actually repeatable: at least one
   * exercise still points at a catalog row and wasn't skipped.
   */
  readonly canSaveAsRoutine = computed(() =>
    this.exercises().some((ex) => !!ex.exerciseId && !ex.isSkipped),
  );

  openSaveAsRoutineDialog(): void {
    const cur = this.log();
    if (!cur) return;
    this.routineName.set(cur.name);
    this.routineFolder.set('');
    this.routineMode.set('TARGETS');
    this.saveAsRoutineOpen.set(true);
  }

  saveAsRoutine(): void {
    const cur = this.log();
    const name = this.routineName().trim();
    if (!cur || !name || this.savingRoutine()) return;

    this.savingRoutine.set(true);
    this._service
      .saveAsRoutine(cur.id, {
        name,
        ...(this.routineFolder().trim()
          ? { folder: this.routineFolder().trim() }
          : {}),
        mode: this.routineMode(),
      })
      .subscribe({
        next: (saved) => {
          this.savingRoutine.set(false);
          this.saveAsRoutineOpen.set(false);
          this.savedRoutineId.set(saved.id);
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant('myWorkouts.complete.toast.routineSaved'),
            detail: this._translateService.instant('myWorkouts.complete.toast.routineSavedDetail', {
              name: saved.name,
            }),
            life: 3000,
          });
        },
        error: (err) => {
          this.savingRoutine.set(false);
          showApiError(
            this._messageService,
            this._translateService.instant('myWorkouts.common.saveRoutineFailed'),
            this._translateService.instant('myWorkouts.common.pleaseRetry'),
            err,
          );
        },
      });
  }

  goToRoutines(): void {
    // Routines are always on screen in the Today lens now; the old
    // `?tab=routines` pointed at a tab that no longer exists.
    this._router.navigate(['/user/training']);
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
          this._translateService.instant('myWorkouts.common.loadWorkoutFailed'),
          this._translateService.instant('error.mayBeRemoved'),
          err,
        );
        this._router.navigate(['/user/plans']);
      },
    });
  }
}
