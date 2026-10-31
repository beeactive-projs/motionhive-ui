import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, Observable, of, take } from 'rxjs';

import {
  ClientService,
  CoachActivityItem,
  ProfileService,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  ProgramLibrary,
  ProgramService,
  RosterService,
  RosterSummary,
  SessionInstance,
  SessionInstanceStatus,
  SessionService,
  localDayKey,
} from 'core';

import { needItems, plansEndingSoon } from '../home.config';

const AGENDA_LIMIT = 10;
/**
 * The feed's own cap: Latest shows every workout of the last 24 hours (up
 * to ten), so Home reads the whole window the API serves.
 */
const ACTIVITY_LIMIT = 20;
/** Active plans read to find the ones ending soon: the API's page cap. */
const ASSIGNMENT_LIMIT = 100;

/**
 * Data behind the coach Home and its Needs you page: the hive, what needs
 * the coach, the latest workouts and today.
 *
 * Every block reads something the app already serves. The hive and Needs
 * you are the roster (`/coach/roster`, last 7 days); Latest is
 * `/coach/activity`; plans ending come from the coach's active
 * assignments; requests from the pending count; today from the session
 * instances. Each loads on its own and a failure empties only its block.
 * Money is not here: it is the Menu's Payments row.
 */
@Injectable()
export class CoachHomeStore {
  private readonly _rosterService = inject(RosterService);
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _sessionService = inject(SessionService);
  private readonly _clientService = inject(ClientService);
  private readonly _programService = inject(ProgramService);
  private readonly _profileService = inject(ProfileService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _roster = signal<RosterSummary | null>(null);
  private readonly _rosterFailed = signal(false);
  private readonly _assignments = signal<ProgramAssignment[]>([]);
  private readonly _agenda = signal<SessionInstance[]>([]);
  private readonly _activity = signal<CoachActivityItem[]>([]);
  private readonly _pendingRequests = signal(0);
  private readonly _hasPrograms = signal<boolean | null>(null);
  private readonly _hasSpecialties = signal<boolean | null>(null);
  private readonly _todayKey = signal(localDayKey(new Date()));

  readonly roster = this._roster.asReadonly();
  readonly agenda = this._agenda.asReadonly();
  readonly activity = this._activity.asReadonly();
  readonly hasPrograms = this._hasPrograms.asReadonly();
  readonly hasSpecialties = this._hasSpecialties.asReadonly();

  readonly rosterLoading = signal(true);

  readonly clients = computed(() => this._roster()?.clients ?? []);

  /** No active clients yet: the Home becomes the coach's first steps. */
  readonly isFirstWeek = computed(() => this._roster()?.clients.length === 0);

  /** Only when there is nothing older on screen to keep showing. */
  readonly showRosterError = computed(() => this._rosterFailed() && !this._roster());

  /** Everything that needs the coach, most pressing first (`needItems`). */
  readonly needs = computed(() =>
    needItems(
      this.clients(),
      this._pendingRequests(),
      plansEndingSoon(this._assignments(), this._todayKey()),
    ),
  );

  /** Home: every block. `done` runs once all of them have answered. */
  load(done?: () => void): void {
    this._todayKey.set(localDayKey(new Date()));
    const settle = countdown(5, done);
    this._loadRoster(settle);
    this._loadActivity(settle);
    this._loadAssignments(settle);
    this._loadAgenda(settle);
    this._loadPendingRequests(settle);
  }

  /** The Needs you page: only what decides who needs the coach. */
  loadNeeds(done?: () => void): void {
    this._todayKey.set(localDayKey(new Date()));
    const settle = countdown(3, done);
    this._loadRoster(settle);
    this._loadAssignments(settle);
    this._loadPendingRequests(settle);
  }

  private _loadRoster(settle: () => void): void {
    this.rosterLoading.set(true);
    // Silent: the card says it failed and offers a retry, which beats a
    // dialog over the whole Home.
    this._read(this._rosterService.roster('1w', { silent: true }), settle).subscribe((roster) => {
      if (roster) this._roster.set(roster);
      this._rosterFailed.set(roster === null);
      this.rosterLoading.set(false);
      if (roster?.clients.length === 0) this._loadFirstSteps();
    });
  }

  /** Silent: an empty feed is a fine thing for Home to show on a failure. */
  private _loadActivity(settle: () => void): void {
    this._read(this._rosterService.activity(ACTIVITY_LIMIT, { silent: true }), settle).subscribe(
      (items) => {
        if (items) this._activity.set(items);
      },
    );
  }

  private _loadAssignments(settle: () => void): void {
    this._read(
      this._programAssignmentService.listForInstructor({
        status: ProgramAssignmentStatus.Active,
        limit: ASSIGNMENT_LIMIT,
      }),
      settle,
    ).subscribe((page) => this._assignments.set(page?.items ?? []));
  }

  private _loadAgenda(settle: () => void): void {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    this._read(
      this._sessionService.listInstances({
        dateFrom: startOfDay.toISOString(),
        dateTo: endOfDay.toISOString(),
        status: SessionInstanceStatus.Scheduled,
        limit: AGENDA_LIMIT,
      }),
      settle,
    ).subscribe((response) => this._agenda.set(response?.items ?? []));
  }

  private _loadPendingRequests(settle: () => void): void {
    // `incoming` only: an invitation the coach sent waits on someone else.
    this._read(this._clientService.getPendingRequestsCount(), settle).subscribe((response) =>
      this._pendingRequests.set(response?.incoming ?? 0),
    );
  }

  /**
   * Read only for a coach with no clients: whether there is a program to
   * assign once one joins, and whether Discover has specialties to show.
   */
  private _loadFirstSteps(): void {
    this._read(this._programService.list({ library: ProgramLibrary.Mine, limit: 1 })).subscribe(
      (page) => this._hasPrograms.set(page ? page.total > 0 : null),
    );

    this._read(this._profileService.getMyProfile()).subscribe((profile) =>
      this._hasSpecialties.set(
        profile ? (profile.instructorProfile?.specializations?.length ?? 0) > 0 : null,
      ),
    );
  }

  /** One answer or null on a failure; `settle` runs either way. */
  private _read<T>(source: Observable<T>, settle?: () => void): Observable<T | null> {
    return source.pipe(
      take(1),
      catchError(() => of(null)),
      finalize(() => settle?.()),
      takeUntilDestroyed(this._destroyRef),
    );
  }
}

/** A callback that runs `done` on its `count`th call: "all of them answered". */
function countdown(count: number, done?: () => void): () => void {
  let left = count;
  return () => {
    left -= 1;
    if (left === 0) done?.();
  };
}
