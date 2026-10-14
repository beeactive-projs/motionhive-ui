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
  DiscoverGroup,
  GroupService,
  InstructorSearchResult,
  ProfileService,
  PublicSessionInstance,
  SessionService,
} from 'core';

/** Shorter than this matches most of the catalogue. */
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 300;
const SESSION_LIMIT = 20;
const GROUP_LIMIT = 10;

/** Per-endpoint results; null marks that endpoint's request failing (an
    empty answer is `[]`, never null). */
interface DiscoverSearchHits {
  coaches: InstructorSearchResult[] | null;
  groups: DiscoverGroup[] | null;
  sessions: PublicSessionInstance[] | null;
}

const NO_HITS: DiscoverSearchHits = { coaches: [], groups: [], sessions: [] };

export interface DiscoverSearch {
  /** What the field currently holds, including below-minimum text. */
  readonly query: Signal<string>;
  /** True once the query is long enough to have been sent. */
  readonly isActive: Signal<boolean>;
  /** True while requests are in flight. */
  readonly isSearching: Signal<boolean>;
  readonly coaches: Signal<InstructorSearchResult[]>;
  readonly groups: Signal<DiscoverGroup[]>;
  readonly sessions: Signal<PublicSessionInstance[]>;
  /** Query ran and neither section has anything to show. */
  readonly isEmpty: Signal<boolean>;
  /** Every endpoint failed — a connection problem, not a thin catalogue. */
  readonly hasError: Signal<boolean>;
  setQuery(value: string): void;
  clear(): void;
}

/**
 * Discover's cross-type search: one query fanned out to the coach directory,
 * public groups and the session discover endpoint in parallel, stitched
 * client-side — the `injectPeopleSearch` recipe with a `forkJoin` in the
 * `switchMap`. Ordinary members are not searchable yet; when they are, they
 * join here as one more endpoint and one more section.
 *
 * Each endpoint fails independently: one section can render while another
 * stays silent, and only all of them failing surfaces an error state.
 *
 * Call from an injection context.
 */
export function injectDiscoverSearch(): DiscoverSearch {
  const profileService = inject(ProfileService);
  const groupService = inject(GroupService);
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
          return of<DiscoverSearchHits>(NO_HITS);
        }
        isSearching.set(true);
        return forkJoin({
          coaches: profileService
            .discoverInstructors(term)
            .pipe(catchError(() => of<InstructorSearchResult[] | null>(null))),
          groups: groupService.discoverGroups({ search: term, limit: GROUP_LIMIT }).pipe(
            map((page) => page.items),
            catchError(() => of<DiscoverGroup[] | null>(null)),
          ),
          sessions: sessionService.discover({ q: term, limit: SESSION_LIMIT }).pipe(
            map((page) => page.items),
            catchError(() => of<PublicSessionInstance[] | null>(null)),
          ),
        }).pipe(tap(() => isSearching.set(false)));
      }),
    ),
    { initialValue: NO_HITS },
  );

  const isActive = computed(() => query().trim().length >= MIN_LENGTH);
  const settled = computed(() => isActive() && !isSearching());

  return {
    query: query.asReadonly(),
    isActive,
    isSearching: isSearching.asReadonly(),
    coaches: computed(() => hits().coaches ?? []),
    groups: computed(() => hits().groups ?? []),
    sessions: computed(() => hits().sessions ?? []),
    isEmpty: computed(() => {
      if (!settled()) return false;
      const { coaches, groups, sessions } = hits();
      if (coaches === null && groups === null && sessions === null) return false;
      return (
        (coaches?.length ?? 0) === 0 && (groups?.length ?? 0) === 0 && (sessions?.length ?? 0) === 0
      );
    }),
    hasError: computed(() => {
      if (!settled()) return false;
      const { coaches, groups, sessions } = hits();
      return coaches === null && groups === null && sessions === null;
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
