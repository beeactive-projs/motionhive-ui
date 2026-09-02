import { Signal, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { UserRole, UserSearchResult, UserService } from 'core';

/** Shorter than this matches most of the directory. */
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 300;
const LIMIT = 20;

/**
 * Narrowing the directory. The inbox searches everyone; the invite sheet wants
 * trainees only, and only ones the coach is not already connected to.
 */
export interface PeopleSearchOptions {
  role?: UserRole;
  excludeConnected?: boolean;
}

export interface PeopleSearch {
  /** What the field currently holds, including below-minimum text. */
  readonly query: Signal<string>;
  /** True once the query is long enough to have been sent. */
  readonly isActive: Signal<boolean>;
  /** True while a request is in flight. */
  readonly isSearching: Signal<boolean>;
  readonly results: Signal<UserSearchResult[]>;
  /** Query ran and came back with nobody. */
  readonly isEmpty: Signal<boolean>;
  setQuery(value: string): void;
  clear(): void;
}

/**
 * Debounced people lookup against `/users/search`, shared by the inbox search
 * and the new-message sheet.
 *
 * `switchMap` matters here: a fast typist fires several requests and only the
 * last one's results may land, or an abandoned query overwrites a newer one.
 *
 * Call from an injection context.
 */
export function injectPeopleSearch(options: PeopleSearchOptions = {}): PeopleSearch {
  const userService = inject(UserService);

  const query = signal('');
  const isSearching = signal(false);
  const input = new Subject<string>();

  const results = toSignal(
    input.pipe(
      map((value) => value.trim()),
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.length < MIN_LENGTH) {
          isSearching.set(false);
          return of<UserSearchResult[]>([]);
        }
        isSearching.set(true);
        return userService
          .search({ q: term, limit: LIMIT, ...options })
          .pipe(tap(() => isSearching.set(false)));
      }),
    ),
    { initialValue: [] as UserSearchResult[] },
  );

  const isActive = computed(() => query().trim().length >= MIN_LENGTH);

  return {
    query: query.asReadonly(),
    isActive,
    isSearching: isSearching.asReadonly(),
    results,
    isEmpty: computed(() => isActive() && !isSearching() && results().length === 0),
    setQuery(value: string) {
      query.set(value);
      // Set before the debounce, not inside the switchMap — otherwise the
      // 300ms wait renders as "nobody found" on every search.
      if (value.trim().length >= MIN_LENGTH) isSearching.set(true);
      input.next(value);
    },
    clear() {
      query.set('');
      input.next('');
    },
  };
}
