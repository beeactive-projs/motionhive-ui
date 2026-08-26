import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { InstructorSearchResult, ProfileService } from 'core';

/**
 * The coach directory behind Discover — the "Taking new clients" rail and
 * the pushed all-coaches page. Page-scoped (`providers: [DiscoverCoachesStore]`)
 * so each surface owns its instance and refetch policy.
 *
 * The endpoint returns the whole directory as one plain array — no paging,
 * no total — so a `loaded` gate plus client-side filtering is the entire
 * strategy.
 */
@Injectable()
export class DiscoverCoachesStore {
  private readonly _profileService = inject(ProfileService);

  private readonly _coaches = signal<InstructorSearchResult[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);
  private readonly _loaded = signal(false);

  readonly coaches = this._coaches.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** The rail's list — only coaches with the door open. API order, not a
      ranking: no ranking exists and the rail must not imply one. */
  readonly acceptingCoaches = computed(() =>
    this._coaches().filter((coach) => coach.isAcceptingClients),
  );

  load(opts: { force?: boolean; done?: () => void } = {}): void {
    if (this._loading() || (this._loaded() && !opts.force)) {
      opts.done?.();
      return;
    }
    this._loading.set(true);
    this._error.set(false);

    this._profileService
      .discoverInstructors()
      .pipe(take(1))
      .subscribe({
        next: (coaches) => {
          this._coaches.set(coaches);
          this._loaded.set(true);
          this._loading.set(false);
          opts.done?.();
        },
        // A failed load does not latch `loaded`, so the next view entry retries.
        error: () => {
          this._error.set(true);
          this._loading.set(false);
          opts.done?.();
        },
      });
  }
}
