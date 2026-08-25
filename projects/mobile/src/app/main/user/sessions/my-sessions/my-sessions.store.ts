import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, take } from 'rxjs';

import {
  ClientService,
  MyCounts,
  MyTab,
  SessionParticipant,
  SessionParticipantStatus,
  SessionService,
  sessionLifecycle,
} from 'core';

/** The three tabs the BE splits a trainee's active bookings across. */
const ACTIVE_TAB_LIMIT = 100;
/** How many recent past rows to inspect for a session that is on right now. */
const LIVE_LIFT_LIMIT = 10;
const PAST_PAGE_SIZE = 25;

/**
 * Page-scoped state for the trainee's sessions list.
 *
 * The design's Upcoming segment folds three backend tabs into one list —
 * upcoming + pendingApproval + waitlisted — and all three are `startAt >= now`
 * server-side. That filter has a hole worth naming: a session that has
 * STARTED (exactly the live row the design gives a Join pill) falls out of
 * `upcoming` into `past`. So the upcoming load also reads the first page of
 * `past` (DESC — the freshest starts come first) and lifts the confirmed rows
 * whose occurrence has not yet ended.
 *
 * The lift is stored un-filtered; the page re-filters against the pulled
 * clock, so a lifted row decays into the Past segment on a clock bump rather
 * than needing a refetch.
 */
@Injectable()
export class MySessionsStore {
  private readonly _sessionService = inject(SessionService);
  private readonly _clientService = inject(ClientService);

  readonly segment = signal<'upcoming' | 'past'>('upcoming');

  private readonly _upcoming = signal<SessionParticipant[]>([]);
  private readonly _upcomingLoaded = signal(false);
  private readonly _upcomingLoading = signal(false);
  private readonly _upcomingError = signal(false);
  private readonly _upcomingTruncated = signal(false);

  private readonly _past = signal<SessionParticipant[]>([]);
  private readonly _pastLoaded = signal(false);
  private readonly _pastLoading = signal(false);
  private readonly _pastError = signal(false);
  private readonly _pastPage = signal(1);
  private readonly _pastTotal = signal(0);

  private readonly _counts = signal<MyCounts | null>(null);

  /** Null until the coach lookup answers — the empty state's copy variant. */
  private readonly _hasCoach = signal<boolean | null>(null);

  readonly upcoming = this._upcoming.asReadonly();
  readonly upcomingLoading = this._upcomingLoading.asReadonly();
  readonly upcomingError = this._upcomingError.asReadonly();
  readonly upcomingTruncated = this._upcomingTruncated.asReadonly();

  readonly past = this._past.asReadonly();
  readonly pastLoading = this._pastLoading.asReadonly();
  readonly pastError = this._pastError.asReadonly();
  readonly hasMorePast = computed(() => this._past().length < this._pastTotal());

  readonly counts = this._counts.asReadonly();
  readonly hasCoach = this._hasCoach.asReadonly();

  /** "Upcoming · N" = every booking that holds or wants a seat. */
  readonly upcomingCount = computed(() => {
    const counts = this._counts();
    if (!counts) return null;
    return counts.upcoming + counts.pendingApproval + counts.waitlisted;
  });

  readonly cancelledCount = computed(() => this._counts()?.cancelled ?? 0);

  /**
   * Reload whatever the open segment shows, plus the counts the header and
   * the ghost row read. `done` fires when the segment's own load settles —
   * the refresher spinner should not wait on the counts call.
   */
  refresh(done?: () => void): void {
    this.loadCounts();
    if (this.segment() === 'past') this.loadPast({ force: true, done });
    else this.loadUpcoming({ force: true, done });
  }

  loadUpcoming(opts: { force?: boolean; done?: () => void } = {}): void {
    if (this._upcomingLoading() || (this._upcomingLoaded() && !opts.force)) {
      opts.done?.();
      return;
    }
    this._upcomingLoading.set(true);
    this._upcomingError.set(false);

    forkJoin({
      upcoming: this._sessionService.listMy({
        tab: MyTab.Upcoming,
        limit: ACTIVE_TAB_LIMIT,
      }),
      pending: this._sessionService.listMy({
        tab: MyTab.PendingApproval,
        limit: ACTIVE_TAB_LIMIT,
      }),
      waitlisted: this._sessionService.listMy({
        tab: MyTab.Waitlisted,
        limit: ACTIVE_TAB_LIMIT,
      }),
      startedRecently: this._sessionService.listMy({
        tab: MyTab.Past,
        page: 1,
        limit: LIVE_LIFT_LIMIT,
      }),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ upcoming, pending, waitlisted, startedRecently }) => {
          const now = Date.now();
          const lifted = startedRecently.items.filter(
            (p) =>
              p.status === SessionParticipantStatus.Confirmed &&
              sessionLifecycle(p.instance?.startAt, p.instance?.endAt, now) !== 'past',
          );

          const merged = [
            ...upcoming.items,
            ...pending.items,
            ...waitlisted.items,
            ...lifted,
          ].sort(
            (a, b) =>
              new Date(a.instance?.startAt ?? 0).getTime() -
              new Date(b.instance?.startAt ?? 0).getTime(),
          );

          this._upcoming.set(merged);
          this._upcomingTruncated.set(
            [upcoming, pending, waitlisted].some(
              (page) => page.total > page.items.length,
            ),
          );
          this._upcomingLoaded.set(true);
          this._upcomingLoading.set(false);
          opts.done?.();

          if (merged.length === 0) this._loadCoachPresence();
        },
        error: () => {
          this._upcomingError.set(true);
          this._upcomingLoading.set(false);
          opts.done?.();
        },
      });
  }

  loadPast(opts: { force?: boolean; done?: () => void } = {}): void {
    if (this._pastLoading() || (this._pastLoaded() && !opts.force)) {
      opts.done?.();
      return;
    }
    this._pastLoading.set(true);
    this._pastError.set(false);

    this._sessionService
      .listMy({ tab: MyTab.Past, page: 1, limit: PAST_PAGE_SIZE })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this._past.set(page.items);
          this._pastTotal.set(page.total);
          this._pastPage.set(1);
          this._pastLoaded.set(true);
          this._pastLoading.set(false);
          opts.done?.();
        },
        error: () => {
          this._pastError.set(true);
          this._pastLoading.set(false);
          opts.done?.();
        },
      });
  }

  /** Infinite scroll — appends the next page, oldest last (the BE is DESC). */
  loadMorePast(done?: () => void): void {
    if (this._pastLoading() || !this.hasMorePast()) {
      done?.();
      return;
    }
    const next = this._pastPage() + 1;
    this._pastLoading.set(true);

    this._sessionService
      .listMy({ tab: MyTab.Past, page: next, limit: PAST_PAGE_SIZE })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          this._past.update((items) => [...items, ...page.items]);
          this._pastTotal.set(page.total);
          this._pastPage.set(next);
          this._pastLoading.set(false);
          done?.();
        },
        error: () => {
          // Leave what we have; the next scroll retries the same page.
          this._pastLoading.set(false);
          done?.();
        },
      });
  }

  /** Counts feed labels, not layout — a failure just hides the numbers. */
  loadCounts(): void {
    this._sessionService
      .myCounts()
      .pipe(take(1))
      .subscribe({
        next: (counts) => this._counts.set(counts),
        error: () => this._counts.set(null),
      });
  }

  /**
   * Only asked once the list turned out empty — the answer picks between
   * "Nothing booked yet" and "Find a coach on Discover". An error leaves it
   * null, which the empty state reads as the default copy.
   */
  private _loadCoachPresence(): void {
    if (this._hasCoach() !== null) return;
    this._clientService
      .getMyInstructors()
      .pipe(take(1))
      .subscribe({
        next: (instructors) => this._hasCoach.set(instructors.length > 0),
        error: () => this._hasCoach.set(null),
      });
  }
}
