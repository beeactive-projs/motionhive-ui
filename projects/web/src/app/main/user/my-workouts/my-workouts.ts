import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { Skeleton } from 'primeng/skeleton';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';

import {
  LoggedExercise,
  LoggedSet,
  Routine,
  RoutineService,
  SectionLabel,
  TimeRow,
  TimeRowSkeleton,
  WorkoutLog,
  WorkoutLogService,
  MobileFab,
  formatSessionTime,
  injectIsMobile,
  injectIsTablet,
  showApiError,
} from 'core';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';
import { RoutineFormDialog } from '../../client-workouts/_dialogs/routine-form-dialog/routine-form-dialog';

type WorkoutTab = 'workouts' | 'routines' | 'exercises';

interface TabSpec {
  key: WorkoutTab;
  label: string;
  icon: string;
}

/** One workout history row, fully projected for `<mh-time-row>`. */
interface WorkoutRow {
  log: WorkoutLog;
  /** Day-of-month number shown in the time-row's primary slot (e.g. "14"). */
  dayNum: string;
  /** Short weekday under the day number (e.g. "Sat"). */
  weekday: string;
  /** Clock time the workout started (e.g. "09:00"). */
  clockTime: string;
  title: string;
  /** Program name snapshot, or "Freestyle workout" when unassigned. */
  subtitle: string;
  /** "45 min" — null when the duration is unknown. */
  durationLabel: string | null;
  /** "12 sets". */
  setsLabel: string;
  feelingGlyph: string | null;
  prCount: number;
  /** "PR" / "3 PRs" badge text — empty when no PRs. */
  prLabel: string;
  tone: 'honey' | 'teal';
}

/** Workouts grouped by calendar month, most recent first. */
interface MonthGroup {
  label: string;
  count: number;
  rows: WorkoutRow[];
}

/**
 * Client workout history (S13 — `/user/workouts`).
 *
 * Reverse-chronological list of COMPLETED workout logs, grouped by
 * month and rendered with the shared `mh-time-row` agenda primitives so
 * it matches the my-sessions surface. Each row → the read-only replay
 * (S11 read-mode). Lives on its own route per the locked decision —
 * history spans every plan a client has ever done.
 */
@Component({
  selector: 'mh-my-workouts',
  standalone: true,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    FormsModule,
    ButtonModule,
    Card,
    ConfirmDialog,
    Dialog,
    InputTextModule,
    Skeleton,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tag,
    Toast,
    TooltipModule,
    TimeRow,
    TimeRowSkeleton,
    SectionLabel,
    MobileFab,
    ListEmptyState,
    RoutineFormDialog,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './my-workouts.html',
  styleUrl: './my-workouts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyWorkouts {
  private readonly _service = inject(WorkoutLogService);
  private readonly _routineService = inject(RoutineService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  protected readonly isMobile = injectIsMobile();
  protected readonly isTablet = injectIsTablet();

  readonly items = signal<WorkoutLog[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly page = signal(1);
  readonly pageSize = 30;

  // ── Tabs (Workouts / Routines / Exercises shortcut) ──────────────

  readonly tab = signal<WorkoutTab>('workouts');
  readonly tabs: TabSpec[] = [
    { key: 'workouts', label: 'Workouts', icon: 'pi pi-history' },
    { key: 'routines', label: 'Routines', icon: 'pi pi-clone' },
    { key: 'exercises', label: 'Exercises', icon: 'pi pi-bolt' },
  ];

  // ── Freestyle start dialog ───────────────────────────────────────

  readonly startDialogOpen = signal(false);
  readonly newWorkoutName = signal('');
  readonly starting = signal(false);

  // ── Routines state ───────────────────────────────────────────────

  readonly routines = signal<Routine[]>([]);
  readonly routinesLoading = signal(false);
  /**
   * Guards the lazy-load effect so it fires exactly once. Keying off
   * `routines().length === 0` instead would re-trigger forever for users
   * with zero routines (each empty `set([])` is a fresh array reference,
   * re-running the effect → infinite fetch loop).
   */
  private readonly _routinesRequested = signal(false);
  readonly routineDialogOpen = signal(false);
  readonly routineDialogTarget = signal<Routine | null>(null);
  /** id of the routine currently being started — drives per-card spinner. */
  readonly startingRoutineId = signal<string | null>(null);

  readonly hasMore = computed(() => this.items().length < this.total());

  readonly totalTrainingHours = computed(() => {
    const totalSec = this.items().reduce(
      (n, l) => n + (l.durationSeconds ?? 0),
      0,
    );
    return Math.round(totalSec / 3600);
  });

  /** History projected into month groups of `<mh-time-row>`-ready rows. */
  readonly monthGroups = computed<MonthGroup[]>(() => {
    const map = new Map<string, WorkoutRow[]>();
    for (const l of this.items()) {
      const d = new Date(l.startedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const arr = map.get(key) ?? [];
      arr.push(this._toRow(l));
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, rows]) => ({
        label: new Date(rows[0].log.startedAt).toLocaleString('en', {
          month: 'long',
          year: 'numeric',
        }),
        count: rows.length,
        rows,
      }));
  });

  private readonly _feelingGlyphs = ['😣', '😕', '😐', '🙂', '💪'];

  constructor() {
    const initial = this._route.snapshot.queryParamMap.get('tab');
    if (initial === 'routines' || initial === 'exercises') {
      this.tab.set(initial);
    }
    // Initial history load. NOT an effect: `fetch()` reads `page()`, so an
    // effect would track it and re-fire on every `loadMore()` (resetting
    // page→1 and clobbering pagination). The list has no reactive inputs.
    this.fetch(true);
    // Lazy-load routines the first time the tab is opened (once only).
    effect(() => {
      if (this.tab() === 'routines' && !this._routinesRequested()) {
        this._routinesRequested.set(true);
        this._loadRoutines();
      }
    });
  }

  // ── Tabs ─────────────────────────────────────────────────────────

  /** p-tabs emits string | number; narrow back to the Tab union. */
  setTab(value: string | number | undefined): void {
    if (value === 'workouts' || value === 'routines' || value === 'exercises') {
      this.tab.set(value);
    }
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
    this._router.navigate(['/my/workout-log', log.id, 'replay']);
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
    // Shared, role-agnostic catalog route — /coaching/exercises is
    // instructor-gated and would bounce a client to /home.
    this._router.navigate(['/exercises']);
  }

  // ── Template helpers ─────────────────────────────────────────────

  feelingGlyph(log: WorkoutLog): string | null {
    if (log.feelingRating == null) return null;
    const idx = Math.max(1, Math.min(5, log.feelingRating)) - 1;
    return this._feelingGlyphs[idx];
  }

  // ── Internals ────────────────────────────────────────────────────

  private _toRow(log: WorkoutLog): WorkoutRow {
    const d = new Date(log.startedAt);
    const durationMin =
      log.durationSeconds != null ? Math.round(log.durationSeconds / 60) : null;
    const setsDone = (log.exercises ?? []).reduce(
      (n: number, e: LoggedExercise) =>
        n + (e.sets ?? []).filter((s: LoggedSet) => s.isCompleted).length,
      0,
    );
    const prCount = log.prCount ?? 0;
    return {
      log,
      dayNum: d.toLocaleDateString('en-GB', { day: 'numeric' }),
      weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      clockTime: formatSessionTime(log.startedAt),
      title: log.name,
      subtitle: log.assignment?.programNameSnapshot ?? 'Freestyle workout',
      durationLabel: durationMin != null ? `${durationMin} min` : null,
      setsLabel: `${setsDone} ${setsDone === 1 ? 'set' : 'sets'}`,
      feelingGlyph: this.feelingGlyph(log),
      prCount,
      prLabel: prCount === 0 ? '' : prCount === 1 ? 'PR' : `${prCount} PRs`,
      tone: prCount > 0 ? 'teal' : 'honey',
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
