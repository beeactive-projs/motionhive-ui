import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { SelectButton } from 'primeng/selectbutton';
import { Toast } from 'primeng/toast';

import {
  LoggedExercise,
  LoggedSet,
  Routine,
  RoutineService,
  WorkoutLog,
  WorkoutLogService,
  showApiError,
} from 'core';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { RoutineFormDialog } from '../_dialogs/routine-form-dialog/routine-form-dialog';

type Tab = 'workouts' | 'routines' | 'exercises';

interface MonthGroup {
  label: string;
  logs: WorkoutLog[];
}

interface HistoryRow {
  log: WorkoutLog;
  /** "12-week hypertrophy base · W5" — null for freestyle. */
  subtitle: string | null;
  durationMin: number | null;
  setsDone: number;
  feelingGlyph: string | null;
}

/**
 * Client workout history (S13 — `/my/workouts`).
 *
 * Reverse-chronological list of COMPLETED workout logs, grouped by
 * month. Each row → the read-only replay (S11 read-mode, ships with
 * the active-log slice). Lives on its own route per the locked
 * decision — history spans every plan a client has ever done.
 *
 * Filters (program, date range) are stubbed until the BE supports
 * them. The card-style rows match the design's compact row pattern.
 */
@Component({
  selector: 'mh-client-workouts-history',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    ConfirmDialog,
    Dialog,
    InputTextModule,
    SelectButton,
    Toast,
    TooltipModule,
    RoutineFormDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './client-workouts-history.html',
  styleUrl: './client-workouts-history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientWorkoutsHistory {
  private readonly _service = inject(WorkoutLogService);
  private readonly _routineService = inject(RoutineService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  readonly items = signal<WorkoutLog[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly pageSize = 30;

  // ── Tabs (Workouts / Routines stub / Exercises shortcut) ─────────

  readonly tab = signal<Tab>('workouts');
  readonly tabOptions: { value: Tab; label: string }[] = [
    { value: 'workouts', label: 'Workouts' },
    { value: 'routines', label: 'Routines' },
    { value: 'exercises', label: 'Exercises' },
  ];

  // ── Freestyle start dialog ───────────────────────────────────────

  readonly startDialogOpen = signal(false);
  readonly newWorkoutName = signal('');
  readonly starting = signal(false);

  // ── Routines state ───────────────────────────────────────────────

  readonly routines = signal<Routine[]>([]);
  readonly routinesLoading = signal(false);
  readonly routineDialogOpen = signal(false);
  readonly routineDialogTarget = signal<Routine | null>(null);
  /** id of the routine currently being started — drives per-card spinner. */
  readonly startingRoutineId = signal<string | null>(null);

  readonly hasMore = computed(() => this.items().length < this.total());

  readonly rows = computed<HistoryRow[]>(() =>
    this.items().map((l) => this._toRow(l)),
  );

  readonly totalTrainingHours = computed(() => {
    const totalSec = this.items().reduce(
      (n, l) => n + (l.durationSeconds ?? 0),
      0,
    );
    return Math.round(totalSec / 3600);
  });

  readonly months = computed<MonthGroup[]>(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const l of this.items()) {
      const d = new Date(l.startedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en', { month: 'long', year: 'numeric' });
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
      // Stash label on the first push by encoding into the key separately.
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, logs]) => {
        const d = new Date(logs[0].startedAt);
        return {
          label: d.toLocaleString('en', { month: 'long', year: 'numeric' }),
          logs,
        };
      });
  });

  private readonly _feelingGlyphs = ['😣', '😕', '😐', '🙂', '💪'];

  constructor() {
    const initial = this._route.snapshot.queryParamMap.get('tab');
    if (initial === 'routines' || initial === 'exercises') {
      this.tab.set(initial);
    }
    effect(() => {
      this.page.set(1);
      this.fetch(true);
    });
    // Lazy-load routines the first time the tab is opened.
    effect(() => {
      if (this.tab() === 'routines' && this.routines().length === 0) {
        this._loadRoutines();
      }
    });
  }

  // ── Routines actions ─────────────────────────────────────────────

  openCreateRoutine(): void {
    this.routineDialogTarget.set(null);
    this.routineDialogOpen.set(true);
  }

  openEditRoutine(r: Routine): void {
    // The list endpoint returns minimal exercises (just ids). Fetch the
    // full routine before opening edit so the dialog has the per-exercise
    // defaults to hydrate from.
    this._routineService.get(r.id).subscribe({
      next: (full) => {
        this.routineDialogTarget.set(full);
        this.routineDialogOpen.set(true);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't open routine",
          'Please retry.',
          err,
        ),
    });
  }

  onRoutineSaved(r: Routine): void {
    const existing = this.routines();
    const idx = existing.findIndex((x) => x.id === r.id);
    if (idx >= 0) {
      const next = existing.slice();
      next[idx] = r;
      this.routines.set(next);
    } else {
      this.routines.set([r, ...existing]);
    }
    this.routineDialogOpen.set(false);
  }

  startRoutine(r: Routine): void {
    if (this.startingRoutineId()) return;
    this.startingRoutineId.set(r.id);
    this._routineService.start(r.id).subscribe({
      next: (log) => {
        this.startingRoutineId.set(null);
        this._router.navigate(['/my/workout-log', log.id]);
      },
      error: (err) => {
        this.startingRoutineId.set(null);
        showApiError(
          this._messageService,
          "Couldn't start routine",
          'Please retry.',
          err,
        );
      },
    });
  }

  confirmDeleteRoutine(r: Routine): void {
    this._confirmationService.confirm({
      header: 'Delete routine?',
      message: `Delete "${r.name}"? Past workouts you've logged from it stay in your history.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Delete',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancel',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._deleteRoutine(r),
    });
  }

  routineExerciseCount(r: Routine): number {
    return r.exercises?.length ?? 0;
  }

  private _loadRoutines(): void {
    this.routinesLoading.set(true);
    this._routineService.list({ limit: 100 }).subscribe({
      next: (res) => {
        this.routines.set(res.items);
        this.routinesLoading.set(false);
      },
      error: (err) => {
        this.routinesLoading.set(false);
        showApiError(
          this._messageService,
          "Couldn't load routines",
          'Please retry.',
          err,
        );
      },
    });
  }

  private _deleteRoutine(r: Routine): void {
    this._routineService.remove(r.id).subscribe({
      next: () => {
        this.routines.update((cur) => cur.filter((x) => x.id !== r.id));
        this._messageService.add({
          severity: 'success',
          summary: 'Routine deleted',
          life: 2000,
        });
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't delete routine",
          'Please retry.',
          err,
        ),
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.fetch(false);
  }

  openReplay(log: WorkoutLog): void {
    // S11 read-mode lands with the active log slice. For now a polite
    // stub so the route doesn't dead-end.
    this._messageService.add({
      severity: 'info',
      summary: 'Replay lands with S11',
      detail: `Read-only replay of "${log.name}" arrives with the active log.`,
      life: 3000,
    });
  }

  goToPlans(): void {
    this._router.navigate(['/my/plans']);
  }

  openStartFreestyle(): void {
    // Default the name to a friendly "Tuesday session" pattern.
    const day = new Date().toLocaleString('en', { weekday: 'long' });
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
        this._router.navigate(['/my/workout-log', log.id]);
      },
      error: (err) => {
        this.starting.set(false);
        showApiError(
          this._messageService,
          "Couldn't start workout",
          'Please retry.',
          err,
        );
      },
    });
  }

  goToExercises(): void {
    this._router.navigate(['/coaching/exercises']);
  }

  // ── Template helpers ─────────────────────────────────────────────

  feelingGlyph(log: WorkoutLog): string | null {
    if (log.feelingRating == null) return null;
    const idx = Math.max(1, Math.min(5, log.feelingRating)) - 1;
    return this._feelingGlyphs[idx];
  }

  // ── Internals ────────────────────────────────────────────────────

  private _toRow(log: WorkoutLog): HistoryRow {
    const subtitle = log.assignment
      ? log.assignment.programNameSnapshot
      : null;
    const durationMin =
      log.durationSeconds != null ? Math.round(log.durationSeconds / 60) : null;
    const setsDone = (log.exercises ?? []).reduce(
      (n: number, e: LoggedExercise) =>
        n + (e.sets ?? []).filter((s: LoggedSet) => s.isCompleted).length,
      0,
    );
    return {
      log,
      subtitle,
      durationMin,
      setsDone,
      feelingGlyph: this.feelingGlyph(log),
    };
  }

  private fetch(replace: boolean): void {
    if (replace) this.loading.set(true);
    else this.loadingMore.set(true);

    const settle = (): void => {
      this.loading.set(false);
      this.loadingMore.set(false);
    };

    this._service.list({ page: this.page(), limit: this.pageSize }).subscribe({
      next: (res) => {
        if (replace) this.items.set(res.items);
        else this.items.update((cur) => [...cur, ...res.items]);
        this.total.set(res.total);
        settle();
      },
      error: (err) => {
        settle();
        showApiError(
          this._messageService,
          "Couldn't load your history",
          'Check your connection and try again.',
          err,
        );
      },
    });
  }
}
