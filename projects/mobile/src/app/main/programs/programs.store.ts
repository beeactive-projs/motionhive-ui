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
   * Whose content to show. Narrows what is already loaded rather than
   * refetching: the list arrives in one page, and `source` travels on every
   * row, so the answer is already here.
   */
  readonly origin = signal<ProgramOrigin>(ProgramOrigins.All);

  readonly loading = this._loading.asReadonly();

  readonly programs = computed(() => this._all().filter((p) => !p.isSingleWorkout));
  readonly routines = computed(() => this._all().filter((p) => p.isSingleWorkout));

  /** The rows left after the origin pill, before the size pill narrows them. */
  private readonly _byOrigin = computed(() => {
    const rows = this._all();
    switch (this.origin()) {
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

  /** Counts within the chosen origin — a pill must predict its own result. */
  readonly counts = computed<Record<ProgramSize, number>>(() => {
    const rows = this._byOrigin();
    return {
      all: rows.length,
      program: rows.filter((p) => !p.isSingleWorkout).length,
      routine: rows.filter((p) => p.isSingleWorkout).length,
    };
  });

  /**
   * Counts per origin, within the type filter that is already on — a pill
   * must predict its own result. Showing 20 beside a list of 12 routines
   * would be a number the tap cannot produce.
   */
  readonly originCounts = computed<Record<ProgramOrigin, number>>(() => {
    const size = this.size();
    const rows = this._all().filter((p) =>
      size === ProgramSizes.Program
        ? !p.isSingleWorkout
        : size === ProgramSizes.Routine
          ? p.isSingleWorkout
          : true,
    );
    return {
      all: rows.length,
      mine: rows.filter((p) => p.source !== ProgramSource.System).length,
      starters: rows.filter((p) => p.source === ProgramSource.System).length,
    };
  });

  setOrigin(origin: ProgramOrigin): void {
    this.origin.set(origin);
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

  setSize(size: ProgramSize): void {
    this.size.set(size);
  }
}
