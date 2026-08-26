import { Signal, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import {
  InstructorSearchResult,
  ProfileService,
  PublicSessionInstance,
  SessionService,
} from 'core';

/** Shorter than this matches most of the catalogue. */
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 300;
const SESSION_LIMIT = 20;

/** Per-endpoint results; null marks that endpoint's request failing (an
    empty answer is `[]`, never null). */
interface DiscoverSearchHits {
  coaches: InstructorSearchResult[] | null;
  sessions: PublicSessionInstance[] | null;
}

export interface DiscoverSearch {
  /** What the field currently holds, including below-minimum text. */
  readonly query: Signal<string>;
  /** True once the query is long enough to have been sent. */
  readonly isActive: Signal<boolean>;
  /** True while requests are in flight. */
  readonly isSearching: Signal<boolean>;
  readonly coaches: Signal<InstructorSearchResult[]>;
  readonly sessions: Signal<PublicSessionInstance[]>;
  /** Query ran and neither section has anything to show. */
  readonly isEmpty: Signal<boolean>;
  /** Both endpoints failed — a connection problem, not a thin catalogue. */
  readonly hasError: Signal<boolean>;
  setQuery(value: string): void;
  clear(): void;
}

/**
 * Discover's cross-type search: one query fanned out to the coach directory
 * and the session discover endpoint in parallel, stitched client-side — the
 * `injectPeopleSearch` recipe with a `forkJoin` in the `switchMap`.
 *
 * Each endpoint fails independently: one section can render while the other
 * stays silent, and only both failing surfaces an error state.
 *
 * Call from an injection context.
 */
export function injectDiscoverSearch(): DiscoverSearch {
  const profileService = inject(ProfileService);
  const sessionService = inject(SessionService);

  const query = signal('');
  const isSearching = signal(false);
  const input = new Subject<string>();

  const hits = toSignal(
    input.pipe(
      map((value) => value.trim()),
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.length < MIN_LENGTH) {
          isSearching.set(false);
          return of<DiscoverSearchHits>({ coaches: [], sessions: [] });
        }
        isSearching.set(true);
        return forkJoin({
          coaches: profileService
            .discoverInstructors(term)
            .pipe(catchError(() => of<InstructorSearchResult[] | null>(null))),
          sessions: sessionService.discover({ q: term, limit: SESSION_LIMIT }).pipe(
            map((page) => page.items),
            catchError(() => of<PublicSessionInstance[] | null>(null)),
          ),
        }).pipe(tap(() => isSearching.set(false)));
      }),
    ),
    { initialValue: { coaches: [], sessions: [] } as DiscoverSearchHits },
  );

  const isActive = computed(() => query().trim().length >= MIN_LENGTH);
  const settled = computed(() => isActive() && !isSearching());

  return {
    query: query.asReadonly(),
    isActive,
    isSearching: isSearching.asReadonly(),
    coaches: computed(() => hits().coaches ?? []),
    sessions: computed(() => hits().sessions ?? []),
    isEmpty: computed(() => {
      if (!settled()) return false;
      const { coaches, sessions } = hits();
      if (coaches === null && sessions === null) return false;
      return (coaches?.length ?? 0) === 0 && (sessions?.length ?? 0) === 0;
    }),
    hasError: computed(() => {
      if (!settled()) return false;
      const { coaches, sessions } = hits();
      return coaches === null && sessions === null;
    }),
    setQuery(value: string) {
      query.set(value);
      // Set before the debounce, not inside the switchMap — otherwise the
      // 300ms wait renders as "nothing found" on every search.
      if (value.trim().length >= MIN_LENGTH) isSearching.set(true);
      input.next(value);
    },
    clear() {
      query.set('');
      input.next('');
    },
  };
}
