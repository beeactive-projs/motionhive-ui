import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';

import { Program, ProgramService, ProgramSize } from 'core';

const PAGE_SIZE = 50;

/**
 * The library behind screen 7a.
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
  private readonly _failed = signal(false);

  readonly size = signal<ProgramSize>('all');

  readonly loading = this._loading.asReadonly();
  readonly hasLoaded = this._loaded.asReadonly();
  readonly failed = this._failed.asReadonly();

  readonly programs = computed(() => this._all().filter((p) => !p.isSingleWorkout));
  readonly routines = computed(() => this._all().filter((p) => p.isSingleWorkout));

  readonly visible = computed(() => {
    switch (this.size()) {
      case 'program':
        return this.programs();
      case 'routine':
        return this.routines();
      default:
        return this._all();
    }
  });

  readonly counts = computed(() => ({
    all: this._all().length,
    program: this.programs().length,
    routine: this.routines().length,
  }));

  readonly isEmpty = computed(() => this._loaded() && this._all().length === 0);

  /** First load only — a refresh happens under the rows already on screen. */
  readonly showSkeleton = computed(() => this._loading() && !this._loaded());

  load(opts: { done?: () => void } = {}): void {
    this._loading.set(true);
    this._failed.set(false);

    this._programService
      .list({ limit: PAGE_SIZE })
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          // Newest first: the thing you just made is the thing you want.
          this._all.set(
            [...page.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          );
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
        error: () => {
          this._failed.set(true);
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
      });
  }

  /** Drop a deleted row without refetching the whole library. */
  forget(id: string): void {
    this._all.update((rows) => rows.filter((row) => row.id !== id));
  }
}
