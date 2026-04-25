import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'mh.recentSearches.v1';
const MAX_ENTRIES = 10;

/**
 * Recent search queries — stored in localStorage, capped at 10 entries,
 * FIFO. Per-device by design: a phone's recents and a laptop's recents
 * are different and that's the desired behavior at our scale.
 *
 * If/when we want cross-device sync, write-through to a `recent_search`
 * BE table — see search recommendations doc, §5.
 */
@Injectable({ providedIn: 'root' })
export class RecentSearchesStore {
  private readonly _entries = signal<string[]>(this._read());

  readonly entries = this._entries.asReadonly();

  /** Push a query to the top, dedupe case-insensitively, cap at MAX_ENTRIES. */
  push(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();

    const next = [trimmed, ...this._entries().filter((e) => e.toLowerCase() !== lower)].slice(
      0,
      MAX_ENTRIES,
    );
    this._entries.set(next);
    this._write(next);
  }

  remove(query: string): void {
    const lower = query.trim().toLowerCase();
    const next = this._entries().filter((e) => e.toLowerCase() !== lower);
    this._entries.set(next);
    this._write(next);
  }

  clear(): void {
    this._entries.set([]);
    this._write([]);
  }

  private _read(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
        .slice(0, MAX_ENTRIES);
    } catch {
      return [];
    }
  }

  private _write(value: string[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage disabled — recents become session-only.
    }
  }
}
