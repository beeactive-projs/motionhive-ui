import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, take } from 'rxjs';

import {
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  RosterService,
  RosterSummary,
  RosterWindow,
} from 'core';

import { HiveRanges } from './client-hive.config';

/** Active plans read to find the ones ending soon: the API's page cap, as Home reads them. */
const ASSIGNMENT_LIMIT = 100;

/**
 * Data behind the coach's hive page: the roster for the range on screen
 * (`/coach/roster`, rolling 7 days or 4 weeks) and the coach's active plans,
 * for the plans that end soon and the planned days of a client's week.
 *
 * Each range is kept once read, so switching back is instant and a reread
 * replaces it in place: the comb never empties to reload. Every read is
 * silent; the page says what failed.
 */
@Injectable()
export class ClientHiveStore {
  private readonly _rosterService = inject(RosterService);
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _rosters = signal<Partial<Record<RosterWindow, RosterSummary>>>({});
  private readonly _failed = signal<Partial<Record<RosterWindow, boolean>>>({});
  private readonly _loading = signal<Partial<Record<RosterWindow, boolean>>>({});
  private readonly _assignments = signal<ProgramAssignment[]>([]);

  readonly range = signal<RosterWindow>(HiveRanges.Week);
  readonly assignments = this._assignments.asReadonly();

  private readonly _busy = computed(() => !!this._loading()[this.range()]);
  private readonly _lastFailed = computed(() => !!this._failed()[this.range()]);
  private readonly _own = computed(() => this._rosters()[this.range()] ?? null);

  /**
   * The range on screen, or, while a range read for the first time is on
   * its way, the other one, dimmed: the comb never empties to switch.
   */
  readonly roster = computed(
    () => this._own() ?? (this._busy() ? (Object.values(this._rosters())[0] ?? null) : null),
  );
  readonly clients = computed(() => this.roster()?.clients ?? []);

  /** The first answer is still on its way (a retry included). */
  readonly loading = computed(() => !this.roster() && (this._busy() || !this._lastFailed()));
  /** The other range's comb, shown dimmed until this one's arrives. */
  readonly refreshing = computed(() => !this._own() && !!this.roster());
  /** Only when there is nothing older on screen to keep showing. */
  readonly showError = computed(() => !this.roster() && this._lastFailed() && !this._busy());

  /** No active clients at all. */
  readonly isEmpty = computed(() => this.roster()?.clients.length === 0);

  /** Everything the page shows. `done` runs once both reads have answered. */
  load(done?: () => void): void {
    let left = 2;
    const settle = () => {
      left -= 1;
      if (left === 0) done?.();
    };
    this._loadRoster(this.range(), settle);
    this._loadAssignments(settle);
  }

  /** Another range: shown at once if it was read before, and read again either way. */
  setRange(range: RosterWindow): void {
    if (range === this.range()) return;
    this.range.set(range);
    this._loadRoster(range);
  }

  private _loadRoster(range: RosterWindow, settle?: () => void): void {
    this._loading.update((all) => ({ ...all, [range]: true }));
    this._rosterService
      .roster(range, { silent: true })
      .pipe(
        take(1),
        catchError(() => of(null)),
        finalize(() => {
          this._loading.update((all) => ({ ...all, [range]: false }));
          settle?.();
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((roster) => {
        if (roster) this._rosters.update((all) => ({ ...all, [range]: roster }));
        this._failed.update((all) => ({ ...all, [range]: roster === null }));
      });
  }

  /** Silent: without it only the "plan ends soon" action and the planned days go missing. */
  private _loadAssignments(settle: () => void): void {
    this._programAssignmentService
      .listForInstructor(
        { status: ProgramAssignmentStatus.Active, limit: ASSIGNMENT_LIMIT },
        { silent: true },
      )
      .pipe(
        take(1),
        catchError(() => of(null)),
        finalize(settle),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((page) => {
        if (page) this._assignments.set(page.items);
      });
  }
}
