import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, Observable, of, take } from 'rxjs';

import { NavMode, NavModes, PostService, ProgressService, RosterService } from 'core';

import { coachLatest, LatestEntry, traineeLatest } from '../home.config';

/** The coach feed's cap, and its window (two weeks) is the page's. */
const ACTIVITY_LIMIT = 20;
/** Two weeks of a few groups' posts; the API caps a page at 100. */
const FEED_LIMIT = 50;

/**
 * Data behind the Latest page: the last two weeks, for whichever side the
 * reader is on. A coach reads their clients' finished workouts
 * (`/coach/activity`); a trainee their groups' posts (`/posts/feed`) and
 * their own records (Progress), merged by time.
 */
@Injectable()
export class LatestStore {
  private readonly _rosterService = inject(RosterService);
  private readonly _postService = inject(PostService);
  private readonly _progressService = inject(ProgressService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _entries = signal<LatestEntry[]>([]);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);

  readonly entries = this._entries.asReadonly();
  /** A first answer has come back, with items or without. */
  readonly loaded = this._loaded.asReadonly();
  /** The read failed and there is nothing older to keep showing. */
  readonly failed = this._failed.asReadonly();

  load(mode: NavMode, done?: () => void): void {
    const now = new Date();
    const read: Observable<LatestEntry[] | null> =
      mode === NavModes.Coach
        ? this._rosterService
            .activity(ACTIVITY_LIMIT, { silent: true })
            .pipe(map((items) => coachLatest(items, now)))
        : forkJoin({
            feed: this._postService.getFeed(1, FEED_LIMIT).pipe(catchError(() => of(null))),
            overview: this._progressService.overview('4w').pipe(catchError(() => of(null))),
          }).pipe(
            // One half is still worth showing; only both failing is a failure.
            map(({ feed, overview }) =>
              feed || overview
                ? traineeLatest(feed?.items ?? [], overview?.records ?? [], now)
                : null,
            ),
          );

    read
      .pipe(
        take(1),
        catchError(() => of(null)),
        finalize(() => done?.()),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((entries) => {
        if (entries) this._entries.set(entries);
        this._failed.set(entries === null && this._entries().length === 0);
        this._loaded.set(true);
      });
  }
}
