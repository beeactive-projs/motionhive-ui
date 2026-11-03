import { Signal, computed, inject, signal } from '@angular/core';

import { AuthStore, appLanguage } from 'core';

import {
  RecentPerson,
  RecentSearchScope,
  parseRecents,
  pushRecent,
  removeRecent,
} from '../config/recent-searches.config';

const STORAGE_PREFIX = 'mh.recentSearches.v1';

export interface RecentSearches {
  /** Newest first, at most `RECENT_SEARCH_LIMIT`. */
  readonly entries: Signal<RecentPerson[]>;
  push(person: RecentPerson): void;
  remove(id: string): void;
  clear(): void;
}

/**
 * One screen's recent searches, kept on the device.
 *
 * Keyed by user id, the way `RecentExercisesStore` is, so two accounts on one
 * phone never see each other's people and signing out needs nothing cleared.
 * Storage that refuses to read or write costs the shortcut and nothing else,
 * so every access is guarded.
 *
 * `perLanguage` keys the list by language as well, for entries whose names
 * are translated (exercises): after a switch the shortcut starts empty rather
 * than showing names in the old language. A person's name is the same in
 * both, so the people screens leave it off.
 *
 * Call from an injection context.
 */
export function injectRecentSearches(
  scope: RecentSearchScope,
  { perLanguage = false }: { perLanguage?: boolean } = {},
): RecentSearches {
  const authStore = inject(AuthStore);

  /** Bumped on every write so `entries` re-reads storage. */
  const version = signal(0);
  const key = computed(() => {
    const base = `${STORAGE_PREFIX}.${scope}.${authStore.user()?.id ?? 'anonymous'}`;
    return perLanguage ? `${base}.${appLanguage()}` : base;
  });

  const entries = computed(() => {
    version();
    return read(key());
  });

  const save = (next: RecentPerson[]) => {
    write(key(), next);
    version.update((value) => value + 1);
  };

  return {
    entries,
    push: (person) => save(pushRecent(entries(), person)),
    remove: (id) => {
      if (entries().some((person) => person.id === id)) save(removeRecent(entries(), id));
    },
    clear: () => save([]),
  };
}

function read(key: string): RecentPerson[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseRecents(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function write(key: string, entries: RecentPerson[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    /* private mode / storage disabled */
  }
}
