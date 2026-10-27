import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, take, tap } from 'rxjs';

import { ClientRequest, ClientService, MyInstructor } from 'core';

import { ClockService } from '../../_shared/services/clock.service';
import { MoreBadgesService } from '../../_shared/services/more-badges.service';
import { incomingInvites, myCoachRows } from './coaches.config';

/**
 * How long an unforced re-entry leaves what is on screen alone. Same window
 * as the Clients tab's: long enough to cover stepping into a profile and
 * straight back out, short enough that nothing here is visibly behind.
 */
const FRESH_MS = 15_000;

type LoadOptions = { force?: boolean; done?: (error?: unknown) => void };

/**
 * Page-scoped state for the trainee's coaches screen: the settled
 * relationships from `GET /clients/my-instructors` and the invitations
 * waiting on an answer from `GET /clients/requests/pending`.
 *
 * The two load together (`forkJoin`) because the screen is one list in two
 * parts: accepting an invitation moves a row from the first section to the
 * second, and a half-loaded screen would show it in neither or in both.
 */
@Injectable()
export class CoachesStore {
  private readonly _clientService = inject(ClientService);
  private readonly _moreBadgesService = inject(MoreBadgesService);
  private readonly _clockService = inject(ClockService);
  /**
   * The page's, since the store is provided by it. `take(1)` caps how many
   * values arrive but does not stop a slow response landing after the view is
   * gone, writing to signals nobody reads and toasting over another screen.
   */
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _instructors = signal<MyInstructor[]>([]);
  private readonly _requests = signal<ClientRequest[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private readonly _loaded = signal(false);

  /**
   * A refresh can start while an older load is still in flight. Responses
   * carry the sequence they were asked under and anything stale is dropped,
   * so a slow first load cannot land on top of a newer one.
   */
  private _seq = 0;
  private _fetchedAt = 0;

  /**
   * The day labels ("Invited you yesterday") are read against a clock the
   * page bumps on entry, so a screen left open overnight does not keep
   * calling this morning's invitation yesterday's.
   */
  readonly invites = computed(() => incomingInvites(this._requests(), this._clockService.now()));

  readonly coaches = computed(() => myCoachRows(this._instructors()));

  readonly showSkeleton = computed(() => this._loading() && !this._loaded());

  readonly showLoadError = computed(() => this._error() && !this._loaded());

  /** Nothing at all: no coach and no invitation waiting. */
  readonly isEmpty = computed(
    () => this._loaded() && this.coaches().length === 0 && this.invites().length === 0,
  );

  /**
   * The last load failed, but there are rows from an earlier one still under
   * it. Keeping them is right; letting them pass for current is not, and the
   * loads are silent, so this bar is the only thing that says so.
   */
  readonly isStale = computed(() => this._error() && this._loaded());

  /** First load, or a forced one. Already-loaded entries go through `reenter`. */
  load(opts: LoadOptions = {}): void {
    if (!opts.force && (this._loading() || this._loaded())) {
      opts.done?.();
      return;
    }
    this._fetch(opts.done);
  }

  refresh(done?: (error?: unknown) => void): void {
    this.load({ force: true, done });
  }

  /**
   * Entering the page. Ionic keeps it alive in the tab stack, so an
   * invitation answered elsewhere still has to be picked up — but stepping
   * into a coach's profile and back should not re-fire both calls for data
   * seconds old.
   */
  reenter(): void {
    if (this._fetchedAt > 0 && Date.now() - this._fetchedAt < FRESH_MS) return;
    this.refresh();
  }

  // ── Mutations ────────────────────────────────────────────────────────────
  // Each takes the id its endpoint keys on: the request verbs the request id,
  // leaving the coach's user id. The rows are patched the moment a call lands,
  // so the list never waits on a round trip to look right.

  /**
   * Say yes to a coach's invitation. The request becomes a relationship only
   * the API can hand back, so both lists reload rather than being patched.
   */
  accept(requestId: string): Observable<unknown> {
    return this._clientService.acceptRequest(requestId).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap(() => {
        this._dropRequest(requestId);
        this.refresh();
      }),
    );
  }

  /** Turn down an invitation. The row goes; the coach can invite again. */
  decline(requestId: string): Observable<unknown> {
    return this._clientService.declineRequest(requestId).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap(() => this._dropRequest(requestId)),
    );
  }

  /** End a coaching relationship. Keyed on the coach's user id. */
  leave(instructorId: string): Observable<unknown> {
    return this._clientService.leaveInstructor(instructorId).pipe(
      take(1),
      takeUntilDestroyed(this._destroyRef),
      tap(() =>
        this._instructors.update((rows) =>
          rows.filter((row) => row.instructorId !== instructorId),
        ),
      ),
    );
  }

  /**
   * A request that no longer exists. The Menu's dot counts the ones waiting
   * on this reader, so it is forced rather than left to its freshness window.
   */
  private _dropRequest(requestId: string): void {
    this._requests.update((rows) => rows.filter((row) => row.id !== requestId));
    this._moreBadgesService.refreshPendingRequests(true);
  }

  private _fetch(done?: (error?: unknown) => void): void {
    const seq = ++this._seq;
    this._loading.set(true);
    this._error.set(false);

    // Silent: this page reports a failed load itself, inline and with a
    // retry, and it reloads on every entry — a modal on each failed entry
    // would be the same failure told twice, over whatever else loaded.
    forkJoin({
      instructors: this._clientService.getMyInstructors({ silent: true }).pipe(take(1)),
      requests: this._clientService.getPendingRequests({ silent: true }).pipe(take(1)),
    })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ instructors, requests }) => {
          if (seq !== this._seq) {
            done?.();
            return;
          }
          this._instructors.set(instructors ?? []);
          this._requests.set(requests ?? []);
          this._fetchedAt = Date.now();
          this._loaded.set(true);
          this._loading.set(false);
          done?.();
        },
        error: (error: unknown) => {
          if (seq !== this._seq) {
            done?.();
            return;
          }
          this._error.set(true);
          this._loading.set(false);
          done?.(error);
        },
      });
  }
}
