import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

import {
  ProgramAssignmentService,
  RoutineService,
  TrainingDay,
  TrainingDayWorkout,
  WorkoutLog,
  WorkoutLogService,
  injectIsMobile,
  injectIsTablet,
  showApiError,
} from 'core';

import { MobileFab } from '../../../../_shared/components/mobile-fab/mobile-fab';
import { TodayHero } from '../_components/today-hero/today-hero';

/**
 * One day of training: what is scheduled, what is already logged, and
 * the single action that belongs to the present.
 *
 * Only the two dated things in the model appear here. The routine
 * library used to sit directly underneath, which read as a list the
 * week strip was filtering — it never was, and never could be, because
 * routines carry no date.
 */
@Component({
  selector: 'mh-today-panel',
  standalone: true,
  imports: [
    FormsModule,
    ButtonDirective,
    Dialog,
    InputTextModule,
    MobileFab,
    TodayHero,
  ],
  templateUrl: './today-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayPanel implements OnInit {
  private readonly _service = inject(WorkoutLogService);
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _routineService = inject(RoutineService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);

  protected readonly isMobile = injectIsMobile();
  protected readonly isTablet = injectIsTablet();

  readonly trainingDay = signal<TrainingDay | null>(null);
  readonly trainingDayLoading = signal(false);

  /** An unfinished log takes over the hero. */
  readonly inProgressLog = signal<WorkoutLog | null>(null);

  /** Which day is showing; defaults to today. */
  readonly selectedDate = signal<Date>(new Date());

  /**
   * A count, not the list. The hero uses it to decide whether to mention
   * routines at all; pulling the library in here would re-couple the two
   * surfaces this split exists to separate.
   */
  readonly routineCount = signal(0);

  readonly startDialogOpen = signal(false);
  readonly newWorkoutName = signal('');
  readonly starting = signal(false);

  ngOnInit(): void {
    this._loadTrainingDay();
    this._loadInProgress();
    this._loadRoutineCount();
  }

  // ── Day navigation ───────────────────────────────────────────────

  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    this._loadTrainingDay();
  }

  /** Computed from the signal, so fast arrow clicks stack rather than
   * all reading the same not-yet-propagated input. */
  onWeekShift(deltaWeeks: number): void {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + deltaWeeks * 7);
    this.onDateSelected(d);
  }

  // ── Actions ──────────────────────────────────────────────────────

  resumeWorkout(log: WorkoutLog): void {
    void this._router.navigate(['/user/workout-log', log.id]);
  }

  startAssigned(w: TrainingDayWorkout): void {
    this._service.start({ assignedWorkoutId: w.assignedWorkoutId }).subscribe({
      next: (log) => this._router.navigate(['/user/workout-log', log.id]),
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't start that workout",
          'Please try again.',
          err,
        ),
    });
  }

  openStartFreestyle(): void {
    const day = new Date().toLocaleDateString(undefined, { weekday: 'long' });
    this.newWorkoutName.set(`${day} session`);
    this.startDialogOpen.set(true);
  }

  startFreestyle(): void {
    const name = this.newWorkoutName().trim();
    if (!name || this.starting()) return;
    this.starting.set(true);
    this._service.start({ name }).subscribe({
      next: (log) => {
        this.starting.set(false);
        this.startDialogOpen.set(false);
        void this._router.navigate(['/user/workout-log', log.id]);
      },
      error: (err) => {
        this.starting.set(false);
        showApiError(
          this._messageService,
          "Couldn't start workout",
          'Please try again.',
          err,
        );
      },
    });
  }

  // ── Loads ────────────────────────────────────────────────────────

  /**
   * One request covers the day and its week: the endpoint derives both
   * from the date it is given, so picking a day and paging a week are
   * the same call.
   */
  private _loadTrainingDay(): void {
    this.trainingDayLoading.set(true);
    // en-CA gives YYYY-MM-DD in local time. "Today" belongs to the
    // person training, not to the server's timezone.
    const date = this.selectedDate().toLocaleDateString('en-CA');
    this._assignmentService.trainingDay(date).subscribe({
      next: (d) => {
        this.trainingDay.set(d);
        this.trainingDayLoading.set(false);
      },
      // Not worth a toast: it degrades to the no-plan state and the rest
      // of the surface still works.
      error: () => this.trainingDayLoading.set(false),
    });
  }

  /** Independent of the selected day — an unfinished log is about now. */
  private _loadInProgress(): void {
    this._service.getInProgress().subscribe({
      next: (log) => this.inProgressLog.set(log),
      error: () => this.inProgressLog.set(null),
    });
  }

  private _loadRoutineCount(): void {
    this._routineService.list({ limit: 1 }).subscribe({
      next: (res) => this.routineCount.set(res.total),
      error: () => this.routineCount.set(0),
    });
  }
}
