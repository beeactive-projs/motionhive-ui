import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, finalize, take, tap } from 'rxjs';

import {
  AssignProgramPayload,
  ClientService,
  InstructorClient,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  RosterClient,
  RosterService,
  SessionInstance,
  SessionInstanceStatus,
  SessionService,
  apiErrorMessage,
} from 'core';

import { ROSTER_WINDOW } from '../roster-labels';

/** How far ahead the Upcoming sessions section looks. */
export const UPCOMING_DAYS = 30;
const UPCOMING_LIMIT = 5;

/**
 * How far back Past sessions looks — 89 rather than 90 days, the web's
 * window, because the server refuses a span a hair over its limit.
 */
export const PAST_DAYS = 89;
const PAST_SHOWN = 5;
/** The list endpoint sorts oldest first; fetch the window, show the newest. */
const PAST_FETCH = 50;

/** Every plan this coach gave this client; a person has a handful, not pages. */
const PLAN_LIMIT = 50;

/** A plan still in play — waiting to start, under way, or paused. */
const CURRENT_PLAN_STATUSES: readonly ProgramAssignmentStatus[] = [
  ProgramAssignmentStatus.Pending,
  ProgramAssignmentStatus.Active,
  ProgramAssignmentStatus.Paused,
];

/**
 * Page-scoped state for one client.
 *
 * Four sources, none of which knows about the others: the relationship
 * (`getClient`) drives the screen; the roster row, found by user id in the
 * coach's `/coach/roster`, fills the This week card and is simply absent
 * when the client has no assigned work; this coach's assignments to this
 * client feed Plans; the coach's own calendar narrowed to this person feeds
 * Sessions. The last three degrade to nothing on error — a missing or empty
 * section, never an error screen.
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
  private readonly _translateService = inject(TranslateService);

  private readonly _clientId = signal<string | null>(null);
  private readonly _client = signal<InstructorClient | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _roster = signal<RosterClient | null>(null);
  private readonly _sessions = signal<SessionInstance[]>([]);
  private readonly _pastSessions = signal<SessionInstance[]>([]);
  private readonly _plans = signal<ProgramAssignment[]>([]);
  private readonly _plansLoaded = signal(false);
  private readonly _busyPlanId = signal<string | null>(null);
  private readonly _saving = signal(false);

  readonly clientId = this._clientId.asReadonly();
  readonly client = this._client.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly roster = this._roster.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly pastSessions = this._pastSessions.asReadonly();
  readonly plansLoaded = this._plansLoaded.asReadonly();
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
    this._sessions.set([]);
    this._pastSessions.set([]);
    this._plans.set([]);
    this._plansLoaded.set(false);
    this._error.set(null);
    this._fetchClient(false);
    this._fetchRoster();
    this._fetchPlans();
    this._fetchSessions();
    this._fetchPastSessions();
  }

  /** Silent refresh keeps the current screen when the network lets us down. */
  reload(opts: { silent?: boolean } = {}): void {
    this._fetchClient(!!opts.silent);
    this._fetchRoster();
    this._fetchPlans();
    this._fetchSessions();
    this._fetchPastSessions();
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
      .roster(ROSTER_WINDOW)
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

  /**
   * The last few sessions with this person. The list comes back oldest
   * first with no way to ask otherwise, so the window is fetched whole and
   * the newest kept — the same read the web's Past tab does.
   */
  private _fetchPastSessions(): void {
    const clientId = this._clientId();
    if (!clientId) return;

    const to = new Date();
    const from = new Date(to.getTime() - PAST_DAYS * 86_400_000);

    this._sessionService
      .listInstances({
        clientId,
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
        limit: PAST_FETCH,
      })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          if (this._clientId() !== clientId) return;
          this._pastSessions.set(
            [...page.items].sort((a, b) => b.startAt.localeCompare(a.startAt)).slice(0, PAST_SHOWN),
          );
        },
        error: () => this._pastSessions.set([]),
      });
  }

  private _fetchSessions(): void {
    const clientId = this._clientId();
    if (!clientId) return;

    const from = new Date();
    const to = new Date(from.getTime() + UPCOMING_DAYS * 86_400_000);

    this._sessionService
      .listInstances({
        clientId,
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
        status: SessionInstanceStatus.Scheduled,
        limit: UPCOMING_LIMIT,
      })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          if (this._clientId() !== clientId) return;
          this._sessions.set(page.items);
        },
        error: () => this._sessions.set([]),
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
