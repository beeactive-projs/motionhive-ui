import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, forkJoin, take, tap } from 'rxjs';

import { GroupService, PublicGroupProfile, SelfJoinResult } from 'core';

import { JoinCta, joinCta } from '../groups.config';

/**
 * A group you are not in yet.
 *
 * It reads `GET /groups/:id/public`, not `GET /groups/:id` — the latter is
 * members-only and 403s, which is exactly what a Discover tap used to hit.
 *
 * Whether there is already a request pending is a second call, because the
 * public profile does not carry it. The two go out together so the Join
 * button never renders in the wrong state and then corrects itself.
 */
@Injectable()
export class GroupPreviewStore {
  private readonly _groupService = inject(GroupService);
  /** The page's, since the page provides this store. */
  private readonly _destroyRef = inject(DestroyRef);

  private _groupId = '';

  private readonly _profile = signal<PublicGroupProfile | null>(null);
  private readonly _hasPendingRequest = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  /** A group that is private or gone, as opposed to a failed request. */
  private readonly _notFound = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly notFound = this._notFound.asReadonly();
  readonly hasPendingRequest = this._hasPendingRequest.asReadonly();

  readonly showSkeleton = computed(() => this._loading() && !this._profile());
  readonly showError = computed(() => this._error() && !this._profile());

  /** Join / Request to join / Request pending / Invite only. */
  readonly cta = computed<JoinCta | null>(() => {
    const profile = this._profile();
    if (!profile) return null;
    return joinCta(profile.group.joinPolicy, this._hasPendingRequest());
  });

  init(groupId: string): void {
    if (groupId === this._groupId) return;
    this._groupId = groupId;
    this._profile.set(null);
    this._hasPendingRequest.set(false);
    this._error.set(false);
    this._notFound.set(false);
    this.load();
  }

  load(): void {
    if (!this._groupId || this._loading()) return;
    this._loading.set(true);
    this._error.set(false);
    this._notFound.set(false);

    // Silent: this page reports a failed load itself, inline and with a
    // retry. The global dialog on top of that is the same failure twice.
    forkJoin({
      profile: this._groupService.getPublicProfile(this._groupId),
      // A 404 here just means "no request", which is the common case — so it
      // must not fail the whole load.
      request: this._groupService
        .getMyJoinRequest(this._groupId)
        .pipe(take(1), catchToNull()),
    })
      .pipe(
        take(1),
        finalize(() => this._loading.set(false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: ({ profile, request }) => {
          this._profile.set(profile);
          this._hasPendingRequest.set(!!request?.request);
        },
        error: (error: unknown) => {
          const status = (error as { status?: number } | null)?.status;
          // 404 is "no such group"; 403 is a private one the API will not
          // describe. Both mean the same thing to a reader: nothing to see.
          if (status === 404 || status === 403) {
            this._notFound.set(true);
            return;
          }
          this._error.set(true);
        },
      });
  }

  /**
   * Join, or ask to. The server decides which happened — an OPEN group
   * returns JOINED, an APPROVAL one returns PENDING — so the caller reads
   * the result rather than predicting it from the policy.
   */
  join(): Observable<SelfJoinResult> {
    return this._groupService.selfJoin(this._groupId).pipe(
      take(1),
      tap((result) => {
        if (result.status === 'PENDING') this._hasPendingRequest.set(true);
      }),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  /** Withdraw a request that has not been decided yet. */
  cancelRequest(): Observable<unknown> {
    return this._groupService.cancelMyJoinRequest(this._groupId).pipe(
      take(1),
      tap(() => this._hasPendingRequest.set(false)),
      takeUntilDestroyed(this._destroyRef),
    );
  }

  retry(): void {
    this.load();
  }
}

/**
 * Swallows a failed side-request into `null`.
 *
 * "Do I have a request pending?" answering 404 is an answer, not an error —
 * and letting it reject would take the group's own profile down with it.
 */
function catchToNull<T>() {
  return (source: Observable<T>): Observable<T | null> =>
    new Observable<T | null>((subscriber) => {
      const sub = source.subscribe({
        next: (value) => subscriber.next(value),
        error: () => {
          subscriber.next(null);
          subscriber.complete();
        },
        complete: () => subscriber.complete(),
      });
      return () => sub.unsubscribe();
    });
}
