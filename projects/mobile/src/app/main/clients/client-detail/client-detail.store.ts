import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, finalize, of, take, tap } from 'rxjs';

import {
  AssignProgramPayload,
  ClientService,
  CoachLogKind,
  InstructorClient,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  RosterClient,
  RosterService,
  SessionInstance,
  SessionInstanceStatus,
  SessionService,
  WorkoutLog,
  WorkoutLogService,
  apiErrorMessage,
  dayRange,
  monthRange,
  startOfMonth,
} from 'core';

import { PagedList } from '../../../_shared/utils/paged-list';
import { calendarCells, monthDoneCount } from '../../workouts/workouts.config';
import { ROSTER_WINDOW } from '../roster-labels';

/** How far ahead the Upcoming sessions list looks; the calendar goes further. */
export const UPCOMING_DAYS = 90;

/**
 * How far back Past sessions looks — 89 rather than 90 days, the web's
 * window, because the server refuses a span a hair over its limit.
 */
export const PAST_DAYS = 89;
/** The Sessions lists, a page at a time; Show more reads the next. */
const SESSIONS_PAGE = 10;

/** Every plan this coach gave this client; a person has a handful, not pages. */
const PLAN_LIMIT = 50;
/** The Training list, a page at a time; Show more reads the next. */
const WORKOUTS_PAGE = 15;
/** A list read before the client is known. */
const NO_ROWS = { items: [], total: 0 };
/**
 * One request's worth of a calendar month. The API caps `limit` at 100,
 * which no one training once or twice a day reaches in a month.
 */
const MONTH_LIMIT = 100;

/** The Training tab's chips: everything, the coach's plans, their own, the skips. */
export const TrainingKinds = {
  All: 'all',
  Plan: 'plan',
  Own: 'own',
  Skipped: 'skipped',
} as const satisfies Record<string, CoachLogKind>;
export type TrainingKind = (typeof TrainingKinds)[keyof typeof TrainingKinds];

/** A plan still in play — waiting to start, under way, or paused. */
const CURRENT_PLAN_STATUSES: readonly ProgramAssignmentStatus[] = [
  ProgramAssignmentStatus.Pending,
  ProgramAssignmentStatus.Active,
  ProgramAssignmentStatus.Paused,
];

/**
 * Page-scoped state for one client.
 *
 * Five sources, none of which knows about the others: the relationship
 * (`getClient`) drives the screen; this client's roster row fills the
 * This week card and is simply absent when they have no assigned work;
 * this coach's assignments to this client feed Plans; the workouts they
 * logged that this coach may see, with the skipped days of this coach's
 * plans, feed Training (a paged list under the filter chips and a day, and
 * the calendar's month) and the Overview's last workout; the coach's own
 * calendar narrowed to this person feeds Sessions. All but the first
 * degrade to nothing on error — a missing or empty section, never an error
 * screen.
 *
 * Every verb keys on `clientId`, the person's user id, which is what the
 * client endpoints take. The relationship id is never sent anywhere.
 */
@Injectable()
export class ClientDetailStore {
  private readonly _clientService = inject(ClientService);
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _rosterService = inject(RosterService);
  private readonly _sessionService = inject(SessionService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _translateService = inject(TranslateService);

  private readonly _clientId = signal<string | null>(null);
  private readonly _client = signal<InstructorClient | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _roster = signal<RosterClient | null>(null);
  private readonly _sessionDay = signal<string | null>(null);
  private readonly _daySessions = signal<SessionInstance[]>([]);
  private readonly _sessionMonth = signal(startOfMonth(new Date()));
  private readonly _monthSessions = signal<SessionInstance[]>([]);
  private readonly _plans = signal<ProgramAssignment[]>([]);
  private readonly _plansLoaded = signal(false);
  private readonly _busyPlanId = signal<string | null>(null);
  private readonly _lastLog = signal<WorkoutLog | null>(null);
  private readonly _kind = signal<TrainingKind>(TrainingKinds.All);
  private readonly _day = signal<string | null>(null);
  private readonly _month = signal(startOfMonth(new Date()));
  private readonly _monthLogs = signal<WorkoutLog[]>([]);
  private readonly _monthLoading = signal(false);
  private readonly _monthError = signal(false);
  private readonly _saving = signal(false);

  /** What is booked ahead, soonest first. */
  private readonly _upcoming = new PagedList<SessionInstance>(SESSIONS_PAGE, (page, limit) => {
    const clientId = this._clientId();
    if (!clientId) return of(NO_ROWS);
    const from = new Date();
    const to = new Date(from.getTime() + UPCOMING_DAYS * 86_400_000);
    return this._sessionService.listInstances({
      clientId,
      dateFrom: from.toISOString(),
      dateTo: to.toISOString(),
      status: SessionInstanceStatus.Scheduled,
      page,
      limit,
    });
  });

  /** Their sessions with this coach in the last few months, most recent first. */
  private readonly _past = new PagedList<SessionInstance>(SESSIONS_PAGE, (page, limit) => {
    const clientId = this._clientId();
    if (!clientId) return of(NO_ROWS);
    const to = new Date();
    const from = new Date(to.getTime() - PAST_DAYS * 86_400_000);
    return this._sessionService.listInstances({
      clientId,
      dateFrom: from.toISOString(),
      dateTo: to.toISOString(),
      order: 'desc',
      page,
      limit,
    });
  });

  /** The Training list under the chip and, when one was tapped, a day. */
  private readonly _training = new PagedList<WorkoutLog>(WORKOUTS_PAGE, (page, limit) => {
    const clientId = this._clientId();
    if (!clientId) return of(NO_ROWS);
    const day = this._day();
    return this._workoutLogService.listForClient(clientId, {
      kind: this._kind(),
      page,
      limit,
      ...(day ? dayRange(day) : {}),
    });
  });

  readonly clientId = this._clientId.asReadonly();
  readonly client = this._client.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly roster = this._roster.asReadonly();
  /** Booked ahead, soonest first; its first is the Overview's next session. */
  readonly sessions = this._upcoming.items;
  /** What already happened, most recent first. */
  readonly pastSessions = this._past.items;
  readonly hasMoreSessions = this._upcoming.hasMore;
  readonly hasMorePast = this._past.hasMore;
  readonly upcomingLoading = this._upcoming.loading;
  readonly pastLoading = this._past.loading;
  /** The calendar day the Sessions list is narrowed to, as `yyyy-mm-dd`. */
  readonly sessionDay = this._sessionDay.asReadonly();
  readonly daySessions = this._daySessions.asReadonly();
  /** First of the month the Sessions calendar shows, and its sessions. */
  readonly sessionMonth = this._sessionMonth.asReadonly();
  readonly monthSessions = this._monthSessions.asReadonly();
  readonly plansLoaded = this._plansLoaded.asReadonly();
  /** The latest finished workout this coach may see, for the Overview. */
  readonly lastLog = this._lastLog.asReadonly();
  /**
   * The Training list, newest first: what they logged that this coach may
   * see (freestyle work stays theirs unless they share it; the API filters
   * it out) and the skipped days of this coach's plans, as rows with status
   * SKIPPED and nothing to open. Narrowed by the chip and, when one was
   * tapped on the calendar, a day.
   */
  readonly workouts = this._training.items;
  readonly workoutsLoading = this._training.loading;
  readonly workoutsLoaded = this._training.loaded;
  readonly hasMoreWorkouts = this._training.hasMore;
  readonly kind = this._kind.asReadonly();
  /** The calendar day the list is narrowed to, as `yyyy-mm-dd`; null for every day. */
  readonly day = this._day.asReadonly();
  /** First of the month the calendar shows. */
  readonly month = this._month.asReadonly();
  readonly monthLogs = this._monthLogs.asReadonly();
  readonly monthError = this._monthError.asReadonly();
  /** Skeleton only on a month with nothing to show yet, not on a refresh. */
  readonly monthSkeleton = computed(() => this._monthLoading() && !this._monthLogs().length);
  readonly calendarCells = computed(() =>
    calendarCells(this._month(), this._monthLogs(), new Date()),
  );
  readonly monthDoneCount = computed(() => monthDoneCount(this._monthLogs(), this._month()));
  readonly saving = this._saving.asReadonly();

  /** In play now, the one under way first. */
  readonly currentPlans = computed(() =>
    this._plans()
      .filter((plan) => CURRENT_PLAN_STATUSES.includes(plan.status))
      .sort((a, b) => planOrder(a) - planOrder(b)),
  );

  /** Finished or ended, newest first: a record, not something to act on. */
  readonly pastPlans = computed(() =>
    this._plans()
      .filter((plan) => !CURRENT_PLAN_STATUSES.includes(plan.status))
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
  );

  isPlanBusy(id: string): boolean {
    return this._busyPlanId() === id;
  }

  /**
   * This week's numbers, or null when nothing was due — a client with no
   * assigned work has no week to report, and a card saying "0 of 0" would be
   * a status invented from silence.
   */
  readonly week = computed(() => {
    const roster = this._roster();
    if (!roster || roster.due === 0) return null;
    return {
      due: roster.due,
      completed: roster.completed,
      skipped: roster.skipped,
      remaining: Math.max(0, roster.due - roster.completed - roster.skipped),
      percent: roster.adherencePercent,
      flagged: roster.attention !== null,
    };
  });


  load(clientId: string): void {
    this._clientId.set(clientId);
    this._client.set(null);
    this._roster.set(null);
    this._upcoming.clear();
    this._past.clear();
    this._sessionDay.set(null);
    this._daySessions.set([]);
    this._sessionMonth.set(startOfMonth(new Date()));
    this._monthSessions.set([]);
    this._plans.set([]);
    this._plansLoaded.set(false);
    this._lastLog.set(null);
    this._kind.set(TrainingKinds.All);
    this._day.set(null);
    this._training.clear();
    this._month.set(startOfMonth(new Date()));
    this._monthLogs.set([]);
    this._error.set(null);
    this._fetchClient(false);
    this._fetchRoster();
    this._fetchPlans();
    this._fetchLastLog();
    this._training.reset();
    this._fetchMonth();
    this._upcoming.reset();
    this._past.reset();
    this._fetchSessionMonth();
  }

  /** Silent refresh keeps the current screen when the network lets us down. */
  reload(opts: { silent?: boolean } = {}): void {
    this._fetchClient(!!opts.silent);
    this._fetchRoster();
    this._fetchPlans();
    this._fetchLastLog();
    this._training.refresh();
    this._fetchMonth();
    this._upcoming.refresh();
    this._past.refresh();
    this._fetchSessionMonth();
    if (this._sessionDay()) this._fetchSessionDay();
  }

  /** The next page of booked sessions, or of past ones. */
  loadMoreSessions(past: boolean): void {
    (past ? this._past : this._upcoming).more();
  }

  /** Narrow the Sessions list to a calendar day, or null for the lists again. */
  setSessionDay(key: string | null): void {
    if (key === this._sessionDay()) return;
    this._sessionDay.set(key);
    this._daySessions.set([]);
    if (key) this._fetchSessionDay();
  }

  setSessionMonth(month: Date): void {
    this._sessionMonth.set(startOfMonth(month));
    this._monthSessions.set([]);
    this._fetchSessionMonth();
  }

  /** One chip at a time; the list starts again from the newest. */
  setKind(kind: TrainingKind): void {
    if (kind === this._kind()) return;
    this._kind.set(kind);
    this._training.reset();
  }

  /** Narrow the list to a calendar day, or null for every day again. */
  setDay(key: string | null): void {
    if (key === this._day()) return;
    this._day.set(key);
    this._training.reset();
  }

  loadMoreWorkouts(): void {
    this._training.more();
  }

  setMonth(month: Date): void {
    this._month.set(startOfMonth(month));
    this._monthLogs.set([]);
    this._fetchMonth();
  }

  refreshMonth(): void {
    this._fetchMonth();
  }

  /**
   * Give this client a plan. The new row is read back rather than built
   * here: the response lacks the program's display fields the row needs,
   * and the roster's numbers move with it.
   */
  assignPlan(payload: AssignProgramPayload): Observable<ProgramAssignment> {
    return this._assignmentService.assign(payload).pipe(
      take(1),
      tap(() => {
        this._fetchPlans();
        this._fetchRoster();
      }),
    );
  }

  /** Pause or resume one plan — one at a time, the same as the program's list. */
  setPlanStatus(
    plan: ProgramAssignment,
    status: ProgramAssignmentStatus,
  ): Observable<ProgramAssignment> | null {
    if (this._busyPlanId()) return null;
    this._busyPlanId.set(plan.id);
    return this._assignmentService.update(plan.id, { status }).pipe(
      take(1),
      tap((updated) => {
        this._plans.update((plans) =>
          plans.map((row) => (row.id === plan.id ? { ...row, ...updated, client: row.client } : row)),
        );
        this._fetchRoster();
      }),
      finalize(() => this._busyPlanId.set(null)),
    );
  }

  updateNotes(notes: string): Observable<InstructorClient> {
    return this._verb((clientId) => this._clientService.updateClient(clientId, { notes }));
  }

  archive(): Observable<InstructorClient> {
    return this._verb((clientId) => this._clientService.archiveClient(clientId));
  }

  unarchive(): Observable<InstructorClient> {
    return this._verb((clientId) => this._clientService.unarchiveClient(clientId));
  }

  private _verb(
    request: (clientId: string) => Observable<InstructorClient>,
  ): Observable<InstructorClient> {
    const clientId = this._clientId();
    if (!clientId) throw new Error('No client loaded');
    this._saving.set(true);
    return request(clientId).pipe(
      take(1),
      // Only what the verb changed — the response may omit the nested user.
      tap((updated) =>
        this._client.update((current) =>
          current
            ? {
                ...current,
                status: updated.status,
                notes: updated.notes,
                startedAt: updated.startedAt,
              }
            : updated,
        ),
      ),
      finalize(() => this._saving.set(false)),
    );
  }

  private _fetchClient(silent: boolean): void {
    const clientId = this._clientId();
    if (!clientId || this._loading()) return;
    this._loading.set(true);
    if (!silent) this._error.set(null);

    this._clientService
      .getClient(clientId)
      .pipe(take(1))
      .subscribe({
        next: (client) => {
          this._client.set(client);
          this._error.set(null);
          this._loading.set(false);
        },
        error: (error: unknown) => {
          if (!silent || !this._client()) {
            this._error.set(
              apiErrorMessage(
                error,
                this._translateService.instant('clients.detail.loadError.message'),
              ),
            );
          }
          this._loading.set(false);
        },
      });
  }

  private _fetchRoster(): void {
    const clientId = this._clientId();
    if (!clientId) return;

    this._rosterService
      .roster(ROSTER_WINDOW, { clientId })
      .pipe(take(1))
      .subscribe({
        next: (summary) => {
          // The id may have moved on while this was in flight.
          if (this._clientId() !== clientId) return;
          this._roster.set(summary.clients.find((row) => row.clientId === clientId) ?? null);
        },
        error: () => this._roster.set(null),
      });
  }

  private _fetchPlans(): void {
    const clientId = this._clientId();
    if (!clientId) return;

    this._assignmentService
      .listForInstructor({ clientId, limit: PLAN_LIMIT })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          if (this._clientId() !== clientId) return;
          this._plans.set(page.items);
          this._plansLoaded.set(true);
        },
        // Keep what is on screen; a failed refresh is not news about the plans.
        error: () => this._plansLoaded.set(true),
      });
  }

  /** The Overview's last workout: finished ones only, so never a skip. */
  private _fetchLastLog(): void {
    const clientId = this._clientId();
    if (!clientId) return;
    this._workoutLogService
      .listForClient(clientId, { limit: 1 })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          if (this._clientId() !== clientId) return;
          this._lastLog.set(page.items[0] ?? null);
        },
        // Keep what is on screen; a failed refresh is not news about the training.
        error: () => undefined,
      });
  }

  /** The calendar's month: every day of it, the skips included. */
  private _fetchMonth(): void {
    const clientId = this._clientId();
    if (!clientId) return;
    const month = this._month();
    this._monthLoading.set(true);
    this._monthError.set(false);
    this._workoutLogService
      .listForClient(clientId, {
        kind: TrainingKinds.All,
        limit: MONTH_LIMIT,
        ...monthRange(month),
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          if (this._clientId() !== clientId || this._month() !== month) return;
          this._monthLogs.set(result.items);
          this._monthLoading.set(false);
        },
        error: () => {
          if (this._month() !== month) return;
          this._monthError.set(true);
          this._monthLoading.set(false);
        },
      });
  }

  /** Every session on the day tapped on the calendar, in the order they run. */
  private _fetchSessionDay(): void {
    const clientId = this._clientId();
    const day = this._sessionDay();
    if (!clientId || !day) return;
    this._sessionService
      .listInstances({ clientId, ...dayRange(day), limit: 50 })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          if (this._clientId() !== clientId || this._sessionDay() !== day) return;
          this._daySessions.set(result.items);
        },
        error: () => this._daySessions.set([]),
      });
  }

  /** The Sessions calendar's month: every session in it, past and ahead. */
  private _fetchSessionMonth(): void {
    const clientId = this._clientId();
    if (!clientId) return;
    const month = this._sessionMonth();
    this._sessionService
      .listInstances({ clientId, ...monthRange(month), limit: MONTH_LIMIT })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          if (this._clientId() !== clientId || this._sessionMonth() !== month) return;
          this._monthSessions.set(result.items);
        },
        error: () => undefined,
      });
  }
}

/** Under way first, then waiting to start, then paused. */
function planOrder(plan: ProgramAssignment): number {
  switch (plan.status) {
    case ProgramAssignmentStatus.Active:
      return 0;
    case ProgramAssignmentStatus.Pending:
      return 1;
    default:
      return 2;
  }
}
