import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';

import { Program, ProgramService, ProgramSize, ProgramSizes, ProgramSource } from 'core';

import { ProgramOrigin, ProgramOrigins } from './programs.config';

const PAGE_SIZE = 50;

/**
 * The library behind the Programs screen.
 *
 * Programs and routines are one list because they are one entity at two
 * sizes — `GET /programs` returns both and `isSingleWorkout` tells them
 * apart. The pills filter what is already loaded rather than refetching:
 * the split is a property of each row, not a different query.
 */
@Injectable()
export class ProgramsStore {
  private readonly _programService = inject(ProgramService);

  private readonly _all = signal<Program[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);
  private _seq = 0;

  readonly size = signal<ProgramSize>(ProgramSizes.All);

  /**
   * Whose content to show — the coach's own by default. The MotionHive
   * starters sit in every coach's library, and opening on all of them mixed
   * in buried the coach's own work; they are one pill away. Narrows what is
   * already loaded rather than refetching: the list arrives in one page, and
   * `source` travels on every row, so the answer is already here.
   */
  readonly origin = signal<ProgramOrigin>(ProgramOrigins.Mine);

  /** An origin a size pill set aside, offered again the next time the sheet opens. */
  private readonly _keptOrigin = signal<ProgramOrigin | null>(null);

  /** What the sheet opens on: the origin on screen, or the one set aside. */
  readonly sheetOrigin = computed(() =>
    this.origin() !== ProgramOrigins.Mine ? this.origin() : (this._keptOrigin() ?? this.origin()),
  );

  private readonly _hasOwn = computed(() =>
    this._all().some((p) => p.source !== ProgramSource.System),
  );

  /**
   * The origin actually applied. "Mine" with nothing of your own would open
   * on an empty list beside a library full of starters, so it shows
   * everything until there is something of yours to show.
   */
  private readonly _appliedOrigin = computed<ProgramOrigin>(() =>
    this.origin() === ProgramOrigins.Mine && !this._hasOwn() ? ProgramOrigins.All : this.origin(),
  );

  readonly loading = this._loading.asReadonly();

  readonly programs = computed(() => this._all().filter((p) => !p.isSingleWorkout));
  readonly routines = computed(() => this._all().filter((p) => p.isSingleWorkout));

  /** The rows left after the origin pill, before the size pill narrows them. */
  private readonly _byOrigin = computed(() => {
    const rows = this._all();
    switch (this._appliedOrigin()) {
      case ProgramOrigins.Mine:
        return rows.filter((p) => p.source !== ProgramSource.System);
      case ProgramOrigins.Starters:
        return rows.filter((p) => p.source === ProgramSource.System);
      default:
        return rows;
    }
  });

  readonly visible = computed(() => {
    const rows = this._byOrigin();
    switch (this.size()) {
      case ProgramSizes.Program:
        return rows.filter((p) => !p.isSingleWorkout);
      case ProgramSizes.Routine:
        return rows.filter((p) => p.isSingleWorkout);
      default:
        return rows;
    }
  });

  /**
   * Counts within Mine, the origin a pill lands on (it sets any other aside)
   * — a pill must predict its own result.
   */
  readonly counts = computed<Record<ProgramSize, number>>(() => {
    const all = this._all();
    const rows = this._hasOwn() ? all.filter((p) => p.source !== ProgramSource.System) : all;
    return {
      all: rows.length,
      program: rows.filter((p) => !p.isSingleWorkout).length,
      routine: rows.filter((p) => p.isSingleWorkout).length,
    };
  });

  /**
   * Counts per origin — a pill must predict its own result. All and Starters
   * put the size pill back on All, so they count every size; Mine keeps the
   * size pill, so it counts within it. Showing 20 beside a list of 12
   * routines would be a number the tap cannot produce.
   */
  readonly originCounts = computed<Record<ProgramOrigin, number>>(() => {
    const size = this.size();
    const rows = this._all();
    const mine = rows.filter(
      (p) =>
        p.source !== ProgramSource.System &&
        (size === ProgramSizes.Program
          ? !p.isSingleWorkout
          : size === ProgramSizes.Routine
            ? p.isSingleWorkout
            : true),
    );
    return {
      all: rows.length,
      mine: mine.length,
      starters: rows.filter((p) => p.source === ProgramSource.System).length,
    };
  });

  /** An origin other than Mine puts the size pill back on All, under it. */
  setOrigin(origin: ProgramOrigin): void {
    this.origin.set(origin);
    this._keptOrigin.set(null);
    if (origin !== ProgramOrigins.Mine) this.size.set(ProgramSizes.All);
  }

  /** First load only — a refresh happens under the rows already on screen. */
  readonly showSkeleton = computed(() => this._loading() && !this._loaded());

  readonly showError = computed(() => this._error() && this._all().length === 0);

  private readonly _isSettledEmpty = computed(
    () => this._loaded() && !this._loading() && !this._error() && this._all().length === 0,
  );

  /** Nothing authored at all — the beginning, not a dead end. */
  readonly isEmpty = computed(() => this._isSettledEmpty());

  /** A pill narrowed the library to nothing, but the library itself is not empty. */
  readonly isFilteredEmpty = computed(
    () => this._loaded() && this._all().length > 0 && this.visible().length === 0,
  );

  load(opts: { done?: () => void } = {}): void {
    const seq = ++this._seq;
    this._loading.set(true);
    this._error.set(false);

    this._programService
      .list({ limit: PAGE_SIZE })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          if (seq !== this._seq) {
            opts.done?.();
            return;
          }
          // Newest first: the thing you just made is the thing you want.
          this._all.set(
            [...page.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          );
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
        error: () => {
          if (seq !== this._seq) {
            opts.done?.();
            return;
          }
          this._error.set(true);
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
      });
  }

  /**
   * A size pill and the sheet's origin are one choice, as the strip shows
   * only one thing on: picking a pill, All included, sets an origin other
   * than Mine aside. The sheet opens on it again, so Apply brings it back.
   */
  setSize(size: ProgramSize): void {
    if (this.origin() !== ProgramOrigins.Mine) {
      this._keptOrigin.set(this.origin());
      this.origin.set(ProgramOrigins.Mine);
    }
    this.size.set(size);
  }
}
