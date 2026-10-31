import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, Observable, of, take } from 'rxjs';

import { NavMode, NavModes, PostService, ProgressService, RosterService } from 'core';

import { coachLatest, LatestEntry, latestCapped, traineeLatest } from '../home.config';

/** The coach feed's cap (the API's most), and its window (two weeks) is the page's. */
const ACTIVITY_LIMIT = 20;
/** Two weeks of a few groups' posts; the API caps a page at 100. */
const FEED_LIMIT = 50;

/** One answer: the entries, and whether the feed stopped at its cap. */
interface LatestPage {
  entries: LatestEntry[];
  capped: boolean;
}

/**
 * Data behind the Latest page: the last two weeks, for whichever side the
 * reader is on. A coach reads their clients' finished workouts
 * (`/coach/activity`); a trainee their groups' posts (`/posts/feed`) and
 * their own records (Progress), merged by time. Every read is silent: the
 * page says itself when nothing could be loaded.
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
  private readonly _capped = signal(false);

  readonly entries = this._entries.asReadonly();
  /** A first answer has come back, with items or without. */
  readonly loaded = this._loaded.asReadonly();
  /** The read failed and there is nothing older to keep showing. */
  readonly failed = this._failed.asReadonly();
  /**
   * The coach feed came back full inside the window: the API serves at most
   * the latest `ACTIVITY_LIMIT` workouts, so older ones of the two weeks may
   * be missing, and the page says how many it shows (`latestCapped`).
   */
  readonly capped = this._capped.asReadonly();
  /** How many workouts a full coach feed holds, for the page to say so. */
  readonly limit = ACTIVITY_LIMIT;

  load(mode: NavMode, done?: () => void): void {
    const now = new Date();
    const read: Observable<LatestPage | null> =
      mode === NavModes.Coach
        ? this._rosterService.activity(ACTIVITY_LIMIT, { silent: true }).pipe(
            map((items) => {
              const entries = coachLatest(items, now);
              return {
                entries,
                capped: latestCapped(items.length, entries.length, ACTIVITY_LIMIT),
              };
            }),
          )
        : forkJoin({
            feed: this._postService
              .getFeed(1, FEED_LIMIT, { silent: true })
              .pipe(catchError(() => of(null))),
            overview: this._progressService
              .overview('4w', { silent: true })
              .pipe(catchError(() => of(null))),
          }).pipe(
            // One half is still worth showing; only both failing is a failure.
            map(({ feed, overview }) =>
              feed || overview
                ? {
                    entries: traineeLatest(feed?.items ?? [], overview?.records ?? [], now),
                    capped: false,
                  }
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
      .subscribe((page) => {
        if (page) {
          this._entries.set(page.entries);
          this._capped.set(page.capped);
        }
        this._failed.set(page === null && this._entries().length === 0);
        this._loaded.set(true);
      });
  }
}
