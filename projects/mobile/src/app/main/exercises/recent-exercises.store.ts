import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthStore, Exercise } from 'core';

const STORAGE_PREFIX = 'mh.recentExercises.v1';
const MAX_ENTRIES = 12;

/**
 * The exercises this coach reached for last, kept on the device.
 *
 * The program picker opens on these. There is no server-side notion of a
 * coach's most-used movements, and inventing one would be a schema change to
 * answer a question the phone can answer locally — a picker that opens on
 * the last dozen things you programmed is right far more often than one that
 * opens on the alphabet.
 *
 * Keyed by user id, so two accounts on one phone never see each other's
 * picks. That is the whole logout story: nothing to clear, because the next
 * account reads a different key.
 *
 * The list row is stored whole, because that is what the picker hands back
 * to the program when it commits. It can go stale — a renamed or deleted
 * exercise sits here until it is picked again — which is fine for a
 * shortcut: the detail page and the program both re-read from the server,
 * so nothing downstream trusts this copy. Storage that refuses to read or
 * write costs the shortcut and nothing else, so every access is guarded.
 */
@Injectable({ providedIn: 'root' })
export class RecentExercisesStore {
  private readonly _authStore = inject(AuthStore);

  /** Bumped on every write so the computed re-reads storage. */
  private readonly _version = signal(0);

  private readonly _key = computed(
    () => `${STORAGE_PREFIX}.${this._authStore.user()?.id ?? 'anonymous'}`,
  );

  readonly exercises = computed<Exercise[]>(() => {
    this._version();
    return read(this._key());
  });

  /** Most recent first, deduped by id, capped. */
  push(exercise: Exercise): void {
    const next = [
      exercise,
      ...this.exercises().filter((entry) => entry.id !== exercise.id),
    ].slice(0, MAX_ENTRIES);
    write(this._key(), next);
    this._version.update((version) => version + 1);
  }
}

function read(key: string): Exercise[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Exercise[]) : [];
  } catch {
    // Unparseable or unavailable storage: an empty recents list is a
    // correct answer, and the picker's search still works.
    return [];
  }
}

function write(key: string, entries: Exercise[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    /* private mode / storage disabled */
  }
}
