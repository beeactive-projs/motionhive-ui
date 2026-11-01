import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, Observable, of, switchMap, take } from 'rxjs';

import { WorkoutLog, WorkoutLogService } from 'core';

import { WorkoutPhotoStore } from '../../workouts/_services/workout-photo';
import { monthDays, monthKey, monthOf, monthWindow, shiftMonth } from './month-hive.config';

/** The list endpoint's page cap: most months fit in one page. */
const PAGE_LIMIT = 100;

/**
 * Data behind the trainee's month hive: one month of their timeline
 * (finished workouts and skipped plan days, `kind: 'all'`), read whole,
 * and the small crops of the photos in it.
 *
 * Each month is kept once read, so the arrows come back to it at once and
 * a reread (back from a workout, where a photo may have been added)
 * replaces it in place. Photos load after the board, one by one, cached by
 * workout and version (`WorkoutPhotoStore`), and never hold the board up.
 */
@Injectable()
export class MonthHiveStore {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _photos = inject(WorkoutPhotoStore);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _logs = signal<Record<string, WorkoutLog[]>>({});
  private readonly _failed = signal<Record<string, boolean>>({});
  private readonly _loading = signal<Record<string, boolean>>({});
  private readonly _photoUrls = signal<Record<string, string>>({});
  private readonly _asked = new Set<string>();

  /** Re-read on every entry, so a page left open overnight moves on. */
  readonly today = signal(new Date());
  readonly month = signal(monthOf(new Date()));

  readonly key = computed(() => monthKey(this.month()));
  readonly logs = computed(() => this._logs()[this.key()] ?? null);

  /** The month's days, with or without its workouts yet. */
  readonly days = computed(() => monthDays(this.month(), this.today(), this.logs() ?? []));

  private readonly _busy = computed(() => !!this._loading()[this.key()]);
  private readonly _lastFailed = computed(() => !!this._failed()[this.key()]);

  /** The first answer for this month is still on its way (a retry included). */
  readonly loading = computed(() => !this.logs() && (this._busy() || !this._lastFailed()));
  /** Only when there is nothing older on screen to keep showing. */
  readonly showError = computed(() => !this.logs() && this._lastFailed() && !this._busy());

  /** A photo's object URL once loaded, by workout and version. */
  photoUrl(log: WorkoutLog): string | null {
    return this._photoUrls()[photoKey(log)] ?? null;
  }

  /** The month on screen; `done` runs once it has answered. */
  load(done?: () => void): void {
    this.today.set(new Date());
    this._load(this.month(), done);
  }

  /** The month before or after: shown at once if read before, and read again either way. */
  step(delta: number): void {
    this.month.set(shiftMonth(this.month(), delta));
    this._load(this.month());
  }

  private _load(month: Date, done?: () => void): void {
    const key = monthKey(month);
    this._loading.update((all) => ({ ...all, [key]: true }));
    this._readMonth(month)
      .pipe(
        take(1),
        catchError(() => of(null)),
        finalize(() => {
          this._loading.update((all) => ({ ...all, [key]: false }));
          done?.();
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((logs) => {
        if (logs) {
          this._logs.update((all) => ({ ...all, [key]: logs }));
          this._loadPhotos(month, logs);
        }
        this._failed.update((all) => ({ ...all, [key]: logs === null }));
      });
  }

  /** Every page of the month: the first says how many there are. */
  private _readMonth(month: Date): Observable<WorkoutLog[]> {
    const query = { kind: 'all' as const, ...monthWindow(month), limit: PAGE_LIMIT };
    return this._workoutLogService.list({ ...query, page: 1 }, { silent: true }).pipe(
      switchMap((first) => {
        const pages = Math.ceil(first.total / PAGE_LIMIT);
        if (pages <= 1) return of(first.items);
        const rest = Array.from({ length: pages - 1 }, (_, i) =>
          this._workoutLogService
            .list({ ...query, page: i + 2 }, { silent: true })
            .pipe(map((page) => page.items)),
        );
        return forkJoin(rest).pipe(map((more) => [...first.items, ...more.flat()]));
      }),
    );
  }

  /**
   * The crop of each photo the board shows (the latest photo of a day),
   * each asked for once per version. A failure leaves the day in honey.
   */
  private _loadPhotos(month: Date, logs: readonly WorkoutLog[]): void {
    const shown = monthDays(month, this.today(), logs)
      .filter((day) => day.inMonth)
      .map((day) => day.photo)
      .filter((log): log is WorkoutLog => log !== null);
    for (const log of shown) {
      const key = photoKey(log);
      if (this._asked.has(key)) continue;
      this._asked.add(key);
      this._photos
        .thumbUrl(log.id, log.photoVersion ?? null)
        .pipe(take(1), takeUntilDestroyed(this._destroyRef))
        .subscribe({
          next: (url) => this._photoUrls.update((all) => ({ ...all, [key]: url })),
          error: () => this._asked.delete(key),
        });
    }
  }
}

function photoKey(log: WorkoutLog): string {
  return `${log.id}:${log.photoVersion ?? 0}`;
}
